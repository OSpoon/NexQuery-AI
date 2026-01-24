import { BaseSeeder } from '@adonisjs/lucid/seeders'
import QueryTask from '#models/query_task'

export default class extends BaseSeeder {
  async run() {
    const tasks = await QueryTask.all()
    console.log('--- DATABASE CHECK ---')
    console.log('Total tasks in DB:', tasks.length)

    // Check for a specific user (the first one usually)
    const userImport = await import('#models/user')
    const User = userImport.default
    const user = await User.query()
      .preload('roles', (q) => q.preload('permissions'))
      .first()

    if (user) {
      console.log(`User: ${user.fullName} (${user.email})`)
      console.log(`Roles: ${user.roles.map((r) => r.name).join(', ')}`)
      const permissions = user.roles.flatMap((r) => r.permissions.map((p) => p.slug))
      console.log(`Permissions: ${permissions.join(', ')}`)
    }

    console.log('--- CONTROLLER QUERY SIMULATION ---')
    const query = QueryTask.query().preload('dataSource').preload('creator')
    const results = await query
    console.log('Query results count:', results.length)
    if (results.length > 0) {
      console.log('First task tags:', JSON.stringify(results[0].tags))
    }
    console.log('----------------------')
  }
}
