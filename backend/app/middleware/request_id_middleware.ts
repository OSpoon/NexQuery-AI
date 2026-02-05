import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import { randomUUID } from 'node:crypto'

export default class RequestIdMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const requestId = ctx.request.header('x-request-id') || randomUUID()

    // Add it to response headers so client can provide it in bug reports
    ctx.response.header('x-request-id', requestId)

    // Store it in context so other parts of the application can access it
    // Using ctx.request.requestData is one way, but ctx.request.id might be cleaner if we extend it
    // For simplicity, we just attach it to the request object or a dedicated property
    ;(ctx as any).requestId = requestId

    await next()
  }
}
