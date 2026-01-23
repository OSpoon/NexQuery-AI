<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/lib/api'

const user = ref<any>(null)

const handleLogout = async () => {
    uni.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    await api.post('/logout')
                } catch (e) {
                    console.error('Logout request failed', e)
                } finally {
                    uni.removeStorageSync('auth_token')
                    uni.removeStorageSync('user')
                    uni.reLaunch({
                        url: '/pages/login/index'
                    })
                }
            }
        }
    })
}

onMounted(() => {
    const userData = uni.getStorageSync('user')
    if (userData) {
        user.value = JSON.parse(userData)
    }
})
</script>

<template>
  <view class="container">
    <view v-if="user" class="header-card">
        <image class="avatar" :src="user.avatar || '/static/logo.png'"></image>
        <view class="user-info">
            <text class="user-name">{{ user.fullName }}</text>
            <text class="user-email">{{ user.email }}</text>
        </view>
    </view>

    <view class="menu-list">
        <view class="menu-item">
            <view class="menu-left">
                <text class="menu-text">账号安全</text>
            </view>
            <view class="arrow-icon"></view>
        </view>
        <view class="menu-item">
            <view class="menu-left">
                <text class="menu-text">关于 NexQuery</text>
            </view>
            <view class="arrow-icon"></view>
        </view>
    </view>

    <view class="logout-section">
        <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f8f9fa;
  padding: 30rpx;
}

.header-card {
    display: flex;
    align-items: center;
    background-color: #fff;
    padding: 60rpx 40rpx;
    border-radius: 24rpx;
    margin-bottom: 40rpx;
    box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);
}

.avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 60rpx;
    background-color: #f0f0f0;
    margin-right: 30rpx;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-size: 38rpx;
    font-weight: bold;
    color: #333;
}

.user-email {
    font-size: 26rpx;
    color: #999;
    margin-top: 8rpx;
}

.menu-list {
    background-color: #fff;
    border-radius: 20rpx;
    overflow: hidden;
    margin-bottom: 40rpx;
}

.menu-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 34rpx 30rpx;
    border-bottom: 2rpx solid #f5f5f5;
}

.menu-item:last-child {
    border-bottom: none;
}

.menu-text {
    font-size: 30rpx;
    color: #333;
}

.arrow-icon {
    width: 16rpx;
    height: 16rpx;
    border-top: 3rpx solid #ccc;
    border-right: 3rpx solid #ccc;
    transform: rotate(45deg);
}

.logout-section {
    margin-top: 60rpx;
}

.logout-btn {
    width: 100%;
    height: 90rpx;
    line-height: 90rpx;
    background-color: #fff;
    color: #ff4d4f;
    border-radius: 20rpx;
    font-size: 30rpx;
    border: none;
}

.logout-btn::after {
    border: none;
}
</style>
