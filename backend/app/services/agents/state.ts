import { BaseMessage } from '@langchain/core/messages'

export interface PlanStep {
  task: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  assigned_to: 'sql_agent' | 'es_agent' | 'discovery_agent' | 'generator_agent' | 'security_agent'
  description?: string
}

export interface AgentState {
  // LangGraph standard: List of messages
  messages: BaseMessage[]

  // Context
  userId?: number
  dataSourceId?: number
  dbType: string

  // Intermediate Outputs
  sql?: string
  explanation?: string

  // Collaborative Planning
  plan?: PlanStep[]
  intermediate_results?: Record<string, any>

  // Routing
  next?: string

  // Errors
  error?: string
}
