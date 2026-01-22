import QueryTask from '#models/query_task'
import QueryLog from '#models/query_log'
// import Setting from '#models/setting'
import encryption from '@adonisjs/core/services/encryption'
import mysql from 'mysql2/promise'
import pg from 'pg'
import logger from '@adonisjs/core/services/logger'
import { exec } from 'node:child_process'
import util from 'node:util'

const execAsync = util.promisify(exec)
const ALLOWED_COMMAND_PREFIXES = ['curl']

import { isInternalIP } from '../utils/ip_utils.js'

export interface ExecuteOptions {
  userId?: number
  ipAddress?: string
  userAgent?: string
  deviceInfo?: any
}

export default class QueryExecutionService {
  async execute(
    task: QueryTask,
    inputParams: Record<string, any> = {},
    options: ExecuteOptions = {}
  ) {
    const { userId, ipAddress, userAgent, deviceInfo } = options
    let sql = task.sqlTemplate

    // Fetch timeout setting
    // const timeoutSetting = await Setting.findBy('key', 'query_timeout_ms')
    const timeout = 30000 // Number.parseInt(timeoutSetting?.value || '30000')

    // Load dataSource if not already loaded
    if (!task.dataSource) {
      await task.load('dataSource')
    }
    const ds = task.dataSource
    const startTime = Date.now()
    let executedSql = ''
    let queryResults: any = null
    let duration = 0

    const allParams: Record<string, any> = {
      ...inputParams,
      ds_host: ds.host,
      ds_port: ds.port,
      ds_username: ds.username,
      ds_password: ds.password ? encryption.decrypt(ds.password) : '',
      ds_database: ds.database,
    }

    try {
      if (ds.type === 'mysql') {
        const values: any[] = []
        executedSql = sql.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
          values.push(inputParams[key] ?? null)
          return '?'
        })

        const connection = await mysql.createConnection({
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: encryption.decrypt<string>(ds.password)!,
          database: ds.database,
          connectTimeout: timeout,
        })

        const [rows] = await connection.execute({
          sql: executedSql,
          values,
          timeout: timeout,
        })
        await connection.end()
        queryResults = rows
      } else if (ds.type === 'postgresql') {
        const values: any[] = []
        let paramCounter = 1

        executedSql = sql.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
          values.push(inputParams[key] ?? null)
          return `$${paramCounter++}`
        })

        const client = new pg.Client({
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: encryption.decrypt<string>(ds.password)!,
          database: ds.database,
          connectionTimeoutMillis: timeout,
        })

        await client.connect()
        try {
          const res = await client.query(executedSql, values)
          queryResults = res.rows
        } finally {
          await client.end()
        }
      } else if (ds.type === 'api') {
        executedSql = sql.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
          const val = allParams[key] ?? ''
          return String(val)
        })

        const commandToExecute = executedSql.trim()
        const isAllowed = ALLOWED_COMMAND_PREFIXES.some((prefix) =>
          commandToExecute.startsWith(prefix)
        )

        if (!isAllowed) {
          throw new Error(
            `Command validation failed: Only commands starting with [${ALLOWED_COMMAND_PREFIXES.join(', ')}] are allowed.`
          )
        }

        const { stdout } = await execAsync(executedSql, {
          timeout: timeout,
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
              .filter((l) => l)
              .map((l, i) => ({ line: i + 1, content: l }))
          }
        }
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

      await QueryLog.create({
        userId: userId,
        taskId: task.id,
        executedSql: executedSql,
        parameters: inputParams,
        executionTimeMs: duration,
        results: truncatedResults,
        status: 'success',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceInfo: deviceInfo || null,
        isInternalIp: ipAddress ? isInternalIP(ipAddress) : false,
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
      await QueryLog.create({
        userId: userId,
        taskId: task.id,
        executedSql: executedSql || sql,
        parameters: inputParams,
        status: 'failed',
        errorMessage: error.message,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceInfo: deviceInfo || null,
        isInternalIp: ipAddress ? isInternalIP(ipAddress) : false,
      })

      logger.error({ taskId: task.id, userId, error: error.message }, 'Query execution failed')

      throw error
    }
  }

  public applyAdvancedConfig(results: any[], advancedConfig: any[]): any[] {
    const fieldMap = new Map<
      string,
      { alias?: string; enums?: Record<string, string>; masking?: any }
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
        'Applying Advanced Config'
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

  private maskValue(value: any, rule: { type: string; rule?: string; replace?: string }): any {
    if (value === null || value === undefined) return value
    const strVal = String(value)

    switch (rule.type) {
      case 'mobile':
        // Mask middle 4 digits: 13812345678 -> 138****5678
        return strVal.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
      case 'id_card':
        // Keep first 6, last 4: 110101199001011234 -> 110101********1234
        if (strVal.length >= 15) {
          return strVal.replace(/^(\d{6}).+(\w{4})$/, '$1********$2')
        }
        return strVal
      case 'email':
        // Mask characters before @: test@example.com -> t***@example.com
        return strVal.replace(/^(.{1}).*(@.*)$/, '$1***$2')
      case 'bank_card':
        // Mask all except last 4
        if (strVal.length > 4) {
          return '**** **** **** ' + strVal.slice(-4)
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
