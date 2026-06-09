# LLM 基础

> 面向资深前端 → AI Agent 转型求职

---

## 大模型整体训练流程是什么？Transformer 编码器与解码器有何区别？

**来源：** 字节AI Agent后端面经

### 核心要点

- **训练流程：** 预训练（海量无标注文本，next-token prediction）→ SFT（指令微调）→ RLHF / DPO（对齐人类偏好）→ （可选）领域微调 / LoRA。
- **Encoder：** 双向 self-attention，擅长理解（BERT 类）；输出 contextualized representation。
- **Decoder：** 因果 mask（只看左侧），自回归生成（GPT 类）；Agent 应用几乎都用 Decoder-Only。
- **Encoder-Decoder：**  seq2seq（T5、BART），适合翻译、摘要；现代 Agent 较少直接用。

### 与前端工程结合的角度

- 前端调用的是推理 API，需理解 latency 来自 autoregressive 逐 token 生成 → 必须做 streaming。
- 选型时知道「Agent 用 GPT/Qwen/Claude 等 decoder-only」，不必深卷 encoder 架构除非做 RAG embedding。

### 面试加分项

- 能画 simplified 训练 pipeline 图。
- 说明为什么 Chat 模型都是 decoder-only + instruction tuning。

---

## Function Calling 的训练逻辑与主流微调方案？

**来源：** 字节AI Agent后端面经

### 核心要点

- **FC 能力来源：** 预训练 + SFT 中加入 tool call 格式样本 + （部分模型）专项 tool-use 微调；模型学习输出 structured tool invocation JSON。
- **主流微调：** Full FT（贵）、LoRA / QLoRA（省显存）、DPO 对齐工具调用偏好；OpenAI 等闭源模型由厂商完成，应用层主要做 prompt + schema。
- **应用侧：** 不靠微调也能用 JSON schema + 强 prompt + 校验 retry 达到生产可用。

### 与前端工程结合的角度

- 前端 TypeScript 类型可自动生成 tool JSON schema（zod-to-json-schema），与模型 FC 对齐。
- 微调是后端 / ML 团队职责；前端关注 schema 版本与 API 契约稳定。

### 面试加分项

- 提到 Glaive、ToolBench 等 tool-use 数据集。
- 区分 native function calling vs prompt-based JSON mode。

---

## 分词器（Tokenizer）与 Embedding 基础？项目里如何选型？

**来源：** 字节AI Agent后端面经

### 核心要点

- **Tokenizer：** 文本 → token IDs；BPE / SentencePiece 子词切分；中文需注意 token 效率（同句中文 token 数常多于英文）。
- **Embedding：** 文本 → 稠密向量；用于语义检索、聚类；与 LLM 内部 embedding 层不同（常指检索模型如 bge、text-embedding-3）。
- **选型原则：** 与目标语言匹配、维度与向量库兼容、MTEB 榜单、延迟与成本、是否开源可私有化。

### 与前端工程结合的角度

- 前端输入框应提示字数 / token 估算（防超限）；多语言 UI 考虑 tokenizer 差异。
- Embedding 选型影响 RAG 召回，前端「搜索建议」体验间接依赖。

### 面试加分项

- 说明 query / document 非对称 embedding（bge 的 cls 前缀技巧）。
- 同一 embedding 模型贯穿索引与检索，避免 train-serve skew。

---

## Transformer 自注意力机制如何工作？为何比 RNN 更适合长序列？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **Self-Attention：** Q、K、V 矩阵；Attention(Q,K,V)=softmax(QK^T/√d)V；每个 token 加权聚合全局信息。
- **vs RNN：** 并行计算、路径长度 O(1) 捕获长依赖；RNN 顺序计算、梯度消失限制长程。
- **代价：** O(n²) 复杂度 → 长 context 贵；FlashAttention、稀疏注意力等优化。

### 与前端工程结合的角度

- 理解 O(n²) 帮助解释「为什么塞太长 context 又慢又贵」——产品上要帮用户控制输入长度。
- 不需要手写 attention，但 debug 长文档 RAG 时要考虑 chunk 数量与 context 关系。

### 面试加分项

- Multi-Head Attention 动机：多子空间捕获不同关系。
- 提到 KV Cache 加速推理（Agent 多轮对话成本关键）。

---

## 什么是位置编码？为何必需？常见实现方式？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **原因：** Self-attention 置换不变，需注入 token 顺序信息。
- **绝对位置编码：** 可学习向量或 sin/cos 固定编码（原始 Transformer）。
- **相对位置：** 关注 token 间距离（T5 bias、ALiBi）。
- **RoPE：** 旋转位置编码，相对位置外推性好，Llama/Qwen 等主流采用。

### 与前端工程结合的角度

- 纯应用层影响小；了解 RoPE 有助于理解 context length 扩展（YaRN、NTK aware scaling）。

### 面试加分项

- RoPE 通过复数旋转编码相对位置，外推性优于绝对 PE。
- 区分 max_position_embeddings 与实际可用 context。

---

## 详细介绍 RoPE，对比绝对位置编码的优劣势？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **RoPE 原理：** 将 Q/K 按维度两两旋转，角度与位置成正比；内积自然编码相对距离。
- **优势：** 相对位置归纳偏置、长文本外推较好、与 FlashAttention 兼容好。
- **劣势：** 超长外推仍需 YaRN 等技巧；实现比绝对 PE 稍复杂。

### 与前端工程结合的角度

- 选支持长 context 的模型（128K+）时，RoPE 扩展是后端选型依据，前端展示「支持 xx 字文档」。

### 面试加分项

- 引用 RoFormer 论文；说明 Llama 3 的 context 扩展方案。

---

## MHA、MQA、GQA 的区别？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **MHA（Multi-Head Attention）：** 每个 head 独立 Q/K/V；表达力强，KV cache 大。
- **MQA（Multi-Query Attention）：** 多 Q 共享一组 K/V；推理快、cache 小，质量略降。
- **GQA（Grouped-Query Attention）：** MHA 与 MQA 折中，多 Q 共享多组 K/V；Llama 2/3 采用。

### 与前端工程结合的角度

- 推理延迟与 KV cache 直接影响 Agent 多轮对话 TTFT；GQA 是工程与质量平衡的主流选择。

### 面试加分项

- 量化：MQA 可显著降低 KV cache 显存占用。
- 说明训练 MHA、推理可 GQA 的 uptraining 技术。

---

## Encoder-Only、Decoder-Only、Encoder-Decoder 架构比较？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

| 架构 | 代表 | 擅长 |
|------|------|------|
| Encoder-Only | BERT | 分类、NER、embedding |
| Decoder-Only | GPT、Qwen | 生成、对话、Agent |
| Encoder-Decoder | T5、BART | 翻译、摘要、seq2seq |

- **Agent 主流：** Decoder-Only + tools + RAG。

### 与前端工程结合的角度

- RAG embedding 常用 encoder 模型；对话生成用 decoder；前端架构上可能是两个 API。

### 面试加分项

- 说明 UL2、Flan-T5 等在特定任务仍有用。

---

## 什么是 Scaling Laws？对 LLM 研发有何指导？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **关系：** 损失与模型参数量、数据量、算力呈幂律关系；更大模型 + 更多数据 → 可预测提升。
- **指导：** 算力预算固定时平衡 model size vs data size（Chinchilla 定律：应投更多 data）。
- **局限：** 推理成本、边际收益递减；应用层常「小模型 + RAG + Agent」更经济。

### 与前端工程结合的角度

- 产品选型不盲目追最大模型；Scaling Laws 支持「够用就好」的成本论证。

### 面试加分项

- Kaplan vs Chinchilla 观点差异。
- Agent 场景：小模型 + 强 orchestration 的 counter-trend。

---

## 推理阶段常见解码策略：Greedy、Beam Search、Top-K、Top-P？

**来源：** 算法面经 LLM&Agent八股总结、字节AI Agent后端面经

### 核心要点

- **Greedy：** 每步取最高概率 token； deterministic、易重复。
- **Beam Search：** 保留 top-B 路径；适合翻译等，对话 Agent 少用（多样性差）。
- **Top-K：** 从概率 top K 中采样；K 小更保守。
- **Top-P（Nucleus）：** 从累积概率达 P 的最小集合采样；动态候选集，常用。
- **Temperature：** 缩放 logits；低温度更确定（工具调用），高温度更有创意（文案）。

### 与前端工程结合的角度

- 前端「创意度」滑块映射 temperature / top_p。
- Agent tool call 场景建议低 temperature + JSON mode。

### 面试加分项

- 业务配置示例：代码生成 temperature 0–0.2；头脑风暴 0.7–0.9。
- 说明 repetition penalty 防循环输出。

---

## 词元化是什么？BPE 与 WordPiece 比较？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **子词切分：** 平衡 OOV 与词表大小；高频 merge 成 subword。
- **BPE：** 字节级 merge，GPT 系常用；简单高效。
- **WordPiece：** 类似 BPE，merge 准则基于 likelihood；BERT 常用。
- **SentencePiece：** 语言无关，直接 raw text；多语言模型常用。

### 与前端工程结合的角度

- 中文 prompt 同样字数 token 更多 → 计费与 limit 展示要基于 token 非字符。

### 面试加分项

- 说明 byte-level BPE 对 emoji、代码友好。

---

## NLP 与 LLM 的最大区别？共同与不同？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **NLP 时代：** 任务专用模型（分类、NER、MT 各训各的）、特征工程、pipeline 拼装。
- **LLM 时代：** 通用预训练 + prompt / 微调统一多任务； emergent 能力； in-context learning。
- **共同：** 都处理自然语言；评估仍关注 accuracy、F1、BLEU 等（视任务而定）。
- **不同：** LLM 规模、生成式、上下文学习、Agent 范式。

### 与前端工程结合的角度

- 老 NLP 是「选模型 + 调 API」；LLM 是「设计 prompt + 工具 + 工作流」——前端交互设计空间更大。

### 面试加分项

- 不贬低传统 NLP：小模型在分类、边缘部署仍有优势。

---

## 如何理解大模型的「涌现能力」？通常在什么规模出现？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **定义：** 模型规模跨过阈值后，能力非线性突现（如 CoT、算术、指令遵循）。
- **规模：** 粗略在数十亿参数以上部分能力才稳定；具体因任务而异（有争议）。
- **争议：** 部分研究认为 metric 非连续假象；工程上仍观察到「大模型更好用 tool」。

### 与前端工程结合的角度

- 产品能力标注要诚实：小模型 + Agent 框架 ≠ 大模型 emergent reasoning。

### 面试加分项

- 引用 Wei et al. emergent abilities 论文同时提 critical view。

---

## LLM 常用激活函数及选用原因？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **ReLU / GELU：** 早期 Transformer 用 GELU（平滑、概率门控解释）。
- **SwiGLU：** Swish + GLU 门控；Llama、PaLM 等采用；表达力与训练稳定性更好。
- **选用：** 多为 empirically 在预训练规模验证；应用开发者无需改激活函数。

### 与前端工程结合的角度

- 了解即可；面试算法岗可能深挖，Agent 应用岗点到为止。

### 面试加分项

- SwiGLU 增加 FFN 参数量但提升 quality per compute。

---

## 混合专家模型（MoE）如何扩大参数又控制推理成本？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **原理：** 多个 Expert FFN + Router 网络；每 token 只激活 top-K 个 expert（sparse activation）。
- **效果：** 总参数量大但 active 参数少 → 训练能力↑、推理 FLOPs 可控。
- **代表：** Mixtral、DeepSeek-V2/V3、GPT-4 传闻 MoE。
- **挑战：** 负载均衡、通信开销、部署复杂。

### 与前端工程结合的角度

- API 定价可能按 active tokens；MoE 对延迟波动有影响（routing 不均）。

### 面试加分项

- 说明 auxiliary load balancing loss。
- DeepSeek 开源 MoE 对 Agent 成本优化的意义。

---

## 训练百亿 / 千亿参数 LLM 的主要工程与算法挑战？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **显存：** 参数 + optimizer states + activation → 3D 并行（数据 / 张量 / 流水线）。
- **通信：** 多卡 / 多机带宽瓶颈；梯度同步。
- **稳定性：** loss spike、混合精度、梯度裁剪。
- **数据：** 清洗、去重、版权、多语言配比。
- **Agent 开发者：** 通常不训练基座，但懂这些有助于理解 API 限制与成本。

### 与前端工程结合的角度

- 理解「为什么不能随便微调 70B」→ 推动 LoRA / 蒸馏 / RAG 方案。

### 面试加分项

- ZeRO、FSDP 等显存优化名词。
- 说明 RLHF 阶段 reward hacking 风险。

---

## 开源框架与 Qwen、DeepSeek 的创新点？（概览）

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **框架：** transformers、vLLM、llama.cpp、LangChain / LangGraph（应用编排）。
- **Qwen：** 多语言、长 context、强 tool call、开源尺寸全。
- **DeepSeek：** MoE 架构、MLA 注意力、训练成本低、推理优化、R1 推理链。
- **创新点：** 架构效率（MoE/MLA）、数据与训练 recipe、对齐方法（GRPO 等）。

### 与前端工程结合的角度

- 前端通过 OpenAI-compatible API 切换 Qwen / DeepSeek；关注 streaming、function call 字段兼容性。

### 面试加分项

- 读过 R1 技术报告能聊 GRPO vs PPO。
- 结合实际项目说为什么选 Qwen2.5 32B 而非 GPT-4o（成本 + 私有化）。

---

## 如何抑制大模型幻觉？RAG 与微调各自适用场景？

**来源：** 字节AI Agent后端面经

### 核心要点

- **抗幻觉手段：** RAG  grounding、引用溯源、citation 强制、低 temperature、Self-consistency、事实校验工具、Human review。
- **RAG 适用：** 知识频繁更新、需溯源、无足够标注数据、多文档 QA。
- **微调适用：** 固定风格 / 格式、领域术语深度内化、低延迟专有 small model、行为对齐。
- **组合：** RAG + 轻量 SFT 是 enterprise 常见方案。

### 与前端工程结合的角度

- UI 展示引用来源（chunk 链接、页码）让用户验证。
- 无检索命中时 UI 明确「未找到依据」而非静默编造。

### 面试加分项

- 区分 hallucination vs confabulation；提到 faithfulness metric。
- 项目数据：RAG 后幻觉率下降 xx%。

---

## 最近读过哪些 LLM 前沿论文？如何结构化回答？

**来源：** 算法面经 LLM&Agent八股总结

### 核心要点

- **回答模板：** 问题（解决什么）→ 方法（核心创新）→ 实验（baseline 对比）→ 与自身项目关联。
- **可准备 2–3 篇：** 如 DeepSeek-R1（RL 推理链）、Llama 3 技术报告（长 context / 多语言）、Self-RAG（检索决策）、Qwen2.5 technical report（tool call）。
- **不必堆砌：** 面试官要的是理解深度，不是 bibliography 长度。
- **诚实：** 没读过可说「关注 R1 推理链方向，读了 blog / 解读，完整 paper 在读」。

### 与前端工程结合的角度

- 选与 Agent 相关的读：tool use、RAG、eval；面试时落到「这对我们 product 的 streaming / HITL 设计有启发」。

### 面试加分项

- 对比 2 篇 paper 方法 tradeoff（如 RLHF vs GRPO 成本）。
- 说明复现或用小数据集验证过某个 idea。

---

## Text2SQL / NL2SQL 如何提升识别准确率？

**来源：** 字节AI Agent后端面经、外某企 agent 面经

### 核心要点

- **Schema 注入：** 只给相关表 / 列（schema linking）；DDL + 样例行 + 业务词典。
- **Few-shot：** 相似 question-SQL 对检索（DAIL-SQL 思路）。
- **执行反馈：** 生成 SQL → 执行 → 错误信息 → 自修正（Agent loop）。
- **安全：** 只读账号、LIMIT、禁止 DROP、SQL 白名单解析。
- **Eval：** Spider / BIRD benchmark；业务自定义 golden set。

### 与前端工程结合的角度

- BI Copilot UI：自然语言 → SQL 预览 → 用户确认 → 表格 / 图表渲染。
- 展示 schema explorer 让用户 @表名 减少歧义。

### 面试加分项

- 提到 DIN-SQL、MAC-SQL 等多 Agent Text2SQL 架构。
- 说明 value retrieval（查 column distinct values）对 WHERE 条件准确率帮助大。

---

## 什么是 Agentic RL？与 RLHF / 传统 RL 有何区别？

**来源：** 大模型算法面试八股总结

### 核心要点

- **传统 RL：** 在固定环境（游戏、仿真）中学策略 π(a|s)，优化累积奖励；状态转移通常已知或可采样。
- **RLHF：** 用人类偏好或奖励模型对齐 **单轮文本输出**（ helpful / harmless）；典型流程 SFT → RM → PPO，目标是「说得像人、少幻觉」。
- **Agentic RL：** 对 **多步 Agent 轨迹**（Thought → Tool Call → Observation → …）做强化学习，奖励常绑定 **任务是否完成、步数、工具调用正确率**；代表方向 DeepSeek-R1（GRPO）、WebAgent 训练、工具使用 RL 微调。
- **关系：** RLHF 解决「话怎么说」；Agentic RL 解决「事情怎么做」——后者动作空间含 API / 检索 / 代码执行，探索空间更大、reward 设计更难。

### 与前端工程结合的角度

- 生产环境前端对接的多为 **已对齐的推理 API**，不直接参与 RL 训练；但需理解：**同一模型经 Agentic RL 后，长链推理与 tool 遵从可能更好**，UI 上可展示 reasoning / tool 步骤以发挥模型优势。
- Eval 面板可记录 trajectory（每步 action + observation），为算法同学提供 RL 训练数据或 failure case——前后端契约设计时预留 `traceId` 与步骤 JSON。

### 面试加分项

- 对比 PPO（RLHF 常用）与 GRPO（组相对策略优化，DeepSeek-R1 采用，省 critic 模型）。
- 说明 Agentic RL 的工程难点：稀疏奖励、credit assignment（哪一步 tool 调错了）、在线探索成本——因此多数团队 **推理用 RL 模型，编排仍靠工程框架**。
