import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'

export class GetEntitySchemaTool extends StructuredTool {
  name = 'get_entity_schema'
  description = 'Get the schema (fields, types, comments) for a specific entity (table or index). Use this to understand the structure before writing queries.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    entityName: z.string().describe('The name of the entity (table or index) to inspect'),
  })

  async _call({ dataSourceId, entityName }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const schema = await DiscoveryService.getEntitySchema(dataSourceId, entityName)

      let description = `Entity: ${entityName}\nFields:\n`
      description += schema.fields.map((f) => {
        const primary = f.isPrimary ? ' [PRI]' : ''
        const sensitive = f.isSensitive ? ' [SENSITIVE]' : ''
        const comment = f.comment ? ` // ${f.comment}` : ''
        return `- ${f.name} (${f.type}${primary})${sensitive}${comment}`
      }).join('\n')

      if (schema.foreignKeys && schema.foreignKeys.length > 0) {
        description += '\n\nForeign Keys (Relationships):\n'
        description += schema.foreignKeys.map((fk) => {
          return `- ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`
        }).join('\n')
      }

      return description
    } catch (error: any) {
      return `Error getting entity schema: ${error.message}`
    }
  }
}
