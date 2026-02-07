import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { AgentState } from '#services/agents/state'
import { supervisorNode } from '#services/agents/nodes/supervisor'
import { discoveryAgentNode } from '#services/agents/nodes/discovery_agent'
import { generatorAgentNode } from '#services/agents/nodes/generator_agent'
import { securityAgentNode } from '#services/agents/nodes/security_agent'

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
  workflow.addNode('discovery_agent', discoveryAgentNode)
  workflow.addNode('generator_agent', generatorAgentNode)
  workflow.addNode('security_agent', securityAgentNode)

  // Add Edges
  workflow.addEdge(START, 'supervisor' as any)

  workflow.addConditionalEdges(
    'supervisor' as any,
    (state: AgentState) => state.next || 'respond_directly',
    {
      discovery_agent: 'discovery_agent',
      generator_agent: 'generator_agent',
      respond_directly: END,
    } as any,
  )

  // Sequential Pipeline: Discovery -> Generator -> Security -> END
  workflow.addEdge('discovery_agent' as any, 'generator_agent' as any)
  workflow.addEdge('generator_agent' as any, 'security_agent' as any)
  workflow.addEdge('security_agent' as any, END)

  return workflow.compile()
}
