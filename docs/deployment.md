# NexQuery AI 部署指南

本文档介绍如何在生产环境中部署 NexQuery AI。

## 1. 环境要求

*   **Docker**: v20.10+
*   **Docker Compose**: v2.0+
*   **硬件**: 建议 2 Core CPU / 4GB RAM 以上 (AI 功能需要一定资源)。

## 2. 安装步骤

### 2.1 获取代码
```bash
git clone https://github.com/OSpoon/nexquery-ai.git
cd nexquery-ai
```

### 2.2 配置文件 (.env)
复制示例配置（参考 [`backend/.env.example`](../backend/.env.example)）：
```bash
cp .env.example .env
```

**核心配置项**:

| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `APP_KEY` | AdonsJS 应用密钥 (32位字符) | 此 Key 用于加密 Session，后端唯一 |
| `API_ENCRYPTION_KEY` | **数据加密密钥 (前后端必须一致)** | `my_secret_key_32_chars_exact_len` |
| `DB_PASSWORD` | 系统数据库密码 | `StrongPassword123!` |
| `GLM_API_KEY` | 智谱 AI Key (用于 AI 功能) | `your_glm_key` |
| `TZ` | 时区 | `Asia/Shanghai` |

> ⚠️ **重要**: `API_ENCRYPTION_KEY` 一旦设置并在生产中使用，切勿随意更改，否则将导致无法解密已加密的敏感数据（如保存的数据源密码）。

### 2.3 启动服务
使用 [`docker-compose.yml`](../docker-compose.yml) 启动服务：
```bash
docker compose up -d --build
```

### 2.4 数据库初始化
首次部署需运行迁移和种子数据（参考 [`backend/database/seeders/init_seeder.ts`](../backend/database/seeders/init_seeder.ts)）：
```bash
# 生成表结构
docker compose exec backend node ace migration:run

# 填充初始数据 (管理员账号、菜单)
docker compose exec backend node ace db:seed
```

## 3. 网络配置 (Cloudflare Tunnel)

推荐使用 Cloudflare Tunnel 将服务暴露到公网，无需开放服务器端口。

1.  在 Cloudflare Zero Trust 面板创建 Tunnel。
2.  配置 Public Watch：
    *   `hub.your-domain.com` -> `http://frontend:3000`
3.  在服务器安装 `cloudflared` 连接 Tunnel。

## 4. 常见问题

*   **无法登录？**
    *   检查 `APP_KEY` 是否正确生成。
    *   确保已运行 `db:seed` 创建了管理员账号 (`admin@nexquery.ai` / `password`)。

*   **AI 无响应？**
    *   检查 `GLM_API_KEY` 是否有效。
    *   查看后端日志 `docker compose logs backend` 排查错误。

*   **时间显示不正确？**
    *   确保 `.env` 中的 `TZ` 设置正确，且重启了容器。
