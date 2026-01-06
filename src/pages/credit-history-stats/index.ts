import {
  Alert,
  Button,
  Card,
  Dialog,
  Option,
  Progress,
  Select,
  Table,
  TableColumn,
  Tag,
  Tooltip,
} from 'element-ui';
import { Component, Vue } from 'vue-property-decorator';
import {
  CreditStatsInstance,
  DisabledKeyRecord,
} from './service/instances/credit-stats';
import { AccountDetail, ApiKeyInfo, CreditHistoryItem } from './service/types';
import CostChart from './components/CostChart.vue';
// 暂时隐藏批量注册兑换码功能
// import RedeemCodeDialog from './components/RedeemCodeDialog.vue';

@Component({
  name: 'CreditHistoryStats',
  components: {
    ElAlert: Alert,
    ElButton: Button,
    ElCard: Card,
    ElDialog: Dialog,
    ElOption: Option,
    ElProgress: Progress,
    ElSelect: Select,
    ElTable: Table,
    ElTableColumn: TableColumn,
    ElTag: Tag,
    ElTooltip: Tooltip,
    CostChart,
    // RedeemCodeDialog, // 暂时隐藏批量注册兑换码功能
  },
})
export default class extends Vue {
  private instance = new CreditStatsInstance();

  // 暂时隐藏批量注册兑换码功能
  // /** 兑换码弹框显示状态 */
  // redeemDialogVisible = false;

  /** 当前选中的 keyId */
  get selectedKeyId(): string {
    return this.instance.selectedKeyId;
  }

  set selectedKeyId(value: string) {
    this.instance.selectKeyId(value);
  }

  /** 当前选中的 key 名称 */
  get selectedKeyName(): string {
    return this.instance.currentKeyName;
  }

  /** API Key 选项列表 */
  get apiKeyOptions(): Array<{ keyId: string; name: string }> {
    return this.instance.apiKeyOptions;
  }

  /** 原始数据（用于图表） */
  get rawData(): CreditHistoryItem[] {
    return this.instance.rawData;
  }

  /** API Key 列表（用于图表） */
  get apiKeyList(): ApiKeyInfo[] {
    return this.instance.apiKeyList;
  }

  /** 筛选后的数据 */
  get tableData(): CreditHistoryItem[] {
    return this.instance.filteredData;
  }

  /** 筛选后记录数 */
  get filteredCount(): number {
    return this.instance.filteredCount;
  }

  /** totalCost 总和（历史累计） */
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

  /** 当前 Key 今日消费 */
  get currentKeyTodayCost(): number {
    return this.instance.currentKeyTodayCost;
  }

  /** 所有 Key 今日消费总和 */
  get allKeysTodayCost(): number {
    return this.instance.allKeysTodayCost;
  }

  /** AI账户详情映射 */
  get accountDetails(): Record<string, AccountDetail> {
    return this.instance.accountDetails;
  }

  /** 获取 AI 账户显示名称 */
  getAccountDisplayName(accountId: string | undefined): string {
    if (!accountId) return '-';
    const account = this.accountDetails[accountId];
    if (!account) return accountId.substring(0, 8);
    return account.shortId || accountId.substring(0, 8);
  }

  /** 格式化费用 */
  formatCost(cost: number): string {
    return cost.toFixed(6);
  }

  /** 格式化令牌数（>=1000 显示为 k） */
  formatTokens(tokens: number): string {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  }

  /** 手动刷新 */
  refresh(): void {
    this.instance.refresh();
  }

  // 暂时隐藏批量注册兑换码功能
  // /** 打开兑换码弹框 */
  // openRedeemDialog(): void {
  //   this.redeemDialogVisible = true;
  // }

  // /** 兑换码激活完成 */
  // onRedeemComplete(): void {
  //   this.instance.refresh();
  // }

  destroyed(): void {
    this.instance.destroy();
  }
}
