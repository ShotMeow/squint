# Changelog

## 0.2.0

- `squint.model` — pick the language model by id/family/name substring
  (e.g. `gpt-5 mini`, `haiku`); empty = auto-pick. Available model names are
  logged to the Squint output channel.
- `squint.translateBody` (default off) — full-body translation for the hover is
  now opt-in. By default only the one-line summary is translated, which is much
  faster; the hover shows the original body. Turn on for a fully translated hover.

## 0.1.0

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
