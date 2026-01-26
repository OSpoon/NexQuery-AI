<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { cryptoService } from '@/lib/api'

const result = ref<any[]>([])
const headers = ref<string[]>([])
const viewMode = ref<'card' | 'table'>('card')

onMounted(() => {
  const data = uni.getStorageSync('last_query_result')
  if (data) {
    try {
      let parsed = JSON.parse(data)

      // Defensive check: if storage contains { data: "ciphertext" }
      if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'string' && cryptoService) {
        try {
          const decrypted = cryptoService.decrypt(parsed.data)
          if (decrypted) {
            parsed = decrypted
          }
        }
        catch {
          // console.error('Decryption in result view failed', _e) // Removed log
        }
      }

      result.value = parsed
      if (Array.isArray(parsed) && parsed.length > 0) {
        headers.value = Object.keys(parsed[0])
      }
    }
    catch {
      console.error('Failed to parse result')
    }
  }
})

function toggleView() {
  viewMode.value = viewMode.value === 'card' ? 'table' : 'card'
}

function handleBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="container">
    <view class="header-toolbar">
      <text class="result-count">
        共 {{ result.length }} 条结果
      </text>
      <button class="toggle-btn" size="mini" @click="toggleView">
        {{ viewMode === 'card' ? '文字视图' : '表格视图' }}
      </button>
    </view>

    <view v-if="result.length === 0" class="empty-state">
      <text>暂无数据</text>
    </view>

    <view v-else class="content-area">
      <!-- Card View -->
      <scroll-view v-if="viewMode === 'card'" scroll-y class="card-list">
        <view v-for="(row, idx) in result" :key="idx" class="result-card">
          <view class="card-header">
            <text class="card-index">
              #{{ idx + 1 }}
            </text>
          </view>
          <view class="card-body">
            <view v-for="header in headers" :key="header" class="data-item">
              <text class="data-label">
                {{ header }}
              </text>
              <text class="data-value">
                {{ row[header] ?? '-' }}
              </text>
            </view>
          </view>
        </view>
        <view class="list-bottom-tip">
          到底了
        </view>
      </scroll-view>

      <!-- Table View (Legacy Scroll) -->
      <scroll-view v-else scroll-x class="table-scroll">
        <view class="table">
          <view class="table-header">
            <view v-for="header in headers" :key="header" class="header-cell">
              {{ header }}
            </view>
          </view>

          <scroll-view scroll-y class="table-body-scroll">
            <view v-for="(row, idx) in result" :key="idx" class="table-row">
              <view v-for="header in headers" :key="header" class="body-cell">
                {{ row[header] }}
              </view>
            </view>
          </scroll-view>
        </view>
      </scroll-view>
    </view>

    <view class="footer">
      <button class="back-btn" @click="handleBack">
        返回
      </button>
    </view>
  </view>
</template>

<style scoped>
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.header-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 30rpx;
  background-color: #f8f9fa;
  border-bottom: 2rpx solid #eee;
}

.result-count {
  font-size: 24rpx;
  color: #666;
}

.toggle-btn {
  margin: 0;
  font-size: 24rpx;
  border-radius: 30rpx;
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.card-list {
  height: 100%;
  padding: 20rpx;
  box-sizing: border-box;
}

.result-card {
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 30rpx;
  overflow: hidden;
}

.card-header {
  background-color: #f0f7ff;
  padding: 10rpx 20rpx;
  border-bottom: 2rpx solid #e1effe;
}

.card-index {
  font-size: 22rpx;
  font-weight: bold;
  color: #409eff;
}

.card-body {
  padding: 20rpx;
}

.data-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 16rpx;
}

.data-item:last-child {
  margin-bottom: 0;
}

.data-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.data-value {
  font-size: 28rpx;
  color: #333;
  word-break: break-all;
}

.list-bottom-tip {
  text-align: center;
  padding: 30rpx;
  font-size: 24rpx;
  color: #ccc;
}

.empty-state {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
}

.table-scroll {
  height: 100%;
  width: 100%;
}

.table {
  display: inline-block;
  min-width: 100%;
}

.table-header {
  display: flex;
  background-color: #f8f9fa;
  border-bottom: 2rpx solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-cell {
  padding: 20rpx;
  min-width: 200rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #495057;
  text-align: left;
  border-right: 2rpx solid #dee2e6;
}

.table-body-scroll {
  height: calc(100vh - 300rpx);
}

.table-row {
  display: flex;
  border-bottom: 2rpx solid #eee;
}

.body-cell {
  padding: 20rpx;
  min-width: 200rpx;
  font-size: 24rpx;
  color: #333;
  text-align: left;
  border-right: 2rpx solid #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer {
  padding: 30rpx;
  border-top: 2rpx solid #eee;
}

.back-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
}
</style>
