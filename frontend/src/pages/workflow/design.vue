<script setup lang="ts">
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import BpmnModeler from '@/components/workflow/BpmnModeler.vue'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const isDeploying = ref(false)
const initialXml = ref('')
const workflowName = ref('')
const isLoading = ref(false)

// Check if we're in edit mode
const editMode = route.query.edit as string | undefined

async function loadExistingWorkflow() {
  if (!editMode)
    return

  isLoading.value = true
  try {
    const response = await api.get(`/workflow/definitions/${editMode}/xml`, {
      responseType: 'text',
    })

    // Ensure we have valid XML string
    let xmlString = response.data
    if (typeof xmlString !== 'string') {
      throw new TypeError('Invalid XML format received')
    }

    // Trim whitespace
    xmlString = xmlString.trim()

    // Basic XML validation
    if (!xmlString.startsWith('<?xml') && !xmlString.startsWith('<definitions')) {
      throw new Error('Response is not valid BPMN XML')
    }

    initialXml.value = xmlString
    workflowName.value = (route.query.name as string) || ''
  }
  catch (error: any) {
    toast.error(error.message || t('workflow.toast.failed_to_load_for_edit'))
  }
  finally {
    isLoading.value = false
  }
}

async function handleDeploy({ xml, name }: { xml: string, name: string }) {
  if (!name.trim()) {
    toast.error(t('workflow.toast.name_required'))
    return
  }

  isDeploying.value = true
  try {
    const key = name.toLowerCase().replace(/\s+/g, '_')
    await api.post('/workflow/definitions', {
      name: key,
      xml,
    })

    toast.success(t(editMode ? 'workflow.toast.updated' : 'workflow.toast.deployed'))
    router.push({ name: 'workflow' })
  }
  catch (err: any) {
    toast.error(err.response?.data?.message || t('workflow.toast.deployment_failed'))
  }
  finally {
    isDeploying.value = false
  }
}

onMounted(() => {
  loadExistingWorkflow()
})
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-background">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="router.back()">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
          <h1 class="text-xl font-bold tracking-tight">
            Workflow Designer
          </h1>
          <p class="text-xs text-muted-foreground">
            Design your interactive process and deploy it instantly.
          </p>
        </div>
      </div>
    </div>

    <!-- Modeler Area -->
    <div class="flex-1 p-6 bg-muted/30">
      <div v-if="isDeploying || isLoading" class="absolute inset-0 z-50 bg-background/50 backdrop-blur flex flex-col items-center justify-center">
        <Loader2 class="h-8 w-8 animate-spin text-primary mb-4" />
        <p class="text-sm font-medium">
          {{ isLoading ? 'Loading workflow...' : 'Deploying to Flowable engine...' }}
        </p>
      </div>

      <BpmnModeler
        v-if="!isLoading"
        :initial-xml="initialXml"
        :initial-name="workflowName"
        @save="handleDeploy"
      />
    </div>
  </div>
</template>
