import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * ApiKeyGuardMiddleware restricts tokens created with a 'name' (API Keys)
 * to a specific subset of headless capabilities, regardless of RBAC roles.
 */
export default class ApiKeyGuardMiddleware {
  /**
   * Whitelist of allowed controller actions for API Keys.
   * Format: ControllerName.methodName
   */
  private whitelist = [
    'QueryTasksController.index',
    'QueryTasksController.show',
    'ExecutionController.execute',
    'QueryLogsController.index',
  ]

  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    const token = user?.currentAccessToken

    // If there's an authenticated user and the token has a name, it's an API Key
    if (user && token && token.name) {
      const action = ctx.route?.meta.resolvedHandler?.method
      const controller = ctx.route?.meta.resolvedHandler?.namespace?.split('/').pop()?.replace('Controller', '')

      // Construct a string like 'QueryTasksController.index'
      // Note: meta.resolvedHandler might vary depending on Adonis version/setup,
      // but usually it contains the controller name and method.
      // Alternatively, we can use specific route names if they were defined.

      const currentHandler = `${controller}Controller.${action}`

      if (!this.whitelist.includes(currentHandler)) {
        return ctx.response.forbidden({
          code: 'E_API_KEY_RESTRICTED',
          message: 'This API Key is restricted to Task management and Execution only. Please use the Web UI for other actions.',
        })
      }
    }

    return next()
  }
}
