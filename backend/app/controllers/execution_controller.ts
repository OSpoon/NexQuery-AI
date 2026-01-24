import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import QueryTask from '#models/query_task'
import logger from '@adonisjs/core/services/logger'
import QueryExecutionService from '#services/query_execution_service'

@inject()
export default class ExecutionController {
  constructor(protected executionService: QueryExecutionService) { }

  async execute({ params, request, response, auth }: HttpContext) {
    const task = await QueryTask.query().where('id', params.id).preload('dataSource').firstOrFail()

    const inputParams = request.input('params', {})

    try {
      const result = await this.executionService.execute(task, inputParams, {
        userId: auth.user?.id,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
      })

      // Debug IP Resolution
      logger.info(
        {
          'ip': request.ip(),
          'ips': request.ips(),
          'headers': request.headers(),
          'x-forwarded-for': request.header('x-forwarded-for'),
          'x-real-ip': request.header('x-real-ip'),
        },
        'Debug: IP Resolution Details'
      )

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
