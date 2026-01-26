<script setup lang="ts">
import type { QueryTask } from '@nexquery/shared'
import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import api, { cryptoService } from '@/lib/api'

const taskId = ref('')
const task = ref<QueryTask | null>(null)
const formData = ref<Record<string, any>>({})
const loading = ref(false)
const executing = ref(false)

onLoad((options) => {
  if (options && options.id) {
    taskId.value = options.id
  }
})

async function fetchTask() {
  loading.value = true
  try {
    const res = await api.get(`/query-tasks/${taskId.value}`)
    task.value = res
    // Initialize form data
    if (res.formSchema) {
      res.formSchema.forEach((item: any) => {
        formData.value[item.name] = item.default || ''
      })
    }
  }
  catch (error) {
    console.error('Failed to fetch task', error)
    uni.showToast({ title: '加载任务失败', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

async function handleExecute() {
  // Validate required fields
  if (task.value?.formSchema) {
    for (const item of task.value.formSchema) {
      if (item.required && (!formData.value[item.name] && formData.value[item.name] !== 0)) {
        uni.showToast({
          title: `请输入${item.label}`,
          icon: 'none',
        })
        return
      }
    }
  }

  executing.value = true
  try {
    const res = await api.post(`/query-tasks/${taskId.value}/execute`, {
      params: formData.value,
    })

    let finalData = res.data

    // Check if the result itself is an encrypted packet (common for API tasks calling other platform APIs)
    if (
      cryptoService
      && finalData
      && typeof finalData === 'object'
      && finalData.data
      && typeof finalData.data === 'string'
      && finalData.data.startsWith('U2FsdGVk')
    ) {
      try {
        const decrypted = cryptoService.decrypt(finalData.data)
        if (decrypted !== null) {
          finalData = decrypted
        }
      }
      catch (e) {
        console.warn('[TaskExecute] Failed to decrypt nested result:', e)
      }
    }

    // Log success and go to result page
    if (finalData && ((Array.isArray(finalData) && finalData.length > 0) || (typeof finalData === 'object' && Object.keys(finalData).length > 0))) {
      uni.setStorageSync('last_query_result', JSON.stringify(finalData))
      uni.navigateTo({
        url: '/pages/result/index',
      })
    }
    else {
      uni.showToast({
        title: '查询成功，暂无数据',
        icon: 'success',
      })
    }
  }
  catch (error: any) {
    console.error('Execution failed', error)
    uni.showModal({
      title: '执行失败',
      content: error.error || error.message || '查询失败',
      showCancel: false,
    })
  }
  finally {
    executing.value = false
  }
}

onMounted(() => {
  if (taskId.value) {
    fetchTask()
  }
})
</script>

<template>
  <view class="container">
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>

    <view v-else-if="task" class="task-detail">
      <view class="header">
        <text class="task-name">
          {{ task.name }}
        </text>
        <text class="task-desc">
          {{ task.description || '无描述' }}
        </text>
      </view>

      <view class="form-container">
        <view v-for="item in task.formSchema" :key="item.name" class="form-item">
          <text class="label">
            {{ item.label }} <text v-if="item.required" class="required">
              *
            </text>
          </text>

          <input
            v-if="item.type === 'text' || item.type === 'input'" v-model="formData[item.name]" class="input"
            :placeholder="`请输入${item.label}`"
          >

          <input
            v-else-if="item.type === 'number'" v-model="formData[item.name]" class="input" type="number"
            :placeholder="`请输入${item.label}`"
          >

          <textarea
            v-else-if="item.type === 'textarea'" v-model="formData[item.name]" class="textarea"
            :placeholder="`请输入${item.label}`"
          />

          <!-- Add more types if needed -->
          <text v-else class="unsupported">
            不支持的表单类型: {{ item.type }}
          </text>
        </view>
      </view>

      <view class="footer">
        <button class="execute-btn" type="button" :loading="executing" @click="handleExecute">
          执行查询
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
}

.task-detail {
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #fff;
  padding: 40rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
}

.task-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.task-desc {
  font-size: 28rpx;
  color: #666;
  margin-top: 20rpx;
}

.form-container {
  background-color: #fff;
  padding: 40rpx;
  flex: 1;
}

.form-item {
  margin-bottom: 40rpx;
}

.label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.required {
  color: #ff4d4f;
  margin-left: 4rpx;
}

.input {
  width: auto;
  height: 80rpx;
  border: 2rpx solid #eee;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.textarea {
  width: auto;
  height: 200rpx;
  border: 2rpx solid #eee;
  border-radius: 8rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.footer {
  padding: 40rpx;
  background-color: #fff;
  position: sticky;
  bottom: 0;
}

.execute-btn {
  width: 100%;
  height: 90rpx;
  line-height: 90rpx;
  border-radius: 45rpx;
}
</style>
