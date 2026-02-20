import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    this.defer(async (db) => {
      await db.from(this.tableName).where('path', '/admin/finops').delete()
    })
  }

  async down() {
    // Menu restoration would go here if needed
  }
}
