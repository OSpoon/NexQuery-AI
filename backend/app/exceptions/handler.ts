import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import { ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: any, ctx: HttpContext) {
    if (ctx.request.url().startsWith('/api')) {
      ctx.request.request.headers.accept = 'application/json'
      const status = error.status || 500

      // Handle all internal server errors uniformly
      if (status >= 500) {
        // Always log internal errors for admin review
        logger.error({ err: error, url: ctx.request.url() }, '[System Error]')

        // Mask internal errors to prevent leakage of sensitive info (SQL, paths, etc.)
        return ctx.response.status(500).send({
          message: 'System Error',
          code: 'E_SYSTEM_ERROR',
        })
      }

      return ctx.response.status(status).send({
        message: error.message,
        code: error.code,
        errors: error.messages || undefined, // For validation errors
      })
    }
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
