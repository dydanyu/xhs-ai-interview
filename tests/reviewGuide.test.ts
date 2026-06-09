import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { topicToFilename, regenerateIndex } from "../src/docs/reviewGuide.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "guide-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("topicToFilename", () => {
  it("keeps chinese topic and adds .md", () => {
    expect(topicToFilename("Agent 基础")).toBe("Agent-基础.md");
  });
  it("collapses spaces and slashes", () => {
    expect(topicToFilename("LLM / RAG")).toBe("LLM-RAG.md");
  });
});

describe("regenerateIndex", () => {
  it("lists topic files (excluding index) with links", () => {
    writeFileSync(join(dir, "Agent-基础.md"), "# Agent 基础\n");
    writeFileSync(join(dir, "前端结合.md"), "# 前端结合\n");
    const path = regenerateIndex(dir);
    expect(path).toBe(join(dir, "index.md"));
    const md = readFileSync(path, "utf8");
    expect(md).toContain("# 复习指南索引");
    expect(md).toContain("[Agent 基础](Agent-基础.md)");
    expect(md).toContain("[前端结合](前端结合.md)");
    expect(md).not.toContain("[index]");
  });
});
