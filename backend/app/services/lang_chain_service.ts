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
import { ListTablesTool } from '#services/tools/list_tables_tool'
import { GetTableSchemaTool } from '#services/tools/get_table_schema_tool'
import { SampleTableDataTool } from '#services/tools/sample_table_data_tool'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'
import { GetCurrentTimeTool } from '#services/tools/get_current_time_tool'
import { SearchColumnValuesTool } from '#services/tools/search_column_values_tool'
import { SearchTablesTool } from '#services/tools/search_tables_tool'
import { SubmitSqlTool } from '#services/tools/submit_sql_tool'
import { ClarifyIntentTool } from '#services/tools/clarify_intent_tool'
import { CallbackHandler } from 'langfuse-langchain'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

export default class LangChainService {
  private static readonly DEFAULT_API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

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
      const tools = [
        new ListTablesTool(),
        new GetTableSchemaTool(),
        new SampleTableDataTool(),
        new ValidateSqlTool(),
        new GetCurrentTimeTool(),
        new SearchColumnValuesTool(),
        new SearchTablesTool(),
        new SubmitSqlTool(),
        new ClarifyIntentTool(),
      ]
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

  private async retrieveContext(question: string): Promise<string> {
    try {
      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()

      const questionEmbedding = await embeddingService.generate(question)
      if (!questionEmbedding || questionEmbedding.length === 0)
        return ''

      // Search Knowledge Base via Vector Store - Only retrieve Approved items
      const results = await vectorStore.searchKnowledge(questionEmbedding, 5)

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
  public async learnInteraction(question: string, sql: string, description?: string) {
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
      const systemPrompt = `你是一位名为 "NexQuery AI" 的智能助手。
你的目标是辅助用户进行日常对话、技术解答或通用问题处理。
当前用户没有连接任何具体的数据库，因此你无法执行 SQL 查询或访问数据表。

请根据用户的提问提供有帮助、准确且友好的回答。`

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

    const businessContext = await this.retrieveContext(question)

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

    const systemPrompt = `你是一位精通 ${dbType} 的数据分析专家和 SQL 架构师。
你的目标是分析用户问题并生成准确的 SQL 查询。

**推荐关注的表 (Based on relevance)**:
${recommendedTablesText || '暂无推荐，请自行搜索。'}

**关键能力与规则**:
1. **主动探索与效率**:
   - **Table Search**: 使用 \`search_tables\` 搜索相关表。这是探索未知数据库或大型数据库的首选方式。
   - **Schema Inspection**: 确定表名后，使用 \`get_table_schema\` 获取详细结构。
   - **List Tables**: 仅在需要浏览所有表名时使用。
   - **Data Sampling**: 遇到不确定的字段含义（如状态值），务必使用 \`sample_table_data\` 确认真实数据。
   - **性能优化**: 请在一个步骤中尽可能同时调用多个工具。
2. **值与时间感知**:
   - 遇到不确定的字段值，使用 \`search_column_values\` 搜索真实值。
   - 遇到相对时间（如“上个月”），使用 \`get_current_time\` 获取当前参考时间。
3. **歧义主动消解 (Disambiguation)**:
   - **重要**: 如果用户的提问过于模糊，或存在多种合理的业务解释（例如：“活跃用户”是指登录过的还是下单过的？），**不要瞎猜**。
   - **必须**使用 \`clarify_intent\` 工具向用户发起询问，并提供几个可能的选项。
   - 只有在明确用户意图后，才继续生成 SQL。
4. **自我验证 & 智能纠错 (Self-Correction)**:
   - 生成 SQL 后，**必须**使用 \`validate_sql\` 工具验证。
   - **严禁**提交未经验证的 SQL。
   - 如果验证失败，该工具会提示具体错误。**你必须读取错误提示，修正 SQL，并再次进行验证，直到验证通过**。
   - **收到 'Validation Failed' 时，严禁直接提交。必须针对性调用 \`get_table_schema\` 检查相关表结构（不要靠猜），修复列名/表名错误后重试。**
   - 不要轻易放弃，请尝试多次修正。
5. **提交结果 (Submit Result)**:
   - 只有当 SQL 通过验证 (validate_sql 返回 Valid)，且你确信无误后，**必须**调用 tool \`submit_sql_solution\` 提交。
   - **不要**直接输出 markdown 代码块，**不要**包含 \`\`\`sql ... \`\`\`。一切输出必须通过 \`submit_sql_solution\` 工具完成。
6. **安全红线**:
   - **严禁**执行无 \`WHERE\` 条件的 \`DELETE\` / \`UPDATE\` 语句。这是由于我们的 AST Guardrails 强制拦截。
   - 严禁查询密码、密钥等敏感字段。
   - 作为 "Safety Auditor"，请 Richmond 在生成 SQL 前自检：是否会意外删除/更新全表数据？如果是，请立即中止或添加条件。
7. **多轮对话上下文 (Contextual Memory)**:
   - **Check History**: 这是一场连续的对话。请仔细检查 History 中的上一轮 interaction (System/User/Assistant messages)。
   - **Follow-up Handling**: 如果用户的意图是对上一次结果的修改或补充（例如：“按时间排序”、“只看前10个”、“换成柱状图”），**DO NOT** 重新生成 SQL。
   - **Action**: 你必须提取上一轮成功的 SQL (from \`submit_sql_solution\`)，并在此基础上应用新的逻辑（添加 WHERE, ORDER BY, GROUP BY 等）。保留原有的查询语义，除非用户明确要求改变。
8. **性能评估 (Performance Advisor)**:
   - \`validate_sql\` 工具现已支持 Performance Analysis。
   - 如果验证结果包含 **"(Performance Note: ...)"**，请务必在最终回复的「优化分析」部分中明确告知用户该风险（例如全表扫描），并给出简短建议（如建索引）。不要忽略警告。

**业务上下文**:
${businessContext}

**当前数据库连接信息**:
DataSource ID: ${dataSourceId}
Database Type: ${dbType}

请开始思考并执行任务。`

    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]
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

    const prompt = `你是一位 SQL 专家。请对以下 ${dbType} SQL 进行优化分析。
业务上下文：${JSON.stringify(context.schema || {})}
SQL 语句：
\`\`\`sql
${sql}
\`\`\`

输出格式：
1. **优化分析**（请使用中文详细说明）
2. **优化后的 SQL**（包裹在 \`\`\`sql 代码块中）
`
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
