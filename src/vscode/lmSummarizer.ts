import * as vscode from 'vscode';
import { buildSummaryPrompt } from '../core/summarize/prompt.js';
import { parseSummaryResponse } from '../core/summarize/parse.js';
import {
  NoModelError,
  type CancellationLike,
  type SummarizeItem,
  type Summarizer,
  type SummaryEntry,
} from '../core/summarize/types.js';
import type { Logger } from './logger.js';

/** How many models to try before giving up (some BYOK models stream nothing). */
const MAX_MODEL_ATTEMPTS = 4;

/** Summarizer backed by the user's BYOK model via `vscode.lm`. */
export class LMSummarizer implements Summarizer {
  /** Last model that actually produced output — tried first next time. */
  private lastGoodModelId: string | undefined;

  constructor(private readonly logger: Logger) {}

  private order<T extends { id: string }>(models: readonly T[]): T[] {
    if (!this.lastGoodModelId) return [...models];
    const preferred = models.filter((m) => m.id === this.lastGoodModelId);
    const rest = models.filter((m) => m.id !== this.lastGoodModelId);
    return [...preferred, ...rest];
  }

  async summarize(
    items: readonly SummarizeItem[],
    maxLength: number,
    language: string,
    token: CancellationLike,
  ): Promise<Map<string, SummaryEntry>> {
    if (items.length === 0) return new Map();

    const models = await vscode.lm.selectChatModels();
    this.logger.info(`selectChatModels returned ${models?.length ?? 0} model(s)`);
    if (!models || models.length === 0) {
      throw new NoModelError();
    }

    const { system, user } = buildSummaryPrompt(items, maxLength, language);
    const messages = [vscode.LanguageModelChatMessage.User(`${system}\n\n${user}`)];
    const ids = new Set(items.map((i) => i.id));

    // Some BYOK models return an empty stream; fall through to the next one
    // until one actually produces summaries. The last good model is tried first.
    const ordered = this.order(models);
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
        const parsed = parseSummaryResponse(text, ids, maxLength);
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
  }
}
