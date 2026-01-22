import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'data_sources'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('config').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('config')
    })
  }
}
