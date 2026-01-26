<script setup lang="ts">
import { Check, Copy, Plus, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
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
}

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
    toast.error('Failed to fetch API keys')
  }
  finally {
    loading.value = false
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
    toast.success('API Key created successfully')
  }
  catch {
    toast.error('Failed to create API key')
  }
  finally {
    creating.value = false
  }
}

async function revokeKey(id: number) {
  if (
    // eslint-disable-next-line no-alert
    !confirm(
      'Are you sure you want to revoke this key? Any scripts using it will stop working immediately.',
    )
  ) {
    return
  }

  try {
    await api.delete(`/auth/keys/${id}`)
    toast.success('API Key revoked')
    fetchKeys()
  }
  catch {
    toast.error('Failed to revoke key')
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
    toast.success('Token copied to clipboard')
  }
  catch {
    toast.error('Failed to copy')
  }
}

onMounted(fetchKeys)
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium">
          API Keys
        </h3>
        <p class="text-sm text-muted-foreground">
          Manage personal access tokens for external integrations.
        </p>
      </div>
      <Button @click="dialogOpen = true">
        <Plus class="mr-2 h-4 w-4" />
        Generate New Key
      </Button>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead class="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="keys.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">
              No API keys found.
            </TableCell>
          </TableRow>
          <TableRow v-for="key in keys" :key="key.id">
            <TableCell class="font-medium">
              {{ key.name }}
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="bg-green-500/10 text-green-600 border-green-200">
                Active
              </Badge>
            </TableCell>
            <TableCell>{{ new Date(key.createdAt).toLocaleDateString() }}</TableCell>
            <TableCell>
              {{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never' }}
            </TableCell>
            <TableCell class="text-right">
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive hover:bg-destructive/10"
                @click="revokeKey(key.id)"
              >
                <Trash2 class="h-4 w-4" />
                <span class="sr-only">Revoke</span>
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
          <DialogTitle>Generate New API Key</DialogTitle>
          <DialogDescription>
            Give your key a name to identify it later (e.g., "CICD Pipeline", "Reporting Script").
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <Input id="name" v-model="newKeyName" placeholder="Key Name" @keyup.enter="createKey" />

          <div class="grid gap-2">
            <Label for="expiration">Expiration</Label>
            <Select v-model="expiration">
              <SelectTrigger>
                <SelectValue placeholder="Select validity period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">
                  30 Days
                </SelectItem>
                <SelectItem value="90d">
                  90 Days
                </SelectItem>
                <SelectItem value="180d">
                  180 Days (6 Months)
                </SelectItem>
                <SelectItem value="365d">
                  365 Days (1 Year)
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[0.8rem] text-muted-foreground">
              Keys will automatically stop working after expiration.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!newKeyName || creating" @click="createKey">
            {{ creating ? 'Generating...' : 'Generate Key' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Success Token Dialog -->
    <Dialog v-model:open="tokenDialogOpen">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Key Generated</DialogTitle>
          <DialogDescription class="text-destructive font-semibold">
            Make sure to copy your API key now. You won't be able to see it again!
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
              {{ copied ? 'Copied' : 'Copy' }}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button @click="tokenDialogOpen = false">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
