import { BaseMessage } from '@langchain/core/messages'

export interface AgentState {
  // LangGraph standard: List of messages
  messages: BaseMessage[]

  // Context
  userId?: number
  dataSourceId?: number
  dbType: string

  // Intermediate Outputs
  sql?: string
  lucene?: string
  explanation?: string

  // Routing
  next?: string

  // Errors
  error?: string
}
