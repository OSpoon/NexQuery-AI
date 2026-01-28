import WorkflowService from '#services/workflow_service'
import logger from '@adonisjs/core/services/logger'

async function test() {
  const service = new WorkflowService()

  // Test with admin email and admin role
  const userId = 'admin@nexquery.ai'
  const groupIds = ['admin']

  logger.info({ userId, groupIds }, 'Testing getTasks')

  try {
    const tasks = await service.getTasks(userId, groupIds)
    logger.info({ tasks }, 'Final Result')
    logger.info({ total: tasks.total }, 'Found tasks')
  } catch (error) {
    logger.error({ error: error.message }, 'Test Failed')
  }
}

test()
