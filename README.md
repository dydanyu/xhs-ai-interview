# 小红书 AI Agent 面试题搜集与复习工具

每日自动:抓取小红书 AI Agent 面试题 → 生成原始题库 → 用 cursor-agent 作答并按主题归类成复习指南。面向"资深前端 → AI Agent 求职"。

## 安装

```bash
npm install
npx playwright install chromium
# 安装无头 Cursor Agent CLI(作答用,跑你的 Cursor 订阅)
curl https://cursor.com/install -fsSL | bash
```

安装后需完成 cursor-agent 一次性鉴权(使用你的 Cursor 账号),按安装提示登录,例如:

```bash
cursor-agent login
```

## 首次登录小红书(扫码,仅需一次)

```bash
npm run login
```

在弹出的浏览器里扫码登录,完成后回终端按 Enter,登录态保存在 `.auth/`。

## 使用

```bash
npm run crawl    # 仅抓取并落题库
npm run answer   # 仅对未作答的题作答归类
npm run daily    # 抓取 + 作答(完整流水线)
```

产出:
- `docs/题库/YYYY-MM-DD.md` —— 每日原始题库
- `docs/复习指南/<主题>.md` —— 按主题归类的复习指南
- `docs/复习指南/index.md` —— 主题索引

## 定时任务(配置化)

调度时间写在 `src/config.ts` 的 `schedule` 字段(cron 表达式),改完用一条命令同步到系统 crontab:

```bash
npm run schedule       # 按 config.schedule 安装/更新定时任务(幂等,只管理本工具自己那行)
npm run schedule:off   # 移除本工具的定时任务(不影响你其它 cron 任务)
crontab -l             # 查看当前所有定时任务
```

`schedule` 示例:`"0 9 * * *"` 每天9点 | `"30 8 * * *"` 每天8:30 | `"0 */6 * * *"` 每6小时 | `"0 9 * * 1-5"` 工作日9点。改时间后重跑 `npm run schedule` 即可。

日志见 `data/daily.log`。注意:macOS 休眠时 cron 不会补跑。

## 配置

编辑 `src/config.ts`:关键词、每关键词抓取数、延时、是否无头、调度时间 `schedule`、求职画像、回答器(`cursor-agent` / 后续 `claude`)。

## 风控提示

低频、限量、随机延时。如遇登录态失效,重新 `npm run login`。
# xhs-ai-interview
