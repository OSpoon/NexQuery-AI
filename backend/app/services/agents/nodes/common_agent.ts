import { AgentState } from '#services/agents/state'
import AiProviderService from '#services/ai_provider_service'
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { SkillContext } from '#services/skills/skill_interface'
import { AGENT_SYSTEM_PROMPT_TEMPLATE, PROMPT_MAP } from '#prompts/index'
import logger from '@adonisjs/core/services/logger'

export abstract class CommonAgentNode {
  protected abstract getSkills(context: SkillContext): any[]

  async run(state: AgentState, config?: any) {
    const provider = new AiProviderService()
    const llm = await provider.getChatModel({ streaming: true })
    const nodeName = config?.nodeName || this.constructor.name.replace(/Node$/, '').replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')

    logger.info(`[Agent: ${nodeName}] Starting execution loop...`)

    const context: SkillContext = {
      dataSourceId: state.dataSourceId,
      dbType: state.dbType,
      userId: state.userId,
    }

    const skills = this.getSkills(context)
    let tools = skills.flatMap(s => s.getTools(context))

    // AGGRESSIVE OPTIMIZATION: Tool Stripping for Security Agent
    // If we already have discovery data, remove discovery tools from Security Agent to prevent turnaround wastage.
    const isSecurityAgent = this.constructor.name === 'SecurityAgentNode' || nodeName === 'security_agent'
    if (isSecurityAgent && state.intermediate_results && Object.keys(state.intermediate_results).length > 0) {
      const discoveryTools = ['list_entities', 'get_entity_schema', 'sample_entity_data', 'search_entities', 'search_field_values', 'get_entity_statistics']
      const originalCount = tools.length
      tools = tools.filter(t => !discoveryTools.includes(t.name))
      if (tools.length < originalCount) {
        logger.info(`[Agent: ${nodeName}] Programmatically stripped ${originalCount - tools.length} redundant discovery tools.`)
      }
    }
    const skillPrompts = skills.map((s: any) => s.getSystemPrompt(context)).join('\n\n')

    // Generate Specialized System Prompt based on node name
    const promptTemplate = PROMPT_MAP[nodeName] || AGENT_SYSTEM_PROMPT_TEMPLATE

    // Provide intermediate results as context if they exist
    const resultsStr = state.intermediate_results && Object.keys(state.intermediate_results).length > 0
      ? `\n\n--- 前序步骤的探测/发现结果 (中间结果) ---\n${JSON.stringify(state.intermediate_results, null, 2)}\n请优先使用这些结果，避免重复运行探测工具。\n-----------------------------------------------\n`
      : ''

    const envHeader = `\n\n[!!! 数据环境协议 !!!]\n当前数据库类型: ${state.dbType.toUpperCase()} \n数据源 ID: ${state.dataSourceId || '未知'}\n- 系统默认期望 ${state.dbType === 'elasticsearch' ? 'LUCENE' : 'SQL'} 语法。如果用户的问题使用了不匹配的术语（如在 ES 模式下提到“表”或“SQL”），请根据当前环境进行语义映射或友好解释，不要直接拒绝。\n- 严禁猜测或尝试访问其他数据源 ID。\n- 你的工具库已针对此环境进行了预过滤。\n[!!! 协议结束 !!!]\n\n`

    const systemPrompt = envHeader + (typeof promptTemplate === 'function'
      ? (promptTemplate as any)(state.dbType, skillPrompts)
      : promptTemplate) + this.renderKnowledgeBase(state.intermediate_results || {})

    const modelWithTools = llm.bindTools(tools)

    // Sanitize and filter history to avoid 400 "messages illegal parameters" errors
    // LLMs (especially GLM/Zhipu and some versions of OpenAI) are strict about:
    // 1. Roles must alternate (User -> Assistant -> User).
    // 2. Content cannot be empty.
    // 3. Tool messages must follow their AI message (but we strip them for a cleaner long-term history).
    const sanitizeMessages = (msgs: any[]): any[] => {
      const filtered = msgs
        .filter(m => m._getType() !== 'system' && m._getType() !== 'tool')
        .map((m) => {
          const content = m.content
          if (m._getType() === 'ai' && m.additional_kwargs?.tool_calls) {
            // Strip tool call metadata for history context
          }
          return {
            type: m._getType(),
            content: typeof content === 'string' ? content : JSON.stringify(content),
          }
        })
        .filter(m => m.content && m.content.trim() !== '')

      // Collapse consecutive roles
      const collapsed: any[] = []
      for (const m of filtered) {
        if (collapsed.length > 0 && collapsed[collapsed.length - 1].type === m.type) {
          collapsed[collapsed.length - 1].content += `\n${m.content}`
        } else {
          collapsed.push(m)
        }
      }

      // Convert back to LangChain message objects
      return collapsed.map((m) => {
        if (m.type === 'ai')
          return new AIMessage({ content: m.content })
        return new HumanMessage({ content: m.content })
      })
    }

    const history = sanitizeMessages(state.messages)
    const messages: any[] = [
      new SystemMessage(systemPrompt),
      ...history.slice(-20), // Support deeper context
    ]

    const newMessages: any[] = []
    let loopCount = 0
    const MAX_LOOPS = 25
    const attemptedSqls = new Set<string>()
    const intermediateResults: Record<string, any> = { ...(state.intermediate_results || {}) }

    while (loopCount < MAX_LOOPS) {
      loopCount++

      const response = await modelWithTools.invoke(messages, config)
      response.additional_kwargs = { ...response.additional_kwargs, node: nodeName }

      const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
      if (responseContent.trim()) {
        logger.info(`[Agent: ${nodeName}] Cycle ${loopCount} Thought: ${responseContent.slice(0, 100)}...`)
      }

      messages.push(response)
      newMessages.push(response)

      if (response.tool_calls && response.tool_calls.length > 0) {
        // 1. Check for Submission Tools
        const sqlSubmission = response.tool_calls.find(c => c.name === 'submit_sql_solution')
        if (sqlSubmission) {
          logger.info('[Agent] SQL Solution Submitted')
          return this.finalizeStep(state, newMessages, {
            sql: sqlSubmission.args.sql,
            explanation: sqlSubmission.args.explanation,
            intermediate_results: intermediateResults,
          }, true)
        }

        const luceneSubmission = response.tool_calls.find(c => c.name === 'submit_lucene_solution')
        if (luceneSubmission) {
          logger.info('[Agent] Lucene Solution Submitted')
          return this.finalizeStep(state, newMessages, {
            lucene: luceneSubmission.args.lucene,
            explanation: luceneSubmission.args.explanation,
            intermediate_results: intermediateResults,
          }, true)
        }

        // 2. Execute Regular Tools
        for (const toolCall of response.tool_calls) {
          // Track intermediate data savings
          if (toolCall.name === 'save_intermediate_data') {
            const { key, data } = toolCall.args
            intermediateResults[key] = data
          }

          // Circuit Breaker for Loop
          if (toolCall.name === 'validate_sql') {
            const sqlToCheck = (toolCall.args.sql || '').trim()
            if (attemptedSqls.has(sqlToCheck)) {
              return {
                messages: newMessages,
                error: `Loop detected on SQL: ${sqlToCheck}. The agent is stuck.`,
                next: 'supervisor',
                intermediate_results: intermediateResults,
              }
            }
            attemptedSqls.add(sqlToCheck)
          }

          let toolOutput = ''
          try {
            logger.info(`[Agent: ${nodeName}] Tool Call: ${toolCall.name}(${JSON.stringify(toolCall.args)})`)
            // STRICT ENFORCEMENT: Never allow the LLM to guess or change the dataSourceId.
            // Always use the one provided by the system/frontend context.
            if (state.dataSourceId) {
              toolCall.args.dataSourceId = state.dataSourceId
            }

            const tool = tools.find(t => t.name === toolCall.name)
            if (tool) {
              // OPTIMIZATION: Smart Cache Matching
              const metaTools = [
                'list_entities',
                'get_entity_schema',
                'sample_entity_data',
                'get_entity_statistics',
                'search_entities',
                'search_field_values',
                'search_related_knowledge',
                'search_column_values',
                'search_tables',
              ]

              let persistenceKey = `${toolCall.name}_${JSON.stringify(toolCall.args)}`
              let cachedResult = intermediateResults[persistenceKey]

              // Fuzzy Logic for sample_entity_data: If we have a larger sample in cache, use it.
              if (!cachedResult && toolCall.name === 'sample_entity_data') {
                const entityName = toolCall.args.entityName
                const requestedLimit = toolCall.args.limit || 5
                // Search for any cached sample for this entity with limit >= requestedLimit
                const existingKey = Object.keys(intermediateResults).find((k) => {
                  if (!k.startsWith('sample_entity_data_'))
                    return false
                  try {
                    const parsedArgs = JSON.parse(k.replace('sample_entity_data_', ''))
                    return parsedArgs.entityName === entityName && (parsedArgs.limit || 5) >= requestedLimit
                  } catch {
                    return false
                  }
                })
                if (existingKey) {
                  cachedResult = intermediateResults[existingKey]
                  persistenceKey = existingKey // Map to existing key for consistency
                }
              }

              if (metaTools.includes(toolCall.name) && cachedResult) {
                logger.info(`[Agent: ${nodeName}] Reusing cached discovery result for: ${toolCall.name} (Key: ${persistenceKey})`)
                toolOutput = cachedResult
              } else {
                toolOutput = await tool.invoke(toolCall.args, config)

                // AUTO-PERSISTENCE: Automatically save discovery/metadata results
                if (metaTools.includes(toolCall.name)) {
                  intermediateResults[persistenceKey] = toolOutput
                }
              }
            } else {
              toolOutput = `Error: Tool ${toolCall.name} not found.`
            }
          } catch (e: any) {
            toolOutput = `Error executing tool: ${e.message}`
          }

          const toolMessage = new ToolMessage({
            content: toolOutput,
            tool_call_id: toolCall.id!,
            name: toolCall.name,
            additional_kwargs: { node: nodeName },
          })
          messages.push(toolMessage)
          newMessages.push(toolMessage)
        }

        // Check if any clarification tool was called - if so, this step is NOT done
        const isClarification = response.tool_calls.some(c => c.name === 'clarify_intent' || c.name === 'request_metadata')
        if (isClarification) {
          return this.finalizeStep(state, newMessages, {
            intermediate_results: intermediateResults,
          }, false)
        }

        // Otherwise, continue loop to let LLM process tool outputs
      } else {
        // No tools called, this is a direct conversational response, mark as done
        return this.finalizeStep(state, newMessages, {
          intermediate_results: intermediateResults,
        }, true)
      }
    }

    return {
      messages: newMessages,
      error: 'Max loops reached without solution.',
      next: 'respond_directly', // Final fallback for error
    }
  }

  /**
   * Render intermediate results into a clean, hierarchical Knowledge Base summary.
   */
  private renderKnowledgeBase(results: Record<string, any>): string {
    if (!results || Object.keys(results).length === 0)
      return ''

    let output = '\n\n### 🧠 当前已掌握的数据库知识 (KNOWLEDGE BASE)\n'
    output += '> 请优先参考以下信息，**严禁**重复调用已获取信息的探测工具。\n\n'

    // 1. Entities & Basic Discovery
    if (results.list_entities_any) {
      output += '#### 📋 已知实体列表\n已获取全库实体清单，请从中选择目标表。\n\n'
    }

    // 2. Compass & Relationships
    const compassKey = Object.keys(results).find(k => k.startsWith('get_database_compass'))
    if (compassKey) {
      output += '#### 🧭 数据库全域罗盘 (FK Topology)\n已掌握全库拓扑关系，多表关联路径已明确。\n\n'
    }

    // 3. Detailed Schemas
    const schemas = Object.keys(results).filter(k => k.startsWith('get_entity_schema'))
    if (schemas.length > 0) {
      output += '#### 📐 已掌握的表结构 (Schemas)\n'
      for (const k of schemas) {
        const tableName = k.match(/"entityName":"([^"]+)"/)?.[1] || k
        output += `- **\`${tableName}\`**: 字段定义已就绪。\n`
      }
      output += '\n'
    }

    // 4. Sample Data & Stats
    const samples = Object.keys(results).filter(k => k.startsWith('sample_entity_data') || k.startsWith('get_entity_statistics'))
    if (samples.length > 0) {
      output += '#### 🧪 已获取的数据样本/统计\n'
      for (const k of samples) {
        const tableName = k.match(/"entityName":"([^"]+)"/)?.[1] || k
        output += `- **\`${tableName}\`**: 样本数据/分布特征已掌握。\n`
      }
    }

    output += '\n--- 原始探测细节 (供精确参考) ---\n'
    output += JSON.stringify(results, null, 2)
    output += '\n----------------------------\n'

    return output
  }

  /**
   * Helper to mark plan step as completed and decide on next hop
   */
  private finalizeStep(_state: AgentState, newMessages: any[], updates: Partial<AgentState>, _isDone: boolean = false) {
    const nodeName = this.constructor.name.replace(/Node$/, '').replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')

    return {
      ...updates,
      messages: newMessages,
      next: updates.next || nodeName, // Preserve own name if no explicit next
    }
  }
}
