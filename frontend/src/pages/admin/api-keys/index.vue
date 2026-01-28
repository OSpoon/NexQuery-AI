<script setup lang="ts">
import { Terminal } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiKeysManager from '@/components/profile/ApiKeysManager.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const baseUrl = ref('http://localhost:3008')
const { t } = useI18n()
</script>

<template>
  <div class="p-6 space-y-6 max-w-6xl mx-auto">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('api_keys.title') }}
      </h1>
      <p class="text-muted-foreground">
        {{ t('api_keys.desc') }}
      </p>
    </div>

    <!-- Management Section -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('api_keys.keys_card_title') }}</CardTitle>
        <CardDescription>
          {{ t('api_keys.keys_card_desc') }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApiKeysManager />
      </CardContent>
    </Card>

    <!-- Documentation Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold tracking-tight">
          {{ t('api_keys.doc_title') }}
        </h2>
        <div class="flex items-center gap-2">
          <Label for="base-url">{{ t('api_keys.base_url') }}:</Label>
          <Input id="base-url" v-model="baseUrl" class="w-64 h-8" />
        </div>
      </div>

      <Alert>
        <Terminal class="h-4 w-4" />
        <AlertTitle>{{ t('api_keys.auth_title') }}</AlertTitle>
        <AlertDescription>
          {{ t('api_keys.auth_desc', { header: 'Authorization' }) }}
          <pre class="mt-2 text-xs bg-muted p-2 rounded">
Authorization: Bearer &lt;YOUR_API_KEY&gt;</pre>
        </AlertDescription>
      </Alert>

      <Tabs default-value="tasks" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">
            {{ t('api_keys.tabs.query_tasks') }}
          </TabsTrigger>
          <TabsTrigger value="execute">
            {{ t('api_keys.tabs.execute') }}
          </TabsTrigger>
          <TabsTrigger value="logs">
            {{ t('api_keys.tabs.logs') }}
          </TabsTrigger>
        </TabsList>

        <!-- List Tasks -->
        <TabsContent value="tasks" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{{ t('api_keys.endpoints.list_tasks') }}</CardTitle>
              <CardDescription>{{ t('api_keys.endpoints.list_desc') }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ t('api_keys.endpoints.endpoint') }}
                  </h4>
                  <div class="bg-muted p-2 rounded text-sm font-mono">
                    GET {{ baseUrl }}/api/query-tasks
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ t('api_keys.endpoints.parameters') }}
                  </h4>
                  <ul class="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li><code>page</code> (optional): Page number (default: 1)</li>
                    <li><code>limit</code> (optional): Items per page (default: 10)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.example_req') }}
                </h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X GET "{{ baseUrl }}/api/query-tasks?page=1&limit=5" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  -H "Content-Type: application/json"</pre>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.example_res') }}
                </h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{
  "meta": {
    "total": 50,
    "per_page": 5,
    "current_page": 1,
    "last_page": 10
  },
  "data": [
    {
      "id": 1,
      "name": "Daily User Report",
      "description": "Active users count",
      "connection_id": 2,
      "sql_template": "SELECT count(*) FROM users WHERE created_at > :date"
    }
  ]
}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Execute Task -->
        <TabsContent value="execute" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{{ t('api_keys.endpoints.execute_task') }}</CardTitle>
              <CardDescription>{{ t('api_keys.endpoints.execute_desc') }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ t('api_keys.endpoints.endpoint') }}
                  </h4>
                  <div class="bg-muted p-2 rounded text-sm font-mono">
                    POST {{ baseUrl }}/api/query-tasks/:id/execute
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ t('api_keys.endpoints.body_parameters') }}
                  </h4>
                  <ul class="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li><code>variables</code> (optional): Object containing SQL variables</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.example_req') }}
                </h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X POST "{{ baseUrl }}/api/query-tasks/1/execute" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "date": "2024-01-01"
    }
  }'</pre>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.example_res') }}
                </h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{
  "status": "success",
  "executionTime": 45,
  "data": [
    {
      "count(*)": 1250
    }
  ],
  "fields": [
    { "name": "count(*)", "type": "BIGINT" }
  ]
}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Logs -->
        <TabsContent value="logs" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{{ t('api_keys.endpoints.query_logs') }}</CardTitle>
              <CardDescription>{{ t('api_keys.endpoints.logs_desc') }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.endpoint') }}
                </h4>
                <div class="bg-muted p-2 rounded text-sm font-mono">
                  GET {{ baseUrl }}/api/query-logs
                </div>
              </div>
              <div>
                <h4 class="text-sm font-medium mb-2">
                  {{ t('api_keys.endpoints.example_req') }}
                </h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X GET "{{ baseUrl }}/api/query-logs?limit=10" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;"</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
