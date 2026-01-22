import type { HttpContext } from '@adonisjs/core/http'
import QueryLog from '#models/query_log'

export default class QueryLogsController {
  async index({ response, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)

    const logs = await QueryLog.query()
      .preload('user')
      .preload('task')
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)

    return response.ok(logs)
  }
}
