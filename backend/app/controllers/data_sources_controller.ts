import type { HttpContext } from '@adonisjs/core/http'
import DataSource from '#models/data_source'
import { createDataSourceValidator, updateDataSourceValidator } from '#validators/data_source'
import encryption from '@adonisjs/core/services/encryption'
import mysql from 'mysql2/promise'
import pg from 'pg'
import logger from '@adonisjs/core/services/logger'
import DbHelper from '#services/db_helper'

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
  async syncSchema({ params, response }: HttpContext) {
    const dataSourceId = params.id
    try {
      const { default: SchemaSyncService } = await import('#services/schema_sync_service')
      const service = new SchemaSyncService()

      // Run in background properly (fire and forget vs await?)
      // For now, await it so user knows it finished. For huge DBs, this should be a job.
      // But for < 500 tables, it takes maybe 10-30s.
      await service.syncDataSource(Number(dataSourceId))

      return response.ok({ message: 'Schema sync completed successfully' })
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
      const ds = await DataSource.findOrFail(dataSourceId)
      if (ds.type === 'api') {
        return response.ok([])
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

      const schema = Array.from(tableMap.entries()).map(([name, columns]) => ({
        name,
        columns,
      }))

      return response.ok(schema)
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'Failed to fetch schema')
      return response.internalServerError({ message: `Failed to fetch schema: ${error.message}` })
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
    }

    return { success: false, message: 'Unsupported driver or missing type' }
  }
}
