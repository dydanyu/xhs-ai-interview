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
  /**
   * 定时任务调度时间(cron 表达式)。改这里后重跑 `npm run schedule` 生效。
   * 例:"0 9 * * *" 每天9点 | "30 8 * * *" 每天8:30 | "0 *\/6 * * *" 每6小时 | "0 9 * * 1-5" 工作日9点
   */
  schedule: "0 15 * * *",
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
