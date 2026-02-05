import Setting from '#models/setting'
import KnowledgeBase from '#models/knowledge_base'
import AiUsageLog from '#models/ai_usage_log'
import ModelCostService from '#services/model_cost_service'
import { ChatOpenAI } from '@langchain/openai'
import type {
  AIMessageChunk,
  BaseMessage,
} from '@langchain/core/messages'
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { SecuritySkill } from '#services/skills/security_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { LuceneSkill } from '#services/skills/lucene_skill'
import type { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import DataSource from '#models/data_source'
import { CallbackHandler } from 'langfuse-langchain'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import {
  GENERAL_CHAT_SYSTEM_PROMPT,
  SQL_AGENT_SYSTEM_PROMPT_TEMPLATE,
  SQL_OPTIMIZATION_PROMPT_TEMPLATE,
} from '#prompts/index'

export default class LangChainService {
  private static readonly DEFAULT_API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

  private async getAvailableSkills(_context: SkillContext): Promise<BaseSkill[]> {
    const skills: BaseSkill[] = []

    // 1. Discovery Skill (Skip for ES, as it uses LuceneSkill for discovery)
    const discoveryEnabled = await Setting.findBy('key', 'ai_skill_discovery')
    if (discoveryEnabled?.value !== 'false' && _context.dbType !== 'elasticsearch') {
      skills.push(new DiscoverySkill())
    }

    // 2. Security Skill
    const securityEnabled = await Setting.findBy('key', 'ai_skill_security')
    if (securityEnabled?.value !== 'false') {
      skills.push(new SecuritySkill())
    }

    // 3. Core Assistant Skill
    const coreEnabled = await Setting.findBy('key', 'ai_skill_core')
    if (coreEnabled?.value !== 'false') {
      skills.push(new CoreAssistantSkill())
    }

    // 4. Lucene Skill (If ES data source)
    const luceneEnabled = await Setting.findBy('key', 'ai_skill_lucene')
    if (luceneEnabled?.value !== 'false' && _context.dbType === 'elasticsearch') {
      skills.push(new LuceneSkill())
    }

    return skills
  }

  private async getModel(bindTools = false, dataSourceId?: number) {
    // 1. Get Base URL
    const baseUrlSetting = await Setting.findBy('key', 'ai_base_url')
    const baseUrl = baseUrlSetting?.value || LangChainService.DEFAULT_API_BASE_URL

    if (!baseUrl) {
      throw new Error('AI Base URL not configured (ai_base_url)')
    }

    // 2. Get API Key
    const apiKeySetting = await Setting.findBy('key', 'ai_api_key')
    const apiKey = apiKeySetting?.value

    if (!apiKey) {
      throw new Error('AI API Key not configured (ai_api_key)')
    }

    process.env.OPENAI_API_KEY = apiKey

    // 3. Get Model Name
    const chatModelSetting = await Setting.findBy('key', 'ai_chat_model')
    const chatModel = chatModelSetting?.value

    if (!chatModel) {
      throw new Error('AI Chat Model not configured (ai_chat_model)')
    }

    const timeoutSetting = await Setting.findBy('key', 'ai_timeout_sec')
    const timeoutMs = (Number(timeoutSetting?.value) || 600) * 1000

    // Initialize Langfuse Callback Handler
    const langfuseHandler = new CallbackHandler({
      publicKey: env.get('LANGFUSE_PUBLIC_KEY'),
      secretKey: env.get('LANGFUSE_SECRET_KEY'),
      baseUrl: env.get('LANGFUSE_HOST'),
    })

    const llm = new ChatOpenAI({
      apiKey,
      configuration: { baseURL: baseUrl },
      modelName: chatModel,
      temperature: 0.1,
      timeout: timeoutMs,
      streaming: true,
      streamUsage: true, // Enable usage reporting
      callbacks: [langfuseHandler],
    })

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
   * Record AI Usage log
   */
  private async recordUsage(params: {
    userId?: number
    conversationId?: number | null
    modelName: string
    provider: string
    promptTokens: number
    completionTokens: number
    context: string
  }) {
    try {
      if (params.promptTokens <= 0 && params.completionTokens <= 0)
        return

      const totalTokens = params.promptTokens + params.completionTokens
      const estimatedCost = ModelCostService.calculateCost(params.modelName, {
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens,
      })

      await AiUsageLog.create({
        ...params,
        totalTokens,
        estimatedCost,
      })

      logger.info(`[recordUsage] Recorded: ${params.modelName}, Cost: ${estimatedCost}, Tokens: ${totalTokens}, Context: ${params.context}`)
    } catch (e) {
      logger.error({ error: e }, 'Failed to record AI usage log')
    }
  }

  private async retrieveContext(question: string, sourceType?: string): Promise<string> {
    try {
      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()

      const questionEmbedding = await embeddingService.generate(question)
      if (!questionEmbedding || questionEmbedding.length === 0)
        return ''

      // Search Knowledge Base via Vector Store - Only retrieve Approved items
      const results = await vectorStore.searchKnowledge(questionEmbedding, 5, sourceType)

      if (results.length === 0) {
        return ''
      }

      let businessDefinitions = ''
      let fewShotExamples = ''

      results.forEach((item) => {
        const payload = item.payload || {}
        const keyword = payload.keyword as string
        const exampleSql = payload.exampleSql as string
        const description = payload.description as string

        if (exampleSql && exampleSql.trim()) {
          // It's a few-shot example
          fewShotExamples += `- **User Question**: "${keyword}"\n  **Correct SQL**: \`${exampleSql}\`\n`
        } else {
          // It's a concept definition
          businessDefinitions += `- **${keyword}**: ${description}\n`
        }
      })

      let contextText = ''
      if (businessDefinitions) {
        contextText += `**Business Logic Definitions**:\n${businessDefinitions}\n`
      }
      if (fewShotExamples) {
        contextText += `**Reference Successful Queries (Few-Shot Examples)**:\n${fewShotExamples}\n`
      }

      return contextText
    } catch (e) {
      logger.error({ error: e }, 'Context retrieval failed')
      return ''
    }
  }

  /**
   * Learn from a successful interaction
   */
  public async learnInteraction(question: string, sql: string, description?: string, sourceType: string = 'sql') {
    try {
      const embeddingService = new EmbeddingService()
      const desc = description || 'Auto-learned from successful execution'
      const embedding = await embeddingService.generate(`${question}: ${desc}`)

      const item = await KnowledgeBase.create({
        keyword: question,
        description: desc,
        exampleSql: sql,
        embedding,
        status: 'approved',
        sourceType,
      })

      // Sync to Qdrant immediately
      if (item.embedding && item.embedding.length > 0) {
        const vectorStore = new VectorStoreService()
        await vectorStore.upsertKnowledge(
          item.keyword,
          item.description,
          item.exampleSql,
          item.embedding,
          item.status,
          item.sourceType,
        )
      }
      return item
    } catch (e) {
      logger.error({ error: e }, 'Failed to learn interaction')
    }
  }

  /**
   * Agentic Natural Language to SQL Stream
   */
  async* naturalLanguageToSqlStream(
    question: string,
    context: { dbType?: string, dataSourceId?: number, history?: any[], userId?: number, conversationId?: number },
  ) {
    const dataSourceId = context.dataSourceId ? Number(context.dataSourceId) : undefined
    // --- General Chat Mode (No DataSource) ---
    if (!dataSourceId) {
      const systemPrompt = GENERAL_CHAT_SYSTEM_PROMPT

      const { llm: model } = await this.getModel(false)
      const modelName = (model as any).modelName || 'gpt-4o'

      const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]
      for (const m of context.history || []) {
        if (m.role === 'user') {
          messages.push(new HumanMessage(m.content))
        } else if (m.role === 'assistant') {
          messages.push(new AIMessage(m.content))
        }
      }
      messages.push(new HumanMessage(question))

      try {
        const stream = await model.stream(messages)
        let fullContent = ''
        let fullResponse: AIMessageChunk | undefined

        for await (const chunk of stream) {
          if (!fullResponse)
            fullResponse = chunk
          else fullResponse = fullResponse.concat(chunk)

          const text = chunk.content.toString()
          if (text) {
            fullContent += text
            // In General Chat, we stream thoughts as the main content for now, or just chunks
            // But to keep frontend happy with the existing parser, we can send 'thought' or 'response' parts?
            // Actually, the frontend appends 'response' types to the content.
            // Let's stream as 'response' so it shows up directly.
            yield JSON.stringify({ type: 'chunk', chunk: text })
          }
        }

        // Final payload to ensure state is consistent
        yield JSON.stringify({
          type: 'response',
          content: fullContent,
        })

        // Log Usage
        if (fullResponse) {
          const usage = (fullResponse as any).usage_metadata || fullResponse.response_metadata?.tokenUsage
          if (usage) {
            await this.recordUsage({
              userId: context.userId,
              conversationId: context.conversationId,
              modelName,
              provider: 'openai',
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              context: 'general_chat',
            })
          }
        }
      } catch (e: any) {
        logger.error({ error: e }, 'General Chat Error')
        yield JSON.stringify({ type: 'error', content: `AI Error: ${e.message}` })
      }
      return
    }

    const { llm: modelWithTools, tools } = await this.getModel(true, dataSourceId)
    const dbType = context.dbType || 'mysql'
    const modelName = (modelWithTools as any).modelName || 'gpt-4o' // Fallback for logging

    const businessContext = await this.retrieveContext(question, dbType)

    // Phase 2: Schema Pruning (Pre-Retrieval)
    let recommendedTablesText = ''
    try {
      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()
      const embedding = await embeddingService.generate(question, context.userId)

      const relatedTables = await vectorStore.searchTables(Number(dataSourceId), embedding, 10)

      if (relatedTables.length > 0) {
        recommendedTablesText = relatedTables
          .map(t => `- **${t.payload?.tableName}**: ${t.payload?.fullSchema || 'No description'}`)
          .join('\n')
      }
    } catch (e) {
      console.warn('Schema Pruning failed', e)
    }

    const skills = await this.getAvailableSkills({ dataSourceId, dbType, userId: context.userId })
    const skillPrompts = skills.map(s => s.getSystemPrompt({ dataSourceId, dbType, userId: context.userId })).join('\n\n')

    const systemPrompt = SQL_AGENT_SYSTEM_PROMPT_TEMPLATE(dbType, recommendedTablesText, businessContext, skillPrompts)

    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    // Visibility: Show that skills are loaded
    yield JSON.stringify({
      type: 'thought',
      content: `[系统] 已挂载技能: ${skills.map(s => s.name).join(', ')}\n`,
    })

    for (const m of context.history || []) {
      if (m.role === 'user') {
        messages.push(new HumanMessage(m.content))
      } else if (m.role === 'assistant') {
        const toolCalls: any[] = []
        const toolMessages: ToolMessage[] = []

        if (m.agentSteps && Array.isArray(m.agentSteps)) {
          for (const step of m.agentSteps) {
            if (step.type === 'tool') {
              toolCalls.push({
                id: step.toolId,
                name: step.toolName,
                args: step.toolInput,
                type: 'tool_call',
              })

              if (step.status === 'done' || step.toolOutput) {
                toolMessages.push(
                  new ToolMessage({
                    content: step.toolOutput || '',
                    tool_call_id: step.toolId,
                    name: step.toolName,
                  }),
                )
              }
            }
          }
        }

        messages.push(
          new AIMessage({
            content: m.content || '',
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          }),
        )

        // Append tool messages immediately after the AI message that called them
        if (toolMessages.length > 0) {
          messages.push(...toolMessages)
        }
      }
    }
    messages.push(new HumanMessage(question))

    let loopCount = 0
    const MAX_LOOPS = 15 // Increased loops for self-correction
    const attemptedSqls = new Set<string>()

    while (loopCount < MAX_LOOPS) {
      loopCount++
      logger.debug(`[AgentLoop] Iteration ${loopCount}`)

      // 1. Invoke LLM with single-pass streaming aggregation
      let aiMessageChunk: AIMessageChunk | undefined
      try {
        const stream = await modelWithTools.stream(messages)

        for await (const chunk of stream) {
          // Collect and merge chunks properly using LangChain's built-in concat
          if (!aiMessageChunk) {
            aiMessageChunk = chunk
          } else {
            aiMessageChunk = aiMessageChunk.concat(chunk)
          }

          if (chunk.content) {
            const text = chunk.content.toString()
            if (text) {
              yield JSON.stringify({ type: 'thought', content: text })
            }
          }
        }

        if (!aiMessageChunk) {
          throw new Error('AI returned an empty response.')
        }

        // --- Log Usage ---
        const usage = (aiMessageChunk as any).usage_metadata || aiMessageChunk.response_metadata?.tokenUsage
        if (usage) {
          const actualModelName = aiMessageChunk.response_metadata?.model_name || modelName
          await this.recordUsage({
            userId: context.userId,
            conversationId: context.conversationId,
            modelName: actualModelName,
            provider: 'openai',
            promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0,
            completionTokens: usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0,
            context: 'chat',
          })
        }
      } catch (e: any) {
        logger.error({ error: e }, 'LLM Generation Error')
        yield JSON.stringify({ type: 'error', content: `AI reasoning failed: ${e.message}` })
        return
      }

      // Append full aggregated AI response to history
      messages.push(aiMessageChunk)

      // 2. Check for Tool Calls
      if (aiMessageChunk.tool_calls && aiMessageChunk.tool_calls.length > 0) {
        logger.debug(`[AgentLoop] Tools requested: ${aiMessageChunk.tool_calls.length}`)

        // Check for SubmitSqlTool
        const submissionCall = aiMessageChunk.tool_calls.find(
          c => c.name === 'submit_sql_solution',
        )
        if (submissionCall) {
          logger.info('[AgentLoop] Solution Submitted!')
          const args = submissionCall.args
          const sql = args.sql
          const explanation = args.explanation

          // Format Final Output
          const finalOutput = `### 优化分析\n${explanation}\n\n### 优化后的 SQL\n${args.risk_level === 'modification' ? '**请注意：这是一个数据修改操作，请谨慎执行。**\n' : ''}\n\`\`\`sql\n${sql}\n\`\`\``

          yield JSON.stringify({
            type: 'response',
            content: finalOutput,
            sql, // PURE SQL for feedback fix
          })
          return // EXIT LOOP
        }

        // Check for SubmitLuceneTool
        const luceneCall = aiMessageChunk.tool_calls.find(
          c => c.name === 'submit_lucene_solution',
        )
        if (luceneCall) {
          logger.info('[AgentLoop] Lucene Solution Submitted!')
          const args = luceneCall.args
          const lucene = args.lucene
          const explanation = args.explanation

          // Format Final Output
          const finalOutput = `### 优化分析\n${explanation}\n\n### 生成的 Lucene 语句\n\`\`\`lucene\n${lucene}\n\`\`\``

          yield JSON.stringify({
            type: 'response',
            content: finalOutput,
            lucene, // PURE Lucene for UI handles
          })
          return // EXIT LOOP
        }

        // Check for ClarifyIntentTool
        const clarifyCall = aiMessageChunk.tool_calls.find(c => c.name === 'clarify_intent')
        if (clarifyCall) {
          logger.info('[AgentLoop] Clarification Requested!')
          const args = clarifyCall.args
          yield JSON.stringify({
            type: 'clarify',
            question: args.question,
            options: args.options,
          })
          return // EXIT LOOP & WAIT FOR USER
        }

        for (const toolCall of aiMessageChunk.tool_calls) {
          const toolName = toolCall.name
          const args = toolCall.args

          // --- Circuit Breaker: Prevent Duplicate SQL Validation Loop ---
          if (toolName === 'validate_sql') {
            const sqlToValidate = (args.sql || '').trim()
            if (attemptedSqls.has(sqlToValidate)) {
              logger.warn(`[CircuitBreaker] Duplicate SQL detected: ${sqlToValidate}`)
              yield JSON.stringify({
                type: 'error',
                content: `[System Protection] Agent entered a loop by generating the exact same invalid SQL twice. Aborting to prevent resource waste.\nDuplicate SQL: ${sqlToValidate}`,
              })
              return // ABORT AGENT LOOP
            }
            attemptedSqls.add(sqlToValidate)
          }
          // ----------------------------------------------------------------

          // Notify frontend: Tool Start
          yield JSON.stringify({
            type: 'tool_start',
            tool: toolName,
            input: args,
            id: toolCall.id,
          })

          // Execute Tool
          let toolResult = ''
          try {
            // Find matching tool instance
            const toolInstance = tools.find(t => t.name === toolName)
            if (toolInstance) {
              // Inject dataSourceId if missing (sometimes AI forgets implicit context)
              if (!args.dataSourceId)
                args.dataSourceId = dataSourceId

              toolResult = await toolInstance.invoke(args)
            } else {
              toolResult = `Error: Tool ${toolName} not found.`
            }
          } catch (err: any) {
            toolResult = `Error executing tool: ${err.message}`
          }

          // Notify frontend: Tool End
          yield JSON.stringify({
            type: 'tool_end',
            tool: toolName,
            output: toolResult,
            id: toolCall.id,
          })

          // Append Tool Result to history
          messages.push(
            new ToolMessage({
              content: toolResult,
              tool_call_id: toolCall.id!,
              name: toolName,
            }) as any,
          )
        }
        // Loop continues to let AI react to tool results
      } else {
        // No tool calls means we have a final answer (text only)
        return
      }
    }
  }

  // Keep legacy logical method for optimizing SQL (simpler chain)
  async* optimizeSqlStream(sql: string, context: { dbType?: string, schema?: any, userId?: number }) {
    const { llm } = await this.getModel(false)
    const dbType = context.dbType || 'mysql'
    const modelName = (llm as any).modelName || 'gpt-4o'

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

    if (fullResponse) {
      const usage = (fullResponse as any).usage_metadata || fullResponse.response_metadata?.tokenUsage
      if (usage) {
        const actualModelName = fullResponse.response_metadata?.model_name || modelName
        await this.recordUsage({
          userId: context.userId,
          modelName: actualModelName,
          provider: 'openai',
          promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0,
          completionTokens: usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0,
          context: 'sql_optimization',
        })
      }
    }
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
