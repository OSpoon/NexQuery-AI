import Setting from '#models/setting'
import KnowledgeBase from '#models/knowledge_base'
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
  private static readonly API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

  private async getModel(bindTools = false, dataSourceId?: number) {
    const setting = await Setting.findBy('key', 'glm_api_key')
    const apiKey = setting?.value

    if (!apiKey)
      throw new Error('GLM API Key not configured')

    process.env.OPENAI_API_KEY = apiKey

    const chatModelSetting = await Setting.findBy('key', 'ai_chat_model')
    const chatModel = chatModelSetting?.value || 'glm-4.5-flash'

    // Initialize Langfuse Callback Handler
    const langfuseHandler = new CallbackHandler({
      publicKey: env.get('LANGFUSE_PUBLIC_KEY'),
      secretKey: env.get('LANGFUSE_SECRET_KEY'),
      baseUrl: env.get('LANGFUSE_HOST'),
    })

    const llm = new ChatOpenAI({
      apiKey,
      configuration: { baseURL: LangChainService.API_BASE_URL },
      modelName: chatModel,
      temperature: 0.1,
      streaming: true,
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
    context: { dbType?: string, dataSourceId?: number, history?: any[] },
  ) {
    const dataSourceId = context.dataSourceId ? Number(context.dataSourceId) : undefined
    if (!dataSourceId) {
      yield 'Error: DataSource ID is required for Agentic mode.'
      return
    }

    const { llm: modelWithTools, tools } = await this.getModel(true, dataSourceId)
    const dbType = context.dbType || 'mysql'

    const businessContext = await this.retrieveContext(question)

    // Phase 2: Schema Pruning (Pre-Retrieval)
    let recommendedTablesText = ''
    try {
      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()
      const embedding = await embeddingService.generate(question)

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
你的目标是分析用户问题并生成准确的 SQL 查询，并提供专业的数据可视化建议。

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
   - 不要轻易放弃，请尝试多次修正。
5. **提交结果 (Submit Result)**:
   - 只有当 SQL 通过验证 (validate_sql 返回 Valid)，且你确信无误后，**必须**调用 tool \`submit_sql_solution\` 提交。
   - **重要**: 请根据数据特征推荐合适的图表。例如：
     - **趋势分析** (如: 每日订单数) -> 推荐 \`line\`。
     - **分类对比** (如: 各部门销售额) -> 推荐 \`bar\`。
     - **占比分析** (如: 客户来源分布) -> 推荐 \`pie\`。
     - **单一数值** (如: 总注册用户数) -> 推荐 \`number\`。
     - **多维列表** -> 推荐 \`table\`。
   - **不要**直接输出 markdown 代码块，**不要**包含 \`\`\`sql ... \`\`\`。一切输出必须通过 \`submit_sql_solution\` 工具完成。
6. **安全红线**:
   - **严禁**执行无 \`WHERE\` 条件的 \`DELETE\` / \`UPDATE\` 语句。这是由于我们的 AST Guardrails 强制拦截。
   - 严禁查询密码、密钥等敏感字段。
   - 作为 "Safety Auditor"，请在生成 SQL 前自检：是否会意外删除/更新全表数据？如果是，请立即中止或添加条件。

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
    const MAX_LOOPS = 12 // Increased loops for self-correction

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

          // Format Final Output
          const finalOutput = `### 优化分析\n${args.explanation}\n\n### 优化后的 SQL\n${args.risk_level === 'modification' ? '**请注意：这是一个数据修改操作，请谨慎执行。**\n' : ''}\n\`\`\`sql\n${args.sql}\n\`\`\``

          yield JSON.stringify({
            type: 'response',
            content: finalOutput,
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
        // If the AI forgot to call submit, we might be stuck.
        // We can prompt it to use submit, or just accept the text.
        // For now, we accept the text and exit.
        return
      }
    }
  }

  // Keep legacy logical method for optimizing SQL (simpler chain)
  async* optimizeSqlStream(sql: string, context: { dbType?: string, schema?: any }) {
    const { llm } = await this.getModel(false)
    const dbType = context.dbType || 'mysql'

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
    for await (const chunk of stream) {
      if (chunk.content)
        yield chunk.content.toString()
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
