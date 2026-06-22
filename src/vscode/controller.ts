import * as vscode from 'vscode';
import { SummaryCache } from '../core/cache.js';
import { isSupportedLanguage, supportedLanguages } from '../core/comments/grammars.js';
import { isSummarizable } from '../core/comments/grouping.js';
import { detectMarker, stripLeadingMarker } from '../core/comments/markers.js';
import type { CommentParser, DetectedComment } from '../core/comments/parser.js';
import {
  NoModelError,
  type SummarizeItem,
  type Summarizer,
  type SummaryEntry,
} from '../core/summarize/types.js';
import { onSettingsChanged, readSettings, type SquintSettings } from './config.js';
import { DecorationManager } from './decorations.js';
import { cursorInside, FoldManager, type FoldHost } from './foldManager.js';
import { SquintHoverProvider } from './hoverProvider.js';
import type { Logger } from './logger.js';
import { StatusIndicator } from './statusIndicator.js';
import { DocumentStates, type RenderItem } from './state.js';

const MANAGE_MODELS_COMMAND = 'workbench.action.chat.manageLanguageModels';
const IGNORE_DIRECTIVE = /squint[-:\s]?ignore/i;

/** Orchestrates parsing, summarization, caching, and rendering. */
export class Controller implements vscode.Disposable, FoldHost {
  private settings: SquintSettings;
  private toggledOff = false;
  private noModelNotified = false;

  private readonly states = new DocumentStates();
  private readonly decorations = new DecorationManager();
  private readonly hover: SquintHoverProvider;
  private readonly status: StatusIndicator;
  private readonly folds: FoldManager;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly tokenSources = new Map<string, vscode.CancellationTokenSource>();
  private readonly pendingByUri = new Map<string, vscode.Range[]>();
  private readonly processedVersion = new Map<string, number>();

  constructor(
    private readonly parser: CommentParser,
    private readonly summarizer: Summarizer,
    private readonly cache: SummaryCache,
    private readonly logger: Logger,
  ) {
    this.settings = readSettings();
    this.hover = new SquintHoverProvider(
      this.states,
      () => this.active() && this.settings.displayMode !== 'fold',
    );
    this.status = new StatusIndicator(() => this.onSpinnerTick());
    this.folds = new FoldManager(this, this.logger);
  }

  // --- FoldHost ---
  getItems(uri: string): readonly RenderItem[] {
    return this.states.get(uri);
  }
  isActive(): boolean {
    return this.settings.enabled && !this.toggledOff;
  }
  isHandled(document: vscode.TextDocument): boolean {
    return (
      this.settings.languages.includes(document.languageId) &&
      isSupportedLanguage(document.languageId)
    );
  }
  compactEnabled(): boolean {
    return this.settings.displayMode !== 'hover';
  }
  rerender(editor: vscode.TextEditor): void {
    this.applyEditorDecorations(editor);
  }

  start(): void {
    const selector = supportedLanguages().map((language) => ({ language, scheme: 'file' }));
    this.disposables.push(
      vscode.languages.registerFoldingRangeProvider(selector, this.folds.provider),
      vscode.languages.registerHoverProvider(selector, this.hover),
      this.folds.provider,
      this.decorations,
      this.status,
      onSettingsChanged(() => this.onSettingsChanged()),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.updateStatus();
        if (editor) void this.refreshEditor(editor);
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAllVisible()),
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e.document)),
      vscode.workspace.onDidCloseTextDocument((doc) => this.onDocumentClosed(doc)),
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => this.applyEditorDecorations(e.textEditor)),
      vscode.window.onDidChangeTextEditorSelection((e) => this.folds.handleSelection(e.textEditor)),
    );
    this.refreshAllVisible();
  }

  private active(): boolean {
    return this.isActive();
  }

  private editorsForUri(uri: string): vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter((e) => e.document.uri.toString() === uri);
  }

  private refreshAllVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      void this.refreshEditor(editor);
    }
  }

  private async refreshEditor(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const uri = document.uri.toString();

    if (!this.active() || !this.isHandled(document)) {
      this.clearDocument(uri);
      return;
    }

    // Same content as last processed: just re-fold / re-apply, no re-parse.
    if (this.processedVersion.get(uri) === document.version) {
      void this.folds.foldComments(editor);
      this.applyEditorDecorations(editor);
      return;
    }
    this.processedVersion.set(uri, document.version);

    this.tokenSources.get(uri)?.cancel();
    const cts = new vscode.CancellationTokenSource();
    this.tokenSources.set(uri, cts);
    const token = cts.token;

    // Translate mode processes every comment; the threshold only gates the
    // "auto" summarize-only mode.
    const translating = this.settings.summaryLanguage !== 'auto';
    let raw: DetectedComment[];
    let detected: DetectedComment[];
    try {
      raw = await this.parser.parse(document.languageId, document.getText());
      const isDirective = (c: DetectedComment): boolean => IGNORE_DIRECTIVE.test(c.text);
      const ignoredByAbove = (c: DetectedComment): boolean =>
        raw.some((d) => isDirective(d) && d.endLine + 1 === c.startLine);
      detected = raw.filter((c) => {
        if (isDirective(c) || ignoredByAbove(c)) return false;
        return (
          translating ||
          isSummarizable(c, {
            minLines: this.settings.minCommentLines,
            minChars: this.settings.minCommentChars,
          })
        );
      });
    } catch (err) {
      this.logger.error('Comment parsing failed', err);
      return;
    }
    if (token.isCancellationRequested) return;

    this.logger.info(`Parsed ${document.languageId}: ${detected.length} comment block(s)`);

    // Multi-line comments we are NOT summarizing must be unfolded back after
    // foldAllBlockComments (which would otherwise collapse them too).
    const detectedIds = new Set(detected.map((c) => c.id));
    const extraFoldLines = raw
      .filter((c) => c.endLine > c.startLine && !detectedIds.has(c.id))
      .map((c) => c.startLine);

    if (detected.length === 0) {
      this.render(uri, [], new Map(), [], extraFoldLines);
      return;
    }

    const maxLength = this.settings.summaryMaxLength;
    const language = this.settings.summaryLanguage;
    const summaries = new Map<string, SummaryEntry>();
    const misses: SummarizeItem[] = [];
    const hashById = new Map<string, string>();

    for (const c of detected) {
      hashById.set(c.id, c.hash);
      const cached = this.cache.get(c.hash, language, maxLength);
      if (cached !== undefined) {
        summaries.set(c.id, cached);
      } else {
        misses.push({ id: c.id, text: c.text });
      }
    }

    this.logger.info(`Cache: ${summaries.size} hit(s), ${misses.length} miss(es)`);

    const pending = detected.filter((c) => !summaries.has(c.id));
    this.render(uri, detected, summaries, pending, extraFoldLines);

    if (misses.length === 0) return;

    const options = {
      maxLength,
      language,
      translateBody: this.settings.translateBody,
      preferredModel: this.settings.model,
    };
    // Split into bounded chunks (one giant request is slow and can truncate the
    // model's JSON) and run them in parallel. The global limiter caps how many
    // actually hit the model at once; each chunk renders + caches as it arrives,
    // so summaries appear progressively and a failed chunk is contained.
    const batchSize = Math.max(1, this.settings.batchSize);
    const chunks: SummarizeItem[][] = [];
    for (let i = 0; i < misses.length; i += batchSize) {
      chunks.push(misses.slice(i, i + batchSize));
    }

    this.beginLoading();
    try {
      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const fresh = await this.summarizer.summarize(chunk, options, token);
            if (token.isCancellationRequested) return;
            for (const [id, entry] of fresh) {
              summaries.set(id, entry);
              const hash = hashById.get(id);
              if (hash) void this.cache.set(hash, language, maxLength, entry);
            }
            this.render(uri, detected, summaries, detected.filter((c) => !summaries.has(c.id)), extraFoldLines);
          } catch (err) {
            if (token.isCancellationRequested) return;
            if (err instanceof NoModelError) this.notifyNoModel();
            else this.logger.error('Summarization failed', err);
          }
        }),
      );
      if (token.isCancellationRequested) return;
      // Clear any leftover loading hints (omitted/failed comments show original).
      this.render(uri, detected, summaries, [], extraFoldLines);
    } finally {
      this.endLoading();
    }
  }

  private render(
    uri: string,
    detected: readonly DetectedComment[],
    summaries: ReadonlyMap<string, SummaryEntry>,
    pending: readonly DetectedComment[],
    extraFoldLines: number[],
  ): void {
    const items: RenderItem[] = [];
    for (const c of detected) {
      const entry = summaries.get(c.id);
      if (entry === undefined) continue;
      const marker = detectMarker(c.text, this.settings.markers);
      const summary = marker ? stripLeadingMarker(entry.summary, this.settings.markers) : entry.summary;
      items.push({
        id: c.id,
        summary,
        body: entry.body ?? c.text,
        range: new vscode.Range(c.startLine, c.startChar, c.endLine, c.endChar),
        ...(marker ? { marker } : {}),
      });
    }

    this.states.set(uri, items);
    this.pendingByUri.set(
      uri,
      pending.map((c) => new vscode.Range(c.startLine, c.startChar, c.endLine, c.endChar)),
    );
    this.folds.onRender(uri, detected, extraFoldLines);

    const editors = this.editorsForUri(uri);
    this.logger.info(
      `Rendering ${items.length} item(s), ${pending.length} loading, into ${editors.length} editor(s)`,
    );
    for (const editor of editors) {
      this.applyEditorDecorations(editor);
      void this.folds.foldComments(editor);
    }
    this.updateStatus();
  }

  /** A comment is compacted unless the cursor is in it; multi-line only once folded. */
  private shouldCompact(editor: vscode.TextEditor, range: vscode.Range): boolean {
    if (cursorInside(editor, range.start.line, range.end.line)) return false;
    if (range.end.line > range.start.line) return this.folds.isFolded(editor, range);
    return true;
  }

  private applyEditorDecorations(editor: vscode.TextEditor): void {
    if (!this.isHandled(editor.document)) return;
    const uri = editor.document.uri.toString();
    if (!this.active()) {
      this.decorations.clear(editor);
      return;
    }
    const items = this.states.get(uri);
    const pending = this.pendingByUri.get(uri) ?? [];
    if (items.length === 0 && pending.length === 0) return;

    const compactSummaries = items.filter((i) => this.shouldCompact(editor, i.range));
    const compactLoading = pending.filter((r) => this.shouldCompact(editor, r));
    this.decorations.apply(editor, compactSummaries, compactLoading, this.status.spinner());
  }

  private beginLoading(): void {
    this.status.begin();
    this.updateStatus();
  }

  private endLoading(): void {
    this.status.end();
    this.updateStatus();
  }

  private onSpinnerTick(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const pending = this.pendingByUri.get(editor.document.uri.toString());
      if (pending && pending.length > 0) this.applyEditorDecorations(editor);
    }
  }

  private updateStatus(): void {
    const disabled = this.toggledOff || !this.settings.enabled;
    const editor = vscode.window.activeTextEditor;
    const count =
      editor && this.isHandled(editor.document)
        ? this.states.get(editor.document.uri.toString()).length
        : 0;
    this.status.render(disabled, count);
  }

  private onDocumentChanged(document: vscode.TextDocument): void {
    if (!this.active() || !this.isHandled(document)) return;
    const uri = document.uri.toString();
    this.folds.onContentChanged(uri);

    const existing = this.debounceTimers.get(uri);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(uri);
      for (const editor of this.editorsForUri(uri)) {
        void this.refreshEditor(editor);
      }
    }, this.settings.debounceMs);
    this.debounceTimers.set(uri, timer);
  }

  private onDocumentClosed(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    this.tokenSources.get(uri)?.cancel();
    this.tokenSources.delete(uri);
    const timer = this.debounceTimers.get(uri);
    if (timer) clearTimeout(timer);
    this.debounceTimers.delete(uri);
    this.states.delete(uri);
    this.pendingByUri.delete(uri);
    this.processedVersion.delete(uri);
    this.folds.forget(uri);
  }

  private onSettingsChanged(): void {
    this.settings = readSettings();
    this.processedVersion.clear();
    this.refreshAllVisible();
    this.updateStatus();
  }

  private clearDocument(uri: string): void {
    this.states.set(uri, []);
    this.pendingByUri.delete(uri);
    this.processedVersion.delete(uri);
    this.folds.forget(uri);
    for (const editor of this.editorsForUri(uri)) {
      this.decorations.clear(editor);
    }
    this.updateStatus();
  }

  private notifyNoModel(): void {
    if (this.noModelNotified) return;
    this.noModelNotified = true;
    const action = 'Manage Language Models';
    void vscode.window
      .showInformationMessage(
        'Squint needs a language model to summarize comments. Comments are shown unchanged until one is configured.',
        action,
      )
      .then((choice) => {
        if (choice === action) {
          void vscode.commands.executeCommand(MANAGE_MODELS_COMMAND).then(undefined, () => undefined);
        }
      });
  }

  toggle(): void {
    this.toggledOff = !this.toggledOff;
    this.folds.reset();
    this.refreshAllVisible();
    this.updateStatus();
  }

  expandAll(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && this.isHandled(editor.document)) void this.folds.expandAll(editor);
  }

  collapseAll(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && this.isHandled(editor.document)) void this.folds.collapseAll(editor);
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.folds.forgetAll();
    this.pendingByUri.clear();
    this.processedVersion.clear();
    this.refreshAllVisible();
    void vscode.window.showInformationMessage('Squint: cache cleared.');
  }

  dispose(): void {
    for (const cts of this.tokenSources.values()) cts.cancel();
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.tokenSources.clear();
    this.debounceTimers.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
