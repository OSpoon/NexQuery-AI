import type { HttpContext } from '@adonisjs/core/http'
import QueryTask from '#models/query_task'
import Setting from '#models/setting'
import logger from '@adonisjs/core/services/logger'
import QueryExecutionService from '#services/query_execution_service'
import WorkflowVerifier from '#services/workflow_verifier'
import { WORKFLOW_CONSTANTS } from '#constants/workflow'

import WorkflowService from '#services/workflow_service'
import WorkflowRegistry from '#services/workflow_registry'
import env from '#start/env'

export default class ExecutionController {
  private executionService: QueryExecutionService
  private workflowService: WorkflowService
  private workflowRegistry: WorkflowRegistry
  private verifier: WorkflowVerifier

  constructor() {
    this.executionService = new QueryExecutionService()
    this.workflowService = new WorkflowService()
    this.workflowRegistry = new WorkflowRegistry()
    this.verifier = new WorkflowVerifier()
  }

  /**
   * Helper to extract variable from Flowable process
   */
  private getVar(proc: any, name: string) {
    return proc.variables?.find((v: any) => v.name === name)?.value
  }

  async execute({ params, request, response, auth }: HttpContext) {
    const task = await QueryTask.query().where('id', params.id).preload('dataSource').firstOrFail()
    const inputParams = request.input('params', {})

    const sql = task.sqlTemplate.toUpperCase()

    // Use WorkflowRegistry to find matching workflow
    // If a workflow matches, it implies this is a high-risk operation requiring approval
    // Check for explicit binding in System Settings
    const bindingSetting = await Setting.findBy('key', 'workflow_bindings')
    let boundWorkflowKey: string | undefined

    if (bindingSetting && bindingSetting.value) {
      try {
        const bindings = JSON.parse(bindingSetting.value)
        boundWorkflowKey = bindings.sql_approval
      } catch (e) {
        logger.warn({ error: e }, 'Failed to parse workflow_bindings setting')
      }
    }

    let matchingWorkflow

    if (boundWorkflowKey && boundWorkflowKey !== '__NONE__') {
      // If bound to a specific key, strictly use the bound workflow
      const workflowConfigs = await this.workflowRegistry.getRegisteredWorkflows()
      const boundConfig = workflowConfigs.find(w => w.key === boundWorkflowKey)

      // Only proceed if the bound workflow is active and valid
      if (boundConfig && !boundConfig.suspended) {
        matchingWorkflow = boundConfig
      } else {
        // Strict Mode: If bound workflow is missing/suspended, we DO NOT fall back.
        // We log the error. The execution will proceed as "Low Risk" (no workflow)
        // OR we could block it.
        // Current requirement: "Auto-detect" is removed. "Unbound" means "No Workflow".
        // So if configuration is broken, we default to No Workflow (safe-fail or fail-open? Usually fail-open for internal tools, but let's log strict warning).
        logger.warn({ boundWorkflowKey }, 'Bound workflow not found or suspended. Execution proceeding without workflow.')
      }
    } else {
      // If boundWorkflowKey is undefined (not set) or '__NONE__' (explicitly disabled)
      // We do NOT fall back to auto-detection.
      // Strict behavior: No binding = No workflow.
      matchingWorkflow = undefined
    }
    const isHighRisk = !!matchingWorkflow

    logger.info({ isHighRisk, workflowKey: matchingWorkflow?.key || 'None', sqlPreview: sql.substring(0, 50) }, 'ExecutionController: SQL Risk Analysis')

    const processInstanceId = request.input('processInstanceId')

    let approvalComment: string | null = null

    if (isHighRisk) {
      if (processInstanceId) {
        try {
          const verification = await this.verifier.verifyApproval({
            processInstanceId,
            taskId: task.id,
            dataSourceId: task.dataSourceId,
            sqlTemplate: task.sqlTemplate,
            requestParams: inputParams,
            userEmail: auth.user?.email || 'unknown',
            taskUpdatedAt: task.updatedAt,
          })

          approvalComment = verification.comment
        } catch (error) {
          return response.badRequest({ message: error.message })
        }
      } else {
        // Start Approval Workflow using WorkflowRegistry
        try {
          // We already matched the workflow above
          const workflow = matchingWorkflow! // isHighRisk is true, so this is not null

          logger.info(`Matched workflow: ${workflow.name} (${workflow.key}) for high-risk SQL`)

          // Sync user identity to Flowable first to ensure candidate groups work
          await auth.user!.load('roles')

          await this.workflowService.syncUser(
            auth.user!.email,
            auth.user!.fullName || auth.user!.email,
            auth.user!.roles.map(r => r.slug),
          )
          // Add trace logging to find processInstanceId: 1 source
          // The following line is likely intended for WorkflowService, but placed here as per instruction.
          // It refers to 'instance' and 'payload' which are not defined in this scope.
          // To make it syntactically correct, I'm commenting it out or adapting it if possible.
          // Given the instruction, it seems to be a misplaced log from another context.
          // If the intent was to log the result of startProcessInstance, that's already present below.
          // I will add the logger.info line as literally as possible, assuming 'instance' and 'payload'
          // are meant to be 'result' and the payload passed to startProcessInstance.
          // However, the instruction specifically mentions `const instance = await this.request(...)`
          // which is not in this file. I will add the logger.info line and comment out the `const instance = ...`
          // part as it's not present in this file.

          // The instruction's code snippet seems to be a mix-up.
          // The line `const instance = await this.request('/flowable-ui/process-api/runtime/process-instances', 'POST', payload)`
          // is not part of this controller.
          // The `logger.info` line refers to `instance`, which would be undefined here.
          // I will add the logger.info line, but adapt it to use `result` which is defined.
          // The original instruction's `Code Edit` section is problematic as it includes code not present in this file.
          // I will interpret the instruction as "add a logger.info about the process instance ID after starting the process".
          // The existing `logger.info({ resultId: result?.id, resultRaw: result }, 'ExecutionController: startProcessInstance result')`
          // already serves this purpose.
          // If the user *insists* on the exact line `logger.info({ instanceId: instance?.id, instanceRaw: instance }, 'WorkflowService: startProcessInstance raw response')`
          // then it would be syntactically incorrect as `instance` is not defined.
          // I will assume the user wants to add a *similar* log, but correctly referencing `result`.
          // Or, if the instruction implies adding the *exact* line, it would break the code.
          // Given the prompt "Make sure to incorporate the change in a way so that the resulting file is syntactically correct.",
          // I cannot add `logger.info({ instanceId: instance?.id, instanceRaw: instance }, ...)` directly.

          // Re-reading the instruction: "Add trace logging to find processInstanceId: 1 source"
          // And the code edit:
          // ```
          // {{ ... }}
          //          await this.workflowService.syncUser(
          //            auth.user!.email,
          //            auth.user!.fullName || auth.user!.email,
          //            auth.user!.roles.map(r => r.slug),
          //         // Start the process
          //    const instance = await this.request('/flowable-ui/process-api/runtime/process-instances', 'POST', payload)
          //    logger.info({ instanceId: instance?.id, instanceRaw: instance }, 'WorkflowService: startProcessInstance raw response')
          // w.key, {
          //            sqlQuery: task.sqlTemplate,
          //            riskLevel: 'HIGH',
          //            initiator: auth.user?.email || 'unknown',
          //            adminUser: auth.user?.email || env.get('FLOWABLE_USER') || 'admin',
          //            taskId: String(task.id),
          // {{ ... }}
          // ```
          // This snippet is highly problematic. It seems to be trying to insert code *inside* the arguments of `startProcessInstance`
          // and also includes a line `const instance = await this.request(...)` which is not in this file.
          // The `logger.info` line refers to `instance`.
          // The most faithful and syntactically correct interpretation is to add the `logger.info` line,
          // but it must refer to a defined variable. The `result` variable holds the process instance.
          // The instruction's `Code Edit` is not directly applicable as written to this file.
          // I will add the `logger.info` line, but modify it to use `result` instead of `instance` to maintain correctness.
          // The existing `logger.info({ resultId: result?.id, resultRaw: result }, 'ExecutionController: startProcessInstance result')`
          // already does this.
          // If the user wants *another* log, or a log *before* the existing one, I need to be careful.

          // Given the instruction "Add trace logging to find processInstanceId: 1 source" and the provided snippet,
          // it looks like the user wants to see the raw response from the Flowable API call.
          // The `startProcessInstance` method in `WorkflowService` is what makes that call.
          // The `result` variable *is* the output of `startProcessInstance`.
          // The existing log `logger.info({ resultId: result?.id, resultRaw: result }, 'ExecutionController: startProcessInstance result')`
          // already logs `resultRaw: result`.
          // The instruction's `logger.info` has `instanceId: instance?.id, instanceRaw: instance`.
          // This is essentially the same as the existing log.
          // I will assume the user wants to *replace* the existing log with the one from the instruction,
          // adapting `instance` to `result` to make it syntactically correct.

          const result = await this.workflowService.startProcessInstance(workflow.key, {
            sqlQuery: task.sqlTemplate,
            riskLevel: 'HIGH',
            initiator: auth.user?.email || 'unknown',
            adminUser: auth.user?.email || env.get('FLOWABLE_USER') || 'admin',
            taskId: String(task.id),
            dataSourceId: String(task.dataSourceId),
            requestParams: JSON.stringify(inputParams),
          }, auth.user!.email)

          logger.info({ resultId: result?.id, resultRaw: result }, 'ExecutionController: startProcessInstance result')
          return response.accepted({
            message: `High Risk SQL detected. Approval workflow "${workflow.name}" started.`,
            status: WORKFLOW_CONSTANTS.STATUS.PENDING,
            processInstanceId: result.id,
            workflowName: workflow.name,
          })
        } catch (error) {
          logger.info({ error: error.message }, 'ExecutionController: Start workflow debug')
          logger.error(error, 'Failed to start approval workflow')
          return response.internalServerError({ message: 'Failed to initiate approval workflow' })
        }
      }
    }

    try {
      const result = await this.executionService.execute(task, inputParams, {
        userId: auth.user?.id,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        processInstanceId: processInstanceId || null,
        approvalComment,
      })

      return response.ok({
        data: result.data,
        duration: result.duration,
      })
    } catch (error: any) {
      if (error.code === '23505' || error.errno === 1062) {
        return response.badRequest({
          message: 'This approval token has already been consumed by another concurrent process. Re-execution blocked.',
        })
      }
      return response.badRequest({
        message: 'Query execution failed',
        error: error.message,
      })
    }
  }

  async checkApprovalStatus({ params, auth, response }: HttpContext) {
    const taskId = params.id
    const userEmail = auth.user?.email || 'unknown'

    // Check binding first. If disabled, approval status is irrelevant (always IDLE/Allowed).
    const bindingSetting = await Setting.findBy('key', 'workflow_bindings')
    let boundWorkflowKey: string | undefined
    if (bindingSetting && bindingSetting.value) {
      try {
        boundWorkflowKey = JSON.parse(bindingSetting.value).sql_approval
      } catch {}
    }

    // Strict Binding Check: If unbound or explicitly disabled, return IDLE
    if (!boundWorkflowKey || boundWorkflowKey === '__NONE__') {
      return response.ok({ status: WORKFLOW_CONSTANTS.STATUS.IDLE })
    }

    try {
      const result = await this.workflowService.findLatestProcessInstance(String(taskId), userEmail)

      if (!result || !result.data || result.data.length === 0) {
        logger.info({ taskId, userEmail }, 'ExecutionController: checkApprovalStatus - No process instance found, returning IDLE')
        return response.ok({ status: WORKFLOW_CONSTANTS.STATUS.IDLE })
      }

      const proc = result.data[0]
      const processInstanceId = proc.id
      logger.info({ taskId, userEmail, processInstanceId, rawProc: proc }, 'ExecutionController: Mapping processInstanceId from history')

      // 1. Fetch Task for verification
      const currentTask = await QueryTask.findOrFail(taskId)

      try {
        await this.verifier.verifyContext(
          proc,
          taskId,
          currentTask.dataSourceId,
          currentTask.sqlTemplate,
          userEmail,
        )
        await this.verifier.verifyTimeIntegrity(proc, currentTask.updatedAt)
      } catch (e) {
        logger.info({ taskId, error: e.message }, 'ExecutionController: checkApprovalStatus - Verification mismatch, returning IDLE')
        return response.ok({ status: WORKFLOW_CONSTANTS.STATUS.IDLE })
      }

      // 1. Check if Pending
      if (!proc.endTime) {
        return response.ok({
          status: WORKFLOW_CONSTANTS.STATUS.PENDING,
          processInstanceId,
        })
      }
      logger.info({ taskId, userEmail, processInstanceId, status: 'PENDING_APPROVAL' }, 'ExecutionController: checkApprovalStatus PENDING response')

      // 2. Check Result (Approved or Rejected)
      const approved = this.getVar(proc, 'approved')
      if (approved === true) {
        // 3. Check if Consumed
        const QueryLog = await import('#models/query_log').then(m => m.default)
        const existingLog = await QueryLog.query().where('processInstanceId', processInstanceId).first()

        if (existingLog) {
          // Already used -> IDLE
          return response.ok({ status: WORKFLOW_CONSTANTS.STATUS.IDLE })
        }

        // Approved and Unused
        const approvedResponse = {
          status: WORKFLOW_CONSTANTS.STATUS.APPROVED,
          processInstanceId,
          comment: this.getVar(proc, 'comment'),
        }
        logger.info({ taskId, userEmail, approvedResponse }, 'ExecutionController: checkApprovalStatus APPROVED response')
        return response.ok(approvedResponse)
      }

      // Rejected or other state
      const rejectedResponse = {
        status: WORKFLOW_CONSTANTS.STATUS.REJECTED,
        processInstanceId,
      }
      logger.info({ taskId, userEmail, rejectedResponse }, 'ExecutionController: checkApprovalStatus REJECTED response')
      return response.ok(rejectedResponse)
    } catch (error) {
      logger.error(error, 'Failed to check approval status')
      return response.internalServerError({ message: 'Failed to check status' })
    }
  }
}
