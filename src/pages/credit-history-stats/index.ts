import {
  Alert,
  Button,
  Card,
  Option,
  Progress,
  Select,
  Table,
  TableColumn,
  Tag,
} from 'element-ui';
import { Component, Vue } from 'vue-property-decorator';
import {
  CreditStatsInstance,
  DisabledKeyRecord,
} from './service/instances/credit-stats';
import { CreditHistoryItem } from './service/types';

@Component({
  name: 'CreditHistoryStats',
  components: {
    ElAlert: Alert,
    ElButton: Button,
    ElCard: Card,
    ElOption: Option,
    ElProgress: Progress,
    ElSelect: Select,
    ElTable: Table,
    ElTableColumn: TableColumn,
    ElTag: Tag,
  },
})
export default class extends Vue {
  private instance = new CreditStatsInstance();

  /** 当前选中的 keyName */
  get selectedKeyName(): string {
    return this.instance.selectedKeyName;
  }

  set selectedKeyName(value: string) {
    this.instance.selectKeyName(value);
  }

  /** keyName 列表 */
  get keyNameList(): string[] {
    return this.instance.keyNameList;
  }

  /** 筛选后的数据 */
  get tableData(): CreditHistoryItem[] {
    return this.instance.filteredData;
  }

  /** 筛选后记录数 */
  get filteredCount(): number {
    return this.instance.filteredCount;
  }

  /** totalCost 总和（当前接口） */
  get totalCostSum(): number {
    return this.instance.totalCostSum;
  }

  /** 总记录数 */
  get totalCount(): number {
    return this.instance.totalCount;
  }

  /** 是否正在加载 */
  get isLoading(): boolean {
    return this.instance.isLoading;
  }

  /** 是否正在刷新 */
  get isRefetching(): boolean {
    return this.instance.isRefetching;
  }

  /** 最后更新时间 */
  get lastUpdatedAt(): string | null {
    return this.instance.lastUpdatedAt;
  }

  /** 错误信息 */
  get error(): Error | null {
    return this.instance.error;
  }

  /** 额度限制 */
  get currentLimit(): number {
    return this.instance.currentLimit;
  }

  /** 是否已被禁用 */
  get isCurrentKeyDisabled(): boolean {
    return this.instance.isCurrentKeyDisabled;
  }

  /** 禁用记录 */
  get currentDisabledRecord(): DisabledKeyRecord | null {
    return this.instance.currentDisabledRecord;
  }

  /** 使用百分比 */
  get usagePercentage(): number {
    return this.instance.usagePercentage;
  }

  /** 格式化费用 */
  formatCost(cost: number): string {
    return cost.toFixed(6);
  }

  /** 手动刷新 */
  refresh(): void {
    this.instance.refresh();
  }

  destroyed(): void {
    this.instance.destroy();
  }
}
