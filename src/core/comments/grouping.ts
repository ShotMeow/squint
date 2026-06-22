/** Minimal shape of a tree-sitter comment node we depend on. */
export interface CommentNodeLike {
  readonly type: string;
  readonly text: string;
  readonly startPosition: { readonly row: number; readonly column: number };
  readonly endPosition: { readonly row: number; readonly column: number };
  /** True when only whitespace precedes the comment on its first line. */
  readonly standalone: boolean;
}

/** A comment block: either one block comment or a run of adjacent line comments. */
export interface RawComment {
  /** 0-based inclusive line of the first character. */
  readonly startLine: number;
  /** 0-based inclusive line of the last character. */
  readonly endLine: number;
  readonly startChar: number;
  readonly endChar: number;
  /** Reconstructed original text of the block. */
  readonly text: string;
  readonly lineCount: number;
  readonly charCount: number;
}

interface OpenGroup {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  texts: string[];
  /** Whether this group is a run of standalone comments (mergeable). */
  standalone: boolean;
}

function finalize(g: OpenGroup): RawComment {
  const text = g.texts.join('\n');
  return {
    startLine: g.startRow,
    endLine: g.endRow,
    startChar: g.startCol,
    endChar: g.endCol,
    text,
    lineCount: g.endRow - g.startRow + 1,
    charCount: text.length,
  };
}

/**
 * Merge directly adjacent comment nodes (consecutive lines, nothing between)
 * into single blocks. Only standalone comments merge — an inline comment after
 * code (`x = 1; // note`) is never grouped, so a merged block can never span
 * over real code. A blank line or code line also breaks the run. Input nodes
 * may be in any order; they are sorted by position.
 */
export function groupAdjacentComments(nodes: readonly CommentNodeLike[]): RawComment[] {
  const sorted = [...nodes].sort(
    (a, b) =>
      a.startPosition.row - b.startPosition.row ||
      a.startPosition.column - b.startPosition.column,
  );

  const groups: RawComment[] = [];
  let cur: OpenGroup | null = null;

  for (const n of sorted) {
    const mergeable =
      cur !== null &&
      cur.standalone &&
      n.standalone &&
      n.startPosition.row === cur.endRow + 1;
    if (cur && mergeable) {
      cur.endRow = n.endPosition.row;
      cur.endCol = n.endPosition.column;
      cur.texts.push(n.text);
    } else {
      if (cur) groups.push(finalize(cur));
      cur = {
        startRow: n.startPosition.row,
        startCol: n.startPosition.column,
        endRow: n.endPosition.row,
        endCol: n.endPosition.column,
        texts: [n.text],
        standalone: n.standalone,
      };
    }
  }
  if (cur) groups.push(finalize(cur));
  return groups;
}

export interface SummarizableOptions {
  readonly minLines: number;
  readonly minChars: number;
}

/** A comment is worth summarizing if it is long by lines OR by characters. */
export function isSummarizable(c: RawComment, o: SummarizableOptions): boolean {
  return c.lineCount >= o.minLines || c.charCount >= o.minChars;
}
