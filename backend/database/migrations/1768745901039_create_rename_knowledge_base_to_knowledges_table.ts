import { BaseSchema } from '@adonisjs/lucid/schema'
import Menu from '#models/menu'
import Permission from '#models/permission'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    // 1. Rename Menu
    const menu = await Menu.findBy('title', 'Knowledge Base')
    if (menu) {
      menu.title = 'Knowledge'
      await menu.save()
    }

    // 2. Rename Permission
    const perm = await Permission.findBy('slug', 'manage_knowledge_base')
    if (perm) {
      perm.name = 'Manage Knowledge'
      await perm.save()
    }
  }

  async down() {
    // Revert Menu
    const menu = await Menu.findBy('title', 'Knowledge')
    if (menu) {
      menu.title = 'Knowledge Base'
      await menu.save()
    }

    // Revert Permission
    const perm = await Permission.findBy('slug', 'manage_knowledge_base')
    if (perm) {
      perm.name = 'Manage Knowledge Base'
      await perm.save()
    }
  }
}
