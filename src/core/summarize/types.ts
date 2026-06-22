/** One comment to summarize. */
export interface SummarizeItem {
  readonly id: string;
  readonly text: string;
}

/** Structural subset of vscode.CancellationToken, keeping core vscode-free. */
export interface CancellationLike {
  readonly isCancellationRequested: boolean;
}

/** Result for one comment. */
export interface SummaryEntry {
  /** One-line summary in the target language. */
  readonly summary: string;
  /** Full comment translated into the target language; absent when not translating. */
  readonly body?: string;
}

export interface SummarizeOptions {
  readonly maxLength: number;
  /** "auto" or a target language code for the summary. */
  readonly language: string;
  /** Also translate the full body (slower); only relevant when translating. */
  readonly translateBody: boolean;
  /** Preferred model id/family/name substring; empty = auto. */
  readonly preferredModel: string;
}

/** Abstraction over the LLM. The vscode layer implements this with vscode.lm. */
export interface Summarizer {
  /**
   * Summarize a batch. Returns a map of id -> {summary, body?}. Missing ids mean
   * the model omitted them and the caller should keep the original.
   * Implementations throw {@link NoModelError} when no BYOK provider exists.
   */
  summarize(
    items: readonly SummarizeItem[],
    options: SummarizeOptions,
    token: CancellationLike,
  ): Promise<Map<string, SummaryEntry>>;
}

/** Thrown when no language model is available (no BYOK provider configured). */
export class NoModelError extends Error {
  constructor(message = 'No language model is configured.') {
    super(message);
    this.name = 'NoModelError';
  }
}
