<script setup lang="ts">
import { Check, Copy, Plus, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import Badge from '@/components/ui/badge/Badge.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import api from '@/lib/api'

interface ApiKey {
  id: number
  name: string
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
  token?: string | null
}

const { t } = useI18n()
const keys = ref<ApiKey[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const newKeyName = ref('')
const creating = ref(false)

// Token Display Dialog
const tokenDialogOpen = ref(false)
const createdToken = ref('')
const copied = ref(false)

async function fetchKeys() {
  loading.value = true
  try {
    const { data } = await api.get('/auth/keys')
    keys.value = data
  }
  catch {
    toast.error(t('api_keys.fetch_failed'))
  }
  finally {
    loading.value = false
  }
}

async function copyTokenValue(val: string) {
  try {
    await navigator.clipboard.writeText(val)
    toast.success(t('api_keys.copy_success'))
  }
  catch {
    toast.error(t('api_keys.copy_failed'))
  }
}

const expiration = ref('90d')

async function createKey() {
  if (!newKeyName.value.trim())
    return

  creating.value = true
  try {
    const { data } = await api.post('/auth/keys', {
      name: newKeyName.value,
      expiresIn: expiration.value,
    })
    createdToken.value = data.token
    tokenDialogOpen.value = true
    dialogOpen.value = false
    newKeyName.value = ''
    // Reset default
    expiration.value = '90d'
    fetchKeys()
    toast.success(t('api_keys.create_success'))
  }
  catch {
    toast.error(t('api_keys.create_failed'))
  }
  finally {
    creating.value = false
  }
}

async function revokeKey(id: number) {
  if (
    // eslint-disable-next-line no-alert
    !confirm(t('api_keys.revoke_confirm'))
  ) {
    return
  }

  try {
    await api.delete(`/auth/keys/${id}`)
    toast.success(t('api_keys.revoke_success'))
    fetchKeys()
  }
  catch {
    toast.error(t('api_keys.revoke_failed'))
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
    toast.success(t('api_keys.copy_success'))
  }
  catch {
    toast.error(t('api_keys.copy_failed'))
  }
}

onMounted(fetchKeys)
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium">
          {{ t('api_keys.keys_card_title') }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t('api_keys.keys_card_desc') }}
        </p>
      </div>
      <Button @click="dialogOpen = true">
        <Plus class="mr-2 h-4 w-4" />
        {{ t('api_keys.generate_new') }}
      </Button>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('data_sources.name') }}</TableHead>
            <TableHead>{{ t('users.status') }}</TableHead>
            <TableHead>{{ t('query_tasks.created_at') }}</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead class="text-right">
              {{ t('common.actions') }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="keys.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">
              {{ t('api_keys.no_keys') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="key in keys" :key="key.id">
            <TableCell class="font-medium">
              {{ key.name }}
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="bg-green-500/10 text-green-600 border-green-200">
                {{ t('users.active') }}
              </Badge>
            </TableCell>
            <TableCell>{{ new Date(key.createdAt).toLocaleDateString() }}</TableCell>
            <TableCell>
              {{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : t('profile.never') || 'Never' }}
            </TableCell>
            <TableCell class="text-right">
              <Button
                v-if="key.token"
                variant="ghost"
                size="sm"
                class="mr-1 text-muted-foreground hover:text-primary"
                @click="copyTokenValue(key.token)"
              >
                <Copy class="h-4 w-4" />
                <span class="sr-only">Copy</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive hover:bg-destructive/10"
                @click="revokeKey(key.id)"
              >
                <Trash2 class="h-4 w-4" />
                <span class="sr-only">{{ t('api_keys.revoke') }}</span>
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Create Dialog -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{{ t('api_keys.dialog_create_title') }}</DialogTitle>
          <DialogDescription>
            {{ t('api_keys.dialog_create_desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <Input id="name" v-model="newKeyName" :placeholder="t('api_keys.key_name_placeholder')" @keyup.enter="createKey" />

          <div class="grid gap-2">
            <Label for="expiration">{{ t('api_keys.expiration') }}</Label>
            <Select v-model="expiration">
              <SelectTrigger class="w-full">
                <SelectValue :placeholder="t('api_keys.select_validity')" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="30d">
                  {{ t('api_keys.days', { count: 30 }) }}
                </SelectItem>
                <SelectItem value="90d">
                  {{ t('api_keys.days', { count: 90 }) }}
                </SelectItem>
                <SelectItem value="180d">
                  {{ t('api_keys.days', { count: 180 }) }}
                </SelectItem>
                <SelectItem value="365d">
                  {{ t('api_keys.days', { count: 365 }) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[0.8rem] text-muted-foreground">
              {{ t('api_keys.expiration_hint') }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            {{ t('common.cancel') }}
          </Button>
          <Button type="submit" :disabled="!newKeyName || creating" @click="createKey">
            {{ creating ? t('api_keys.generating') : t('api_keys.generate_new') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Success Token Dialog -->
    <Dialog v-model:open="tokenDialogOpen">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{{ t('api_keys.dialog_token_title') }}</DialogTitle>
          <DialogDescription class="text-destructive font-semibold">
            {{ t('api_keys.dialog_token_desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <div class="relative">
            <div
              class="min-h-[100px] w-full rounded-md border bg-muted p-4 font-mono text-sm break-all"
            >
              {{ createdToken }}
            </div>
            <Button
              size="sm"
              variant="secondary"
              class="absolute top-2 right-2 h-8"
              @click="copyToken"
            >
              <Check v-if="copied" class="h-4 w-4 mr-1 text-green-600" />
              <Copy v-else class="h-4 w-4 mr-1" />
              {{ copied ? t('api_keys.copied') : t('api_keys.copy') }}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button @click="tokenDialogOpen = false">
            {{ t('api_keys.done') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
