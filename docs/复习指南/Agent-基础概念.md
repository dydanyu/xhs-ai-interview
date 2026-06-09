# Agent 基础概念

> 面向资深前端 → AI Agent 转型求职

---

## Agent 的基本架构组成是什么？与传统 LLM Chain 有何区别？

**来源：** 2026大模型Agent面试全攻略（上）

### 核心要点

- **Agent 四要素：** LLM + 规划（Planning）+ 记忆（Memory）+ 工具使用（Tool Use）。
- **运行模式（PAPA 循环）：** 感知（Perceive，读用户输入 / 工具 Observation）→ 规划（Plan，分解子目标）→ 行动（Act，调 tool / 生成）→ 反馈（Feedback，评估结果），形成推理循环（Reasoning Loop），根据中间结果动态调整策略。
- **与 Chain 的区别：** Chain 是预定义的线性工作流，路径固定；Agent 具备自主性，由模型根据目标决定下一步调用哪个工具、是否重试、何时结束。

### 与前端工程结合的角度

- 前端可将 Agent 状态机可视化为「步骤条 + 工具调用日志」，帮助用户理解非确定性流程。
- Chain 适合固定表单向导（如 onboarding）；Agent 适合开放式 Copilot（如代码助手），UI 需预留「计划变更」「中途改需求」的交互空间。

### 面试加分项

- 能举例：「查天气用 Chain 够用；跨系统订会议室 + 发邮件 + 改日历用 Agent」。
- 补充 Agent 的代价：延迟更高、成本不可预测、需 eval 与 guardrail。

---

## ReAct 模式的工作原理是什么？

**来源：** 2026大模型Agent面试全攻略（上）、字节AI Agent后端面经

> 完整可运行实现见 [手写代码题 · ReAct Agent Loop](手写代码题.md#简化-react-agent-loop)。

### 核心要点

- **ReAct = Reasoning + Acting：** 每轮输出 Thought（推理）→ Action（工具调用）→ Observation（工具返回），再进入下一轮。
- **优势：** 灵活、可解释、适合工具链不确定的任务；用户中途改需求也能跟上。
- **与 CoT 对比：** CoT 只做链式推理不出环境交互；ReAct 把推理与行动交织，能利用外部事实纠正幻觉。

### 与前端工程结合的角度

- 前端 SSE 流式展示 Thought / Action / Observation 三段，提升透明度和信任感。
- 可用折叠面板区分「模型在想什么」和「实际执行了什么」，避免用户被长推理淹没。

### 面试加分项

- 提到 Yao et al. 2022 ReAct 论文及「Observation 是 grounding 的关键」。
- 说明 max iteration 与 timeout 防止无限循环。

---

## CoT 与 ReAct 的底层原理和优缺点对比？

**来源：** 字节AI Agent后端面经

### 核心要点

| 维度   | CoT                    | ReAct                         |
| ------ | ---------------------- | ----------------------------- |
| 输出   | 纯文本推理链           | 推理 + 工具调用 + 观察        |
| 事实性 | 依赖模型参数，易幻觉   | 工具 Observation 可校正       |
| 成本   | token 较少             | 多轮调用，延迟与费用更高      |
| 适用   | 数学、逻辑、纯文本分析 | 需查库、调 API、写文件的 任务 |

- **组合用法：** 复杂任务先 CoT 分解子目标，子步骤用 ReAct 执行。

### 与前端工程结合的角度

- CoT 适合在 UI 展示「思考过程」；ReAct 需额外渲染 tool call 卡片（参数 JSON、执行状态、结果摘要）。
- 前端可对 CoT-only 模式做打字机效果；ReAct 需 loading / retry / error 状态机。

### 面试加分项

- 提到 Self-Consistency CoT、Tree-of-Thoughts 等扩展，说明 ReAct 是当前 Agent 工程默认范式之一。

---

## ReAct 还是 Plan-and-Execute？你们用的 Agent 框架是什么？

**来源：** 分享一下我面试Agent岗位时被问到的问题、快手AI Agent开发一面（任务规划）

### 核心要点

- **ReAct：** 边想边干，每步根据 Observation 调整；灵活，适合需求变更频繁的场景。
- **Plan-and-Execute：** 先出完整计划再逐步执行；省 token、路径清晰，但计划错了纠错成本高。
- **工程实践：** 混用——宏观 Plan 定方向，执行层遇异常切 ReAct 局部重规划（Plan-and-Execute + ReAct fallback）；用户中途改需求时 ReAct 更扛得住。
- **面试话术：** 回答时给出项目真实选型理由，而非绝对站队；强调「计划提供全局感，ReAct 提供纠偏能力」。

### 与前端工程结合的角度

- Plan 阶段可在 UI 展示可编辑的任务清单（用户确认后再执行）。
- 执行阶段用步骤组件 + 实时状态，支持「暂停 / 改计划 / 单步重试」。

### 面试加分项

- 对比 LangGraph 中 planner node + executor node 的分层设计。
- 量化：Plan 模式平均减少 20–30% 无效 tool call（需结合项目数据说话）。

---

## Agent 的记忆机制怎么设计？长期与短期如何存储？

**来源：** 快手AI Agent开发一面、2026大模型Agent面试全攻略（上）、Agent 记忆面经

### 核心要点

- **短期记忆：** 当前会话 message history + 结构化 state（任务进度、中间结果）；存 Redis / 内存，受 context window 限制。
- **长期记忆：** 会话摘要、用户偏好、历史经验 embedding 入向量库；相关话题触发时 RAG 检索回填 context。
- **压缩策略：** Summary Buffer、递归摘要、只保留 system prompt + 最近 N 轮 + 当前目标；2026 趋势是 long-context 模型 + 层级摘要并存。
- **工程细节（面经）：** 短期 state（步数、中间结果）可放 Redis；长期偏好 embedding 入向量库，相关话题再 RAG 回填——核心是「别让窗口撑爆」。

### 与前端工程结合的角度

- 前端 session 与后端 threadId 绑定；切换会话时拉取摘要而非全量历史。
- 「记忆管理」设置页：用户可查看 / 删除长期记忆条目（合规与可控性）。

### 面试加分项

- 区分 episodic memory（经历）vs semantic memory（事实）vs procedural memory（工作流偏好）。
- 提到 MemGPT、Letta 等 memory 架构思路。

---

## 上下文工程（Context Engineering）如何设计？

**来源：** 快手AI Agent开发一面

### 核心要点

- **目标：** 在有限 token 内放入「对当前决策最有用」的信息。
- **分层结构：** System（角色 + 约束）→ 检索上下文（RAG chunks）→ 工具定义 → 对话历史 → 当前用户输入。
- **动态组装：** 按任务类型选择模板；重要信息置顶；低价值历史摘要化；工具 schema 按需注入（非全量工具一次塞入）。
- **与 Prompt Engineering 区别：** Prompt 管「怎么说」；Context Engineering 管「塞什么、塞多少、什么顺序」。

### 与前端工程结合的角度

- 前端上传文件 / 选知识库 / @引用 即 context 的可视化入口。
- Token 预算指示器（开发者模式）帮助调试 context 溢出。

### 面试加分项

- 引用 Anthropic / OpenAI 关于 context window 利用的最佳实践。
- 说明「Lost in the Middle」现象及缓解（关键指令放首尾）。

---

## Agent 的任务规划是怎么做的？

**来源：** 快手AI Agent开发一面

### 核心要点

- **层级规划：** 目标分解为子任务 DAG 或线性步骤（TodoList / Plan JSON）。
- **动态重规划：** 工具失败、新 Observation 触发 plan 修订，而非 rigid 执行到底。
- **实现方式：** Plan-and-Execute、LangGraph planner 节点、或 ReAct 中模型自发输出 sub-goals。
- **约束：** 最大步数、deadline、成本控制（每步 token 预算）。

### 与前端工程结合的角度

- 任务树 UI：可展开子任务、显示依赖与完成态。
- 用户可拖拽调整优先级或跳过某步，前端写回 state 触发 replan。

### 面试加分项

- 对比 STRIPS、HTN 等传统规划与 LLM 规划的差异（LLM 规划软约束、需验证）。
- 提到 Human-in-the-loop 在关键里程碑确认计划。

---

## 多轮对话中如何处理「状态爆炸」和「上下文溢出」？

**来源：** 2026大模型Agent面试全攻略（下）

### 核心要点

- **State Schema：** TypedDict / Zod 定义严格状态结构，只存核心变量，不存冗余 raw log。
- **Trim Strategy：** 保留 system prompt、最近 N 轮、当前任务目标；按语义重要性而非简单 FIFO 截断。
- **Summary Buffer：** 旧对话压缩为摘要放在 context 头部。
- **外置状态：** 大中间结果存 DB / 对象存储，context 只留引用 ID。

### 与前端工程结合的角度

- 前端分页加载历史消息；长工具结果默认折叠，点击展开详情。
- 会话「归档」与「继续任务」分离，避免单 thread 无限膨胀。

### 面试加分项

- 结合 LangGraph checkpoint 机制说明断点续跑。
- 给出具体数字：如保留最近 10 轮 + 2KB 摘要。

---

## 多智能体如何协作？（如一个写代码、一个审查）

**来源：** 分享一下我面试Agent岗位时被问到的问题

### 核心要点

- **角色隔离：** 每个 Agent 固定 System Prompt、职责边界、输出 schema（程序员 vs 审查员）。
- **协作拓扑：** 顺序链（写 → 审）、层级（manager 分发）、辩论（多角色 + 仲裁）。
- **消息协议：** JSON 消息带 taskId、artifact 引用，便于追踪与回放。
- **冲突处理：** 仲裁 Agent 或 Human-in-the-loop；关键步骤人工介入。

### 与前端工程结合的角度

- 多 Agent 对话流用不同头像 / 色块区分角色。
- Code Review UI：diff 视图 + 审查意见结构化展示。

### 面试加分项

- 提到 AutoGen、CrewAI、MetaGPT 等框架的协作模式差异。
- 说明避免「消息乒乓」的 max round 与 timeout。

---

## Reflection（反思）如何设计？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **目的：** 执行后评估结果质量，决定是否重试、改策略或请求更多信息。
- **模式：** Self-reflection（模型自评）、Critic Agent（独立评审）、规则校验（schema / 单元测试）。
- **流程：** Act → Evaluate → Reflect → Re-act；Reflection 输出 structured（pass/fail + reason + next action）。
- **防滥用：** 限制 reflection 轮数，避免 infinite self-critique。

### 与前端工程结合的角度

- UI 展示「自我修正」过程，让用户看到 agent 为何重试（建立信任）。
- 审查不通过时提供「接受 / 强制继续 / 人工修改」按钮。

### 面试加分项

- 关联 Reflexion、CRITIC 等论文思路。
- 举例：代码 Agent 跑测试失败 → reflection → 改代码 → 再测。

---

## 如何避免 Agent 执行死循环？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **硬限制：** max_iterations、总 timeout、单工具 timeout、max token budget。
- **循环检测：** 相同 (action, args) 重复 N 次则中断；state hash 去重。
- **终止条件：** 显式 finish tool / stop phrase；任务完成 checklist 全部 satisfied。
- **降级：** 循环 detected 时 summarizer 总结进展并 ask human。

### 与前端工程结合的角度

- 前端显示剩余步数 / 倒计时；用户可一键「停止生成」AbortController 取消 SSE。
- 循环 detected 时 toast 提示并展示已执行步骤供用户接管。

### 面试加分项

- LangGraph 的 recursion_limit 参数。
- 说明 ReAct 论文中的 stop criteria 设计。

---

## Agent 如何完成工具选择（Tool Selection）？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **全量 vs 检索：** 工具少时全量注入 schema；工具多时先 embedding 检索 top-K 相关工具再 decision。
- **路由层：** 意图分类 → 工具组；或用专门 router 模型 / 规则。
- **描述质量：** 工具 name、description、参数示例直接影响选择准确率。
- **负样本：** 明确「何时不要用某工具」减少误调用。

### 与前端工程结合的角度

- 开发者控制台可视化 tool registry，支持启用 / 禁用工具（影响注入列表）。
- 用户界面可「限定工具范围」（如仅搜索、仅代码）缩小选择空间。

### 面试加分项

- 提到 ToolLLM、Gorilla 等 tool-use 专项研究。
- 量化 tool selection accuracy 作为 eval 指标。

---

## Prompt 如何设计（Agent 场景）？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **结构：** Role → Goal → Constraints → Tools → Output Format → Examples（few-shot）。
- **优化三要素：** 清晰表达任务、给足上下文（RAG/状态）、明确输出格式——比堆叠形容词更有效。
- **约束：** 禁止臆造参数、必须基于 Observation、不确定时 ask user。
- **格式：** JSON / function call schema；关键字段 required + enum。
- **迭代：** 用 bad case 反推 prompt patch；A/B 不同 system prompt。

### 与前端工程结合的角度

- Prompt 模板与 UI 场景绑定（客服 / 代码 / 分析），前端切换 persona 即切换 backend template id。
- 调试面板展示实际发送的 assembled prompt（脱敏）。

### 面试加分项

- 区分 system / developer / user message 层级（OpenAI API 惯例）。
- 提到 prompt 版本管理与 rollback。

---

## Agent 平台与工作流平台的区别？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

| 维度 | 工作流平台         | Agent 平台                 |
| ---- | ------------------ | -------------------------- |
| 路径 | 预定义 DAG，确定性 | LLM 动态决策，非确定性     |
| 节点 | 固定 API / 脚本    | LLM + Tool + Memory        |
| 适用 | 审批流、ETL、RPA   | 开放式问答、复杂任务自动化 |
| 治理 | 版本、审计清晰     | 需 eval、guardrail、trace  |

- **融合趋势：** 工作流编排 Agent 子流程（如 Dify、Coze、LangGraph Studio）。

### 与前端工程结合的角度

- 低代码拖拽是工作流平台强项；Agent 平台更强调对话 UI + trace 调试 + 知识库配置。
- 前端工程师可负责 Agent 平台的交互层与工作流平台的节点配置 UI。

### 面试加分项

- 举例 Coze vs n8n vs LangGraph 的定位差异。
- 企业选型：合规场景偏工作流，探索性任务偏 Agent。

---

## 企业级 Agent 的典型应用场景有哪些？

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **知识问答：** 内部文档 RAG + 权限过滤。
- **Copilot：** 代码、BI、客服辅助；Human-in-the-loop。
- **流程自动化：** 工单分类、审批草稿、跨系统操作（需审计）。
- **数据分析：** Text2SQL、报表解读、异常归因。
- **关键要求：** SSO、RBAC、审计日志、SLA、成本控制、私有化部署。

### 与前端工程结合的角度

- 企业级前端强调权限 UI、操作确认、审计 trail 展示、多租户配置。
- 嵌入式 Copilot（侧边栏）vs 独立 Portal 的集成模式。

### 面试加分项

- 按行业举例：金融合规问答、电商客服、研发效能。
- 说明 POC → 试点 → 平台化的落地路径。

---

## 对 AI 应用发展的理解（开放题）

**来源：** 某大厂 AI 岗一面面经

### 核心要点

- **阶段判断：** 从「对话 demo」→「Agent 干活」→「多 Agent 协作 + 垂直平台」。
- **瓶颈：** 可靠性、成本、eval 体系、数据安全；不是模型能力单独决定产品成败。
- **趋势：** Agentic RAG、Computer Use、长 context、Small model + 强 orchestration、MCP 生态。
- **前端角色：** AI Native UI（流式、工具可视化、人机协作）成为差异化。

### 与前端工程结合的角度

- 前端从「渲染 CRUD」扩展到「编排人机协作体验」；Streaming UX、乐观更新、cancel 是一级能力。
- 可谈 CopilotKit、Vercel AI SDK 等降低 Agent UI 构建成本。

### 面试加分项

- 引用具体产品观察（Cursor、Devin、企业微信智能助手等）而非空泛「AI 改变世界」。
- 诚实谈局限：幻觉、监管、就业结构变化。

---

## Agent 效果如何评估？

**来源：** 某大厂 AI 岗一面面经、快手AI Agent开发一面（RAG/Agent eval 部分交叉）

### 核心要点

- **任务级：** 成功率、步骤数、耗时、成本（token / API call）。
- **质量级：** 人工评分、LLM-as-Judge、与 golden answer 对比（ROUGE / 语义相似度）。
- **工具级：** tool selection accuracy、参数合法率、调用成功率。
- **安全级：** 注入抵抗、越权操作率。
- **持续 eval：** 线上采样 + 离线 benchmark 回归。

### 与前端工程结合的角度

- 前端埋点：用户 thumbs up/down、重新生成率、人工接管率。
- Eval 结果可视化 dashboard 给 PM / 算法看。

### 面试加分项

- 提到 Braintrust、LangSmith、Arize 等 observability 工具。
- 区分 offline eval vs online A/B。
