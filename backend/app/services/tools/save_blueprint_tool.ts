import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SaveBlueprintTool extends StructuredTool {
  name = 'save_blueprint'
  description = 'Mandatory handover tool for the Topology Explorer. Use this to persist the final [QUERY BLUEPRINT] for the next agent. This ensures that the SQL Writer has a clear, unshakeable guide for table names, join paths, and column mappings.'

  schema = z.object({
    queryPlanGraph: z.object({
      nodes: z.array(z.object({
        id: z.string(),
        type: z.enum(['SCAN', 'FILTER', 'JOIN', 'PROJECT', 'AGGREGATE', 'SORT', 'LIMIT']),
        details: z.string().describe('Specific details: Table name for SCAN, Condition for FILTER/JOIN, Columns for PROJECT, etc.'),
      })).describe('Logical Operator Nodes (e.g., Scan Table, Filter Rows, Join Tables)'),
      edges: z.array(z.object({
        source: z.string(),
        target: z.string(),
        label: z.string().optional(),
      })).describe('Data flow edges between operators'),
    }).optional().describe('The Relational Operator Tree (ROT) / Logical Query Plan. MUST be provided for ALL queries to ensure structural correctness.'),
    blueprint: z.string().describe('The detailed structural conclusion (Tables, Join Paths, Columns, Ambiguity Resolution)'),
  })

  async _call({ blueprint: _ }: { blueprint: string }): Promise<string> {
    // The actual state update happens in CommonAgentNode.run logic by monitoring this tool call.
    return 'Blueprint saved successfully.'
  }
}
