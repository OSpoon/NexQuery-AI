/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring mail connection
  |----------------------------------------------------------
  */
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.number(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),

  FRONTEND_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for API Encryption
  |----------------------------------------------------------
  */
  ENABLE_API_ENCRYPTION: Env.schema.boolean.optional(),
  API_ENCRYPTION_ENABLED: Env.schema.boolean.optional(), // Alias or new standard
  API_ENCRYPTION_KEY: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for LangChain Monitoring (LangFuse)
  |----------------------------------------------------------
  */
  LANGFUSE_PUBLIC_KEY: Env.schema.string.optional(),
  LANGFUSE_SECRET_KEY: Env.schema.string.optional(),
  LANGFUSE_HOST: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for Vector Database (Qdrant)
  |----------------------------------------------------------
  */
  QDRANT_HOST: Env.schema.string({ format: 'host' }),
  QDRANT_PORT: Env.schema.number(),

  /*
  |----------------------------------------------------------
  | Variables for WeChat Mini Program
  |----------------------------------------------------------
  */
  WECHAT_APP_ID: Env.schema.string.optional(),
  WECHAT_APP_SECRET: Env.schema.string.optional(),
})
