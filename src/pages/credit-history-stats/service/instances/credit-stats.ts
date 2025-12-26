import { model } from '../model';
import { ApiKeyInfo, CreditHistoryItem } from '../types';

/** 已禁用的 Key 存储 key */
const STORAGE_KEY_DISABLED = 'credit-stats-disabled-keys';

/** 选中的 keyId 存储 key */
const STORAGE_KEY_SELECTED = 'credit-stats-selected-key-id';

/** 旧的选中 keyName 存储 key（用于迁移） */
const STORAGE_KEY_SELECTED_OLD = 'credit-stats-selected-key';

/** 已禁用 Key 的记录 */
export interface DisabledKeyRecord {
  keyId: string;
  keyName: string;
  disabledAt: string;
  costAtDisable: number;
}

/** 积分统计实例 */
export class CreditStatsInstance {
  selectedKeyId: string = '';
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
    this.loadSelectedKeyId();

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

        // 迁移逻辑：如果没有新的 keyId，尝试从旧的 keyName 迁移
        if (!this.selectedKeyId) {
          this.migrateFromOldStorage();
        }

        // 验证选中的 keyId 是否存在
        if (!this.selectedKeyId || !this.apiKeyList.some((k) => k.keyId === this.selectedKeyId)) {
          if (this.apiKeyList.length > 0) {
            this.selectedKeyId = this.apiKeyList[0].keyId;
            this.saveSelectedKeyId();
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
        // 获取原始数据
        let rawList = response.data.list || [];

        // 为每条记录补充 keyId（如果 API 返回的数据没有 keyId）
        rawList = rawList.map((item) => {
          // 如果已经有 keyId，直接返回
          if (item.keyId) {
            return item;
          }
          // 否则通过 keyName 查找对应的 keyId
          const matchedKey = this.apiKeyList.find((k) => k.name === item.keyName);
          return {
            ...item,
            keyId: matchedKey?.keyId || '', // 如果找不到就设为空字符串
          };
        });

        this._rawData = rawList;
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
      this.fetchApiKeyList(); // 同时刷新 API Key 列表以获取最新的累计消费
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

  /** 选择 keyId */
  selectKeyId(keyId: string): void {
    this.selectedKeyId = keyId;
    this.saveSelectedKeyId();
  }

  get apiKeyOptions(): Array<{ keyId: string; name: string }> {
    return this.apiKeyList.map((k) => ({ keyId: k.keyId, name: k.name }));
  }

  get rawData(): CreditHistoryItem[] {
    return this._rawData;
  }

  get filteredData(): CreditHistoryItem[] {
    if (!this.selectedKeyId) return [];
    return this._rawData.filter((item) => item.keyId === this.selectedKeyId);
  }

  get filteredCount(): number {
    return this.filteredData.length;
  }

  get totalCostSum(): number {
    return this.currentApiKeyInfo?.totalCost ?? 0;
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
    this.fetchApiKeyList(); // 同时刷新 API Key 列表以获取最新的累计消费
    this.fetchCreditHistory();
  }

  // ========== Key 选择相关 ==========

  private loadSelectedKeyId(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SELECTED);
      if (stored) {
        this.selectedKeyId = stored;
      }
    } catch { /* ignore */ }
  }

  private saveSelectedKeyId(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED, this.selectedKeyId);
    } catch { /* ignore */ }
  }

  /** 从旧的 keyName 存储迁移到 keyId */
  private migrateFromOldStorage(): void {
    try {
      const oldKeyName = localStorage.getItem(STORAGE_KEY_SELECTED_OLD);
      if (oldKeyName) {
        // 根据旧的 keyName 找到对应的 keyId
        const matchedKey = this.apiKeyList.find((k) => k.name === oldKeyName);
        if (matchedKey) {
          this.selectedKeyId = matchedKey.keyId;
          this.saveSelectedKeyId();
          // 删除旧的存储
          localStorage.removeItem(STORAGE_KEY_SELECTED_OLD);
          console.log(`[CreditStats] 已从旧存储迁移: ${oldKeyName} -> ${matchedKey.keyId}`);
        }
      }
    } catch (error) {
      console.error('[CreditStats] 迁移旧存储失败:', error);
    }
  }

  /** 获取指定 keyId 的历史累计消费（直接使用 API 返回的 totalCost） */
  private getTotalCostForKeyId(keyId: string): number {
    return this.apiKeyList.find((k) => k.keyId === keyId)?.totalCost ?? 0;
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
    for (const keyInfo of this.apiKeyList) {
      const { keyId, name: keyName, isActive, description } = keyInfo;
      if (!isActive) continue;

      // 跳过名为 "claude自动" 的 key，它没有限额
      if (keyName === 'claude自动') {
        continue;
      }

      // 从 description 字段解析额度，如果没有配置则使用默认的 165
      const costLimit = this.parseCostLimitFromDescription(description);
      if (costLimit === 0) continue; // 无限额

      // 使用 API 返回的累计消费来判断是否超额
      const totalCost = this.getTotalCostForKeyId(keyId);

      if (totalCost >= costLimit) {
        console.log(`[CreditStats] ${keyName} (${keyId}) 历史累计消费 ${totalCost.toFixed(2)} 已超过限额 ${costLimit}，正在禁用...`);
        try {
          const response = await model.toggleKeyStatus(keyId);
          if (response.ok) {
            keyInfo.isActive = false;

            this.disabledKeys[keyId] = {
              keyId,
              keyName,
              disabledAt: new Date().toLocaleString('zh-CN'),
              costAtDisable: totalCost,
            };
            this.saveDisabledKeys();
          }
        } catch (error) {
          console.error(`[CreditStats] 禁用 ${keyName} (${keyId}) 出错:`, error);
        }
      }
    }
  }

  get currentApiKeyInfo(): ApiKeyInfo | null {
    return this.apiKeyList.find((k) => k.keyId === this.selectedKeyId) || null;
  }

  get currentKeyName(): string {
    return this.currentApiKeyInfo?.name || '';
  }

  get currentLimit(): number {
    // "claude自动" key 没有限额
    if (this.currentKeyName === 'claude自动') {
      return 0;
    }
    // 从当前 key 的 description 字段解析额度
    const description = this.currentApiKeyInfo?.description;
    return this.parseCostLimitFromDescription(description);
  }

  /** 从 description 字段解析额度 */
  private parseCostLimitFromDescription(description: string | null | undefined): number {
    if (!description) {
      return 165; // 默认 165 美元
    }
    // 尝试解析数字
    const parsed = parseFloat(description);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    return 165; // 无法解析则使用默认值
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
