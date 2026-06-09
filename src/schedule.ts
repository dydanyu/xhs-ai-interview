import { execFileSync } from "node:child_process";

/** 标记本工具管理的 crontab 行,便于幂等替换/移除,不影响用户其他任务。 */
export const MARKER = "# xhs-ai-interview-managed";

/** 移除所有由本工具管理的行,保留其它任务。 */
export function stripManaged(crontab: string): string {
  return crontab
    .split("\n")
    .filter((line) => !line.includes(MARKER))
    .join("\n");
}

/** 在已有 crontab 基础上,生成包含本工具一行(指定 cron + 脚本)的新 crontab 文本。幂等。 */
export function buildCrontab(existing: string, cron: string, daily: string): string {
  const base = stripManaged(existing).trim();
  const line = `${cron} ${daily} ${MARKER}`;
  return (base ? base + "\n" : "") + line + "\n";
}

function readCrontab(): string {
  try {
    return execFileSync("crontab", ["-l"], { encoding: "utf8" });
  } catch {
    // 还没有 crontab 时 `crontab -l` 会非零退出
    return "";
  }
}

function writeCrontab(content: string): void {
  execFileSync("crontab", ["-"], { input: content });
}

/** 把指定 cron 时间安装/更新到系统 crontab,返回写入的那一行。 */
export function installSchedule(cron: string, daily: string): string {
  const next = buildCrontab(readCrontab(), cron, daily);
  writeCrontab(next);
  return `${cron} ${daily} ${MARKER}`;
}

/** 移除本工具的定时任务(保留其它)。 */
export function removeSchedule(): void {
  const base = stripManaged(readCrontab()).trim();
  writeCrontab(base ? base + "\n" : "");
}
