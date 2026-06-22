import type * as vscode from 'vscode';

/** A comment that has a summary and is being shown compactly. */
export interface RenderItem {
  readonly id: string;
  readonly range: vscode.Range;
  readonly summary: string;
  /** Body shown on hover: translated prose when translating, else clean original. */
  readonly body: string;
  /** Actionable marker (TODO, FIXME, …) kept visible in the label, if any. */
  readonly marker?: string;
}

/** Per-document render state, shared between the controller and the providers. */
export class DocumentStates {
  private readonly byUri = new Map<string, RenderItem[]>();

  get(uri: string): RenderItem[] {
    return this.byUri.get(uri) ?? [];
  }

  set(uri: string, items: RenderItem[]): void {
    this.byUri.set(uri, items);
  }

  delete(uri: string): void {
    this.byUri.delete(uri);
  }

  clear(): void {
    this.byUri.clear();
  }
}
