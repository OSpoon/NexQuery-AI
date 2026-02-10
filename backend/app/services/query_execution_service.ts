import type QueryTask from '#models/query_task'
import QueryLog from '#models/query_log'
import type DataSource from '#models/data_source'
import logger from '@adonisjs/core/services/logger'
import { exec } from 'node:child_process'
import util from 'node:util'
import DbHelper from '#services/db_helper'

const execAsync = util.promisify(exec)
const ALLOWED_COMMAND_PREFIXES = ['curl']

export interface ExecuteOptions {
  userId?: number
  ipAddress?: string
  userAgent?: string
  deviceInfo?: any
  skipLogging?: boolean
}

export default class QueryExecutionService {
  async execute(
    task: QueryTask,
    inputParams: Record<string, any> = {},
    options: ExecuteOptions = {},
  ) {
    const { userId, ipAddress, userAgent, deviceInfo } = options
    const sql = task.sqlTemplate

    // Fetch timeout setting
    // const timeoutSetting = await Setting.findBy('key', 'query_timeout_ms')
    const timeout = 30000 // Number.parseInt(timeoutSetting?.value || '30000')

    // Load dataSource if not already loaded
    let ds: any = task.dataSource
    if (task.dataSourceId === 9999) {
      ds = { id: 9999, type: 'sqlite', database: 'spider_eval' }
    } else if (!ds) {
      await task.load('dataSource')
      ds = task.dataSource
    }
    const startTime = Date.now()
    let executedSql = ''
    let queryResults: any = null
    let duration = 0

    const replaceVars = (template: string, params: Record<string, any>, mode: 'sql' | 'text' | 'pg' = 'sql') => {
      const values: any[] = []
      let pgCounter = 1
      const result = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
        const val = params[key] ?? null
        if (mode === 'pg') {
          values.push(val)
          return `$${pgCounter++}`
        } else if (mode === 'sql') {
          values.push(val)
          return '?'
        }
        return String(val ?? '')
      })
      return { result, values }
    }

    try {
      if (ds.type === 'mysql') {
        const { result, values } = replaceVars(sql, inputParams, 'sql')
        executedSql = result
        const { client } = await DbHelper.getRawConnection(ds.id, timeout)
        const [rows] = await (client as any).execute({ sql: executedSql, values, timeout })
        await client.end()
        queryResults = rows
      } else if (ds.type === 'postgresql') {
        const { result, values } = replaceVars(sql, inputParams, 'pg')
        executedSql = result
        const { client } = await DbHelper.getRawConnection(ds.id, timeout)
        try {
          const res = await client.query(executedSql, values)
          queryResults = res.rows
        } finally {
          await client.end()
        }
      } else if (ds.type === 'api') {
        const { result } = replaceVars(sql, inputParams, 'text')
        executedSql = result

        const commandToExecute = executedSql.trim()
        const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix =>
          commandToExecute.startsWith(prefix),
        )

        if (!isAllowed) {
          throw new Error(
            `Command validation failed: Only commands starting with [${ALLOWED_COMMAND_PREFIXES.join(', ')}] are allowed.`,
          )
        }

        const { stdout } = await execAsync(executedSql, {
          timeout,
          maxBuffer: 10 * 1024 * 1024,
        })

        try {
          queryResults = JSON.parse(stdout)
        } catch (e) {
          if (stdout.trim().startsWith('[') || stdout.trim().startsWith('{')) {
            queryResults = { raw: stdout }
          } else {
            queryResults = stdout
              .split('\n')
              .filter(l => l)
              .map((l, i) => ({ line: i + 1, content: l }))
          }
        }
      } else if (ds.type === 'elasticsearch') {
        const esService = await DbHelper.getESService(ds.id)
        const { result } = replaceVars(sql, inputParams, 'text')
        executedSql = result

        const index = inputParams.index || ds.database || '*'
        const size = Number.parseInt(inputParams.size || inputParams.limit) || 100

        let query = executedSql.trim() || '*'
        if ((query === '*' || !query) && inputParams.query && inputParams.query !== '*') {
          query = inputParams.query
        }

        const esResults = await esService.search({ index, query, size })
        executedSql = `ES SEARCH: index=${index} query="${query}" size=${size}`
        queryResults = esResults
      } else if (ds.type === 'sqlite' || ds.id === 9999) {
        const { result, values } = replaceVars(sql, inputParams, 'sql')
        executedSql = result
        const { client } = await DbHelper.getRawConnection(ds.id, timeout)
        const rows = await client.all(executedSql, values)
        queryResults = rows
      } else {
        throw new Error(`Unsupported database type: ${ds.type}`)
      }

      duration = Date.now() - startTime
      const MAX_LOG_ROWS = 50
      const normalizedRows = Array.isArray(queryResults)
        ? queryResults.map((row: any) => ({ ...row }))
        : queryResults
          ? { ...queryResults }
          : queryResults

      const truncatedResults = task.storeResults
        ? Array.isArray(normalizedRows)
          ? normalizedRows.slice(0, MAX_LOG_ROWS)
          : normalizedRows
        : null

      await QueryLog.log({ request: { ip: () => ipAddress || '', header: (key: string) => (key === 'user-agent' ? userAgent : '') } }, {
        userId,
        taskId: task.id,
        dataSourceId: task.dataSourceId,
        executedSql,
        parameters: inputParams,
        executionTimeMs: duration,
        results: truncatedResults,
        status: 'success',
        deviceInfo,
      })

      logger.info({ taskId: task.id, userId, duration }, 'Query executed successfully')

      // Apply Advanced Configuration (Enum Mapping & Aliasing)
      if (ds.config && ds.config.advanced_config && Array.isArray(queryResults)) {
        queryResults = this.applyAdvancedConfig(queryResults, ds.config.advanced_config)
      }

      return {
        data: queryResults,
        duration,
      }
    } catch (error: any) {
      await QueryLog.log({ request: { ip: () => ipAddress || '', header: (key: string) => (key === 'user-agent' ? userAgent : '') } }, {
        userId,
        taskId: task.id,
        dataSourceId: task.dataSourceId,
        executedSql: executedSql || sql,
        parameters: inputParams,
        status: 'failed',
        errorMessage: error.message,
        deviceInfo,
      })

      logger.error({ taskId: task.id, userId, error: error.message }, 'Query execution failed')

      throw error
    }
  }

  /**
   * Execute raw SQL for preview purposes (with safety limits)
   */
  async rawExecute(dataSource: DataSource, sql: string, options: ExecuteOptions = {}) {
    const { userId, ipAddress, userAgent, deviceInfo } = options
    const timeout = 30000
    const startTime = Date.now()
    let queryResults: any = null

    // Force limit 50 for safety
    let finalSql = sql.trim()
    if (dataSource.type === 'mysql' || dataSource.type === 'postgresql') {
      // Remove trailing semicolon if present
      finalSql = finalSql.replace(/;$/, '')
      // Simple check for existing limit
      if (!/\bLIMIT\b/i.test(finalSql)) {
        finalSql += ' LIMIT 50'
      }
    }

    try {
      if (dataSource.type === 'sqlite' || dataSource.id === 9999) {
        const { client } = await DbHelper.getRawConnection(dataSource.id, timeout)
        queryResults = await client.all(finalSql)
      } else if (dataSource.type === 'mysql') {
        const { client } = await DbHelper.getRawConnection(dataSource.id, timeout)
        const [rows] = await (client as any).execute({ sql: finalSql, timeout })
        await client.end()
        queryResults = rows
      } else if (dataSource.type === 'postgresql') {
        const { client } = await DbHelper.getRawConnection(dataSource.id, timeout)
        try {
          const res = await client.query(finalSql)
          queryResults = res.rows
        } finally {
          await client.end()
        }
      } else if (dataSource.type === 'elasticsearch') {
        const esService = await DbHelper.getESService(dataSource.id)
        const isHealthy = await esService.testConnection()
        if (!isHealthy)
          throw new Error('Failed to connect to Elasticsearch')

        queryResults = await esService.search({
          index: dataSource.database || '*',
          query: sql || '*',
          size: 10,
        })
      } else {
        throw new Error(`Execution not supported for type: ${dataSource.type}`)
      }

      const duration = Date.now() - startTime

      if (!options.skipLogging) {
        await QueryLog.log({ request: { ip: () => ipAddress || '', header: (key: string) => (key === 'user-agent' ? userAgent : '') } }, {
          userId,
          dataSourceId: dataSource.id,
          executedSql: finalSql,
          executionTimeMs: duration,
          status: 'success',
          deviceInfo,
        })
      }

      return {
        data: queryResults,
        duration,
      }
    } catch (error: any) {
      if (!options.skipLogging) {
        await QueryLog.log({ request: { ip: () => ipAddress || '', header: (key: string) => (key === 'user-agent' ? userAgent : '') } }, {
          userId,
          dataSourceId: dataSource.id,
          executedSql: finalSql || sql,
          status: 'failed',
          errorMessage: error.message,
          deviceInfo,
        })
      }

      throw error
    }
  }

  public applyAdvancedConfig(results: any[], advancedConfig: any[]): any[] {
    const fieldMap = new Map<
      string,
      { alias?: string, enums?: Record<string, string>, masking?: any }
    >()

    // Flatten config for O(1) lookup by field name (Store lowercase keys)
    for (const tableConfig of advancedConfig) {
      if (tableConfig.fields) {
        for (const field of tableConfig.fields) {
          if (field.name) {
            fieldMap.set(field.name.toLowerCase(), {
              alias: field.alias,
              enums: field.enums,
              masking: field.masking,
            })
          }
        }
      }
    }

    if (fieldMap.size > 0) {
      // Debug Log
      logger.info(
        {
          fields: Array.from(fieldMap.keys()),
          sampleRowKeys: results.length > 0 ? Object.keys(results[0]) : [],
        },
        'Applying Advanced Config',
      )

      return results.map((row: any) => {
        const newRow: Record<string, any> = {}
        for (const key in row) {
          // Case-insensitive lookup
          const config = fieldMap.get(key.toLowerCase())

          if (config) {
            let value = row[key] // Use original value
            // Debug specific field masking
            if (config.masking && config.masking.type !== 'none') {
              // logger.info({ key, original: value, rule: config.masking }, 'Masking Value')
            }

            // Apply Enum Mapping
            if (config.enums) {
              // Handle loose type matching (e.g. 1 vs "1")
              const strVal = String(value)
              if (config.enums[strVal] !== undefined) {
                value = config.enums[strVal]
              } else if (typeof value === 'boolean') {
                // Try mapping boolean to 1/0 string if not found
                const boolStr = value ? '1' : '0'
                if (config.enums[boolStr] !== undefined) {
                  value = config.enums[boolStr]
                }
              }
            }

            // Apply Masking
            if (config.masking && config.masking.type && config.masking.type !== 'none') {
              value = this.maskValue(value, config.masking)
            }

            // Apply Alias
            const finalKey = config.alias || key
            newRow[finalKey] = value
          } else {
            newRow[key] = row[key] // Keep original if no config
          }
        }
        return newRow
      })
    }

    return results
  }

  private maskValue(value: any, rule: { type: string, rule?: string, replace?: string }): any {
    if (value === null || value === undefined)
      return value
    const strVal = String(value)

    switch (rule.type) {
      case 'name':
        // Mask Chinese Name: 张三 -> 张*, 李晓明 -> 李*明, 欧阳锋 -> 欧**锋
        if (strVal.length <= 1)
          return strVal
        if (strVal.length === 2)
          return `${strVal[0]}*`
        return `${strVal[0]}${'*'.repeat(strVal.length - 2)}${strVal[strVal.length - 1]}`
      case 'mobile':
        // Mask middle 4 digits: 13812345678 -> 138****5678
        return strVal.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
      case 'fixed_phone':
        // Mask fixed-line: 010-12345678 -> 010-****5678 or 0755-1234567 -> 0755-****567
        return strVal.replace(/^(\d{3,4}-)\d{4}(\d+)$/, '$1****$2')
      case 'id_card':
        // Keep first 6, last 4: 110101199001011234 -> 110101********1234
        if (strVal.length >= 10) {
          return strVal.replace(/^(\d{6}).+(\w{4})$/, '$1********$2')
        }
        return strVal
      case 'email':
        // Mask characters before @: test@example.com -> t***@example.com
        return strVal.replace(/^(.)[^@]*(@.*)$/, '$1***$2')
      case 'bank_card':
        // Mask all except last 4
        if (strVal.length > 4) {
          return `**** **** **** ${strVal.slice(-4)}`
        }
        return strVal
      case 'address':
        // Mask detailed address, keeping first 6 chars
        if (strVal.length > 6) {
          return `${strVal.slice(0, 6)}******`
        }
        return strVal
      case 'ip_address':
        // Mask IP: 192.168.1.1 -> 192.168.*.*
        return strVal.replace(/^(\d+\.\d+)\.\d+\.\d+$/, '$1.*.*')
      case 'car_number':
        // Mask plate: 京A12345 -> 京A***45
        if (strVal.length >= 7) {
          return `${strVal.slice(0, 2)}***${strVal.slice(-2)}`
        }
        return strVal
      case 'custom':
        if (rule.rule) {
          try {
            const regex = new RegExp(rule.rule)
            return strVal.replace(regex, rule.replace || '****')
          } catch (e) {
            logger.warn({ rule }, 'Invalid regex rule for masking')
            return strVal
          }
        }
        return strVal
      case 'password':
        // Mask entire string
        return '******'
      default:
        return value
    }
  }
}
