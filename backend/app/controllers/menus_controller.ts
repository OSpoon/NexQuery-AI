import Menu from '#models/menu'
import Permission from '#models/permission'
import type { HttpContext } from '@adonisjs/core/http'

export default class MenusController {
  // Public access for sidebar (returns tree structure)
  async public({ auth }: HttpContext) {
    const user = auth.user!

    const menus = await Menu.query().where('isActive', true).orderBy('sortOrder', 'asc')

    // Filter by permissions and build tree
    // Correctly handle async filtering
    const accessibilityResults = await Promise.all(
      menus.map(async (menu) => {
        if (!menu.permission) return true
        return await user.hasPermission(menu.permission)
      })
    )

    const accessibleMenus = menus.filter((_, index) => accessibilityResults[index])

    // Basic tree builder
    const buildTree = (parentId: number | null): any[] => {
      return accessibleMenus
        .filter((m) => m.parentId === parentId)
        .map((m) => ({
          ...m.toJSON(),
          children: buildTree(m.id),
        }))
    }

    return buildTree(null)
  }

  // Admin access (flat list with search/filter)
  async index({ response }: HttpContext) {
    const menus = await Menu.query().preload('parent').orderBy('sortOrder', 'asc')
    return response.ok(menus)
  }

  async getRoutePermissions({ response }: HttpContext) {
    const menus = await Menu.query()
      .whereNotNull('permission')
      .whereNotNull('path')
      .where('isActive', true)
      .select('path', 'permission')

    const routePermissions = menus.reduce(
      (acc, menu) => {
        if (menu.path && menu.permission) {
          acc[menu.path] = menu.permission
        }
        return acc
      },
      {} as Record<string, string>
    )

    return response.ok(routePermissions)
  }

  private async ensurePermissionExists(slug: string | null) {
    if (!slug) return
    const existing = await Permission.findBy('slug', slug)
    if (!existing) {
      await Permission.create({
        name: slug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        slug: slug,
        description: `Automatically created for menu permission: ${slug}`,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = request.only([
      'parentId',
      'title',
      'path',
      'icon',
      'permission',
      'sortOrder',
      'isActive',
    ])

    if (data.permission) {
      await this.ensurePermissionExists(data.permission)
    }

    const menu = await Menu.create(data)
    return response.created(menu)
  }

  async update({ params, request, response }: HttpContext) {
    const menu = await Menu.findOrFail(params.id)
    const data = request.only([
      'parentId',
      'title',
      'path',
      'icon',
      'permission',
      'sortOrder',
      'isActive',
    ])

    if (data.permission) {
      await this.ensurePermissionExists(data.permission)
    }

    menu.merge(data)
    await menu.save()
    return response.ok(menu)
  }

  async destroy({ params, response }: HttpContext) {
    const menu = await Menu.findOrFail(params.id)
    await menu.delete()
    return response.ok({ message: 'Menu deleted' })
  }
}
