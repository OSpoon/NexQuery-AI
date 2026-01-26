<script setup lang="ts">
import { useDark } from '@vueuse/core'
import {
  BarChart2,
  Bot,
  Hash,
  HelpCircle,
  History,
  LineChart,
  Loader2,
  MessageCircle,
  PieChart,
  PlayCircle,
  Plus,
  Send,
  Sparkles,
  Table,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from 'lucide-vue-next'
import { MarkdownRender } from 'markstream-vue'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AiChart from '@/components/shared/AiChart.vue'
import SqlEditor from '@/components/shared/SqlEditor.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { useAiStore } from '@/stores/ai'
import { useDataSourceStore } from '@/stores/dataSource'
import { useSettingsStore } from '@/stores/settings'
import AgentSteps from './AgentSteps.vue'
// CSS is now imported in style.css inside @layer components

const { t } = useI18n()

const store = useAiStore()
const settingsStore = useSettingsStore()
const dataSourceStore = useDataSourceStore()

const isDark = useDark()
const input = ref('')
const scrollAreaRef = ref<HTMLDivElement | null>(null)
const selectedDataSource = ref<string>('none')

// Auto-select first data source once loaded
watch(
  () => dataSourceStore.databaseSources,
  (newSources) => {
    if (newSources.length > 0 && selectedDataSource.value === 'none') {
      const firstDs = newSources[0]
      if (firstDs) {
        selectedDataSource.value = firstDs.id.toString()
        store.dataSourceId = firstDs.id
      }
    }
  },
  { immediate: true },
)

onMounted(() => {
  dataSourceStore.fetchDataSources()
  store.fetchConversations()
})

// Refresh data sources whenever chat is opened to ensure sync
watch(
  () => store.isOpen,
  (isOpen) => {
    if (isOpen) {
      dataSourceStore.fetchDataSources()
      store.fetchConversations()
      scrollToBottom()
    }
  },
)

function scrollToBottom() {
  nextTick(() => {
    if (!scrollAreaRef.value)
      return

    // Handle both Element and Component ref
    const el = (scrollAreaRef.value as any).$el || scrollAreaRef.value
    // Locate the scroll area viewport within strictly this component
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]')

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  })
}

watch(
  () => store.messages,
  () => {
    scrollToBottom()
  },
  { deep: true },
)

watch(
  () => store.isOpen,
  (val) => {
    if (val)
      scrollToBottom()
  },
)

function handleSend() {
  if (!input.value.trim() || store.isLoading)
    return

  // Set context if selected
  if (selectedDataSource.value && selectedDataSource.value !== 'none') {
    store.dataSourceId = Number(selectedDataSource.value)
  }
  else {
    store.dataSourceId = undefined
  }

  store.sendMessage(input.value)
  input.value = ''
}

const isCorrectionOpen = ref(false)
const correctionText = ref('')
const activeFeedbackMsg = ref<any>(null)
const previewData = ref<Record<number, any[]>>({})
const loadingPreview = ref<Record<number, boolean>>({})

async function handlePreview(msg: any, index: number) {
  if (loadingPreview.value[index])
    return

  const sqlMatch = msg.content.match(/```sql\n?([\s\S]*?)```/)
  const sql = sqlMatch ? sqlMatch[1] : msg.content

  if (!sql || !store.dataSourceId) {
    toast.error('Unable to execute: SQL or Data Source missing')
    return
  }

  loadingPreview.value[index] = true
  try {
    const res = await api.post('/ai/preview', {
      dataSourceId: store.dataSourceId,
      sql,
    })
    previewData.value[index] = res.data.data
  }
  catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to fetch preview data')
  }
  finally {
    loadingPreview.value[index] = false
  }
}

async function handleFeedback(msg: any, helpful: boolean) {
  // Toggle logic: If clicking the same feedback, "cancel" it
  const isCancel = (helpful && msg.feedback === 'up') || (!helpful && msg.feedback === 'down')

  const question = msg.prompt || 'Unknown'

  if (!helpful && !isCancel) {
    activeFeedbackMsg.value = msg
    correctionText.value = ''
    isCorrectionOpen.value = true
    return
  }

  try {
    // If canceling, we could send a DELETE or just a special flag,
    // but for MVP, toggling simply switches or removes the state.
    // We'll send the feedback regardless, or we could skip if it's a cancel.
    // Let's just update the UI for now or send a "cancel" flag.
    if (!isCancel) {
      await api.post('/ai/feedback', {
        question,
        generatedSql: msg.content,
        isHelpful: helpful,
        userCorrection: null,
        conversationId: store.currentConversationId,
      })
      msg.feedback = helpful ? 'up' : 'down'
      toast.success(t('common.success'))
    }
    else {
      msg.feedback = null
    }
  }
  catch (e) {
    console.error('Failed to send feedback', e)
    toast.error(t('common.error'))
  }
}

async function submitCorrection() {
  if (!activeFeedbackMsg.value)
    return

  const question = activeFeedbackMsg.value.prompt || 'Unknown'

  try {
    await api.post('/ai/feedback', {
      question,
      generatedSql: activeFeedbackMsg.value.content,
      isHelpful: false,
      userCorrection: correctionText.value,
      conversationId: store.currentConversationId,
    })
    activeFeedbackMsg.value.feedback = 'down'
    isCorrectionOpen.value = false
    toast.success(t('common.success'))
  }
  catch (e) {
    console.error('Failed to send correction', e)
    toast.error(t('common.error'))
  }
}

function selectOption(option: string) {
  input.value = option
  handleSend()
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
    <!-- Chat Window -->
    <div
      v-if="store.isOpen"
      class="w-[480px] h-[600px] shadow-xl border rounded-lg bg-background flex flex-col overflow-hidden transition-all duration-200 animate-in slide-in-from-bottom-5 fade-in"
    >
      <!-- Header -->
      <div class="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
        <div class="flex items-center gap-2">
          <Bot class="h-5 w-5" />
          <span class="font-medium">NexQuery AI</span>
        </div>
        <div class="flex items-center gap-1">
          <!-- History Dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                title="History"
              >
                <History class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64 max-h-[400px] overflow-y-auto">
              <div
                v-if="store.conversations.length === 0"
                class="p-4 text-center text-xs text-muted-foreground"
              >
                No history yet
              </div>
              <DropdownMenuItem
                v-for="conv in store.conversations"
                :key="conv.id"
                class="flex items-center justify-between group"
                @click="store.loadConversation(conv.id)"
              >
                <span
                  class="truncate flex-1"
                  :class="{ 'font-bold': store.currentConversationId === conv.id }"
                >
                  {{ conv.title }}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                  @click.stop="store.deleteConversation(conv.id)"
                >
                  <Trash2 class="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- New Chat Button -->
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            title="New Chat"
            @click="store.startNewChat"
          >
            <Plus class="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            @click="store.toggleOpen"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Context Selector & Warning -->
      <div class="px-4 py-2 border-b bg-muted/30 space-y-2">
        <div
          v-if="!settingsStore.hasGlmKey"
          class="flex items-center justify-between p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium animate-in fade-in slide-in-from-top-1"
        >
          <span class="flex items-center gap-1.5">
            <Sparkles class="h-3 w-3" />
            {{ t('settings.keys.glm_key_missing') }}
          </span>
          <router-link to="/admin/settings" class="underline hover:opacity-80 transition-opacity">
            {{ t('settings.keys.configure_now') }}
          </router-link>
        </div>

        <Select v-model="selectedDataSource">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="Select Data Source (Context)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              No Context (General Chat)
            </SelectItem>
            <SelectItem
              v-for="ds in dataSourceStore.databaseSources"
              :key="ds.id"
              :value="String(ds.id)"
            >
              {{ ds.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Messages -->
      <div class="flex-1 min-h-0 p-4">
        <ScrollArea ref="scrollAreaRef" class="h-full">
          <div class="space-y-4 pr-4">
            <div
              v-for="(msg, index) in store.messages"
              :key="index"
              class="flex gap-3 text-sm group"
              :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
            >
              <div
                class="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
              >
                <User v-if="msg.role === 'user'" class="h-4 w-4" />
                <Bot v-else class="h-4 w-4" />
              </div>

              <div
                class="p-3 rounded-lg max-w-[85%]"
                :class="
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                "
              >
                <div v-if="msg.role === 'assistant'">
                  <AgentSteps
                    v-if="msg.agentSteps && msg.agentSteps.length > 0"
                    :steps="msg.agentSteps"
                  />

                  <!-- Visualization Badge -->
                  <div v-if="msg.visualization" class="mb-2 flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      class="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <BarChart2
                        v-if="msg.visualization.recommendation === 'bar'"
                        class="h-3 w-3"
                      />
                      <LineChart
                        v-else-if="msg.visualization.recommendation === 'line'"
                        class="h-3 w-3"
                      />
                      <PieChart
                        v-else-if="msg.visualization.recommendation === 'pie'"
                        class="h-3 w-3"
                      />
                      <Hash
                        v-else-if="msg.visualization.recommendation === 'number'"
                        class="h-3 w-3"
                      />
                      <Table v-else class="h-3 w-3" />
                      Recommended: {{ msg.visualization.recommendation }}
                    </Badge>
                    <Button
                      v-if="!previewData[index]"
                      variant="outline"
                      size="sm"
                      class="h-6 px-2 text-[10px] gap-1 hover:bg-primary/10 border-primary/20 text-primary"
                      :disabled="loadingPreview[index]"
                      @click="handlePreview(msg, index)"
                    >
                      <Loader2 v-if="loadingPreview[index]" class="h-3 w-3 animate-spin" />
                      <PlayCircle v-else class="h-3 w-3" />
                      {{ loadingPreview[index] ? 'Running...' : 'Execute & Visualize' }}
                    </Button>
                  </div>

                  <MarkdownRender custom-id="ai-chat" :content="msg.content" :is-dark="isDark" />

                  <!-- Chart Preview -->
                  <div v-if="previewData[index]" class="mt-4">
                    <AiChart
                      :data="previewData[index]"
                      :type="msg.visualization?.recommendation || 'table'"
                      :config="msg.visualization?.config || {}"
                    />
                  </div>

                  <!-- Clarification Request -->
                  <div
                    v-if="msg.clarification"
                    class="mt-3 p-3 bg-background/50 border border-primary/20 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-300"
                  >
                    <div class="flex items-center gap-2 text-primary">
                      <HelpCircle class="h-4 w-4" />
                      <span class="text-xs font-semibold">{{ msg.clarification.question }}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <Button
                        v-for="opt in msg.clarification.options"
                        :key="opt"
                        variant="secondary"
                        size="sm"
                        class="text-[11px] h-7 px-3 bg-secondary/50 hover:bg-primary hover:text-primary-foreground transition-all rounded-full shadow-sm"
                        @click="selectOption(opt)"
                      >
                        {{ opt }}
                      </Button>
                    </div>
                  </div>

                  <!-- Feedback Actions -->
                  <div
                    v-if="!store.isLoading && msg.content && index > 0"
                    class="flex items-center justify-end gap-0.5 mt-2 transition-opacity duration-200"
                    :class="msg.feedback ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 rounded-md hover:bg-primary/10"
                      title="Helpful"
                      @click="handleFeedback(msg, true)"
                    >
                      <ThumbsUp
                        class="h-3 w-3"
                        :class="{ 'fill-primary text-primary': msg.feedback === 'up' }"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 rounded-md hover:bg-destructive/10"
                      title="Not helpful"
                      @click="handleFeedback(msg, false)"
                    >
                      <ThumbsDown
                        class="h-3 w-3"
                        :class="{ 'fill-destructive text-destructive': msg.feedback === 'down' }"
                      />
                    </Button>
                  </div>
                </div>
                <div v-else>
                  {{ msg.content }}
                </div>
              </div>
            </div>
            <div v-if="store.isLoading" class="flex gap-3">
              <div class="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Sparkles class="h-4 w-4 animate-pulse" />
              </div>
              <div class="p-3 rounded-lg bg-muted text-xs text-muted-foreground italic">
                Generating SQL...
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <!-- Input -->
      <div class="p-3 pt-0">
        <form class="flex gap-2" @submit.prevent="handleSend">
          <Input
            v-model="input"
            :placeholder="
              settingsStore.hasGlmKey ? 'Ask a question...' : t('settings.keys.glm_key_missing')
            "
            class="flex-1"
            :disabled="store.isLoading || !settingsStore.hasGlmKey"
          />
          <Button type="submit" size="icon" :disabled="store.isLoading || !settingsStore.hasGlmKey">
            <Send class="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>

    <!-- Toggle Button -->
    <Button
      v-else
      size="lg"
      class="h-14 w-14 rounded-full shadow-lg p-0 bg-primary hover:bg-primary/90 transition-transform hover:scale-105"
      @click="store.toggleOpen"
    >
      <MessageCircle class="h-7 w-7" />
    </Button>

    <!-- Correction Dialog -->
    <Dialog v-model:open="isCorrectionOpen">
      <DialogContent class="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>帮助我们改进</DialogTitle>
          <DialogDescription>
            如果您觉得 AI 的回答不对，请提供您预期的 SQL 语句：
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <SqlEditor v-model="correctionText" :data-source-id="store.dataSourceId" class="h-64" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isCorrectionOpen = false">
            取消
          </Button>
          <Button @click="submitCorrection">
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Base prose styles are handled by markstream-vue */

/* Custom Scrollbar Styles for the Chat Container */
:deep([data-radix-scroll-area-viewport]) {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

:deep([data-radix-scroll-area-viewport]::-webkit-scrollbar) {
  width: 6px;
}

:deep([data-radix-scroll-area-viewport]::-webkit-scrollbar-track) {
  background: transparent;
}

:deep([data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb) {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

:deep(.dark [data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.markstream-vue) {
  --markstream-primary: var(--primary);
}
</style>
