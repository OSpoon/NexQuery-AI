import WorkflowService from '#services/workflow_service'
import { DateTime } from 'luxon'
import { WORKFLOW_CONSTANTS } from '#constants/workflow'

export default class WorkflowVerifier {
  private workflowService: WorkflowService

  constructor() {
    this.workflowService = new WorkflowService()
  }

  /**
   * Helper to extract variable from Flowable process
   */
  private getVar(proc: any, name: string) {
    return proc.variables?.find((v: any) => v.name === name)?.value
  }

  /**
   * Verify that a specific operation allows execution based on a workflow approval token.
   * Throws an error if verification fails.
   */
  async verifyApproval(options: {
    processInstanceId: string
    taskId: string | number
    dataSourceId: string | number
    sqlTemplate: string
    requestParams: Record<string, any>
    userEmail: string
    taskUpdatedAt: DateTime
  }): Promise<{ approved: boolean, comment: string | null }> {
    const { processInstanceId, taskId, dataSourceId, sqlTemplate, requestParams, userEmail, taskUpdatedAt } = options

    // 1. Fetch Process Instance
    const proc = await this.workflowService.getHistoricProcessInstance(processInstanceId)
    if (!proc) {
      throw new Error('Invalid approval token')
    }
    if (!proc.endTime) {
      throw new Error('Approval process is still running')
    }

    const approved = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.APPROVED)
    if (approved !== true) {
      throw new Error('Request was rejected by administrator')
    }

    await this.verifyContext(proc, taskId, dataSourceId, sqlTemplate, userEmail)

    await this.verifyTimeIntegrity(proc, taskUpdatedAt)

    // 3. Strict Mode: Verify Parameters match the approved ones
    const approvedParams = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.REQUEST_PARAMS)
    if (approvedParams) {
      const currentParams = JSON.stringify(requestParams)
      if (approvedParams !== currentParams) {
        throw new Error('Parameters have changed since approval. Please request approval again.')
      }
    }

    // 4. Token Replay Attack Check
    const QueryLog = await import('#models/query_log').then(m => m.default)
    const existingLog = await QueryLog.query().where('processInstanceId', processInstanceId).first()
    if (existingLog) {
      throw new Error('This approval token has already been used. Please request a new approval.')
    }

    return {
      approved: true,
      comment: this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.COMMENT) || null,
    }
  }

  /**
   * Verify that the process context matches the current task definition
   */
  async verifyContext(proc: any, taskId: string | number, dataSourceId: string | number, sqlTemplate: string, userEmail: string) {
    const approvedTaskId = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.TASK_ID)
    const approvedInitiator = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.INITIATOR)
    const approvedSql = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.SQL_QUERY)
    const approvedDsId = this.getVar(proc, WORKFLOW_CONSTANTS.VARIABLES.DATA_SOURCE_ID)

    if (approvedTaskId && approvedTaskId !== String(taskId)) {
      throw new Error('Token belongs to a different task')
    }
    if (approvedInitiator && approvedInitiator !== userEmail) {
      throw new Error('Token belongs to a different requestor')
    }
    if (approvedSql && approvedSql !== sqlTemplate) {
      throw new Error('The SQL template has been modified since approval. Please request re-approval.')
    }
    if (approvedDsId && approvedDsId !== String(dataSourceId)) {
      throw new Error('The target DataSource has changed since approval. Please request a new approval.')
    }
  }

  /**
   * Verify time integrity (Task modification after process start)
   */
  async verifyTimeIntegrity(proc: any, taskUpdatedAt: DateTime) {
    if (proc.startTime) {
      const procStartTime = DateTime.fromISO(proc.startTime)
      // Allow buffer for potential clock skew/processing time
      if (taskUpdatedAt.toMillis() > procStartTime.toMillis() + WORKFLOW_CONSTANTS.CONFIG.TIME_INTEGRITY_BUFFER_MS) {
        throw new Error('The task definition was modified after the approval request was initiated. Please request a new approval.')
      }
    }
  }
}
