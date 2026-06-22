import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Language, Parser } from 'web-tree-sitter';
import { contentHash } from '../hash.js';
import { GRAMMARS } from './grammars.js';
import { groupAdjacentComments, type RawComment } from './grouping.js';

export interface ParserOptions {
  /** Absolute path to the web-tree-sitter runtime wasm. */
  readonly runtimeWasmPath: string;
  /** Directory containing the grammar wasm files. */
  readonly grammarDir: string;
}

/** A detected comment block enriched with a stable id and a content hash. */
export interface DetectedComment extends RawComment {
  /** Stable within a single document (position-based). */
  readonly id: string;
  /** Content hash, used as the cache key. */
  readonly hash: string;
}

/**
 * Extracts comment blocks via Tree-sitter. The runtime is initialised once and
 * grammars are loaded lazily per language and cached (including negative
 * results, so a missing grammar is not retried on every keystroke).
 */
export class CommentParser {
  private initPromise: Promise<void> | undefined;
  private readonly languages = new Map<string, Language | null>();

  constructor(private readonly options: ParserOptions) {}

  private async ensureInit(): Promise<void> {
    if (!this.initPromise) {
      // Pass the runtime wasm as bytes rather than a path: once bundled, the
      // emscripten glue cannot reliably locate the file itself.
      this.initPromise = readFile(this.options.runtimeWasmPath).then((wasmBinary) =>
        Parser.init({ wasmBinary }),
      );
    }
    return this.initPromise;
  }

  private async loadLanguage(languageId: string): Promise<Language | null> {
    const descriptor = GRAMMARS[languageId];
    if (!descriptor) return null;
    const cached = this.languages.get(languageId);
    if (cached !== undefined) return cached;
    try {
      const bytes = await readFile(join(this.options.grammarDir, descriptor.wasmFile));
      const lang = await Language.load(bytes);
      this.languages.set(languageId, lang);
      return lang;
    } catch {
      this.languages.set(languageId, null);
      return null;
    }
  }

  /** Parse `text` and return grouped comment blocks. Returns [] if unsupported. */
  async parse(languageId: string, text: string): Promise<DetectedComment[]> {
    await this.ensureInit();
    const lang = await this.loadLanguage(languageId);
    if (!lang) return [];
    const descriptor = GRAMMARS[languageId];
    if (!descriptor) return [];

    const parser = new Parser();
    try {
      parser.setLanguage(lang);
      const tree = parser.parse(text);
      if (!tree) return [];
      try {
        const lines = text.split('\n');
        const nodes = tree.rootNode.descendantsOfType([...descriptor.commentTypes]);
        const raw = groupAdjacentComments(
          nodes.map((n) => {
            const lineText = lines[n.startPosition.row] ?? '';
            const standalone = lineText.slice(0, n.startPosition.column).trim() === '';
            return {
              type: n.type,
              text: n.text,
              startPosition: n.startPosition,
              endPosition: n.endPosition,
              standalone,
            };
          }),
        );
        return raw.map((c) => ({ ...c, id: `${c.startLine}:${c.startChar}`, hash: contentHash(c.text) }));
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  }
}
