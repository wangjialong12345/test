import { CreditHistoryItem, ApiKeyInfo } from './types';

/** 时间范围类型 */
export type TimeRange = '24h' | '3d' | '7d' | '30d';

/** 显示模式 */
export type DisplayMode = 'summary' | 'separate';

/** 图表数据点 */
export interface ChartDataPoint {
  /** X 轴标签（时间） */
  label: string;
  /** Y 轴值（消费金额） */
  value: number;
}

/** 图表系列数据 */
export interface ChartSeries {
  /** 系列名称（Key 名称或"总消费"） */
  name: string;
  /** 数据点 */
  data: number[];
}

/** 图表数据 */
export interface ChartData {
  /** X 轴标签 */
  xAxisData: string[];
  /** 系列数据 */
  series: ChartSeries[];
}

/**
 * 图表数据处理工具类
 */
export class ChartDataProcessor {
  /**
   * 处理图表数据
   */
  static processChartData(
    rawData: CreditHistoryItem[],
    apiKeyList: ApiKeyInfo[],
    timeRange: TimeRange,
    displayMode: DisplayMode
  ): ChartData {
    if (displayMode === 'summary') {
      return this.processSummaryMode(rawData, timeRange);
    } else {
      return this.processSeparateMode(rawData, apiKeyList, timeRange);
    }
  }

  /**
   * 汇总模式：所有 Key 的消费汇总为一条曲线
   */
  private static processSummaryMode(
    rawData: CreditHistoryItem[],
    timeRange: TimeRange
  ): ChartData {
    if (timeRange === '24h') {
      const aggregated = this.aggregateByHour(rawData);
      return {
        xAxisData: aggregated.map(d => d.label),
        series: [
          {
            name: '总消费',
            data: aggregated.map(d => d.value),
          },
        ],
      };
    } else {
      const days = timeRange === '3d' ? 3 : timeRange === '7d' ? 7 : 30;
      const aggregated = this.aggregateByDay(rawData, days);
      return {
        xAxisData: aggregated.map(d => d.label),
        series: [
          {
            name: '总消费',
            data: aggregated.map(d => d.value),
          },
        ],
      };
    }
  }

  /**
   * 分别模式：每个 Key 单独一条曲线（显示所有 Key）
   */
  private static processSeparateMode(
    rawData: CreditHistoryItem[],
    apiKeyList: ApiKeyInfo[],
    timeRange: TimeRange
  ): ChartData {
    // 按 keyId 分组
    const groupedData = this.groupByKeyId(rawData);

    // 按总消费排序（显示所有 Key）
    const sortedKeys = Object.entries(groupedData)
      .map(([keyId, items]) => ({
        keyId,
        items,
        totalCost: items.reduce((sum, item) => sum + item.totalCost, 0),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // 生成 X 轴数据（使用第一个 Key 的数据作为基准）
    let xAxisData: string[] = [];
    if (timeRange === '24h') {
      xAxisData = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    } else {
      const days = timeRange === '3d' ? 3 : timeRange === '7d' ? 7 : 30;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      xAxisData = Array.from({ length: days }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (days - 1 - i));
        return this.formatDate(date);
      });
    }

    // 为每个 Key 生成系列数据
    const series: ChartSeries[] = sortedKeys.map(({ keyId, items }) => {
      const keyInfo = apiKeyList.find(k => k.keyId === keyId);
      const keyName = keyInfo?.name || keyId;

      let dataPoints: ChartDataPoint[];
      if (timeRange === '24h') {
        dataPoints = this.aggregateByHour(items);
      } else {
        const days = timeRange === '3d' ? 3 : timeRange === '7d' ? 7 : 30;
        dataPoints = this.aggregateByDay(items, days);
      }

      // 将数据点转换为数组（保证顺序与 xAxisData 一致）
      const dataMap = new Map(dataPoints.map(d => [d.label, d.value]));
      const data = xAxisData.map(label => dataMap.get(label) || 0);

      return {
        name: keyName,
        data,
      };
    });

    return {
      xAxisData,
      series,
    };
  }

  /**
   * 按小时聚合（今日 24 小时）
   */
  private static aggregateByHour(data: CreditHistoryItem[]): ChartDataPoint[] {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 筛选今日数据
    const todayData = data.filter(item => item.createdAt.startsWith(today));

    // 按小时分组
    const hourMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, 0);
    }

    todayData.forEach(item => {
      const hour = new Date(item.createdAt).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + item.totalCost * 2);
    });

    // 转换为数据点数组
    return Array.from({ length: 24 }, (_, hour) => ({
      label: `${hour.toString().padStart(2, '0')}:00`,
      value: hourMap.get(hour) || 0,
    }));
  }

  /**
   * 按天聚合（最近 N 天）
   */
  private static aggregateByDay(data: CreditHistoryItem[], days: number): ChartDataPoint[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 生成最近 N 天的日期列表
    const dateList: Date[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (days - 1 - i));
      dateList.push(date);
    }

    // 按日期分组
    const dayMap = new Map<string, number>();
    dateList.forEach(date => {
      const dateStr = this.formatDate(date);
      dayMap.set(dateStr, 0);
    });

    data.forEach(item => {
      // 提取日期部分，支持多种格式
      let dateStr = '';
      if (item.createdAt.includes('T')) {
        // ISO 8601 格式：2025-11-28T10:30:00
        dateStr = item.createdAt.split('T')[0];
      } else if (item.createdAt.includes(' ')) {
        // 空格分隔格式：2025-11-28 10:30:00
        dateStr = item.createdAt.split(' ')[0];
      } else if (item.createdAt.length >= 10) {
        // 直接取前10位
        dateStr = item.createdAt.substring(0, 10);
      }

      // 只累加在日期范围内的数据
      if (dateStr && dayMap.has(dateStr)) {
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + item.totalCost * 2);
      }
    });

    // 转换为数据点数组
    return dateList.map(date => {
      const dateStr = this.formatDate(date);
      return {
        label: dateStr,
        value: dayMap.get(dateStr) || 0,
      };
    });
  }

  /**
   * 按 keyId 分组
   */
  private static groupByKeyId(data: CreditHistoryItem[]): Record<string, CreditHistoryItem[]> {
    const grouped: Record<string, CreditHistoryItem[]> = {};

    data.forEach(item => {
      const keyId = item.keyId || '';
      if (!keyId) return; // 跳过没有 keyId 的数据

      if (!grouped[keyId]) {
        grouped[keyId] = [];
      }
      grouped[keyId].push(item);
    });

    return grouped;
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
