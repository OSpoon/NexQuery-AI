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

    // Keep alive
    const timer = setInterval(() => {
      send({ type: 'ping' })
    }, 30000)

    request.request.on('close', () => {
      clearInterval(timer)
      this.clients.delete(clientId)
    })

    return client
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
