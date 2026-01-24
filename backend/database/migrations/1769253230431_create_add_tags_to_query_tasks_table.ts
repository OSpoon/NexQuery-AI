import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'query_tasks'

    public async up() {
        // Migration already handled or to be handled by newer migration
    }

    public async down() {
    }
}
