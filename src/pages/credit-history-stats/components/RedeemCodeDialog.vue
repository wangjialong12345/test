<template>
  <el-dialog
    title="批量激活兑换码"
    :visible.sync="dialogVisible"
    width="90%"
    :style="{ maxWidth: '600px' }"
    :close-on-click-modal="false"
    :close-on-press-escape="!isProcessing"
    :show-close="!isProcessing"
    @close="handleClose"
    custom-class="redeem-dialog"
  >
    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-label">请输入兑换码（每行一个）：</div>
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="6"
        :disabled="isProcessing"
        placeholder="XXXX-XXXX-XXXX&#10;YYYY-YYYY-YYYY&#10;...注意这是给我自己使用的功能，如果你把你自己的兑换码在这里用了，后果自负！"
      />
      <div class="input-hint">
        已输入 <span class="count">{{ codeCount }}</span> 个兑换码
      </div>
    </div>

    <!-- OCR 加载状态 -->
    <el-alert
      v-if="isOCRLoading"
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        <span><i class="el-icon-loading" /> 正在加载 OCR 识别引擎，请稍候...</span>
      </template>
      <div style="font-size: 12px; color: #909399; margin-top: 4px;">
        首次加载需要下载模型文件，可能需要几秒钟
      </div>
    </el-alert>

    <!-- OCR 加载失败 -->
    <el-alert
      v-if="isOCRError"
      type="error"
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        <span><i class="el-icon-warning" /> OCR 引擎加载失败</span>
      </template>
      <div style="font-size: 12px; margin-top: 4px;">
        请检查网络连接后重新打开对话框
      </div>
    </el-alert>

    <!-- 进度区域 -->
    <div v-if="isProcessing || results.length > 0" class="progress-section">
      <div class="progress-header">
        <span>处理进度</span>
        <span class="progress-text">{{ progress }}%</span>
      </div>
      <el-progress
        :percentage="progress"
        :status="progressStatus"
        :stroke-width="12"
      />
      <div class="progress-stats">
        <span class="stat success">成功: {{ successCount }}</span>
        <span class="stat used">已被使用: {{ usedCount }}</span>
        <span class="stat failed">失败: {{ failedCount }}</span>
        <span class="stat pending">待处理: {{ pendingCount }}</span>
      </div>
    </div>

    <!-- 结果列表 -->
    <div v-if="results.length > 0" class="results-section">
      <div class="results-header">处理结果</div>
      <div class="results-list">
        <div
          v-for="(result, index) in results"
          :key="index"
          class="result-item"
          :class="result.status"
        >
          <span class="result-icon">
            <i v-if="result.status === 'pending'" class="el-icon-time" />
            <i v-else-if="result.status === 'success'" class="el-icon-success" />
            <i v-else-if="result.status === 'used'" class="el-icon-warning" />
            <i v-else-if="result.status === 'failed'" class="el-icon-error" />
          </span>
          <span class="result-code">{{ result.code }}</span>
          <span class="result-message">{{ result.message }}</span>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <el-button :disabled="isProcessing" @click="handleClose">
        {{ isProcessing ? '处理中...' : '关闭' }}
      </el-button>
      <el-button
        type="primary"
        :loading="isProcessing || isOCRLoading"
        :disabled="!canStart"
        @click="handleStart"
      >
        {{ isOCRLoading ? '加载中...' : isProcessing ? '正在激活...' : '开始激活' }}
      </el-button>
    </template>
  </el-dialog>
</template>
<script lang="ts" src="./RedeemCodeDialog"></script>
<style lang="less" src="./RedeemCodeDialog.less"></style>
