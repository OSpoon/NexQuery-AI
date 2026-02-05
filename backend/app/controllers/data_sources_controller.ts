import type { HttpContext } from '@adonisjs/core/http'
import DataSource from '#models/data_source'
import { createDataSourceValidator, updateDataSourceValidator } from '#validators/data_source'
import encryption from '@adonisjs/core/services/encryption'
import mysql from 'mysql2/promise'
import pg from 'pg'
import logger from '@adonisjs/core/services/logger'
import DbHelper from '#services/db_helper'
import PiiDiscoveryService from '#services/pii_discovery_service'
import NotificationService from '#services/notification_service'

export default class DataSourcesController {
  /**
   * Display a list of resource
   */
  async index({ response }: HttpContext) {
    const dataSources = await DataSource.all()
    return response.ok(dataSources)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createDataSourceValidator)

    // Encrypt password
    const encryptedPassword = encryption.encrypt(payload.password)

    // Validate connection before saving
    const { success } = await this.validateConnection({
      ...payload,
    })

    const dataSource = await DataSource.create({
      ...payload,
      username: payload.username ?? '',
      database: payload.database ?? '',
      password: encryptedPassword,
      isActive: success,
    })

    // Auto-sync schema in background if connection is successful
    if (success) {
      this.syncSchemaInBackground(dataSource.id)
    }

    return response.created(dataSource)
  }

  /**
   * Show individual record
   */
  async show({ params, response }: HttpContext) {
    const dataSource = await DataSource.findOrFail(params.id)
    return response.ok(dataSource)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response }: HttpContext) {
    const dataSource = await DataSource.findOrFail(params.id)
    const payload = await request.validateUsing(updateDataSourceValidator)

    // Capture plain text password for validation if provided
    const plainPassword = payload.password

    if (payload.password) {
      payload.password = encryption.encrypt(payload.password)
    }

    dataSource.merge({
      ...payload,
      username: payload.username ?? dataSource.username ?? '',
      database: payload.database ?? dataSource.database ?? '',
    })

    // Validate connection before saving, using the plain text password we captured
    const config = {
      type: dataSource.type,
      host: dataSource.host,
      port: dataSource.port,
      username: dataSource.username,
      password: plainPassword || encryption.decrypt(dataSource.password),
      database: dataSource.database,
    }
    const { success } = await this.validateConnection(config)
    dataSource.isActive = success

    await dataSource.save()

    // Auto-sync schema in background if connection is successful
    if (success) {
      this.syncSchemaInBackground(dataSource.id)
    }

    return response.ok(dataSource)
  }

  /**
   * Refresh all data source statuses
   */
  async refresh({ response }: HttpContext) {
    const dataSources = await DataSource.all()
    const results = []

    for (const ds of dataSources) {
      const config = {
        type: ds.type,
        host: ds.host,
        port: ds.port,
        username: ds.username,
        password: encryption.decrypt(ds.password),
        database: ds.database,
      }
      const { success } = await this.validateConnection(config)
      ds.isActive = success
      await ds.save()
      results.push({ id: ds.id, name: ds.name, success })
    }

    logger.info({ count: dataSources.length }, 'Data sources refreshed')

    return response.ok({ message: 'Refresh complete', results })
  }

  /**
   * Delete record
   */
  async destroy({ params, response }: HttpContext) {
    const dataSource = await DataSource.findOrFail(params.id)
    await dataSource.delete()
    return response.noContent()
  }

  /**
   * Test connection
   */
  async testConnection({ request, response }: HttpContext) {
    const { id, ...payload } = request.all()
    const config = { ...payload }

    // Manual test now always requires a password from the payload, exception for API which might be public
    if (!config.password && config.type !== 'api') {
      return response.badRequest({ message: 'Password is required to test connection' })
    }

    const result = await this.validateConnection(config)

    return response.ok(result)
  }

  /**
   * Sync schema to vector store
   */
  async syncSchema({ params, response, auth }: HttpContext) {
    const dataSourceId = params.id
    try {
      const { default: SchemaSyncService } = await import('#services/schema_sync_service')
      const service = new SchemaSyncService()

      // 1. List all tables
      await service.syncDataSource(Number(dataSourceId))

      // Trigger PII Discovery in background to avoid hanging the UI
      this.runPiiDiscovery(Number(dataSourceId), auth.user?.id)

      return response.ok({ message: 'Schema sync started, PII discovery will run in the background' })
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'Failed to sync schema')
      return response.internalServerError({ message: `Failed to sync schema: ${error.message}` })
    }
  }

  /**
   * Get schema information (tables and columns)
   */
  async getSchema({ params, response }: HttpContext) {
    const dataSourceId = params.id
    try {
      const schema = await this.getPhysicalSchema(dataSourceId)
      return response.ok(schema)
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'Failed to fetch schema')
      return response.internalServerError({ message: `Failed to fetch schema: ${error.message}` })
    }
  }

  private async getPhysicalSchema(dataSourceId: number) {
    const ds = await DataSource.findOrFail(dataSourceId)
    if (ds.type === 'api') {
      return []
    }

    if (ds.type === 'elasticsearch') {
      try {
        const password = ds.password ? encryption.decrypt<string>(ds.password) : undefined
        const { default: ESClient } = await import('#services/elasticsearch_service')
        const esService = new ESClient({
          node: ds.host.startsWith('http') ? ds.host : `http://${ds.host}:${ds.port}`,
          auth: {
            username: ds.username,
            password: password ?? undefined,
          },
        })

        const mapping = await esService.getMapping(ds.database || '*')
        const fields: any[] = []

        const extractFields = (props: any, prefix = '') => {
          if (!props)
            return
          for (const [key, value] of Object.entries(props)) {
            const fieldName = prefix ? `${prefix}.${key}` : key
            const val = value as any
            const fieldType = val.type || (val.properties ? 'object' : 'unknown')

            fields.push({
              name: fieldName,
              type: fieldType,
              comment: fieldType,
            })

            if (val.properties) {
              extractFields(val.properties, fieldName)
            }
          }
        }

        // ES mapping response is keyed by index name
        for (const indexData of Object.values(mapping as any)) {
          const info = indexData as any
          if (info.mappings && info.mappings.properties) {
            extractFields(info.mappings.properties)
          }
        }

        // Deduplicate fields across indices
        const uniqueFields = Array.from(new Map(fields.map(f => [f.name, f])).values())

        return [
          {
            name: ds.database || 'Default Index',
            columns: uniqueFields,
          },
        ]
      } catch (error) {
        logger.error({ err: error, dataSourceId }, '[Elasticsearch] Failed to fetch schema')
        return []
      }
    }

    const { client, dbType } = await DbHelper.getConnection(dataSourceId)

    let rows: any[] = []

    if (dbType === 'mysql') {
      const [result] = await client.rawQuery(`
        SELECT 
          TABLE_NAME as tableName, 
          COLUMN_NAME as columnName,
          DATA_TYPE as dataType,
          COLUMN_COMMENT as columnComment
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `)
      rows = result as any[]
    } else if (dbType === 'postgresql') {
      const result = await client.rawQuery(`
        SELECT 
          table_name as "tableName", 
          column_name as "columnName",
          data_type as "dataType",
          (
              SELECT description 
              FROM pg_description 
              WHERE objoid = (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass 
              AND objsubid = ordinal_position
          ) as "columnComment"
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `)
      rows = result.rows
    }

    const tableMap = new Map<string, Array<{ name: string, type: string, comment: string }>>()
    for (const row of rows) {
      const tableName = row.tableName
      const col = {
        name: row.columnName,
        type: row.dataType,
        comment: row.columnComment || '',
      }
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, [])
      }
      tableMap.get(tableName)?.push(col)
    }

    return Array.from(tableMap.entries()).map(([name, columns]) => ({
      name,
      columns,
    }))
  }

  /**
   * Helper to run schema sync in the background
   */
  private async syncSchemaInBackground(dataSourceId: number) {
    try {
      const { default: SchemaSyncService } = await import('#services/schema_sync_service')
      const service = new SchemaSyncService()
      await service.syncDataSource(dataSourceId)
      logger.info({ dataSourceId }, 'Auto-sync schema completed')

      // Trigger PII Discovery in background as well
      this.runPiiDiscovery(dataSourceId)
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'Auto-sync schema failed')
    }
  }

  private async validateConnection(config: any): Promise<{ success: boolean, message: string }> {
    if (!config.host || (!config.username && config.type !== 'api')) {
      return { success: false, message: 'Missing connection details' }
    }

    if (config.type === 'mysql') {
      try {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          connectTimeout: 5000,
        })
        await connection.end()
        return { success: true, message: 'Connection successful' }
      } catch (error: any) {
        return { success: false, message: `Connection failed: ${error.message}` }
      }
    } else if (config.type === 'postgresql') {
      const client = new pg.Client({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 5000,
      })
      try {
        await client.connect()
        await client.end()
        return { success: true, message: 'Connection successful' }
      } catch (error: any) {
        return { success: false, message: `Connection failed: ${error.message}` }
      }
    } else if (config.type === 'api') {
      // For API/CURL, we don't have a standard connection protocol effectively
      // We assume if host/base url is provided, it's valid.
      // We could try to curl the host, but for now let's just allow it.
      return { success: true, message: 'API connection configured (no validation performed)' }
    } else if (config.type === 'elasticsearch') {
      try {
        const { default: ESClient } = await import('#services/elasticsearch_service')
        const esService = new ESClient({
          node: config.host.startsWith('http') ? config.host : `http://${config.host}:${config.port}`,
          auth: {
            username: config.username,
            password: config.password,
          },
        })
        const isHealthy = await esService.testConnection()
        return isHealthy
          ? { success: true, message: 'Elasticsearch connection successful' }
          : { success: false, message: 'Elasticsearch ping failed' }
      } catch (error: any) {
        return { success: false, message: `Elasticsearch connection failed: ${error.message}` }
      }
    }

    return { success: false, message: 'Unsupported driver or missing type' }
  }

  /**
   * Run PII Discovery for a data source and update its advanced_config
   */
  private async runPiiDiscovery(dataSourceId: number, userId?: number) {
    try {
      if (userId) {
        NotificationService.push(userId, 'PII Discovery', 'Starting automated sensitive data scan...', 'info')
      }
      const ds = await DataSource.findOrFail(dataSourceId)
      if (ds.type === 'api') {
        return
      }

      const schema = await this.getPhysicalSchema(dataSourceId)

      const discoveryService = new PiiDiscoveryService()
      const piiConfig = await discoveryService.discover(schema)

      if (piiConfig.length > 0) {
        // ... (existing logic)
        // Merge with existing advanced_config
        const currentConfig = ds.config || {}
        const advancedConfig = (currentConfig.advanced_config || []).map((t: any) => ({
          table: t.table || t.tableName, // compatibility
          fields: t.fields || [],
        }))

        for (const tableRule of piiConfig) {
          let existingTable = advancedConfig.find((t: any) => t.table === tableRule.table)
          if (!existingTable) {
            existingTable = { table: tableRule.table, fields: [] }
            advancedConfig.push(existingTable)
          }

          // Merge fields
          for (const field of tableRule.fields) {
            const existingField = existingTable.fields.find((f: any) => f.name === field.name)
            if (existingField) {
              // Only update if no manual masking is set or if it's 'none'
              if (!existingField.masking || existingField.masking.type === 'none') {
                existingField.masking = field.masking
                existingField.isAuto = true
              }
            } else {
              existingTable.fields.push({ ...field, isAuto: true })
            }
          }
        }

        ds.config = {
          ...currentConfig,
          advanced_config: advancedConfig,
        }
        await ds.save()
        logger.info({ dataSourceId, tablesDiscovered: piiConfig.length }, 'PII discovery applied to advanced_config')

        if (userId) {
          NotificationService.push(userId, 'PII Discovery Success', `Successfully identified PII in ${piiConfig.length} tables for ${ds.name}`, 'success')
        }
      } else if (userId) {
        NotificationService.push(userId, 'PII Discovery Complete', `No new sensitive data identified for ${ds.name}`, 'info')
      }
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'PII discovery failed')
      if (userId) {
        NotificationService.push(userId, 'PII Discovery Failed', `Failed to scan ${dataSourceId}: ${error.message}`, 'error')
      }
    }
  }
}
