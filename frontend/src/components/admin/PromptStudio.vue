<script setup lang="ts">
import type { PromptItem } from '@/lib/api/prompts'
import { markdown } from '@codemirror/lang-markdown'
import { useDark } from '@vueuse/core'
import { Database, Eye, FileCode, Pencil, RotateCcw, Save, Search } from 'lucide-vue-next'
import { MarkdownRender } from 'markstream-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import CodeMirrorEditor from '@/components/shared/CodeMirrorEditor.vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { promptsApi } from '@/lib/api/prompts'

const prompts = ref<PromptItem[]>([])
const searchQuery = ref('')
const selectedKey = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const isDark = useDark()
const { t } = useI18n()

// Editor State
const editorContent = ref('')
const originalContent = ref('') // To detect changes

// Computed
const filteredPrompts = computed(() => {
  if (!searchQuery.value)
    return prompts.value
  const q = searchQuery.value.toLowerCase()
  return prompts.value.filter(p => p.key.toLowerCase().includes(q))
})

const selectedPrompt = computed(() => prompts.value.find(p => p.key === selectedKey.value))
const hasChanges = computed(() => editorContent.value !== originalContent.value)

// Actions
async function fetchPrompts() {
  isLoading.value = true
  try {
    const res = await promptsApi.getAll()
    prompts.value = res.data
  }
  catch {
    toast.error(t('prompts.toast.load_failed'))
  }
  finally {
    isLoading.value = false
  }
}

function selectPrompt(key: string) {
  const p = prompts.value.find(item => item.key === key)
  if (p) {
    selectedKey.value = key
    editorContent.value = p.content
    originalContent.value = p.content
  }
}

async function handleSave() {
  if (!selectedKey.value)
    return

  isSaving.value = true
  try {
    const res = await promptsApi.update(selectedKey.value, {
      content: editorContent.value,
    })

    toast.success(t('prompts.toast.save_success'))

    // Update local state
    const idx = prompts.value.findIndex(p => p.key === selectedKey.value)
    if (idx !== -1) {
      prompts.value[idx] = { ...prompts.value[idx], ...res.data.data }
    }
    originalContent.value = editorContent.value
  }
  catch {
    toast.error(t('prompts.toast.save_failed'))
  }
  finally {
    isSaving.value = false
  }
}

async function handleReset() {
  if (!selectedKey.value)
    return
    // eslint-disable-next-line no-alert
  if (!confirm(t('prompts.confirm_reset')))
    return

  isSaving.value = true
  try {
    await promptsApi.reset(selectedKey.value)
    toast.success(t('prompts.toast.reset_success'))

    // Reload list to get fresh content/status
    await fetchPrompts()
    // Re-select to update editor
    selectPrompt(selectedKey.value!)
  }
  catch {
    toast.error(t('prompts.toast.reset_failed'))
  }
  finally {
    isSaving.value = false
  }
}

onMounted(() => {
  fetchPrompts()
})
</script>

<template>
  <div class="flex h-[700px] w-full flex-col gap-4 md:flex-row">
    <!-- Sidebar: List -->
    <Card class="flex w-full flex-col overflow-hidden p-0 gap-0 md:w-80 lg:w-96">
      <div class="p-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold tracking-tight">
            {{ t('prompts.list_title') }}
          </h2>
          <Badge variant="outline">
            {{ prompts.length }}
          </Badge>
        </div>
        <div class="relative">
          <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            :placeholder="t('prompts.search_placeholder')"
            class="pl-8"
          />
        </div>
      </div>
      <Separator />

      <ScrollArea class="flex-1">
        <div class="flex flex-col gap-1 p-2">
          <button
            v-for="prompt in filteredPrompts"
            :key="prompt.key"
            class="flex flex-col items-start gap-1 rounded-md p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="{ 'bg-accent text-accent-foreground': selectedKey === prompt.key }"
            @click="selectPrompt(prompt.key)"
          >
            <div class="flex w-full items-center justify-between">
              <span class="font-medium truncate">{{ prompt.key }}</span>
              <Database v-if="prompt.source === 'database'" class="h-3 w-3 text-orange-500" />
              <FileCode v-else class="h-3 w-3 text-muted-foreground" />
            </div>
            <span v-if="prompt.description" class="line-clamp-1 text-xs text-muted-foreground">
              {{ prompt.description }}
            </span>
          </button>

          <div v-if="filteredPrompts.length === 0" class="p-4 text-center text-sm text-muted-foreground">
            {{ t('prompts.no_prompts') }}
          </div>
        </div>
      </ScrollArea>
    </Card>

    <!-- Main: Editor -->
    <Card class="flex flex-1 flex-col overflow-hidden">
      <div v-if="selectedKey" class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between border-b p-4">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold">
                {{ selectedKey }}
              </h3>
              <Badge :variant="selectedPrompt?.source === 'database' ? 'default' : 'secondary'">
                {{ selectedPrompt?.source === 'database' ? t('prompts.source_db') : t('prompts.source_file') }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground font-mono">
              {{ selectedPrompt?.description || t('prompts.no_desc') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="isSaving || selectedPrompt?.source !== 'database'"
              @click="handleReset"
            >
              <RotateCcw class="mr-2 h-3 w-3" />
              {{ t('prompts.reset') }}
            </Button>
            <Button
              size="sm"
              :disabled="!hasChanges || isSaving"
              @click="handleSave"
            >
              <Save class="mr-2 h-3 w-3" />
              {{ t('prompts.save') }}
            </Button>
          </div>
        </div>

        <!-- Editor/Preview Tabs -->
        <Tabs default-value="edit" class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 py-2 border-b">
            <TabsList class="grid w-[200px] grid-cols-2">
              <TabsTrigger value="edit">
                <Pencil class="mr-2 h-3 w-3" />
                {{ t('prompts.edit') }}
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye class="mr-2 h-3 w-3" />
                {{ t('prompts.preview') }}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" class="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
            <CodeMirrorEditor
              v-model="editorContent"
              class="h-full w-full"
              :extensions="[markdown()]"
            />
          </TabsContent>

          <TabsContent value="preview" class="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden bg-muted/10">
            <div class="prose dark:prose-invert max-w-none">
              <MarkdownRender :content="editorContent" :is-dark="isDark" />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Empty State -->
      <div v-else class="flex h-full items-center justify-center p-8 text-muted-foreground">
        <div class="text-center">
          <FileCode class="mx-auto h-12 w-12 opacity-50 mb-4" />
          <h3 class="text-lg font-medium">
            {{ t('prompts.select_prompt') }}
          </h3>
          <p class="text-sm">
            {{ t('prompts.select_prompt_desc') }}
          </p>
        </div>
      </div>
    </Card>
  </div>
</template>
