import type { SummarizeItem } from './types.js';

export interface BuiltPrompt {
  readonly system: string;
  readonly user: string;
}

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  cs: 'Czech',
  sk: 'Slovak',
  ro: 'Romanian',
  hu: 'Hungarian',
  el: 'Greek',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  tr: 'Turkish',
  zh: 'Chinese',
  'zh-tw': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  hi: 'Hindi',
  ar: 'Arabic',
  he: 'Hebrew',
  fa: 'Persian',
};

function languageName(language: string): string {
  return LANGUAGE_NAMES[language.toLowerCase()] ?? language;
}

function languageClause(language: string): string {
  if (language === 'auto') {
    return 'Write each summary in the same natural language as the original comment.';
  }
  return `Write all output in ${languageName(language)}, regardless of the comment's original language.`;
}

/**
 * Build the batch summarization prompt. The model returns a JSON array. With
 * `language === 'auto'` each element is `{ id, summary }` in the comment's own
 * language; with a language code each element also carries `body` — the full
 * comment translated into that language.
 */
export function buildSummaryPrompt(
  items: readonly SummarizeItem[],
  maxLength: number,
  language: string,
): BuiltPrompt {
  const translate = language !== 'auto';

  const system = [
    'You are a code-comment summarizer.',
    'For each comment you receive, produce a single short line capturing its essential meaning.',
    `Each summary must be at most ${maxLength} characters, on one line, with no surrounding quotes.`,
    'Use plain, simple wording that a non-expert reader understands; avoid jargon and convoluted phrasing.',
    languageClause(language),
    'Do not summarize the code, only the comment text itself.',
    'Respond with ONLY a JSON array; no prose, no markdown code fences.',
  ].join(' ');

  const shape = translate
    ? `each element is exactly {"id": string, "summary": string, "body": string}, where "body" is the full comment translated into ${languageName(language)} without comment markers (no /*, *, //). If the comment uses JSDoc tags (lines like @param, @returns, @throws), keep each such line starting with the same @tag and parameter name and translate only its description text`
    : 'each element is exactly {"id": string, "summary": string}';

  const payload = items.map((i) => ({ id: i.id, comment: i.text }));
  const user = [
    `Summarize the following ${items.length} code comment(s).`,
    `Respond with a JSON array where ${shape}.`,
    'Reuse the provided ids; include every id.',
    '',
    'Comments:',
    JSON.stringify(payload),
  ].join('\n');

  return { system, user };
}
