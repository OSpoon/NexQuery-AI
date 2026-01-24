import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  public async up() {}

  public async down() {}
}
