# NexQuery AI 项目命令手册

本文件记录了 NexQuery AI 项目全栈环境（Frontend, Backend, Monorepo Root）中常用的执行命令与脚本。

## 1. 根目录 (Monorepo Root)
在项目根目录下，使用 `pnpm` 运行的一键式多包管理命令。

| 命令 | 用途 | 说明 |
| :--- | :--- | :--- |
| `pnpm dev` | 全栈启动 | 同时启动前端和后端开发服务器。 |
| `pnpm dev:all` | 环境+全栈启动 | 启动 Docker Compose (数据库) 并运行 `pnpm dev`。 |
| `pnpm build` | 全栈构建 | 构建所有子项目（前端、后端、共享库）。 |
| `pnpm lint` | 全局代码规范修复 | 运行 ESLint 对全工程进行格式化和代码质量检查。 |
| `pnpm type-check` | 全局类型检查 | 运行 TypeScript 编译器检查全工程类型安全。 |
| `pnpm install:all` | 全量安装依赖 | 递归安装所有子项目的依赖。 |
| `pnpm kill:all` | 清理端口 | 强制杀死 3000 (Backend) 和 3008 (Frontend) 端口进程。 |

## 2. 后端 (Backend)
后端基于 AdonisJS 6，除了标准脚本外，还包含大量自定义业务命令。

### 常用 NPM 脚本
在 `/backend` 目录下运行：

| 命令 | 用途 |
| :--- | :--- |
| `pnpm dev` | 启动后端开发服务器（支持 HMR）。 |
| `pnpm build` | 编译后端代码到 `build` 目录。 |
| `pnpm test` | 运行后端 Japa 测试。 |
| `pnpm type-check` | 后端类型检查。 |

### 自定义 Ace 命令 (详细参数)
使用 `node ace <command>` 运行。

#### 1. 知识库管理
*   **`knowledge:reindex`**
    *   **用途**: 重新生成知识库条目的向量索引。
    *   **参数**:
        *   `--force`: (Flag) 强制全量覆盖。不带此参数则仅补全缺失向量的条目。
    *   **示例**: `node ace knowledge:reindex --force`

*   **`seed:spider-knowledge`**
    *   **用途**: 将 Spider 数据集样本灌注进知识库（Few-shot RAG 用）。
    *   **参数**:
        *   `-l, --limit <number>`: 限制同步的样本数量。
    *   **示例**: `node ace seed:spider-knowledge --limit 500`

#### 2. 数据库同步
*   **`schema:sync`**
    *   **用途**: 同步特定数据源的元数据（Schema）到向量库。
    *   **参数**:
        *   `<dataSourceId>`: (Argument, 必填) 数据源的 ID。
    *   **示例**: `node ace schema:sync 1`

#### 3. 评测与开发
*   **`eval:spider`**
    *   **用途**: 在 Spider 数据集上运行 Agent 评测。
    *   **参数**:
        *   `-l, --limit <number>`: 评测样本数 (默认: 5)。
        *   `-o, --offset <number>`: 采样起点偏移 (默认: 0)。
        *   `--db <db_id>`: 指定评测某个具体的 Spider 数据库。
    *   **示例**: `node ace eval:spider --limit 10 --db college_1`

#### 4. 系统维护
*   **`reset:admin`**
    *   **用途**: 重置预设的管理员账户密码（重置为 `password`）。
    *   **参数**: 无。

*   **`reset:password`**
    *   **用途**: 重置指定用户的密码。
    *   **参数**:
        *   `<email>`: (Argument, 必填) 用户邮箱。
        *   `-p, --password <string>`: (Flag, 可选) 新密码。若不提供则进入交互式安全输入。
    *   **示例**: `node ace reset:password user@example.com -p new_secret_123`

## 3. 前端 (Frontend)
前端基于 Vite + Vue 3。

在 `/frontend` 目录下运行：

| 命令 | 用途 | 参数/说明 |
| :--- | :--- | :--- |
| `pnpm dev` | 开发服务器 | 默认端口 3008。可通过 `export VITE_PORT=XXXX` 修改。 |
| `pnpm build` | 生产构建 | 产物位于 `dist` 目录。 |
| `pnpm type-check` | 类型检查 | 使用 `vue-tsc`。 |
| `pnpm lint` | 规范修复 | 修复 Vue/TS 文件格式。 |

---
*注：对于数据库迁移，请使用 `pnpm backend:migrate` 或在后端目录运行 `node ace migration:run`。*
