import type { Answerer, XhsNote } from "../types.js";
import { appendNotes, getUnanswered, markAnswered } from "../store/notesStore.js";
import { writeDailyBank } from "../docs/questionBank.js";
import { regenerateIndex } from "../docs/reviewGuide.js";
import { looksLikeAd } from "../crawler/adFilter.js";

export interface PipelinePaths {
  notes: string;
  bankDir: string;
  guideDir: string;
}

export interface RunOptions {
  crawlFn: () => Promise<XhsNote[]>;
  answerer: Answerer;
  paths: PipelinePaths;
  profile: string;
  date: string;
}

export interface RunResult {
  added: number;
  skipped: number;
  answeredCount: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runCrawl(
  opts: Pick<RunOptions, "crawlFn" | "paths" | "date">
): Promise<{ added: number; skipped: number }> {
  const notes = (await opts.crawlFn()).map((n) => ({ ...n, isAd: looksLikeAd(n) }));
  const { added, skipped } = appendNotes(opts.paths.notes, notes);
  const realNotes = notes.filter((n) => !n.isAd);
  writeDailyBank(opts.paths.bankDir, opts.date ?? today(), realNotes);
  return { added, skipped };
}

export async function runAnswer(
  opts: Pick<RunOptions, "answerer" | "paths" | "profile">
): Promise<{ answeredCount: number }> {
  const unanswered = getUnanswered(opts.paths.notes);
  const ads = unanswered.filter((n) => n.isAd);
  const real = unanswered.filter((n) => !n.isAd);
  // 广告贴直接标记为已处理,既不送作答也不再重复检查
  if (ads.length > 0) markAnswered(opts.paths.notes, ads.map((n) => n.noteId));
  if (real.length === 0) return { answeredCount: 0 };
  await opts.answerer.answer({
    notes: real,
    guideDir: opts.paths.guideDir,
    profile: opts.profile,
  });
  markAnswered(opts.paths.notes, real.map((n) => n.noteId));
  regenerateIndex(opts.paths.guideDir);
  return { answeredCount: real.length };
}

export async function runDaily(opts: RunOptions): Promise<RunResult> {
  const { added, skipped } = await runCrawl(opts);
  const { answeredCount } = await runAnswer(opts);
  return { added, skipped, answeredCount };
}
