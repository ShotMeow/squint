import * as vscode from 'vscode';

/**
 * Exposes detected comment blocks as foldable comment ranges, so the fold
 * command targets the comment region itself rather than the enclosing block.
 */
export class SquintFoldingProvider implements vscode.FoldingRangeProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this.emitter.event;
  /** Resolvers waiting for the next provide call, per document uri. */
  private readonly waiters = new Map<string, Array<() => void>>();

  constructor(
    private readonly rangesFor: (uri: string) => vscode.FoldingRange[],
    private readonly isActive: () => boolean,
  ) {}

  /** Ask VS Code to re-query folding ranges. */
  refresh(): void {
    this.emitter.fire();
  }

  /** Resolves once VS Code next queries folding ranges for `uri` (or times out). */
  whenProvided(uri: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const list = this.waiters.get(uri) ?? [];
      list.push(resolve);
      this.waiters.set(uri, list);
      setTimeout(resolve, timeoutMs);
    });
  }

  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const uri = document.uri.toString();
    const ranges = this.isActive() ? this.rangesFor(uri) : [];
    const waiting = this.waiters.get(uri);
    if (waiting) {
      this.waiters.delete(uri);
      for (const resolve of waiting) resolve();
    }
    return ranges;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
