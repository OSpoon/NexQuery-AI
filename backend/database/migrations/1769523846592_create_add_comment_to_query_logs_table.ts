import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('approval_comment').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
