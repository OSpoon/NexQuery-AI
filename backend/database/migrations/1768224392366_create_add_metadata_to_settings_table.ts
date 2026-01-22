import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('label').nullable().after('value')
      table.text('description').nullable().after('label')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('label')
      table.dropColumn('description')
    })
  }
}
