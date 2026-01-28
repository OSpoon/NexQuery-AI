<script setup lang="ts">
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { Download, Redo, Save, Undo, Upload, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

// Import bpmn-js styles
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import 'bpmn-js/dist/assets/bpmn-js.css'

const props = defineProps<{
  initialXml?: string
  initialName?: string
}>()

const emit = defineEmits<{
  (e: 'save', data: { xml: string, name: string }): void
}>()

const container = ref<HTMLElement | null>(null)
const modeler = shallowRef<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(true)
const workflowName = ref(props.initialName || 'Dynamic Workflow')
const selectedElement = shallowRef<any>(null)
const elementProperties = ref({
  id: '',
  name: '',
  type: '',
  candidateGroups: '', // User Task
  implementation: '', // Service Task / Send Task
  conditionExpression: '', // Sequence Flow from Gateway
  eventType: '', // Events
  timerDefinition: '', // Timer Events
})
const activeTab = ref('element')
const availableRoles = ref<{ id: number, name: string, slug: string }[]>([])
const selectedRoles = computed({
  get: () => {
    if (!elementProperties.value.candidateGroups)
      return []
    return elementProperties.value.candidateGroups.split(',').map(s => s.trim()).filter(Boolean)
  },
  set: (roles: string[]) => {
    elementProperties.value.candidateGroups = roles.join(',')
    updateNodeProperty('candidateGroups', roles.join(','))
  },
})

// Process-level configuration
const processConfig = ref({
  workflowType: 'sql_approval',
  triggerKeywords: [] as string[],
  priority: 'high',
  description: '',
})

const newKeyword = ref('')

// Basic XML template for a new workflow
const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://www.flowable.org/processdef">
  <process id="new_workflow" name="New Workflow" isExecutable="true">
    <startEvent id="startEvent" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_new_workflow">
    <bpmndi:BPMNPlane bpmnElement="new_workflow" id="BPMNPlane_new_workflow">
      <bpmndi:BPMNShape bpmnElement="startEvent" id="BPMNShape_startEvent">
        <omgdc:Bounds height="30.0" width="30.0" x="250.0" y="150.0" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

// Flowable BPMN Moddle Extension
// 定义 Flowable 命名空间的属性和元素
// Flowable BPMN Moddle Extension
// 定义 Flowable 命名空间的属性和元素
const flowableModdleDescriptor = {
  name: 'Flowable',
  uri: 'http://flowable.org/bpmn',
  prefix: 'flowable',
  xml: {
    tagAlias: 'lowerCase',
  },
  types: [
    {
      name: 'Properties',
      superClass: ['Element'],
      meta: {
        allowedIn: ['bpmn:ExtensionElements'],
      },
      properties: [
        {
          name: 'values',
          type: 'Property',
          isMany: true,
        },
      ],
    },
    {
      name: 'Property',
      superClass: ['Element'],
      meta: {
        allowedIn: ['bpmn:ExtensionElements'],
      },
      properties: [
        {
          name: 'name',
          isAttr: true,
          type: 'String',
        },
        {
          name: 'value',
          isAttr: true,
          type: 'String',
        },
      ],
    },
    {
      name: 'UserTask',
      extends: ['bpmn:UserTask'],
      properties: [
        {
          name: 'candidateGroups',
          isAttr: true,
          type: 'String',
        },
        {
          name: 'candidateUsers',
          isAttr: true,
          type: 'String',
        },
        {
          name: 'assignee',
          isAttr: true,
          type: 'String',
        },
      ],
    },
    {
      name: 'ServiceTask',
      extends: ['bpmn:ServiceTask'],
      properties: [
        {
          name: 'class',
          isAttr: true,
          type: 'String',
        },
        {
          name: 'delegateExpression',
          isAttr: true,
          type: 'String',
        },
      ],
    },
  ],
}

async function initModeler() {
  if (!container.value) {
    return
  }

  loading.value = true

  // Wait for next tick to ensure DOM is fully ready
  await new Promise(resolve => setTimeout(resolve, 0))

  try {
    // Custom palette provider to show only commonly used elements
    const customPaletteProvider = function (
      this: any,
      palette: any,
      create: any,
      elementFactory: any,
      spaceTool: any,
      lassoTool: any,
      handTool: any,
      globalConnect: any,
      translate: any,
    ) {
      this._create = create
      this._elementFactory = elementFactory
      this._spaceTool = spaceTool
      this._lassoTool = lassoTool
      this._handTool = handTool
      this._globalConnect = globalConnect
      this._translate = translate

      // Register with higher priority to override default
      palette.registerProvider(600, this)
    }

    customPaletteProvider.$inject = [
      'palette',
      'create',
      'elementFactory',
      'spaceTool',
      'lassoTool',
      'handTool',
      'globalConnect',
      'translate',
    ]

    customPaletteProvider.prototype.getPaletteEntries = function () {
      const actions: any = {}
      const create = this._create
      const elementFactory = this._elementFactory
      const translate = this._translate

      function createAction(type: string, group: string, className: string, title: string, options?: any) {
        function createListener(event: any) {
          const shape = elementFactory.createShape(Object.assign({ type }, options))
          create.start(event, shape)
        }

        return {
          group,
          className,
          title: translate(title),
          action: {
            dragstart: createListener,
            click: createListener,
          },
        }
      }

      // Hand tool (移动画布)
      actions['hand-tool'] = {
        group: 'tools',
        className: 'bpmn-icon-hand-tool',
        title: translate('移动画布'),
        action: {
          click: (event: any) => {
            this._handTool.activateHand(event)
          },
        },
      }

      // Lasso tool (框选)
      actions['lasso-tool'] = {
        group: 'tools',
        className: 'bpmn-icon-lasso-tool',
        title: translate('框选工具'),
        action: {
          click: (event: any) => {
            this._lassoTool.activateSelection(event)
          },
        },
      }

      // Space tool (调整空间)
      actions['space-tool'] = {
        group: 'tools',
        className: 'bpmn-icon-space-tool',
        title: translate('调整空间'),
        action: {
          click: (event: any) => {
            this._spaceTool.activateSelection(event)
          },
        },
      }

      // Global connect (连接工具)
      actions['global-connect-tool'] = {
        group: 'tools',
        className: 'bpmn-icon-connection-multi',
        title: translate('连接工具'),
        action: {
          click: (event: any) => {
            this._globalConnect.start(event)
          },
        },
      }

      // Separator
      actions['tool-separator'] = {
        group: 'tools',
        separator: true,
      }

      // Start Event (开始)
      actions['create.start-event'] = createAction(
        'bpmn:StartEvent',
        'event',
        'bpmn-icon-start-event-none',
        '开始事件',
      )

      // Intermediate Timer Event (定时器)
      actions['create.intermediate-event'] = createAction(
        'bpmn:IntermediateThrowEvent',
        'event',
        'bpmn-icon-intermediate-event-none',
        '中间事件',
      )

      // End Event (结束)
      actions['create.end-event'] = createAction(
        'bpmn:EndEvent',
        'event',
        'bpmn-icon-end-event-none',
        '结束事件',
      )

      // User Task (审批任务)
      actions['create.user-task'] = createAction(
        'bpmn:UserTask',
        'activity',
        'bpmn-icon-user-task',
        '审批任务',
      )

      // Service Task (自动任务)
      actions['create.service-task'] = createAction(
        'bpmn:ServiceTask',
        'activity',
        'bpmn-icon-service-task',
        '自动任务',
      )

      // Send Task (发送通知/邮件)
      actions['create.send-task'] = createAction(
        'bpmn:SendTask',
        'activity',
        'bpmn-icon-send-task',
        '发送任务',
      )

      // Exclusive Gateway (条件分支)
      actions['create.exclusive-gateway'] = createAction(
        'bpmn:ExclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-xor',
        '条件分支',
      )

      // Parallel Gateway (并行分支)
      actions['create.parallel-gateway'] = createAction(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        '并行分支',
      )

      return actions
    }

    // Create modeler instance with custom palette
    modeler.value = new BpmnModeler({
      container: container.value,
      keyboard: {
        bindTo: document,
      },
      additionalModules: [
        // Disable default palette
        {
          paletteProvider: ['value', null],
        },
        // Add custom palette
        {
          __init__: ['customPaletteProvider'],
          customPaletteProvider: ['type', customPaletteProvider],
        },
      ],
      moddleExtensions: {
        flowable: flowableModdleDescriptor,
      },
    })

    // Listen for element selection
    modeler.value.on('selection.changed', (e: any) => {
      const element = e.newSelection[0]
      selectedElement.value = element

      if (element) {
        const bo = element.businessObject
        elementProperties.value.id = element.id
        elementProperties.value.name = bo.name || ''
        elementProperties.value.type = bo.$type

        // Reset all type-specific properties
        elementProperties.value.candidateGroups = ''
        elementProperties.value.implementation = ''
        elementProperties.value.conditionExpression = ''
        elementProperties.value.eventType = ''
        elementProperties.value.timerDefinition = ''
        // selectedRoles is a computed property, so it will update automatically when candidateGroups changes
        // Do NOT assign to it here, as that would trigger the setter and overwrite the business object!

        // User Task - Extract candidate groups (Flowable standard format)
        if (bo.$type === 'bpmn:UserTask') {
          // Flowable 标准格式：由于配置了 flowable moddle extension，属性会被解析为直接属性
          const candidateGroupsValue = bo.candidateGroups || ''

          elementProperties.value.candidateGroups = candidateGroupsValue

          // No need to manually set selectedRoles.value, the computed getter will handle it
        }
        // Service Task / Send Task - Implementation
        else if (bo.$type === 'bpmn:ServiceTask' || bo.$type === 'bpmn:SendTask') {
          elementProperties.value.implementation = bo.implementation || bo.class || bo.delegateExpression || ''
        }
        // Sequence Flow - Condition Expression
        else if (bo.$type === 'bpmn:SequenceFlow') {
          if (bo.conditionExpression) {
            elementProperties.value.conditionExpression = bo.conditionExpression.body || ''
          }
        }
        // Events - Event Type
        else if (bo.$type && bo.$type.includes('Event')) {
          elementProperties.value.eventType = bo.$type.replace('bpmn:', '')

          // Timer Event Definition
          if (bo.eventDefinitions && bo.eventDefinitions.length > 0) {
            const timerDef = bo.eventDefinitions.find((def: any) => def.$type === 'bpmn:TimerEventDefinition')
            if (timerDef) {
              elementProperties.value.timerDefinition = timerDef.timeDuration?.body || timerDef.timeDate?.body || ''
            }
          }
        }
      }
      else {
        // Reset all properties
        elementProperties.value.id = ''
        elementProperties.value.name = ''
        elementProperties.value.type = ''
        elementProperties.value.candidateGroups = ''
        elementProperties.value.implementation = ''
        elementProperties.value.conditionExpression = ''
        elementProperties.value.eventType = ''
        elementProperties.value.timerDefinition = ''
        // selectedRoles.value = [] // Do not assign to computed
      }
    })

    // Import XML
    const xmlToImport = props.initialXml || emptyBpmn

    await modeler.value.importXML(xmlToImport)

    // Extract process configuration from XML
    extractProcessConfig()

    // Zoom to fit after a short delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 100))
    modeler.value.get('canvas').zoom('fit-viewport')
  }
  catch (err: any) {
    toast.error(`Failed to load workflow editor: ${err.message || 'Unknown error'}`)
  }
  finally {
    loading.value = false
  }
}

function extractProcessConfig() {
  if (!modeler.value)
    return

  // Reset to defaults
  processConfig.value = {
    workflowType: 'custom',
    triggerKeywords: [],
    priority: 'medium',
    description: '',
  }

  try {
    const rootElement = modeler.value.get('canvas').getRootElement()
    const bo = rootElement.businessObject

    if (bo.extensionElements && bo.extensionElements.values) {
      // Find direct flowable:property elements (Standard Direct Format)
      // Note: Moddle types are capitalized, so we look for flowable:Property
      const properties = bo.extensionElements.values.filter((v: any) =>
        v.$type === 'flowable:Property' || v.$type === 'flowable:property',
      )

      if (properties.length > 0) {
        properties.forEach((prop: any) => {
          const name = prop.name
          const value = prop.value

          if (!name || value === undefined)
            return

          switch (name) {
            case 'workflowType':
              processConfig.value.workflowType = value
              break
            case 'triggerKeywords':
              processConfig.value.triggerKeywords = value.split(',').map((k: string) => k.trim()).filter((k: string) => k)
              break
            case 'priority':
              processConfig.value.priority = value
              break
            case 'description':
              processConfig.value.description = value
              break
          }
        })
      }
    }
  }
  catch {
    // Silently ignore errors
  }
}

async function updateProcessConfig() {
  if (!modeler.value)
    return

  try {
    // Get current XML
    const { xml } = await modeler.value.saveXML({ format: true })

    // Build direct properties XML
    let propertiesXml = ''
    propertiesXml += `<flowable:property name="workflowType" value="${processConfig.value.workflowType}" />`
    propertiesXml += `<flowable:property name="triggerKeywords" value="${processConfig.value.triggerKeywords.join(',')}" />`
    propertiesXml += `<flowable:property name="priority" value="${processConfig.value.priority}" />`
    propertiesXml += `<flowable:property name="description" value="${processConfig.value.description}" />`

    const extensionElementsStart = '<extensionElements>'
    const extensionElementsEnd = '</extensionElements>'

    let updatedXml = xml

    // Check if extensionElements exists
    if (updatedXml.includes(extensionElementsStart)) {
      // Remove existing flowable:property tags (Rough regex, but safer to assume we replace the block)
      // Actually, standard regex replacement for properties inside might be tricky.
      // Easiest is to remove all flowable:property and re-add them?
      // Or just replace the extensionElements block if we assume we own it?
      // Let's use a regex to find existing extensionElements content and inject/replace our properties.

      // Strategy: Remove old flowable:property tags
      updatedXml = updatedXml.replace(/<flowable:property[^>]*\/>/g, '')
      updatedXml = updatedXml.replace(/<flowable:properties>[\s\S]*?<\/flowable:properties>/g, '') // Remove old wrappers too

      // Inject new ones into extensionElements
      updatedXml = updatedXml.replace(extensionElementsStart, `${extensionElementsStart}${propertiesXml}`)
    }
    else {
      // Create new extensionElements block
      const newBlock = `${extensionElementsStart}${propertiesXml}${extensionElementsEnd}`
      updatedXml = updatedXml.replace(/(<process[^>]*>)/, `$1${newBlock}`)
    }

    // Re-import the updated XML
    await modeler.value.importXML(updatedXml)
    modeler.value.get('canvas').zoom('fit-viewport')

    toast.success('Process configuration updated')
  }
  catch {
    toast.error('Failed to update configuration')
  }
}

function addKeyword() {
  if (newKeyword.value.trim()) {
    processConfig.value.triggerKeywords.push(newKeyword.value.trim().toUpperCase())
    newKeyword.value = ''
    updateProcessConfig()
  }
}

function removeKeyword(keyword: string) {
  processConfig.value.triggerKeywords = processConfig.value.triggerKeywords.filter(k => k !== keyword)
  updateProcessConfig()
}

function updateNodeProperty(prop: string, value: string) {
  if (!modeler.value || !selectedElement.value)
    return

  const modeling = modeler.value.get('modeling')
  const element = selectedElement.value
  const bo = element.businessObject

  // 根据属性类型使用不同的更新方法
  if (prop === 'name') {
    modeling.updateProperties(element, { name: value })
  }
  else if (prop === 'candidateGroups') {
    // Flowable properties are now direct properties on the business object
    modeling.updateModdleProperties(element, bo, {
      candidateGroups: value,
    })
  }
  else if (prop === 'implementation') {
    // Service Task / Send Task
    modeling.updateProperties(element, { implementation: value })
  }
  else if (prop === 'conditionExpression') {
    // Sequence Flow 条件表达式
    const moddle = modeler.value.get('moddle')
    const conditionExpression = moddle.create('bpmn:FormalExpression', { body: value })
    modeling.updateProperties(element, { conditionExpression })
  }

  // 更新本地状态
  if (prop in elementProperties.value) {
    (elementProperties.value as any)[prop] = value
  }
}

async function handleSave() {
  if (!modeler.value)
    return

  // --- Validation Logic ---
  const elementRegistry = modeler.value.get('elementRegistry')
  const elements = elementRegistry.getAll()

  // 1. Check for Start Event
  const hasStartEvent = elements.some((e: any) => e.type === 'bpmn:StartEvent')
  if (!hasStartEvent) {
    toast.error('Validation Failed: Workflow must have a Start Event')
    return
  }

  // 2. Validate User Tasks
  const userTasks = elements.filter((e: any) => e.type === 'bpmn:UserTask')
  for (const task of userTasks) {
    const bo = task.businessObject
    if (!bo.candidateGroups && !bo.assignee && !bo.candidateUsers) {
      toast.error(`Validation Failed: User Task "${bo.name || task.id}" must have Approval Roles or Assignee`)
      const selection = modeler.value.get('selection')
      selection.select(task)
      activeTab.value = 'element'
      return
    }
  }

  // 2.1 Validate Service/Send Tasks
  const serviceTasks = elements.filter((e: any) => e.type === 'bpmn:ServiceTask' || e.type === 'bpmn:SendTask')
  for (const task of serviceTasks) {
    const bo = task.businessObject
    // Check implementation (class or delegateExpression) which we mapped to 'implementation' in UI but need to check BO props
    // Our moddle mapping or simple update might have put it in 'class' or 'delegateExpression' or 'implementation' depending on how we saved it.
    // In updateNodeProperty we use modeling.updateProperties(element, { implementation: value }) which sets the 'implementation' attribute on ServiceTask (if standard BPMN)
    // But Flowable usually expects 'flowable:class' or 'flowable:delegateExpression'.
    // However, for basic validation, let's check if *any* implementation property is set.

    // Note: In our current updateNodeProperty logic:
    // modeling.updateProperties(element, { implementation: value })
    // This sets the 'implementation' attribute. Flowable might interpret this via custom handling or we might need to be specific.
    // For now, checks if 'implementation' or 'class' or 'delegateExpression' is present.
    if (!bo.implementation && !bo.class && !bo.delegateExpression) {
      toast.error(`Validation Failed: Service Task "${bo.name || task.id}" must have an Implementation`)
      const selection = modeler.value.get('selection')
      selection.select(task)
      activeTab.value = 'element'
      return
    }
  }

  // 2.2 Validate Gateways (Sequence Flow Conditions)
  const exclusiveGateways = elements.filter((e: any) => e.type === 'bpmn:ExclusiveGateway')
  for (const gateway of exclusiveGateways) {
    if (gateway.outgoing && gateway.outgoing.length > 1) {
      // Check if all outgoing flows have a condition (except maybe one default flow)
      // We don't track default flow in UI yet, so let's enforce condition on all for now or warn.
      // Or simply check if at least one flow has a condition if there are multiple.
      const flowsWithCondition = gateway.outgoing.filter((flow: any) =>
        flow.businessObject.conditionExpression && flow.businessObject.conditionExpression.body,
      )

      // If we have multiple outgoing flows, we generally expect conditions.
      // Strict rule: All flows must have condition OR be the default flow.
      // Simplified validation for now: Warn if no conditions set at all for a branching gateway.
      if (flowsWithCondition.length === 0) {
        toast.error(`Validation Failed: Gateway "${gateway.businessObject.name || gateway.id}" needs conditions on its outgoing flows`)
        const selection = modeler.value.get('selection')
        selection.select(gateway)
        return
      }
    }
  }

  // 2.3 Validate Timer Events
  const timerEvents = elements.filter((e: any) =>
    e.type === 'bpmn:IntermediateCatchEvent'
    && e.businessObject.eventDefinitions?.some((def: any) => def.$type === 'bpmn:TimerEventDefinition'),
  )
  for (const event of timerEvents) {
    const timerDef = event.businessObject.eventDefinitions.find((def: any) => def.$type === 'bpmn:TimerEventDefinition')
    if (!timerDef || (!timerDef.timeDuration && !timerDef.timeDate && !timerDef.timeCycle)) {
      toast.error(`Validation Failed: Timer Event "${event.businessObject.name || event.id}" must have a duration/date configuration`)
      const selection = modeler.value.get('selection')
      selection.select(event)
      activeTab.value = 'element'
      return
    }
  }

  // 3. Validate Process Config
  if (!processConfig.value.workflowType) {
    toast.error('Validation Failed: Workflow Type must be selected in Process Config')
    activeTab.value = 'process' // Switch to process tab
    return
  }

  if (processConfig.value.workflowType === 'sql_approval' && processConfig.value.triggerKeywords.length === 0) {
    toast.error('Validation Failed: SQL Approval workflow must have at least one Trigger Keyword')
    activeTab.value = 'process'
    return
  }

  // 4. Check for disconnected nodes (Basic check)
  // Filter for flow nodes (events, tasks, gateways) that are not Start/End events
  const flowNodes = elements.filter((e: any) =>
    e.type !== 'bpmn:Process'
    && e.type !== 'bpmn:SequenceFlow'
    && e.type !== 'label'
    && !e.type.includes('BoundaryEvent'),
  )

  for (const node of flowNodes) {
    if (node.type === 'bpmn:StartEvent') {
      if (!node.outgoing || node.outgoing.length === 0) {
        toast.error('Validation Failed: Start Event must be connected')
        return
      }
    }
    else if (node.type === 'bpmn:EndEvent') {
      if (!node.incoming || node.incoming.length === 0) {
        toast.error('Validation Failed: End Event must be connected')
        return
      }
    }
    else {
      // Normal nodes should have both incoming and outgoing (simplified rule)
      if ((!node.incoming || node.incoming.length === 0) && (!node.outgoing || node.outgoing.length === 0)) {
        toast.error(`Validation Failed: Element "${node.businessObject.name || node.id}" is disconnected`)
        return
      }
    }
  }

  try {
    // Update process config in XML before saving
    await updateProcessConfig()

    const { xml } = await modeler.value.saveXML({ format: true })
    emit('save', { xml, name: workflowName.value })
  }
  catch (err) {
    console.error(err)
    toast.error('Failed to generate BPMN XML')
  }
}

function handleUndo() {
  modeler.value?.get('commandStack').undo()
}

function handleRedo() {
  modeler.value?.get('commandStack').redo()
}

async function downloadXml() {
  try {
    const { xml } = await modeler.value.saveXML({ format: true })
    const blob = new Blob([xml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflowName.value.replace(/\s+/g, '_')}.bpmn20.xml`
    a.click()
    URL.revokeObjectURL(url)
  }
  catch {
    toast.error('Download failed')
  }
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length)
    return

  const file = input.files[0]
  if (!file)
    return
  const reader = new FileReader()

  loading.value = true
  reader.onload = async (e) => {
    const xml = e.target?.result as string

    try {
      if (modeler.value) {
        await modeler.value.importXML(xml)

        // Extract process configuration
        extractProcessConfig()

        modeler.value.get('canvas').zoom('fit-viewport')
        toast.success('Workflow imported successfully')
      }
    }
    catch {
      toast.error('Failed to parse BPMN file')
    }
    finally {
      loading.value = false
    }
  }
  reader.readAsText(file)

  // Reset input
  input.value = ''
}

onMounted(() => {
  initModeler()
  fetchRoles()
})

async function fetchRoles() {
  try {
    const response = await api.get('/roles')
    availableRoles.value = response.data
  }
  catch (e) {
    console.error('Failed to fetch roles', e)
  }
}

function toggleRole(roleSlug: string) {
  const currentRoles = selectedRoles.value
  if (currentRoles.includes(roleSlug)) {
    selectedRoles.value = currentRoles.filter(r => r !== roleSlug)
  }
  else {
    selectedRoles.value = [...currentRoles, roleSlug]
  }
}

onBeforeUnmount(() => {
  modeler.value?.destroy()
})
</script>

<template>
  <div class="flex flex-col h-full bg-background border rounded-lg overflow-hidden relative">
    <!-- Modeler Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
      <div class="flex items-center gap-4">
        <div class="flex flex-col gap-1">
          <Input
            v-model="workflowName"
            class="h-8 w-64 bg-background font-bold"
            placeholder="Workflow Name"
          />
        </div>
        <div class="flex items-center gap-1 bg-background border rounded-md p-1">
          <Button variant="ghost" size="icon" class="h-7 w-7" title="Undo" @click="handleUndo">
            <Undo class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" class="h-7 w-7" title="Redo" @click="handleRedo">
            <Redo class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <input
          ref="fileInput"
          type="file"
          accept=".bpmn,.xml"
          class="hidden"
          @change="handleFileImport"
        >
        <Button variant="outline" size="sm" @click="triggerImport">
          <Upload class="mr-2 h-4 w-4" /> Import XML
        </Button>
        <Button variant="outline" size="sm" @click="downloadXml">
          <Download class="mr-2 h-4 w-4" /> Export XML
        </Button>
        <Button variant="default" size="sm" @click="handleSave">
          <Save class="mr-2 h-4 w-4" /> Deploy Workflow
        </Button>
      </div>
    </div>

    <!-- Modeler Canvas -->
    <div class="flex-1 relative">
      <div ref="container" class="absolute inset-0" />

      <!-- Property Panel (Side) with Tabs -->
      <div class="absolute top-4 right-4 bottom-12 w-80 bg-background/95 backdrop-blur border rounded-lg shadow-lg z-10 flex flex-col overflow-hidden">
        <Tabs v-model="activeTab" class="flex-1 flex flex-col h-full min-h-0">
          <TabsList class="w-full grid grid-cols-2 rounded-none border-b shrink-0">
            <TabsTrigger value="element" class="text-xs">
              Element
            </TabsTrigger>
            <TabsTrigger value="process" class="text-xs">
              Process Config
            </TabsTrigger>
          </TabsList>

          <!-- Element Properties Tab -->
          <TabsContent value="element" class="flex-1 overflow-y-auto p-4 m-0 min-h-0">
            <div v-if="selectedElement" class="space-y-4 animate-in fade-in">
              <div class="space-y-1.5">
                <Label class="text-[10px] uppercase text-muted-foreground">Type</Label>
                <div class="text-xs font-mono bg-muted p-1 rounded">
                  {{ selectedElement.type.replace('bpmn:', '') }}
                </div>
              </div>

              <div class="space-y-1.5">
                <Label for="el-id" class="text-[10px] uppercase text-muted-foreground">ID</Label>
                <Input id="el-id" v-model="elementProperties.id" readonly class="h-8 text-xs bg-muted/50 font-mono" />
              </div>

              <div class="space-y-1.5">
                <Label for="el-name" class="text-[10px] uppercase text-muted-foreground">Label/Name</Label>
                <Input
                  id="el-name"
                  v-model="elementProperties.name"
                  class="h-8 text-xs bg-background"
                  @input="updateNodeProperty('name', ($event.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Flowable Specific: Candidate Groups (Roles) for User Tasks -->
              <div v-if="selectedElement.type === 'bpmn:UserTask'" class="space-y-1.5 border-t pt-2 mt-2">
                <Label class="text-[10px] uppercase text-primary font-bold">Approval Roles</Label>

                <div class="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[36px] bg-background">
                  <Badge
                    v-for="role in selectedRoles"
                    :key="role"
                    variant="secondary"
                    class="text-[10px] px-1.5 py-0.5 gap-1"
                  >
                    {{ role }}
                    <button
                      class="hover:text-destructive"
                      @click="selectedRoles = selectedRoles.filter(r => r !== role)"
                    >
                      <X class="h-2.5 w-2.5" />
                    </button>
                  </Badge>

                  <Popover>
                    <PopoverTrigger as-child>
                      <Button variant="ghost" size="sm" class="h-5 px-1.5 text-[10px] border-dashed border">
                        + Add Role
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-56 p-2" align="start">
                      <div class="space-y-1">
                        <p class="text-xs font-medium mb-2">
                          Select Roles
                        </p>
                        <div
                          v-for="role in availableRoles"
                          :key="role.id"
                          class="flex items-center space-x-2 py-1 px-2 hover:bg-muted rounded cursor-pointer"
                          @click="toggleRole(role.slug)"
                        >
                          <Checkbox
                            :id="`role-${role.id}`"
                            :checked="selectedRoles.includes(role.slug)"
                            @update:checked="toggleRole(role.slug)"
                          />
                          <label :for="`role-${role.id}`" class="text-xs cursor-pointer flex-1">
                            {{ role.name }} <span class="text-muted-foreground">({{ role.slug }})</span>
                          </label>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <p class="text-[9px] text-muted-foreground">
                  Select roles that can approve this task
                </p>
              </div>

              <!-- Service Task / Send Task Configuration -->
              <div v-if="selectedElement.type === 'bpmn:ServiceTask' || selectedElement.type === 'bpmn:SendTask'" class="space-y-1.5 border-t pt-2 mt-2">
                <Label class="text-[10px] uppercase text-primary font-bold">
                  {{ selectedElement.type === 'bpmn:SendTask' ? '发送配置' : '服务配置' }}
                </Label>

                <div class="space-y-1.5">
                  <Label for="implementation" class="text-[10px] text-muted-foreground">Implementation</Label>
                  <Input
                    id="implementation"
                    v-model="elementProperties.implementation"
                    class="h-8 text-xs bg-background font-mono"
                    placeholder="e.g., com.example.EmailService"
                    @input="updateNodeProperty('implementation', ($event.target as HTMLInputElement).value)"
                  />
                  <p class="text-[9px] text-muted-foreground">
                    {{ selectedElement.type === 'bpmn:SendTask' ? '邮件/通知服务类名' : 'Java 类名或表达式' }}
                  </p>
                </div>
              </div>

              <!-- Sequence Flow (from Gateway) Configuration -->
              <div v-if="selectedElement.type === 'bpmn:SequenceFlow'" class="space-y-1.5 border-t pt-2 mt-2">
                <Label class="text-[10px] uppercase text-primary font-bold">条件表达式</Label>

                <div class="space-y-1.5">
                  <Textarea
                    v-model="elementProperties.conditionExpression"
                    class="text-xs bg-background font-mono min-h-[60px]"
                    placeholder="${approved == true}"
                    @input="updateNodeProperty('conditionExpression', ($event.target as HTMLTextAreaElement).value)"
                  />
                  <p class="text-[9px] text-muted-foreground">
                    使用 ${} 表达式，例如: ${approved == true}
                  </p>
                </div>
              </div>

              <!-- Event Configuration -->
              <div v-if="selectedElement.type && selectedElement.type.includes('Event')" class="space-y-1.5 border-t pt-2 mt-2">
                <Label class="text-[10px] uppercase text-primary font-bold">事件配置</Label>

                <div class="space-y-1.5">
                  <Label class="text-[10px] text-muted-foreground">Event Type</Label>
                  <div class="text-xs font-mono bg-muted p-2 rounded">
                    {{ elementProperties.eventType }}
                  </div>
                </div>

                <!-- Timer Event Definition -->
                <div v-if="elementProperties.timerDefinition" class="space-y-1.5">
                  <Label for="timer" class="text-[10px] text-muted-foreground">Timer Definition</Label>
                  <Input
                    id="timer"
                    v-model="elementProperties.timerDefinition"
                    class="h-8 text-xs bg-background font-mono"
                    placeholder="PT1H (1 hour)"
                    readonly
                  />
                  <p class="text-[9px] text-muted-foreground">
                    ISO 8601 格式，如 PT1H (1小时), P1D (1天)
                  </p>
                </div>
              </div>

              <!-- Gateway Configuration -->
              <div v-if="selectedElement.type === 'bpmn:ExclusiveGateway' || selectedElement.type === 'bpmn:ParallelGateway'" class="space-y-1.5 border-t pt-2 mt-2">
                <Label class="text-[10px] uppercase text-primary font-bold">
                  {{ selectedElement.type === 'bpmn:ExclusiveGateway' ? '条件分支' : '并行分支' }}
                </Label>

                <div class="p-2 bg-muted/50 rounded text-[10px] space-y-1">
                  <p v-if="selectedElement.type === 'bpmn:ExclusiveGateway'">
                    <strong>条件分支 (XOR):</strong> 根据条件选择一条路径执行
                  </p>
                  <p v-else>
                    <strong>并行分支 (AND):</strong> 所有分支同时执行
                  </p>
                  <p class="text-muted-foreground mt-1">
                    在输出连线上配置条件表达式
                  </p>
                </div>
              </div>
            </div>

            <div v-else class="space-y-4">
              <p class="text-[10px] text-muted-foreground italic text-center py-8">
                Select an element to configure
              </p>
            </div>
          </TabsContent>

          <!-- Process Configuration Tab -->
          <TabsContent value="process" class="flex-1 overflow-y-auto p-4 m-0 min-h-0">
            <div class="space-y-4">
              <!-- Workflow Type -->
              <div class="space-y-1.5">
                <Label class="text-[10px] uppercase text-muted-foreground">Workflow Type</Label>
                <Select v-model="processConfig.workflowType" @update:model-value="updateProcessConfig">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sql_approval">
                      SQL Approval
                    </SelectItem>
                    <SelectItem value="data_export">
                      Data Export
                    </SelectItem>
                    <SelectItem value="custom">
                      Custom
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-[9px] text-muted-foreground">
                  Type of workflow for automatic matching
                </p>
              </div>

              <!-- Trigger Keywords (for SQL Approval) -->
              <div v-if="processConfig.workflowType === 'sql_approval'" class="space-y-1.5">
                <Label class="text-[10px] uppercase text-muted-foreground">Trigger Keywords</Label>
                <div class="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[36px] bg-background">
                  <Badge
                    v-for="keyword in processConfig.triggerKeywords"
                    :key="keyword"
                    variant="destructive"
                    class="text-[10px] px-1.5 py-0.5 gap-1"
                  >
                    {{ keyword }}
                    <button class="hover:text-white" @click="removeKeyword(keyword)">
                      <X class="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                </div>
                <div class="flex gap-1">
                  <Input
                    v-model="newKeyword"
                    placeholder="e.g., DELETE"
                    class="h-7 text-xs"
                    @keyup.enter="addKeyword"
                  />
                  <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="addKeyword">
                    Add
                  </Button>
                </div>
                <p class="text-[9px] text-muted-foreground">
                  SQL keywords that trigger this workflow
                </p>
              </div>

              <!-- Priority -->
              <div class="space-y-1.5">
                <Label class="text-[10px] uppercase text-muted-foreground">Priority</Label>
                <Select v-model="processConfig.priority" @update:model-value="updateProcessConfig">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      Low
                    </SelectItem>
                    <SelectItem value="medium">
                      Medium
                    </SelectItem>
                    <SelectItem value="high">
                      High
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-[9px] text-muted-foreground">
                  Higher priority workflows are matched first
                </p>
              </div>

              <!-- Description -->
              <div class="space-y-1.5">
                <Label class="text-[10px] uppercase text-muted-foreground">Description</Label>
                <Textarea
                  v-model="processConfig.description"
                  placeholder="Describe this workflow..."
                  class="text-xs min-h-[60px]"
                  @blur="updateProcessConfig"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>

    <!-- Instructions / Status Footer -->
    <div class="px-3 py-1 bg-muted/30 border-t flex justify-between items-center text-[10px] text-muted-foreground">
      <div class="flex gap-4">
        <span>BPMN 2.0 Compliant</span>
        <span>Keyboard Shortcuts Enabled</span>
      </div>
      <div>
        <Badge variant="outline" class="text-[9px] font-mono py-0 h-4">
          ID: {{ workflowName.toLowerCase().replace(/\s+/g, '_') }}
        </Badge>
      </div>
    </div>
  </div>
</template>

<style>
/* Modeler Theme Overrides */
.bjs-powered-by {
  display: none !important;
}

.djs-palette {
  top: 20px !important;
  left: 20px !important;
  border-radius: 8px !important;
  border: 1px solid hsl(var(--border)) !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

.djs-direct-editing-parent {
  background-color: hsl(var(--background)) !important;
  border: 1px solid hsl(var(--primary)) !important;
  border-radius: 4px !important;
}
</style>
