<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { User } from '@nexquery/shared'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  user: User
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()
const roles = ref<any[]>([])

const formSchema = toTypedSchema(
  z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    roleIds: z.array(z.number()).default([]),
    isActive: z.boolean().default(true),
  }),
)

const getInitialRoleIds = () => {
  return (
    props.user?.roles
      ?.map((r: any) => (typeof r === 'object' ? Number(r.id) : Number(r)))
      .filter((id: number) => !isNaN(id)) || []
  )
}

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    fullName: props.user?.fullName || '',
    email: props.user?.email || '',
    roleIds: getInitialRoleIds(),
    isActive: !!props.user?.isActive,
  },
})

watch(
  () => props.user,
  (newVal) => {
    form.resetForm({
      values: {
        fullName: newVal?.fullName || '',
        email: newVal?.email || '',
        roleIds:
          newVal?.roles
            ?.map((r: any) => (typeof r === 'object' ? Number(r.id) : Number(r)))
            .filter((id: number) => !isNaN(id)) || [],
        isActive: !!newVal?.isActive,
      },
    })
  },
  { deep: true },
)

const fetchRoles = async () => {
  try {
    const response = await api.get('/roles')
    roles.value = response.data.map((r: any) => ({ ...r, id: Number(r.id) }))
  } catch (error) {
    toast.error('Failed to fetch roles')
  }
}

const isSubmitting = ref(false)

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    await api.put(`/users/${props.user.id}`, values)
    toast.success('User updated')
    emit('success')
  } catch (error: any) {
    toast.error('Failed to update user: ' + (error.response?.data?.message || error.message))
  } finally {
    isSubmitting.value = false
  }
})

const toggleRole = (id: number, checked: boolean) => {
  const currentIds = [...(form.values.roleIds || [])]
  if (checked) {
    if (!currentIds.includes(id)) {
      form.setFieldValue('roleIds', [...currentIds, id])
    }
  } else {
    form.setFieldValue(
      'roleIds',
      currentIds.filter((i) => i !== id),
    )
  }
}

onMounted(fetchRoles)
</script>

<template>
  <form @submit="onSubmit" class="h-full flex flex-col overflow-hidden" novalidate>
    <!-- Middle: Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 pt-0 space-y-6">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-1">
          <FormField v-slot="{ componentField }" name="fullName" :validate-on-blur="false">
            <FormItem>
              <FormLabel>{{ t('users.full_name') }}</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <div class="col-span-1">
          <FormField v-slot="{ componentField }" name="email" :validate-on-blur="false">
            <FormItem>
              <FormLabel>{{ t('users.email') }}</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>

      <div class="space-y-4 border rounded-md p-4 bg-muted/10">
        <FormField v-slot="{ value, handleChange }" name="isActive" :validate-on-blur="false">
          <FormItem class="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox :model-value="!!value" @update:model-value="handleChange" />
            </FormControl>
            <div class="space-y-1 leading-none">
              <FormLabel class="cursor-pointer">{{ t('users.enabled') }}</FormLabel>
              <p class="text-xs text-muted-foreground">
                {{ t('users.disabled_desc') }}
              </p>
            </div>
          </FormItem>
        </FormField>
      </div>

      <div class="space-y-2">
        <Label>{{ t('users.roles') }}</Label>
        <div class="flex flex-wrap gap-3 border rounded-md p-4 bg-muted/20">
          <div v-for="r in roles" :key="r.id" class="flex items-center space-x-2">
            <Checkbox
              :id="'role-' + r.id"
              :model-value="!!form.values.roleIds?.includes(r.id)"
              @update:model-value="(checked) => toggleRole(r.id, !!checked)"
            />
            <Label
              :for="'role-' + r.id"
              class="text-sm font-medium leading-none cursor-pointer select-none"
            >
              {{ r.name }}
            </Label>
          </div>
        </div>
      </div>
    </div>

    <div class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg">
      <Button type="button" variant="ghost" @click="emit('cancel')">{{
        t('common.cancel')
      }}</Button>
      <Button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('common.loading') : t('users.save_changes') }}
      </Button>
    </div>
  </form>
</template>
