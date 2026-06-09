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
