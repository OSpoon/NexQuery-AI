import type { HttpContext } from '@adonisjs/core/http'
import WorkflowService from '#services/workflow_service'
import WorkflowRegistry from '#services/workflow_registry'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import { readFile } from 'node:fs/promises'
import Setting from '#models/setting'

export default class WorkflowController {
  private workflowService: WorkflowService
  private workflowRegistry: WorkflowRegistry

  constructor() {
    this.workflowService = new WorkflowService()
    this.workflowRegistry = new WorkflowRegistry()
  }

  /**
   * Get workflow registry with configuration metadata
   */
  async registry({ response }: HttpContext) {
    try {
      const workflows = await this.workflowRegistry.getRegisteredWorkflows()
      return response.ok({ data: workflows })
    } catch (error) {
      logger.error(error, 'Failed to fetch workflow registry')
      return response.badRequest({ message: 'Failed to fetch workflow registry', error: error.message })
    }
  }

  /**
   * List available process definitions
   */
  async index({ response }: HttpContext) {
    try {
      const result = await this.workflowService.getProcessDefinitions()
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch process definitions', error: error.message })
    }
  }

  /**
   * Start a new process instance
   */
  async store({ request, response, auth }: HttpContext) {
    const { key, variables } = request.only(['key', 'variables'])
    const user = auth.user!

    if (!key) {
      return response.badRequest({ message: 'Process definition key is required' })
    }

    // Inject default variables
    const processVariables = {
      ...variables,
      // For the demo process 'risk_sql_approval', it expects 'adminUser'
      adminUser: variables?.adminUser || user.email,
      // Inject initiator for auditing
      initiator: user.email,
    }

    try {
      logger.info({ key, processVariables }, 'Starting Process Instance')

      const result = await this.workflowService.startProcessInstance(key, processVariables, user.email)
      return response.created(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to start process', error: error.message })
    }
  }

  /**
   * Get pending tasks for the current user
   */
  async getTasks({ auth, response }: HttpContext) {
    const user = auth.user!

    try {
      // Fetch tasks using standard Flowable Identity Links
      // The user's roles are synced to candidateGroups
      await user.load('roles')
      const roleSlugs = user.roles.map(r => r.slug)

      const result = await this.workflowService.getTasks(user.email, roleSlugs)
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch tasks', error: error.message })
    }
  }

  /**
   * Complete a task
   */
  async completeTask({ request, response, params, auth }: HttpContext) {
    const taskId = params.id
    const { variables } = request.only(['variables'])

    // Extract variables from the object sent by the frontend
    const approved = variables?.approved
    const comment = variables?.comment || 'No comment'

    // Inject metadata into the variables object for audit trail

    // Simplified: Delegate all logic to the service layer for an elegant, atomic-like operation
    try {
      await this.workflowService.completeTask(taskId, {
        approved,
        comment,
        operatorEmail: auth.user!.email,
        additionalVariables: variables, // pass through any other form data
      })

      return response.ok({
        message: approved === false ? 'Request rejected and process terminated' : 'Task completed successfully',
      })
    } catch (error: any) {
      logger.error({ taskId, error: error.message }, 'Failed to complete task')
      return response.badRequest({ message: 'Failed to complete task', error: error.message })
    }
  }

  /**
   * Get workflow history for the current user
   */
  async getHistory({ auth, response }: HttpContext) {
    const user = auth.user!

    try {
      const result = await this.workflowService.getHistory(user.email)
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch workflow history', error: error.message })
    }
  }

  /**
   * Get specific process instance details (for polling status)
   */
  async showProcessInstance({ params, response }: HttpContext) {
    const instanceId = params.id
    try {
      // 1. Fetch the historic process instance (base info)
      const instance = await this.workflowService.getHistoricProcessInstance(instanceId)
      if (!instance) {
        logger.warn({ instanceId }, 'WorkflowController: Historic process instance not found')
        return response.notFound({ message: 'Process instance not found' })
      }

      // 1.5 Fetch Process Definition to extract task sequence
      let taskSequence: any[] = []
      if (instance.processDefinitionId) {
        try {
          const xml = await this.workflowService.getProcessDefinitionXML(instance.processDefinitionId)
          taskSequence = await this.extractTaskSequence(xml)
        } catch (e: any) {
          logger.warn({ definitionId: instance.processDefinitionId, error: e.message }, 'Failed to extract task sequence from XML')
        }
      }

      // 2. Fetch active tasks (may fail if process already ended)
      let activeTasks: any = { data: [] }
      try {
        activeTasks = await this.workflowService.getTasksByProcessInstanceId(instanceId)
      } catch (e: any) {
        logger.info({ instanceId, error: e.message }, 'WorkflowController: No active tasks found (expected if ended)')
      }

      // 3. Fetch historic tasks
      let historicTasks: any = { data: [] }
      try {
        historicTasks = await this.workflowService.getHistoricTasksByProcessInstanceId(instanceId)
      } catch (e: any) {
        logger.error({ instanceId, error: e.message }, 'WorkflowController: Failed to fetch historic tasks')
      }

      // 4. Fetch all comments
      let comments: any = []
      try {
        comments = await this.workflowService.getProcessInstanceComments(instanceId)
      } catch (e: any) {
        logger.error({ instanceId, error: e.message }, 'WorkflowController: Failed to fetch process comments')
      }

      logger.info({
        instanceId,
        activeCount: activeTasks?.data?.length || 0,
        historicCount: historicTasks?.data?.length || 0,
        commentCount: comments?.length || 0,
      }, 'WorkflowController: showProcessInstance summary')

      return response.ok({
        detail: instance,
        activeTasks: activeTasks.data || [],
        historicTasks: historicTasks.data || [],
        comments,
        taskSequence,
      })
    } catch (error: any) {
      logger.error({ instanceId, error: error.message, stack: error.stack }, 'WorkflowController: Global error in showProcessInstance')
      return response.badRequest({ message: 'Failed to fetch process instance details', error: error.message })
    }
  }

  /**
   * Get specific process definition
   */
  async showDefinition({ params, response }: HttpContext) {
    try {
      const result = await this.workflowService.getProcessDefinitionById(params.id)
      if (!result) {
        return response.notFound({ message: 'Process definition not found' })
      }
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch process definition', error: error.message })
    }
  }

  /**
   * Update process state (suspend/activate)
   */
  async updateState({ params, request, response }: HttpContext) {
    const { action } = request.only(['action'])
    if (!['suspend', 'activate'].includes(action)) {
      return response.badRequest({ message: 'Invalid action. Must be suspend or activate' })
    }

    // Check binding safety
    const bindingSetting = await Setting.findBy('key', 'workflow_bindings')
    if (bindingSetting && bindingSetting.value && action === 'suspend') {
      try {
        const bindings = JSON.parse(bindingSetting.value)
        const boundKeys = Object.values(bindings)

        // We need the key of the process definition
        const def = await this.workflowService.getProcessDefinitionById(params.id)
        if (def && boundKeys.includes(def.key)) {
          return response.badRequest({ message: `Cannot suspend this workflow because it is currently bound to a system process.` })
        }
      } catch (e) {
        logger.warn('Failed to parse workflow_bindings during updateState check')
      }
    }

    try {
      await this.workflowService.updateProcessState(params.id, action)
      return response.ok({ message: `Process definition ${action}d successfully` })
    } catch (error) {
      return response.badRequest({ message: 'Failed to update process state', error: error.message })
    }
  }

  /**
   * Delete specific deployment
   */
  async destroyDeployment({ params, response }: HttpContext) {
    // Check binding safety
    const bindingSetting = await Setting.findBy('key', 'workflow_bindings')
    if (bindingSetting && bindingSetting.value) {
      try {
        const bindings = JSON.parse(bindingSetting.value)
        const boundKeys = Object.values(bindings) as string[]

        // Get active workflows to match deploymentId
        const registered = await this.workflowRegistry.getRegisteredWorkflows()
        const boundDeployments = registered
          .filter(w => boundKeys.includes(w.key))
          .map(w => w.deploymentId)

        if (boundDeployments.includes(params.id)) {
          return response.badRequest({ message: `Cannot delete this deployment because it contains a workflow currently bound to a system process.` })
        }
      } catch (e) {
        logger.warn('Failed to parse workflow_bindings during destroyDeployment check')
      }
    }

    try {
      await this.workflowService.deleteDeployment(params.id)
      return response.ok({ message: 'Workflow deployment deleted successfully' })
    } catch (error) {
      return response.badRequest({ message: 'Failed to delete workflow deployment', error: error.message })
    }
  }

  /**
   * Get definition XML
   */
  async getXML({ params, response }: HttpContext) {
    try {
      const xml = await this.workflowService.getProcessDefinitionXML(params.id)
      return response.header('Content-Type', 'text/xml').send(xml)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch XML', error: error.message })
    }
  }

  /**
   * Get definition Image
   */
  async getImage({ params, response }: HttpContext) {
    try {
      const res = await this.workflowService.getProcessDefinitionImage(params.id)
      const imageBuffer = await res.arrayBuffer()
      const { Buffer } = await import('node:buffer')
      return response.header('Content-Type', 'image/png').send(Buffer.from(imageBuffer))
    } catch (error) {
      // Return a placeholder or 404
      return response.notFound({ message: 'Image not available' })
    }
  }

  /**
   * Deploy a new workflow from XML
   */
  async deploy({ request, response }: HttpContext) {
    try {
      const { name, xml } = request.all()
      if (!name || !xml) {
        return response.badRequest({ message: 'Name and XML are required' })
      }

      const result = await this.workflowService.deployProcessDefinition(name, xml)
      return response.ok(result)
    } catch (error) {
      return response.internalServerError({ message: 'Deployment failed', error: error.message })
    }
  }

  /**
   * Seed demo workflows
   */
  async seed({ response }: HttpContext) {
    try {
      const filePath = app.makePath('resources/bpmn/risk_sql_approval.bpmn')
      const xmlContent = await readFile(filePath, 'utf-8')

      await this.workflowService.deployProcessDefinition('risk_sql_approval', xmlContent)

      return response.ok({ message: 'Workflow seeded successfully' })
    } catch (error) {
      return response.internalServerError({ message: 'Failed to seed workflow', error: error.message })
    }
  }

  /**
   * 从 BPMN XML 提取任务序列(使用 fast-xml-parser)
   */
  private async extractTaskSequence(xml: string): Promise<Array<{ name: string }>> {
    try {
      // 动态导入 XMLParser
      const { XMLParser } = await import('fast-xml-parser')

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      })

      const result = parser.parse(xml)
      const process = result.definitions?.process
      if (!process)
        return []

      // 提取所有 userTask 节点
      const userTasks = process.userTask || []
      const taskArray = Array.isArray(userTasks) ? userTasks : [userTasks]

      return taskArray
        .filter((task: any) => task['@_name'])
        .map((task: any) => ({ name: task['@_name'] }))
    } catch (error) {
      logger.error({ error }, 'Failed to extract task sequence from BPMN XML')
      return []
    }
  }
}
