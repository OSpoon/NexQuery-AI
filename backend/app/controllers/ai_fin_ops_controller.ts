import type { HttpContext } from '@adonisjs/core/http'
import AiUsageLog from '#models/ai_usage_log'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class AiFinOpsController {
  /**
   * Get aggregated stats for FinOps dashboard
   */
  async getStats({ response }: HttpContext) {
    // Permission handled by RBAC middleware

    // 1. Total Stats
    const totalStats = await db
      .from('ai_usage_logs')
      .select(
        db.raw('SUM(total_tokens) as total_tokens'),
        db.raw('SUM(estimated_cost) as total_cost'),
        db.raw('COUNT(*) as total_requests'),
      )
      .first()

    // 2. Model Distribution
    const modelDistribution = await db
      .from('ai_usage_logs')
      .select('model_name')
      .select(db.raw('SUM(total_tokens) as tokens'))
      .select(db.raw('SUM(estimated_cost) as cost'))
      .groupBy('model_name')

    // 3. User Distribution (Top 10)
    const userDistribution = await db
      .from('ai_usage_logs')
      .join('users', 'ai_usage_logs.user_id', 'users.id')
      .select('users.full_name', 'users.email')
      .select(db.raw('SUM(total_tokens) as tokens'))
      .select(db.raw('SUM(estimated_cost) as cost'))
      .groupBy('users.id', 'users.full_name', 'users.email')
      .orderBy('cost', 'desc')
      .limit(10)

    // 4. Daily Trend (Last 30 Days)
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toSQL()
    const dailyTrend = await db
      .from('ai_usage_logs')
      .select(db.raw('DATE(created_at) as date'))
      .select(db.raw('SUM(total_tokens) as tokens'))
      .select(db.raw('SUM(estimated_cost) as cost'))
      .where('created_at', '>=', thirtyDaysAgo!)
      .groupBy('date')
      .orderBy('date', 'asc')

    return response.ok({
      summary: {
        totalTokens: Number(totalStats.total_tokens || 0),
        totalCost: Number(totalStats.total_cost || 0),
        totalRequests: Number(totalStats.total_requests || 0),
      },
      modelDistribution,
      userDistribution,
      dailyTrend,
    })
  }

  /**
   * Get paginated usage logs
   */
  async getLogs({ request, response }: HttpContext) {
    // Permission handled by RBAC middleware

    const page = request.input('page', 1)
    const limit = request.input('limit', 20)

    const logs = await AiUsageLog.query()
      .preload('user')
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)

    return response.ok(logs)
  }
}
