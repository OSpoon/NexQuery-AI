<script setup lang="ts">
import { diffWordsWithSpace } from 'diff'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  expected: string
  actual: string
  disabled?: boolean
}>()

const { t } = useI18n()

const diff = computed(() => {
  if (props.disabled) {
    return [
      { value: props.expected, removed: false, added: false },
      { value: props.actual, removed: false, added: false },
    ]
  }
  return diffWordsWithSpace(props.expected || '', props.actual || '')
})

const expectedParts = computed(() => {
  if (props.disabled)
    return [{ value: props.expected, removed: false }]
  return diff.value.filter(p => !p.added)
})

const actualParts = computed(() => {
  if (props.disabled)
    return [{ value: props.actual, added: false }]
  return diff.value.filter(p => !p.removed)
})
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <!-- Expected SQL Block -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <label class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
          {{ t('eval.spider.diff.expected') }}
        </label>
      </div>
      <div class="relative group">
        <div
          class="p-3 rounded border bg-zinc-50 dark:bg-zinc-900/50 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap min-h-[80px] border-l-4 border-l-emerald-500"
        >
          <template v-for="(part, idx) in expectedParts" :key="idx">
            <span
              :class="[
                part.removed ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-sm ring-1 ring-red-200/50 dark:ring-red-800/50' : 'text-zinc-600 dark:text-zinc-400',
              ]"
            >{{ part.value }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- Actual SQL Block -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <label class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
          {{ t('eval.spider.diff.actual') }}
        </label>
      </div>
      <div class="relative group">
        <div
          class="p-3 rounded border font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap min-h-[80px] border-l-4"
          :class="[
            (actual === expected || disabled) ? 'bg-zinc-50 dark:bg-zinc-900/50 border-l-emerald-500' : 'bg-zinc-50 dark:bg-zinc-900/50 border-l-red-500',
          ]"
        >
          <template v-for="(part, idx) in actualParts" :key="idx">
            <span
              :class="[
                part.added ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-sm ring-1 ring-emerald-200/50 dark:ring-emerald-800/50' : 'text-zinc-600 dark:text-zinc-400',
              ]"
            >{{ part.value || t('eval.spider.diff.no_sql') }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
