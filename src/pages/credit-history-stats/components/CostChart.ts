import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { Select, Option, RadioGroup, RadioButton } from 'element-ui';
import { ApiKeyInfo, CreditHistoryItem } from '../service/types';
import {
  ChartDataProcessor,
  TimeRange,
  DisplayMode,
} from '../service/chart-data-processor';

// 注册 ECharts 组件（按需引入）
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

@Component({
  name: 'CostChart',
  components: {
    ElSelect: Select,
    ElOption: Option,
    ElRadioGroup: RadioGroup,
    ElRadioButton: RadioButton,
  },
})
export default class extends Vue {
  /** 原始消费数据 */
  @Prop({ type: Array, required: true })
  readonly rawData!: CreditHistoryItem[];

  /** API Key 列表 */
  @Prop({ type: Array, required: true })
  readonly apiKeyList!: ApiKeyInfo[];

  /** 时间范围 */
  timeRange: TimeRange = '24h';

  /** 显示模式 */
  displayMode: DisplayMode = 'summary';

  /** ECharts 实例 */
  private chartInstance: echarts.ECharts | null = null;

  /** Resize 监听器 */
  private resizeHandler: (() => void) | null = null;

  mounted(): void {
    this.initChart();
    this.updateChart();

    // 绑定窗口 resize 事件
    this.resizeHandler = () => {
      this.chartInstance?.resize();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  beforeDestroy(): void {
    // 移除 resize 监听
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // 销毁 ECharts 实例
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  }

  /**
   * 监听时间范围变化
   */
  @Watch('timeRange')
  onTimeRangeChange(): void {
    this.updateChart();
  }

  /**
   * 监听显示模式变化
   */
  @Watch('displayMode')
  onDisplayModeChange(): void {
    this.updateChart();
  }

  /**
   * 监听原始数据变化
   */
  @Watch('rawData')
  onRawDataChange(): void {
    this.updateChart();
  }

  /**
   * 监听 API Key 列表变化
   */
  @Watch('apiKeyList')
  onApiKeyListChange(): void {
    this.updateChart();
  }

  /**
   * 初始化 ECharts 实例
   */
  private initChart(): void {
    const chartRef = this.$refs.chartRef as HTMLElement;
    if (!chartRef) {
      console.error('[CostChart] chartRef 未找到');
      return;
    }

    this.chartInstance = echarts.init(chartRef);
  }

  /**
   * 更新图表
   */
  private updateChart(): void {
    if (!this.chartInstance) {
      return;
    }

    // 调试：输出原始数据信息
    console.log('[CostChart] 原始数据总数:', this.rawData.length);
    if (this.rawData.length > 0) {
      console.log('[CostChart] 第一条数据示例:', this.rawData[0]);
      console.log('[CostChart] 最后一条数据示例:', this.rawData[this.rawData.length - 1]);
    }

    // 处理数据
    const chartData = ChartDataProcessor.processChartData(
      this.rawData,
      this.apiKeyList,
      this.timeRange,
      this.displayMode
    );

    // 调试：输出处理后的数据
    console.log('[CostChart] 时间范围:', this.timeRange);
    console.log('[CostChart] 显示模式:', this.displayMode);
    console.log('[CostChart] 处理后的数据:', chartData);

    // 生成 ECharts 配置
    const option = this.generateChartOption(chartData);

    // 更新图表（非合并模式，完全替换）
    this.chartInstance.setOption(option, { notMerge: true });
  }

  /**
   * 生成 ECharts 配置
   */
  private generateChartOption(chartData: {
    xAxisData: string[];
    series: Array<{ name: string; data: number[] }>;
  }): EChartsOption {
    const isMobile = window.innerWidth < 768;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) {
            return '';
          }

          const time = params[0].axisValue;
          let html = `<div style="font-weight: bold; margin-bottom: 8px;">${time}</div>`;

          params.forEach((item: any) => {
            const color = item.color;
            const name = item.seriesName;
            const value = item.value;
            html += `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
                <span>${name}: $${value.toFixed(6)}</span>
              </div>
            `;
          });

          return html;
        },
      },
      legend: {
        type: 'scroll',
        data: chartData.series.map(s => s.name),
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartData.xAxisData,
        axisLabel: {
          rotate: isMobile ? 45 : 0,
          fontSize: isMobile ? 10 : 12,
        },
      },
      yAxis: {
        type: 'value',
        name: '消费金额 ($)',
        axisLabel: {
          formatter: (value: number) => `$${value.toFixed(2)}`,
        },
      },
      series: chartData.series.map(s => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        areaStyle: {
          opacity: 0.2,
        },
      })),
    };
  }
}
