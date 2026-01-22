import { BaseSchema } from '@adonisjs/lucid/schema'
import Permission from '#models/permission'
import Role from '#models/role'
import Menu from '#models/menu'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    // 1. Create new permissions
    const newPerms = [
      {
        name: 'Manage Knowledge Base',
        slug: 'manage_knowledge_base',
        description: 'Can manage business terms and RAG context',
      },
      {
        name: 'Manage API Keys',
        slug: 'manage_api_keys',
        description: 'Can manage system API keys',
      },
    ]

    const createdPerms: Permission[] = []
    for (const p of newPerms) {
      const perm = await Permission.firstOrCreate({ slug: p.slug }, p)
      createdPerms.push(perm)
    }

    // 2. Assign to Admin Role
    const adminRole = await Role.findBy('slug', 'admin')
    if (adminRole) {
      // Use attach to avoid removing existing permissions
      await adminRole.related('permissions').attach(createdPerms.map((p) => p.id))
    }

    // 3. Update "API Access" Menu to require manage_api_keys
    const apiMenu = await Menu.findBy('path', '/admin/api-keys')
    if (apiMenu) {
      apiMenu.permission = 'manage_api_keys'
      await apiMenu.save()
    }
  }

  async down() {
    // Revert changes if needed (optional for this context, but good practice)
    const apiMenu = await Menu.findBy('path', '/admin/api-keys')
    if (apiMenu) {
      apiMenu.permission = 'manage_users' // Revert to previous
      await apiMenu.save()
    }

    const perms = await Permission.query().whereIn('slug', [
      'manage_knowledge_base',
      'manage_api_keys',
    ])
    for (const p of perms) {
      await p.delete()
    }
  }
}
