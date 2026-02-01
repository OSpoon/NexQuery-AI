import Permission from '#models/permission'
import type { HttpContext } from '@adonisjs/core/http'

export default class PermissionsController {
  /**
   * List all permissions
   */
  async index({ response }: HttpContext) {
    const permissions = await Permission.query().orderBy('slug', 'asc')
    return response.ok(permissions)
  }

  /**
   * Create a new permission
   */
  async store({ request, response }: HttpContext) {
    const data = request.only(['name', 'slug', 'description'])

    // Check if slug already exists
    const existing = await Permission.findBy('slug', data.slug)
    if (existing) {
      return response.badRequest({ message: 'Permission with this slug already exists' })
    }

    const permission = await Permission.create(data)
    return response.created(permission)
  }

  /**
   * Show a single permission
   */
  async show({ params, response }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    return response.ok(permission)
  }

  /**
   * Update a permission
   */
  async update({ params, request, response }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    const data = request.only(['name', 'slug', 'description'])

    // Check if slug is being changed and if new slug exists
    if (data.slug && data.slug !== permission.slug) {
      const existing = await Permission.findBy('slug', data.slug)
      if (existing) {
        return response.badRequest({ message: 'Permission with this slug already exists' })
      }
    }

    permission.merge(data)
    await permission.save()
    return response.ok(permission)
  }

  /**
   * Delete a permission
   */
  async destroy({ params, response }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)

    // Optional: Check if permission is in use (e.g. by roles or menus)
    // For now, let Lucid's relationship constraints or manual deletion handle it.

    await permission.delete()
    return response.ok({ message: 'Permission deleted successfully' })
  }
}
