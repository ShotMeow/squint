import * as vscode from 'vscode';
import { Semaphore } from '../core/semaphore.js';
import { buildSummaryPrompt } from '../core/summarize/prompt.js';
import { parseSummaryResponse } from '../core/summarize/parse.js';
import {
  NoModelError,
  type CancellationLike,
  type SummarizeItem,
  type SummarizeOptions,
  type Summarizer,
  type SummaryEntry,
} from '../core/summarize/types.js';
import type { Logger } from './logger.js';

/** How many models to try before giving up (some BYOK models stream nothing). */
const MAX_MODEL_ATTEMPTS = 4;
/** Max concurrent model requests across the whole extension. */
const MAX_CONCURRENT_REQUESTS = 2;

/** Summarizer backed by the user's BYOK model via `vscode.lm`. */
export class LMSummarizer implements Summarizer {
  /** Last model that actually produced output — tried first next time. */
  private lastGoodModelId: string | undefined;
  /** Signature of the last logged model list, to avoid logging it every request. */
  private lastModelsSignature = '';
  /** Caps concurrent requests so many open files don't storm the model. */
  private readonly limiter = new Semaphore(MAX_CONCURRENT_REQUESTS);

  constructor(private readonly logger: Logger) {}

  /**
   * Order models. User preference first; then the last good model; real models
   * before aggregator/router models ("…-picker", "router", "Auto"), which proxy
   * to other models and add latency.
   */
  private order(models: readonly vscode.LanguageModelChat[], preferred: string): vscode.LanguageModelChat[] {
    const query = preferred.trim().toLowerCase();
    const hay = (m: vscode.LanguageModelChat): string => `${m.id} ${m.family} ${m.name}`.toLowerCase();
    const matchesPreferred = (m: vscode.LanguageModelChat): boolean =>
      query.length > 0 && hay(m).includes(query);
    const isAggregator = (m: vscode.LanguageModelChat): boolean => /picker|router|\bauto\b/.test(hay(m));
    const score = (m: vscode.LanguageModelChat): number => {
      if (matchesPreferred(m)) return 0;
      if (isAggregator(m)) return 3; // routers add latency → try last
      if (m.id === this.lastGoodModelId) return 1;
      return 2;
    };
    return [...models].sort((a, b) => score(a) - score(b));
  }

  async summarize(
    items: readonly SummarizeItem[],
    options: SummarizeOptions,
    token: CancellationLike,
  ): Promise<Map<string, SummaryEntry>> {
    if (items.length === 0) return new Map();

    const models = await vscode.lm.selectChatModels();
    if (!models || models.length === 0) {
      throw new NoModelError();
    }
    // Log the model list only when it changes, not on every chunk request.
    const signature = models.map((m) => `${m.name} [${m.family}]`).join(', ');
    if (signature !== this.lastModelsSignature) {
      this.lastModelsSignature = signature;
      this.logger.info(`Available models: ${signature}`);
    }

    const { system, user } = buildSummaryPrompt(
      items,
      options.maxLength,
      options.language,
      options.translateBody,
    );
    const messages = [vscode.LanguageModelChatMessage.User(`${system}\n\n${user}`)];
    const ids = new Set(items.map((i) => i.id));

    // Some BYOK models return an empty stream; fall through to the next one
    // until one produces summaries. Preferred/last-good models are tried first.
    const ordered = this.order(models, options.preferredModel);

    // Gate the actual requests through the shared limiter (caps concurrency).
    return this.limiter.run(async () => {
      const attempts = Math.min(ordered.length, MAX_MODEL_ATTEMPTS);
      for (let i = 0; i < attempts; i++) {
        if (token.isCancellationRequested) return new Map();
        const model = ordered[i];
        this.logger.info(
          `Attempt ${i + 1}/${attempts}: ${model.vendor}/${model.family} (${model.id}) for ${items.length} item(s)`,
        );
        try {
          const response = await model.sendRequest(messages, {}, token as vscode.CancellationToken);
          let text = '';
          for await (const chunk of response.text) {
            text += chunk;
          }
          const parsed = parseSummaryResponse(text, ids, options.maxLength);
          this.logger.info(`  → ${text.length} chars, parsed ${parsed.size} summaries`);
          if (parsed.size > 0) {
            this.lastGoodModelId = model.id;
            return parsed;
          }
        } catch (err) {
          if (token.isCancellationRequested) return new Map();
          if (err instanceof vscode.LanguageModelError) {
            this.logger.error(`  model ${model.id} failed`, err);
          } else {
            this.logger.error(`  model ${model.id} unexpected error`, err);
          }
        }
      }
      this.logger.info('No model produced summaries.');
      return new Map();
    });
  }
}
