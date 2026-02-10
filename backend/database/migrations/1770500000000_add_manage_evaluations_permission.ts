import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  async up() {
    // Add permission if not exists
    const existing = await db.from('permissions').where('slug', 'manage_evaluations').first()
    if (!existing) {
      await db.table('permissions').insert({
        name: 'Manage Evaluations',
        slug: 'manage_evaluations',
        description: 'Can view and manage agent evaluation reports and trends',
        created_at: new Date(),
        updated_at: new Date(),
      })
    }

    // Assign to admin role (id: 1) if it exists
    const permission = await db.from('permissions').where('slug', 'manage_evaluations').first()
    const adminRole = await db.from('roles').where('id', 1).first()
    if (permission && adminRole) {
      // Check if already assigned
      const assigned = await db
        .from('permission_role')
        .where('role_id', 1)
        .where('permission_id', permission.id)
        .first()

      if (!assigned) {
        await db.table('permission_role').insert({
          role_id: 1,
          permission_id: permission.id,
        })
      }
    }
  }

  async down() {
    const permission = await db.from('permissions').where('slug', 'manage_evaluations').first()
    if (permission) {
      await db.from('permission_role').where('permission_id', permission.id).delete()
      await db.from('permissions').where('id', permission.id).delete()
    }
  }
}
