import { BaseSchema } from '@adonisjs/lucid/schema'
import Menu from '#models/menu'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    // Check if menu already exists
    const existing = await Menu.findBy('path', '/knowledge-base')
    if (existing) {
      return
    }

    await Menu.create({
      title: 'Knowledge Base',
      path: '/knowledge-base',
      icon: 'BookOpen',
      permission: 'manage_knowledge_base',
      sortOrder: 35, // After Data Sources (30) and before History (40)
      isActive: true,
    })
  }

  async down() {
    const menu = await Menu.findBy('path', '/knowledge-base')
    if (menu) {
      await menu.delete()
    }
  }
}
