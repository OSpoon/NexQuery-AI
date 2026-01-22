<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Plus, Trash2, Code2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SqlEditor from './SqlEditor.vue'

const props = defineProps<{
  modelValue: string
  variables?: Array<{ name: string; description?: string }>
}>()

const emit = defineEmits(['update:modelValue'])

const method = ref('GET')
const url = ref('')
const headers = ref<Array<{ key: string; value: string }>>([])
const body = ref('')

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

// Initialize from existing curl command if possible
onMounted(() => {
  if (props.modelValue) {
    parseCurl(props.modelValue)
  }
})

const parseCurl = (curl: string) => {
  try {
    // Very basic curl parser
    const methodMatch = curl.match(/-X\s+(\w+)/) || curl.match(/--request\s+(\w+)/)
    if (methodMatch && methodMatch[1]) method.value = methodMatch[1].toUpperCase()
    else if (curl.includes('--data') || curl.includes('-d ')) method.value = 'POST'
    else method.value = 'GET'

    const urlMatch =
      curl.match(/'(.*?)'/) || curl.match(/"(.*?)"/) || curl.match(/curl\s+(https?:\/\/\S+)/)
    if (urlMatch && urlMatch[1]) url.value = urlMatch[1]

    const headerMatches = curl.matchAll(/-H\s+['"](.*?): (.*?)['"]/g)
    headers.value = Array.from(headerMatches).map((m) => ({
      key: m[1] || '',
      value: m[2] || '',
    }))

    const bodyMatch = curl.match(/-d\s+['"](.*?)['"]/) || curl.match(/--data\s+['"](.*?)['"]/)
    if (bodyMatch && bodyMatch[1]) body.value = bodyMatch[1]
  } catch (e) {
    console.error('Failed to parse existing curl:', e)
    url.value = curl // Fallback
  }
}

const generateCurl = () => {
  let cmd = `curl -X ${method.value} '${url.value}'`

  headers.value.forEach((h) => {
    if (h.key && h.value) {
      cmd += ` -H '${h.key}: ${h.value}'`
    }
  })

  if (['POST', 'PUT', 'PATCH'].includes(method.value) && body.value) {
    cmd += ` -d '${body.value}'`
  }

  return cmd
}

watch(
  [method, url, headers, body],
  () => {
    emit('update:modelValue', generateCurl())
  },
  { deep: true },
)

const addHeader = () => {
  headers.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  headers.value.splice(index, 1)
}
</script>

<template>
  <div class="space-y-4 border rounded-md p-4 bg-background/50">
    <div class="grid grid-cols-6 gap-2">
      <div class="col-span-1">
        <Label class="text-xs mb-1 block">Method</Label>
        <Select v-model="method">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m in methods" :key="m" :value="m">{{ m }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="col-span-5">
        <Label class="text-xs mb-1 block">URL</Label>
        <Input v-model="url" placeholder="https://api.example.com/v1/users" />
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label class="text-xs">Headers</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-[10px]"
          @click="addHeader"
        >
          <Plus class="w-3 h-3 mr-1" /> Add Header
        </Button>
      </div>
      <div v-for="(h, i) in headers" :key="i" class="flex gap-2 items-center">
        <Input v-model="h.key" placeholder="Key" class="h-8 text-sm" />
        <Input v-model="h.value" placeholder="Value" class="h-8 text-sm" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-destructive"
          @click="removeHeader(i)"
        >
          <Trash2 class="w-4 h-4" />
        </Button>
      </div>
      <p v-if="headers.length === 0" class="text-[10px] text-muted-foreground italic">
        No custom headers
      </p>
    </div>

    <div class="space-y-2" v-if="['POST', 'PUT', 'PATCH'].includes(method)">
      <Label class="text-xs">Body (JSON/Raw)</Label>
      <div class="h-40 border rounded-md overflow-hidden">
        <SqlEditor v-model="body" language="json" :variables="variables" />
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-xs flex items-center gap-1">
        <Code2 class="w-3 h-3" /> cURL Preview
      </Label>
      <pre
        class="bg-muted p-2 rounded text-[10px] whitespace-pre-wrap break-all font-mono border"
        >{{ generateCurl() }}</pre
      >
    </div>
  </div>
</template>
