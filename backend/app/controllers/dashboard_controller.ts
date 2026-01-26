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
        .then(r => Number(r?.$extras.total || 0)),
      totalTasks: await QueryTask.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0)),
      totalQueries: await QueryLog.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0)),
      totalUsers: await User.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0)),
    }

    // Get recent 7 days query activity (Success vs Failure)
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const targetDate = DateTime.local().minus({ days: i })
      const startOfDay = targetDate.startOf('day').toSQL()
      const endOfDay = targetDate.endOf('day').toSQL()

      const counts = await QueryLog.query()
        .whereBetween('created_at', [startOfDay, endOfDay])
        .select('status')
        .count('* as total')
        .groupBy('status')

      let success = 0
      let failed = 0

      counts.forEach((c) => {
        if (c.status === 'success')
          success = Number(c.$extras.total)
        else failed = Number(c.$extras.total)
      })

      trend.push({ date: targetDate.toISODate(), success, failed, total: success + failed })
    }

    // Top 5 Data Sources
    const topSources = await QueryLog.query()
      .leftJoin('data_sources', 'query_logs.data_source_id', 'data_sources.id')
      .select('data_sources.name')
      .count('* as total')
      .groupBy('data_sources.name')
      .orderBy('total', 'desc')
      .limit(5)
      .then(rows =>
        rows.map(r => ({
          name: r.$extras.name || 'Unknown',
          total: Number(r.$extras.total),
        })),
      )

    // Top 5 Users
    const topUsers = await QueryLog.query()
      .join('users', 'query_logs.user_id', 'users.id')
      .select('users.full_name')
      .count('* as total')
      .groupBy('users.full_name')
      .orderBy('total', 'desc')
      .limit(5)
      .then(rows =>
        rows.map(r => ({ name: r.$extras.full_name, total: Number(r.$extras.total) })),
      )

    const recentLogs = await QueryLog.query()
      .preload('user')
      .preload('task')
      .orderBy('createdAt', 'desc')
      .limit(5)

    return response.ok({
      stats,
      trend,
      topSources,
      topUsers,
      recentLogs,
    })
  }
}
