import { HttpContext } from '@adonisjs/core/http'

export interface SseClient {
  id: string
  userId: number
  send: (data: any) => void
  close: () => void
}

export default class SseService {
  private static clients: Map<string, SseClient> = new Map()

  public static addClient(ctx: HttpContext, userId: number) {
    const { response, request } = ctx
    const clientId = Math.random().toString(36).substring(7)

    response.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.header('origin') || '*',
    })

    if (response.response.flushHeaders) {
      response.response.flushHeaders()
    }

    const send = (data: any) => {
      response.response.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    const client: SseClient = {
      id: clientId,
      userId,
      send,
      close: () => {
        response.response.end()
        this.clients.delete(clientId)
      },
    }

    this.clients.set(clientId, client)

    return client
  }

  /**
   * Initialize a standard SSE stream for an HTTP Context
   */
  public static initStream(ctx: HttpContext) {
    const { response, request } = ctx

    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    response.header('X-Accel-Buffering', 'no')
    response.header('Access-Control-Allow-Origin', request.header('origin') || '*')

    // Explicitly send headers to the client immediately
    if (response.response.flushHeaders) {
      response.response.flushHeaders()
    }
  }

  public static dispatchToUser(userId: number, data: any) {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        client.send(data)
      }
    }
  }

  public static dispatchToAll(data: any) {
    for (const client of this.clients.values()) {
      client.send(data)
    }
  }
}
