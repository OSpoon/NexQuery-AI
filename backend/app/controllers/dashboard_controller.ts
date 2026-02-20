import type { HttpContext } from '@adonisjs/core/http'
import DataSource from '#models/data_source'
import QueryTask from '#models/query_task'
import QueryLog from '#models/query_log'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class DashboardController {
  async index({ request, response, auth }: HttpContext) {
    const user = auth.user!
    await user.load('roles')
    const isGlobalView = user.isAdmin

    const timeRange = request.input('timeRange', '7d')
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 90 }
    const days = daysMap[timeRange] || 7

    const stats: any = {
      totalQueries: await QueryLog.query()
        .if(!isGlobalView, q => q.where('user_id', user.id))
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0)),
    }

    if (isGlobalView) {
      stats.totalDataSources = await DataSource.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0))
      stats.totalTasks = await QueryTask.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0))
      stats.totalUsers = await User.query()
        .count('* as total')
        .first()
        .then(r => Number(r?.$extras.total || 0))
    }

    const startDate = DateTime.local().minus({ days: days - 1 }).startOf('day').toSQL()!

    // Efficient Trend JS Aggregation
    const trendQuery = QueryLog.query().where('created_at', '>=', startDate).select('created_at', 'status')
    if (!isGlobalView) {
      trendQuery.where('user_id', user.id)
    }
    const rawTrend = await trendQuery

    const trendMap = new Map()
    for (let i = days - 1; i >= 0; i--) {
      trendMap.set(DateTime.local().minus({ days: i }).toISODate(), { success: 0, failed: 0, total: 0 })
    }

    // rawTrend created_at is a luxon DateTime in Lucid
    for (const log of rawTrend) {
      const d = log.createdAt.toISODate()
      if (d && trendMap.has(d)) {
        const obj = trendMap.get(d)
        if (log.status === 'success')
          obj.success++
        else obj.failed++
        obj.total++
      }
    }

    const trend = Array.from(trendMap.entries()).map(([date, data]) => ({ date, ...data as any }))

    // Top 5 Data Sources
    const topSourcesQuery = QueryLog.query()
      .where('query_logs.created_at', '>=', startDate)
      .leftJoin('data_sources', 'query_logs.data_source_id', 'data_sources.id')
      .select('data_sources.name')
      .count('* as total')
      .groupBy('data_sources.name')
      .orderBy('total', 'desc')
      .limit(5)
    if (!isGlobalView)
      topSourcesQuery.where('query_logs.user_id', user.id)

    const topSources = await topSourcesQuery.then(rows =>
      rows.map(r => ({
        name: r.$extras.name || 'Unknown',
        total: Number(r.$extras.total),
      })),
    )

    // Top 5 Users
    let topUsers: any[] = []
    if (isGlobalView) {
      topUsers = await QueryLog.query()
        .where('query_logs.created_at', '>=', startDate)
        .join('users', 'query_logs.user_id', 'users.id')
        .select('users.full_name')
        .count('* as total')
        .groupBy('users.full_name')
        .orderBy('total', 'desc')
        .limit(5)
        .then(rows =>
          rows.map(r => ({ name: r.$extras.full_name, total: Number(r.$extras.total) })),
        )
    }

    const recentLogsQuery = QueryLog.query()
      .preload('user')
      .preload('task')
      .orderBy('createdAt', 'desc')
      .limit(5)
    if (!isGlobalView) {
      recentLogsQuery.where('user_id', user.id)
    }
    const recentLogs = await recentLogsQuery

    return response.ok({
      stats,
      trend,
      topSources,
      topUsers,
      recentLogs,
      isGlobalView, // Return this so frontend knows what to render
    })
  }
}
