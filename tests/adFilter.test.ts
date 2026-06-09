import { describe, it, expect } from "vitest";
import { looksLikeAd } from "../src/crawler/adFilter.js";
import type { XhsNote } from "../src/types.js";

function note(partial: Partial<XhsNote>): XhsNote {
  return {
    noteId: "n",
    title: "",
    content: "",
    url: "https://xhs/n",
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered: false,
    ...partial,
  };
}

describe("looksLikeAd", () => {
  it("keeps a genuine interview-question post", () => {
    expect(
      looksLikeAd(
        note({
          title: "快手AI Agent开发一面",
          content: "1、为什么引入父子索引？\n2、rerank 后返回几个块？",
        })
      )
    ).toBe(false);
  });

  it("keeps a genuine experience post that mentions the interviewer", () => {
    expect(
      looksLikeAd(
        note({
          title: "字节AI Agent面试经验",
          content: "面试官直接让我投屏演示，会抠很多细节。",
        })
      )
    ).toBe(false);
  });

  it("flags contact-info / lead-gen posts", () => {
    expect(
      looksLikeAd(note({ title: "面试资料", content: "私我领资料，加微信进群。" }))
    ).toBe(true);
  });

  it("flags course / training-camp selling posts", () => {
    expect(
      looksLikeAd(
        note({ title: "Agent训练营", content: "限时优惠报名，包过押题。" })
      )
    ).toBe(true);
  });

  it("flags clickbait hype posts with no real questions", () => {
    expect(
      looksLikeAd(
        note({
          title: "🚀 Agent 面试 Day1｜大厂必问｜直接背",
          content: "全网最落地的面试题系列来了！看完直接去面试！#agent #大模型",
        })
      )
    ).toBe(true);
  });

  it("flags link-stuffed resource-funnel posts with no questions", () => {
    expect(
      looksLikeAd(
        note({
          title: "28天agent开发学习计划",
          content:
            "资料：https://a.com 链接 https://github.com/x 链接 https://b.cc 学习计划仅供参考。",
        })
      )
    ).toBe(true);
  });
});
