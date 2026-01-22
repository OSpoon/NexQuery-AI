import type { HttpContext } from '@adonisjs/core/http'
import DataSource from '#models/data_source'
import QueryTask from '#models/query_task'
import QueryLog from '#models/query_log'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class DashboardController {
  async index({ response }: HttpContext) {
    const stats = {
      totalDataSources: await DataSource.query()
        .count('* as total')
        .first()
        .then((r) => r?.$extras.total || 0),
      totalTasks: await QueryTask.query()
        .count('* as total')
        .first()
        .then((r) => r?.$extras.total || 0),
      totalQueries: await QueryLog.query()
        .count('* as total')
        .first()
        .then((r) => r?.$extras.total || 0),
      totalUsers: await User.query()
        .count('* as total')
        .first()
        .then((r) => r?.$extras.total || 0),
    }

    // Get recent 7 days query activity
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = DateTime.local().minus({ days: i }).toISODate()
      const count = await QueryLog.query()
        .whereRaw('DATE(created_at) = ?', [date])
        .count('* as total')
        .first()
        .then((r) => r?.$extras.total || 0)

      last7Days.push({ date, count })
    }

    const recentLogs = await QueryLog.query()
      .preload('user')
      .preload('task')
      .orderBy('createdAt', 'desc')
      .limit(5)

    return response.ok({
      stats,
      chartData: last7Days,
      recentLogs,
    })
  }
}
