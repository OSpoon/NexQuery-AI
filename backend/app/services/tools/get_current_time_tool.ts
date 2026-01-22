import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { DateTime } from 'luxon'

export class GetCurrentTimeTool extends StructuredTool {
  name = 'get_current_time'
  description =
    'Get the current server time. Use this when the user mentions "today", "yesterday", "last month", "current year", etc.'

  schema = z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        'The timezone to format the time in, e.g. "Asia/Shanghai". Defaults to system time.'
      ),
  })

  async _call({ timezone }: z.infer<typeof this.schema>) {
    const dt = timezone ? DateTime.now().setZone(timezone) : DateTime.now()
    return JSON.stringify({
      iso: dt.toISO(),
      human: dt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      weekday: dt.weekdayLong,
    })
  }
}
