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

    const systemPrompt = AGENT_SYSTEM_PROMPT_TEMPLATE(state.dbType, '', '', skillPrompts)

    const modelWithTools = llm.bindTools(tools)

    // Filter out previous system messages to replace with current specialized one
    const messages = [
      new SystemMessage(systemPrompt),
      ...state.messages.filter(m => m._getType() !== 'system'),
    ]

    let loopCount = 0
    const MAX_LOOPS = 10
    const attemptedSqls = new Set<string>()

    while (loopCount < MAX_LOOPS) {
      loopCount++

      // Invoke model with config to ensure callbacks propagate (essential for streamEvents)
      const response = await modelWithTools.invoke(messages, config)
      messages.push(response)

      if (response.tool_calls && response.tool_calls.length > 0) {
        // 1. Check for Submission Tools
        const sqlSubmission = response.tool_calls.find(c => c.name === 'submit_sql_solution')
        if (sqlSubmission) {
          logger.info('[Agent] SQL Solution Submitted')
          return {
            messages: [response], // Append this AI message to global state
            sql: sqlSubmission.args.sql,
            explanation: sqlSubmission.args.explanation,
            next: '__end__',
          }
        }

        const luceneSubmission = response.tool_calls.find(c => c.name === 'submit_lucene_solution')
        if (luceneSubmission) {
          logger.info('[Agent] Lucene Solution Submitted')
          return {
            messages: [response],
            lucene: luceneSubmission.args.lucene,
            explanation: luceneSubmission.args.explanation,
            next: '__end__',
          }
        }

        // 2. Execute Regular Tools
        for (const toolCall of response.tool_calls) {
          // Circuit Breaker for Loop
          if (toolCall.name === 'validate_sql') {
            const sqlToCheck = (toolCall.args.sql || '').trim()
            if (attemptedSqls.has(sqlToCheck)) {
              return {
                messages: [response],
                error: `Loop detected on SQL: ${sqlToCheck}`,
                next: '__end__',
              }
            }
            attemptedSqls.add(sqlToCheck)
          }

          let toolOutput = ''
          try {
            // Inject context
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

          messages.push(new ToolMessage({
            content: toolOutput,
            tool_call_id: toolCall.id!,
            name: toolCall.name,
          }))
        }
      } else {
        // No tools called, just return the response
        return {
          messages: [response],
          next: '__end__', // Or maybe continue conversation? For now assume one-shot query resolution.
        }
      }
    }

    return {
      error: 'Max loops reached without solution.',
      next: '__end__',
    }
  }
}
