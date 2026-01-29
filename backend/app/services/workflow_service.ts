import { Buffer } from 'node:buffer'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

import { WORKFLOW_CONSTANTS } from '#constants/workflow'

export default class WorkflowService {
  private baseUrl: string
  private authHeader: string

  constructor() {
    this.baseUrl = env.get('FLOWABLE_HOST') || WORKFLOW_CONSTANTS.API.DEFAULTS.HOST
    const user = env.get('FLOWABLE_USER') || WORKFLOW_CONSTANTS.API.DEFAULTS.USER
    const password = env.get('FLOWABLE_PASSWORD') || WORKFLOW_CONSTANTS.API.DEFAULTS.PASSWORD
    // Basic Auth
    this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
  }

  private async requestRaw(endpoint: string, method: string = 'GET') {
    const url = `${this.baseUrl}${endpoint}`
    logger.info({ url, method }, 'WorkflowService Raw Request')
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader,
        },
      })
      if (!response.ok) {
        const errText = await response.text().catch(() => 'No error body')
        throw new Error(`Raw request failed: ${response.status} - ${errText}`)
      }

      const text = await response.clone().text().catch(() => '')
      logger.info({ url, snippet: text.substring(0, 100) }, 'WorkflowService Raw Response Success')

      return response
    } catch (error) {
      logger.error({ error: error.message, endpoint }, 'WorkflowService Raw Request Failed')
      throw error
    }
  }

  /**
   * Helper for fetch requests
   */
  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`
    if (body) {
      logger.info({ url, method, body }, 'Flowable Outgoing Request')
    }

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ url, status: response.status, error: errorText }, 'Flowable API Error')
        throw new Error(`Flowable API Failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Some endpoints might return 204 No Content
      if (response.status === 204)
        return null

      const text = await response.text()
      return text ? JSON.parse(text) : null
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack, endpoint }, 'WorkflowService Request Failed')
      throw error
    }
  }

  async getProcessDefinitions() {
    // /flowable-ui/process-api/repository/process-definitions?latest=true
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_DEFINITIONS}?latest=true&sort=name`)
  }

  /**
   * Get specific process definition details
   */
  async getProcessDefinition(processDefinitionKey: string) {
    const result = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_DEFINITIONS}?key=${processDefinitionKey}&latest=true`)
    return result?.data?.[0] || null
  }

  /**
   * Get process definition by ID (includes version)
   */
  async getProcessDefinitionById(processDefinitionId: string) {
    const encodedId = encodeURIComponent(processDefinitionId)
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_DEFINITIONS}/${encodedId}`)
  }

  /**
   * Get BPMN XML for a definition
   */
  async getProcessDefinitionXML(processDefinitionId: string) {
    // This returns the XML content
    const encodedId = encodeURIComponent(processDefinitionId)
    const response = await this.requestRaw(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_DEFINITIONS}/${encodedId}/resourcedata`)
    return response.text()
  }

  /**
   * Get process diagram image (Base64 or URL)
   */
  async getProcessDefinitionImage(processDefinitionId: string) {
    // This returns image/png
    const encodedId = encodeURIComponent(processDefinitionId)
    return this.requestRaw(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_DEFINITIONS}/${encodedId}/image`)
  }

  /**
   * Get running process instances by process definition ID
   */
  async getProcessInstancesByDefinitionId(processDefinitionId: string) {
    const result = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.QUERY_PROCESS_INSTANCES}`, 'POST', {
      processDefinitionId,
    })
    return result
  }

  /**
   * Delete a deployment (and its definitions)
   */
  async deleteDeployment(deploymentId: string) {
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.DEPLOYMENTS}/${deploymentId}?cascade=true`, 'DELETE')
  }

  /**
   * Start a Process Instance
   */
  async startProcessInstance(processDefinitionKey: string, variables?: Record<string, any>, initiatorUserId?: string) {
    // /flowable-ui/process-api/runtime/process-instances
    const payload = {
      processDefinitionKey,
      variables: variables ? Object.entries(variables).map(([name, value]) => ({ name, value })) : [],
      returnVariables: true,
    }

    // Start the process
    const instance = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_INSTANCES}`, 'POST', payload)
    logger.info({ processInstanceId: instance?.id, raw: instance }, 'WorkflowService: startProcessInstance result')

    // If initiator provided, add as a participant (Standard Identity Link)
    if (instance && instance.id && initiatorUserId) {
      logger.info({ processInstanceId: instance.id, initiatorUserId }, 'WorkflowService: Linking initiator')
      try {
        const linkResult = await this.addIdentityLink(instance.id, initiatorUserId, 'participant')
        logger.info({ processInstanceId: instance.id, linkResult }, 'WorkflowService: Identity Link created')
      } catch (error) {
        logger.error({ processInstanceId: instance.id, initiatorUserId, error: error.message }, 'Failed to add initiator identity link')
        // Proceed anyway, non-blocking for process start
      }
    }

    return instance
  }

  /**
   * Delete a process instance (e.g. on rejection)
   */
  async deleteProcessInstance(processInstanceId: string, reason: string = 'Rejected') {
    // /flowable-ui/process-api/runtime/process-instances/{processInstanceId}
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_INSTANCES}/${processInstanceId}?deleteReason=${encodeURIComponent(reason)}`, 'DELETE')
  }

  /**
   * Add Identity Link (Participant/Candidate)
   */
  async addIdentityLink(processInstanceId: string, userId: string, type: string) {
    // /flowable-ui/process-api/runtime/process-instances/{processInstanceId}/identitylinks
    const payload = {
      user: userId, // Flowable expects 'user' for process instance links
      type, // e.g. 'participant', 'candidate'
    }
    logger.info({ processInstanceId, payload }, 'WorkflowService: Outgoing Identity Link Request')
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.PROCESS_INSTANCES}/${processInstanceId}/identitylinks`, 'POST', payload)
  }

  /**
   * Get Tasks for a User (Assignee or Candidate)
   */
  async getTasks(userId: string, groupIds: string[] = []) {
    // Use the Query API to perform an OR search: (assigned to me) OR (one of my candidate groups)
    const payload: any = {
      includeProcessVariables: true,
      sort: 'createTime',
      order: 'desc',
    }

    if (userId && groupIds.length > 0) {
      payload.orQueries = [
        { assignee: userId },
        { candidateGroupIn: groupIds },
      ]
    } else if (userId) {
      payload.assignee = userId
    } else if (groupIds.length > 0) {
      payload.candidateGroupIn = groupIds
    }

    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.QUERY_TASKS}`, 'POST', payload)
  }

  async getTasksByProcessInstanceId(processInstanceId: string) {
    // /flowable-ui/process-api/runtime/tasks?processInstanceId=xxx
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.TASKS}?processInstanceId=${processInstanceId}`)
  }

  async getTask(taskId: string) {
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.TASKS}/${taskId}`)
  }

  /**
   * Update a Task (e.g. set assignee)
   */
  async updateTask(taskId: string, payload: { assignee?: string, owner?: string, name?: string, description?: string }) {
    return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.TASKS}/${taskId}`, 'PUT', payload)
  }

  /**
   * Get historic tasks for a process instance (for timeline visualization)
   */
  async getHistoricTasksByProcessInstanceId(processInstanceId: string) {
    return this.request(
      `${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.QUERY_HISTORIC_TASK_INSTANCES}`,
      'POST',
      {
        processInstanceId,
        includeTaskLocalVariables: true,
        includeProcessVariables: true, // Need this for initiator/approver identification
        sort: 'startTime',
        order: 'asc',
      },
    )
  }

  /**
   * Complete a Task with full context (Assignee, Variables, Outcome)
   */
  async completeTask(taskId: string, options: {
    approved: boolean
    comment?: string
    operatorEmail: string
    additionalVariables?: Record<string, any>
  }) {
    const { approved, comment, operatorEmail, additionalVariables } = options

    // 1. Fetch task to get processInstanceId
    const task = await this.getTask(taskId)
    const processInstanceId = task?.processInstanceId

    // 2. Assign task to the operator (Ensures native 'assignee' audit log)
    if (task && task.assignee !== operatorEmail) {
      await this.updateTask(taskId, { assignee: operatorEmail })
    }

    // 3. Prepare variables
    const variables: any[] = [
      { name: WORKFLOW_CONSTANTS.VARIABLES.APPROVED, value: approved },
      { name: WORKFLOW_CONSTANTS.VARIABLES.LAST_COMMENT, value: comment || 'No comment' },
      { name: WORKFLOW_CONSTANTS.VARIABLES.APPROVER, value: operatorEmail },
      // Set local outcome to prevent status leakage in multi-step flows
      { name: WORKFLOW_CONSTANTS.VARIABLES.TASK_OUTCOME, value: approved ? 'approved' : 'rejected', scope: 'local' },
      { name: WORKFLOW_CONSTANTS.VARIABLES.COMMENT, value: comment || 'No comment', scope: 'local' },
      { name: WORKFLOW_CONSTANTS.VARIABLES.APPROVER, value: operatorEmail, scope: 'local' },
    ]

    if (additionalVariables) {
      Object.entries(additionalVariables).forEach(([name, value]) => {
        variables.push({ name, value })
      })
    }

    // 4. Add native comment (Optional but good for native Flowable UI)
    if (comment && processInstanceId) {
      await this.addTaskComment(taskId, comment, processInstanceId).catch((err) => {
        logger.warn({ taskId, error: err.message }, 'Failed to add native comment')
      })
    }

    // 5. Submit completion
    const payload = { action: 'complete', variables }
    const result = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.TASKS}/${taskId}`, 'POST', payload)

    // 6. Process flow is now handled by BPMN gateways
    if (!approved) {
      logger.info({ processInstanceId, approved }, 'Task rejected, Flowable will route to rejection path')
    }

    return result
  }

  /**
   * Set local variables for a task
   */
  async setTaskLocalVariables(taskId: string, variables: Record<string, any>) {
    const payload = Object.entries(variables).map(([name, value]) => ({
      name,
      value,
      scope: 'local',
    }))
    return this.request(`/flowable-ui/process-api/runtime/tasks/${taskId}/variables`, 'POST', payload)
  }

  /**
   * Add a comment to a task
   */
  async addTaskComment(taskId: string, message: string, processInstanceId?: string) {
    const payload = {
      message,
      saveProcessInstanceId: !!processInstanceId,
    }
    return this.request(`/flowable-ui/process-api/runtime/tasks/${taskId}/comments`, 'POST', payload)
  }

  /**
   * Get comments for a task
   */
  async getTaskComments(taskId: string) {
    return this.request(`/flowable-ui/process-api/runtime/tasks/${taskId}/comments`)
  }

  /**
   * Get all comments for a process instance
   */
  async getProcessInstanceComments(processInstanceId: string) {
    const result = await this.request(`/flowable-ui/process-api/history/historic-process-instances/${processInstanceId}/comments`)
    logger.info({ processInstanceId, commentCount: result?.length || 0, raw: result }, 'WorkflowService: getProcessInstanceComments result')
    return result
  }

  /**
   * Get Historic Process Instances
   */
  async getHistory(userId: string) {
    // Use an OR query to match:
    // 1. Process started by this user (startedBy)
    // 2. OR User is involved (via identity links we added)
    const payload = {
      includeProcessVariables: true,
      sort: 'startTime',
      order: 'desc',
      orQueries: [
        { startedBy: userId },
        { involvedUser: userId },
      ],
    }
    logger.info({ payload }, 'WorkflowService: History Query Payload')
    const result = await this.request('/flowable-ui/process-api/query/historic-process-instances', 'POST', payload)
    logger.info({ userId, count: result?.data?.length || 0, first: result?.data?.[0]?.id }, 'Flowable History Query Result')
    return result
  }

  /**
   * Get specific Historic Process Instance with variables
   */
  async getHistoricProcessInstance(processInstanceId: string) {
    // Using POST query for better reliability and consistent variable inclusion
    const payload = {
      processInstanceId,
      includeProcessVariables: true,
    }
    const result = await this.request('/flowable-ui/process-api/query/historic-process-instances', 'POST', payload)
    if (result && result.data && result.data.length > 0) {
      return result.data[0]
    }
    // Fallback: try direct GET if query returns nothing (rare but possible during indexing)
    try {
      return await this.request(`/flowable-ui/process-api/history/historic-process-instances/${processInstanceId}`)
    } catch (e) {
      return null
    }
  }

  /**
   * Find latest process instance by Task ID and User
   */
  async findLatestProcessInstance(taskId: string, userId: string) {
    // Search history for processes involving this user with specific taskId variable
    // We use the variables filter instead of involvedUser to avoid identity mapping issues
    const variables = [
      { name: 'taskId', value: taskId, operation: 'equals', type: 'string' },
      { name: 'initiator', value: userId, operation: 'equals', type: 'string' },
    ]

    const payload = {
      variables,
      includeProcessVariables: true,
      sort: 'startTime',
      order: 'desc',
      size: 1,
    }

    logger.info({ payload }, 'Flowable: findLatestProcessInstance (Variable based)')

    const result = await this.request('/flowable-ui/process-api/query/historic-process-instances', 'POST', payload)

    logger.info({ found: result?.data?.length || 0, data: result?.data }, 'Flowable: findLatestProcessInstance Result')

    return result
  }

  /**
   * Get Validated User from Flowable (Check connectivity)
   */
  async checkConnection() {
    try {
      await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_USERS}`)
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Sync group (role) to Flowable
   */
  async syncGroup(groupId: string, name: string) {
    try {
      // Check if group exists
      const groups = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_GROUPS}?id=${groupId}`)
      if (groups && groups.data && groups.data.length > 0) {
        return groups.data[0]
      }

      // Create group
      const payload = {
        id: groupId,
        name,
        type: 'security-role',
      }
      return this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_GROUPS}`, 'POST', payload)
    } catch (error) {
      logger.warn({ groupId, error: error.message }, 'Failed to sync group to Flowable')
    }
  }

  /**
   * Sync user and their group memberships to Flowable
   */
  async syncUser(userId: string, fullName: string, roleSlugs: string[]) {
    try {
      // 1. Ensure user exists
      const users = await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_USERS}?id=${userId}`)
      if (!users || !users.data || users.data.length === 0) {
        const payload = {
          id: userId,
          firstName: fullName.split(' ')[0] || userId,
          lastName: fullName.split(' ').slice(1).join(' ') || 'User',
          email: userId,
          password: 'external-managed', // Passwords are managed by NexQuery
        }
        await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_USERS}`, 'POST', payload)
      }

      // 2. Clear and sync group memberships
      // Note: Flowable REST API usually requires individual membership management
      // For each role, add to group
      for (const role of roleSlugs) {
        try {
          // Ensure group exists first
          await this.syncGroup(role, role)

          const membershipPayload = { userId, groupId: role }
          await this.request(`${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.IDENTITY_GROUPS}/${role}/members`, 'POST', membershipPayload)
        } catch (e) {
          // Might already be a member
        }
      }
    } catch (error) {
      logger.warn({ userId, error: error.message }, 'Failed to sync user to Flowable')
    }
  }

  /**
   * Deploy a BPMN definition via XML string
   */
  async deployProcessDefinition(name: string, xmlContent: string) {
    // Flowable REST API for deployment requires multipart/form-data
    // This is tricky with simple fetch unless we construct the body manually
    // For this prototype, we'll try a simpler approach if Flowable supports it,
    // Or we assume the user uploads via Flowable UI for now to keep it simple,
    // BUT the user asked for a demo implementation.
    // Let's implement a simple multipart construction.

    // /flowable-ui/process-api/repository/deployments

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    const body
      = `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="file"; filename="${name}.bpmn20.xml"\r\n`
        + `Content-Type: text/xml\r\n\r\n`
        + `${xmlContent}\r\n`
        + `--${boundary}--`

    const url = `${this.baseUrl}${WORKFLOW_CONSTANTS.API.BASE_PATH}${WORKFLOW_CONSTANTS.API.ENDPOINTS.DEPLOYMENTS}`

    // Basic Auth
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }

    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        const txt = await response.text()
        logger.error({ status: response.status, error: txt }, 'Deployment Failed')
        throw new Error('Deployment failed')
      }
      return await response.json()
    } catch (e) {
      logger.error(e, 'Deployment Error')
      throw e
    }
  }
}
