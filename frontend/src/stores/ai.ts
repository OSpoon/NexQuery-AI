import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import i18n from '@/i18n'
import api from '@/lib/api'

export interface AgentStep {
  type: 'thought' | 'tool' | 'node'
  content?: string // For thoughts
  toolName?: string
  toolInput?: any
  toolOutput?: string
  toolId?: string
  nodeName?: string // For nodes
  id?: string // For nodes/tools
  status?: 'running' | 'done' | 'error' | 'completed'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  prompt?: string
  feedback?: 'up' | 'down' | null
  agentSteps?: AgentStep[]
  clarification?: {
    question: string
    options: string[]
  }
  generatedSql?: string // PURE SQL for feedback/preview
}

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const messages = ref<ChatMessage[]>([
    { role: 'assistant', content: i18n.global.t('ai_chat.greeting') },
  ])
  const isLoading = ref(false)

  // Context
  const currentSchema = ref<any>(null)
  const currentDbType = ref('mysql')
  const dataSourceId = ref<number | undefined>(undefined)

  // Persistence
  const conversations = ref<any[]>([])
  const currentConversationId = ref<number | null>(null)
  const queryResults = ref<Record<number, { data: any[], duration: number }>>({})
  const mermaidGraph = ref<string | null>(null)

  function toggleOpen() {
    isOpen.value = !isOpen.value
  }

  function setContext(schema: any, dbType: string = 'mysql') {
    currentSchema.value = schema
    currentDbType.value = dbType
  }

  async function fetchConversations() {
    try {
      const res = await api.get('/ai/conversations')
      conversations.value = res.data
    }
    catch (e) {
      console.error('Failed to fetch conversations', e)
    }
  }

  async function loadConversation(id: number) {
    isLoading.value = true
    try {
      const res = await api.get(`/ai/conversations/${id}`)
      currentConversationId.value = id
      messages.value = res.data.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        prompt: m.prompt,
        agentSteps: m.agentSteps,
        generatedSql: m.generatedSql,
      }))
      // Restore data source context if saved
      if (res.data.dataSourceId) {
        dataSourceId.value = res.data.dataSourceId
      }
    }
    catch (e) {
      console.error('Failed to load conversation', e)
      toast.error('Failed to load history')
    }
    finally {
      isLoading.value = false
    }
  }

  function startNewChat() {
    currentConversationId.value = null
    messages.value = [
      { role: 'assistant', content: i18n.global.t('ai_chat.greeting') },
    ]
    queryResults.value = {}
  }

  async function deleteConversation(id: number) {
    try {
      await api.delete(`/ai/conversations/${id}`)
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentConversationId.value === id) {
        startNewChat()
      }
    }
    catch (e) {
      console.error('Failed to delete conversation', e)
      toast.error('Failed to delete conversation')
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim())
      return

    // Add user message
    messages.value.push({ role: 'user', content })
    isLoading.value = true

    try {
      await sendMessageStream(content)
    }
    catch (error: any) {
      console.error(error)
      messages.value.push({
        role: 'assistant',
        content: i18n.global.t('ai_chat.error'),
      })
      toast.error('AI Request Failed')
    }
    finally {
      isLoading.value = false
    }
  }

  async function sendMessageStream(content: string) {
    const payload: any = {
      question: content,
      schema: currentSchema.value,
      dbType: currentDbType.value,
      dataSourceId: dataSourceId.value,
      conversationId: currentConversationId.value,
      history: messages.value.slice(1, -1).map(m => ({
        role: m.role,
        content: m.content,
        agentSteps: m.agentSteps,
      })),
    }

    // Add empty assistant message to populate during stream
    messages.value.push({
      role: 'assistant',
      content: '',
      prompt: content,
      agentSteps: [],
    })
    const activeMessage = messages.value[messages.value.length - 1]

    if (!activeMessage)
      return

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Stream request failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader)
        return

      let buffer = '' // Buffer to hold incomplete chunks

      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const params = line.trim().slice(6)
              if (params === '[DONE]')
                continue

              const data = JSON.parse(params)

              if (data.type === 'conversation_id') {
                currentConversationId.value = data.id
                fetchConversations() // Refresh list
                continue
              }

              // Initialize agentSteps if undefined
              if (!activeMessage.agentSteps)
                activeMessage.agentSteps = []

              if (data.type === 'thought') {
                // Update the last thought step or create one
                // Visualization: Thoughts ONLY go to agentSteps, NOT to the main content bubble anymore.
                const lastStep = activeMessage.agentSteps[activeMessage.agentSteps.length - 1]
                if (lastStep && lastStep.type === 'thought') {
                  lastStep.content = (lastStep.content || '') + data.content
                }
                else {
                  activeMessage.agentSteps.push({
                    type: 'thought',
                    content: data.content,
                  })
                }
              }
              else if (data.type === 'response') {
                // New Event: This is the Final Answer.
                // Append this to the main chat bubble.
                activeMessage.content += data.content
                if (data.sql)
                  activeMessage.generatedSql = data.sql
              }
              else if (data.type === 'tool_start') {
                activeMessage.agentSteps.push({
                  type: 'tool',
                  toolName: data.tool,
                  toolInput: data.input,
                  toolId: data.id,
                  status: 'running',
                })
              }
              else if (data.type === 'tool_end') {
                // Find the running tool step with matching ID
                // Use slice() to create a copy before reversing, as reverse() is in-place
                const toolStep = activeMessage.agentSteps
                  .slice()
                  .reverse()
                  .find(s => s.type === 'tool' && s.toolId === data.id)
                if (toolStep) {
                  toolStep.toolOutput = data.output
                  toolStep.status = 'done'
                }
              }
              else if (data.type === 'node_start') {
                activeMessage.agentSteps.push({
                  type: 'node',
                  nodeName: data.node,
                  status: 'running',
                  id: data.id,
                })
              }
              else if (data.type === 'node_end') {
                const nodeStep = activeMessage.agentSteps
                  .slice()
                  .reverse()
                  .find(s => s.type === 'node' && s.id === data.id)
                if (nodeStep) {
                  nodeStep.status = 'completed'
                }
              }
              else if (data.type === 'clarify') {
                activeMessage.clarification = {
                  question: data.question,
                  options: data.options,
                }
              }
              else if (data.type === 'error') {
                throw new Error(data.content)
              }
              else if (data.chunk) {
                // Legacy fallback
                activeMessage.content += data.chunk
              }
            }
            catch {
              // Ignore parsing errors for partial chunks
            }
          }
        }
      }
    }
    catch (error: any) {
      console.error('Stream Error:', error)
      activeMessage.content += `\n\n**Error:** ${error.message}`
    }
  }

  function clearMessages() {
    messages.value = [
      { role: 'assistant', content: i18n.global.t('ai_chat.greeting') },
    ]
    currentConversationId.value = null
    queryResults.value = {}
  }

  async function previewSql(dataSourceId: number, sql: string, messageIndex: number) {
    try {
      const response = await api.post('/ai/preview', { dataSourceId, sql })
      queryResults.value[messageIndex] = response.data
    }
    catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to execute SQL preview')
    }
  }

  async function fetchGraphVisual() {
    try {
      const res = await api.get('/ai/graph/visualize')
      mermaidGraph.value = res.data.mermaid
    }
    catch (e) {
      console.error('Failed to fetch graph visual', e)
    }
  }

  const activeNodeName = computed(() => {
    if (messages.value.length === 0)
      return undefined
    const lastMessage = messages.value[messages.value.length - 1]
    if (!lastMessage || !lastMessage.agentSteps)
      return undefined
    const runningNode = [...lastMessage.agentSteps].reverse().find(s => s.type === 'node' && s.status === 'running')
    return runningNode?.nodeName
  })

  return {
    isOpen,
    messages,
    isLoading,
    currentSchema,
    currentDbType,
    dataSourceId,
    conversations,
    currentConversationId,
    toggleOpen,
    setContext,
    sendMessage,
    sendMessageStream,
    clearMessages,
    fetchConversations,
    loadConversation,
    startNewChat,
    deleteConversation,
    queryResults,
    previewSql,
    fetchGraphVisual,
    mermaidGraph,
    activeNodeName,
  }
})
