import type * as vscode from 'vscode';
import type { KeyValueStore } from '../core/cache.js';

/** Adapts a VS Code Memento to the cache's KeyValueStore contract. */
export class MementoStore implements KeyValueStore {
  constructor(private readonly memento: vscode.Memento) {}

  get(key: string): string | undefined {
    return this.memento.get<string>(key);
  }

  set(key: string, value: string): Thenable<void> {
    return this.memento.update(key, value);
  }

  delete(key: string): Thenable<void> {
    return this.memento.update(key, undefined);
  }

  keys(): readonly string[] {
    return this.memento.keys();
  }
}
