import { HttpContext } from '@adonisjs/core/http'
import SseService from '#services/sse_service'

export default class NotificationsController {
  public async stream(ctx: HttpContext) {
    // console.log('[SSE] Incoming stream request', { url: ctx.request.url(true) })

    let userId = ctx.auth.user?.id

    // Support token in query for EventSource
    if (!userId) {
      const token = ctx.request.input('token')
      if (token) {
        try {
          // Manually authenticate using the token from query
          // IMPORTANT: The api guard looks for the 'authorization' header
          ctx.request.request.headers.authorization = `Bearer ${token}`

          const user = await ctx.auth.use('api').authenticate()
          userId = user?.id
          // console.info('[SSE] Manual auth succeeded', { userId })
        } catch (e: any) {
          console.error('[SSE] Manual auth failed', {
            message: e.message,
            code: e.code,
            stack: e.stack,
          })
        }
      } else {
        console.warn('[SSE] No token found in query')
      }
    }

    if (!userId) {
      return ctx.response.unauthorized()
    }

    SseService.addClient(ctx, userId)
  }
}
