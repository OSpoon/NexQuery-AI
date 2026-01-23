# NexQuery AI 用户手册

欢迎使用 NexQuery AI。

NexQuery AI 旨在帮助**运营人员与非技术用户**轻松、安全地获取数据。我们的目标是让您在**最大程度减少对技术部门的日常依赖**的情况下，即可通过简单的自然语言对话，自主完成数据查询与导出工作。

**协作模式**:
*   **专业人士 (DBA/技术支持)**: 负责配置复杂的数据源连接、预置高频查询任务和配置推送渠道。
*   **运营人员**: 负责“一键执行”任务，或直接查收邮件/群消息中的数据报表。

本文档将指导您如何使用平台的各项功能，并为高级用户提供底层逻辑的代码索引。

## 目录

1.  [登录与安全](#1-登录与安全)
2.  [工作台 (Dashboard)](#2-工作台-dashboard)
3.  [数据源管理](#3-数据源管理)
4.  [SQL 查询与执行](#4-sql-查询与执行)
5.  [AI 智能助手](#5-ai-智能助手)
6.  [任务调度与推送](#6-任务调度与推送)
7.  [查询历史](#7-查询历史)
8.  [系统管理](#8-系统管理)

---

## 1. 登录与安全

### 1.1 登录
*   **账号获取**: 请联系管理员为您创建账号。如果是首次部署，请使用默认管理员账号 (`admin@nexquery.ai`)。
*   **登录**: 访问系统首页，输入账号密码。
*   **会话有效期**: 默认 Web 会话有效期为 **24小时**。超时需重新登录。
*   认证逻辑参考: [`AuthController`](../backend/app/controllers/auth_controller.ts)。

### 1.2 双重认证 (2FA)
*   为了提高安全性，建议在 **个人中心 (Profile)** 开启 2FA。
*   使用 Google Authenticator 或 Microsoft Authenticator 扫描二维码绑定。
*   绑定后，登录时需输入 6 位动态验证码。
*   2FA 逻辑参考: [`TwoFactorAuthController`](../backend/app/controllers/two_factor_auth_controller.ts)。

### 1.3 密码策略
*   密码强制过期时间：90 天。
*   由于安全原因，系统禁止使用最近 5 次曾用过的密码。

---

## 2. 工作台 (Dashboard)
登录后默认进入工作台，这是您的操作起点，您可以查看：
*   **系统概览**: 活跃数据源、今日查询次数等统计。
*   **快捷入口**: 快速跳转到 SQL 执行或任务管理。
*   **最近活动**: 显示您最近执行的查询记录。
*   API 端点: [`DashboardController`](../backend/app/controllers/dashboard_controller.ts)。

---

## 3. 数据源管理 (前置步骤)

*注意：此章节通常由**技术人员**操作配置。*

在进行查询之前，您必须先配置数据源。请进入 **Data Sources** 菜单。

### 3.1 添加数据源
支持以下类型：
*   **MySQL**: 标准 MySQL 数据库。
*   **PostgreSQL**: 标准 PostgreSQL 数据库。
*   **API**: 用于查询 HTTP API 接口（通过 curl 命令）。

### 3.2 高级配置 (Advanced Config)
点击列表中的 "Settings" 图标可配置数据处理规则。这些配置将直接影响查询结果的展示。

*   **相关代码**: [`packages/shared/src/utils/crypto.ts`](../packages/shared/src/utils/crypto.ts)
*   **配置项**:
    *   **数据脱敏 (Data Masking)**: 保护敏感信息。
        *   **Mobile**: 手机号脱敏 (e.g. `138****1234`)。
        *   **Email**: 邮箱脱敏。
        *   **ID Card**: 身份证脱敏。
        *   **Password**: 完全隐藏。
    *   **枚举映射 (Enum Mapping)**:
        *   将数据库存储的代码 (e.g. `1`, `0`) 自动转换为可读文本 (e.g. `启用`, `禁用`)。
    *   **别名 (Alias)**: 为晦涩的字段名设置友好的显示名称。

---

## 4. SQL 查询与执行 (核心功能)

配置好数据源后，进入 **Query Execution** 页面进行数据检索。

### 4.1 选择数据源
*   **第一步**: 在页面左上角的下拉框中，选择您在 [第 3 章](#3-数据源管理) 中配置的数据源。
*   **注意**: 只有选择了数据源，SQL 编辑器和表结构树才会激活。

### 4.2 SQL 编辑器
*   支持语法高亮与智能提示。
*   **Intellisense**: 输入表名或字段名时会自动补全。
*   **格式化**: 点击 "Format" 按钮一键美化 SQL 代码。
*   **执行**: 点击 "Run" (或 `Cmd/Ctrl + Enter`) 执行查询。

### 4.3 执行结果
*   结果以表格形式展示，支持排序和分页。
*   **应用脱敏**: 如果配置了规则，敏感数据在此处会显示为 `****`。
*   **导出**: 点击 "Export" 支持导出为 CSV 或 JSON 文件。
*   **核心服务**: [`QueryExecutionService`](../backend/app/services/query_execution_service.ts)

---

## 5. AI 智能助手

点击页面右下角的 **Brain (大脑)** 图标或使用编辑器上方的 AI 功能。核心编排逻辑位于 [`LangChainService`](../backend/app/services/lang_chain_service.ts)。

### 5.1 Text-to-SQL (生成)
1.  打开 AI 对话框。
2.  用自然语言描述您的需求，例如：“查询最近一周注册活跃用户”。
3.  AI 生成 SQL 后，会自动**填充到 SQL 编辑器**中。
4.  您可以直接点击 "Run" 执行，或手动微调 SQL。

### 5.2 智能优化 (Optimize)
*   点击 **"Optimize SQL"**，AI 将分析当前编辑器中的 SQL 代码。
*   提供索引创建建议和查询重写方案，帮助您提升查询效率。

### 5.3 可观测性 (Mind Chain)
为了透明化 AI 的决策过程，您可以查看思维链：
*   **Reasoning**: 看到 AI 是如何一步步思考的。
*   **Tool Usage**: 查看 AI 调用了哪些工具（如 [`list_tables`](../backend/app/services/tools/list_tables_tool.ts), [`validate_sql`](../backend/app/services/tools/validate_sql_tool.ts)）。
*   **Retry Loop**: 如果 AI 第一次生成的 SQL 有误，您可以看到它如何根据错误信息进行自我修正。

### 5.4 安全护栏
*   系统会拦截 `DROP` 和 `TRUNCATE` 等高危破坏性命令。
*   所有生成的 SQL 均经过基础语法验证。
*   校验工具: [`ValidateSqlTool`](../backend/app/services/tools/validate_sql_tool.ts)

---

## 6. 任务调度与推送

在 **Query Tasks** 中，我们可以实现“一次配置，自动运行”。

> **典型场景**: 技术人员配置任务 -> 运营人员定时收邮件/消息。

### 6.1 任务配置 (Config)
*   **编写 SQL**: 输入经过验证的业务 SQL。
*   **调度规则**:
    *   **Recurring**: 使用 Cron 表达式设置周期 (e.g. `0 9 * * 1` 每周一早9点)。
    *   **One-off**: 指定具体时间执行一次。

### 6.2 结果推送 (Delivery)
系统支持将执行结果自动推送到您的工作台：

*   **Email 通知**:
    *   在任务配置的 `Recipients` 字段输入接收人邮箱。
    *   系统会自动发送包含数据附件 (CSV) 的邮件。
*   **IM 群机器人 (Webhook)**:
    *   在 `Webhook URL` 字段填入企业微信、钉钉或飞书机器人的地址。
    *   任务完成后，数据摘要将直接推送到工作群。

### 6.3 结果查看
*   **History**: 即使通过邮件发送，系统也会保留一份执行快照在 **Query History** 中。
*   **调度服务**: [`SchedulerService`](../backend/app/services/scheduler_service.ts)

---

## 7. 查询历史

**History** 页面是系统的审计中心，记录了**所有**执行过的查询（包括人工执行和定时任务）。

*   **审计**: 查看 who (执行人), when (时间), what (SQL), status (成功/失败)。
*   **复用**: 点击 "Load to Editor" 可以将历史 SQL 重新加载到编辑器中进行修改或再次执行。
*   **控制器**: [`QueryLogsController`](../backend/app/controllers/query_logs_controller.ts)

---

## 8. 系统管理

如果您是管理员，可以访问 **System Settings**。
*注意：普通用户可能无法看到此菜单，这取决于 [Role Management](#role-management) 中的权限配置。*

*   **User Management**: 创建新用户、禁用违规用户或重置用户密码。
*   **Role Management**: 定义角色 (Role) 并分配菜单权限。
*   **Menu Management**: 动态配置系统菜单结构。

---

## 9. 微信小程序 (Mobile)

NexQuery AI 提供了配套的微信小程序，方便您随时随地查看数据。

### 9.1 登录与绑定
1.  **一键登录**: 打开小程序，点击“微信一键登录”。
2.  **账号绑定**:
    *   首次登录时，系统会自动检测您的微信号是否已绑定 NexQuery 账号。
    *   如未绑定，系统会引导您输入 Web 端的账号密码进行绑定。
    *   绑定成功后，后续即可无需密码直接登录。

### 9.2 任务查看 (Tasks)
*   **列表**: 展示所有有权访问的查询任务。
*   **搜索**: 顶部提供了吸顶搜索框，支持快速筛选任务。
*   **执行**: 点击任务进入执行页，确认参数后即可运行。

### 9.3 历史记录 (History)
*   **时间轴**: 按时间倒序展示最近的查询记录。
*   **过滤器**: 支持按“成功/失败”状态筛选，或搜索特定任务名。
*   **详情页**: 点击单条记录可查看详细的 SQL、参数、执行时间和错误信息。
*   **结果预览**: 对于成功的查询，支持在移动端一键切换 **卡片视图 (Card View)** 和 **表格视图 (Table View)**。

### 9.4 个人中心 (Profile)
*   **头像同步**: 点击头像可调用微信头像并同步更新到 Web 端。
*   **账号安全**: 支持在移动端直接修改登录密码。
*   **关于我们**: 查看版本信息、用户协议及隐私政策。
