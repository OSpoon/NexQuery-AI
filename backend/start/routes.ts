import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { PERMISSIONS } from '@nexquery/shared'
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'

const DataSourcesController = () => import('#controllers/data_sources_controller')
const QueryTasksController = () => import('#controllers/query_tasks_controller')
const ExecutionController = () => import('#controllers/execution_controller')
const QueryLogsController = () => import('#controllers/query_logs_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const RolesController = () => import('#controllers/roles_controller')
const UsersController = () => import('#controllers/users_controller')
const SettingsController = () => import('#controllers/settings_controller')
const AuthController = () => import('#controllers/auth_controller')
const MenusController = () => import('#controllers/menus_controller')
const TwoFactorAuthController = () => import('#controllers/two_factor_auth_controller')
const AiController = () => import('#controllers/ai_controller')
const ScheduledQueriesController = () => import('#controllers/scheduled_queries_controller')
const ApiKeysController = () => import('#controllers/api_keys_controller')
const AiFeedbacksController = () => import('#controllers/ai_feedbacks_controller')
const NotificationsController = () => import('#controllers/notifications_controller')

const HealthChecksController = () => import('#controllers/health_checks_controller')
const PasswordResetsController = () => import('#controllers/password_resets_controller')

// Redirect root to docs
router.get('/', async ({ response }) => {
  response.redirect('/docs')
})

// Swagger Docs
router.get('/swagger', async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.default.ui('/swagger', swagger)
})

router
  .group(() => {
    router.get('health', [HealthChecksController, 'handle'])

    // Public Auth
    router.post('auth/2fa/verify', [AuthController, 'verify2fa']) // 2FA Verification during login
    router.post('login', [AuthController, 'login'])
    router.post('auth/miniprogram/login', [AuthController, 'miniProgramLogin'])
    router.post('auth/miniprogram/bind', [AuthController, 'bindMiniProgram'])
    router.post('register', [AuthController, 'register'])
    router.post('password/email', [PasswordResetsController, 'sendResetLink'])
    router.post('password/reset', [PasswordResetsController, 'reset'])
    router.get('settings', [SettingsController, 'index'])

    // Public Static Avatars (No Auth, No Encryption)
    router.get('uploads/avatars/:filename', async ({ params, response }) => {
      return response.download(`./uploads/avatars/${params.filename}`)
    })

    // Authenticated Routes
    router
      .group(() => {
        // Auth Management
        router.get('me', [AuthController, 'me'])
        router.post('logout', [AuthController, 'logout'])
        router.post('auth/password/change', [AuthController, 'changePassword'])
        router.post('auth/avatar', [AuthController, 'updateAvatar'])
        router.post('auth/miniprogram/unbind', [AuthController, 'unbindMiniProgram'])

        // 2FA Management
        router.post('auth/2fa/generate', [TwoFactorAuthController, 'generate'])
        router.post('auth/2fa/enable', [TwoFactorAuthController, 'enable'])
        router.post('auth/2fa/disable', [TwoFactorAuthController, 'disable'])

        // Dashboard
        router.get('dashboard/stats', [DashboardController, 'index'])
        router.get('query-logs', [QueryLogsController, 'index'])

        // Settings
        router
          .patch('settings', [SettingsController, 'updateMany'])
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_USERS }))

        // Data Sources
        router
          .group(() => {
            router.post('data-sources/test-connection', [DataSourcesController, 'testConnection'])
            router.post('data-sources/refresh', [DataSourcesController, 'refresh'])
            router.post('data-sources/:id/sync-schema', [DataSourcesController, 'syncSchema'])
            router.get('data-sources/:id/schema', [DataSourcesController, 'getSchema'])
            router.resource('data-sources', DataSourcesController).apiOnly()
          })
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_DATA_SOURCES }))

        // Knowledge Base
        router
          .group(() => {
            router.resource('knowledge-base', '#controllers/knowledge_bases_controller').apiOnly()
          })
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_KNOWLEDGE_BASE }))

        // Query Tasks (Manage & View)
        router
          .group(() => {
            router.get('query-tasks', [QueryTasksController, 'index'])
            router.get('query-tasks/:id', [QueryTasksController, 'show'])
            router.post('query-tasks', [QueryTasksController, 'store'])
            router.put('query-tasks/:id', [QueryTasksController, 'update'])
            router.delete('query-tasks/:id', [QueryTasksController, 'destroy'])

            // Scheduled Queries
            router.get('scheduled-queries', [ScheduledQueriesController, 'index'])
            router.get('scheduled-queries/check-cron', [ScheduledQueriesController, 'checkCron'])
            router.post('scheduled-queries', [ScheduledQueriesController, 'store'])
            router.put('scheduled-queries/:id', [ScheduledQueriesController, 'update'])
            router.delete('scheduled-queries/:id', [ScheduledQueriesController, 'destroy'])
          })
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_TASKS }))

        // AI Feedback
        router
          .group(() => {
            router.get('feedback', [AiFeedbacksController, 'index'])
            router.post('feedback', [AiFeedbacksController, 'store'])
            router.post('feedback/:id/adopt', [AiFeedbacksController, 'adopt'])
            router.delete('feedback/:id', [AiFeedbacksController, 'destroy'])
          })
          .prefix('ai')
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_AI_FEEDBACK }))

        // Execution
        router.post('query-tasks/:id/execute', [ExecutionController, 'execute'])

        // AI Features
        router.post('ai/optimize-sql', [AiController, 'optimizeSql'])
        router.post('ai/chat', [AiController, 'chat'])
        router.post('ai/chat/stream', [AiController, 'chatStream'])
        router.post('ai/preview', [AiController, 'preview'])
        router.post('ai/learn', [AiController, 'learn'])
        router.get('ai/conversations', [AiController, 'getConversations'])
        router.get('ai/conversations/:id', [AiController, 'getConversationMessages'])
        router.delete('ai/conversations/:id', [AiController, 'deleteConversation'])

        // Public Menu Access
        router.get('menus/route-permissions', [MenusController, 'getRoutePermissions'])
        router.get('menus/public', [MenusController, 'public'])

        // RBAC Management
        router
          .group(() => {
            router.get('permissions', [RolesController, 'permissions'])
            router.resource('roles', RolesController).apiOnly()
            router.resource('users', UsersController).apiOnly()
            router.resource('menus', MenusController).apiOnly()
          })
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_USERS }))

        // API Keys Management
        router
          .group(() => {
            router.get('auth/keys', [ApiKeysController, 'index'])
            router.post('auth/keys', [ApiKeysController, 'store'])
            router.delete('auth/keys/:id', [ApiKeysController, 'destroy'])
          })
          .use(middleware.rbac({ permission: PERMISSIONS.MANAGE_API_KEYS }))
      })
      .use(middleware.auth())
  })
  .prefix('api')
  .use(middleware.encrypt())

// SSE Notifications (Manual auth in controller to support EventSource)
// We keep it outside the group to bypass the group-level encrypt and auth middleware
router.get('/api/notifications/stream', [NotificationsController, 'stream'])
