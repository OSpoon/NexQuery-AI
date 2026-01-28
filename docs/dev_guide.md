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

## 5. 工作流系统 (Workflow System)

项目集成 **Flowable (BPMN 2.0)** 作为核心审批引擎。

### 5.1 架构设计
- **Flowable Engine**: 独立运行在 Docker 中，后端通过 REST API 进行通信。
- **WorkflowService**: 封装了与 Flowable 的所有交互（部署、启动、任务操作、历史查询）。
- **BpmnModeler**: 前端使用 `bpmn-js` 深度定制的设计器，支持 Flowable 扩展属性配置。

### 5.2 核心逻辑位置
- **Service**: [`WorkflowService.ts`](../backend/app/services/workflow_service.ts)
- **Controller**: [`WorkflowController.ts`](../backend/app/controllers/workflow_controller.ts)
- **Designer**: [`BpmnModeler.vue`](../frontend/src/components/workflow/BpmnModeler.vue)
- **Moddle Extensions**: [`flowable.json`](../frontend/src/components/workflow/flowable.json) (BPMN 属性定义)

### 5.3 审批通知流程
1. `BpmnModeler` 配置 HTTP Service Task。
2. 配置 `requestUrl` 指向后端 `WebhookController`。
3. Flowable 运行时发起通知请求，后端解析参数并调用 `NotificationService` 发送邮件。
