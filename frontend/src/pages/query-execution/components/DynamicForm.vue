<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Loader2, Play } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed } from 'vue'
import * as z from 'zod'
import LuceneEditor from '@/components/shared/LuceneEditor.vue'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  schema: any[]
  isExecuting: boolean
}>()

const emit = defineEmits(['execute'])

// Dynamically build Zod schema based on JSON schema
const dynamicZodSchema = computed(() => {
  const shape: any = {}
  props.schema.forEach((field) => {
    let validator: z.ZodTypeAny = z.any()
    if (field.type === 'number') {
      validator = z.number()
    }
    else if (field.required) {
      validator = z.string().min(1, `${field.label} is required`)
    }
    else {
      validator = z.string().optional().or(z.literal(''))
    }
    shape[field.name] = validator
  })
  return toTypedSchema(z.object(shape))
})

const { handleSubmit, setFieldValue } = useForm({
  validationSchema: dynamicZodSchema,
  initialValues: props.schema.reduce((acc: any, field) => {
    if (field.defaultValue !== undefined) {
      acc[field.name] = field.defaultValue
    }
    return acc
  }, {}),
})

const onSubmit = handleSubmit((values) => {
  emit('execute', values)
})
</script>

<template>
  <form class="space-y-6" @submit="onSubmit">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
      <div v-for="field in schema" :key="field.name">
        <FormField v-slot="{ componentField }" :name="field.name" :validate-on-blur="false">
          <FormItem>
            <FormLabel>{{ field.label }}</FormLabel>
            <FormControl>
              <template v-if="field.type === 'select'">
                <Select
                  v-bind="componentField"
                  @update:model-value="(v) => setFieldValue(field.name, v)"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="field.placeholder || 'Select...'" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem v-for="opt in field.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </template>
              <template v-else-if="field.type === 'lucene'">
                <div class="border rounded-md min-h-[100px] flex flex-col">
                  <LuceneEditor
                    :model-value="componentField.modelValue"
                    hide-toolbar
                    class="flex-1"
                    @update:model-value="(v) => setFieldValue(field.name, v)"
                  />
                </div>
              </template>
              <template v-else>
                <Input
                  :type="field.type || 'text'"
                  :placeholder="field.placeholder"
                  v-bind="componentField"
                  @input="
                    field.type === 'number'
                      ? setFieldValue(field.name, parseInt($event.target.value))
                      : null
                  "
                />
              </template>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </div>

    <div class="flex justify-start pt-2" :class="{ 'mt-0': schema.length === 0 }">
      <Button
        type="submit"
        class="w-full md:w-auto px-8"
        :disabled="isExecuting"
      >
        <template v-if="isExecuting">
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Running...
        </template>
        <template v-else>
          <Play class="mr-2 h-4 w-4" />
          Execute
        </template>
      </Button>
    </div>
  </form>
</template>
