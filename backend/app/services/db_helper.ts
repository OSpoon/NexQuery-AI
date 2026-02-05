import DataSource from '#models/data_source'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'

import mysql from 'mysql2/promise'
import pg from 'pg'

export default class DbHelper {
  private static registeredAt = new Map<string, number>()

  /**
   * Ensures a database connection exists for the given data source ID.
   * Returns the connection name.
   */
  static async getDataSourceConnection(
    dataSourceId: number,
  ): Promise<{ connectionName: string, dbType: string }> {
    const ds = await DataSource.findOrFail(dataSourceId)
    const connectionName = `ds_${ds.id}`

    // Reuse existing connection if configured AND not stale
    if (db.manager.has(connectionName)) {
      const lastReg = this.registeredAt.get(connectionName) || 0
      if (ds.updatedAt.toMillis() <= lastReg) {
        return { connectionName, dbType: ds.type }
      }
      logger.info(`[DbHelper] Refreshing connection for ${ds.name} due to config update`)
      await db.manager.close(connectionName)
    }

    const host = ds.host
    const decryptedPassword = encryption.decrypt(ds.password)

    logger.info(`[DbHelper] Adding new connection for ${ds.name} (${ds.type})`)

    db.manager.add(connectionName, {
      client: ds.type === 'postgresql' ? 'pg' : 'mysql2',
      connection: {
        host,
        port: ds.port,
        user: ds.username,
        password: (decryptedPassword || '') as string,
        database: ds.database,
        // Safety: Query Timeout (Circuit Breaker) - 15 seconds
        ...(ds.type === 'postgresql' ? { statement_timeout: 15000 } : {}),
        // MySQL settings
        ...(ds.type === 'mysql'
          ? {
              enableKeepAlive: true,
              dateStrings: true,
              connectTimeout: 10000,
              // mysql2 'timeout' is for idle connection usually, generic query timeout on driver level is tricky without wrapper.
              // We rely on backend-level cancellation or 'max_execution_time' if session set.
              // But setting connectTimeout is good start.
            }
          : {}),
      },
      pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30000,
        afterCreate: (conn: any, done: any) => {
          if (ds.type === 'mysql') {
            // Enforce execution timeout via Session Variable (15000ms)
            // Note: max_execution_time is for read-only SELECTs in newer MySQL.
            conn.query('SET NAMES utf8mb4; SET SESSION max_execution_time=15000;', (err: any) =>
              done(err, conn))
          } else {
            done(null, conn)
          }
        },
      },
    })

    this.registeredAt.set(connectionName, Date.now())

    return { connectionName, dbType: ds.type }
  }

  /**
   * Get raw query connection (Lucid wrapper)
   */
  static async getConnection(dataSourceId: number) {
    const { connectionName, dbType } = await this.getDataSourceConnection(dataSourceId)
    return {
      client: db.connection(connectionName),
      dbType,
    }
  }

  /**
   * Get raw driver connection (mysql2 connection or pg client)
   * This is used when Lucid's rawQuery is not sufficient or we need specific driver features.
   */
  static async getRawConnection(
    dataSourceId: number,
    timeout: number = 30000,
  ): Promise<{ client: any, dbType: string }> {
    const ds = await DataSource.findOrFail(dataSourceId)
    const decryptedPassword = encryption.decrypt(ds.password)

    if (ds.type === 'mysql') {
      const connection = await mysql.createConnection({
        host: ds.host,
        port: ds.port,
        user: ds.username,
        password: (decryptedPassword || '') as string,
        database: ds.database,
        connectTimeout: timeout,
      })
      return { client: connection, dbType: 'mysql' }
    } else if (ds.type === 'postgresql') {
      const client = new pg.Client({
        host: ds.host,
        port: ds.port,
        user: ds.username,
        password: (decryptedPassword || '') as string,
        database: ds.database,
        connectionTimeoutMillis: timeout,
      })
      await client.connect()
      return { client, dbType: 'postgresql' }
    }

    throw new Error(`Raw connection not supported for type: ${ds.type}`)
  }

  /**
   * Get initialized Elasticsearch service
   */
  static async getESService(dataSourceId: number) {
    const ds = await DataSource.findOrFail(dataSourceId)
    const decryptedPassword = encryption.decrypt(ds.password)
    const { default: ESClient } = await import('#services/elasticsearch_service')

    return new ESClient({
      node: ds.host.startsWith('http') ? ds.host : `http://${ds.host}:${ds.port}`,
      auth: {
        username: ds.username,
        password: (decryptedPassword || '') as string,
      },
    })
  }

  /**
   * Universal connection validator
   */
  static async testConnection(config: any): Promise<{ success: boolean, message: string }> {
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
}
