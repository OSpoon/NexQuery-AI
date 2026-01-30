import type { HttpContext } from '@adonisjs/core/http'
import QueryTask from '#models/query_task'
import QueryExecutionService from '#services/query_execution_service'

export default class ExecutionController {
  private executionService: QueryExecutionService

  constructor() {
    this.executionService = new QueryExecutionService()
  }

  async execute({ params, request, response, auth }: HttpContext) {
    const task = await QueryTask.query().where('id', params.id).preload('dataSource').firstOrFail()
    const inputParams = request.input('params', {})

    try {
      const result = await this.executionService.execute(task, inputParams, {
        userId: auth.user?.id,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
      })

      return response.ok({
        data: result.data,
        duration: result.duration,
      })
    } catch (error: any) {
      return response.badRequest({
        message: 'Query execution failed',
        error: error.message,
      })
    }
  }
}
