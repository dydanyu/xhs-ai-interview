# 小红书 AI Agent 面试题工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个全自动每日流水线:用 Playwright 抓取小红书 AI Agent 面试题 → 落原始题库 → 调 `cursor-agent` 作答并按主题归类成复习指南。

**Architecture:** 两阶段流水线。阶段一(`crawler`)用持久化登录的 Playwright 搜索抓取笔记,经 `notesStore` 按 `noteId` 去重落 `data/notes.jsonl`,并生成每日题库 Markdown。阶段二(`answerer`)读取未作答笔记,通过可插拔的 `Answerer` 接口(当前实现 `cursor-agent` CLI,预留 Claude)让 LLM 提取题目、去重、以"资深前端→Agent"视角作答并写入按主题归类的复习指南。`pipeline` 负责编排,依赖以参数注入便于测试。

**Tech Stack:** Node.js 18 + TypeScript、Playwright(Chromium 持久化登录)、Vitest(测试)、`cursor-agent` CLI、系统 cron。

---

## File Structure

```
xhs-ai-interview/
  package.json              # 依赖与脚本
  tsconfig.json             # TS 配置
  vitest.config.ts          # 测试配置
  .gitignore                # 忽略 node_modules / dist / .auth / data
  README.md                 # 使用说明(安装、登录、cron)
  src/
    config.ts               # 关键词、限额、路径、回答器选择、求职画像
    types.ts                # XhsNote / AnswerInput / Answerer 等类型
    store/
      notesStore.ts         # notes.jsonl 读写、按 noteId 去重、已答标记
    docs/
      questionBank.ts       # 生成每日题库 md
      reviewGuide.ts        # 主题文件名工具 + 重建 index.md
    answerer/
      prompt.ts             # 构建作答 prompt(资深前端→Agent 视角)
      cursorAgentAnswerer.ts# 调 cursor-agent CLI 作答
    crawler/
      selectors.ts          # 小红书页面选择器(集中管理)
      xhsCrawler.ts         # Playwright 搜索抓取
    pipeline/
      run.ts                # 编排:crawl / answer / daily(依赖注入)
    index.ts                # CLI 入口:crawl | answer | daily
  scripts/
    daily.sh                # cron 入口
  tests/
    notesStore.test.ts
    questionBank.test.ts
    reviewGuide.test.ts
    prompt.test.ts
    pipeline.test.ts
```

**模块边界**:`store` 只管数据持久化与去重;`docs` 只管 Markdown 产出;`answerer` 只管"题→答案归类"(经接口解耦,可换实现);`crawler` 只管抓取;`pipeline` 只做编排,所有外部依赖(抓取函数、回答器)以参数注入,因此可在不联网、不调 LLM 的情况下单测。

---

## Task 1: 项目脚手架

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- **Step 1: 创建 `package.json`**

```json
{
  "name": "xhs-ai-interview",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "crawl": "tsx src/index.ts crawl",
    "answer": "tsx src/index.ts answer",
    "daily": "tsx src/index.ts daily",
    "login": "tsx src/index.ts login"
  },
  "dependencies": {
    "playwright": "^1.45.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- **Step 3: 创建 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- **Step 4: 创建 `.gitignore`**

```gitignore
node_modules/
dist/
.auth/
data/
*.log
.DS_Store
```

- **Step 5: 安装依赖并安装 Chromium**

Run: `npm install && npx playwright install chromium`
Expected: 依赖安装成功,Chromium 下载完成。

- **Step 6: 验证测试运行器可用**

Run: `npx vitest run`
Expected: `No test files found`(此时还没有测试),命令以 0 退出或提示无测试文件——确认 vitest 可执行。

- **Step 7: Commit**

```bash
git add AIProject/xhs-ai-interview/package.json AIProject/xhs-ai-interview/tsconfig.json AIProject/xhs-ai-interview/vitest.config.ts AIProject/xhs-ai-interview/.gitignore AIProject/xhs-ai-interview/package-lock.json
git commit -m "chore: scaffold xhs-ai-interview project"
```

---

## Task 2: 共享类型

**Files:**

- Create: `src/types.ts`
- **Step 1: 创建 `src/types.ts`**

```ts
export interface XhsNote {
  /** 小红书笔记唯一 id,用于去重 */
  noteId: string;
  title: string;
  /** 笔记正文(可能含多道面试题) */
  content: string;
  url: string;
  /** 命中该笔记的搜索关键词 */
  keyword: string;
  /** 抓取时间 ISO 字符串 */
  fetchedAt: string;
  /** 是否已被作答归类 */
  answered: boolean;
}

export interface AnswerInput {
  /** 待作答的新笔记 */
  notes: XhsNote[];
  /** 复习指南目录(主题 md 与 index 所在) */
  guideDir: string;
  /** 求职画像,注入到作答视角 */
  profile: string;
}

export interface Answerer {
  /** 提取题目、去重、作答并写入复习指南。成功 resolve,失败 reject。 */
  answer(input: AnswerInput): Promise<void>;
}
```

- **Step 2: 验证类型编译**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 无错误(0 退出)。

- **Step 3: Commit**

```bash
git add AIProject/xhs-ai-interview/src/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: notesStore(jsonl 持久化 + 去重)

**Files:**

- Create: `src/store/notesStore.ts`
- Test: `tests/notesStore.test.ts`
- **Step 1: 写失败测试 `tests/notesStore.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendNotes,
  loadNotes,
  getUnanswered,
  markAnswered,
} from "../src/store/notesStore.js";
import type { XhsNote } from "../src/types.js";

function makeNote(id: string, answered = false): XhsNote {
  return {
    noteId: id,
    title: `t-${id}`,
    content: `c-${id}`,
    url: `https://xhs/${id}`,
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered,
  };
}

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "notes-"));
  file = join(dir, "notes.jsonl");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("notesStore", () => {
  it("appends notes and dedupes by noteId", () => {
    const r1 = appendNotes(file, [makeNote("a"), makeNote("b")]);
    expect(r1).toEqual({ added: 2, skipped: 0 });
    const r2 = appendNotes(file, [makeNote("b"), makeNote("c")]);
    expect(r2).toEqual({ added: 1, skipped: 1 });
    expect(loadNotes(file).map((n) => n.noteId)).toEqual(["a", "b", "c"]);
  });

  it("loads empty array when file missing", () => {
    expect(loadNotes(file)).toEqual([]);
  });

  it("returns only unanswered notes", () => {
    appendNotes(file, [makeNote("a"), makeNote("b", true)]);
    expect(getUnanswered(file).map((n) => n.noteId)).toEqual(["a"]);
  });

  it("marks notes answered", () => {
    appendNotes(file, [makeNote("a"), makeNote("b")]);
    markAnswered(file, ["a"]);
    expect(getUnanswered(file).map((n) => n.noteId)).toEqual(["b"]);
  });
});
```

- **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/notesStore.test.ts`
Expected: FAIL —— 找不到模块 `../src/store/notesStore.js`。

- **Step 3: 实现 `src/store/notesStore.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { XhsNote } from "../types.js";

export function loadNotes(file: string): XhsNote[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as XhsNote);
}

function saveNotes(file: string, notes: XhsNote[]): void {
  mkdirSync(dirname(file), { recursive: true });
  const body = notes.map((n) => JSON.stringify(n)).join("\n");
  writeFileSync(file, body.length ? body + "\n" : "", "utf8");
}

export function appendNotes(
  file: string,
  incoming: XhsNote[]
): { added: number; skipped: number } {
  const existing = loadNotes(file);
  const seen = new Set(existing.map((n) => n.noteId));
  let added = 0;
  let skipped = 0;
  for (const note of incoming) {
    if (seen.has(note.noteId)) {
      skipped++;
      continue;
    }
    seen.add(note.noteId);
    existing.push(note);
    added++;
  }
  saveNotes(file, existing);
  return { added, skipped };
}

export function getUnanswered(file: string): XhsNote[] {
  return loadNotes(file).filter((n) => !n.answered);
}

export function markAnswered(file: string, ids: string[]): void {
  const idSet = new Set(ids);
  const notes = loadNotes(file).map((n) =>
    idSet.has(n.noteId) ? { ...n, answered: true } : n
  );
  saveNotes(file, notes);
}
```

- **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/notesStore.test.ts`
Expected: PASS(4 个用例通过)。

- **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/src/store/notesStore.ts AIProject/xhs-ai-interview/tests/notesStore.test.ts
git commit -m "feat: add notes jsonl store with dedup"
```

---

## Task 4: 每日题库 Markdown 生成

**Files:**

- Create: `src/docs/questionBank.ts`
- Test: `tests/questionBank.test.ts`
- **Step 1: 写失败测试 `tests/questionBank.test.ts`**

```ts
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
```

- **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/questionBank.test.ts`
Expected: FAIL —— 找不到模块 `questionBank.js`。

- **Step 3: 实现 `src/docs/questionBank.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { XhsNote } from "../types.js";

function noteBlock(note: XhsNote): string {
  return [
    `## ${note.title}`,
    "",
    `- 来源:${note.url}`,
    `- 关键词:${note.keyword}`,
    "",
    note.content.trim(),
    "",
    `<!-- noteId:${note.noteId} -->`,
    "",
  ].join("\n");
}

export function writeDailyBank(
  bankDir: string,
  date: string,
  notes: XhsNote[]
): string {
  mkdirSync(bankDir, { recursive: true });
  const path = join(bankDir, `${date}.md`);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const header = `# ${date} 小红书 AI Agent 题库\n\n`;
  let body = existing || header;
  for (const note of notes) {
    if (body.includes(`<!-- noteId:${note.noteId} -->`)) continue;
    body += noteBlock(note);
  }
  writeFileSync(path, body, "utf8");
  return path;
}
```

- **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/questionBank.test.ts`
Expected: PASS(2 个用例通过)。

- **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/src/docs/questionBank.ts AIProject/xhs-ai-interview/tests/questionBank.test.ts
git commit -m "feat: add daily question bank markdown writer"
```

---

## Task 5: 复习指南工具(主题文件名 + 索引重建)

**Files:**

- Create: `src/docs/reviewGuide.ts`
- Test: `tests/reviewGuide.test.ts`
- **Step 1: 写失败测试 `tests/reviewGuide.test.ts`**

```ts
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
```

- **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/reviewGuide.test.ts`
Expected: FAIL —— 找不到模块 `reviewGuide.js`。

- **Step 3: 实现 `src/docs/reviewGuide.ts`**

```ts
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function topicToFilename(topic: string): string {
  const slug = topic
    .trim()
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, "-");
  return `${slug}.md`;
}

export function regenerateIndex(guideDir: string): string {
  mkdirSync(guideDir, { recursive: true });
  const files = readdirSync(guideDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .sort();
  const lines = ["# 复习指南索引", ""];
  for (const f of files) {
    const title = f.replace(/\.md$/, "").replace(/-/g, " ");
    lines.push(`- [${title}](${f})`);
  }
  const path = join(guideDir, "index.md");
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  return path;
}

export function guideExists(guideDir: string): boolean {
  return existsSync(guideDir);
}
```

- **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/reviewGuide.test.ts`
Expected: PASS(4 个用例通过)。

- **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/src/docs/reviewGuide.ts AIProject/xhs-ai-interview/tests/reviewGuide.test.ts
git commit -m "feat: add review guide filename + index helpers"
```

---

## Task 6: 配置

**Files:**

- Create: `src/config.ts`
- **Step 1: 创建 `src/config.ts`**

```ts
import { join } from "node:path";

const root = process.cwd();

export const config = {
  /** 搜索关键词 */
  keywords: [
    "AI Agent 面试",
    "大模型 Agent 面试题",
    "AI Agent 八股",
    "LLM Agent 面试",
  ],
  /** 每个关键词最多抓取的笔记数(风控) */
  maxNotesPerKeyword: 5,
  /** 抓取动作之间的随机延时范围(毫秒) */
  delayMsRange: [1500, 4000] as [number, number],
  /** Playwright 是否无头。首次登录请设为 false。 */
  headless: true,
  paths: {
    auth: join(root, ".auth"),
    notes: join(root, "data", "notes.jsonl"),
    bankDir: join(root, "docs", "题库"),
    guideDir: join(root, "docs", "复习指南"),
  },
  /** 回答器选择,后续可加 "claude" */
  answerer: "cursor-agent" as "cursor-agent" | "claude",
  /** 求职画像,注入作答视角 */
  profile:
    "资深前端开发工程师,正在向 AI Agent 方向转型求职。答案需覆盖核心要点、与前端工程结合的角度,以及面试加分项。",
};

export type AppConfig = typeof config;
```

- **Step 2: 验证编译**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 无错误。

- **Step 3: Commit**

```bash
git add AIProject/xhs-ai-interview/src/config.ts
git commit -m "feat: add config (keywords, paths, profile, answerer)"
```

---

## Task 7: 作答 Prompt 构建

**Files:**

- Create: `src/answerer/prompt.ts`
- Test: `tests/prompt.test.ts`
- **Step 1: 写失败测试 `tests/prompt.test.ts`**

```ts
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
```

- **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/prompt.test.ts`
Expected: FAIL —— 找不到模块 `prompt.js`。

- **Step 3: 实现 `src/answerer/prompt.ts`**

```ts
import type { AnswerInput } from "../types.js";

export function buildAnswerPrompt(input: AnswerInput): string {
  const notesText = input.notes
    .map(
      (n) =>
        `### 笔记 noteId:${n.noteId}\n标题:${n.title}\n来源:${n.url}\n正文:\n${n.content}`
    )
    .join("\n\n");

  return [
    "你是一名资深面试辅导专家。下面是从小红书抓取的若干笔记,其中包含 AI Agent 相关的面试题。",
    "",
    `求职画像:${input.profile}`,
    "",
    "请完成以下工作:",
    "1. 从每条笔记正文中提取出独立的面试题(忽略与面试无关的内容)。",
    `2. 与 ${input.guideDir} 目录下已有的复习指南做语义【去重】:已存在的题目不要重复新增,可在原有条目下补充更好的要点。`,
    "3. 为每道新题撰写答案,答案结构包含:核心要点、与前端工程结合的角度、面试加分项。",
    `4. 按主题把题目+答案写入 ${input.guideDir}/<主题>.md(主题如:Agent 基础概念、LLM 基础、Agent 框架、工程化与部署、前端结合、项目场景题)。文件不存在则创建。`,
    `5. 全部写完后,重建 ${input.guideDir}/index.md 主题索引。`,
    "",
    "要求:答案准确、简洁、可直接用于复习;中文输出;直接修改文件,不要只在对话里回答。",
    "",
    "--- 待处理笔记 ---",
    notesText,
  ].join("\n");
}
```

- **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/prompt.test.ts`
Expected: PASS(2 个用例通过)。

- **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/src/answerer/prompt.ts AIProject/xhs-ai-interview/tests/prompt.test.ts
git commit -m "feat: add answer prompt builder"
```

---

## Task 8: cursor-agent 回答器

**Files:**

- Create: `src/answerer/cursorAgentAnswerer.ts`

> 该模块调用外部 `cursor-agent` CLI,属于集成代码,用手动验证而非单测(单测在 pipeline 用 mock Answerer 覆盖)。

- **Step 1: 实现 `src/answerer/cursorAgentAnswerer.ts`**

```ts
import { spawn } from "node:child_process";
import type { Answerer, AnswerInput } from "../types.js";
import { buildAnswerPrompt } from "./prompt.js";

/** 通过 cursor-agent CLI 无头作答。需先安装:curl https://cursor.com/install -fsSL | bash */
export class CursorAgentAnswerer implements Answerer {
  constructor(private cwd: string = process.cwd()) {}

  answer(input: AnswerInput): Promise<void> {
    const prompt = buildAnswerPrompt(input);
    return new Promise((resolve, reject) => {
      const child = spawn(
        "cursor-agent",
        ["-p", prompt, "--force", "--output-format", "text"],
        { cwd: this.cwd, stdio: ["ignore", "inherit", "inherit"] }
      );
      child.on("error", (err) =>
        reject(
          new Error(
            `调用 cursor-agent 失败(是否已安装?curl https://cursor.com/install -fsSL | bash):${err.message}`
          )
        )
      );
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`cursor-agent 退出码 ${code}`))
      );
    });
  }
}
```

- **Step 2: 验证编译**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 无错误。

- **Step 3: Commit**

```bash
git add AIProject/xhs-ai-interview/src/answerer/cursorAgentAnswerer.ts
git commit -m "feat: add cursor-agent answerer"
```

---

## Task 9: 小红书抓取器

**Files:**

- Create: `src/crawler/selectors.ts`
- Create: `src/crawler/xhsCrawler.ts`

> Playwright 抓取依赖实时站点与登录态,属集成代码,用手动验证。选择器集中在 `selectors.ts` 便于站点改版时维护。

- **Step 1: 创建 `src/crawler/selectors.ts`**

```ts
/** 小红书页面选择器集中管理(站点改版只改这里) */
export const selectors = {
  /** 搜索结果中的笔记卡片 */
  noteCard: "section.note-item",
  /** 卡片内笔记链接 */
  noteLink: "a[href*='/explore/'], a[href*='/search_result/']",
  /** 详情页标题 */
  detailTitle: "#detail-title",
  /** 详情页正文 */
  detailContent: "#detail-desc, .note-content .desc",
};

/** 由关键词构建搜索 URL */
export function searchUrl(keyword: string): string {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(
    keyword
  )}`;
}
```

- **Step 2: 实现 `src/crawler/xhsCrawler.ts`**

```ts
import { chromium, type BrowserContext } from "playwright";
import type { XhsNote } from "../types.js";
import { selectors, searchUrl } from "./selectors.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function randomDelay([min, max]: [number, number]): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}
function noteIdFromUrl(url: string): string {
  const m = url.match(/\/(?:explore|search_result|discovery\/item)\/([0-9a-z]+)/i);
  return m ? m[1] : url;
}

export interface CrawlOptions {
  authDir: string;
  keywords: string[];
  maxNotesPerKeyword: number;
  delayMsRange: [number, number];
  headless: boolean;
}

/** 启动持久化上下文。首次需 headless=false 扫码登录。 */
export async function launchContext(
  authDir: string,
  headless: boolean
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(authDir, {
    headless,
    viewport: { width: 1280, height: 900 },
  });
}

/** 打开小红书,等待用户扫码登录后保存登录态。 */
export async function login(authDir: string): Promise<void> {
  const ctx = await launchContext(authDir, false);
  const page = await ctx.newPage();
  await page.goto("https://www.xiaohongshu.com");
  console.log("请在打开的浏览器里扫码登录,登录完成后回到终端按 Enter...");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });
  await ctx.close();
  console.log("登录态已保存到", authDir);
}

export async function crawl(opts: CrawlOptions): Promise<XhsNote[]> {
  const ctx = await launchContext(opts.authDir, opts.headless);
  const results: XhsNote[] = [];
  const seen = new Set<string>();
  try {
    const page = await ctx.newPage();
    for (const keyword of opts.keywords) {
      await page.goto(searchUrl(keyword), { waitUntil: "domcontentloaded" });
      await randomDelay(opts.delayMsRange);
      const links = await page
        .locator(`${selectors.noteCard} ${selectors.noteLink}`)
        .evaluateAll((els) =>
          els.map((e) => (e as HTMLAnchorElement).href).filter(Boolean)
        );
      const unique = [...new Set(links)].slice(0, opts.maxNotesPerKeyword);
      for (const url of unique) {
        const noteId = noteIdFromUrl(url);
        if (seen.has(noteId)) continue;
        seen.add(noteId);
        try {
          const detail = await ctx.newPage();
          await detail.goto(url, { waitUntil: "domcontentloaded" });
          await randomDelay(opts.delayMsRange);
          const title =
            (await detail.locator(selectors.detailTitle).first().textContent()) ??
            "";
          const content =
            (await detail
              .locator(selectors.detailContent)
              .first()
              .textContent()) ?? "";
          await detail.close();
          if (content.trim()) {
            results.push({
              noteId,
              title: title.trim(),
              content: content.trim(),
              url,
              keyword,
              fetchedAt: new Date().toISOString(),
              answered: false,
            });
          }
        } catch (e) {
          console.warn("抓取笔记失败", url, (e as Error).message);
        }
      }
    }
  } finally {
    await ctx.close();
  }
  return results;
}
```

- **Step 3: 验证编译**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 无错误。

- **Step 4: Commit**

```bash
git add AIProject/xhs-ai-interview/src/crawler/selectors.ts AIProject/xhs-ai-interview/src/crawler/xhsCrawler.ts
git commit -m "feat: add xhs playwright crawler with persistent login"
```

---

## Task 10: 流水线编排

**Files:**

- Create: `src/pipeline/run.ts`
- Test: `tests/pipeline.test.ts`

> `run.ts` 把抓取函数与回答器以参数注入,使编排逻辑可在不联网/不调 LLM 时单测。

- **Step 1: 写失败测试 `tests/pipeline.test.ts`**

```ts
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
```

- **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/pipeline.test.ts`
Expected: FAIL —— 找不到模块 `run.js`。

- **Step 3: 实现 `src/pipeline/run.ts`**

```ts
import type { Answerer, XhsNote } from "../types.js";
import { appendNotes, getUnanswered, markAnswered } from "../store/notesStore.js";
import { writeDailyBank } from "../docs/questionBank.js";
import { regenerateIndex } from "../docs/reviewGuide.js";

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
  const notes = await opts.crawlFn();
  const { added, skipped } = appendNotes(opts.paths.notes, notes);
  writeDailyBank(opts.paths.bankDir, opts.date ?? today(), notes);
  return { added, skipped };
}

export async function runAnswer(
  opts: Pick<RunOptions, "answerer" | "paths" | "profile">
): Promise<{ answeredCount: number }> {
  const unanswered = getUnanswered(opts.paths.notes);
  if (unanswered.length === 0) return { answeredCount: 0 };
  await opts.answerer.answer({
    notes: unanswered,
    guideDir: opts.paths.guideDir,
    profile: opts.profile,
  });
  markAnswered(opts.paths.notes, unanswered.map((n) => n.noteId));
  regenerateIndex(opts.paths.guideDir);
  return { answeredCount: unanswered.length };
}

export async function runDaily(opts: RunOptions): Promise<RunResult> {
  const { added, skipped } = await runCrawl(opts);
  const { answeredCount } = await runAnswer(opts);
  return { added, skipped, answeredCount };
}
```

- **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/pipeline.test.ts`
Expected: PASS(2 个用例通过)。

- **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/src/pipeline/run.ts AIProject/xhs-ai-interview/tests/pipeline.test.ts
git commit -m "feat: add pipeline orchestration with injected deps"
```

---

## Task 11: CLI 入口

**Files:**

- Create: `src/index.ts`
- **Step 1: 实现 `src/index.ts`**

```ts
import { config } from "./config.js";
import { crawl, login } from "./crawler/xhsCrawler.js";
import { CursorAgentAnswerer } from "./answerer/cursorAgentAnswerer.js";
import { runCrawl, runAnswer, runDaily } from "./pipeline/run.js";
import type { Answerer } from "./types.js";

function makeAnswerer(): Answerer {
  if (config.answerer === "cursor-agent") return new CursorAgentAnswerer();
  throw new Error(`暂未实现的回答器:${config.answerer}`);
}

function crawlFn() {
  return crawl({
    authDir: config.paths.auth,
    keywords: config.keywords,
    maxNotesPerKeyword: config.maxNotesPerKeyword,
    delayMsRange: config.delayMsRange,
    headless: config.headless,
  });
}

const date = new Date().toISOString().slice(0, 10);
const paths = {
  notes: config.paths.notes,
  bankDir: config.paths.bankDir,
  guideDir: config.paths.guideDir,
};

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "login":
      await login(config.paths.auth);
      break;
    case "crawl": {
      const r = await runCrawl({ crawlFn, paths, date });
      console.log("抓取完成:", r);
      break;
    }
    case "answer": {
      const r = await runAnswer({ answerer: makeAnswerer(), paths, profile: config.profile });
      console.log("作答完成:", r);
      break;
    }
    case "daily": {
      const r = await runDaily({ crawlFn, answerer: makeAnswerer(), paths, profile: config.profile, date });
      console.log("每日流水线完成:", r);
      break;
    }
    default:
      console.log("用法: tsx src/index.ts <login|crawl|answer|daily>");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- **Step 2: 验证编译与帮助输出**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsx src/index.ts`
Expected: 编译无错误;运行打印用法并以退出码 1 结束。

- **Step 3: Commit**

```bash
git add AIProject/xhs-ai-interview/src/index.ts
git commit -m "feat: add CLI entry (login/crawl/answer/daily)"
```

---

## Task 12: cron 脚本 + README

**Files:**

- Create: `scripts/daily.sh`
- Create: `README.md`
- **Step 1: 创建 `scripts/daily.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$HOME/.cursor/bin:/usr/local/bin:$PATH"
LOG="data/daily.log"
mkdir -p data
echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily start =====" >> "$LOG"
npm run daily >> "$LOG" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily done =====" >> "$LOG"
```

- **Step 2: 赋予执行权限**

Run: `chmod +x AIProject/xhs-ai-interview/scripts/daily.sh`
Expected: 无输出,文件可执行。

- **Step 3: 创建 `README.md`**

```markdown
# 小红书 AI Agent 面试题搜集与复习工具

每日自动:抓取小红书 AI Agent 面试题 → 生成原始题库 → 用 cursor-agent 作答并按主题归类成复习指南。面向"资深前端 → AI Agent 求职"。

## 安装

\`\`\`bash
npm install
npx playwright install chromium
# 安装无头 Cursor Agent CLI(作答用,跑你的 Cursor 订阅)
curl https://cursor.com/install -fsSL | bash
\`\`\`

## 首次登录小红书(扫码,仅需一次)

\`\`\`bash
npm run login
\`\`\`

在弹出的浏览器里扫码登录,完成后回终端按 Enter,登录态保存在 `.auth/`。

## 使用

\`\`\`bash
npm run crawl    # 仅抓取并落题库
npm run answer   # 仅对未作答的题作答归类
npm run daily    # 抓取 + 作答(完整流水线)
\`\`\`

产出:
- `docs/题库/YYYY-MM-DD.md` —— 每日原始题库
- `docs/复习指南/<主题>.md` —— 按主题归类的复习指南
- `docs/复习指南/index.md` —— 主题索引

## 定时任务(cron)

每天 23:20 运行(电脑开机时生效):

\`\`\`bash
crontab -e
# 加入一行(路径替换为你的实际绝对路径):
0 9 * * * /Users/hb35210/Documents/app/AIProject/xhs-ai-interview/scripts/daily.sh
\`\`\`

日志见 `data/daily.log`。

## 配置

编辑 `src/config.ts`:关键词、每关键词抓取数、延时、是否无头、求职画像、回答器(`cursor-agent` / 后续 `claude`)。

## 风控提示

低频、限量、随机延时。如遇登录态失效,重新 `npm run login`。
\`\`\`

- [ ] **Step 4: 运行全部测试确认未破坏**

Run: `npx vitest run`
Expected: 所有测试文件 PASS。

- [ ] **Step 5: Commit**

```bash
git add AIProject/xhs-ai-interview/scripts/daily.sh AIProject/xhs-ai-interview/README.md
git commit -m "docs: add daily cron script and README"
```

---

## Task 13: 端到端联调(手动)

> 需要你本机参与:安装 cursor-agent、扫码登录、真实跑一次。

- **Step 1: 安装 cursor-agent CLI**

Run: `curl https://cursor.com/install -fsSL | bash && cursor-agent --version`
Expected: 打印版本号。若 PATH 未生效,重开终端或 source 对应 rc 文件。

- **Step 2: 首次扫码登录小红书**

Run: `cd AIProject/xhs-ai-interview && npm run login`
Expected: 弹出浏览器,扫码登录后终端提示"登录态已保存"。

- **Step 3: 仅跑抓取,核对题库**

Run: `npm run crawl`
Expected: `data/notes.jsonl` 出现内容,`docs/题库/<今天>.md` 生成且含若干笔记。若抓取为空,把 `src/config.ts` 的 `headless` 设为 `false` 观察页面、并按需更新 `src/crawler/selectors.ts` 选择器。

- **Step 4: 跑作答,核对复习指南**

Run: `npm run answer`
Expected: `docs/复习指南/` 下生成主题 md 与 `index.md`,内容为"资深前端→Agent"视角的答案;`notes.jsonl` 中对应笔记 `answered` 变为 true。

- **Step 5: 跑完整流水线并配置 cron**

Run: `npm run daily`,确认结果后按 README 配置 crontab。
Expected: 一条命令完成抓取+作答;`crontab -l` 能看到定时项。

---

## Self-Review

**Spec coverage:**

- 每日抓取小红书 AI Agent 面试题 → Task 9(crawler)+ Task 6(关键词)+ Task 12(cron)。✅
- 整理成原始题库文档 → Task 4(每日题库)。✅
- 自动回答 → Task 7(prompt)+ Task 8(cursor-agent 回答器)。✅
- 沉淀为按主题归类的复习指南(去重) → Task 5(指南/索引)+ prompt 去重指令 + Task 10(编排)。✅
- 全自动(cron 后自动作答) → Task 10 runDaily + Task 11 CLI + Task 12 daily.sh。✅
- 可插拔回答器(后续 Claude) → Task 2 `Answerer` 接口 + Task 11 `makeAnswerer`。✅
- 风控、登录态、容错 → Task 9(随机延时/限量/持久化登录/抓取失败 try-catch)、Task 10(仅作答未作答项,作答失败不影响已落盘题库)。✅

**Placeholder scan:** 无 TBD/TODO;集成模块(crawler、cursor-agent)以手动验证步骤替代单测,均给出具体命令与预期。✅

**Type consistency:** `XhsNote`、`AnswerInput`、`Answerer`(Task 2)在 store/prompt/answerer/pipeline 中一致使用;`PipelinePaths` 字段 `notes/bankDir/guideDir` 与 config.paths、CLI 注入一致;函数名 `appendNotes/getUnanswered/markAnswered/writeDailyBank/regenerateIndex/buildAnswerPrompt/crawl/login/runCrawl/runAnswer/runDaily` 在定义与调用处一致。✅