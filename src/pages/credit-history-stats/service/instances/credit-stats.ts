import { model } from '../model';
import { ApiKeyInfo, CreditHistoryItem } from '../types';

/** 已禁用的 Key 存储 key */
const STORAGE_KEY_DISABLED = 'credit-stats-disabled-keys';

/** 选中的 keyName 存储 key */
const STORAGE_KEY_SELECTED = 'credit-stats-selected-key';

/** 已禁用 Key 的记录 */
export interface DisabledKeyRecord {
  keyId: string;
  keyName: string;
  disabledAt: string;
  costAtDisable: number;
}

/** 积分统计实例 */
export class CreditStatsInstance {
  selectedKeyName: string = '';
  disabledKeys: Record<string, DisabledKeyRecord> = {};
  apiKeyList: ApiKeyInfo[] = [];
  lastUpdatedAt: string | null = null;

  /** 原始数据 */
  private _rawData: CreditHistoryItem[] = [];
  private _totalCount: number = 0;
  private _isLoading: boolean = false;
  private _isRefetching: boolean = false;
  private _error: Error | null = null;

  /** 定时器 */
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  /** 轮询间隔 */
  private readonly pollingInterval = 60000; // 60秒

  constructor() {
    this.loadDisabledKeys();
    this.loadSelectedKeyName();

    // 初始化
    this.init();
  }

  private async init(): Promise<void> {
    // 获取 Key 列表
    await this.fetchApiKeyList();
    // 获取历史数据
    await this.fetchCreditHistory();
    // 启动定时器
    this.startPolling();
  }

  /** 获取 API Key 列表 */
  private async fetchApiKeyList(): Promise<void> {
    try {
      const response = await model.queryApiKeys({ pageNum: 1, pageSize: 100 });
      if (response.ok && response.data?.list) {
        this.apiKeyList = response.data.list;

        if (!this.selectedKeyName || !this.apiKeyList.some((k) => k.name === this.selectedKeyName)) {
          if (this.apiKeyList.length > 0) {
            this.selectedKeyName = this.apiKeyList[0].name;
            this.saveSelectedKeyName();
          }
        }
      }
    } catch (error) {
      console.error('[CreditStats] 获取 API Key 列表失败:', error);
    }
  }

  /** 获取积分历史 */
  private async fetchCreditHistory(): Promise<void> {
    const isFirstLoad = this._rawData.length === 0;

    if (isFirstLoad) {
      this._isLoading = true;
    } else {
      this._isRefetching = true;
    }
    this._error = null;

    try {
      const response = await model.queryCreditHistory({ pageNum: 1, pageSize: 10000 });
      if (response.code === 0 && response.data) {
        this._rawData = response.data.list || [];
        this._totalCount = response.data.total || 0;
        this.lastUpdatedAt = new Date().toLocaleString('zh-CN');

        // 检查超额
        await this.checkAndDisableOverLimitKeys();
      } else {
        this._error = new Error(response.msg || '获取数据失败');
      }
    } catch (error) {
      this._error = error as Error;
      console.error('[CreditStats] 获取积分历史失败:', error);
    } finally {
      this._isLoading = false;
      this._isRefetching = false;
    }
  }

  /** 启动轮询 */
  private startPolling(): void {
    this.pollingTimer = setInterval(() => {
      this.fetchCreditHistory();
    }, this.pollingInterval);
  }

  /** 停止轮询 */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /** 选择 keyName */
  selectKeyName(keyName: string): void {
    this.selectedKeyName = keyName;
    this.saveSelectedKeyName();
  }

  get keyNameList(): string[] {
    return this.apiKeyList.map((k) => k.name);
  }

  get rawData(): CreditHistoryItem[] {
    return this._rawData;
  }

  get filteredData(): CreditHistoryItem[] {
    return this._rawData.filter((item) => item.keyName === this.selectedKeyName);
  }

  get filteredCount(): number {
    return this.filteredData.length;
  }

  get totalCostSum(): number {
    return this.filteredData.reduce((sum, item) => sum + item.totalCost, 0);
  }

  get totalCount(): number {
    return this._totalCount;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get isRefetching(): boolean {
    return this._isRefetching;
  }

  get error(): Error | null {
    return this._error;
  }

  /** 手动刷新 */
  refresh(): void {
    this.fetchCreditHistory();
  }

  // ========== Key 选择相关 ==========

  private loadSelectedKeyName(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SELECTED);
      if (stored) {
        this.selectedKeyName = stored;
      }
    } catch { /* ignore */ }
  }

  private saveSelectedKeyName(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED, this.selectedKeyName);
    } catch { /* ignore */ }
  }

  /** 获取指定 keyName 的当前总消费 */
  private getCurrentCostForKeyName(keyName: string): number {
    return this._rawData
      .filter((item) => item.keyName === keyName)
      .reduce((sum, item) => sum + item.totalCost, 0);
  }

  // ========== Key 状态相关 ==========

  private loadDisabledKeys(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DISABLED);
      if (stored) {
        this.disabledKeys = JSON.parse(stored);
      }
    } catch {
      this.disabledKeys = {};
    }
  }

  private saveDisabledKeys(): void {
    try {
      localStorage.setItem(STORAGE_KEY_DISABLED, JSON.stringify(this.disabledKeys));
    } catch { /* ignore */ }
  }

  private async checkAndDisableOverLimitKeys(): Promise<void> {
    const costLimit = 165; // 通用限额

    for (const keyInfo of this.apiKeyList) {
      const { keyId, name: keyName, isActive } = keyInfo;
      if (!isActive) continue;

      // 跳过名为 "claude" 的 key，它没有限额
      if (keyName === 'claude') {
        continue;
      }

      const currentCost = this.getCurrentCostForKeyName(keyName);

      if (currentCost >= costLimit) {
        console.log(`[CreditStats] ${keyName} 消费 ${currentCost.toFixed(2)} 已超过限额 ${costLimit}，正在禁用...`);
        try {
          const response = await model.toggleKeyStatus(keyId);
          if (response.ok) {
            keyInfo.isActive = false;

            this.disabledKeys[keyId] = {
              keyId,
              keyName,
              disabledAt: new Date().toLocaleString('zh-CN'),
              costAtDisable: currentCost,
            };
            this.saveDisabledKeys();
          }
        } catch (error) {
          console.error(`[CreditStats] 禁用 ${keyName} 出错:`, error);
        }
      }
    }
  }

  get currentApiKeyInfo(): ApiKeyInfo | null {
    return this.apiKeyList.find((k) => k.name === this.selectedKeyName) || null;
  }

  get currentLimit(): number {
    // claude key 没有限额
    if (this.selectedKeyName === 'claude') {
      return 0;
    }
    return 165; // 其他 key 都有 165 美元限额
  }

  get isCurrentKeyDisabled(): boolean {
    const keyInfo = this.currentApiKeyInfo;
    if (!keyInfo) return false;
    return !keyInfo.isActive;
  }

  get currentDisabledRecord(): DisabledKeyRecord | null {
    const keyInfo = this.currentApiKeyInfo;
    if (!keyInfo) return null;
    return this.disabledKeys[keyInfo.keyId] || null;
  }

  get usagePercentage(): number {
    if (!this.currentLimit) return 0;
    return (this.totalCostSum / this.currentLimit) * 100;
  }

  destroy(): void {
    this.stopPolling();
  }
}
