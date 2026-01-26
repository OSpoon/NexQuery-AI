<script setup lang="ts">
const version = '1.0.0'
</script>

<template>
  <view class="container">
    <view class="logo-section">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="app-name">
        NexQuery AI
      </text>
      <text class="version">
        Version {{ version }}
      </text>
    </view>

    <view class="content-card">
      <view class="info-item">
        <text class="label">
          官方网站
        </text>
        <text class="value">
          nexquery.ai
        </text>
      </view>
      <view class="info-item">
        <text class="label">
          联系我们
        </text>
        <text class="value">
          support@nexquery.ai
        </text>
      </view>
      <view class="info-item" @click="uni.navigateTo({ url: '/pages/profile/policy?type=service' })">
        <text class="label">
          用户协议
        </text>
        <view class="arrow-icon" />
      </view>
      <view class="info-item" @click="uni.navigateTo({ url: '/pages/profile/policy?type=privacy' })">
        <text class="label">
          隐私政策
        </text>
        <view class="arrow-icon" />
      </view>
    </view>

    <view class="footer">
      <text class="copyright">
        © 2026 NexQuery AI. All rights reserved.
      </text>
    </view>
  </view>
</template>

<style scoped>
.container {
    min-height: 100vh;
    background-color: #f8f9fa;
    padding: 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.logo-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 60rpx;
    margin-bottom: 60rpx;
}

.logo {
    width: 160rpx;
    height: 160rpx;
    border-radius: 30rpx;
    margin-bottom: 20rpx;
}

.app-name {
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
}

.version {
    font-size: 26rpx;
    color: #999;
}

.content-card {
    width: 100%;
    background-color: #fff;
    border-radius: 20rpx;
    padding: 0 30rpx;
}

.info-item {
    display: flex;
    justify-content: space-between;
    padding: 30rpx 0;
    border-bottom: 2rpx solid #f5f5f5;
}

.info-item:last-child {
    border-bottom: none;
}

.label {
    color: #666;
    font-size: 28rpx;
}

.value {
    color: #333;
    font-weight: 500;
    font-size: 28rpx;
}

.footer {
    margin-top: auto;
    padding-bottom: 40rpx;
}

.copyright {
    font-size: 24rpx;
    color: #ccc;
}

.arrow-icon {
    width: 16rpx;
    height: 16rpx;
    border-top: 3rpx solid #ccc;
    border-right: 3rpx solid #ccc;
    transform: rotate(45deg);
}
</style>
