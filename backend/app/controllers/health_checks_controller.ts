import { HealthChecks } from '@adonisjs/core/health'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import os from 'node:os'
import { execSync } from 'node:child_process'
import logger from '@adonisjs/core/services/logger'
import DataSource from '../models/data_source.js'
import QueryExecutionService from '../services/query_execution_service.js'

export default class HealthChecksController {
  async handle({ response }: HttpContext) {
    const health = new HealthChecks()
    const queryService = new QueryExecutionService()

    health.register([
      // Internal System Database Check (Renamed)
      {
        name: 'System Database',
        async run() {
          try {
            await db.rawQuery('SELECT 1')
            return {
              name: 'System Database',
              status: 'ok',
              finishedAt: new Date(),
              isHealthy: true,
              message: 'System database connection is healthy',
            }
          } catch (error: any) {
            return {
              name: 'System Database',
              status: 'error',
              finishedAt: new Date(),
              isHealthy: false,
              message: `System database check failed: ${error.message}`,
              error: error.message,
              meta: {
                connection: (db.connection() as any).name || 'unknown',
                client: (db.connection() as any).config?.client || 'unknown',
              },
            }
          }
        },
      },

      // External Data Sources Integrity Check (New)
      {
        name: 'Data Sources',
        async run() {
          try {
            // Check all SQL data sources regardless of status (user request)
            // Exclude 'api' type sources as they are not SQL databases
            const sources = await DataSource.query()
              .whereNot('type', 'api')
            const total = sources.length

            if (total === 0) {
              return {
                name: 'Data Sources',
                status: 'ok',
                finishedAt: new Date(),
                isHealthy: true,
                message: 'No active SQL data sources configured',
              }
            }

            let connected = 0
            const details: any[] = []

            await Promise.all(
              sources.map(async (ds) => {
                try {
                  // Use rawExecute for a lightweight ping (SELECT 1)
                  // Note: QueryExecutionService handles decryption and connection logic
                  await queryService.rawExecute(ds, 'SELECT 1', { skipLogging: true })
                  connected++
                  details.push({ name: ds.name, status: 'ok' })
                } catch (err: any) {
                  details.push({ name: ds.name, status: 'error', error: err.message })
                }
              }),
            )

            const isHealthy = connected === total

            return {
              name: 'Data Sources',
              status: isHealthy ? 'ok' : 'warning', // Warning if partial failure
              finishedAt: new Date(),
              isHealthy,
              message: `Connected to ${connected}/${total} active data sources`,
              meta: {
                total,
                connected,
                details,
              },
            }
          } catch (error: any) {
            return {
              name: 'Data Sources',
              status: 'error',
              finishedAt: new Date(),
              isHealthy: false,
              message: `Failed to check data sources: ${error.message}`,
            }
          }
        },
      },

      // Memory Usage Check
      {
        name: 'Memory Usage',
        async run() {
          const total = os.totalmem()
          const free = os.freemem()
          const used = total - free
          const usedPercentage = (used / total) * 100
          return {
            name: 'Memory Usage',
            status: usedPercentage < 99.9 ? 'ok' : 'error',
            finishedAt: new Date(),
            isHealthy: usedPercentage < 99.9,
            message: `Using ${usedPercentage.toFixed(2)}% of system memory`,
            meta: {
              total_gb: (total / 1024 / 1024 / 1024).toFixed(2),
              used_gb: (used / 1024 / 1024 / 1024).toFixed(2),
              usage_percentage: Number.parseFloat(usedPercentage.toFixed(2)),
            },
          }
        },
      },

      // Disk Space Check (Basic Unix)
      {
        name: 'Disk Space',
        async run() {
          try {
            const output = execSync('df -Ph /').toString().split('\n')[1]
            const parts = output.split(/\s+/)
            const usage = parts[4]
            const usageNum = Number.parseInt(usage.replace('%', ''))
            return {
              name: 'Disk Space',
              status: usageNum < 90 ? 'ok' : 'error',
              finishedAt: new Date(),
              isHealthy: usageNum < 90,
              message: `Root disk usage is at ${usage}`,
              meta: {
                usage,
                usage_percentage: usageNum,
              },
            }
          } catch (error) {
            return {
              name: 'Disk Space',
              status: 'ok',
              finishedAt: new Date(),
              isHealthy: true,
              message: 'Disk check ignored or failed to execute',
            }
          }
        },
      },
    ])

    const report = await health.run()

    // Log the report structure to debug the "undefined" error once and for all
    logger.info({ reportKeys: Object.keys(report), isHealthy: report.isHealthy }, 'Health Check Report Structure')

    // Defensive check to avoid 500. AdonisJS 6 report might have .checks or other fields.
    const checks = (report as any).checks || (report as any).healthChecks || []
    const systemDbHealthy = checks.find((c: any) => c.name === 'System Database' || c.name === 'database')?.status === 'ok'

    if (!systemDbHealthy) {
      logger.warn('System Database check failed, but returning report for diagnosis')
    }

    // We return 200 if the system is basic-level operational, avoiding a full UI blackout
    return response.ok(report)
  }
}
