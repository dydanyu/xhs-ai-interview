import { describe, it, expect } from "vitest";
import { buildAnswerPrompt } from "../src/answerer/prompt.js";
import type { XhsNote } from "../src/types.js";

const notes: XhsNote[] = [
  {
    noteId: "a",
    title: "Agent 面经",
    content: "1. 什么是 ReAct?\n2. 解释 function calling。",
    url: "https://xhs/a",
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered: false,
  },
];

describe("buildAnswerPrompt", () => {
  it("includes profile, guide dir, note content and instructions", () => {
    const p = buildAnswerPrompt({
      notes,
      guideDir: "docs/复习指南",
      profile: "资深前端转 Agent",
    });
    expect(p).toContain("资深前端转 Agent");
    expect(p).toContain("docs/复习指南");
    expect(p).toContain("什么是 ReAct?");
    expect(p).toContain("去重");
    expect(p).toContain("index.md");
  });

  it("embeds every note's id for traceability", () => {
    const p = buildAnswerPrompt({
      notes,
      guideDir: "docs/复习指南",
      profile: "x",
    });
    expect(p).toContain("noteId:a");
  });
});
