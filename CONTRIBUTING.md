# Contributing to NexQuery AI

Welcome to the NexQuery AI project! We appreciate your interest in contributing. This document provides guidelines for setting up the development environment and submitting contributions.

## Project Structure

This is a Monorepo managed by **PNPM Workspaces**.

-   `backend/`: AdonisJS 6 (Node.js) API server.
-   `frontend/`: Vue 3 + Vite + TailwindCSS + Shadcn UI.
-   `miniprogram/`: Uni-app (Vue 3) for WeChat Mini Program.
-   `packages/shared/`: Shared TypeScript types and utilities.
-   `packages/e2e/`: Playwright end-to-end tests.

## Prerequisites

-   **Node.js**: v20 or higher.
-   **PNPM**: v9 (`npm install -g pnpm`).
-   **Docker**: For running Database (Postgres) and Vector Store (Qdrant).

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/nexquery/nexquery-ai.git
    cd nexquery-ai
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Setup Environment Variables**:
    -   Copy `.env.example` to `.env` in root, `backend/`, and `frontend/`.
    -   Update database credentials in `.env` if needed.

4.  **Start Services (Docker)**:
    ```bash
    docker-compose up -d db qdrant
    ```

5.  **Run Migrations & Seed**:
    ```bash
    pnpm backend:migrate
    pnpm backend:seed
    ```

6.  **Start Development Servers**:
    ```bash
    # Start both frontend and backend
    pnpm dev
    ```
    -   Frontend: http://localhost:3000
    -   Backend API: http://localhost:3008
    -   API Docs: http://localhost:3008/docs

## Testing

-   **Unit Tests (Backend)**: `pnpm backend:test`
-   **E2E Tests**: `pnpm test:e2e`

## Branching Strategy

-   `main`: Stable production branch.
-   `develop`: Integration branch for new features.
-   Feature branches: `feature/your-feature-name`
-   Fix branches: `fix/issue-description`

## Code Style

-   We use **ESLint** and **Prettier**.
-   Run `pnpm lint` before committing.
-   Commit messages should follow [Conventional Commits](https://www.conventionalcommits.org/).

## License

AGPL-3.0
