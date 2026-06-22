import * as vscode from 'vscode';
import { parseJsDoc } from '../core/comments/jsdoc.js';
import type { DocumentStates } from './state.js';

/** Reveals the full original comment text in a hover tooltip. */
export class SquintHoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly states: DocumentStates,
    private readonly isActive: () => boolean,
  ) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    if (!this.isActive()) return undefined;
    const item = this.states
      .get(document.uri.toString())
      .find((i) => i.range.contains(position));
    if (!item) return undefined;

    // The body is in the configured language (translation when translating, the
    // clean original otherwise). Split into description + JSDoc tags so tags get
    // an emphasized, structured layout. The untouched source is shown on expand.
    const doc = parseJsDoc(item.body);
    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;
    const heading = item.marker ? `$(comment) **${item.marker}** ${item.summary}` : `$(comment) **${item.summary}**`;
    md.appendMarkdown(heading);
    md.appendMarkdown('\n\n---\n\n');
    if (doc.description) md.appendText(doc.description);
    if (doc.tags.length > 0) {
      md.appendMarkdown('\n\n');
      for (const t of doc.tags) {
        const name = t.name ? ` \`${t.name}\`` : '';
        const desc = t.text ? ` — ${t.text}` : '';
        md.appendMarkdown(`\n**@${t.tag}**${name}${desc}  `);
      }
    }
    return new vscode.Hover(md, item.range);
  }
}
