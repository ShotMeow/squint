# Roadmap & design notes

The product itself is documented in [README.md](README.md); this file records
deliberate design choices and what is intentionally **not** built yet.

## Principles

- The source file is never modified — the compact view is a decoration layer, so
  `git diff` stays empty.
- BYOK only: code goes solely to the user's own model; the cache is local.
- Any LLM / parse / Tree-sitter failure falls back to showing the original.

## Deliberately out of scope

- Generating, rewriting, or deleting comments — Squint only displays.
- Summarizing code/functions/files — comments only.
- Any server side, telemetry, or bundled inference key.

## Next: signal-vs-noise classification

The most valuable unbuilt idea. AI-generated code produces two kinds of
comments: ones that **restate the code** (`// increment counter`) and ones that
carry non-obvious **"why"** (a workaround, a ticket link, a warning). Hiding the
first is pure win; hiding the second is harmful.

Plan: have the model return a `kind` (`restates` | `explains`) alongside the
summary, hide `restates` aggressively, and keep `explains` visible (or only
lightly compacted).

This is gated on quality, because it is a probabilistic judgment on top of a
probabilistic summary with an asymmetric error cost:

- Maintain a **golden-set** (30–50+ labelled real comments across languages,
  including AI-generated code) run as part of the Summarizer tests.
- Ship behind a flag unless **precision(`restates`) ≥ 0.95** (rarely hide
  something important) and **recall(`restates`) ≥ 0.60** (actually compacts
  noise rather than degenerating into "summarize everything").

## Other candidates

- Choose a specific model in settings (today the first working model is used).
- Opt-in telemetry of "expand rate" to validate that summaries are trusted.
- More languages (Kotlin, Swift) once prebuilt wasm grammars are available.
