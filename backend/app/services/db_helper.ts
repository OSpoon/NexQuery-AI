import DataSource from '#models/data_source'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'

import mysql from 'mysql2/promise'
import pg from 'pg'
import sqlite3 from 'sqlite3'

export default class DbHelper {
  private static registeredAt = new Map<string, number>()
  private static evaluationSqlitePath: string | null = null

  /**
   * [EVALUATION ONLY] Set the SQLite path for evaluation
   */
  static setEvaluationPath(path: string) {
    this.evaluationSqlitePath = path
  }

  /**
   * Ensures a database connection exists for the given data source ID.
   * Returns the connection name.
   */
  static async getDataSourceConnection(
    dataSourceId: number,
  ): Promise<{ connectionName: string, dbType: string }> {
    if (dataSourceId === 9999 && this.evaluationSqlitePath) {
      const connName = 'eval_sqlite'
      if (!db.manager.has(connName)) {
        db.manager.add(connName, {
          client: 'sqlite3',
          connection: { filename: this.evaluationSqlitePath },
          useNullAsDefault: true,
        })
      }
      return { connectionName: connName, dbType: 'sqlite' }
    }

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

    const decryptedPassword = (encryption.decrypt(ds.password) || '') as string

    logger.info(`[DbHelper] Adding new connection for ${ds.name} (${ds.type})`)

    /**
     * Build Configuration based on type to stay type-safe
     */
    let config: any = {}

    if (ds.type === 'postgresql') {
      config = {
        client: 'pg',
        connection: {
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: decryptedPassword,
          database: ds.database,
          statement_timeout: 15000,
        },
      }
    } else if (ds.type === 'mysql') {
      config = {
        client: 'mysql2',
        connection: {
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: decryptedPassword,
          database: ds.database,
          enableKeepAlive: true,
          dateStrings: true,
          connectTimeout: 10000,
        },
        pool: {
          afterCreate: (conn: any, done: any) => {
            conn.query('SET NAMES utf8mb4; SET SESSION max_execution_time=15000;', (err: any) =>
              done(err, conn))
          },
        },
      }
    } else if (ds.type === 'sqlite') {
      /**
       * [EVALUATION ONLY]
       */
      config = {
        client: 'sqlite3',
        connection: {
          filename: ds.database,
        },
        useNullAsDefault: true,
      }
    }

    if (config.client) {
      db.manager.add(connectionName, {
        ...config,
        pool: {
          min: 0,
          max: 10,
          idleTimeoutMillis: 30000,
          ...config.pool,
        },
      })
    }

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
   * Get raw driver connection
   */
  static async getRawConnection(
    dataSourceId: number,
    timeout: number = 30000,
  ): Promise<{ client: any, dbType: string }> {
    if (dataSourceId === 9999 && this.evaluationSqlitePath) {
      const dbInstance = new sqlite3.Database(this.evaluationSqlitePath)
      return { client: dbInstance, dbType: 'sqlite' }
    }

    const ds = await DataSource.findOrFail(dataSourceId)
    const decryptedPassword = (encryption.decrypt(ds.password) || '') as string

    if (ds.type === 'mysql') {
      const connection = await mysql.createConnection({
        host: ds.host,
        port: ds.port,
        user: ds.username,
        password: decryptedPassword,
        database: ds.database,
        connectTimeout: timeout,
      })
      return { client: connection, dbType: 'mysql' }
    } else if (ds.type === 'postgresql') {
      const client = new pg.Client({
        host: ds.host,
        port: ds.port,
        user: ds.username,
        password: decryptedPassword,
        database: ds.database,
        connectionTimeoutMillis: timeout,
      })
      await client.connect()
      return { client, dbType: 'postgresql' }
    } else if (ds.type === 'sqlite') {
      /**
       * [EVALUATION ONLY]
       */
      const dbInstance = new sqlite3.Database(ds.database)
      return { client: dbInstance, dbType: 'sqlite' }
    }

    throw new Error(`Raw connection not supported for type: ${ds.type}`)
  }

  /**
   * [EVALUATION ONLY] Get raw sqlite connection from a direct file path
   */
  static async getRawConnectionFromPath(filePath: string): Promise<{ client: any, dbType: string }> {
    const dbInstance = new sqlite3.Database(filePath)
    return { client: dbInstance, dbType: 'sqlite' }
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
    // Basic validation: SQLite doesn't need host/username, APIs don't need username
    if (config.type !== 'sqlite' && config.type !== 'api' && !config.host) {
      return { success: false, message: 'Missing host' }
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
    } else if (config.type === 'sqlite') {
      /**
       * [EVALUATION ONLY]
       */
      return new Promise((resolve) => {
        const dbInstance = new sqlite3.Database(config.database, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            resolve({ success: false, message: `SQLite connection failed: ${err.message}` })
          } else {
            dbInstance.close()
            resolve({ success: true, message: 'SQLite connection successful' })
          }
        })
      })
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
