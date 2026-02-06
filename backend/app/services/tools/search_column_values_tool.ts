import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import db from '@adonisjs/lucid/services/db'
import DataSource from '#models/data_source'

export class SearchColumnValuesTool extends StructuredTool {
  name = 'search_column_values'
  description
    = 'Search for actual values in a specific database table column using a fuzzy keyword. Use this when you are unsure about the exact spelling or format of a value (e.g. user name, product name, status code) referenced by the user.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to execute the query on.'),
    tableName: z.string().describe('The name of the table to search.'),
    columnName: z.string().describe('The name of the column to search.'),
    keyword: z.string().describe('The keyword to search for (fuzzy match).'),
    limit: z.number().describe('Max number of results to return.').default(5),
  })

  async _call({
    dataSourceId,
    tableName,
    columnName,
    keyword,
    limit,
  }: z.infer<typeof this.schema>) {
    try {
      const dataSource = await DataSource.find(dataSourceId)
      if (!dataSource) {
        return 'Error: Data source not found.'
      }

      // Basic SQL Injection prevention for table/column names
      // In a real production env, verify against schema or use strict quoting
      if (!/^\w+$/.test(tableName) || !/^\w+$/.test(columnName)) {
        return 'Error: Invalid table or column name format.'
      }

      const connection = db.connection(
        dataSource.type === 'mysql' || dataSource.type === 'postgresql'
          ? `ds_${dataSource.id}`
          : undefined,
      )

      // Use dynamic query building which handles parameter binding for values
      const results = await connection
        .from(tableName)
        .select(columnName)
        .where(columnName, 'like', `%${keyword}%`)
        .distinct(columnName)
        .limit(limit)

      // Map to array of strings for cleaner LLM consumption
      const values = results.map(row => row[columnName])

      return JSON.stringify({
        found: values.length > 0,
        values,
        note:
          values.length === 0 ? 'No matches found. Try a different keyword or table.' : undefined,
      })
    } catch (error: any) {
      return `Error searching column values: ${error.message}`
    }
  }
}
