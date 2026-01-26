<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  password: string
}>()

const _strength = computed(() => {
  let score = 0
  const p = props.password

  if (!p)
    return 0

  if (p.length >= 8)
    score += 1
  if (p.length >= 12)
    score += 1
  if (/[A-Z]/.test(p))
    score += 1
  if (/[a-z]/.test(p))
    score += 1
  if (/\d/.test(p))
    score += 1
  if (/[^A-Z0-9]/i.test(p))
    score += 1

  return Math.min(score, 6) // Max score 6? Or separate checks.
})

// MLPS Level 3: 12 chars, Upper, Lower, Digit, Special.
// Let's refine the score to match requirements.
// 0: Empty
// 1: < 12 chars
// 2: >= 12 chars, but missing some types
// ...
// Actually, let's just count criteria met.
// Criteria:
// 1. Length >= 12
// 2. Has Uppercase
// 3. Has Lowercase
// 4. Has Number
// 5. Has Special

const criteria = computed(() => {
  const p = props.password
  return [
    { label: 'Length >= 12', met: p.length >= 12 },
    { label: 'Uppercase', met: /[A-Z]/.test(p) },
    { label: 'Lowercase', met: /[a-z]/.test(p) },
    { label: 'Number', met: /\d/.test(p) },
    { label: 'Special Char', met: /[^A-Z0-9]/i.test(p) },
  ]
})

const progress = computed(() => {
  const metCount = criteria.value.filter(c => c.met).length
  return (metCount / 5) * 100
})

const strengthLabel = computed(() => {
  const p = progress.value
  if (p === 0)
    return ''
  if (p < 40)
    return 'Weak'
  if (p < 80)
    return 'Medium'
  if (p < 100)
    return 'Strong'
  return 'Very Strong'
})

const colorClass = computed(() => {
  const p = progress.value
  if (p < 40)
    return 'bg-destructive'
  if (p < 80)
    return 'bg-yellow-500'
  if (p < 100)
    return 'bg-blue-500'
  return 'bg-green-500' // Using green for complete success
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex justify-between text-xs mb-1">
      <span class="text-muted-foreground">Strength</span>
      <span
        :class="
          cn(
            'font-medium',
            progress < 40
              ? 'text-destructive'
              : progress < 80
                ? 'text-yellow-500'
                : progress < 100
                  ? 'text-blue-500'
                  : 'text-green-500',
          )
        "
      >{{ strengthLabel }}</span>
    </div>

    <!-- Custom Progress Bar allowing color change -->
    <div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
      <div
        class="h-full transition-all duration-300 ease-in-out"
        :class="colorClass"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <ul class="text-xs space-y-1 mt-2">
      <li v-for="(c, index) in criteria" :key="index" class="flex items-center gap-2">
        <span v-if="c.met" class="text-green-500">✓</span>
        <span v-else class="text-muted-foreground">○</span>
        <span :class="c.met ? 'text-foreground' : 'text-muted-foreground'">{{ c.label }}</span>
      </li>
    </ul>
  </div>
</template>
