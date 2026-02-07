import type { HttpContext } from '@adonisjs/core/http'
import DataSource from '#models/data_source'
import { createDataSourceValidator, updateDataSourceValidator } from '#validators/data_source'
import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'
import DbHelper from '#services/db_helper'

import PiiDiscoveryService from '#services/pii_discovery_service'
import NotificationService from '#services/notification_service'
import { AuditService } from '#services/audit_service'
import { SchemaService } from '#services/schema_service'

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
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createDataSourceValidator)

    // Encrypt password
    const encryptedPassword = encryption.encrypt(payload.password)

    // Validate connection before saving
    const { success } = await DbHelper.testConnection({
      ...payload,
    })

    const dataSource = await DataSource.create({
      ...payload,
      username: payload.username ?? '',
      database: payload.database ?? '',
      password: encryptedPassword,
      isActive: success,
    })

    await AuditService.logAdminAction({ request, auth } as any, 'create_data_source', {
      entityType: 'data_source',
      entityId: String(dataSource.id),
      details: { name: dataSource.name, type: dataSource.type },
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
  async update({ params, request, response, auth }: HttpContext) {
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
    const { success } = await DbHelper.testConnection(config)

    dataSource.isActive = success

    await dataSource.save()

    await AuditService.logAdminAction({ request, auth } as any, 'update_data_source', {
      entityType: 'data_source',
      entityId: String(dataSource.id),
      details: { name: dataSource.name, type: dataSource.type, updatedFields: Object.keys(payload) },
    })

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
      const { success } = await DbHelper.testConnection(config)

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

    const result = await DbHelper.testConnection(config)

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

      if (auth.user) {
        NotificationService.push(
          auth.user.id,
          '结构同步成功',
          `数据源 ID: ${dataSourceId} 的 Schema 信息已成功同步至向量数据库。`,
          'success',
        )
      }

      // Trigger PII Discovery in background
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
      const schemaService = new SchemaService()
      const schema = await schemaService.getPhysicalSchema(dataSourceId)
      return response.ok(schema)
    } catch (error: any) {
      logger.error({ error: error.message, dataSourceId }, 'Failed to fetch schema')
      return response.internalServerError({ message: `Failed to fetch schema: ${error.message}` })
    }
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

      const schemaService = new SchemaService()
      const schema = await schemaService.getPhysicalSchema(dataSourceId)

      const discoveryService = new PiiDiscoveryService()
      const piiConfig = await discoveryService.discover(schema)

      if (piiConfig.length > 0) {
        await discoveryService.mergeDiscoveryResults(ds, piiConfig)
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
