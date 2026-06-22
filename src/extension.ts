import { join } from 'node:path';
import * as vscode from 'vscode';
import { SummaryCache } from './core/cache.js';
import { CommentParser } from './core/comments/parser.js';
import { Controller } from './vscode/controller.js';
import { LMSummarizer } from './vscode/lmSummarizer.js';
import { Logger } from './vscode/logger.js';
import { MementoStore } from './vscode/mementoStore.js';

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const grammarDir = join(context.extensionPath, 'dist', 'wasm');

  const parser = new CommentParser({
    runtimeWasmPath: join(grammarDir, 'web-tree-sitter.wasm'),
    grammarDir,
  });
  const cache = new SummaryCache(new MementoStore(context.globalState));
  const summarizer = new LMSummarizer(logger);
  const controller = new Controller(parser, summarizer, cache, logger);
  controller.start();

  context.subscriptions.push(
    controller,
    logger,
    vscode.commands.registerCommand('squint.toggle', () => controller.toggle()),
    vscode.commands.registerCommand('squint.clearCache', () => controller.clearCache()),
    vscode.commands.registerCommand('squint.expandAll', () => controller.expandAll()),
    vscode.commands.registerCommand('squint.collapseAll', () => controller.collapseAll()),
  );

  logger.info('Squint activated.');
}

export function deactivate(): void {
  // Disposables registered on context.subscriptions are cleaned up by VS Code.
}
