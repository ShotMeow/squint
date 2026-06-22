import * as vscode from 'vscode';
import { DEFAULT_MARKERS } from '../core/comments/markers.js';

export type DisplayMode = 'fold' | 'hover' | 'both';

export interface SquintSettings {
  readonly enabled: boolean;
  readonly languages: readonly string[];
  readonly minCommentLines: number;
  readonly minCommentChars: number;
  readonly displayMode: DisplayMode;
  readonly summaryMaxLength: number;
  /** "auto" = comment's own language; otherwise a language code (e.g. "ru"). */
  readonly summaryLanguage: string;
  /** Preferred model (matched against id/family/name); empty = auto-pick. */
  readonly model: string;
  /** When translating, also translate the full comment body for the hover (slower). */
  readonly translateBody: boolean;
  /** Max comments per model request. */
  readonly batchSize: number;
  /** Actionable markers kept visible in the label (TODO, FIXME, …). */
  readonly markers: readonly string[];
  readonly debounceMs: number;
}

const SECTION = 'squint';

export function readSettings(): SquintSettings {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: c.get<boolean>('enabled', true),
    languages: c.get<string[]>('languages', ['typescript', 'javascript', 'python', 'go', 'rust']),
    minCommentLines: c.get<number>('minCommentLines', 3),
    minCommentChars: c.get<number>('minCommentChars', 200),
    displayMode: c.get<DisplayMode>('displayMode', 'both'),
    summaryMaxLength: c.get<number>('summaryMaxLength', 100),
    summaryLanguage: c.get<string>('summaryLanguage', 'auto'),
    model: c.get<string>('model', ''),
    translateBody: c.get<boolean>('translateBody', false),
    batchSize: c.get<number>('batchSize', 20),
    markers: c.get<string[]>('markers', [...DEFAULT_MARKERS]),
    debounceMs: c.get<number>('debounceMs', 400),
  };
}

/** Fire `listener` whenever any `squint.*` setting changes. */
export function onSettingsChanged(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(SECTION)) listener();
  });
}
