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

      // Handle database errors specifically to prevent SQL leakage
      let message = error.message
      const isDatabaseError
        = error.code?.includes('DB_')
          || error.code?.includes('SQL')
          || error.message?.toLowerCase().includes('select')
          || error.message?.toLowerCase().includes('relation')
          || error.message?.toLowerCase().includes('column')
          || error.message?.toLowerCase().includes('syntax error')

      if (isDatabaseError) {
        // Always log database errors for admin review
        console.error('[Database Error]:', error.message)

        // Return a generic message unless in debug mode AND specifically requested
        if (!this.debug) {
          message = '数据库操作异常，请检查连接或联系管理员'
        }
      }

      return ctx.response.status(status).send({
        message,
        code: error.code,
        errors: error.messages || undefined, // For validation errors
        stack: this.debug ? error.stack : undefined,
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
