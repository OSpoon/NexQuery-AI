import { AgentState } from '#services/agents/state'
import logger from '@adonisjs/core/services/logger'

export const supervisorNode = async (state: AgentState) => {
  const lastMessage = state.messages[state.messages.length - 1]
  const content = (typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content)).toLowerCase()

  logger.info(`[Supervisor] Reasoning for: "${content.slice(0, 50)}..."`)

  // Priority 1: Meta-Discovery
  // Keywords that suggest the user is asking about the structure of the data
  const metaKeywords = [
    'table',
    'list',
    'schema',
    'structure',
    'mapping',
    'index',
    'entities',
    'field',
    'column',
    '表',
    '索引',
    '结构',
    '列表',
    '字段',
    '有哪些',
    '定义',
  ]
  if (metaKeywords.some(k => content.includes(k))) {
    return { next: 'discovery_agent' }
  }

  // Priority 2: Query Generation & Execution
  // This now goes to a unified 'generator' agent which handles both SQL and Lucene.
  return { next: 'generator_agent' }
}
