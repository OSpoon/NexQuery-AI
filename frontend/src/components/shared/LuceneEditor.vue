<script setup lang="ts">
import { AlertCircle, Braces as BracesIcon, CheckCircle2, Eraser, HelpCircle } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getLuceneExtensions } from '@/lib/codemirror-extensions'
import CodeMirrorEditor from './CodeMirrorEditor.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  variables?: Array<{ name: string, description?: string }>
  fields?: Array<{ name: string, type: string }>
  readonly?: boolean
  hideToolbar?: boolean
}>(), {
})

const emit = defineEmits(['update:modelValue'])

const editorRef = ref<any>(null)
const syntaxError = ref<string | null>(null)
const fullWidthChars = /[；，。“”（）]/

const luceneHelp = [
  { title: '基础 (Terms)', content: '`hello` (单词), `"hello world"` (短语)' },
  { title: '字段搜索 (Field)', content: '`level:50` (错误), `level:30` (信息)' },
  { title: '通配符 (Wildcards)', content: '`te?t` (单字), `test*` (多字)' },
  { title: '范围 (Ranges)', content: '`age:[18 TO 30]` (闭区间)' },
  { title: '逻辑 (Boolean)', content: '`AND`, `OR`, `NOT` (需大写)' },
  { title: '组合', content: '`(a OR b) AND c`' },
]

const extensions = computed(() => {
  return getLuceneExtensions(props.fields || [], props.variables || [])
})

function validateLucene() {
  if (fullWidthChars.test(props.modelValue)) {
    syntaxError.value = '检测到非法中文字符，请使用英文标点。'
  }
  else {
    syntaxError.value = null
  }
}

watch(() => props.modelValue, () => {
  validateLucene()
})

function clearSql() {
  emit('update:modelValue', '')
}

defineExpose({
  validate: () => {
    validateLucene()
    return !syntaxError.value
  },
})
</script>

<template>
  <div
    class="flex flex-col border rounded-md overflow-hidden h-full min-h-[380px] font-mono text-sm shadow-inner group transition-colors duration-200 bg-white border-zinc-200"
    :class="[
      { 'min-h-[150px]': hideToolbar, 'border-red-900/50': syntaxError },
    ]"
  >
    <!-- Toolbar -->
    <div
      v-if="!hideToolbar"
      class="flex h-10 items-center justify-between border-b px-3 py-1 transition-colors bg-zinc-50 border-zinc-200"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 items-center gap-1.5 rounded-md border px-2 text-[10px] font-bold tracking-wider bg-white border-zinc-200 text-zinc-500"
        >
          <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LUCENE
        </div>
      </div>

      <div class="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Popover>
          <PopoverTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Lucene Syntax Help"
              class="h-7 w-7 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"
            >
              <HelpCircle class="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80 p-0 shadow-lg bg-white border-zinc-200" side="bottom" align="start">
            <div class="p-3 border-b text-xs font-semibold bg-emerald-50 border-zinc-200 text-zinc-800">
              Lucene 语法快速参考
            </div>
            <div class="p-2 grid gap-1.5">
              <div v-for="item in luceneHelp" :key="item.title" class="px-2 py-1.5 rounded-sm transition-colors hover:bg-zinc-50">
                <div class="text-[11px] font-medium text-emerald-500 mb-0.5">
                  {{ item.title }}
                </div>
                <div
                  class="text-[10px] text-zinc-600"
                  v-html="item.content.replace(/`([^`]+)`/g, `<code class='px-1 rounded font-mono bg-zinc-100 text-zinc-900'>$1</code>`)"
                />
              </div>
              <div class="mt-1 pt-2 border-t px-2 text-[10px] italic border-zinc-200 text-zinc-400">
                提示: 使用 <code v-pre class="text-emerald-600">{{ variable }}</code> 引用动态变量。
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Clear"
          class="h-7 w-7 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"
          @click="clearSql"
        >
          <Eraser class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- Variable Hints (Read-only) -->
    <div
      v-if="variables && variables.length > 0 && !hideToolbar"
      class="flex items-center gap-2 px-3 py-1.5 border-b overflow-x-auto no-scrollbar bg-zinc-50/50 border-zinc-200"
    >
      <span class="text-[10px] text-zinc-500 uppercase font-bold whitespace-nowrap">Variables:</span>
      <div class="flex gap-1.5">
        <span
          v-for="v in variables"
          :key="v.name"
          class="inline-flex items-center h-5 px-2 text-[10px] font-medium rounded border select-all cursor-default bg-white border-zinc-300 text-zinc-600 shadow-sm"
          :title="v.description || v.name"
        >
          {{ v.name }}
        </span>
      </div>
    </div>

    <!-- Editor -->
    <div class="relative flex-1 overflow-hidden min-h-[120px]">
      <CodeMirrorEditor
        ref="editorRef"
        :model-value="modelValue"
        :readonly="readonly"
        :extensions="extensions"
        :dark="false"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Error Overlay -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div v-if="syntaxError" class="absolute bottom-2 left-2 right-2 flex items-start gap-2 rounded border p-2 text-[11px] backdrop-blur-md shadow-xl z-50 transition-all duration-300 border-red-200 bg-red-50/95 text-red-700 shadow-red-200/20">
          <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <span class="leading-relaxed">{{ syntaxError }}</span>
        </div>
      </Transition>

      <div v-if="!modelValue && !readonly" class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 select-none">
        <div class="flex flex-col items-center gap-3">
          <HelpCircle class="h-10 w-10 text-zinc-200" />
          <p v-pre class="text-[11px] font-medium text-zinc-300">
            输入 Lucene 查询或使用 {{变量}}
          </p>
        </div>
      </div>
    </div>

    <!-- Footer Status -->
    <div v-if="!hideToolbar" class="flex h-6 items-center justify-between border-t px-2 text-[10px] transition-colors bg-zinc-50 border-zinc-200 text-zinc-500">
      <div class="flex items-center gap-3">
        <div v-if="syntaxError" class="flex items-center gap-1">
          <AlertCircle class="h-3 w-3 text-red-500/70" />
          <span class="text-red-500/80">Syntax Error</span>
        </div>
        <div v-else class="flex items-center gap-1">
          <CheckCircle2 class="h-3 w-3 text-emerald-500/70" />
          <span class="font-medium text-zinc-600">LUCENE</span>
        </div>
        <div v-if="variables?.length" class="flex items-center gap-1">
          <BracesIcon class="h-3 w-3 text-amber-500/70" />
          <span class="font-medium text-zinc-600">{{ variables.length }} Vars</span>
        </div>
      </div>
      <div class="opacity-60 italic text-zinc-400">
        Powered by CodeMirror 6
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
