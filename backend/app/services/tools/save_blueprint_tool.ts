import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SaveBlueprintTool extends StructuredTool {
  name = 'save_blueprint'
  description = 'Mandatory handover tool for the Topology Explorer. Use this to persist the final [QUERY BLUEPRINT] for the next agent. This ensures that the SQL Writer has a clear, unshakeable guide for table names, join paths, and column mappings.'

  schema = z.object({
    blueprint: z.string().describe('The detailed structural conclusion (Tables, Join Paths, Columns, Ambiguity Resolution)'),
  })

  async _call({ blueprint: _ }: { blueprint: string }): Promise<string> {
    // The actual state update happens in CommonAgentNode.run logic by monitoring this tool call.
    return 'Blueprint saved successfully.'
  }
}
