<script setup lang="ts">
import type { Role } from '@nexquery/shared'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'

const props = defineProps<{
  initialValues?: Role
  isEditing?: boolean
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()
const permissions = ref<any[]>([])

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().optional(),
    permissionIds: z.array(z.number()).default([]),
  }),
)

function getInitialPermissionIds() {
  return (
    props.initialValues?.permissions
      ?.map((p: any) => (typeof p === 'object' ? Number(p.id) : Number(p)))
      .filter((id: number) => !Number.isNaN(id)) || []
  )
}

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.initialValues?.name || '',
    slug: props.initialValues?.slug || '',
    description: props.initialValues?.description || '',
    permissionIds: getInitialPermissionIds(),
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
        permissionIds:
          newVal?.permissions
            ?.map((p: any) => (typeof p === 'object' ? Number(p.id) : Number(p)))
            .filter((id: number) => !Number.isNaN(id)) || [],
      },
    })
  },
  { deep: true },
)

async function fetchPermissions() {
  try {
    const response = await api.get('/permissions')
    permissions.value = response.data.map((p: any) => ({ ...p, id: Number(p.id) }))
  }
  catch {
    toast.error('Failed to fetch permissions')
  }
}

const isSubmitting = ref(false)

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    if (props.isEditing) {
      await api.put(`/roles/${props.initialValues?.id}`, values)
      toast.success('Role updated')
    }
    else {
      await api.post('/roles', values)
      toast.success('Role created')
    }
    emit('success')
  }
  catch {
    toast.error('Failed to save role')
  }
  finally {
    isSubmitting.value = false
  }
})

function togglePermission(id: number, checked: boolean) {
  const currentIds = [...(form.values.permissionIds || [])]
  if (checked) {
    if (!currentIds.includes(id)) {
      form.setFieldValue('permissionIds', [...currentIds, id])
    }
  }
  else {
    form.setFieldValue(
      'permissionIds',
      currentIds.filter(i => i !== id),
    )
  }
}

onMounted(fetchPermissions)
</script>

<template>
  <form class="h-full flex flex-col overflow-hidden" novalidate @submit="onSubmit">
    <!-- Middle: Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 pt-0 space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2">
          <FormField v-slot="{ componentField }" name="name" :validate-on-blur="false">
            <FormItem>
              <FormLabel>{{ t('roles.role_name') }}</FormLabel>
              <FormControl>
                <Input placeholder="Editor" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <div class="col-span-1">
          <FormField v-slot="{ componentField }" name="slug" :validate-on-blur="false">
            <FormItem>
              <FormLabel>{{ t('roles.slug') }}</FormLabel>
              <FormControl>
                <Input placeholder="editor" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>

      <FormField v-slot="{ componentField }" name="description" :validate-on-blur="false">
        <FormItem>
          <FormLabel>{{ t('roles.description') }}</FormLabel>
          <FormControl>
            <Input :placeholder="t('roles.can_edit_desc')" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <div class="space-y-2">
        <Label>{{ t('roles.permissions') }}</Label>
        <div class="grid grid-cols-2 gap-3 border rounded-md p-4 bg-muted/20">
          <div v-for="p in permissions" :key="p.id" class="flex items-center space-x-2">
            <Checkbox
              :id="`p-${p.id}`"
              :model-value="!!form.values.permissionIds?.includes(p.id)"
              @update:model-value="(checked) => togglePermission(p.id, !!checked)"
            />
            <Label
              :for="`p-${p.id}`"
              class="text-sm font-medium leading-none cursor-pointer select-none"
            >
              {{ p.name }}
            </Label>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Footer -->
    <div class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg">
      <Button type="button" variant="ghost" @click="emit('cancel')">
        {{
          t('common.cancel')
        }}
      </Button>
      <Button type="submit" :disabled="isSubmitting">
        {{
          isSubmitting
            ? t('common.loading')
            : isEditing
              ? t('roles.save_role')
              : t('roles.create_role')
        }}
      </Button>
    </div>
  </form>
</template>
