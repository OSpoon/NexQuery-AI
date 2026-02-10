import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  async up() {
    // 1. Get Administration group
    const adminGroup = await db.from('menus').where('path', '#admin-group').first()

    if (adminGroup) {
      // 2. Add Spider Evaluation menu item if not exists
      const existing = await db.from('menus').where('path', '/admin/evaluations').first()
      if (!existing) {
        await db.table('menus').insert({
          parent_id: adminGroup.id,
          title: 'Data Evaluation',
          path: '/admin/evaluations',
          icon: 'TrendingUp',
          permission: 'manage_evaluations',
          sort_order: 85, // Before other admin items
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }
    }
  }

  async down() {
    await db.from('menus').where('path', '/admin/evaluations').delete()
  }
}
