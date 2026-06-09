import { config } from "./config.js";
import { crawl, login } from "./crawler/xhsCrawler.js";
import { CursorAgentAnswerer } from "./answerer/cursorAgentAnswerer.js";
import { runCrawl, runAnswer, runDaily } from "./pipeline/run.js";
import { installSchedule, removeSchedule } from "./schedule.js";
import { join } from "node:path";
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
    case "schedule": {
      const dailyScript = join(process.cwd(), "scripts", "daily.sh");
      const line = installSchedule(config.schedule, dailyScript);
      console.log("已按 config.schedule 安装/更新定时任务:");
      console.log("  " + line);
      console.log("查看全部:crontab -l");
      break;
    }
    case "schedule:off": {
      removeSchedule();
      console.log("已移除本工具的定时任务(其它任务保留)。");
      break;
    }
    default:
      console.log("用法: tsx src/index.ts <login|crawl|answer|daily|schedule|schedule:off>");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
