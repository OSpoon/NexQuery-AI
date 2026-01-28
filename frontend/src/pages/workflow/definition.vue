<script setup lang="ts">
import { ArrowLeft, Pause, Play, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import BpmnModeler from '@/components/workflow/BpmnModeler.vue'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const definitionId = route.params.id as string

const loading = ref(true)
const definition = ref<any>(null)
const xml = ref('')
const xmlLoading = ref(false)
const isSaving = ref(false)
const isNewWorkflow = definitionId === 'new'

// Empty BPMN template for new workflows
const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" xmlns:flowable="http://flowable.org/bpmn" targetNamespace="http://www.flowable.org/processdef">
  <process id="new_workflow" name="New Workflow" isExecutable="true">
    <startEvent id="startEvent" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_new_workflow">
    <bpmndi:BPMNPlane bpmnElement="new_workflow" id="BPMNPlane_new_workflow">
      <bpmndi:BPMNShape bpmnElement="startEvent" id="BPMNShape_startEvent">
        <omgdc:Bounds height="30.0" width="30.0" x="200.0" y="100.0" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

async function fetchData() {
  if (isNewWorkflow) {
    // Creating new workflow
    definition.value = {
      id: 'new',
      key: 'new_workflow',
      name: 'New Workflow',
      version: 1,
    }
    xml.value = emptyBpmn
    loading.value = false
    return
  }

  loading.value = true
  try {
    const { data } = await api.get(`/workflow/definitions/${definitionId}`)
    definition.value = data

    // Fetch XML
    await fetchXML()
  }
  catch {
  }
  finally {
    loading.value = false
  }
}

async function fetchXML() {
  xmlLoading.value = true
  try {
    const response = await api.get(`/workflow/definitions/${definitionId}/xml`, {
      responseType: 'text',
    })
    xml.value = response.data
  }
  catch {
    toast.error(t('workflow.toast.failed_to_load_diagram'))
  }
  finally {
    xmlLoading.value = false
  }
}

async function handleSave({ xml: newXml, name }: { xml: string, name: string }) {
  isSaving.value = true
  try {
    const key = name.toLowerCase().replace(/\s+/g, '_')
    await api.post('/workflow/definitions', {
      name: key,
      xml: newXml,
    })

    toast.success(t(isNewWorkflow ? 'workflow.toast.created' : 'workflow.toast.updated'))

    // Navigate back to workflow list
    router.push({ name: 'workflow' })
  }
  catch (err: any) {
    toast.error(err.response?.data?.message || t('workflow.toast.failed_to_save'))
  }
  finally {
    isSaving.value = false
  }
}

async function handleStateChange(action: 'suspend' | 'activate') {
  if (isNewWorkflow)
    return

  try {
    await api.put(`/workflow/definitions/${definitionId}/state`, { action })
    toast.success(t(action === 'suspend' ? 'workflow.toast.workflow_suspended' : 'workflow.toast.workflow_activated'))
    await fetchData()
  }
  catch {
    toast.error(t('workflow.toast.failed_to_update'))
  }
}

async function handleDelete() {
  if (isNewWorkflow)
    return

  if (!definition.value?.deploymentId) {
    toast.error(t('workflow.toast.deployment_not_found'))
    return
  }

  // eslint-disable-next-line no-alert
  if (!confirm(`${t('workflow.toast.delete_confirm_title') || 'Confirm Deletion'}\n\nAre you sure you want to delete this workflow? This action cannot be undone.`)) {
    return
  }

  try {
    await api.delete(`/workflow/deployments/${definition.value.deploymentId}`)
    toast.success(t('workflow.toast.workflow_deleted'))
    router.push({ name: 'workflow' })
  }
  catch {
    toast.error(t('workflow.toast.failed_to_delete'))
  }
}

const statusVariant = computed(() => {
  if (!definition.value)
    return 'secondary'
  return definition.value.suspended ? 'destructive' : 'default'
})

onMounted(fetchData)
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="router.push({ name: 'workflow' })">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
          <h1 class="text-xl font-bold tracking-tight">
            {{ definition?.name || 'Workflow Definition' }}
          </h1>
          <p class="text-xs text-muted-foreground font-mono">
            {{ definition?.key }} (v{{ definition?.version }})
          </p>
        </div>
      </div>
      <div v-if="definition" class="flex items-center gap-4">
        <div class="flex items-center gap-2 pr-4 border-r">
          <Badge v-if="!isNewWorkflow" :variant="statusVariant">
            {{ definition.suspended ? 'Suspended' : 'Active' }}
          </Badge>
          <Badge v-else variant="secondary">
            New Workflow
          </Badge>
        </div>

        <div v-if="!isNewWorkflow" class="flex gap-2">
          <Button
            v-if="definition.suspended"
            variant="outline"
            size="sm"
            @click="handleStateChange('activate')"
          >
            <Play class="mr-2 h-4 w-4" /> Activate
          </Button>
          <Button
            v-else
            variant="outline"
            size="sm"
            @click="handleStateChange('suspend')"
          >
            <Pause class="mr-2 h-4 w-4" /> Suspend
          </Button>
          <Button
            variant="destructive"
            size="sm"
            @click="handleDelete"
          >
            <Trash2 class="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>

    <div v-else-if="definition" class="flex-1 overflow-hidden relative">
      <div v-if="isSaving" class="absolute inset-0 z-50 bg-background/50 backdrop-blur flex flex-col items-center justify-center">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
        <p class="text-sm font-medium">
          Saving workflow...
        </p>
      </div>

      <BpmnModeler
        v-if="!xmlLoading && xml"
        :initial-xml="xml"
        :initial-name="definition.name || definition.key"
        @save="handleSave"
      />
      <div v-else-if="xmlLoading" class="h-full flex items-center justify-center">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    </div>
  </div>
</template>
