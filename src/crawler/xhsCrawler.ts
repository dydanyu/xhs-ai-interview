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
  let totalCandidates = 0;
  try {
    const page = await ctx.newPage();
    for (const keyword of opts.keywords) {
      await page.goto(searchUrl(keyword), { waitUntil: "domcontentloaded" });
      await randomDelay(opts.delayMsRange);
      const links = await page
        .locator(selectors.noteCard)
        .locator(selectors.noteLink)
        .evaluateAll((els) =>
          els.map((e) => (e as HTMLAnchorElement).href).filter(Boolean)
        );
      const unique = [...new Set(links)].slice(0, opts.maxNotesPerKeyword);
      totalCandidates += unique.length;
      for (const url of unique) {
        const noteId = noteIdFromUrl(url);
        if (seen.has(noteId)) continue;
        seen.add(noteId);
        const detail = await ctx.newPage();
        try {
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
        } finally {
          await detail.close();
        }
      }
    }
  } finally {
    await ctx.close();
  }
  if (totalCandidates === 0) {
    throw new Error(
      "未找到任何笔记卡片,可能未登录或登录态已失效。请运行: npm run login"
    );
  }
  return results;
}
