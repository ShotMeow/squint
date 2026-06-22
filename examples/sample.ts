/*
 * Copyright (c) 2026 Squint contributors.
 * Licensed under the MIT License. This is a long license header — exactly the
 * kind of multi-line block that adds visual noise at the top of every file and
 * that Squint collapses into a single summary line.
 */

// CASE 1 — JSDoc block comment on a function: a long /** ... */ block that gets
// summarized and folded. (This run of // lines above is itself CASE 3.)

/**
 * Validates the user's permission and available balance before charging the
 * card. This guard exists because an earlier incident double-charged a batch of
 * customers when the upstream auth service timed out and the retry path skipped
 * the permission check. Do not remove without talking to the payments team.
 *
 * @param amount - minor units to charge
 * @returns whether the charge was authorized
 */
export function charge(amount: number): boolean {
  // CASE 2 — short comment below the threshold: stays untouched.
  let attempts = 0;
  attempts += 1;

  // CASE 4 — a single but very long line comment that crosses the character threshold even though it is only one line; Squint summarizes it because it exceeds ~200 characters of dense explanation that clutters the reader's view.
  return amount > 0 && attempts > 0;
}

// CASE 3 — a run of several adjacent single-line comments. Squint groups these
// consecutive // lines into one foldable region and shows a single summary on
// the header line, so the surrounding code reads cleanly while the full detail
// stays available on hover or by expanding the block.
export const VERSION = '0.0.1';

export function retry(): void {
  const max = 3; // CASE 5 — trailing inline comment: short, left untouched.
  void max;
}

/* CASE 6 — a short two-line block comment that is below the threshold,
   so Squint leaves it as-is. */
export const ENABLED = true;
