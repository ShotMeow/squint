/** A single JSDoc tag, e.g. `@param amount minor units`. */
export interface JsDocTag {
  readonly tag: string;
  readonly name?: string;
  readonly text: string;
}

export interface JsDoc {
  /** Free description before the first tag. */
  readonly description: string;
  readonly tags: readonly JsDocTag[];
}

/** Tags whose first token is a parameter/property name rather than description. */
const NAMED_TAGS = new Set(['param', 'arg', 'argument', 'property', 'prop', 'typedef']);

/**
 * Parse JSDoc-ish structure out of a comment's raw text. Returns the leading
 * description plus any `@tag` lines. Non-JSDoc comments yield an empty `tags`
 * array (and the joined text as the description).
 */
export function parseJsDoc(text: string): JsDoc {
  const body = text.replace(/^\s*\/\*+/, '').replace(/\*+\/\s*$/, '');
  const lines = body
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*\*+\s?/, '')
        .replace(/^\s*\/\/+\s?/, '')
        .replace(/^\s*#+\s?/, '')
        .trimEnd(),
    );

  const descLines: string[] = [];
  const tags: JsDocTag[] = [];
  let current: { tag: string; name?: string; text: string } | undefined;

  for (const line of lines) {
    const match = line.match(/^\s*@(\w+)\s*(.*)$/);
    if (match) {
      if (current) tags.push(current);
      const tag = match[1];
      let rest = match[2].trim();
      let name: string | undefined;
      if (NAMED_TAGS.has(tag)) {
        const parts = rest.split(/\s+/);
        name = parts.shift() ?? undefined;
        rest = parts.join(' ').replace(/^-\s*/, '');
      }
      current = name === undefined ? { tag, text: rest } : { tag, name, text: rest };
    } else if (current) {
      current = { ...current, text: `${current.text} ${line.trim()}`.trim() };
    } else if (line.trim()) {
      descLines.push(line.trim());
    }
  }
  if (current) tags.push(current);

  return { description: descLines.join(' ').replace(/\s+/g, ' ').trim(), tags };
}
