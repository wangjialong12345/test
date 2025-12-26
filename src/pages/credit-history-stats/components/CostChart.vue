<template>
  <div class="cost-chart-container">
    <div class="chart-header">
      <h3 class="chart-title">消费趋势</h3>
      <div class="chart-controls">
        <el-select
          v-model="timeRange"
          size="small"
          class="time-range-select"
        >
          <el-option label="最近24小时" value="24h" />
          <el-option label="最近7天" value="7d" />
        </el-select>
        <el-radio-group
          v-model="displayMode"
          size="small"
          class="display-mode-group"
        >
          <el-radio-button label="summary">汇总</el-radio-button>
          <el-radio-button label="separate">分别</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div ref="chartRef" class="chart-wrapper"></div>
  </div>
</template>
<script lang="ts" src="./CostChart"></script>
<style lang="less" src="./CostChart.less"></style>
