<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

const props = defineProps<{
  initialValues?: any
  isEditing?: boolean
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9_]+$/, 'Slug must only contain lowercase letters, numbers, and underscores'),
    description: z.string().optional(),
  }),
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.initialValues?.name || '',
    slug: props.initialValues?.slug || '',
    description: props.initialValues?.description || '',
  },
})

watch(
  () => props.initialValues,
  (newVal) => {
    form.resetForm({
      values: {
        name: newVal?.name || '',
        slug: newVal?.slug || '',
        description: newVal?.description || '',
      },
    })
  },
  { deep: true },
)

const isSubmitting = ref(false)

function onInvalidSubmit({ errors }: any) {
  console.error('Validation errors:', errors)
  toast.error('Please check the form for errors')
}

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    if (props.isEditing) {
      await api.put(`/permissions/${props.initialValues.id}`, values)
      toast.success('Permission updated')
    }
    else {
      await api.post('/permissions', values)
      toast.success('Permission created')
    }
    emit('success')
  }
  catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to save permission')
  }
  finally {
    isSubmitting.value = false
  }
}, onInvalidSubmit)
</script>

<template>
  <form class="h-full flex flex-col overflow-hidden" novalidate @submit="onSubmit">
    <div class="flex-1 overflow-y-auto p-6 pt-0 space-y-6">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>{{ t('permissions.name') }}</FormLabel>
          <FormControl>
            <Input :placeholder="t('permissions.name')" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="slug">
        <FormItem>
          <FormLabel>{{ t('permissions.slug') }}</FormLabel>
          <FormControl>
            <Input placeholder="manage_users" v-bind="componentField" :disabled="isEditing" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="description">
        <FormItem>
          <FormLabel>{{ t('permissions.description') }}</FormLabel>
          <FormControl>
            <Textarea :placeholder="t('permissions.description')" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <div class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg">
      <Button type="button" variant="ghost" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </Button>
      <Button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('common.saving') : t('common.save') }}
      </Button>
    </div>
  </form>
</template>
