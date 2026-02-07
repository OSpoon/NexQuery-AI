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
  const systemPrompt = SUPERVISOR_SYSTEM_PROMPT(state.dbType, state.dataSourceId)

  // Sanitize history for Supervisor as well
  const history = state.messages
    .filter(m => m._getType() !== 'system' && m._getType() !== 'tool')
    .map((m) => {
      if (m._getType() === 'ai' && m.additional_kwargs?.tool_calls) {
        return { ...m, tool_calls: [], additional_kwargs: { ...m.additional_kwargs, tool_calls: undefined } }
      }
      return m
    })

  const messages: any[] = [
    new SystemMessage(systemPrompt),
    ...history.slice(-5), // Keep a small sliding window of history
  ]

  const routeSchema = z.object({
    next: z.enum(['discovery_agent', 'respond_directly']).describe('Next expert or final response'),
  })

  try {
    const router = llm.withStructuredOutput(routeSchema)
    const result = await router.invoke(messages, config) as { next: string }
    return { next: result.next || 'respond_directly' }
  } catch (e) {
    console.error('Supervisor Routing Error:', e)
    return { next: 'discovery_agent' }
  }
}
