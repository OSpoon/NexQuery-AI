<script setup lang="ts">
import { ref } from 'vue'
import ApiKeysManager from '@/components/profile/ApiKeysManager.vue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Terminal } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const baseUrl = ref('http://localhost:3333')
</script>

<template>
  <div class="p-6 space-y-6 max-w-6xl mx-auto">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">API Access Management</h1>
      <p class="text-muted-foreground">Manage API keys and view integration documentation.</p>
    </div>

    <!-- Management Section -->
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription
          >Generate and manage long-lived access tokens for external systems.</CardDescription
        >
      </CardHeader>
      <CardContent>
        <ApiKeysManager />
      </CardContent>
    </Card>

    <!-- Documentation Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold tracking-tight">Integration Documentation</h2>
        <div class="flex items-center gap-2">
          <Label for="base-url">API Base URL:</Label>
          <Input id="base-url" v-model="baseUrl" class="w-64 h-8" />
        </div>
      </div>

      <Alert>
        <Terminal class="h-4 w-4" />
        <AlertTitle>Authentication</AlertTitle>
        <AlertDescription>
          All API requests must include the <code>Authorization</code> header with your API Key:
          <pre class="mt-2 text-xs bg-muted p-2 rounded">
Authorization: Bearer &lt;YOUR_API_KEY&gt;</pre
          >
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="tasks" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Query Tasks</TabsTrigger>
          <TabsTrigger value="execute">Execute Query</TabsTrigger>
          <TabsTrigger value="logs">Query Logs</TabsTrigger>
        </TabsList>

        <!-- List Tasks -->
        <TabsContent value="tasks" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>List Query Tasks</CardTitle>
              <CardDescription>Retrieve a paginated list of available query tasks.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-2">Endpoint</h4>
                  <div class="bg-muted p-2 rounded text-sm font-mono">
                    GET {{ baseUrl }}/api/query-tasks
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-2">Parameters</h4>
                  <ul class="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li><code>page</code> (optional): Page number (default: 1)</li>
                    <li><code>limit</code> (optional): Items per page (default: 10)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">Example Request</h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X GET "{{ baseUrl }}/api/query-tasks?page=1&limit=5" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  -H "Content-Type: application/json"</pre
                >
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">Example Response</h4>
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
}</pre
                >
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Execute Task -->
        <TabsContent value="execute" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execute Query Task</CardTitle>
              <CardDescription>Run a specific query task with parameters.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-2">Endpoint</h4>
                  <div class="bg-muted p-2 rounded text-sm font-mono">
                    POST {{ baseUrl }}/api/query-tasks/:id/execute
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-2">Body Parameters</h4>
                  <ul class="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li><code>variables</code> (optional): Object containing SQL variables</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">Example Request</h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X POST "{{ baseUrl }}/api/query-tasks/1/execute" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "date": "2024-01-01"
    }
  }'</pre
                >
              </div>

              <div>
                <h4 class="text-sm font-medium mb-2">Example Response</h4>
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
}</pre
                >
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Logs -->
        <TabsContent value="logs" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Logs</CardTitle>
              <CardDescription>Fetch audit logs of executed queries.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div>
                <h4 class="text-sm font-medium mb-2">Endpoint</h4>
                <div class="bg-muted p-2 rounded text-sm font-mono">
                  GET {{ baseUrl }}/api/query-logs
                </div>
              </div>
              <div>
                <h4 class="text-sm font-medium mb-2">Example Request</h4>
                <pre class="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
curl -X GET "{{ baseUrl }}/api/query-logs?limit=10" \
  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;"</pre
                >
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
