import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Permission from '#models/permission'
import { AuditService } from '#services/audit_service'

export default class RolesController {
  async index({ response }: HttpContext) {
    const roles = await Role.query().preload('permissions')
    return response.ok(
      roles.map(role => ({
        ...role.toJSON(),
        permissions: role.permissions.map(p => p.toJSON()),
      })),
    )
  }

  async store({ request, response, auth }: HttpContext) {
    const { name, slug, description, permissionIds } = request.all()
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const role = await Role.create({ name, slug, description })

    if (permissionIds && permissionIds.length) {
      await role.related('permissions').attach(permissionIds)
    }

    await AuditService.logAdminAction({ request, auth } as any, 'create_role', {
      entityType: 'role',
      entityId: String(role.id),
      details: { name, slug, permissionIds },
    })

    await role.load('permissions')
    return response.created({
      ...role.toJSON(),
      permissions: role.permissions.map(p => p.toJSON()),
    })
  }

  async show({ params, response }: HttpContext) {
    const role = await Role.query().where('id', params.id).preload('permissions').firstOrFail()
    return response.ok({
      ...role.toJSON(),
    })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    const { name, slug, description, permissionIds } = request.all()
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const previousData = role.toJSON()

    role.merge({ name, slug, description })
    await role.save()

    if (permissionIds) {
      await role.related('permissions').sync(permissionIds)
    }

    await AuditService.logAdminAction({ request, auth } as any, 'update_role', {
      entityType: 'role',
      entityId: String(role.id),
      details: {
        previous: { name: previousData.name, slug: previousData.slug },
        new: { name, slug, permissionIds },
      },
    })

    await role.load('permissions')
    return response.ok({
      ...role.toJSON(),
      permissions: role.permissions.map(p => p.toJSON()),
    })
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    await role.delete()

    await AuditService.logAdminAction({ request, auth } as any, 'delete_role', {
      entityType: 'role',
      entityId: String(role.id),
    })

    return response.ok({ message: 'Role deleted successfully' })
  }

  async permissions({ response }: HttpContext) {
    const permissions = await Permission.all()
    return response.ok(permissions)
  }
}
