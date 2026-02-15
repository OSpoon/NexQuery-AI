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
          return 'Valid DML (Syntax Verified). Action: You MUST now call \'submit_sql_solution\' to finish.'
        } catch (e: any) {
          if (e.message === '__ROLLBACK__') {
            return 'Valid DML (Syntax Verified). Action: You MUST now call \'submit_sql_solution\' to finish.'
          }
          return `DML Validation Error: ${e.message}`
        }
      }

      // SELECT logic
      try {
        const explainResult = await client.rawQuery(`EXPLAIN ${sql}`)
        let performanceWarning = ''

        // Performance Analysis Logic
        if (dbType === 'postgresql') {
          // PG: Result is usually row of 'QUERY PLAN'
          const planRows = explainResult.rows.map((r: any) => r['QUERY PLAN']).join('\n')
          if (planRows.includes('Seq Scan')) {
            performanceWarning = ' (Performance Note: Full Table Scan detected. This might be slow on large tables. Consider adding an index.)'
          }
        } else {
          // MySQL: Result is array of objects
          const rows = Array.isArray(explainResult[0]) ? explainResult[0] : explainResult
          for (const row of rows) {
            if (row.type === 'ALL') {
              performanceWarning = ' (Performance Note: Full Table Scan detected (type=ALL). Consider adding an index.)'
              break
            }
            if (Number(row.rows) > 10000 && row.key === null) {
              performanceWarning = ` (Performance Note: Scanned >10k rows (${row.rows}) without index. Optimization recommended.)`
              break
            }
          }
        }

        // Heuristic: Cross Join Check
        if (
          trimmedSql.includes('join')
          && !trimmedSql.includes('on')
          && !trimmedSql.includes('using')
        ) {
          return 'Warning: You used a JOIN without ON/USING condition. This might cause a generic Cartesian product error or logic issue. Please verify or add condition.'
        }

        return `Valid SQL${performanceWarning}. Action: You MUST now call 'submit_sql_solution' to finish.`
      } catch (e: any) {
        const errorMessage = e.message.toLowerCase()

        // Heuristic: Auto-Correction Suggestions
        // Case 1: Unknown Column
        if (
          errorMessage.includes('column')
          && (errorMessage.includes('does not exist') || errorMessage.includes('unknown') || errorMessage.includes('not found'))
        ) {
          const match = errorMessage.match(/["'](\w+)["']/)
          const badCol = match ? match[1] : 'unknown_column'
          return `Validation Failed: Column '${badCol}' does not exist in the table. Action: Use 'get_table_schema' to inspect the table columns and fix the SQL.`
        }

        // Case 2: Unknown Table
        if (errorMessage.includes('relation') || errorMessage.includes('table')) {
          const match = errorMessage.match(/["'](\w+)["']/)
          const badTable = match ? match[1] : 'unknown_table'
          return `Validation Failed: Table '${badTable}' does not exist. Action: Use 'search_tables' or 'list_tables' to find the correct table name.`
        }

        // Case 3: Group By Error
        if (errorMessage.includes('group by') || errorMessage.includes('aggregated')) {
          return `Validation Failed: SQL Group By/Aggregation error. (${e.message}). Action: Ensure all non-aggregated columns in SELECT are present in GROUP BY.`
        }

        // Case 4: Syntax Error
        if (errorMessage.includes('syntax')) {
          return `Validation Failed: SQL Syntax Error near ... (${e.message}). Action: Check for missing keywords, commas, or parentheses.`
        }

        return `Validation Failed: Database returned error: ${e.message}. Action: Read the error and fix the SQL.`
      }
    } catch (error: any) {
      return `System Error during validation: ${error.message}`
    }
  }
}
