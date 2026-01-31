<script setup lang="ts">
import { useClipboard, useDark } from '@vueuse/core'
import { Check, Copy, RefreshCw } from 'lucide-vue-next'
import { MarkdownRender } from 'markstream-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  analysis: string
  loading?: boolean
  usage?: any
}>()

const emit = defineEmits(['update:open', 'refresh'])

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const { copy, copied } = useClipboard()

const isDark = useDark()
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
      <DialogHeader class="p-6 pb-2">
        <div class="flex items-center justify-between">
          <DialogTitle>{{ t('query_tasks.ai_optimization_title') }}</DialogTitle>
          <Button variant="ghost" size="icon" :disabled="loading" @click="emit('refresh')">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          </Button>
        </div>
        <DialogDescription> {{ t('query_tasks.ai_optimization_desc') }} </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 relative bg-muted/30 mx-6 border rounded-md">
        <div class="absolute inset-0 overflow-y-auto p-4 pr-12">
          <div
            v-if="!analysis && loading"
            class="flex items-center justify-center h-full text-muted-foreground text-sm"
          >
            {{ t('query_tasks.ai_thinking') }}
          </div>
          <div v-if="analysis" class="prose dark:prose-invert max-w-none">
            <MarkdownRender custom-id="ai-result" :content="analysis" :is-dark="isDark" />
          </div>
        </div>
        <div
          class="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md shadow-sm z-10"
        >
          <Button variant="ghost" size="icon" @click="copy(analysis)">
            <Check v-if="copied" class="h-4 w-4 text-green-500" />
            <Copy v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div class="flex justify-end gap-2 p-6 pt-4">
        <Button variant="outline" @click="isOpen = false">
          {{ t('common.close') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:deep(.markstream-vue) {
  --markstream-primary: var(--primary);
}
</style>
