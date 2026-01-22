import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('parameters').nullable().after('task_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('parameters')
    })
  }
}
