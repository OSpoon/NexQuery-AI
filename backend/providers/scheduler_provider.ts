import type { ApplicationService } from '@adonisjs/core/types'
import SchedulerService from '#services/scheduler_service'
import QueryExecutionService from '#services/query_execution_service'

export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(SchedulerService, async (resolver) => {
      const queryExecutionService = await resolver.make(QueryExecutionService)
      return new SchedulerService(queryExecutionService)
    })
  }

  async ready() {
    if (this.app.getEnvironment() === 'web') {
      const scheduler = await this.app.container.make(SchedulerService)
      await scheduler.init()
    }
  }
}
