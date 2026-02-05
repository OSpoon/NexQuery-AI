<script setup lang="ts">
import { Braces, Copy, ExternalLink } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import MonacoEditor from '@/components/shared/MonacoEditor.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const props = defineProps<{
  value: any
  maxPreviewLength?: number
}>()

const isDialogOpen = ref(false)

const parsedValue = computed(() => {
  if (typeof props.value === 'string') {
    try {
      return JSON.parse(props.value)
    }
    catch {
      return null
    }
  }
  return props.value
})

const isJson = computed(() => parsedValue.value !== null && typeof parsedValue.value === 'object')

const formattedJson = computed(() => {
  if (!isJson.value)
    return String(props.value)
  return JSON.stringify(parsedValue.value, null, 2)
})

const previewText = computed(() => {
  const text = typeof props.value === 'string' ? props.value : JSON.stringify(props.value)
  const limit = props.maxPreviewLength || 100
  if (text.length <= limit)
    return text
  return `${text.substring(0, limit)}...`
})

function copyToClipboard() {
  navigator.clipboard.writeText(formattedJson.value)
  toast.success('JSON copied to clipboard')
}
</script>

<template>
  <div v-if="isJson" class="group relative">
    <div class="flex items-center gap-2">
      <code class="text-xs bg-muted/50 px-1.5 py-0.5 rounded border truncate max-w-[1000px] font-mono opacity-70 group-hover:opacity-100 transition-opacity">
        {{ previewText }}
      </code>

      <Dialog v-model:open="isDialogOpen">
        <DialogTrigger as-child>
          <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" title="View Full JSON">
            <ExternalLink class="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-5xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader class="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <div class="flex items-center gap-2">
              <Braces class="h-5 w-5 text-primary" />
              <DialogTitle>JSON Viewer</DialogTitle>
              <DialogDescription class="sr-only">
                View full JSON details
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" @click="copyToClipboard">
              <Copy class="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
          </DialogHeader>
          <MonacoEditor
            :model-value="formattedJson"
            language="json"
            readonly
            class="flex-1 min-h-[300px] m-6 mt-2"
          />
        </DialogContent>
      </Dialog>
    </div>
  </div>
  <template v-else>
    {{ value }}
  </template>
</template>
