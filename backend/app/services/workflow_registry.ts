import WorkflowService from './workflow_service.js'
import logger from '@adonisjs/core/services/logger'

interface WorkflowConfig {
  workflowType?: string
  triggerKeywords?: string[]
  priority?: string
  description?: string
}

interface RegisteredWorkflow {
  id: string
  key: string
  name: string
  version: number
  deploymentId: string
  config: WorkflowConfig
}

export default class WorkflowRegistry {
  private workflowService: WorkflowService

  constructor() {
    this.workflowService = new WorkflowService()
  }

  /**
   * 获取所有已注册的工作流及其配置
   */
  async getRegisteredWorkflows(): Promise<RegisteredWorkflow[]> {
    const definitions = await this.workflowService.getProcessDefinitions()
    const list = definitions.data || []
    logger.info(`[WorkflowRegistry] Found ${list.length} process definitions`)

    const workflows: RegisteredWorkflow[] = []

    for (const def of list) {
      try {
        const config = await this.extractWorkflowConfig(def.id)
        workflows.push({
          id: def.id,
          key: def.key,
          name: def.name,
          version: def.version,
          deploymentId: def.deploymentId,
          config,
        })
      } catch (error) {
        console.error(`Failed to extract config for workflow ${def.key}:`, error)
        // 如果提取失败，使用空配置
        workflows.push({
          id: def.id,
          key: def.key,
          name: def.name,
          version: def.version,
          deploymentId: def.deploymentId,
          config: {},
        })
      }
    }

    return workflows
  }

  /**
   * 根据类型查找工作流
   */
  async findWorkflowByType(type: string): Promise<RegisteredWorkflow | null> {
    const workflows = await this.getRegisteredWorkflows()

    // 按优先级排序：high > medium > low
    const priorityOrder = { high: 3, medium: 2, low: 1 }

    const matchingWorkflows = workflows
      .filter(w => w.config.workflowType === type)
      .sort((a, b) => {
        const aPriority = priorityOrder[a.config.priority as keyof typeof priorityOrder] || 0
        const bPriority = priorityOrder[b.config.priority as keyof typeof priorityOrder] || 0
        return bPriority - aPriority
      })

    return matchingWorkflows[0] || null
  }

  /**
   * 从 BPMN XML 提取配置(使用 fast-xml-parser)
   */
  private async extractWorkflowConfig(definitionId: string): Promise<WorkflowConfig> {
    const xmlContent = await this.workflowService.getProcessDefinitionXML(definitionId)
    const config: WorkflowConfig = {}

    try {
      // 导入 XMLParser
      const { XMLParser } = await import('fast-xml-parser')

      // 配置 XML 解析器
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        allowBooleanAttributes: true,
        parseAttributeValue: false, // 保持属性值为字符串
      })

      const result = parser.parse(xmlContent)

      // 提取 process 节点下的 extensionElements
      const process = result.definitions?.process
      if (!process) {
        logger.warn({ definitionId }, '[WorkflowRegistry] No process found in BPMN XML')
        return config
      }

      const extensionElements = process.extensionElements
      if (!extensionElements) {
        logger.info({ definitionId }, '[WorkflowRegistry] No extensionElements found')
        return config
      }

      // 提取 property 标签(支持 flowable:property 或 activiti:property)
      const properties
        = extensionElements['flowable:property'] || extensionElements['activiti:property'] || []

      // 确保 properties 是数组(单个元素时 XMLParser 返回对象)
      const propArray = Array.isArray(properties) ? properties : [properties]

      // 提取配置
      propArray.forEach((prop: any) => {
        const name = prop['@_name']
        const value = prop['@_value']

        if (!name || !value)
          return

        logger.info(`[WorkflowRegistry] Extracted: ${name}=${value}`)

        switch (name) {
          case 'workflowType':
            config.workflowType = value
            break
          case 'triggerKeywords':
            config.triggerKeywords = value.split(',').map((k: string) => k.trim())
            break
          case 'priority':
            config.priority = value
            break
          case 'description':
            config.description = value
            break
        }
      })

      logger.info({ definitionId, config }, '[WorkflowRegistry] Final extracted config')
    } catch (error: any) {
      logger.error(
        { definitionId, error: error.message },
        '[WorkflowRegistry] Failed to parse BPMN XML',
      )
    }

    return config
  }

  /**
   * 检查 SQL 是否匹配工作流的触发条件
   */
  async matchSQLToWorkflow(sql: string): Promise<RegisteredWorkflow | null> {
    const workflows = await this.getRegisteredWorkflows()

    // 过滤出 SQL 审批类型的工作流
    const sqlWorkflows = workflows.filter(w => w.config.workflowType === 'sql_approval')

    for (const workflow of sqlWorkflows) {
      if (workflow.config.triggerKeywords) {
        const keywords = workflow.config.triggerKeywords
        const upperSQL = sql.toUpperCase()

        // 检查 SQL 是否包含任何触发关键词
        const hasKeyword = keywords.some((keyword) => {
          const pattern = new RegExp(`\\b${keyword.toUpperCase()}\\b`)
          return pattern.test(upperSQL)
        })

        if (hasKeyword) {
          return workflow
        }
      }
    }

    return null
  }
}
