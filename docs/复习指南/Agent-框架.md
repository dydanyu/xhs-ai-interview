# Agent 框架

> 面向资深前端 → AI Agent 转型求职

---

## Function Calling 是怎么设计的？

**来源：** 快手AI Agent开发一面

### 核心要点

- **Schema 定义：** name、description、parameters（JSON Schema：type、required、enum、examples）。
- **调用流程：** 模型返回 tool_calls → 后端解析校验 → 执行工具 → tool result 消息回填 → 模型继续生成。
- **并行调用：** 支持一次返回多个 independent tool calls。
- **可靠性：** JSON mode、Zod 校验、retry with error message、默认值兜底。

### 与前端工程结合的角度

- 用 TypeScript + zod 定义 tool，前后端共享类型；OpenAI SDK 的 `tools` 数组与 UI 工具列表同步。
- 前端展示 pending tool call 卡片，用户可 approve / reject（Human-in-the-loop）。

### 面试加分项

- 对比 OpenAI tools vs Anthropic tool_use vs MCP 协议。
- 说明 strict mode / structured outputs 减少 parse 失败。

```typescript
// Zod → JSON Schema → OpenAI tools，前后端共享契约
const searchSchema = z.object({ query: z.string(), limit: z.number().max(20).default(5) });
const tools = [{ type: "function", function: {
  name: "search_kb", parameters: zodToJsonSchema(searchSchema)
}}];
```

---

## 如何保证 Agent 调用工具（Function Calling）的可靠性？

**来源：** 2026大模型Agent面试全攻略（下）

### 核心要点

- **语法层：** JSON Mode、Structured Output、Pydantic / Zod 校验。
- **逻辑层：** 参数范围检查、业务规则（如 id 必须存在）；高风险操作 Human-in-the-loop 确认。
- **自愈：** 校验失败将 error 返回 LLM self-heal，限 retry 2 次。
- **可观测：** 记录每次 call 的 raw args、latency、success rate。

### 与前端工程结合的角度

- 删库 / 转账类操作弹 Modal 二次确认，确认后才真正 dispatch tool。
- 工具失败时在 UI 提供「重试 / 修改参数 / 跳过」而非整会话失败。

### 面试加分项

- 提到 idempotency key 防重复提交。
- 量化：参数合法率从 85% → 98% 的优化路径（schema + few-shot + fine-tune）。

---

## 怎么让模型老老实实调用工具，不瞎编参数？

**来源：** 分享一下我面试Agent岗位时被问到的问题

### 核心要点

- **首选 native function calling：** 结构化输出，非自由文本 JSON。
- **Fallback：** 详尽 tool 定义 + 强制 JSON prompt + regex / json schema 校验 + retry ≤2。
- **后端兜底：** 关键参数 default、服务端补全、非法则拒绝执行。
- **少即是多：** 一次只暴露相关工具，减少混淆。

### 与前端工程结合的角度

- 表单预填 tool 参数让用户改，而非全信模型输出（high-stakes 场景）。
- DevTools 面板高亮 parse 失败次数辅助 prompt 迭代。

### 面试加分项

- 举例：日期参数统一 ISO8601；enum 限制 action 类型。
- 提到 constrained decoding（Outlines、guidance）工程方案。

---

## LangChain、AutoGen 了解多少？为什么偏向手写 Agent 而非复用框架？

**来源：** 字节AI Agent后端面经

### 核心要点

- **LangChain：** 组件多（chain、agent、retriever）；上手快，抽象层厚，debug 难，版本变动大。
- **AutoGen：** 多 Agent 对话强；微软生态。
- **LangGraph：** 显式 state machine + checkpoint，生产可控性更好。
- **大模型网关：** LiteLLM / OneAPI / 自研 gateway 统一多模型路由，与框架编排层分工（网关管接入，LangGraph 管状态）。
- **手写原因：** 业务定制深、依赖最小化、trace 清晰、避免过度抽象；框架做原型，核心链路自研。

### 与前端工程结合的角度

- 前端类比：框架像 heavy UI library，手写像 headless + 自研 design system——可控 vs 速度 tradeoff。
- 无论框架与否，对外 API 契约（SSE 事件格式）应稳定。

### 面试加分项

- 不极端否定框架：「PoC 用 LangChain，生产核心用 LangGraph 或自研 state graph」。
- 提到 LlamaIndex 在 RAG 侧的定位。

---

## LangGraph 中的「节点（Node）」和「边（Edge）」与传统工作流有何不同？

**来源：** 2026大模型Agent面试全攻略（下）

### 核心要点

- **传统工作流：** 边固定，DAG 无环，路径编译期确定。
- **LangGraph：** 节点是函数 / LLM call；**条件边**由 LLM 输出或 state 决定下一跳。
- **支持环：** Agent retry 直到 success 或 max_iter——这是 Agent 与传统 BPM 的核心差异。
- **Checkpoint：** 状态持久化，支持 interrupt / resume / Human-in-the-loop。

### 与前端工程结合的角度

- 可视化编排器可展示 LangGraph 图结构；前端根据 node 类型渲染不同 status icon。
- interrupt 节点对应 UI 等待用户输入再继续。

### 面试加分项

- 画 simple graph：router → agent → tools → agent → END。
- 对比 Temporal / Airflow：后者不适合 LLM 非确定性分支。

---

## Agent 中的 Skill 和传统函数 / API 有什么本质区别？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **函数 / API：** 确定性输入输出，开发者完全定义逻辑，机器精确调用。
- **Skill：** 面向 LLM 的「能力包」——含自然语言描述、使用场景（when_to_use）、多步骤 SOP、可能含 LLM 子调用；由 Agent **语义路由**选择，非硬编码 call graph。
- **Skill = 可复用的 Agent 子程序 + 文档化意图**，介于 prompt 与 code 之间。

### 与前端工程结合的角度

- Skill 目录可在 UI 展示为「能力市场」；用户勾选启用哪些 skill。
- 前端工程师可编写 Skill（markdown SOP + 工具绑定），类似 Cursor Rules。

### 面试加分项

- 关联 Claude Skills、OpenAI GPTs actions 等产品形态。
- 举例自己写的 Skill：如「Metis 建子任务」Skill 解决什么痛点。

---

## PE、Rule、Skill 和 MCP 如何协同？用户请求完整链路？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

1. **Rule：** 硬规则拦截（权限、关键词、合规）— 最先执行。
2. **PE（Prompt Engineering）：** System prompt 定角色、格式、约束。
3. **Skill 路由：** 根据意图匹配 when_to_use，选中 Skill SOP。
4. **MCP：** 标准化外部工具协议（文件、DB、API）；Skill 步骤内通过 MCP 调工具。
5. **输出：** LLM 汇总 → 校验 → 返回用户。

### 与前端工程结合的角度

- Rule 对应前端 route guard + backend middleware 双层。
- MCP tools 列表可在设置页配置（server URL、auth）。

### 面试加分项

- 画 sequence diagram：User → Gateway → Rule → Router → Skill → MCP tools → Response。
- 说明 MCP 解决 N×M 工具集成问题。

---

## Skill 执行失败时的失败处理与兜底机制？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **结构化错误：** 返回 error type、message、retryable flag。
- **重试策略：** 幂等步骤可 retry；非幂等需 skip 或人工确认。
- **Fallback Skill / 降级：** 主 Skill 失败切简化版或纯文本回答。
- **Circuit breaker：** 连续失败暂停该 Skill，告警运维。
- **用户侧：** 明确告知哪步失败、已保存的 partial result。

### 与前端工程结合的角度

- Toast + inline error + 「重试此步骤」按钮；partial result 保留在表单避免用户重填。

### 面试加分项

- Saga 模式处理多步 Skill 补偿。
- 日志带 skill_id、step_index 便于排查。

---

## 什么样的任务适合沉淀为 Skill？什么不适合？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **适合：** 重复出现、步骤相对固定、需领域 SOP、跨多个 API、团队需复用最佳实践（Code Review、发布 checklist、建 Metis 子任务）。
- **不适合：** 一次性的、纯Creative无标准、强实时毫秒级、逻辑完全可代码化且无 NL 路由价值。
- **判断标准：** 调用频率、失败成本、是否需 NL 意图识别、是否需人在环。

### 与前端工程结合的角度

- 前端重复操作流程（发版、填周会文档）适合 Skill 化；纯计算用普通函数即可。

### 面试加分项

- 举真实 Skill 案例（越具体越好）。
- 说明 Skill 版本管理与 deprecated 策略。

---

## Skill 的 when_to_use 如何设计以最大化意图识别准确率？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **清晰边界：** 写「什么时候用」+「什么时候不用」+ 正例 / 反例。
- **关键词 + 语义：** 覆盖用户多种说法；避免过于宽泛（「帮助用户」）。
- **互斥描述：** 与其他 Skill 差异化，减少 overlap。
- **Eval 驱动：** 用意图分类测试集迭代 when_to_use 文案。

### 与前端工程结合的角度

- UI 可显式让用户选 Skill（绕过路由），提高确定性。
- 搜索框 placeholder 提示可用能力，间接对齐 when_to_use。

### 面试加分项

- 两阶段路由：cheap classifier → skill subset → LLM 精选。
- embedding 相似度预筛 when_to_use 描述。

---

## 两个 Skill 的 when_to_use 重叠时 Agent 如何决策？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **优先级：** 显式 priority / specificity 规则（更具体的 Skill 优先）。
- **Clarification：** 模型 ask user 二选一。
- **Ensemble 禁止：** 默认只选一个 Skill 执行，避免混乱。
- **Meta-router：** 小模型或规则做 disambiguation。
- **长期：** 合并重叠 Skill 或拆细边界。

### 与前端工程结合的角度

- 歧义时 UI 展示两个卡片让用户点选意图。
- Analytics 记录 overlap 冲突率驱动 Skill 文档优化。

### 面试加分项

- 引用 intent classification metrics（precision@1）。
- 说明 A/B 不同路由策略。

---

## Skill 某步骤中需要复杂逻辑判断（if/else、for loop）如何实现？

**来源：** 后端要掌握的 AI 八股：Skill 及面试题

### 核心要点

- **原则：** 复杂逻辑放代码，不放 prompt；LLM 做决策，代码做执行。
- **实现：** Skill 步骤绑定 script / server function；或用 LangGraph code node。
- **LLM 只输出 structured decision**（如 `{ "branch": "A", "items": [...] }`），引擎执行 loop。
- **反模式：** 让 LLM 在文本里「假装执行 for 循环」——不可靠。

### 与前端工程结合的角度

- 前端工程师最熟悉：业务逻辑用 TypeScript 写，Skill markdown 只描述何时触发、调用哪个 handler。
- 可视化流程编辑器中「代码块节点」vs「LLM 节点」分离。

### 面试加分项

- 举例：批量处理 1000 条数据 — for loop 在 code node，LLM 只生成 filter 条件。
- 提到 Temporal / Inngest 做 durable execution。

---

## RAG 整体链路是什么？落地最大难点？

**来源：** 字节AI Agent后端面经

### 核心要点

- **链路：** 文档 ingest → 清洗 → chunk → embed → 索引 → query 改写 → 检索（向量 + BM25）→ rerank → context 组装 → LLM 生成 → 后处理（ citation ）。
- **最大难点：** 检索质量（chunk、embedding、hybrid search）> 生成；以及 eval 体系、数据更新、权限过滤、延迟成本平衡。

### 与前端工程结合的角度

- 上传文档、选知识库、查看引用来源都是前端核心体验。
- 检索空结果时前端友好提示 + 建议换关键词。

### 面试加分项

- Agentic RAG：Agent 决定何时检索、检索什么 query、是否 multi-hop。
- 项目量化：Recall@5、answer faithfulness。

---

## 文本文档切割有哪些策略？如何避免破坏完整语义？

**来源：** 字节AI Agent后端面经、某大厂 RAG+Agent 面经

### 核心要点

- **策略：** 固定长度 + overlap；按段落 / 标题；递归字符切分；语义切分（embedding 断点）；结构感知（Markdown/HTML 标题树）。
- **保语义：** overlap 10–20%；不在句子中间切；父 chunk 存全文 context、子 chunk 检索（**父子索引**）。
- **领域：** 法律合同按条款切；代码按函数切；表格单独处理。

### 与前端工程结合的角度

- 文档预览 UI 显示 chunk 边界（调试模式），帮助运营调整策略。
- 用户 highlight 段落「仅检索此段」= 动态 chunk 选择。

### 面试加分项

- 提到 Late Chunking、Contextual Retrieval（Anthropic）。
- 法律场景举例：法条 + 释义不拆散。

---

## 为什么引入父子索引（Parent-Child Index）？

**来源：** 快手AI Agent开发一面

### 核心要点

- **问题：** 小 chunk 检索准但 context 不足；大 chunk context 足但检索噪声大。
- **方案：** 子 chunk（小）建索引用于检索；命中后返回父 chunk（大）给 LLM 生成。
- **效果：** 兼顾 recall 精度与 generation context 完整。

### 与前端工程结合的角度

- 引用溯源 UI 可定位到子 chunk 精确位置，展示时展开父段落。

### 面试加分项

- LlamaIndex / LangChain 的 ParentDocumentRetriever 实现。
- 说明 parent 也可多级（层级摘要树）。

---

## 为什么在检索阶段引入 BM25？

**来源：** 快手AI Agent开发一面

### 核心要点

- **向量检索弱点：** 专有名词、数字、缩写、精确匹配差。
- **BM25 优势：** 稀疏检索、keyword 精确、可解释。
- **Hybrid Search：** 向量 + BM25 分数融合（RRF、加权）；enterprise RAG 标配。

### 与前端工程结合的角度

- 搜索框关键词高亮依赖 BM25 侧 hit；混合搜索提升「搜工号 / 搜法条号」体验。

### 面试加分项

- RRF（Reciprocal Rank Fusion）公式简述。
- 说明 Elasticsearch / OpenSearch hybrid 配置经验。

---

## rerank 后一般返回几个块？topK 截断怎么做？

**来源：** 快手AI Agent开发一面（Q3 rerank 返回块数 + Q4 topK 截断）

### 核心要点

- **典型值：** rerank 后取 top 3–8 chunks 进 context；视 chunk 大小与 context window 而定。
- **流程：** 召回 top 20–50 → rerank → 取 topK → token budget 截断（累计不超 budget）。
- **topK 截断算法：** 按 rerank 分数降序累加 chunk token 数，直到触达 context budget 上限；尾块可截断或丢弃。
- **动态 K：** 第一名与第二名分差大（gap > θ）时减少 K 避免噪声；分数密集时多取；设 `min_score` 过滤低质 chunk，全低于阈值则走「未检索到」拒答路径。

### 与前端工程结合的角度

- 「深度搜索」模式可增大 K 换更全答案，UI 切换 latency 预期。

### 面试加分项

- 提到 Cohere Rerank、bge-reranker。
- 给出项目参数：recall 30 → rerank 5 → 共 2k tokens context。

---

## 多路召回如何实现？向量库选型与 Qdrant 性能短板？

**来源：** 字节AI Agent后端面经

### 核心要点

- **多路召回：** 不同 embedding 模型、不同 chunk 策略、BM25、HyDE、query expansion 并行召回 → merge dedupe → rerank。
- **向量库对比：** Milvus（规模）、Pinecone（托管）、Weaviate（混合）、pgvector（简单）、Qdrant（Rust、过滤强）。
- **Qdrant 短板：** 超大规模集群经验少、部分高级特性不如 Milvus、极端 QPS 需调优 HNSW 参数。

### 与前端工程结合的角度

- 多路召回对用户透明；前端只感知 P95 延迟，需 loading 策略。

### 面试加分项

- 说明 filter（tenant_id、doc_type）在检索层的必要性。
- 私有化选型矩阵（成本 / 运维 / 规模）。

---

## Embedding 模型如何选型？检索参数如何确定？

**来源：** 某大厂 RAG+Agent 面经

### 核心要点

- **选型：** 语言匹配、MTEB、维度、延迟、license、是否与 reranker 配套。
- **检索参数：** topK、similarity threshold、HNSW ef_search、hybrid alpha 权重——靠 eval 集 grid search。
- **Query side：** query instruction prefix（bge 系列）；必要时 query rewrite。

### 与前端工程结合的角度

- A/B 不同检索配置可通过 feature flag 在前端分流（内部 dogfood）。

### 面试加分项

- 固定 eval set 回归每次改参数。
- 说明 embedding 模型升级需 re-index 成本。

---

## 知识库规模如何设计？Chunk 策略如何确定？

**来源：** 某大厂 RAG+Agent 面经

### 核心要点

- **规模：** 按 QPS、延迟、成本估算；冷热分层（热数据 SSD / 内存）；分 tenant 分 collection。
- **Chunk：** 从 eval 反推——扫 chunk size 256/512/1024 + overlap；以 Recall@K 和 answer quality 选最优。
- **增量更新：** 文档版本号、增量 embed、删除 stale vector。

### 与前端工程结合的角度

- 知识库管理后台：文档数、索引状态、上次同步时间——前端运营面板。

### 面试加分项

- 百万级文档的 sharding 策略。
- 说明 catalog vs content 分离索引。

---

## 法律场景下如何保证 RAG 语义完整性？

**来源：** 某大厂 RAG+Agent 面经

### 核心要点

- **结构切分：** 按法条编号、章节；条款 + 释义绑定 parent-child。
- **元数据：** 法规名称、生效日期、版本；检索 filter 避免废止法条。
- **引用强制：** 回答必须带条文编号；无检索 hit 则拒答。
- **人在环：** 法律意见 disclaimer + 专业人士复核。

### 与前端工程结合的角度

- 答案旁展示法条原文折叠 panel；版本对比 UI（2023 vs 2024 修订）。

### 面试加分项

- 法律 NLP 专用 eval（LegalBench 等）。
- 说明「条号 OCR 错误」清洗经验。

---

## 如果要提升 RAG 相关度，你会怎么做？

**来源：** 快手AI Agent开发一面

### 核心要点

- **数据：** 清洗噪声、去重、元数据 enrich。
- **Chunk / 索引：** 优化切分、父子索引、hybrid + rerank。
- **Query：** rewrite、HyDE、multi-query。
- **Embedding / Reranker：** 换更强模型或 domain fine-tune。
- **Feedback loop：** 点击日志、bad case 标注迭代。

### 与前端工程结合的角度

- thumbs down 收集 bad query → 进入标注队列。
- 相关度低时 UI 建议「缩小知识库范围」。

### 面试加分项

- 量化 Recall@5 提升路径。
- Agentic：让 Agent 判断是否检索不足并 reformulate query。

---

## 如果要优化 RAG 回答效果，有哪些思路？

**来源：** 快手AI Agent开发一面

### 核心要点

- **检索侧：** 见「提升相关度」。
- **生成侧：** 更好的 prompt（仅基于 context、引用格式）、更强 LLM、context 压缩排序。
- **后处理：** citation 校验、faithfulness check、二次 LLM 验证。
- **架构：** Agentic RAG、Self-RAG、Corrective RAG（CRAG）。

### 与前端工程结合的角度

- 流式先出引用再出答案；允许用户「仅看原文不生成」。

### 面试加分项

- 区分 optimization 检索 vs 生成 vs 端到端。
- 项目 before/after 用户满意度数据。

---

## RAG 的性能如何提升？

**来源：** 快手AI Agent开发一面

### 核心要点

- **索引：** HNSW 参数调优、量化（PQ）、GPU embed batch。
- **缓存：** query embedding 缓存、热门 query 结果缓存。
- **流水线：** 异步 ingest、预计算、增量索引。
- **架构：** 小模型 rerank、early exit（高 confidence 跳过 rerank）、CDN 静态 FAQ。
- **成本：** 缩小 K、缩短 chunk、蒸馏 small LLM 做 draft。

### 与前端工程结合的角度

- 骨架屏 + 分阶段 SSE（先「找到 3 条参考」再生成）。
- Service Worker 缓存 FAQ 静态答案。

### 面试加分项

- P95 latency 分解：embed / retrieve / rerank / generate 各占多少 ms。
- 说明 batch ingest 与 online query 资源隔离。

---

## 当前的上下文（Context）是如何处理的？

**来源：** 快手AI Agent开发一面

### 核心要点

- **组装顺序：** system → retrieved chunks（带编号）→ tool defs → trimmed history → user query。
- **预算管理：** 预留 generation tokens；chunks 按 rerank score 填充至 budget。
- **去噪：** 去重相似 chunk、strip HTML、metadata 精简。
- **动态：** 简单 query 少检索；复杂 query multi-hop 追加检索。

### 与前端工程结合的角度

- @引用、选文件即影响 context assembly API payload。
- 开发者模式显示 context token 占用条。

### 面试加分项

- Lost in the middle 缓解策略。
- 与「上下文工程」概念统一回答。

---

## RAG 系统如何评测？有哪些评测维度？评测数据集包括什么？

**来源：** 快手AI Agent开发一面、某大厂 RAG+Agent 面经

### 核心要点

- **检索指标：** Recall@K、MRR、nDCG、Hit Rate。
- **生成指标：** Faithfulness、Answer Relevance、Context Precision / Recall（RAGAS）。
- **端到端：** 人工评分、LLM-as-Judge、任务成功率。
- **数据集：** query + relevant doc ids + golden answer（+ 负样本）；覆盖简单 / 多跳 / 否定问题；定期从线上采样。
- **Baseline：** 纯 LLM 无 RAG、BM25 only、旧版 pipeline 对比。

### 与前端工程结合的角度

- 内部 eval dashboard；bad case 浏览器供标注团队使用。

### 面试加分项

- RAGAS、TruLens、DeepEval 框架。
- 说明 regression gate：eval 下降 blocking release。

---

## Recall 指标如何评估？Baseline 如何设计？

**来源：** 某大厂 RAG+Agent 面经

### 核心要点

- **Recall@K：** 标准答案相关 doc 是否出现在 top-K 检索结果中。
- **标注：** 需人工或 LLM 辅助标 relevant chunks；注意 multi-relevant。
- **Baseline：** （1）无 RAG（2）单路向量（3）无 rerank（4）旧 embedding——逐级 ablation 证明每块收益。

### 与前端工程结合的角度

- 可视化 Recall 曲线选 K 值给 PM 看 tradeoff。

### 面试加分项

- 区分 chunk-level vs document-level recall。
- 线上 proxy metric：用户点击引用率。

---

## 测试集如何构建（RAG / Agent）？

**来源：** 某大厂 RAG+Agent 面经

### 核心要点

- **来源：** 线上真实 query 采样、PM 梳理 FAQ、边界 / 对抗 case 人工构造。
- **结构：** input、expected sources、expected answer、tags（难度、类型）。
- **规模：** 初期 50–200 条即可迭代；覆盖 regression 关键路径。
- **维护：** 版本化；新 bug 变新 case；避免 train-test 泄漏（不用测试 query 调参到过拟合）。

### 与前端工程结合的角度

- 从用户 feedback UI 一键「加入 eval 集」。

### 面试加分项

- 合成数据（generate query from doc）扩增但需人工 spot check。
- 分层抽样：简单 60% +  hard 40%。
