import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { AuditService } from '#services/audit_service'

export default class UsersController {
  async index({ auth, response }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }
    const users = await User.query().preload('roles')
    return response.ok(
      users.map(user => ({
        ...user.toJSON(),
        roles: user.roles.map(r => r.toJSON()),
      })),
    )
  }

  async update({ params, request, response, auth }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const { fullName, email, roleIds, isActive } = request.all()
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const previousData = user.toJSON()

    user.merge({ fullName, email, isActive })
    await user.save()

    if (roleIds) {
      await user.related('roles').sync(roleIds)
    }

    await AuditService.logAdminAction({ request, auth } as any, 'update_user', {
      entityType: 'user',
      entityId: String(user.id),
      details: {
        previous: {
          fullName: previousData.fullName,
          email: previousData.email,
          isActive: previousData.isActive,
        },
        new: { fullName, email, isActive, roleIds },
      },
    })

    await user.load('roles')
    return response.ok({
      ...user.toJSON(),
      roles: user.roles.map(r => r.toJSON()),
    })
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const user = await User.query().where('id', params.id).preload('roles').firstOrFail()
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    // Check if the user being deleted is an admin
    const isAdmin = user.roles.some(role => role.slug === 'admin')

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

    await AuditService.logAdminAction({ request, auth } as any, 'delete_user', {
      entityType: 'user',
      entityId: String(user.id),
      details: {
        deletedUser: { email: userData.email, fullName: userData.fullName },
      },
    })

    return response.ok({ message: 'User deleted successfully' })
  }
}
