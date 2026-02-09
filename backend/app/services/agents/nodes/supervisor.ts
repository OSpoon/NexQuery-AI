import { AgentState } from '#services/agents/state'
import logger from '@adonisjs/core/services/logger'
import AiProviderService from '#services/ai_provider_service'
import { HumanMessage } from '@langchain/core/messages'
import { SUPERVISOR_PROMPT } from '#prompts/index'

export const supervisorNode = async (state: AgentState) => {
  const lastMessage = state.messages[state.messages.length - 1]
  const content = (typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content))

  logger.info(`[Supervisor] Semantic reasoning for: "${content.slice(0, 50)}..."`)

  try {
    const aiProvider = new AiProviderService()
    const model = await aiProvider.getChatModel({ temperature: 0 }) // Low temperature for consistent classification

    const response = await model.invoke([
      new HumanMessage(SUPERVISOR_PROMPT(content)),
    ])

    const decision = response.content.toString().trim().toLowerCase()

    if (decision.includes('discovery_agent')) {
      return { next: 'discovery_agent' }
    }

    if (decision.includes('generator_agent')) {
      return { next: 'generator_agent' }
    }

    // Fallback if LLM output is unexpected
    logger.warn(`[Supervisor] Unexpected LLM decision: "${decision}". Falling back to generator_agent.`)
    return { next: 'generator_agent' }
  } catch (error) {
    logger.error({ error }, '[Supervisor] Semantic routing failed. Falling back to generator_agent.')
    return { next: 'generator_agent' }
  }
}
