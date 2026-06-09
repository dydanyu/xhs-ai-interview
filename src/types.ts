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
  /** 是否被判别为广告/课程推广/引流贴(不写入题库、不送作答) */
  isAd?: boolean;
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
