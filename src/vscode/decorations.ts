import * as vscode from 'vscode';
import type { RenderItem } from './state.js';

/**
 * Renders the compact view of a *folded* comment: the original first line is
 * visually hidden and replaced by the one-line summary (or a loading spinner).
 * Only folded comments are decorated — expanding restores the original. The
 * document text itself is never modified.
 */
export class DecorationManager implements vscode.Disposable {
  /** Hides the original first-line text behind the summary. */
  private readonly hideType: vscode.TextEditorDecorationType;
  private readonly summaryType: vscode.TextEditorDecorationType;
  /** Accent label for comments carrying a marker (TODO, FIXME, …). */
  private readonly markerType: vscode.TextEditorDecorationType;
  private readonly loadingType: vscode.TextEditorDecorationType;

  constructor() {
    this.hideType = vscode.window.createTextEditorDecorationType({
      // The only way to suppress the original line without modifying the buffer.
      textDecoration: 'none; display: none;',
    });
    this.summaryType = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      before: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
      },
    });
    this.markerType = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      before: {
        color: new vscode.ThemeColor('editorWarning.foreground'),
        fontWeight: 'bold',
      },
    });
    this.loadingType = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      before: {
        color: new vscode.ThemeColor('descriptionForeground'),
        fontStyle: 'italic',
      },
    });
  }

  private firstLine(editor: vscode.TextEditor, range: vscode.Range): vscode.Range {
    return new vscode.Range(range.start, editor.document.lineAt(range.start.line).range.end);
  }

  /**
   * @param summaries comments shown compactly (folded multi-line, or single-line)
   * @param loading   comments still being summarized (by full range)
   * @param spinner   current spinner frame for the loading label
   */
  apply(
    editor: vscode.TextEditor,
    summaries: readonly RenderItem[],
    loading: readonly vscode.Range[],
    spinner: string,
  ): void {
    // Conceal the first line's text and render the summary there; folding
    // collapses the remaining lines of multi-line comments.
    const concealed = [
      ...summaries.map((i) => this.firstLine(editor, i.range)),
      ...loading.map((r) => this.firstLine(editor, r)),
    ];
    editor.setDecorations(this.hideType, concealed);

    const labelAt = (item: RenderItem): vscode.DecorationOptions => ({
      range: new vscode.Range(item.range.start, item.range.start),
      renderOptions: {
        before: { contentText: item.marker ? `${item.marker} ⋯ ${item.summary}` : `⋯ ${item.summary}` },
      },
    });
    editor.setDecorations(
      this.summaryType,
      summaries.filter((i) => !i.marker).map(labelAt),
    );
    editor.setDecorations(
      this.markerType,
      summaries.filter((i) => i.marker).map(labelAt),
    );

    editor.setDecorations(
      this.loadingType,
      loading.map((r) => ({
        range: new vscode.Range(r.start, r.start),
        renderOptions: { before: { contentText: `${spinner} summarizing…` } },
      })),
    );
  }

  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this.hideType, []);
    editor.setDecorations(this.summaryType, []);
    editor.setDecorations(this.markerType, []);
    editor.setDecorations(this.loadingType, []);
  }

  dispose(): void {
    this.hideType.dispose();
    this.summaryType.dispose();
    this.markerType.dispose();
    this.loadingType.dispose();
  }
}
