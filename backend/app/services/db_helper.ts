import DataSource from '#models/data_source'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'

export default class DbHelper {
  private static registeredAt = new Map<string, number>()

  /**
   * Ensures a database connection exists for the given data source ID.
   * Returns the connection name.
   */
  static async getDataSourceConnection(
    dataSourceId: number
  ): Promise<{ connectionName: string; dbType: string }> {
    const ds = await DataSource.findOrFail(dataSourceId)
    const connectionName = `ds_${ds.id}`

    // Reuse existing connection if configured AND not stale
    if (db.manager.has(connectionName)) {
      const lastReg = this.registeredAt.get(connectionName) || 0
      if (ds.updatedAt.toMillis() <= lastReg) {
        return { connectionName, dbType: ds.type }
      }
      console.log(`[DbHelper] Refreshing connection for ${ds.name} due to config update`)
      await db.manager.close(connectionName)
    }

    const host = ds.host
    const decryptedPassword = encryption.decrypt(ds.password)

    console.log(`[DbHelper] Adding new connection for ${ds.name} (${ds.type})`)

    db.manager.add(connectionName, {
      client: ds.type === 'postgresql' ? 'pg' : 'mysql2',
      connection: {
        host: host,
        port: ds.port,
        user: ds.username,
        password: (decryptedPassword || '') as string,
        database: ds.database,
        // MySQL settings for stability
        ...(ds.type === 'mysql'
          ? {
              enableKeepAlive: true,
              dateStrings: true,
            }
          : {}),
      },
      pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30000,
        afterCreate: (conn: any, done: any) => {
          if (ds.type === 'mysql') {
            conn.query('SET NAMES utf8mb4', (err: any) => done(err, conn))
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
   * Get raw query connection
   */
  static async getConnection(dataSourceId: number) {
    const { connectionName, dbType } = await this.getDataSourceConnection(dataSourceId)
    return {
      client: db.connection(connectionName),
      dbType,
    }
  }
}
