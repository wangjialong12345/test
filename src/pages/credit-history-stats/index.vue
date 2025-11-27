<template>
  <div class="page-container">
    <!-- KeyName 选择区域 -->
    <div class="key-name-section">
      <div class="key-name-selector">
        <span class="selector-label">选择 API Key：</span>
        <el-select
          v-model="selectedKeyName"
          placeholder="请选择 API Key"
          size="small"
          class="key-select"
        >
          <el-option
            v-for="keyName in keyNameList"
            :key="keyName"
            :label="keyName"
            :value="keyName"
          />
        </el-select>
        <el-tag
          v-if="selectedKeyName"
          :type="isCurrentKeyDisabled ? 'danger' : 'success'"
          size="small"
          class="key-status-tag"
        >
          {{ isCurrentKeyDisabled ? '已禁用' : '已启用' }}
        </el-tag>
      </div>
    </div>

    <!-- 禁用警告 -->
    <el-alert
      v-if="isCurrentKeyDisabled"
      type="error"
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        <span style="font-weight: bold">
          <i class="el-icon-warning" /> 此 Key 已被禁用
        </span>
      </template>
      <div v-if="currentDisabledRecord">
        禁用时间: {{ currentDisabledRecord.disabledAt }} |
        禁用时消费: ${{ currentDisabledRecord.costAtDisable.toFixed(2) }}
      </div>
    </el-alert>

    <!-- 统计卡片区域 -->
    <div class="stats-header">
      <h2 class="stats-title">
        积分统计 - {{ selectedKeyName }}
        <el-tag v-if="isCurrentKeyDisabled" type="danger" size="small" style="margin-left: 8px">
          已禁用
        </el-tag>
        <el-tag v-else :type="usagePercentage >= 90 ? 'warning' : 'success'" size="small" style="margin-left: 8px">
          额度: {{ usagePercentage.toFixed(1) }}%
        </el-tag>
      </h2>
      <div class="stats-cards">
        <el-card class="stat-card" shadow="hover" :class="{ 'card-danger': isCurrentKeyDisabled || usagePercentage >= 100 }">
          <div class="stat-label">累计消费总和</div>
          <div class="stat-value accumulated">{{ formatCost(accumulatedCostSum) }}</div>
          <div class="stat-hint">
            当前启用状态的消费 | 限额: ${{ currentLimit }} | 已用: {{ usagePercentage.toFixed(1) }}%
          </div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">历史消费总和</div>
          <div class="stat-value history">{{ formatCost(historyPeriodsCostSum) }}</div>
          <div class="stat-hint">
            所有历史禁用周期的总消费
          </div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">当前周期消费</div>
          <div class="stat-value cost">{{ formatCost(currentPeriodCost) }}</div>
          <div class="stat-hint" v-if="currentPeriod">
            开始于: {{ currentPeriod.startedAt }}
          </div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">历史周期数</div>
          <div class="stat-value count">{{ historyPeriods.length }} 个</div>
          <div class="stat-hint">后端数据清空次数</div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">当前接口记录</div>
          <div class="stat-value total">{{ filteredCount }} 条</div>
        </el-card>
      </div>
      <div class="stats-info">
        <span v-if="lastUpdatedAt" class="update-time">
          最后更新: {{ lastUpdatedAt }}
        </span>
        <span v-if="lastSavedAt" class="update-time">
          | 最后存储: {{ lastSavedAt }}
        </span>
        <el-tag v-if="isRefetching" type="info" size="small" class="polling-tag">
          刷新中...
        </el-tag>
        <el-tag v-else type="success" size="small" class="polling-tag">
          每分钟自动刷新
        </el-tag>
        <el-button
          type="primary"
          icon="el-icon-refresh"
          size="small"
          :loading="isLoading"
          @click="refresh"
        >
          立即刷新
        </el-button>
        <el-button
          type="success"
          icon="el-icon-folder-checked"
          size="small"
          @click="saveNow"
        >
          立即存储
        </el-button>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="error.message"
      style="margin-bottom: 16px"
    />

    <!-- 明细列表 -->
    <div class="table-section">
      <h3 class="section-title">明细列表</h3>
      <el-table
        v-loading="isLoading"
        fit
        :data="tableData"
        highlight-current-row
        height="calc(100vh - 360px)"
      >
        <el-table-column
          label="时间"
          prop="createdAt"
          min-width="160"
          align="center"
        />
        <el-table-column
          label="模型"
          prop="requestModel"
          min-width="200"
          align="center"
        />
        <el-table-column
          label="Input Tokens"
          prop="inputTokens"
          min-width="120"
          align="center"
        />
        <el-table-column
          label="Output Tokens"
          prop="outputTokens"
          min-width="120"
          align="center"
        />
        <el-table-column
          label="Cache Create"
          prop="cacheCreateTokens"
          min-width="120"
          align="center"
        />
        <el-table-column
          label="Cache Read"
          prop="cacheReadTokens"
          min-width="120"
          align="center"
        />
        <el-table-column
          label="Total Cost"
          prop="totalCost"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatCost(row.totalCost) }}
          </template>
        </el-table-column>
        <el-table-column
          label="描述"
          prop="description"
          min-width="160"
          align="center"
        />
      </el-table>
    </div>
  </div>
</template>
<script lang="ts" src="./index"></script>
<style lang="less" src="./index.less"></style>
