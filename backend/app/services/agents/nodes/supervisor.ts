import { AgentState } from '#services/agents/state'
import { SystemMessage } from '@langchain/core/messages'
import AiProviderService from '#services/ai_provider_service'
import { z } from 'zod'
import { SUPERVISOR_SYSTEM_PROMPT } from '#prompts/index'

export async function supervisorNode(state: AgentState, config?: any) {
  // 1. Completion Check: If we have enough data and no pending plan steps
  // (In a real collaboration, Orchestrator decides if it's done)

  const provider = new AiProviderService()
  const llm = await provider.getChatModel({ streaming: true })

  // 1. Build Context
  const systemPrompt = SUPERVISOR_SYSTEM_PROMPT(state.dbType)
  const messages: any[] = [
    new SystemMessage(systemPrompt),
    ...state.messages.slice(-5), // Keep a small sliding window of history
  ]

  const routeSchema = z.object({
    next: z.enum(['sql_agent', 'es_agent', 'respond_directly']).describe('Next expert or final response'),
  })

  try {
    const router = llm.withStructuredOutput(routeSchema)
    const result = await router.invoke(messages, config) as { next: string }
    return { next: result.next || 'respond_directly' }
  } catch (e) {
    console.error('Supervisor Routing Error:', e)
    const isEs = state.dbType === 'elasticsearch' || state.dbType === 'es'
    return { next: isEs ? 'es_agent' : 'sql_agent' }
  }
}
