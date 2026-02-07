import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { AgentState } from '#services/agents/state'
import { supervisorNode } from '#services/agents/nodes/supervisor'
import { sqlAgentNode } from '#services/agents/nodes/sql_agent'
import { esAgentNode } from '#services/agents/nodes/es_agent'

/**
 * Modern v1.x State Definition using Annotation API
 */
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  sql: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),
  lucene: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),
  explanation: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),
  dbType: Annotation<string | 'mysql' | 'elasticsearch'>({
    reducer: (_, y) => y,
    default: () => 'mysql',
  }),
  next: Annotation<string>({
    reducer: (_, y) => y,
    default: () => 'respond_directly',
  }),
  plan: Annotation<any[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  intermediate_results: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  userId: Annotation<number | undefined>({
    reducer: (_, y) => y,
  }),
  dataSourceId: Annotation<number | undefined>({
    reducer: (_, y) => y,
  }),
  error: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),
})

export function createAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)

  // Add Nodes
  workflow.addNode('supervisor', supervisorNode)
  workflow.addNode('sql_agent', sqlAgentNode)
  workflow.addNode('es_agent', esAgentNode)

  // Add Edges
  workflow.addEdge(START, 'supervisor' as any)

  workflow.addConditionalEdges(
    'supervisor' as any,
    (state: AgentState) => state.next || 'respond_directly',
    {
      sql_agent: 'sql_agent',
      es_agent: 'es_agent',
      respond_directly: END,
    } as any,
  )

  // Agents -> Terminate immediately (Linear flow)
  workflow.addEdge('sql_agent' as any, END)
  workflow.addEdge('es_agent' as any, END)

  return workflow.compile()
}
