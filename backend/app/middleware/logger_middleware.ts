import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'

export default class LoggerMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const startTime = Date.now()

    await next()

    const duration = Date.now() - startTime
    const status = response.getStatus()
    const method = request.method()
    const url = request.url()

    logger.info(
      {
        method,
        url,
        status,
        duration: `${duration}ms`,
        ip: request.ip(),
      },
      `HTTP Request: ${method} ${url} - ${status} (${duration}ms)`,
    )
  }
}
