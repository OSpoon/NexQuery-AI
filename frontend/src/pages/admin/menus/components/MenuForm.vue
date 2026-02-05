<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'

const props = defineProps<{
  initialValues?: any
  isEditing?: boolean
  allMenus: any[]
}>()

const emit = defineEmits(['success', 'cancel'])

const formSchema = toTypedSchema(
  z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    path: z.string().min(1, 'Path is required'),
    icon: z.string().optional(),
    permission: z.string().optional(),
    component: z.string().optional(),
    parentId: z.union([z.number(), z.null()]).optional(),
    sortOrder: z.coerce.number().default(0),

    isActive: z.union([z.boolean(), z.number().transform(n => !!n)]).default(true),
  }),
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    title: props.initialValues?.title || '',
    path: props.initialValues?.path || '',
    icon: props.initialValues?.icon || '',
    permission: props.initialValues?.permission || '',
    component: props.initialValues?.component || '',
    parentId: props.initialValues?.parentId ?? null,

    sortOrder: props.initialValues?.sortOrder || 0,
    isActive: !!(props.initialValues?.isActive ?? true),
  },
})

watch(
  () => props.initialValues,
  (newVal) => {
    form.resetForm({
      values: {
        title: newVal?.title || '',
        path: newVal?.path || '',
        icon: newVal?.icon || '',
        permission: newVal?.permission || '',
        component: newVal?.component || '',
        parentId: newVal?.parentId ?? null,
        sortOrder: newVal?.sortOrder || 0,
        isActive: !!(newVal?.isActive ?? true),
      },
    })
  },
  { deep: true },
)

// Filter out itself from parent options to avoid cycles (basic check)
const parentOptions = computed(() => {
  return props.allMenus.filter(m => !props.isEditing || m.id !== props.initialValues.id)
})

const isSubmitting = ref(false)

function onInvalidSubmit({ errors }: any) {
  console.error('Validation errors:', errors)
  toast.error('Please check the form for errors')
}

const availablePermissions = ref<any[]>([])

async function fetchPermissions() {
  try {
    const response = await api.get('/permissions')
    availablePermissions.value = response.data
  }
  catch (e) {
    console.error('Failed to fetch permissions', e)
  }
}

onMounted(fetchPermissions)

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  // Handle empty strings as null for optional fields if needed by backend
  const payload = { ...values }

  // Clean up empty strings for optional fields
  if (!payload.permission)
    payload.permission = undefined
  if (!payload.component)
    payload.component = undefined
  if (!payload.icon)
    payload.icon = undefined

  try {
    if (props.isEditing) {
      await api.put(`/menus/${props.initialValues.id}`, payload)
      toast.success('Menu updated')
    }
    else {
      await api.post('/menus', payload)
      toast.success('Menu created')
    }
    emit('success')
  }
  catch {
    toast.error('Failed to save menu')
  }
  finally {
    isSubmitting.value = false
  }
}, onInvalidSubmit)
</script>

<template>
  <form class="h-full flex flex-col overflow-hidden" novalidate @submit="onSubmit">
    <!-- Middle: Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 pt-0 space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2">
          <FormField v-slot="{ componentField }" name="title" :validate-on-blur="false">
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Dashboard" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <div class="col-span-1">
          <FormField v-slot="{ componentField }" name="path" :validate-on-blur="false">
            <FormItem>
              <FormLabel>Path</FormLabel>
              <FormControl>
                <Input placeholder="/dashboard" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2">
          <FormField v-slot="{ componentField }" name="icon" :validate-on-blur="false">
            <FormItem>
              <FormLabel>Icon (Lucide Name)</FormLabel>
              <FormControl>
                <Input placeholder="LayoutDashboard" v-bind="componentField" />
              </FormControl>
              <FormDescription class="text-xs">
                e.g. Users, Database, Settings
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <div class="col-span-1">
          <FormField v-slot="{ componentField }" name="sortOrder" :validate-on-blur="false">
            <FormItem>
              <FormLabel>Sort Order</FormLabel>
              <FormControl>
                <Input type="number" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>

      <FormField v-slot="{ value, handleChange }" name="permission" :validate-on-blur="false">
        <FormItem>
          <FormLabel>Required Permission (Optional)</FormLabel>
          <Select
            :model-value="value || 'none'"
            @update:model-value="(v) => handleChange(v === 'none' ? undefined : v)"
          >
            <FormControl>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a permission" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="none">
                None (Public)
              </SelectItem>
              <SelectItem v-for="p in availablePermissions" :key="p.id" :value="p.slug">
                {{ p.name }} ({{ p.slug }})
              </SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="component" :validate-on-blur="false">
        <FormItem>
          <FormLabel>Component Path (e.g. @/pages/dashboard/home.vue)</FormLabel>
          <FormControl>
            <Input placeholder="@/pages/data-sources/index.vue" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ value, handleChange }" name="parentId" :validate-on-blur="false">
        <FormItem>
          <FormLabel>Parent Menu</FormLabel>
          <Select
            :model-value="value?.toString() ?? 'null'"
            @update:model-value="(v) => handleChange(v === 'null' ? null : Number(v))"
          >
            <FormControl>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a parent (optional)" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="null">
                None (Top Level)
              </SelectItem>
              <SelectItem v-for="menu in parentOptions" :key="menu.id" :value="String(menu.id)">
                {{ menu.title }}
              </SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ value, handleChange }" name="isActive" :validate-on-blur="false">
        <FormItem class="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
          <FormControl>
            <Checkbox id="is-active" :model-value="!!value" @update:model-value="handleChange" />
          </FormControl>
          <div class="space-y-1 leading-none">
            <FormLabel for="is-active">
              Active
            </FormLabel>
            <FormDescription> Visible in sidebar </FormDescription>
          </div>
        </FormItem>
      </FormField>
    </div>

    <!-- Fixed Footer -->
    <div class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg">
      <Button type="button" variant="ghost" @click="emit('cancel')">
        Cancel
      </Button>
      <Button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Menu' }}
      </Button>
    </div>
  </form>
</template>
