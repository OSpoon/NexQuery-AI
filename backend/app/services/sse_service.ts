import type { Response } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

type SseConnection = {
  response: Response
  userId: string
}

class SseService {
  private connections: Map<string, SseConnection[]> = new Map()

  /**
   * Add a new connection for a user
   */
  addConnection(userId: string, response: Response) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, [])
    }
    const userConns = this.connections.get(userId)!

    // Store connection wrapper
    const conn: SseConnection = { userId, response }
    userConns.push(conn)

    logger.info({ userId, total: userConns.length }, 'SSE Connection established')

    // Remove connection on close
    response.response.on('close', () => {
      this.removeConnection(userId, conn)
    })
  }

  /**
   * Remove a specific connection
   */
  private removeConnection(userId: string, conn: SseConnection) {
    const userConns = this.connections.get(userId)
    if (!userConns)
      return

    const index = userConns.indexOf(conn)
    if (index > -1) {
      userConns.splice(index, 1)
    }

    if (userConns.length === 0) {
      this.connections.delete(userId)
    }

    logger.debug({ userId, remaining: userConns.length }, 'SSE Connection closed')
  }

  /**
   * Send event to specific user
   */
  sendToUser(userId: string, eventName: string, data: any) {
    const userConns = this.connections.get(userId)
    if (!userConns || userConns.length === 0) {
      logger.debug({ userId }, 'No active SSE connections for user, skipping notification')
      return
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`

    userConns.forEach((conn) => {
      try {
        conn.response.response.write(payload)
      } catch (error) {
        logger.error({ userId, error: error.message }, 'Failed to write to SSE stream')
        this.removeConnection(userId, conn)
      }
    })
  }
}

export default new SseService()
