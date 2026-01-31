import { HttpContext } from '@adonisjs/core/http'
import SseService from '#services/sse_service'
import User from '#models/user'

export default class NotificationsController {
  public async stream(ctx: HttpContext) {
    // console.log('[SSE] Incoming stream request', { url: ctx.request.url(true) })

    let userId = ctx.auth.user?.id

    // Support token in query for EventSource
    if (!userId) {
      const token = ctx.request.input('token')
      if (token) {
        try {
          // Manually verify the token using the DbAccessTokensProvider
          // Correct sequence for Opaque Tokens in AdonisJS 6
          const { Secret } = await import('@adonisjs/core/helpers')
          const accessTokens = (User as any).accessTokens
          const result = await accessTokens.verify(new Secret(token))

          if (result) {
            // In AdonisJS 6, verify() returns the AccessToken instance if successful
            userId = result.tokenableId
          }
        } catch (e: any) {
          console.error('[SSE] Manual auth failed', {
            message: e.message,
            code: e.code,
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
