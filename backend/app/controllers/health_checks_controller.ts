import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import os from 'node:os'
import { execSync } from 'node:child_process'

export default class HealthChecksController {
  async handle({ response }: HttpContext) {
    const health = new HealthChecks()

    health.register([
      // Database Check
      new DbCheck(db.connection()),

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

    return report.isHealthy ? response.ok(report) : response.serviceUnavailable(report)
  }
}
