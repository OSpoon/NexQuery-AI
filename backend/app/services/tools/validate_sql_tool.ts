import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'

export class ValidateSqlTool extends StructuredTool {
  name = 'validate_sql'
  description =
    'Validate a generated SQL query by running EXPLAIN. Use this to ensure syntax correctness before the final answer.'

  schema = z.object({
    dataSourceId: z.number(),
    sql: z.string().describe('The SQL query to validate. Must be a SELECT query.'),
  })

  async _call({ dataSourceId, sql }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)

      const trimmedSql = sql.trim().toLowerCase()
      // Relaxed check: Allow UPDATE/DELETE but warn about safety later.
      // For now, let's keep it safe but allow CTEs and different select forms.
      if (
        !trimmedSql.startsWith('select') &&
        !trimmedSql.startsWith('with') &&
        !trimmedSql.startsWith('explain') &&
        !trimmedSql.startsWith('show') &&
        !trimmedSql.startsWith('describe')
      ) {
        // It's a DML (UPDATE, DELETE, INSERT, etc.) or DDL
        // Safety check: specific dangerous commands
        if (trimmedSql.startsWith('drop') || trimmedSql.startsWith('truncate')) {
          return 'Error: DROP and TRUNCATE are not allowed even in Admin Mode for safety.'
        }

        try {
          // For DML, we MUST wrap in a transaction and rollback to validate it without executing.
          await client.transaction(async (trx) => {
            // We just want to check if it runs without syntax error
            // Note: This actually EXECUTES the query then rolls back.
            // For huge updates this might be slow, but for validation it's the only accurate way
            // aside from EXPLAIN UPDATE which isn't always supported or perfect.

            // Try to use EXPLAIN if possible for DML (PostgreSQL supports it, MySQL 5.6+ supports EXPLAIN UPDATE)
            // But for safety across versions, a rolled-back transaction is robust.
            if (dbType === 'postgresql') {
              await trx.rawQuery(`EXPLAIN ${sql}`)
            } else {
              // MySQL: EXPLAIN works on DELETE/INSERT/REPLACE/UPDATE
              await trx.rawQuery(`EXPLAIN ${sql}`)
            }
          })
          return 'Valid DML (Syntax Verified)'
        } catch (e: any) {
          return `DML Validation Error: ${e.message}`
        }
      }

      try {
        // Run EXPLAIN to validate syntax and references
        await client.rawQuery(`EXPLAIN ${sql}`)

        // If EXPLAIN passes, we perform a lightweight heuristic check for common logical pitfalls
        // e.g. Cross Joins without conditions (simulated check)
        if (
          trimmedSql.includes('join') &&
          !trimmedSql.includes('on') &&
          !trimmedSql.includes('using')
        ) {
          return 'Warning: You used a JOIN without ON/USING condition. This might cause a generic Cartesian product error or logic issue. Please verify.'
        }

        return 'Valid SQL'
      } catch (e: any) {
        const errorMessage = e.message.toLowerCase()

        // Heuristic: Auto-Correction Suggestions
        // Case 1: Unknown Column
        if (
          errorMessage.includes('column') &&
          (errorMessage.includes('does not exist') || errorMessage.includes('unknown'))
        ) {
          // Extract column name from error if possible (PG puts it in quotes usually)
          // PG: column "foo" does not exist
          // MySQL: Unknown column 'foo' in 'field list'
          const match = errorMessage.match(/["'](\w+)["']/)
          if (match) {
            const badCol = match[1]
            // We need to guess which table they meant. Since we don't parse the SQL to find the aliased table easily here without a parser,
            // we'll try to find *any* table in the schema that has a similar column.
            // This is expensive so we only do it on error.

            // For now, simpler approach: Suggest strictly based on message
            return `SQL Validation Error: Column '${badCol}' does not exist. Please check the schema using 'get_table_schema' to find the correct column name.`
          }
        }

        // Case 2: Unknown Table
        if (errorMessage.includes('relation') || errorMessage.includes('table')) {
          const match = errorMessage.match(/["'](\w+)["']/)
          if (match) {
            return `SQL Validation Error: Table '${match[1]}' does not exist. Please use 'list_tables' to see available tables.`
          }
        }

        return `SQL Validation Error: ${e.message}`
      }
    } catch (error: any) {
      return `System Error during validation: ${error.message}`
    }
  }
}
