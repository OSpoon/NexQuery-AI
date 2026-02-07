import { AgentState } from '#services/agents/state'
import AiProviderService from '#services/ai_provider_service'
import { SystemMessage, ToolMessage } from '@langchain/core/messages'
import { SkillContext } from '#services/skills/skill_interface'
import { AGENT_SYSTEM_PROMPT_TEMPLATE } from '#prompts/index'
import logger from '@adonisjs/core/services/logger'

export abstract class CommonAgentNode {
  protected abstract getSkills(context: SkillContext): any[]

  async run(state: AgentState, config?: any) {
    const provider = new AiProviderService()
    const llm = await provider.getChatModel({ streaming: true })

    const context: SkillContext = {
      dataSourceId: state.dataSourceId,
      dbType: state.dbType,
      userId: state.userId,
    }

    const skills = this.getSkills(context)
    const tools = skills.flatMap(s => s.getTools(context))
    const skillPrompts = skills.map((s: any) => s.getSystemPrompt(context)).join('\n\n')

    const planStr = state.plan ? JSON.stringify(state.plan, null, 2) : ''
    const resultsStr = state.intermediate_results ? JSON.stringify(state.intermediate_results, null, 2) : ''
    const systemPrompt = AGENT_SYSTEM_PROMPT_TEMPLATE(state.dbType, planStr, resultsStr, skillPrompts)

    const modelWithTools = llm.bindTools(tools)

    // Filter out previous system messages and keep only the latest 10 messages to avoid context bloat
    const history = state.messages.filter(m => m._getType() !== 'system')
    const messages = [
      new SystemMessage(systemPrompt),
      ...history.slice(-10),
    ]

    const newMessages: any[] = []
    let loopCount = 0
    const MAX_LOOPS = 10
    const attemptedSqls = new Set<string>()
    const intermediateResults: Record<string, any> = { ...(state.intermediate_results || {}) }

    while (loopCount < MAX_LOOPS) {
      loopCount++

      const response = await modelWithTools.invoke(messages, config)
      response.additional_kwargs = { ...response.additional_kwargs, node: state.next }
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
            if (!toolCall.args.dataSourceId)
              toolCall.args.dataSourceId = state.dataSourceId

            const tool = tools.find(t => t.name === toolCall.name)
            if (tool) {
              toolOutput = await tool.invoke(toolCall.args, config)
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
            additional_kwargs: { node: state.next },
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
      next: 'respond_directly',
    }
  }

  /**
   * Helper to mark plan step as completed and decide on next hop
   */
  private finalizeStep(_state: AgentState, newMessages: any[], updates: Partial<AgentState>, _isDone: boolean = false) {
    // Return END to terminate the graph after an agent finishes
    return {
      ...updates,
      messages: newMessages,
      next: 'respond_directly',
    }
  }
}
