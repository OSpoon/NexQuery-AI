# NexQuery AI Mini Program

This directory contains the Uni-app source code for the WeChat Mini Program.

## Tech Stack
-   **Framework**: Uni-app (Vue 3 + TypeScript).
-   **UI**: Built-in Uni-app components + CSS.
-   **API**: `@/lib/api.ts` with transparent encryption support.

## Prerequisites
1.  **Node.js** >= 18.
2.  **PNPM** installed.
3.  **WeChat Developer Tools** (微信开发者工具).

## Setup
1.  Install dependencies:
    ```bash
    pnpm install
    ```

2.  Configuration:
    -   Ensure `src/manifest.json` has the correct `mp-weixin.appid`.
    -   Ensure the Backend API is running at `http://localhost:3008`.
    -   Update `src/lib/api.ts` if the backend URL changes.

## Running Development
1.  Start the compiler:
    ```bash
    pnpm dev:mp-weixin
    ```
2.  Open **WeChat Developer Tools**.
3.  Import the directory: `nexquery-ai/miniprogram/dist/dev/mp-weixin`.

## Deployment
1.  Build for production:
    ```bash
    pnpm build:mp-weixin
    ```
2.  Upload `dist/build/mp-weixin` via WeChat Developer Tools.

## Features
-   **WeChat Login**: One-click login and account binding.
-   **Task Dashboard**: View and filter available query tasks.
-   **Execution**: Run tasks with parameter input and view results.
