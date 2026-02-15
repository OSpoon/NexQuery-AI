import { AgentState } from '#services/agents/state'
import AiProviderService from '#services/ai_provider_service'
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { SkillContext } from '#services/skills/skill_interface'
import { AGENT_SYSTEM_PROMPT_TEMPLATE, PROMPT_MAP } from '#prompts/index'
import logger from '@adonisjs/core/services/logger'

export abstract class CommonAgentNode {
  protected abstract getSkills(context: SkillContext): any[]

  // Subclasses can override to add extra tools beyond what Skills provide
  protected getExtraTools(_context: SkillContext): any[] {
    return []
  }

  async run(state: AgentState, config?: any) {
    const provider = new AiProviderService()
    const llm = config?.llm || await provider.getChatModel({ streaming: true })
    const nodeName = config?.nodeName || this.constructor.name.replace(/Node$/, '').replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')

    logger.info(`[Agent: ${nodeName}] Starting execution loop...`)

    const context: SkillContext = {
      dataSourceId: state.dataSourceId,
      dbType: state.dbType,
      userId: state.userId,
    }

    const skills = this.getSkills(context)
    let tools = [...skills.flatMap(s => s.getTools(context)), ...this.getExtraTools(context)]

    // Security Agent: whitelist approach - only keep validate_sql, submit_sql_solution
    const isSecurityAgent = this.constructor.name === 'SecurityAgentNode' || nodeName === 'security_agent'
    if (isSecurityAgent) {
      // STRICT MODE: No discovery tools allowed. Trust the ROT.
      const allowedTools = ['validate_sql', 'submit_sql_solution']
      const originalCount = tools.length
      tools = tools.filter(t => allowedTools.includes(t.name))
      if (tools.length < originalCount) {
        logger.info(`[Agent: ${nodeName}] Whitelisted ${tools.length} tools: ${tools.map(t => t.name).join(', ')} (stripped ${originalCount - tools.length}).`)
      }
    }
    const skillPrompts = skills.map((s: any) => s.getSystemPrompt(context)).join('\n\n')

    // Generate Specialized System Prompt based on node name
    const promptTemplate = PROMPT_MAP[nodeName] || AGENT_SYSTEM_PROMPT_TEMPLATE

    // P1-1: Only use structured renderKnowledgeBase (no raw JSON dump)
    const envHeader = `[数据环境] ${state.dbType.toUpperCase()} | 数据源ID: ${state.dataSourceId || '未知'} | 期望语法: ${state.dbType === 'elasticsearch' ? 'LUCENE' : 'SQL'}\n`

    // Inject state.sql into Security Agent's prompt so it knows exactly what to validate
    const sqlContext = isSecurityAgent && state.sql
      ? `\n\n### ⚡ 待审计 SQL (来自上游 Generator)\n\`\`\`sql\n${state.sql}\n\`\`\`\n> 请对上述 SQL 执行 validate_sql 验证，确认无误后直接 submit_sql_solution 提交。\n`
      : ''

    const systemPrompt = envHeader + (typeof promptTemplate === 'function'
      ? (promptTemplate as any)(state.dbType, skillPrompts)
      : promptTemplate) + sqlContext + this.renderKnowledgeBase(state.intermediate_results || {})

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
    const MAX_LOOPS = 15
    const attemptedToolCalls = new Set<string>()
    const intermediateResults: Record<string, any> = { ...(state.intermediate_results || {}) }

    while (loopCount < MAX_LOOPS) {
      loopCount++
      if (loopCount > 1) {
        // Simple throttle to avoid aggressive 429 when polling tools
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      const response = await modelWithTools.invoke(messages, config)
      response.additional_kwargs = { ...response.additional_kwargs, node: nodeName }

      const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
      if (responseContent.trim()) {
        logger.info(`[Agent: ${nodeName}] Cycle ${loopCount} Thought: ${responseContent.slice(0, 100)}...`)
      }

      messages.push(response)
      newMessages.push(response)

      if (response.tool_calls && response.tool_calls.length > 0) {
        // 1. Check for Submission / Termination Tools
        const sqlSubmission = response.tool_calls.find((c: { name: string }) => c.name === 'submit_sql_solution')
        if (sqlSubmission) {
          logger.info('[Agent] SQL Solution Submitted')
          return this.finalizeStep(state, newMessages, {
            sql: sqlSubmission.args.sql,
            explanation: sqlSubmission.args.explanation,
            intermediate_results: intermediateResults,
          }, true)
        }

        // P0-1: save_blueprint is a FIRST-CLASS termination signal.
        // Discovery Agent must exit immediately after saving the blueprint.
        const blueprintCall = response.tool_calls.find((c: { name: string }) => c.name === 'save_blueprint')
        if (blueprintCall) {
          intermediateResults.blueprint = blueprintCall.args.blueprint
          // Capture the Relational Operator Tree (ROT) if present
          if (blueprintCall.args.queryPlanGraph) {
            intermediateResults.queryPlanGraph = blueprintCall.args.queryPlanGraph
          }
          logger.info('[Agent] Blueprint & ROT saved. Discovery Agent terminating immediately.')
          return this.finalizeStep(state, newMessages, {
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

          // Universal Circuit Breaker: Prevent identical tool calls with same args
          const callHash = `${toolCall.name}:${JSON.stringify(toolCall.args)}`
          if (attemptedToolCalls.has(callHash)) {
            return {
              messages: newMessages,
              error: `Loop detected on tool: ${toolCall.name}. Same arguments were used recently. The agent is stuck.`,
              next: 'respond_directly', // Break the loop and report
              intermediate_results: intermediateResults,
            }
          }
          attemptedToolCalls.add(callHash)

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
                try {
                  toolOutput = await tool.invoke(toolCall.args, config)

                  // --- EXECUTION-GUIDED REPAIR (EGR) START ---
                  if (
                    isSecurityAgent
                    && toolCall.name === 'validate_sql'
                    && (toolOutput.startsWith('Validation Failed') || toolOutput.startsWith('Safety Error'))
                  ) {
                    const currentRepairs = state.repairAttempts || 0
                    const MAX_REPAIRS = 3

                    if (currentRepairs < MAX_REPAIRS) {
                      logger.warn(`[EGR] SQL Validation Failed. Triggering repair attempt ${currentRepairs + 1}/${MAX_REPAIRS}. Error: ${toolOutput}`)

                      const feedbackMessage = new HumanMessage({
                        content: `[SYSTEM: SQL VALIDATION FAILED]
Your previous SQL had an error:
"${toolOutput}"

Instructions:
1. Review the error carefully.
2. DO NOT retry the exact same SQL.
3. Check the Blueprint/ROT again.
4. Generate a corrected SQL.`,
                      })

                      const toolMessage = new ToolMessage({
                        content: toolOutput,
                        tool_call_id: toolCall.id!,
                        name: toolCall.name,
                        additional_kwargs: { node: nodeName },
                      })

                      return {
                        messages: [...newMessages, toolMessage, feedbackMessage],
                        next: 'generator_agent',
                        repairAttempts: currentRepairs + 1,
                        intermediate_results: intermediateResults,
                      }
                    } else {
                      logger.error('[EGR] Max repair attempts reached.')
                      toolOutput = `Validation Failed (Max Retries Exceeded): ${toolOutput}`
                    }
                  }
                  // --- EXECUTION-GUIDED REPAIR (EGR) END ---

                  if (metaTools.includes(toolCall.name)) {
                    intermediateResults[persistenceKey] = toolOutput
                  }
                } catch (e: any) {
                  toolOutput = `Error executing tool: ${e.message}`
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
        const isClarification = response.tool_calls.some((c: { name: string }) => c.name === 'clarify_intent' || c.name === 'request_metadata')
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

    let output = '\n\n### 🧠 已掌握的数据库知识 (KNOWLEDGE BASE)\n'
    output += '> 请优先参考以下结构化结论，**绝对禁止**重复探测。\n\n'

    // 1. High-Priority: Blueprint
    const blueprint = results.blueprint || results.Discovery_blueprint
    const queryPlanGraph = results.queryPlanGraph || results.Discovery_queryPlanGraph

    if (queryPlanGraph) {
      output += '#### 🌳 逻辑查询计划 (RELATIONAL OPERATOR TREE)\n'
      output += '```mermaid\n'
      output += 'graph TD\n'
      queryPlanGraph.nodes.forEach((n: any) => {
        // Cleaning details for mermaid safety (escaping quotes)
        const safeDetails = n.details.replace(/"/g, '\'').substring(0, 50)
        output += `  ${n.id}["**${n.type}**<br/>${safeDetails}"]\n`
      })
      queryPlanGraph.edges.forEach((e: any) => {
        const label = e.label ? `|${e.label}|` : ''
        output += `  ${e.source} -->${label} ${e.target}\n`
      })
      output += '```\n\n'
    }

    if (blueprint) {
      output += '#### 🗺️ 核心查询蓝图 (QUERY BLUEPRINT) [MUST FOLLOW]\n'
      output += '```markdown\n'
      output += typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint, null, 2)
      output += '\n```\n'
    }

    // 2. Summary of available Schemas/Samples (Compact)
    const tables = new Set<string>()
    Object.keys(results).forEach((k) => {
      const match = k.match(/"entityName":"([^"]+)"/)
      if (match)
        tables.add(match[1])
    })

    if (tables.size > 0) {
      output += `#### 📋 现已掌握 Schema/数据样本的表: \n\`${Array.from(tables).join('`, `')}\`\n`
    }

    // 3. Related Knowledge & Few-shots
    const knowledgeKeys = Object.keys(results).filter(k => k.startsWith('search_related_knowledge'))
    if (knowledgeKeys.length > 0) {
      output += '#### 📚 业务背景与历史案例 (RELATED KNOWLEDGE & FEW-SHOTS)\n'
      knowledgeKeys.forEach((k) => {
        try {
          const raw = results[k]
          const knowledge = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(knowledge)) {
            knowledge.forEach((item: any) => {
              output += `- **${item.topic}**: ${item.logic}\n`
              if (item.example_code) {
                output += `  - *参考实现*: \`${item.example_code}\`\n`
              }
            })
          }
        } catch (e) {
          // Silent fail for malformed JSON
        }
      })
      output += '\n'
    }

    output += '\n> 注：若上述蓝图已明确连接路径与列映射，请直接进入 SQL 编写，严禁再次调用探测工具。\n'

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
