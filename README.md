# Squint

**Comments, at a glance.**

Squint collapses verbose comments into a single AI-generated summary line and
reveals the full original on cursor focus or hover. The file's text is **never
modified** — the compact view is a visual layer, so `git diff` stays empty.

## How it works

1. Comment blocks are detected with Tree-sitter (AST, not regex). Adjacent
   standalone line comments are grouped into one block; inline comments after
   code are left alone.
2. Long blocks (and, in translate mode, every comment) are summarized in a
   single batched request to **your own** language model (BYOK via `vscode.lm`).
3. Summaries are cached by content hash + language in `globalState` (survives
   restart).
4. The comment is folded and the summary is shown in its place. Moving the
   cursor in reveals the original; hovering shows the full text. Folding only
   ever collapses comment regions — never functions, classes, or code.

Nothing is sent anywhere except the model you configured. No data reaches the
extension author's infrastructure. The cache is strictly local.

## Supported languages

TypeScript, TSX, JavaScript, JSX, Python, Go, Rust, Java, C#, C, C++, PHP, Ruby.

## Highlights

- **Translation** — set `squint.summaryLanguage` to a code (`ru`, `de`, `zh`, …)
  and summaries, the hover body, and JSDoc tag descriptions are shown in that
  language; the untouched original is revealed on expand.
- **Markers kept visible** — `TODO`, `FIXME`, etc. stay in the label and are
  highlighted: `TODO ⋯ rewrite auth flow`.
- **Opt-out** — `// squint-ignore` (inline or on the line above) leaves a comment
  untouched.
- **JSDoc-aware hover** — `@param` / `@returns` are rendered as a structured,
  emphasized block.

## Settings

| Key | Default | Description |
| --- | --- | --- |
| `squint.enabled` | `true` | Globally enable/disable. |
| `squint.languages` | 13 langs | Language IDs to activate for. |
| `squint.minCommentLines` | `3` | Min lines to summarize (auto mode). |
| `squint.minCommentChars` | `200` | Min characters to summarize (OR-ed with lines). |
| `squint.displayMode` | `both` | `fold` \| `hover` \| `both`. |
| `squint.summaryMaxLength` | `100` | Max characters in a summary. |
| `squint.summaryLanguage` | `auto` | `auto` (comment's language) or a code like `ru`. |
| `squint.markers` | TODO, … | Markers kept visible and highlighted in the label. |
| `squint.debounceMs` | `400` | Debounce before recompute on edits. |

Pick the model through the native **Chat: Manage Language Models** picker, not a
Squint setting.

## Commands

- **Squint: Toggle** — enable/disable for the current window (also the status-bar click).
- **Squint: Expand All Comments** / **Collapse All Comments**.
- **Squint: Clear Cache** — drop all cached summaries.

## Develop

```bash
pnpm install
pnpm build        # bundle + copy wasm into dist/
pnpm test         # unit tests (core: parser, cache, grouping, markers, jsdoc, prompt, response)
pnpm lint
pnpm typecheck
```

Press **F5** (Run Squint) to launch an Extension Development Host, then open
[examples/sample.ts](examples/sample.ts). You need a BYOK model configured to
see summaries; without one, comments render unchanged and a one-time notice
points you to the model picker.

### Architecture

Hexagonal: `src/core/` is pure and VS Code-free (parser, grouping, cache,
markers, JSDoc, prompt/response) and is what the unit tests exercise.
`src/vscode/` holds the adapters (config, logger, providers, the `vscode.lm`
summarizer, the orchestrating controller). The runtime and grammar wasm are read
as bytes and handed to web-tree-sitter directly; `web-tree-sitter` ships
un-bundled (its emscripten glue cannot be bundled reliably).

## License

MIT — see [LICENSE](LICENSE).
