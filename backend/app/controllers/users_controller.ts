import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

import AuditLog from '#models/audit_log'
import { isInternalIP } from '../utils/ip_utils.js'

export default class UsersController {
  // ... index (omitted)
  async index({ response }: HttpContext) {
    const users = await User.query().preload('roles')
    return response.ok(
      users.map((user) => ({
        ...user.toJSON(),
        roles: user.roles.map((r) => r.toJSON()),
      }))
    )
  }

  async update({ params, request, response, auth }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const { fullName, email, roleIds, isActive } = request.all()
    const currentUser = auth.user!

    const previousData = user.toJSON()

    user.merge({ fullName, email, isActive })
    await user.save()

    if (roleIds) {
      await user.related('roles').sync(roleIds)
    }

    await AuditLog.create({
      userId: currentUser.id,
      action: 'admin:update_user',
      entityType: 'user',
      entityId: String(user.id),
      status: 'success',
      details: {
        previous: {
          fullName: previousData.fullName,
          email: previousData.email,
          isActive: previousData.isActive,
        },
        new: { fullName, email, isActive, roleIds },
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    await user.load('roles')
    return response.ok({
      ...user.toJSON(),
      roles: user.roles.map((r) => r.toJSON()),
    })
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const user = await User.query().where('id', params.id).preload('roles').firstOrFail()
    const currentUser = auth.user!

    // Check if the user being deleted is an admin
    const isAdmin = user.roles.some((role) => role.slug === 'admin')

    if (isAdmin) {
      // Count how many admins exist in total
      const admins = await User.query().whereHas('roles', (query) => {
        query.where('slug', 'admin')
      })

      if (admins.length <= 1) {
        return response.badRequest({
          message: 'Cannot delete the last administrator. At least one admin must remain.',
        })
      }
    }

    const userData = user.toJSON()
    await user.delete()

    await AuditLog.create({
      userId: currentUser.id,
      action: 'admin:delete_user',
      entityType: 'user',
      entityId: String(user.id),
      status: 'success',
      details: {
        deletedUser: { email: userData.email, fullName: userData.fullName },
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({ message: 'User deleted successfully' })
  }
}
