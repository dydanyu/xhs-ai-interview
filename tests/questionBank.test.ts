import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeDailyBank } from "../src/docs/questionBank.js";
import type { XhsNote } from "../src/types.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bank-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const notes: XhsNote[] = [
  {
    noteId: "a",
    title: "Agent 面经",
    content: "什么是 ReAct?",
    url: "https://xhs/a",
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered: false,
  },
];

describe("writeDailyBank", () => {
  it("writes a dated markdown file and returns its path", () => {
    const path = writeDailyBank(dir, "2026-06-09", notes);
    expect(path).toBe(join(dir, "2026-06-09.md"));
    const md = readFileSync(path, "utf8");
    expect(md).toContain("# 2026-06-09 小红书 AI Agent 题库");
    expect(md).toContain("Agent 面经");
    expect(md).toContain("什么是 ReAct?");
    expect(md).toContain("https://xhs/a");
  });

  it("merges into existing file without duplicating a note", () => {
    writeDailyBank(dir, "2026-06-09", notes);
    const path = writeDailyBank(dir, "2026-06-09", notes);
    const md = readFileSync(path, "utf8");
    expect(md.match(/https:\/\/xhs\/a/g)?.length).toBe(1);
  });
});
