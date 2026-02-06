import KnowledgeBaseService from '#services/knowledge_base_service'
import AiUsageService from '#services/ai_usage_service'

import type {
  AIMessageChunk,
  BaseMessage,
} from '@langchain/core/messages'
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import AiProviderService from '#services/ai_provider_service'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { SecuritySkill } from '#services/skills/security_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { LuceneSkill } from '#services/skills/lucene_skill'
import type { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import DataSource from '#models/data_source'
import logger from '@adonisjs/core/services/logger'

import {
  GENERAL_CHAT_SYSTEM_PROMPT,
  SQL_OPTIMIZATION_PROMPT_TEMPLATE,
} from '#prompts/index'

interface StreamState {
  potentialFinalResponse: string
  finalSql?: string
  finalLucene?: string
  finalContent: string
}

export default class LangChainService {
  private async getAvailableSkills(_context: SkillContext): Promise<BaseSkill[]> {
    const isElasticsearch = _context.dbType === 'elasticsearch'

    if (isElasticsearch) {
      return [
        new CoreAssistantSkill(),
        new LuceneSkill(),
      ]
    }

    return [
      new CoreAssistantSkill(),
      new DiscoverySkill(),
      new SecuritySkill(),
    ]
  }

  private async getModel(bindTools = false, dataSourceId?: number) {
    const aiProvider = new AiProviderService()
    const llm = await aiProvider.getChatModel({ streaming: true })

    if (bindTools && dataSourceId) {
      const ds = await DataSource.find(dataSourceId)
      const dbType = ds?.type || 'mysql'
      const skills = await this.getAvailableSkills({ dataSourceId, dbType })
      const tools = skills.flatMap(skill => skill.getTools({ dataSourceId, dbType }))

      // LangChain's bindTools automatically converts StructuredTools to OpenAI Function format
      return { llm: llm.bindTools(tools), tools }
    }

    return { llm, tools: [] }
  }

  /**
   * Learn from a successful interaction
   */
  public async learnInteraction(question: string, sql: string, description?: string, sourceType: string = 'sql') {
    return await KnowledgeBaseService.upsert({
      keyword: question,
      description: description || 'Auto-learned from successful execution',
      exampleSql: sql,
      sourceType,
    })
  }

  /**
   * Agentic Natural Language to SQL Stream (Multi-Agent Graph)
   */
  async* naturalLanguageToSqlStream(
    question: string,
    context: { dbType?: string, dataSourceId?: number, history?: any[], userId?: number, conversationId?: number },
  ) {
    const dataSourceId = context.dataSourceId ? Number(context.dataSourceId) : undefined
    // --- General Chat Mode (No DataSource) ---
    if (!dataSourceId) {
      // ... (Keep existing general chat logic or route through graph too? For now keep simple)
      // Keeping existing plain LLM logic for safety/simplicity for non-data chats
      const systemPrompt = GENERAL_CHAT_SYSTEM_PROMPT
      const { llm: model } = await this.getModel(false)
      const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]
      for (const m of context.history || []) {
        if (m.role === 'user')
          messages.push(new HumanMessage(m.content))
        else if (m.role === 'assistant')
          messages.push(new AIMessage(m.content))
      }
      messages.push(new HumanMessage(question))
      try {
        const stream = await model.stream(messages)
        let fullContent = ''
        for await (const chunk of stream) {
          const text = chunk.content.toString()
          if (text) {
            fullContent += text
            yield JSON.stringify({ type: 'chunk', chunk: text })
          }
        }
        yield JSON.stringify({ type: 'response', content: fullContent })
        // Log Usage... (omitted for brevity, assume similar logs)
      } catch (e: any) {
        yield JSON.stringify({ type: 'error', content: `AI Error: ${e.message}` })
      }
      return
    }

    // --- Graph execution for Data Sources ---
    const { createAgentGraph } = await import('#services/agents/graph')
    const app = createAgentGraph()

    let dbType = (context.dbType || 'mysql').toLowerCase()
    if (dataSourceId) {
      const ds = await DataSource.find(dataSourceId)
      if (ds) {
        dbType = ds.type.toLowerCase()
      }
    }

    // Normalize dbType
    if (dbType === 'es' || dbType === 'elasticsearch') {
      dbType = 'elasticsearch'
    } else if (dbType === 'mysql' || dbType === 'mariadb') {
      dbType = 'mysql'
    } else if (dbType === 'postgresql' || dbType === 'pg') {
      dbType = 'postgresql'
    }

    logger.info({ dataSourceId, dbType }, '[LangChainService] Initializing Graph with dbType')

    const startMessages: BaseMessage[] = []
    const history = context.history || []

    // Avoid duplicating the current question if it's already in history
    for (const m of history) {
      if (m.role === 'user') {
        // If the last history message is exactly the same as the current question, skip adding it here
        // as we add it explicitly below. This prevents duplication when AiController saves to DB first.
        if (m === history[history.length - 1] && m.content === question)
          continue
        startMessages.push(new HumanMessage(m.content))
      } else if (m.role === 'assistant') {
        startMessages.push(new AIMessage(m.content))
      }
    }
    startMessages.push(new HumanMessage(question))

    const inputs = {
      messages: startMessages,
      dbType,
      dataSourceId,
      userId: context.userId,
    }

    try {
      // Use streamEvents to capture tokens and tool events
      const stream = app.streamEvents(inputs, {
        version: 'v2',
      })

      const streamState: StreamState = {
        potentialFinalResponse: '',
        finalSql: undefined,
        finalLucene: undefined,
        finalContent: '',
      }

      for await (const event of stream) {
        yield* this.handleStreamEvent(event, streamState)
      }

      // Extract variables back for final response logic (to keep that part unchanged for now)
      const { finalSql, finalLucene, finalContent, potentialFinalResponse } = streamState

      // Yield Final Response
      if (finalSql) {
        yield JSON.stringify({ type: 'response', content: finalContent || '', sql: finalSql })
      } else if (finalLucene) {
        yield JSON.stringify({ type: 'response', content: finalContent || '', lucene: finalLucene })
      } else if (potentialFinalResponse) {
        yield JSON.stringify({ type: 'response', content: potentialFinalResponse })
      } else {
        yield JSON.stringify({ type: 'response', content: 'Task completed.' })
      }
    } catch (error: any) {
      logger.error({ error }, 'Multi-Agent error')
      yield JSON.stringify({ type: 'response', content: `Sorry, I encountered an error: ${error.message}` })
    }
  }

  /**
   * Main Dispatcher for Stream Events
   */
  private async* handleStreamEvent(event: any, state: StreamState): AsyncGenerator<string> {
    const { data, name, run_id, event: eventType } = event

    switch (eventType) {
      case 'on_chat_model_stream': {
        const content = data.chunk?.content?.toString()
        if (content) {
          yield JSON.stringify({ type: 'thought', content })
        }
        break
      }

      case 'on_chat_model_end':
        this.captureModelResponse(data, state)
        break

      case 'on_chain_end':
        this.captureChainState(data, state)
        break

      case 'on_tool_start':
        yield* this.handleToolStart(name, data, run_id, state)
        break

      case 'on_tool_end':
        yield* this.handleToolEnd(name, data, run_id)
        break
    }
  }

  private captureModelResponse(data: any, state: StreamState) {
    if (data.output && !data.output.tool_calls?.length && data.output.content) {
      state.potentialFinalResponse = data.output.content.toString()
    }
  }

  private captureChainState(data: any, state: StreamState) {
    const output = data.output
    if (!output)
      return

    if (output.sql)
      state.finalSql = output.sql
    if (output.lucene)
      state.finalLucene = output.lucene
    if (output.explanation)
      state.finalContent = output.explanation

    if (output.messages && output.messages.length > 0) {
      const lastMessage = output.messages[output.messages.length - 1]
      if (lastMessage.content) {
        state.potentialFinalResponse = lastMessage.content.toString()
      }
    }
  }

  private async* handleToolStart(
    name: string,
    data: any,
    run_id: string,
    state: StreamState,
  ): AsyncGenerator<string> {
    if (name === 'submit_sql_solution') {
      state.finalSql = data.input.sql
      state.finalContent = data.input.explanation
    } else if (name === 'submit_lucene_solution') {
      state.finalLucene = data.input.lucene
      state.finalContent = data.input.explanation
    }

    yield JSON.stringify({
      type: 'tool_start',
      tool: name,
      input: data.input,
      id: run_id,
    })
  }

  private async* handleToolEnd(name: string, data: any, run_id: string): AsyncGenerator<string> {
    yield JSON.stringify({
      type: 'tool_end',
      tool: name,
      output: data.output,
      id: run_id,
    })
  }

  // Keep legacy logical method for optimizing SQL (simpler chain)
  async* optimizeSqlStream(sql: string, context: { dbType?: string, schema?: any, userId?: number }) {
    const { llm } = await this.getModel(false)
    const modelName = (llm as any).modelName || 'gpt-4o'
    const dbType = context.dbType || 'mysql'

    const prompt = SQL_OPTIMIZATION_PROMPT_TEMPLATE(dbType, JSON.stringify(context.schema || {}), sql)
    const stream = await llm.stream([new HumanMessage(prompt)])
    let fullResponse: AIMessageChunk | undefined

    for await (const chunk of stream) {
      if (!fullResponse)
        fullResponse = chunk
      else
        fullResponse = fullResponse.concat(chunk)

      if (chunk.content)
        yield chunk.content.toString()
    }

    await AiUsageService.recordFromLangChain(fullResponse, {
      userId: context.userId,
      context: 'sql_optimization',
      modelName,
    })
  }

  // Fallback / standard method
  async naturalLanguageToSql(question: string, context: any) {
    const stream = this.naturalLanguageToSqlStream(question, context)
    let finalSql = ''
    for await (const chunk of stream) {
      try {
        const event = JSON.parse(chunk)
        if (event.type === 'thought') {
          const match = event.content.match(/```sql\n([\s\S]*?)\n```/)
          if (match)
            finalSql = match[1]
        }
      } catch (e) {}
    }
    return finalSql
  }
}
