# NexQuery AI 开发者指南 (Developer Guide)

本文档旨在帮助开发者快速理解 NexQuery AI 的架构设计，并掌握从本地开发到生产部署的完整流程。

---

## 1. 项目概览

NexQuery AI 采用 **Monorepo** 结构，使用 `pnpm workspace` 管理所有包。

### 目录结构
```bash
nexquery-ai/
├── backend/                # [Backend] AdonisJS 6 应用
│   ├── app/                # 核心业务代码
│   │   ├── controllers/    # Http 控制器 (Auth, AI, DataSources...)
│   │   ├── services/       # 业务逻辑服务 (LangChain, Scheduler, FinOps...)
│   │   ├── models/         # Lucid ORM 模型
│   │   └── ...
│   ├── database/           # 迁移 (migrations) 与 种子 (seeders)
│   └── start/              # 路由与应用启动钩子
├── frontend/               # [Frontend] Vue 3 + Vite 应用
│   ├── src/
│   │   ├── components/     # UI 组件 (Shadcn)
│   │   ├── pages/          # 路由页面
│   │   ├── stores/         # Pinia 状态管理
│   │   └── ...
├── miniprogram/            # [Mobile] Uni-app 微信小程序
├── packages/shared/        # [Shared] 前后端共享模块
│   ├── src/
│   │   ├── constants/      # 共享常量 (Permissions, Roles)
│   │   └── services/       # 共享逻辑 (CryptoService)
├── docs/                   # 项目文档
└── package.json            # Monorepo 根配置
```

---

## 2. 核心架构设计

### 2.1 AI 双模引擎 (Dual-Mode Engine)
核心逻辑位于 `backend/app/services/lang_chain_service.ts`。系统根据 `dataSourceId` 的存在与否，自动在两种模式间切换：

1.  **Agentic Mode (SQL Agent)**:
    *   **触发**: 用户选择了具体的数据源。
    *   **机制**: 挂载 `ListTables`, `GetTableSchema`, `ValidateSql`, `SubmitSql` 等 Tools。
    *   **流程**: RAG (Schema Retrieval) -> Reasoning -> Tool Execution -> Self-Correction -> SQL Generation。
2.  **General Mode (Chat)**:
    *   **触发**: 用户选择 "No Context" 或未选择数据源。
    *   **机制**: 纯粹的 LLM 对话，不挂载任何数据库工具。
    *   **用途**: 日常问答、代码解释、一般性咨询。

### 2.2 FinOps 监控体系
为了控制 AI 成本，系统实现了闭环的 FinOps 监控：
*   **计算**: `ModelCostService` 解析 LLM 响应中的 `usage` 字段，结合模型单价计算成本。
*   **存储**: 记录至 `ai_usage_logs` 表。
*   **展示**: `AiFinOpsController` 提供聚合 API，供管理端看板展示 Top Consumers 和 成本趋势。

### 2.3 安全与加密
*   **传输加密**: 前后端通过 `API_ENCRYPTION_KEY` 对敏感 Payload (如 API Key, DB Password) 进行 AES 加密。
*   **配置隔离**: 生产环境强制开启加密 (`API_ENCRYPTION_ENABLED=true`)，开发环境可选。
*   **RBAC**: 使用中间件 `auth` 和 `checkPermission` 进行路由级权限拦截。

---

## 3. 本地开发环境搭建

### 3.1 依赖安装
```bash
# 根目录执行
pnpm install
```

### 3.2 环境变量
复制 `.env.example` 为 `.env` 并配置：
*   `DB_PASSWORD`: 数据库密码
*   `AI_API_KEY`: 既然是大模型应用，这是必须的 (OpenAI / GLM format)
*   `AI_BASE_URL`: 模型厂商的 API 地址

### 3.3 启动服务
推荐按照以下步骤启动，以获得完整的功能支持：

```bash
# 1. 启动基础设施
docker compose up -d

# 2. 初始化数据库
pnpm backend:migrate
pnpm backend:seed

# 3. 启动全栈应用
pnpm dev
```
该命令会并行运行后端 (`pnpm backend:dev`) 和前端 (`pnpm frontend:dev`)。

---

## 4. 生产环境部署 (Docker)

生产环境建议使用 Docker Compose 进行全量容器化部署。

### 4.1 部署命令
```bash
# 构建并后台运行
docker compose --profile app up -d --build

# 查看日志
docker compose --profile app logs -f
```

### 4.2 数据初始化
首次部署需初始化数据库结构与默认数据：
```bash
# 运行迁移
docker compose --profile app exec backend node ace migration:run --force

# 填充种子数据 (默认账号与权限)
docker compose --profile app exec backend node ace db:seed
```

### 4.3 更新发布
```bash
git pull
docker compose --profile app down
docker compose --profile app up -d --build
# 如果有数据库变更
docker compose --profile app exec backend node ace migration:run
```

---

## 5. 常见问题 (FAQ)

*   **Q: 为什么前端显示 "Network Error"?**
    *   A: 检查 `.env` 中的 `VITE_API_URL` 是否指向了正确的后端地址。开发环境通常是 `http://localhost:3333`。
*   **Q: AI 回答很慢？**
    *   A: 检查 `AI_TIMEOUT_SEC` 设置。如果是复杂 Schema，建议调大超时时间（默认 600s）。
*   **Q: 只有 General Chat 能用，SQL Agent 报错？**
    *   A: 确保所选的数据源配置正确，并点击了 **Settings -> Test Connection** 确保连通性。Agent 需要先获取 Schema 才能工作。
