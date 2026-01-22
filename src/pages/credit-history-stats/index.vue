<template>
  <div class="page-container">
    <!-- KeyName 选择区域 -->
    <div class="key-name-section">
      <div class="key-name-selector">
        <span class="selector-label">选择 API Key：</span>
        <el-select
          v-model="selectedKeyId"
          placeholder="请选择 API Key"
          size="small"
          class="key-select"
        >
          <el-option
            v-for="option in apiKeyOptions"
            :key="option.keyId"
            :label="option.name"
            :value="option.keyId"
          />
        </el-select>
        <el-tag
          v-if="selectedKeyId"
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
        <el-tag v-else-if="currentLimit > 0" :type="usagePercentage >= 90 ? 'warning' : 'success'" size="small" style="margin-left: 8px">
          额度: {{ usagePercentage.toFixed(1) }}%
        </el-tag>
        <el-tag v-else type="info" size="small" style="margin-left: 8px">
          无限额
        </el-tag>
      </h2>
      <div class="stats-cards">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">今日消费（当前Key）</div>
          <div class="stat-value today">${{ currentKeyTodayCost.toFixed(4) }}</div>
        </el-card>
        <el-card class="stat-card" shadow="hover" :class="{ 'card-danger': isCurrentKeyDisabled || (currentLimit > 0 && usagePercentage >= 100) }">
          <div class="stat-label">历史累计消费（当前Key）</div>
          <div class="stat-value accumulated">{{ formatCost(totalCostSum) }}</div>
          <div class="stat-hint" v-if="currentLimit > 0">
            限额: ${{ currentLimit }} | 已用: {{ usagePercentage.toFixed(1) }}%
          </div>
          <div class="stat-hint" v-else>
            无限额限制
          </div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">当前接口记录（当前Key）</div>
          <div class="stat-value total">{{ filteredCount }} 条</div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">今日消费（所有Key）</div>
          <div class="stat-value all-keys">${{ allKeysTodayCost.toFixed(4) }}</div>
        </el-card>
      </div>
      <div class="stats-info">
        <span v-if="lastUpdatedAt" class="update-time">
          最后更新: {{ lastUpdatedAt }}
        </span>
        <el-tag v-if="isRefetching" type="info" size="small" class="polling-tag">
          刷新中...
        </el-tag>
        <el-tag v-else type="success" size="small" class="polling-tag">
          每分钟自动刷新
        </el-tag>
        <!-- 暂时隐藏批量注册兑换码功能
        <el-button
          type="success"
          icon="el-icon-tickets"
          size="small"
          @click="openRedeemDialog"
        >
          激活兑换码
        </el-button>
        -->
        <el-button
          type="primary"
          icon="el-icon-refresh"
          size="small"
          :loading="isLoading"
          @click="refresh"
        >
          立即刷新
        </el-button>
      </div>
    </div>

    <!-- 消费趋势图表 -->
    <cost-chart
      :raw-data="rawData"
      :api-key-list="apiKeyList"
    />

    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="error.message"
      style="margin-bottom: 16px"
    />

    <!-- 明细列表 -->
    <div class="table-section">
      <h3 class="section-title">明细列表 - {{ selectedKeyName }}</h3>
      <el-table
        v-loading="isLoading"
        fit
        :data="tableData"
        highlight-current-row
      >
        <el-table-column
          label="时间"
          prop="createdAt"
          min-width="160"
          align="center"
        />
        <el-table-column
          label="AI账户"
          prop="accountId"
          min-width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tooltip
              v-if="row.accountId && accountDetails[row.accountId]"
              placement="top"
              effect="dark"
            >
              <template #content>
                <div style="line-height: 1.6">
                  <div>ID: {{ row.accountId }}</div>
                  <div>分类: {{ accountDetails[row.accountId].category }}</div>
                  <div>邮箱: {{ accountDetails[row.accountId].email }}</div>
                </div>
              </template>
              <span style="cursor: pointer; color: #67c23a">
                {{ getAccountDisplayName(row.accountId) }}
              </span>
            </el-tooltip>
            <span v-else>{{ getAccountDisplayName(row.accountId) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="模型"
          prop="requestModel"
          min-width="200"
          align="center"
        />
        <el-table-column
          label="输入令牌"
          prop="inputTokens"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTokens(row.inputTokens) }}
          </template>
        </el-table-column>
        <el-table-column
          label="输出令牌"
          prop="outputTokens"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTokens(row.outputTokens) }}
          </template>
        </el-table-column>
        <el-table-column
          label="缓存创建"
          prop="cacheCreateTokens"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTokens(row.cacheCreateTokens) }}
          </template>
        </el-table-column>
        <el-table-column
          label="缓存读取"
          prop="cacheReadTokens"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTokens(row.cacheReadTokens) }}
          </template>
        </el-table-column>
        <el-table-column
          label="总消费"
          prop="totalCost"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatCost(row.totalCost * 2) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 暂时隐藏批量注册兑换码功能
    <redeem-code-dialog
      :visible.sync="redeemDialogVisible"
      @complete="onRedeemComplete"
    />
    -->
  </div>
</template>
<script lang="ts" src="./index"></script>
<style lang="less" src="./index.less"></style>
