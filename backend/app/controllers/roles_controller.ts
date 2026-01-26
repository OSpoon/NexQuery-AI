import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Permission from '#models/permission'

import AuditLog from '#models/audit_log'
import { isInternalIP } from '../utils/ip_utils.js'

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

    const role = await Role.create({ name, slug, description })

    if (permissionIds && permissionIds.length) {
      await role.related('permissions').attach(permissionIds)
    }

    await AuditLog.create({
      userId: currentUser.id,
      action: 'admin:create_role',
      entityType: 'role',
      entityId: String(role.id),
      status: 'success',
      details: { name, slug, permissionIds },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
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
      permissions: role.permissions.map(p => p.toJSON()),
    })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    const { name, slug, description, permissionIds } = request.all()
    const currentUser = auth.user!

    const previousData = role.toJSON()

    role.merge({ name, slug, description })
    await role.save()

    if (permissionIds) {
      await role.related('permissions').sync(permissionIds)
    }

    await AuditLog.create({
      userId: currentUser.id,
      action: 'admin:update_role',
      entityType: 'role',
      entityId: String(role.id),
      status: 'success',
      details: {
        previous: { name: previousData.name, slug: previousData.slug },
        new: { name, slug, permissionIds },
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
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

    await role.delete()

    await AuditLog.create({
      userId: currentUser.id,
      action: 'admin:delete_role',
      entityType: 'role',
      entityId: String(role.id),
      status: 'success',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({ message: 'Role deleted successfully' })
  }

  async permissions({ response }: HttpContext) {
    const permissions = await Permission.all()
    return response.ok(permissions)
  }
}
