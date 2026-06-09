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
