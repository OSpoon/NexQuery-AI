import type { HttpContext } from '@adonisjs/core/http'
import LangChainService from '#services/lang_chain_service'
import AiConversation from '#models/ai_conversation'
import AiMessage from '#models/ai_message'
import DataSource from '#models/data_source'
import QueryExecutionService from '#services/query_execution_service'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

@inject()
export default class AiController {
  constructor(protected executionService: QueryExecutionService) {}

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
      if (response.response.writableEnded)
        return

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

  async getConversations({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await AiConversation.query()
      .where('user_id', user.id)
      .orderBy('updated_at', 'desc')
    return response.ok(conversations)
  }

  async getConversationMessages({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await AiConversation.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .preload('messages', query => query.orderBy('created_at', 'asc'))
      .firstOrFail()

    return response.ok(conversation)
  }

  async deleteConversation({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await AiConversation.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .firstOrFail()

    await conversation.delete()
    return response.ok({ message: 'Conversation deleted' })
  }

  async chatStream({ auth, request, response }: HttpContext) {
    if (!request.input('question')) {
      return response.badRequest({ message: 'Question is required' })
    }

    const user = auth.getUserOrFail()
    const { question, dbType, dataSourceId, history, conversationId } = request.all()

    // Handle Conversation Persistence
    let conversation: AiConversation
    if (conversationId) {
      conversation = await AiConversation.query()
        .where('id', conversationId)
        .where('user_id', user.id)
        .firstOrFail()
    } else {
      conversation = await AiConversation.create({
        userId: user.id,
        title: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
        dataSourceId: dataSourceId ? Number(dataSourceId) : null,
      })
    }

    // Save User Message
    await AiMessage.create({
      conversationId: conversation.id,
      role: 'user',
      content: question,
    })

    // Set standard SSE headers using framework methods
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    response.header('X-Accel-Buffering', 'no')

    // Explicitly send headers to the client immediately
    response.response.flushHeaders()

    // Notify frontend of conversation ID (always send it so frontend can sync)
    response.response.write(
      `data: ${JSON.stringify({ type: 'conversation_id', id: conversation.id })}\n\n`,
    )

    try {
      const langChainService = new LangChainService()
      const dsId = dataSourceId ? Number(dataSourceId) : conversation.dataSourceId || undefined

      const stream = langChainService.naturalLanguageToSqlStream(question, {
        dbType,
        dataSourceId: dsId,
        history,
      })

      let fullAssistantContent = ''
      const agentSteps: any[] = []

      for await (const chunk of stream) {
        // chunk is already a JSON string from the service (e.g. {"type": "thought", ...})
        response.response.write(`data: ${chunk}\n\n`)

        // Parse chunk to collect content and steps for saving
        try {
          const data = JSON.parse(chunk)
          if (data.type === 'thought') {
            fullAssistantContent += data.content
            const lastStep = agentSteps[agentSteps.length - 1]
            if (lastStep && lastStep.type === 'thought') {
              lastStep.content = (lastStep.content || '') + data.content
            } else {
              agentSteps.push({ type: 'thought', content: data.content })
            }
          } else if (data.type === 'tool_start') {
            agentSteps.push({
              type: 'tool',
              toolName: data.tool,
              toolInput: data.input,
              toolId: data.id,
              status: 'running',
            })
          } else if (data.type === 'tool_end') {
            const toolStep = agentSteps.find(s => s.type === 'tool' && s.toolId === data.id)
            if (toolStep) {
              toolStep.toolOutput = data.output
              toolStep.status = 'done'
            }
          } else if (data.type === 'response') {
            // Final Answer: Overwrite content (thoughts are already captured in agentSteps)
            // This ensures the main message body contains the clean final output
            fullAssistantContent = data.content
          }
        } catch (e) {
          // Chunk parsing failed
        }
      }

      // Save Assistant Message
      if (fullAssistantContent) {
        await AiMessage.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: fullAssistantContent,
          prompt: question,
          agentSteps,
        })

        // Update conversation timestamp
        conversation.updatedAt = DateTime.now()
        await conversation.save()
      }

      response.response.end()
    } catch (error: any) {
      if (response.response.writableEnded)
        return

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

  async preview({ request, response, auth }: HttpContext) {
    const { dataSourceId, sql } = request.all()

    if (!dataSourceId || !sql) {
      return response.badRequest({ message: 'DataSource ID and SQL are required' })
    }

    try {
      const dataSource = await DataSource.findOrFail(dataSourceId)
      const result = await this.executionService.rawExecute(dataSource, sql, {
        userId: auth.user?.id,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
      })

      return response.ok(result)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Preview failed',
        error: error.message,
      })
    }
  }
}
