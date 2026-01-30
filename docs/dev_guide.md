# NexQuery AI 开发指南

## 1. 项目结构 (Monorepo)

本项目使用 pnpm workspace 管理 Monorepo 结构，详细定义见 [`pnpm-workspace.yaml`](../pnpm-workspace.yaml)。

```
/
├── backend/            # AdonisJS 后端应用 (Node.js)
├── frontend/           # Vue 3 前端应用 (Vite)
├── packages/
│   └── shared/         # 前后端共享代码库 (CryptoService, Types)
├── docs/               # 文档
└── README.md
```

## 2. 本地开发环境搭建

### 前置要求
*   Node.js v20+
*   pnpm
*   PostgreSQL 16+ (本地运行)

### 2.1 安装依赖
在根目录执行依赖安装，参考 [`package.json`](../package.json)：
```bash
pnpm install
```

### 2.2 后端配置
1.  进入 `/backend`。
2.  `cp .env.example .env`。
3.  配置本地数据库连接 (`DB_HOST=localhost`, `DB_PORT=5432`, etc.)。
4.  运行迁移：`pnpm backend:migrate`。
5.  启动开发服务器：
    ```bash
    pnpm backend:dev
    ```
    后端运行在 `http://localhost:3008`。

### 2.3 前端配置
1.  进入 `/frontend`。
2.  `cp .env.example .env`。
3.  确保 `VITE_API_URL=http://localhost:3008/api`。
4.  启动开发服务器：
    ```bash
    pnpm frontend:dev
    ```
    前端运行在 `http://localhost:5173`。

## 3. 共享库 (Shared Package)

`/packages/shared` 包含前后端共用的逻辑，主要是加密服务 `CryptoService`。

*   **入口文件**: [`packages/shared/index.ts`](../packages/shared/src/index.ts)
*   **修改共享库**：修改代码后，TypeScript 会自动重新编译（如果开启了 watch 模式）。
*   **依赖引用**：前后端通过 workspace 协议引用：`"@nexquery/shared": "workspace:*"`。

## 4. 调试建议

*   **VSCode**: 推荐安装 Volar (Vue) 和 AdonisJS 插件。
*   **Debug**: 可以在 VSCode 中配置 Launch.json 直接调试 Node.js 后端。

## 5. AI 反馈与自进化架构

系统通过用户真实的查询反馈不断优化 Text-to-SQL 的准确性。

### 5.1 反馈流转链路
1. **收集**: 用户在前端对 AI 回复进行 👍/👎 操作。
2. **持久化**: 后端 `AiFeedbacksController` 存储反馈，并记录当时的问题与生成的 SQL。
3. **自动学习**:
   - 对于“Helpful”的反馈，系统会自动调用 `LangChainService.learnInteraction()`。
   - 数据被向量化并存入 `AiFeedback` 知识库。
4. **RAG 增强**: 下次同类提问时，AI 会检索历史高分反馈作为 Few-shot 示例。

### 5.2 关键组件
- **Model**: `AiFeedback` ([`ai_feedback.ts`](../backend/app/models/ai_feedback.ts))
- **Service**: `LangChainService` ([`lang_chain_service.ts`](../backend/app/services/lang_chain_service.ts))
- **Controller**: `AiFeedbacksController` ([`ai_feedbacks_controller.ts`](../backend/app/controllers/ai_feedbacks_controller.ts))
