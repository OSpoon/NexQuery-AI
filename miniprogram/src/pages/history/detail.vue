<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { cryptoService } from '@/lib/api'

const log = ref<any>(null)

onLoad(() => {
    const data = uni.getStorageSync('current_log_detail')
    if (data) {
        try {
            const parsed = JSON.parse(data)

            // Auto-decryption for API tasks
            if (parsed.task?.dataSource?.type === 'api' && parsed.results) {
                const results = parsed.results

                // If results is an object with { data: "ciphertext" }
                if (results && typeof results === 'object' && results.data && typeof results.data === 'string' && cryptoService) {
                    try {
                        const decrypted = cryptoService.decrypt(results.data)
                        if (decrypted) {
                            parsed.results = decrypted
                        }
                    } catch (e) {
                        console.error('Auto-decryption failed', e)
                    }
                }
            }

            log.value = parsed
        } catch (e) {
            console.error('Failed to parse log detail', e)
        }
    }
})

const formatDuration = (ms: number) => {
    if (!ms && ms !== 0) return '-'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleString()
}

const viewResults = () => {
    if (!log.value || !log.value.results) return

    // Ensure it's passed as an array to result page for consistency
    const results = Array.isArray(log.value.results)
        ? log.value.results
        : [log.value.results]

    uni.setStorageSync('last_query_result', JSON.stringify(results))
    uni.navigateTo({
        url: '/pages/result/index'
    })
}
</script>

<template>
    <view class="container" v-if="log">
        <!-- Header Section -->
        <view class="section header-section">
            <view class="task-info">
                <text class="task-name">{{ log.task?.name || '未知任务' }}</text>
                <text class="log-time">{{ formatDate(log.createdAt) }}</text>
            </view>
            <view class="status-badge" :class="log.status === 'success' ? 'success' : 'failed'">
                <text>{{ log.status === 'success' ? '执行成功' : '执行失败' }}</text>
            </view>
        </view>

        <!-- Basic Info -->
        <view class="section">
            <view class="section-title">基础信息</view>
            <view class="info-grid">
                <view class="info-item">
                    <text class="label">耗时</text>
                    <text class="value">{{ formatDuration(log.executionTimeMs) }}</text>
                </view>
                <view class="info-item">
                    <text class="label">执行人</text>
                    <text class="value">{{ log.user?.fullName || 'Anonymous' }}</text>
                </view>
                <view class="info-item" v-if="log.ipAddress">
                    <text class="label">来源 IP</text>
                    <text class="value">{{ log.ipAddress }}</text>
                </view>
            </view>
        </view>

        <!-- Error Message -->
        <view class="section error-section" v-if="log.errorMessage">
            <view class="section-title error-title">错误信息</view>
            <text class="error-content">{{ log.errorMessage }}</text>
        </view>

        <!-- Executed SQL -->
        <view class="section">
            <view class="section-title">执行 SQL</view>
            <view class="code-block">
                <text>{{ log.executedSql }}</text>
            </view>
        </view>

        <!-- Parameters -->
        <view class="section" v-if="log.parameters && Object.keys(log.parameters).length > 0">
            <view class="section-title">参数</view>
            <view class="code-block">
                <text>{{ JSON.stringify(log.parameters, null, 2) }}</text>
            </view>
        </view>

        <!-- Results Snapshot -->
        <view class="section" v-if="log.results">
            <view class="section-title">结果概览 (JSON)</view>
            <view class="code-block results-block">
                <text>{{ JSON.stringify(log.results, null, 2) }}</text>
            </view>
        </view>

        <view class="footer-actions" v-if="log.status === 'success' && log.results">
            <button class="view-result-btn" type="primary" @click="viewResults">
                进入详细结果视图
            </button>
        </view>
    </view>
</template>

<style scoped>
.container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 30rpx;
    padding-bottom: 120rpx;
}

.section {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.02);
}

.section-title {
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    border-left: 6rpx solid #409eff;
    padding-left: 16rpx;
}

.header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.task-info {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
}

.task-name {
    font-size: 34rpx;
    font-weight: bold;
    color: #333;
}

.log-time {
    font-size: 24rpx;
    color: #999;
}

.status-badge {
    padding: 6rpx 16rpx;
    border-radius: 8rpx;
    font-size: 24rpx;
    font-weight: bold;
}

.status-badge.success {
    background-color: #e6f7ff;
    color: #1890ff;
}

.status-badge.failed {
    background-color: #fff1f0;
    color: #f5222d;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 30rpx;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.label {
    font-size: 24rpx;
    color: #999;
}

.value {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.code-block {
    background-color: #f8f9fa;
    padding: 24rpx;
    border-radius: 12rpx;
    font-size: 24rpx;
    color: #444;
    font-family: monospace;
    word-break: break-all;
    line-height: 1.4;
}

.results-block {
    max-height: 400rpx;
    overflow-y: auto;
    background-color: #1e1e1e;
    color: #d4d4d4;
}

.error-section {
    background-color: #fff1f0;
    border: 2rpx solid #ffa39e;
}

.error-title {
    color: #f5222d;
    border-left-color: #f5222d;
}

.error-content {
    font-size: 26rpx;
    color: #cf1322;
}

.footer-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 30rpx;
    background-color: #fff;
    border-top: 2rpx solid #eee;
    z-index: 100;
}

.view-result-btn {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
}
</style>
