<script setup lang="ts">
import {
  CalendarDate,
} from '@internationalized/date'
import { Calendar as CalendarIcon, Clock } from 'lucide-vue-next'
import { DateTime } from 'luxon'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | null
  timezone?: string
  placeholder?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  timezone: 'UTC',
  placeholder: 'Select date and time',
})

const emit = defineEmits(['update:modelValue'])

// Internal state using Luxon
const internalDate = ref<DateTime>(
  props.modelValue
    ? DateTime.fromISO(props.modelValue).setZone(props.timezone)
    : DateTime.now().setZone(props.timezone).startOf('minute'),
)

// Synchronize with external value
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      const dt = DateTime.fromISO(newVal).setZone(props.timezone)
      if (!dt.equals(internalDate.value)) {
        internalDate.value = dt
      }
    }
  },
)

// Convert Luxon DateTime to @internationalized/date DateValue for the Calendar component
const selectedDate = computed({
  get: () => {
    // Calendar expects a DateValue object
    const year = internalDate.value.year
    const month = internalDate.value.month
    const day = internalDate.value.day
    return new CalendarDate(year, month, day) as any
  },
  set: (val: any) => {
    if (!val)
      return

    // Calendar gives back a DateValue object
    internalDate.value = internalDate.value.set({
      year: val.year,
      month: val.month,
      day: val.day,
      hour: internalDate.value.hour,
      minute: internalDate.value.minute,
      second: 0,
      millisecond: 0,
    })
    emitUpdate()
  },
})

const hour = computed({
  get: () => internalDate.value.hour.toString().padStart(2, '0'),
  set: (val: string) => {
    internalDate.value = internalDate.value.set({ hour: Number.parseInt(val) })
    emitUpdate()
  },
})

const minute = computed({
  get: () => internalDate.value.minute.toString().padStart(2, '0'),
  set: (val: string) => {
    internalDate.value = internalDate.value.set({ minute: Number.parseInt(val) })
    emitUpdate()
  },
})

function emitUpdate() {
  emit('update:modelValue', internalDate.value.toUTC().toISO())
}

const displayText = computed(() => {
  if (!props.modelValue)
    return props.placeholder
  return internalDate.value.toFormat('yyyy/MM/dd HH:mm')
})

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const allMinutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        :class="
          cn(
            'w-full justify-start text-left font-normal h-9 px-3 hover:bg-muted/50 transition-colors',
            !modelValue && 'text-muted-foreground',
            props.class,
          )
        "
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ displayText }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar v-model="selectedDate" initial-focus />
      <div class="p-3 border-t flex flex-col gap-3 bg-muted/20">
        <div class="flex items-center gap-3 justify-center">
          <Clock class="h-4 w-4 text-muted-foreground" />
          <div class="flex items-center gap-1.5">
            <Select v-model="hour">
              <SelectTrigger class="w-[70px] h-8 text-sm focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="h in hours" :key="h" :value="h">
                  {{ h }}
                </SelectItem>
              </SelectContent>
            </Select>
            <span class="text-muted-foreground font-medium">:</span>
            <Select v-model="minute">
              <SelectTrigger class="w-[70px] h-8 text-sm focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in allMinutes" :key="m" :value="m">
                  {{ m }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
