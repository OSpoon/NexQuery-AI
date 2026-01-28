import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('process_instance_id').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('process_instance_id')
    })
  }
}
