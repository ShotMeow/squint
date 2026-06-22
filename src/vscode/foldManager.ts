import * as vscode from 'vscode';
import type { DetectedComment } from '../core/comments/parser.js';
import { SquintFoldingProvider } from './foldingProvider.js';
import type { Logger } from './logger.js';
import type { RenderItem } from './state.js';

/** True when the cursor sits on any line of [startLine, endLine]. */
export function cursorInside(editor: vscode.TextEditor, startLine: number, endLine: number): boolean {
  return editor.selections.some((s) => startLine <= s.active.line && s.active.line <= endLine);
}

/** What the FoldManager needs from the controller. */
export interface FoldHost {
  getItems(uri: string): readonly RenderItem[];
  isActive(): boolean;
  isHandled(document: vscode.TextDocument): boolean;
  /** Whether comments should be compacted at all (displayMode !== 'hover'). */
  compactEnabled(): boolean;
  /** Re-apply the concealing decorations for an editor. */
  rerender(editor: vscode.TextEditor): void;
}

/**
 * Owns comment folding: which comments are collapsed, reveal-on-cursor, and the
 * commands. Folds only via `editor.foldAllBlockComments` (Comment-kind regions
 * only), so it can never collapse a function, class, or any code.
 */
export class FoldManager {
  readonly provider: SquintFoldingProvider;

  /** Documents whose comments have already been folded once (per content). */
  private readonly foldedOnce = new Set<string>();
  /** Comment id the cursor currently sits in, per document. */
  private readonly cursorComment = new Map<string, string | null>();
  /** Documents where the user expanded everything (suppresses auto-fold). */
  private readonly userExpanded = new Set<string>();
  /** Multi-line comment start lines that must stay unfolded (not summarized). */
  private readonly extraFoldLines = new Map<string, number[]>();
  /** Documents with an in-flight fold pass (prevents concurrent fold races). */
  private readonly inProgress = new Set<string>();
  /** Foldable (multi-line) comment ranges, per document. */
  private readonly foldRanges = new Map<string, vscode.FoldingRange[]>();

  constructor(
    private readonly host: FoldHost,
    private readonly logger: Logger,
  ) {
    this.provider = new SquintFoldingProvider((uri) => this.foldRanges.get(uri) ?? [], host.isActive);
  }

  /** Record the detected comments for a document and refresh fold regions. */
  onRender(uri: string, detected: readonly DetectedComment[], extraFoldLines: number[]): void {
    this.foldRanges.set(
      uri,
      detected
        .filter((c) => c.endLine > c.startLine)
        .map((c) => new vscode.FoldingRange(c.startLine, c.endLine, vscode.FoldingRangeKind.Comment)),
    );
    this.extraFoldLines.set(uri, extraFoldLines);
    this.provider.refresh();
  }

  /** A multi-line comment is collapsed when its body lines are hidden. */
  isFolded(editor: vscode.TextEditor, range: vscode.Range): boolean {
    const start = range.start.line;
    const end = range.end.line;
    if (end <= start) return false;
    const visible = editor.visibleRanges;
    const headerVisible = visible.some((r) => r.start.line <= start && start <= r.end.line);
    const bodyHidden = !visible.some((r) => r.start.line <= start + 1 && start + 1 <= r.end.line);
    return headerVisible && bodyHidden;
  }

  /** Fold all comments once per content (Comment-kind only), keeping cursor's open. */
  async foldComments(editor: vscode.TextEditor): Promise<void> {
    if (!this.host.compactEnabled()) return;
    if (vscode.window.activeTextEditor !== editor) return;
    const uri = editor.document.uri.toString();
    if (this.inProgress.has(uri) || this.userExpanded.has(uri)) return;
    if (this.foldedOnce.has(uri)) {
      void this.revealCursorComment(editor);
      return;
    }

    this.inProgress.add(uri);
    try {
      // Ensure our comment ranges are registered as Comment-kind fold regions.
      this.provider.refresh();
      await this.provider.whenProvided(uri, 200);
      if (vscode.window.activeTextEditor !== editor) return;
      await vscode.commands.executeCommand('editor.foldAllBlockComments');
      this.foldedOnce.add(uri);
      await this.unfoldExtras(editor);
      await this.revealCursorComment(editor);
    } catch (err) {
      this.logger.error('Fold-comments failed', err);
    } finally {
      this.inProgress.delete(uri);
    }
  }

  /** Reveal/re-collapse comments as the cursor moves in and out of them. */
  handleSelection(editor: vscode.TextEditor): void {
    if (!this.host.isActive() || !this.host.isHandled(editor.document)) return;
    if (this.host.compactEnabled()) {
      const uri = editor.document.uri.toString();
      const current =
        this.host.getItems(uri).find((i) => cursorInside(editor, i.range.start.line, i.range.end.line))
          ?.id ?? null;
      const previous = this.cursorComment.get(uri) ?? null;
      if (current !== previous) {
        this.cursorComment.set(uri, current);
        if (previous !== null) {
          // Left a comment → re-fold all comments, then keep the current open.
          void vscode.commands
            .executeCommand('editor.foldAllBlockComments')
            .then(() => this.revealCursorComment(editor), () => undefined);
        } else {
          void this.revealCursorComment(editor);
        }
      }
    }
    this.host.rerender(editor);
  }

  /** Expand every comment and stop auto-folding the document. */
  async expandAll(editor: vscode.TextEditor): Promise<void> {
    const uri = editor.document.uri.toString();
    this.userExpanded.add(uri);
    const lines = this.host
      .getItems(uri)
      .filter((i) => i.range.end.line > i.range.start.line)
      .map((i) => i.range.start.line);
    if (lines.length > 0) {
      await vscode.commands
        .executeCommand('editor.unfold', { selectionLines: lines })
        .then(undefined, () => undefined);
    }
    this.host.rerender(editor);
  }

  /** Collapse all comments again. */
  async collapseAll(editor: vscode.TextEditor): Promise<void> {
    const uri = editor.document.uri.toString();
    this.userExpanded.delete(uri);
    this.foldedOnce.delete(uri);
    await this.foldComments(editor);
    this.host.rerender(editor);
  }

  /** Content edited: allow comments to be re-folded on the next render. */
  onContentChanged(uri: string): void {
    this.foldedOnce.delete(uri);
  }

  /** Toggle reset: next render re-folds everything. */
  reset(): void {
    this.userExpanded.clear();
    this.foldedOnce.clear();
  }

  forget(uri: string): void {
    this.foldedOnce.delete(uri);
    this.cursorComment.delete(uri);
    this.userExpanded.delete(uri);
    this.extraFoldLines.delete(uri);
    this.foldRanges.delete(uri);
    this.provider.refresh();
  }

  forgetAll(): void {
    this.foldedOnce.clear();
    this.cursorComment.clear();
    this.userExpanded.clear();
    this.extraFoldLines.clear();
  }

  private async revealCursorComment(editor: vscode.TextEditor): Promise<void> {
    const lines = this.host
      .getItems(editor.document.uri.toString())
      .filter(
        (i) =>
          i.range.end.line > i.range.start.line &&
          cursorInside(editor, i.range.start.line, i.range.end.line) &&
          this.isFolded(editor, i.range),
      )
      .map((i) => i.range.start.line);
    if (lines.length === 0) return;
    await vscode.commands
      .executeCommand('editor.unfold', { selectionLines: lines })
      .then(undefined, () => undefined);
  }

  private async unfoldExtras(editor: vscode.TextEditor): Promise<void> {
    const lines = this.extraFoldLines.get(editor.document.uri.toString()) ?? [];
    if (lines.length === 0) return;
    await vscode.commands
      .executeCommand('editor.unfold', { selectionLines: lines })
      .then(undefined, () => undefined);
  }
}
