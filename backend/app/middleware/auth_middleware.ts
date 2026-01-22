import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })

    const user = ctx.auth.user

    // Check if 2FA enforcement is enabled globally
    // Default to true (safe default)
    const { default: Setting } = await import('#models/setting')
    const require2faSetting = await Setting.findBy('key', 'require_2fa')
    const isEnforcementEnabled = require2faSetting ? require2faSetting.value === 'true' : true

    // If user is authenticated but 2FA is not enabled
    // We must enforce it IF global setting is enabled.
    // However, we must allow them to access the 2FA setup routes and the logout route.
    if (user && !user.twoFactorEnabled && isEnforcementEnabled) {
      const allowedRoutes = [
        '/api/auth/2fa/generate',
        '/api/auth/2fa/enable',
        '/api/logout',
        '/api/me',
      ]

      // Check if current path matches any allowed route
      // We use simple 'contains' or exact match?
      // Current path might have query params?
      // request.url(false) returns path without query string.
      const pathOnly = ctx.request.url(false)

      const isAllowed = allowedRoutes.some((route) => pathOnly === route)

      if (!isAllowed) {
        return ctx.response.forbidden({
          code: 'E_2FA_REQUIRED',
          message: 'Two-factor authentication is required. Please set it up to continue.',
        })
      }
    }

    return next()
  }
}
