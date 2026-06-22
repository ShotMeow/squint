# Changelog

## 0.0.2

- Languages: added TSX/JSX, Java, C#, C, C++, PHP, Ruby (13 total).
- Translation: `squint.summaryLanguage` (~30 languages). In translate mode every
  comment — including short ones — is shown in the target language; the hover
  body and JSDoc tag descriptions are translated too. The original is shown when
  expanded.
- Markers: `TODO`, `FIXME`, etc. are kept visible and highlighted in the label
  (`TODO ⋯ summary`); configurable via `squint.markers`.
- `// squint-ignore` directive (inline or on the line above) opts a comment out.
- Clickable status bar showing the collapsed-comment count; toggle on click.
- Commands: **Squint: Expand All Comments** / **Collapse All Comments**.
- Animated inline loading spinner; the working model is remembered and tried
  first; flaky models are skipped.
- Compaction reworked to never fold or hide real code (folds only Comment-kind
  regions); inline comments are never grouped over code.

## 0.0.1 — v0 (MVP)

Initial implementation: Tree-sitter comment detection (TS, JS, Python, Go,
Rust), batched BYOK summarization via `vscode.lm`, content-hash cache, folding +
hover, Toggle / Clear Cache commands, graceful degradation without a model.
