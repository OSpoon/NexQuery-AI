import { AgentState } from '#services/agents/state'
import logger from '@adonisjs/core/services/logger'
import AiProviderService from '#services/ai_provider_service'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
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

    if (decision.includes('respond_directly')) {
      return {
        next: 'respond_directly',
        messages: [new AIMessage({ content: '抱歉，我专注于数据库查询与分析任务，无法处理与此无关的闲聊或通用话题。请问有什么数据库相关的问题我可以帮您？' })],
      }
    }

    // Fallback: When in doubt, DISCOVER first. No blind writing.
    logger.warn(`[Supervisor] Ambiguous decision: "${decision}". Routing to discovery_agent for safety.`)
    return { next: 'discovery_agent' }
  } catch (error: any) {
    const isRateLimit = error.message?.includes('429') || error.status === 429
    if (isRateLimit) {
      logger.error('[Supervisor] Rate limit hit. Aborting to prevent escalation.')
      return {
        next: 'respond_directly',
        error: '您的请求过于频繁，请稍后再试。',
        messages: [new AIMessage({ content: '抱歉，系统当前请求量过大（429），请稍等片刻再尝试。' })],
      }
    }

    logger.error({ error }, '[Supervisor] Semantic routing failed.')
    return {
      next: 'discovery_agent', // Only fallback for non-API errors
      error: `Routing error: ${error.message}`,
    }
  }
}
