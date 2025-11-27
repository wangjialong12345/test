import { model } from '../model';
import { ApiKeyInfo, CreditHistoryItem, DEFAULT_COST_LIMIT } from '../types';

/** 累计消费存储 key */
const STORAGE_KEY_COSTS = 'credit-stats-accumulated-costs-v2';

/** 累计存储间隔（毫秒）- 30分钟 */
const SAVE_INTERVAL = 30 * 60 * 1000;

/** 已禁用的 Key 存储 key */
const STORAGE_KEY_DISABLED = 'credit-stats-disabled-keys';

/** 选中的 keyName 存储 key */
const STORAGE_KEY_SELECTED = 'credit-stats-selected-key';

/** 单个周期的消费记录 */
export interface CostPeriod {
  periodId: string;
  startedAt: string;
  endedAt: string | null;
  periodCost: number;
  lastApiCost: number;
}

/** 累计消费记录 */
interface AccumulatedCostRecord {
  historyPeriods: CostPeriod[];
  currentPeriod: CostPeriod | null;
  lastUpdatedAt: string;
}

type AccumulatedCosts = Record<string, AccumulatedCostRecord>;

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
  accumulatedCosts: AccumulatedCosts = {};
  disabledKeys: Record<string, DisabledKeyRecord> = {};
  apiKeyList: ApiKeyInfo[] = [];
  lastUpdatedAt: string | null = null;
  lastSavedAt: string | null = null;

  /** 原始数据 */
  private _rawData: CreditHistoryItem[] = [];
  private _totalCount: number = 0;
  private _isLoading: boolean = false;
  private _isRefetching: boolean = false;
  private _error: Error | null = null;

  /** 定时器 */
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private keyStatusSyncTimer: ReturnType<typeof setInterval> | null = null;

  /** 轮询间隔 */
  private readonly pollingInterval = 60000; // 60秒
  private readonly keyStatusSyncInterval = 15000; // 15秒

  constructor() {
    this.loadAccumulatedCosts();
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
    this.startSaveTimer();
    this.startKeyStatusSyncTimer();
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

        // 更新累计消费
        this.updateAccumulatedCosts();
        // 检查超额
        await this.syncApiKeyStatusAndCheck();
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

  // ========== 累计消费相关 ==========

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

  private loadAccumulatedCosts(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COSTS);
      if (stored) {
        this.accumulatedCosts = JSON.parse(stored);
        const records = Object.values(this.accumulatedCosts);
        if (records.length > 0) {
          this.lastSavedAt = records[0].lastUpdatedAt;
        }
      }
    } catch {
      this.accumulatedCosts = {};
    }
  }

  private saveAccumulatedCosts(): void {
    try {
      localStorage.setItem(STORAGE_KEY_COSTS, JSON.stringify(this.accumulatedCosts));
      this.lastSavedAt = new Date().toLocaleString('zh-CN');
    } catch { /* ignore */ }
  }

  private updateAccumulatedCosts(): void {
    const now = new Date().toLocaleString('zh-CN');
    const nowTimestamp = Date.now().toString();

    this.apiKeyList.forEach((keyInfo) => {
      const keyName = keyInfo.name;
      const currentApiCost = this.getApiCostForKeyName(keyName);
      let record = this.accumulatedCosts[keyName];

      if (!record) {
        record = {
          historyPeriods: [],
          currentPeriod: {
            periodId: nowTimestamp,
            startedAt: now,
            endedAt: null,
            periodCost: currentApiCost,
            lastApiCost: currentApiCost,
          },
          lastUpdatedAt: now,
        };
        this.accumulatedCosts[keyName] = record;
      } else if (!record.currentPeriod) {
        record.currentPeriod = {
          periodId: nowTimestamp,
          startedAt: now,
          endedAt: null,
          periodCost: currentApiCost,
          lastApiCost: currentApiCost,
        };
        record.lastUpdatedAt = now;
      } else {
        const period = record.currentPeriod;
        if (currentApiCost < period.lastApiCost * 0.8 && period.lastApiCost > 0) {
          period.endedAt = now;
          record.historyPeriods.push({ ...period });
          record.currentPeriod = {
            periodId: nowTimestamp,
            startedAt: now,
            endedAt: null,
            periodCost: currentApiCost,
            lastApiCost: currentApiCost,
          };
        } else {
          const increment = Math.max(0, currentApiCost - period.lastApiCost);
          period.periodCost += increment;
          period.lastApiCost = currentApiCost;
        }
        record.lastUpdatedAt = now;
      }
    });
  }

  private getApiCostForKeyName(keyName: string): number {
    return this._rawData
      .filter((item) => item.keyName === keyName)
      .reduce((sum, item) => sum + item.totalCost, 0);
  }

  private startSaveTimer(): void {
    this.saveAccumulatedCosts();
    this.saveTimer = setInterval(() => {
      this.saveAccumulatedCosts();
    }, SAVE_INTERVAL);
  }

  private stopSaveTimer(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  saveNow(): void {
    this.saveAccumulatedCosts();
  }

  get accumulatedCostSum(): number {
    const record = this.accumulatedCosts[this.selectedKeyName];
    if (!record) return this.totalCostSum;
    const historySum = record.historyPeriods.reduce((sum, period) => sum + period.periodCost, 0);
    const currentSum = record.currentPeriod?.periodCost || 0;
    return historySum + currentSum;
  }

  get currentPeriodCost(): number {
    const record = this.accumulatedCosts[this.selectedKeyName];
    return record?.currentPeriod?.periodCost || this.totalCostSum;
  }

  get historyPeriods(): CostPeriod[] {
    const record = this.accumulatedCosts[this.selectedKeyName];
    return record?.historyPeriods || [];
  }

  get currentPeriod(): CostPeriod | null {
    const record = this.accumulatedCosts[this.selectedKeyName];
    return record?.currentPeriod || null;
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

  private startKeyStatusSyncTimer(): void {
    this.keyStatusSyncTimer = setInterval(() => {
      this.syncApiKeyStatus();
    }, this.keyStatusSyncInterval);
  }

  private stopKeyStatusSyncTimer(): void {
    if (this.keyStatusSyncTimer) {
      clearInterval(this.keyStatusSyncTimer);
      this.keyStatusSyncTimer = null;
    }
  }

  private async syncApiKeyStatus(): Promise<void> {
    try {
      const response = await model.queryApiKeys({ pageNum: 1, pageSize: 100 });
      if (response.ok && response.data?.list) {
        this.apiKeyList = response.data.list;
        for (const keyInfo of response.data.list) {
          if (keyInfo.isActive && this.disabledKeys[keyInfo.keyId]) {
            delete this.disabledKeys[keyInfo.keyId];
            this.saveDisabledKeys();
          }
        }
      }
    } catch (error) {
      console.error('[CreditStats] 同步 API Key 状态失败:', error);
    }
  }

  private async syncApiKeyStatusAndCheck(): Promise<void> {
    await this.syncApiKeyStatus();
    await this.checkAndDisableOverLimitKeys();
  }

  private async checkAndDisableOverLimitKeys(): Promise<void> {
    for (const keyInfo of this.apiKeyList) {
      const { keyId, name: keyName, isActive } = keyInfo;
      if (!isActive) continue;

      const accumulatedCost = this.getAccumulatedCostForKeyName(keyName);
      if (accumulatedCost >= DEFAULT_COST_LIMIT) {
        console.log(`[CreditStats] ${keyName} 累计消费 ${accumulatedCost.toFixed(2)} 已超过限额，正在禁用...`);
        try {
          const response = await model.toggleKeyStatus(keyId);
          if (response.ok) {
            keyInfo.isActive = false;
            this.disabledKeys[keyId] = {
              keyId,
              keyName,
              disabledAt: new Date().toLocaleString('zh-CN'),
              costAtDisable: accumulatedCost,
            };
            this.saveDisabledKeys();
          }
        } catch (error) {
          console.error(`[CreditStats] 禁用 ${keyName} 出错:`, error);
        }
      }
    }
  }

  getAccumulatedCostForKeyName(keyName: string): number {
    const record = this.accumulatedCosts[keyName];
    if (!record) return this.getApiCostForKeyName(keyName);
    const historySum = record.historyPeriods.reduce((sum, period) => sum + period.periodCost, 0);
    const currentSum = record.currentPeriod?.periodCost || 0;
    return historySum + currentSum;
  }

  get currentApiKeyInfo(): ApiKeyInfo | null {
    return this.apiKeyList.find((k) => k.name === this.selectedKeyName) || null;
  }

  get currentLimit(): number {
    return DEFAULT_COST_LIMIT;
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
    return (this.accumulatedCostSum / this.currentLimit) * 100;
  }

  destroy(): void {
    this.stopPolling();
    this.stopSaveTimer();
    this.stopKeyStatusSyncTimer();
    this.saveAccumulatedCosts();
  }
}
