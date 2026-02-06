import { AgentState } from '#services/agents/state'
import { SystemMessage } from '@langchain/core/messages'
import AiProviderService from '#services/ai_provider_service'
import { z } from 'zod'
import logger from '@adonisjs/core/services/logger'
import { SUPERVISOR_SYSTEM_PROMPT } from '#prompts/index'

export async function supervisorNode(state: AgentState, config?: any) {
  const provider = new AiProviderService()
  // Enable streaming for supervisor
  const llm = await provider.getChatModel({ streaming: true })

  const systemMessage = new SystemMessage(SUPERVISOR_SYSTEM_PROMPT(state.dbType))
  // Routing mainly depends on the current intent and dbType.
  // Using only the latest message to minimize latency and avoid history-induced confusion.
  const lastMessage = state.messages[state.messages.length - 1]
  const messages = [systemMessage, lastMessage]

  // Define routing schema
  const routeSchema = z.object({
    next: z.enum(['sql_agent', 'es_agent', 'respond_directly']).describe('The next agent or action to take'),
  })

  let next = 'respond_directly'
  try {
    // use modern withStructuredOutput
    const router = llm.withStructuredOutput(routeSchema)
    const result = await router.invoke(messages, {
      ...config,
      tags: [...(config?.tags || []), 'supervisor'],
    }) as { next: string }
    next = result.next || 'respond_directly'
  } catch (e) {
    // Intelligent fallback: if it's a data source, assume we want to hand off to the specialist
    const isEs = state.dbType === 'elasticsearch' || state.dbType === 'es'
    next = isEs ? 'es_agent' : 'sql_agent'
  }

  // --- Strict Enforcement: Prevent Cross-DataSource Routing ---
  if (next !== 'respond_directly') {
    const isEs = state.dbType === 'elasticsearch' || state.dbType === 'es'
    if (isEs && next === 'sql_agent') {
      logger.warn('[Supervisor] Correcting hallucination: sql_agent -> es_agent for ES source')
      next = 'es_agent'
    } else if (!isEs && next === 'es_agent') {
      logger.warn('[Supervisor] Correcting hallucination: es_agent -> sql_agent for SQL source')
      next = 'sql_agent'
    }
  }

  return { next }
}
