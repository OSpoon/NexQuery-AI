import DataSource from '#models/data_source'
import DbHelper from '#services/db_helper'

export interface AuditWarning {
  type: 'security' | 'performance'
  level: 'warning' | 'critical'
  message: string
  detail?: any
}

export interface AuditResult {
  passed: boolean
  warnings: AuditWarning[]
}

export default class SqlAuditService {
  private static readonly RESTRICTED_KEYWORDS = [
    'DROP',
    'TRUNCATE',
    'DELETE',
    'UPDATE',
    'ALTER',
    'GRANT',
    'REVOKE',
  ]

  /**
   * Audit SQL for security and performance issues
   */
  public async audit(sql: string, dataSourceId: number): Promise<AuditResult> {
    const warnings: AuditWarning[] = []

    // 1. Static Security Check
    this.staticSecurityCheck(sql, warnings)

    // 2. Performance Check (EXPLAIN)
    try {
      await this.performanceCheck(sql, dataSourceId, warnings)
    } catch (error) {
      console.warn('[SqlAuditService] Performance check failed:', error.message)
      // Don't block the result if EXPLAIN fails, but log it
    }

    return {
      passed: !warnings.some(w => w.level === 'critical'),
      warnings,
    }
  }

  /**
   * Static analysis of SQL for dangerous commands
   */
  private staticSecurityCheck(sql: string, warnings: AuditWarning[]) {
    const upperSql = sql.toUpperCase()

    // check for restricted keywords
    for (const keyword of SqlAuditService.RESTRICTED_KEYWORDS) {
      if (upperSql.includes(keyword)) {
        // Special case: DELETE/UPDATE without WHERE
        if ((keyword === 'DELETE' || keyword === 'UPDATE') && !upperSql.includes('WHERE')) {
          warnings.push({
            type: 'security',
            level: 'critical',
            message: `Detected ${keyword} operation without a WHERE clause. This could impact all rows in the table.`,
          })
        } else {
          warnings.push({
            type: 'security',
            level: 'warning',
            message: `Detected sensitive operation: ${keyword}. Please ensure you have permission and this is intended.`,
          })
        }
      }
    }
  }

  /**
   * Performance analysis using EXPLAIN
   */
  private async performanceCheck(sql: string, dataSourceId: number, warnings: AuditWarning[]) {
    // Only audit SELECT statements for performance for now
    if (!sql.trim().toUpperCase().startsWith('SELECT'))
      return

    const ds = await DataSource.findOrFail(dataSourceId)

    try {
      const { client } = await DbHelper.getRawConnection(ds.id)

      if (ds.type === 'postgresql') {
        const explainResult = await client.query(`EXPLAIN ${sql}`)
        this.parsePostgresExplain(explainResult, warnings)
      } else {
        const [explainResult] = await client.execute(`EXPLAIN ${sql}`)
        this.parseMysqlExplain(explainResult, warnings)
      }
      await client.end()
    } catch (error) {
      console.warn('[SqlAuditService] Performance check failed:', error.message)
    } finally {
      // client.end() handled above
    }
  }

  private parseMysqlExplain(result: any, warnings: AuditWarning[]) {
    const rows = result
    for (const row of rows) {
      // MySQL Explain types: ALL (Full Table Scan), index (Full Index Scan)
      if (row.type === 'ALL') {
        warnings.push({
          type: 'performance',
          level: 'warning',
          message: `Table '${row.table}' is using a Full Table Scan (type: ALL). This may be slow on large datasets.`,
          detail: row,
        })
      } else if (row.type === 'index') {
        warnings.push({
          type: 'performance',
          level: 'warning',
          message: `Table '${row.table}' is using a Full Index Scan. Consider adding more specific filters.`,
        })
      }

      // Check rows scanned
      if (row.rows > 100000) {
        warnings.push({
          type: 'performance',
          level: 'warning',
          message: `Query expects to scan ${row.rows.toLocaleString()} rows in table '${row.table}'.`,
        })
      }
    }
  }

  private parsePostgresExplain(result: any, warnings: AuditWarning[]) {
    const explainText = JSON.stringify(result.rows)
    if (explainText.includes('Seq Scan')) {
      warnings.push({
        type: 'performance',
        level: 'warning',
        message:
          'Detected sequential scan (Seq Scan). This indicates a full table scan and might need an index.',
      })
    }
  }
}
