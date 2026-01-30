<div align="center">
  <img src="./frontend/public/logo.png" alt="NexQuery AI Logo" width="128px" />
  <h1>NexQuery AI</h1>
  <p>面向运营与非技术人员的智能数据协作平台。它通过 AI 驱动的交互方式，致力于打破技术壁垒，让运营人员在日常数据获取中大幅降低对运维或开发工程师的依赖，实现安全、自主的数据消费。</p>
</div>

![Vue](https://img.shields.io/badge/Frontend-Vue%203%20%2B%20Shadcn-42b883)
![AdonisJS](https://img.shields.io/badge/Backend-AdonisJS%206-5a45ff)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🎯 核心价值

*   **赋能运营 (Self-Service)**: 运营人员可以通过自然语言（Text-to-SQL）直接提问获取数据，无需学习复杂的 SQL 语法。
*   **解放运维 (Reduce Dependency)**: 极大减少了“提需求 -> 等排期 -> 查数据 -> 导 Excel”的繁琐流程，让技术人员专注于核心业务开发。
*   **协作闭环 (Pro-Config, Ops-Consume)**:
    *   **配置**: 由专业人员（DBA/开发）预置复杂查询任务与调度规则。
    *   **消费**: 运营人员直接“一键执行”或通过**邮件/企微/钉钉/飞书**自动接收数据推送，无需登录系统即可获取日报/周报。
*   **安全可控 (Safety First)**: 在开放数据能力的同时，通过细粒度的权限控制、脱敏策略和审计日志，确保企业数据资产 Absolutely Safe。

## 🚀 核心特性

### 🤖 AI 智能辅助 (Agentic SQL)
核心逻辑实现于 [`LangChainService`](backend/app/services/lang_chain_service.ts)。
-   **Text-to-SQL**: 使用自然语言生成复杂的 SQL 查询。
-   **主动消解歧义**: 当需求模糊时，AI 主动反问并提供选项，拒绝“瞎猜”。
-   **自动化可视化**: AI 自动根据数据特征推荐并标识最佳图表方案（Bar, Line, Pie 等）。
-   **智能优化**: AI 自动分析 SQL 性能，提供索引建议和重写方案。
-   **思维链 (Mind Chain)**: 透明展示 AI 的思考过程、知识库检索结果和工具调用详情，拒绝“黑盒”。
-   **闭环自进化 (Closed-Loop)**: 通过“用户反馈 -> 修正提炼 (AI Feedback Adoption) -> 知识库审计 -> RAG 增强”实现系统准确性的持续闭环进化。
-   **SSE 实时推送**: 集成服务端事件发送 (SSE)，实现系统状态与实时通知的毫秒级触达。
-   **安全校验**: 内置 [`ValidateSqlTool`](backend/app/services/tools/validate_sql_tool.ts) 进行语法检查与危险命令 (`DROP`, `TRUNCATE`) 拦截。

### 🔌 多数据源支持
由 [`DataSourcesController`](backend/app/controllers/data_sources_controller.ts) 管理。
-   **关系型数据库**: 原生支持 **PostgreSQL** 和 **MySQL**。
-   **HTTP API**: 支持通过 `curl` 风格命令将 API 响应作为数据表进行查询。
-   **高级配置**: 支持字段级数据脱敏 (手机号, 邮箱, 银行卡) 和枚举值自动映射。
38: -   **PII 自动发现**: 内置 [`PiiDiscoveryService`](backend/app/services/pii_discovery_service.ts)，在同步 Schema 时利用 AI 自动识别敏感字段 (手机号, 邮箱, 身份证等) 并应用脱敏规则。
39: -   **全局超时配置**: 支持在系统设置中动态调整 AI 模型请求的超时时间，默认 10 分钟，适应大规模 Schema 分析场景。

### 🛡️ 企业级安全
-   **RBAC 权限系统**: 基于角色的细粒度权限控制，支持动态菜单。
-   **双重认证 (2FA)**: 集成 OTP (Google Authenticator) 登录保护，逻辑位于 [`TwoFactorAuthController`](backend/app/controllers/two_factor_auth_controller.ts)。
-   **敏感数据加密**: 数据库连接串与 API Key 使用 [`CryptoService`](packages/shared/src/utils/crypto.ts) 进行 AES-256 加密存储。
-   **安全审计**: 完整的查询历史记录与操作日志。

### ⚙️ 自动化与推送
-   **定时任务**: 基于 [`SchedulerService`](backend/app/services/scheduler_service.ts) 支持 Cron 表达式或一次性定时执行查询任务。
-   **多渠道触达**:
    *   **SSE/Web**: 站内实时推送审批进度与系统事件。
    *   **Email**: 定时将查询结果 (CSV) 发送到指定邮箱列表。
    *   **IM 推送**: 支持 Webhook 对接 **企业微信、钉钉、飞书**，将数据实时推送到工作群。
-   **Schema 管理**: [`SchemaSyncService`](backend/app/services/schema_sync_service.ts) 支持连接后自动同步模式，确保 AI 知识库始终处于最新状态。

## 🛠️ 技术栈

本项目采用 Monorepo 架构，全栈 TypeScript 开发：

-   **Frontend**: Vue 3, Vite, Pinia, TailwindCSS, Shadcn UI
    -   API 封装: [`api.ts`](frontend/src/lib/api.ts)
-   **Backend**: AdonisJS 6, Lucid ORM, Node.js
    -   核心配置: [`adonisrc.ts`](backend/adonisrc.ts)
-   **Shared**: [`packages/shared`](packages/shared) (前后端统一加密与类型定义)
-   **AI Engine**: LangChain, ZhipuGLM (GLM-4)

## 📖 文档指南

-   [用户手册 (User Manual)](docs/user_manual.md): 详细的功能使用说明。
-   [部署指南 (Deployment Guide)](docs/deployment.md): Docker 部署、环境变量配置与系统初始化。
-   [开发指南 (Developer Guide)](docs/dev_guide.md): 本地开发环境搭建与架构说明。

## ⚡️ 快速开始 (Docker)

1.  **克隆项目**:
    ```bash
    git clone https://github.com/OSpoon/nexquery-ai.git
    cd nexquery-ai
    ```

2.  **配置环境**:
    ```bash
    cp .env.example .env
    # 编辑 .env 文件，设置数据库密码、API Key 与 Qdrant Key
    ```

3.  **启动服务**:
    查看 [`docker-compose.yml`](docker-compose.yml) 了解服务编排：
    ```bash
    docker compose up -d
    ```

4.  **初始化数据**:
    ```bash
    pnpm backend:migrate
    pnpm backend:seed
    ```

5.  **访问系统**:
    打开浏览器访问 `http://localhost:3000`。
    *   默认管理员: `admin@nexquery.ai`
    *   默认密码: `password`

---

<div align="center">
    Built with ❤️ by the NexQuery AI Team.
</div>
