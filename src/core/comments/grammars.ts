/** Describes how to load and read comments for one language grammar. */
export interface GrammarDescriptor {
  /** Wasm filename within the grammar directory. */
  readonly wasmFile: string;
  /** Tree-sitter node type names that represent comments in this grammar. */
  readonly commentTypes: readonly string[];
}

/**
 * VS Code languageId -> grammar descriptor. v0 ships five languages. Most
 * grammars expose a single `comment` node type; Rust splits line/block.
 */
export const GRAMMARS: Readonly<Record<string, GrammarDescriptor>> = {
  typescript: { wasmFile: 'tree-sitter-typescript.wasm', commentTypes: ['comment'] },
  typescriptreact: { wasmFile: 'tree-sitter-tsx.wasm', commentTypes: ['comment'] },
  javascript: { wasmFile: 'tree-sitter-javascript.wasm', commentTypes: ['comment'] },
  javascriptreact: { wasmFile: 'tree-sitter-javascript.wasm', commentTypes: ['comment'] },
  python: { wasmFile: 'tree-sitter-python.wasm', commentTypes: ['comment'] },
  go: { wasmFile: 'tree-sitter-go.wasm', commentTypes: ['comment'] },
  rust: { wasmFile: 'tree-sitter-rust.wasm', commentTypes: ['line_comment', 'block_comment'] },
  java: { wasmFile: 'tree-sitter-java.wasm', commentTypes: ['line_comment', 'block_comment'] },
  csharp: { wasmFile: 'tree-sitter-c_sharp.wasm', commentTypes: ['comment'] },
  c: { wasmFile: 'tree-sitter-c.wasm', commentTypes: ['comment'] },
  cpp: { wasmFile: 'tree-sitter-cpp.wasm', commentTypes: ['comment'] },
  php: { wasmFile: 'tree-sitter-php.wasm', commentTypes: ['comment'] },
  ruby: { wasmFile: 'tree-sitter-ruby.wasm', commentTypes: ['comment'] },
};

export function isSupportedLanguage(languageId: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRAMMARS, languageId);
}

export function supportedLanguages(): string[] {
  return Object.keys(GRAMMARS);
}
