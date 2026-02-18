# NexQuery AI 用户使用手册 (User Manual)

欢迎使用 NexQuery AI！这是一个让数据获取变得像聊天一样简单的智能平台。本文档将指导您如何充分利用平台的各项功能。

---

## 1. 快速入门

### 1.1 登录系统
*   **地址**: 请访问管理员提供的 Web 地址。
*   **账号**: 使用管理员分配的邮箱与密码登录。
*   **双重认证 (2FA)**: 为了安全，首次登录后建议在“个人中心”绑定 Google Authenticator。绑定后，每次登录需输入 6 位动态码。

### 1.2 角色说明
系统内主要有三种角色：
*   **Admin (管理员)**: 负责系统配置、用户管理、FinOps 监控。
*   **Developer (开发者/DBA)**: 负责配置数据源、管理知识库、预置复杂任务。
*   **Operator (运营人员)**: 主要的数据消费者，使用 AI 查询数据、查看报表。

---

## 2. 核心功能：AI 数据查询

进入 **Query Execution** (查询执行) 页面，这是您的主要工作台。

### 2.1 两种对话模式
系统会根据您的选择自动切换模式：

1.  **通用聊天 (General Chat)**
    *   **如何触发**: 在左上角数据源选择框中选择 `Select Data Source` (空) 或 `No Context`。
    *   **用途**: 询问通用问题，如“Excel 怎么算标准差？”、“解释一下什么是留存率”。
    *   **特点**: AI 不会尝试连接数据库，响应速度快。

2.  **SQL 数据查询 (Agentic SQL)**
    *   **如何触发**: 在左上角选择一个具体的数据源 (如 `Production DB`)。
    *   **用途**: 获取具体业务数据。
    *   **操作步骤**:
        1.  在对话框输入需求，例如：“查询上个月销售额最高的前 10 个商品”。
        2.  **换行技巧**: 输入框支持多行，按 `Shift + Enter` 换行，按 `Enter` 发送。
        3.  **歧义处理**: 如果 AI 不确定您的意思（比如“销售额”是指下定金额还是实付金额），它会弹出选项供您选择。
        4.  **结果验证 (Code Editor)**:
            *   AI 会生成 SQL 并自动填充到 **CodeMirror 6 Editor**。
            *   **Syntax Highlighting**: 支持 SQL 与 Lucene 语法高亮。
            *   **Auto-Completion**: 输入表名或字段名时尝试触发自动补全。
            *   **Run**: 点击三角图标或 `Cmd/Ctrl + Enter` 执行查询。
            *   **Download CSV**: 查询结果表格右上角提供下载按钮，支持一键导出 CSV。

### 2.2 智能调度与多智能体协作
NexQuery 采用先进的 **Multi-Agent** 架构，系统会自动启动多个专家智能体协同工作：
*   **Supervisor (主管)**: 分析您的意图，编排任务。
*   **Discovery (探索者)**: 自动查找表结构、索引和字段含义。
*   **Generator (生成者)**: 编写 SQL 或 Lucene 语句并进行校对。
*   **Security (卫兵)**: 检查语句安全性并对敏感 PII 数据执行脱敏。

**Mind Chain (思维链)**: 在对话过程中，点击“查看推理过程”可以实时观察各智能体的思考逻辑、工具调用及自我修补过程。

**Graph Visualizer (流程可视化)**:
点击聊天窗口右上角的 **Mermaid** 图标，悬浮窗将实时展示 Multi-Agent 的工作流状态：
*   **Running (Active)**: 当前正在执行的节点会高亮闪烁。
*   **Path**: 连线展示了 Agent 之间的跳转逻辑 (e.g., Supervisor -> Discovery -> Generator)。
*   **Debug**: 配合思维链，可用于排查 AI 为何陷入循环或选择了错误的工具。

### 2.3 Elasticsearch 查询 (Lucene)
对于日志分析或全文检索场景，NexQuery 支持连接 **Elasticsearch**。
*   **智能识别**: 选择 ES 数据源后，AI 自动切换为 **Lucene Agent**。
*   **查询能力**: 支持通过自然语言生成 Lucene 语法。
*   **探索工具**: AI 会自动发现 Index Mapping 和字段统计信息。

### 2.4 智能优化
如果您懂 SQL，可以在编辑器写好 SQL 后点击 **Optimize SQL**。AI 会分析您的查询，并给出通过加索引或重写语句来提升性能的建议。

---

## 3. 任务自动化与推送

不想每天重复查数据？使用 **Query Tasks** (查询任务) 将其自动化。

### 3.1 创建任务
1.  在查询页面调试好 SQL。如果您的 SQL 中包含占位符（如 `WHERE date > '{{date}}'`），系统会自动识别。
2.  点击 **Save as Task**。
3.  **Parameters (参数配置)**: 系统会自动提取 `{{variable}}` 形式的参数。您需要为每个参数提供 **Default Value** (测试用) 和 **Description** (给其他人看)。
4.  **Schedule**: 配置 Cron 表达式。
    *   `0 9 * * 1` : 每周一早 9 点
    *   `0 8 * * *` : 每天早 8 点
    *   **One-off**: 仅执行一次（适合耗时的大数据量跑批）

### 3.2 配置推送渠道
让数据主动找您，而不是您找数据。
*   **Email**: 在 Recipients 中填入邮箱，报表将以 CSV 附件形式发送。
*   **Webhook**: 填入企业微信/钉钉/飞书的群机器人 Webhook 地址，报表摘要将直接推送到工作群。

---

## 4. 移动端 (小程序)

NexQuery AI 提供配套微信小程序，方便随时随地看数。

*   **绑定**: 首次使用小程序需输入 Web 端账号密码进行绑定。
*   **功能**:
    *   查看所有已保存的查询任务。
    *   执行任务并预览结果 (表格/JSON)。
    *   查看历史执行记录。

---

## 5. 管理员指南 (Administration)

如果您是管理员，以下功能将帮助您更好地理系统。

### 5.1 数据源管理 (Data Sources)
*   **PII 自动发现**: 添加数据源后，系统会自动扫描敏感字段。请在 Settings 中复核这些标记，确保手机号、身份证等数据被正确脱敏 (Masking)。
*   **Schema Sync**: 建议定期点击 Sync 按钮，确保 AI 掌握最新的表结构。

### 5.2 FinOps 成本监控
访问 **FinOps** 菜单，不仅可以看系统花了多少钱，还能看“谁”花得最多。
*   **Dashboard**: 查看 Token 消耗趋势。
*   **Top Consumers**: 揪出滥用 AI 资源的用户或异常的高频查询模型。

### 5.3 AI 治理与闭环学习 (Feedback)
在 **AI Feedback** 菜单中，您可以查看用户在聊天窗口进行的反馈记录：
*   **点赞/点踩**: 快速收集用户对生成结果的满意度。
*   **用户校正 (Correction)**: 如果 AI 生成的 SQL/Lucene 有误，用户可以提供正确的代码。
*   **自动学习 (Adopt & Learn)**: 管理员审核反馈后，点击 **Promote**。系统会将优质案例**自动同步到知识库**，提升 AI 在下次遇到类似问题时的生成准确率。
*   **双模知识库**: 知识库现已支持 **SQL** 和 **Lucene** 两种类型。AI 会在检索时自动根据当前数据源加载对应的知识。

### 5.4 Hybrid AI 配置 (Hybrid AI Engine)
管理员可以在 **Settings -> AI** 中灵活配置不同的模型提供商：
*   **Chat Model**: 负责逻辑推理与生成 (e.g., GPT-4o, GLM-4)。
*   **Embedding Model**: 负责知识库与 Schema 的向量化检索 (e.g., text-embedding-3-small)。
*   **配置项**:
    *   `AI Base URL` & `AI API Key`: 用于 **Chat Model**。
        *   **OpenAI**: `https://api.openai.com/v1`
        *   **DeepSeek**: `https://api.deepseek.com`
        *   **Zhipu AI**: `https://open.bigmodel.cn/api/paas/v4/`
    *   `AI Embedding Base URL` & `AI Embedding API Key`: 独立配置 **Embedding 服务**。
        *   *Scenario*: 您可以使用便宜的 `text-embedding-3-small` (OpenAI) 处理向量检索，同时使用 `DeepSeek-V3` 处理复杂的逻辑推理，实现**最佳性价比**。

---

## 6. 安全与隐私加密 (Security)

NexQuery AI 致力于保障您的数据资产安全。

### 6.1 全链路传输加密
系统内置 **End-to-End Encryption** 机制：
*   **API 加密**: 为防止敏感负载（如 API Keys）被嗅探，前端在发送数据前会使用 `API_ENCRYPTION_KEY` 进行 AES-256 加密。
    *   *Tip*: 在 API Keys 管理页面，生成的密钥仅显示一次。我们也提供了 **Copy** 按钮方便您一键复制。
*   **响应解密**: 后端返回的数据同样经过加密，仅在您的浏览器中完成解密显示。

### 6.2 PII 数据脱敏
安全智能体 (Security Agent) 在执行查询结果返回前，会自动识别并屏蔽 PII (Personally Identifiable Information) 数据：
*   **模式**: 支持掩码 (Masking)、哈希 (Hashing) 或完全拦截。
*   **范围**: 包含手机号、身份证、邮箱、银行卡号等。

---

<div align="center">
    NexQuery AI User Manual
</div>
