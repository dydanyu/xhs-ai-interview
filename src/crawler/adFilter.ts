import type { XhsNote } from "../types.js";

/** 联系方式/引流:出现即判广告 */
const CONTACT =
  /(微信|加我|私我|私信|vx|v信|weixin|扣扣|qq\s*群|进群|加群|扫码|二维码|dd我|滴滴我|公众号)/i;

/** 售卖/招生话术:出现即判广告 */
const SELLING =
  /(训练营|报名|付费课程|领取资料|领资料|资料领取|上岸班|包过|押题|名额有限|限时优惠|福利领取|内推保过|一对一辅导|带练|陪跑|抱走|有偿)/;

/** 夸张引流标题党:需配合「无真题内容」一起判定 */
const HYPE = /(全网最|直接背|看完直接|刷到就是赚到|系列来了|私信领|码住)/;

/** 正文是否含问号(真实面试题最强信号) */
function hasQuestionMark(content: string): boolean {
  return /[？?]/.test(content);
}

function countLinks(content: string): number {
  return (content.match(/https?:\/\//gi) || []).length;
}

/**
 * 启发式判别小红书笔记是否为广告/课程推广/引流贴。
 * - 命中联系方式或售卖话术:直接判广告
 * - 链接堆砌(≥3):判广告(资料引流贴,真实面经极少堆外链)
 * - 标题党话术 + 正文无问号:判广告
 */
export function looksLikeAd(note: XhsNote): boolean {
  const text = `${note.title}\n${note.content}`;
  if (CONTACT.test(text) || SELLING.test(text)) return true;
  if (countLinks(note.content) >= 3) return true;
  if (HYPE.test(text) && !hasQuestionMark(note.content)) return true;
  return false;
}
