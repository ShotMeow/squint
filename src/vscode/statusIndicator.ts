import * as vscode from 'vscode';

/** Braille spinner frames for the inline loading animation. */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/**
 * Status-bar item plus the loading spinner. Tracks in-flight summarization and
 * drives the inline spinner animation via the `onTick` callback.
 */
export class StatusIndicator implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private inflight = 0;
  private frameIndex = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly onTick: () => void) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'squint.toggle';
  }

  get loading(): boolean {
    return this.inflight > 0;
  }

  spinner(): string {
    return SPINNER_FRAMES[this.frameIndex];
  }

  begin(): void {
    this.inflight += 1;
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
        this.onTick();
      }, 100);
    }
  }

  end(): void {
    this.inflight = Math.max(0, this.inflight - 1);
    if (this.inflight === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Refresh the status-bar text for the active editor's state. */
  render(disabled: boolean, count: number): void {
    if (disabled) {
      this.item.text = '$(eye-closed) Squint: off';
      this.item.tooltip = 'Click to enable Squint';
      this.item.show();
      return;
    }
    if (this.loading) {
      this.item.text = '$(sync~spin) Squint';
      this.item.tooltip = 'Squint: summarizing…';
      this.item.show();
      return;
    }
    if (count === 0) {
      this.item.hide();
      return;
    }
    this.item.text = `$(eye-closed) Squint · ${count}`;
    this.item.tooltip = `${count} comment(s) collapsed — click to toggle Squint`;
    this.item.show();
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.item.dispose();
  }
}
