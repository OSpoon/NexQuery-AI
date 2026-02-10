import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  async up() {
    await db.from('menus').where('path', '/admin/evaluations').update({ sort_order: 85 })
  }

  async down() {
    await db.from('menus').where('path', '/admin/evaluations').update({ sort_order: 97 })
  }
}
