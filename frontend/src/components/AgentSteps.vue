<script setup lang="ts">
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Terminal,
} from 'lucide-vue-next'
import { ref } from 'vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface AgentStep {
  type: 'thought' | 'tool'
  content?: string
  toolName?: string
  toolInput?: any
  toolOutput?: string
  status?: 'running' | 'done' | 'error'
}

defineProps<{
  steps: AgentStep[]
}>()

const isOpen = ref(true)

function formatToolInput(input: any) {
  try {
    return typeof input === 'string' ? input : JSON.stringify(input, null, 2)
  }
  catch {
    return String(input)
  }
}
</script>

<template>
  <div v-if="steps && steps.length > 0" class="border rounded-md bg-muted/30 mb-4 overflow-hidden">
    <Collapsible v-model:open="isOpen">
      <div
        class="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer"
        @click="isOpen = !isOpen"
      >
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Brain class="h-3.5 w-3.5" />
          <span>Agent Reasoning ({{ steps.length }} Steps)</span>
        </div>
        <CollapsibleTrigger as-child>
          <div class="hover:bg-muted p-1 rounded">
            <ChevronDown v-if="isOpen" class="h-3 w-3 text-muted-foreground" />
            <ChevronRight v-else class="h-3 w-3 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div class="p-3 space-y-3 text-xs font-mono">
          <div
            v-for="(step, index) in steps"
            :key="index"
            class="relative pl-4 border-l-2 ml-1"
            :class="step.type === 'tool' ? 'border-blue-500/30' : 'border-zinc-500/30'"
          >
            <!-- Thought Step -->
            <div
              v-if="step.type === 'thought'"
              class="text-muted-foreground/80 whitespace-pre-wrap"
            >
              {{ step.content }}
            </div>

            <!-- Tool Step -->
            <div v-else-if="step.type === 'tool'" class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge
                  variant="outline"
                  class="h-5 px-2 bg-background border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300"
                >
                  <Terminal class="h-3 w-3 mr-1" />
                  {{ step.toolName }}
                </Badge>
                <span v-if="step.status === 'running'" class="animate-pulse text-blue-500">Running...</span>
                <span
                  v-else-if="step.status === 'done'"
                  class="text-green-600 dark:text-green-400 flex items-center"
                >
                  <CheckCircle2 class="h-3 w-3 mr-1" /> Done
                </span>
                <span v-else-if="step.status === 'error'" class="text-red-600 flex items-center">
                  <AlertCircle class="h-3 w-3 mr-1" /> Error
                </span>
              </div>

              <!-- Input -->
              <div class="bg-background/50 p-2 rounded border border-border/50">
                <div class="text-[10px] text-muted-foreground uppercase opacity-70 mb-1">
                  Input
                </div>
                <pre class="overflow-x-auto">{{ formatToolInput(step.toolInput) }}</pre>
              </div>

              <!-- Output -->
              <div
                v-if="step.toolOutput"
                class="bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded border border-border/50 text-muted-foreground"
              >
                <div class="text-[10px] text-muted-foreground uppercase opacity-70 mb-1">
                  Output
                </div>
                <div class="max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {{ step.toolOutput }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
