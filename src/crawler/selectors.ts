/** 小红书页面选择器集中管理(站点改版只改这里) */
export const selectors = {
  /** 搜索结果中的笔记卡片 */
  noteCard: "section.note-item",
  /** 卡片内笔记链接(必须用带 xsec_token 的 /search_result/ 链接,裸 /explore/ 链接打不开正文) */
  noteLink: "a[href*='/search_result/']",
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
