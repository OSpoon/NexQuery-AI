import type { HttpContext } from '@adonisjs/core/http'
import LangChainService from '#services/lang_chain_service'

export default class AiController {
  async optimizeSql({ request, response }: HttpContext) {
    const { sql, dbType, schema } = request.all()

    if (!sql) {
      return response.badRequest({ message: 'SQL query is required' })
    }

    // Set standard SSE headers
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    response.header('X-Accel-Buffering', 'no')

    response.response.flushHeaders()

    try {
      const langChainService = new LangChainService()
      const stream = langChainService.optimizeSqlStream(sql, { dbType, schema })

      for await (const chunk of stream) {
        response.response.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      }

      response.response.end()
    } catch (error: any) {
      if (response.response.writableEnded) return

      response.response.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
      response.response.end()
    }
  }
  async chat({ request, response }: HttpContext) {
    const { question, dbType, schema } = request.all()

    if (!question) {
      return response.badRequest({ message: 'Question is required' })
    }

    try {
      const langChainService = new LangChainService()
      const sql = await langChainService.naturalLanguageToSql(question, {
        dbType,
        schema,
        dataSourceId: request.input('dataSourceId'),
      })

      return response.ok({ sql })
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to generate SQL',
        error: error.message,
      })
    }
  }

  async chatStream({ request, response }: HttpContext) {
    if (!request.input('question')) {
      return response.badRequest({ message: 'Question is required' })
    }

    // Set standard SSE headers using framework methods
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    response.header('X-Accel-Buffering', 'no')

    // Explicitly send headers to the client immediately
    response.response.flushHeaders()

    try {
      const { question, dbType, dataSourceId, history } = request.all()
      const langChainService = new LangChainService()
      const dsId = dataSourceId ? Number(dataSourceId) : undefined

      const stream = langChainService.naturalLanguageToSqlStream(question, {
        dbType,
        dataSourceId: dsId,
        history,
      })

      for await (const chunk of stream) {
        // chunk is already a JSON string from the service (e.g. {"type": "thought", ...})
        response.response.write(`data: ${chunk}\n\n`)
      }

      response.response.end()
    } catch (error: any) {
      if (response.response.writableEnded) return

      const errorMsg = `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`
      response.response.write(errorMsg)
      response.response.end()
    }
  }
  async learn({ request, response }: HttpContext) {
    const { question, sql } = request.all()

    if (!question || !sql) {
      return response.badRequest({ message: 'Question and SQL are required' })
    }

    try {
      const langChainService = new LangChainService()
      // Async fire-and-forget learning to not block response
      langChainService.learnInteraction(question, sql)

      return response.ok({ message: 'Learning started' })
    } catch (error: any) {
      // Even if learning fails, we usually don't want to break the UI flow, but here we report it
      return response.internalServerError({
        message: 'Failed to initiate learning',
        error: error.message,
      })
    }
  }
}
