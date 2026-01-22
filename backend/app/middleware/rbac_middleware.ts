import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RbacMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission: string }) {
    const { auth, response } = ctx
    const user = auth.user

    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    // If no specific permission required, just being logged in is enough (handled by auth)
    if (!options.permission) {
      return next()
    }

    const hasPerm = await user.hasPermission(options.permission)
    if (!hasPerm) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    return next()
  }
}
