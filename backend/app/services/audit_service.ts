import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'
import { isInternalIP } from '../utils/ip_utils.js'

export class AuditService {
  /**
   * Log an audit action with automatic extraction of request context
   */
  public static async log(
    ctx: HttpContext | { request: HttpContext['request'], auth: HttpContext['auth'] },
    options: {
      action: string
      entityType?: string
      entityId?: string
      status?: 'success' | 'failure'
      details?: any
      userId?: number
    },
  ) {
    const { request, auth } = ctx
    const userId = options.userId || auth.user?.id

    if (!userId && !options.action.startsWith('auth:')) {
      // Skip logging if no user is authenticated and it's not an auth action (e.g., failed login)
      return
    }

    await AuditLog.create({
      userId,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      status: options.status || 'success',
      details: options.details,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })
  }

  /**
   * Shortcut for admin-level audit logging
   */
  public static async logAdminAction(ctx: HttpContext, action: string, details: any = {}) {
    return this.log(ctx, {
      action: `admin:${action}`,
      status: 'success',
      details,
    })
  }
}
