import * as vscode from 'vscode';

/** Thin wrapper over a dedicated output channel. */
export class Logger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel('Squint');

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : err ? String(err) : '';
    this.channel.appendLine(`[error] ${message}${detail ? ` — ${detail}` : ''}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
