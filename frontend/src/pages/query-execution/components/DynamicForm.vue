<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Play } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, watch } from 'vue'
import * as z from 'zod'
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
  approvalStatus?: 'idle' | 'pending' | 'approved' | 'rejected'
}>()

const emit = defineEmits(['execute', 'change'])

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

const { handleSubmit, setFieldValue, values } = useForm({
  validationSchema: dynamicZodSchema,
})
watch(values, () => {
  emit('change') // Signal that the user modified the form
}, { deep: true })

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
                  <SelectTrigger>
                    <SelectValue :placeholder="field.placeholder || 'Select...'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in field.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
        :disabled="isExecuting || approvalStatus === 'pending' || approvalStatus === 'rejected'"
        :variant="approvalStatus === 'rejected' ? 'destructive' : 'default'"
      >
        <template v-if="isExecuting">
          <Play class="mr-2 h-4 w-4 animate-spin" />
          Running...
        </template>
        <template v-else-if="approvalStatus === 'pending'">
          <Play class="mr-2 h-4 w-4 opacity-50" />
          Approval Pending
        </template>
        <template v-else-if="approvalStatus === 'rejected'">
          Request Rejected
        </template>
        <template v-else>
          <Play class="mr-2 h-4 w-4" />
          Execute {{ approvalStatus === 'approved' ? '(Approved)' : '' }}
        </template>
      </Button>
    </div>
  </form>
</template>
