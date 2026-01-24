import type { HttpContext } from '@adonisjs/core/http'
import QueryLog from '#models/query_log'

export default class QueryLogsController {
  async index({ response, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search')
    const status = request.input('status')
    const tag = request.input('tag')

    const query = QueryLog.query()
      .preload('user')
      .preload('task', (taskQuery) => {
        taskQuery.preload('dataSource')
      })
      .orderBy('createdAt', 'desc')

    if (status) {
      query.where('status', status)
    }

    if (search) {
      query.whereHas('task', (taskQuery) => {
        taskQuery.where('name', 'like', `%${search}%`)
      })
    }

    if (tag && tag !== 'undefined' && tag !== 'null' && tag !== '' && tag !== 'All') {
      query.whereHas('task', (taskQuery) => {
        taskQuery.whereRaw('tags @> ?::jsonb', [JSON.stringify([tag])])
      })
    }

    const logs = await query.paginate(page, limit)

    return response.ok(logs)
  }
}
