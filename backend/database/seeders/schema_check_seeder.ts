import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
    async run() {
        console.log('--- DB SCHEMA CHECK ---')
        try {
            const result = await db.rawQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'query_tasks';")
            console.log('Columns in query_tasks:')
            result.rows.forEach(row => {
                console.log(` - ${row.column_name}: ${row.data_type}`)
            })
        } catch (e) {
            console.error('Failed to query schema', e)
        }
        console.log('----------------------')
    }
}
