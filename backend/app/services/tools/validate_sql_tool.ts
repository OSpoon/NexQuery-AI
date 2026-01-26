import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Parser } = require('node-sql-parser')

export class ValidateSqlTool extends StructuredTool {
  name = 'validate_sql'
  description
    = 'Validate a generated SQL query by running EXPLAIN. Use this to ensure syntax correctness before the final answer.'

  schema = z.object({
    dataSourceId: z.number(),
    sql: z.string().describe('The SQL query to validate. Must be a SELECT query.'),
  })

  static validateAst(sql: string, dbType: string): string | null {
    // 1. AST Guardrails (node-sql-parser)
    const parser = new Parser()
    let ast: any

    // Map adonis dbType to node-sql-parser options
    const parserOpt = {
      database: dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL',
    }

    try {
      ast = parser.astify(sql, parserOpt)
    } catch (e: any) {
      // If AST parsing fails, double check with regex for minimal safety.
      // Complex subqueries or specific dialect functions might fail parsing but be valid.
      // We log warnings but block if it LOOKS like a dangerous DML and we couldn't parse it.
      const upper = sql.toUpperCase()
      if (
        upper.includes('DELETE')
        || upper.includes('UPDATE')
        || upper.includes('DROP')
        || upper.includes('TRUNCATE')
      ) {
        return `AST Validation Error: Could not parse SQL to verify safety. Error: ${e.message}. Please simplify or ensure standard syntax.`
      }
    }

    if (ast) {
      const statements = Array.isArray(ast) ? ast : [ast]

      for (const stmt of statements) {
        const type = stmt.type ? String(stmt.type).toUpperCase() : ''

        // 1. Block DDL strictly
        if (['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'REPLACE', 'GRANT', 'REVOKE'].includes(type)) {
          return `Safety Error: DDL statement '${type}' is strictly prohibited.`
        }

        // 2. Enforce WHERE on DML
        if (type === 'DELETE' || type === 'UPDATE') {
          // node-sql-parser 'where' property is null if missing.
          if (!stmt.where) {
            return `Safety Error: ${type} statements MUST contain a WHERE clause to prevent accidental full-table data modification.`
          }
        }
      }
    }
    return null
  }

  async _call({ dataSourceId, sql }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)

      const validationError = ValidateSqlTool.validateAst(sql, dbType)
      if (validationError) {
        return validationError
      }

      const trimmedSql = sql.trim().toLowerCase()
      // ... (rest of logic: Syntax Verification)

      // 3. Syntax Verification (DB Native EXPLAIN)
      const isSelect
        = trimmedSql.startsWith('select')
          || trimmedSql.startsWith('with')
          || trimmedSql.startsWith('explain')
          || trimmedSql.startsWith('show')
          || trimmedSql.startsWith('describe')

      if (!isSelect) {
        // It's a DML (INSERT, UPDATE, DELETE).
        try {
          // Use Transaction Rollback to safely "Explain/Test" the DML
          await client.transaction(async (trx) => {
            if (dbType === 'postgresql') {
              await trx.rawQuery(`EXPLAIN ${sql}`)
            } else {
              // MySQL: EXPLAIN works on DELETE/INSERT/REPLACE/UPDATE
              await trx.rawQuery(`EXPLAIN ${sql}`)
            }
            // Force Rollback to prevent any execution side-effects
            throw new Error('__ROLLBACK__')
          })
          return 'Valid DML (Syntax Verified)'
        } catch (e: any) {
          if (e.message === '__ROLLBACK__') {
            return 'Valid DML (Syntax Verified)'
          }
          return `DML Validation Error: ${e.message}`
        }
      }

      // SELECT logic
      try {
        await client.rawQuery(`EXPLAIN ${sql}`)

        // Heuristic: Cross Join Check
        if (
          trimmedSql.includes('join')
          && !trimmedSql.includes('on')
          && !trimmedSql.includes('using')
        ) {
          return 'Warning: You used a JOIN without ON/USING condition. This might cause a generic Cartesian product error or logic issue. Please verify.'
        }

        return 'Valid SQL'
      } catch (e: any) {
        const errorMessage = e.message.toLowerCase()

        // Heuristic: Auto-Correction Suggestions
        // Case 1: Unknown Column
        if (
          errorMessage.includes('column')
          && (errorMessage.includes('does not exist') || errorMessage.includes('unknown'))
        ) {
          const match = errorMessage.match(/["'](\w+)["']/)
          if (match) {
            const badCol = match[1]
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
