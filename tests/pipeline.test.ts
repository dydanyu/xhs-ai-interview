import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDaily } from "../src/pipeline/run.js";
import { loadNotes } from "../src/store/notesStore.js";
import type { XhsNote, AnswerInput, Answerer } from "../src/types.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pipe-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function note(id: string): XhsNote {
  return {
    noteId: id,
    title: `t-${id}`,
    content: `q-${id}`,
    url: `https://xhs/${id}`,
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered: false,
  };
}

describe("runDaily", () => {
  it("crawls, persists, answers unanswered, then marks answered", async () => {
    const answered: string[][] = [];
    const fakeAnswerer: Answerer = {
      async answer(input: AnswerInput) {
        answered.push(input.notes.map((n) => n.noteId));
      },
    };
    const paths = {
      notes: join(dir, "notes.jsonl"),
      bankDir: join(dir, "题库"),
      guideDir: join(dir, "复习指南"),
    };
    const result = await runDaily({
      crawlFn: async () => [note("a"), note("b")],
      answerer: fakeAnswerer,
      paths,
      profile: "p",
      date: "2026-06-09",
    });
    expect(result).toEqual({ added: 2, skipped: 0, answeredCount: 2 });
    expect(answered).toEqual([["a", "b"]]);
    expect(loadNotes(paths.notes).every((n) => n.answered)).toBe(true);
    expect(existsSync(join(paths.bankDir, "2026-06-09.md"))).toBe(true);
  });

  it("does not re-answer already answered notes on second run", async () => {
    const answered: string[][] = [];
    const fakeAnswerer: Answerer = {
      async answer(input: AnswerInput) {
        answered.push(input.notes.map((n) => n.noteId));
      },
    };
    const paths = {
      notes: join(dir, "notes.jsonl"),
      bankDir: join(dir, "题库"),
      guideDir: join(dir, "复习指南"),
    };
    const opts = {
      crawlFn: async () => [note("a")],
      answerer: fakeAnswerer,
      paths,
      profile: "p",
      date: "2026-06-09",
    };
    await runDaily(opts);
    const second = await runDaily(opts);
    expect(second.added).toBe(0);
    expect(second.answeredCount).toBe(0);
    expect(answered).toEqual([["a"]]);
  });
});
