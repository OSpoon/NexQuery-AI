import { BaseSchema } from '@adonisjs/lucid/schema'
import Menu from '#models/menu'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    // Current state: Administration menu requires 'manage_users'
    // This prevents users with ONLY 'manage_roles' (or other sub-permissions) from seeing the group.
    // Fix: Set permission to NULL. The frontend should hide the group if no children are visible.

    const adminMenu = await Menu.findBy('title', 'Administration')
    if (adminMenu) {
      adminMenu.permission = null
      await adminMenu.save()
    }
  }

  async down() {
    const adminMenu = await Menu.findBy('title', 'Administration')
    if (adminMenu) {
      adminMenu.permission = 'manage_users'
      await adminMenu.save()
    }
  }
}
