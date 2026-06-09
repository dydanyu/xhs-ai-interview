# 小红书 AI Agent 面试题搜集与复习工具 — 设计文档

- 日期:2026-06-09
- 状态:已确认设计,待进入实现计划
- 作者:用户(资深前端,目标转 AI Agent 方向)+ AI 协作

## 1. 背景与目标

用户是资深前端开发,希望往 AI Agent 方向发展并求职。需要一个工具,能够:

1. 每天自动从小红书搜集关于 "AI Agent" 的面试题。
2. 整理成结构化文档(原始题库)。
3. 自动回答这些面试题(站在「资深前端 → AI Agent 求职」视角)。
4. 沉淀为按主题归类的面试复习指南(去重、可持续增长)。

整体目标:**无人值守的全自动每日流水线**,产出可直接用于复习的资料。

## 2. 核心决策(已与用户确认)

| 决策点 | 结论 | 备注 |
| --- | --- | --- |
| 数据来源 | 浏览器自动化抓取 | 用用户已登录的小红书账号,无需付费;有风控风险,需控制频率 |
| 触发方式 | 本地定时任务(cron)+ 支持手动触发 | 电脑开机时生效 |
| 回答模型 | 初期用 Cursor(`cursor-agent` CLI),后续可切换 Claude API | 跑用户的 Cursor 订阅,无需额外 key |
| 自动化程度 | 全自动:cron 抓取后自动调 `cursor-agent` 作答 | 通过 `Answerer` 接口解耦,便于后续替换 |
| 文档形式 | 本地 Markdown,两层:原始题库(按日期)+ 复习指南(按主题) | 用 Cursor/编辑器直接查看编辑 |

## 3. 技术栈

- **语言/运行时**:Node.js (本机 v18.20.8) + TypeScript
- **抓取**:Playwright(Chromium),持久化登录态(`userDataDir`)
- **作答**:`cursor-agent` CLI(需安装:`curl https://cursor.com/install -fsSL | bash`),通过 `Answerer` 接口封装;预留 Claude API 实现
- **调度**:系统 cron 调用 `scripts/daily.sh`;同时该脚本可手动执行

## 4. 目录结构

```
xhs-ai-interview/
  src/
    crawler/        # Playwright 抓取小红书笔记
    answerer/       # Answerer 接口 + cursor-agent 实现(预留 claude 实现)
    pipeline/       # 串联:抓取 → 去重 → 作答 → 归类
    config.ts       # 关键词、抓取条数、频率、路径等配置
  data/
    notes.jsonl     # 抓到的原始笔记(含 noteId,用于去重)
  docs/
    题库/YYYY-MM-DD.md      # 每日原始题库(题目 + 来源链接)
    复习指南/<主题>.md       # 按主题归类的复习指南(去重 + 答案)
    复习指南/index.md       # 主题索引
  .auth/            # Playwright 登录态(gitignore)
  scripts/daily.sh  # cron 入口:先 crawl,再调 cursor-agent 作答
  package.json
  tsconfig.json
  README.md
```

## 5. 数据流(每日一次)

1. **抓取**:用关键词搜索小红书(默认关键词:`AI Agent 面试`、`大模型 Agent 面试题`、`AI Agent 八股`、`LLM Agent 面试` 等),抓取笔记的标题 + 正文 + 链接。按 `noteId` 去重后追加写入 `data/notes.jsonl`,并生成/更新当天的 `docs/题库/YYYY-MM-DD.md`。
2. **作答**:`cursor-agent` 读取「新增且未作答」的题目,站在资深前端转 Agent 求职的视角生成答案。
3. **归类**:把新题按主题去重合并进 `docs/复习指南/<主题>.md`(若已有相似题则跳过或补充要点),并更新 `index.md`。

## 6. 关键设计点

- **风控**:随机延时;限制每次抓取条数(默认约 20 条);复用持久化登录态;首次运行需扫码登录。
- **去重**:
  - 原始层:按小红书 `noteId` 精确去重。
  - 复习指南层:按题目语义判重(由作答步骤判断是否已存在相似题)。
- **作答视角**:Prompt 固化为「资深前端 → AI Agent 方向求职」。答案结构包含:核心要点、前端结合角度、面试加分项。
- **可插拔回答器**:定义 `Answerer` 接口(输入新题 + 现有指南,输出答案与归类)。当前实现 `CursorAgentAnswerer`,后续新增 `ClaudeAnswerer`,通过 `config.ts` 切换。
- **容错**:
  - 抓取失败 / 登录态失效 → 清晰提示并退出,不破坏已有数据。
  - 作答失败 → 不影响题库已落盘;可下次重试未作答的题。
- **幂等**:重复运行同一天不产生重复题目;`notes.jsonl` 与指南均以 id/语义去重为准。

## 7. 模块边界

| 模块 | 职责 | 输入 | 输出 | 依赖 |
| --- | --- | --- | --- | --- |
| `crawler` | 登录态管理 + 搜索抓取 + 原始去重 | 关键词、抓取条数 | 新增笔记写入 `notes.jsonl`、生成每日题库 md | Playwright |
| `answerer` | 对新题作答并给出主题归类 | 新题 + 现有指南摘要 | 答案 + 主题 | cursor-agent CLI(后续 Claude) |
| `pipeline` | 编排流程、决定哪些是「新题/未作答」 | config | 调度 crawler/answerer、写指南 | crawler/answerer |
| `config` | 集中配置 | — | 关键词、限额、路径、回答器选择 | — |

## 8. 非目标(YAGNI)

- 不做 Web UI / 后台服务。
- 不做多平台(仅小红书)。
- 不做账号池 / 大规模爬取。
- 不做向量数据库;去重用 id + LLM 语义判断即可。

## 9. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 小红书风控 / 封号 | 低频、限量、随机延时、复用登录态 |
| 页面结构变动导致抓取失效 | 抓取选择器集中管理,失败有明确报错 |
| `cursor-agent` 无头作答不稳定 | 失败不影响题库;保留手动触发作答的能力 |
| 登录态过期 | 检测到未登录时提示重新扫码 |
