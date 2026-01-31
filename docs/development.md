# NexQuery AI 开发与部署指南

本文档集成了 NexQuery AI 的开发环境配置、架构说明及生产环境部署指南。

## 1. 项目架构 (Monorepo)

本项目使用 pnpm workspace 管理：

```
/
├── backend/            # AdonisJS 6 后端应用
├── frontend/           # Vue 3 (Vite) 前端应用
├── packages/shared/    # 前后端共享逻辑 (CryptoService, 类型定义)
├── docs/               # 文档说明
└── dev.sh              # 一键开发启动脚本
```

---

## 2. 本地开发环境准备

### 前置要求
*   Node.js v20+ & pnpm
*   Docker & Docker Compose

### 2.1 安装依赖
在根目录执行：
```bash
pnpm install
```

### 2.2 配置文件
1.  **拷贝模板**: `cp .env.example .env`
2.  **核心配置**: 确保 `DB_HOST=127.0.0.1` 且 `API_ENCRYPTION_KEY` 已设置。

### 2.3 启动开发环境 (推荐)
我们采用 **“宿主机应用 + Docker 基础设施”** 模式：
```bash
./dev.sh
# 或者执行：pnpm dev:all
```
该操作会启动 Docker 中的数据库/缓存，并在宿主机持续运行前后端 HMR。

---

## 3. 生产环境部署 (Docker)

在生产环境中，我们建议全量使用容器化部署。

### 3.1 启动生产环境
```bash
# 第一次启动或更新代码后
docker compose --profile app up -d --build
# 后续正常启动
docker compose --profile app up -d
```
> [!IMPORTANT]
> **缓存注意**：如果更新了 `.env` 中的加密密钥，启动后请在浏览器中执行 **硬刷新 (Cmd+Shift+R)**，以确保前端加载注入新配置的资源。

### 3.2 停止与清理
根据需求选择命令：
```bash
# 停止并移除容器（保留数据库数据）
docker compose --profile app down

# 仅停止服务（不移除容器）
docker compose --profile app stop

# 彻底清理（包括删除数据库数据卷）
docker compose --profile app down -v
```

### 3.3 数据库操作 (首次或更新)
```bash
# 执行迁移
docker compose --profile app exec backend node ace migration:run --force
# 执行种子数据
docker compose --profile app exec backend node ace db:seed
```

### 3.4 推荐：添加终端别名
建议在 `~/.zshrc` 或 `~/.bashrc` 中添加以下别名以简化操作：
```bash
alias dcp="docker compose --profile app"

# 使用示例：
# dcp up -d
# dcp down
# dcp logs -f
```

---

## 4. 常见问题排查 (Troubleshooting)

*   **数据库连接失败**: 确保 Docker 容器已启动且 5432 端口未被宿主机其他进程占用。
*   **AI 无法连接**: 检查 GLM API Key 是否已在系统设置中正确配置。
*   **前端组件报错**: 检查是否缺少 `lucide-vue-next` 的图标导入。

---

## 5. 架构特性

*   **AI 治理**: 语义脱敏与 SQL 校验位于 `backend/app/services/lang_chain_service.ts`。
*   **安全拦截**: 全局 SQL 报错拦截位于 `backend/app/exceptions/handler.ts`，防止敏感信息泄露。
