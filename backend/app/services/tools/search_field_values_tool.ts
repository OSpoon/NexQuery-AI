import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import DiscoveryService from '#services/discovery_service'
import logger from '@adonisjs/core/services/logger'

export class SearchFieldValuesTool extends StructuredTool {
  name = 'search_field_values'
  description
    = 'Search for actual values in a specific field (column) using a fuzzy keyword. Use this when you are unsure about the exact spelling or format of a value (e.g. user name, status code).'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source.'),
    entityName: z.string().describe('The name of the entity (table or index) to search.'),
    fieldName: z.string().describe('The name of the field (column) to search.'),
    keyword: z.string().describe('The fuzzy keyword to search for.'),
    limit: z.number().describe('Max results.').default(5),
  })

  async _call({
    dataSourceId,
    entityName,
    fieldName,
    keyword,
    limit,
  }: z.infer<typeof this.schema>) {
    try {
      logger.info(`[SearchFieldValuesTool] Searching field "${fieldName}" in "${entityName}"`)
      return await DiscoveryService.searchFieldValues(dataSourceId, entityName, fieldName, keyword, limit)
    } catch (error: any) {
      return `Error searching field values: ${error.message}`
    }
  }
}
