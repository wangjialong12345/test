import { model } from '../model';
import { RedeemResult, RedeemStatus, CaptchaData } from '../types';
import { ocrService } from '../ocr-service';

/** 单次尝试的结果 */
type AttemptResult = 'success' | 'code_invalid' | 'ocr_failed' | 'captcha_error' | 'network_error' | 'rate_limited';

/**
 * 批量兑换码处理实例
 */
export class RedeemBatchInstance {
  /** 待处理的兑换码列表 */
  codes: string[] = [];

  /** 处理结果列表 */
  results: RedeemResult[] = [];

  /** 是否正在处理 */
  isProcessing = false;

  /** 当前处理的索引 */
  currentIndex = 0;

  /** 最大并发数 */
  maxConcurrency = 1;

  /** 单个码每轮最大尝试次数 */
  maxAttemptsPerCode = 1;

  /** 最大轮次 */
  maxRounds = 10;

  /** 处理完成回调 */
  onComplete: (() => void) | null = null;

  /** 状态更新回调 */
  onUpdate: (() => void) | null = null;

  /**
   * 开始批量处理
   */
  async startBatch(codes: string[]): Promise<void> {
    if (this.isProcessing) return;

    // 过滤空行和去重
    this.codes = [...new Set(codes.filter((c) => c.trim()))];
    this.results = this.codes.map((code) => ({
      code,
      status: 'pending' as RedeemStatus,
      message: '等待处理',
      timestamp: '',
      retryCount: 0,
    }));

    this.isProcessing = true;
    this.currentIndex = 0;

    try {
      await this.processAllRounds();
    } finally {
      this.isProcessing = false;
      this.onComplete?.();
    }
  }

  /**
   * 多轮处理 - 每轮处理所有待处理的兑换码，失败的下一轮再试
   */
  private async processAllRounds(): Promise<void> {
    for (let round = 0; round < this.maxRounds; round++) {
      // 找出需要处理的索引（pending 状态）
      const pendingIndices = this.results
        .map((r, i) => ({ result: r, index: i }))
        .filter(({ result }) => result.status === 'pending')
        .map(({ index }) => index);

      if (pendingIndices.length === 0) {
        console.log(`[Redeem] 第 ${round + 1} 轮：无待处理项，结束`);
        break;
      }

      console.log(`[Redeem] 第 ${round + 1} 轮开始，待处理 ${pendingIndices.length} 个`);

      // 处理本轮所有待处理项
      for (const index of pendingIndices) {
        await this.processOne(index);
      }

      // 检查是否还有需要重试的
      const stillPending = this.results.filter((r) => r.status === 'pending').length;

      if (stillPending === 0) {
        console.log(`[Redeem] 所有兑换码处理完成`);
        break;
      }

      // 等待一段时间后开始下一轮
      if (round < this.maxRounds - 1) {
        console.log(`[Redeem] 等待 2 秒后开始第 ${round + 2} 轮...`);
        await this.sleep(2000);
      }
    }
  }

  /**
   * 处理单个兑换码（每轮只尝试一次）
   */
  private async processOne(index: number): Promise<void> {
    const code = this.codes[index];
    const result = await this.attemptOnce(code);

    switch (result.status) {
      case 'success':
        this.updateResult(index, 'success', '激活成功');
        return;

      case 'code_invalid':
        // 兑换码不存在、已失效、已被使用、格式不正确等都归为已被使用
        this.updateResult(index, 'used', result.message);
        return;

      case 'rate_limited':
        // 请求过于频繁，等待3秒后继续下一个
        console.log('[Redeem] 请求过于频繁，等待3秒...');
        await this.sleep(3000);
        this.updateResult(index, 'pending', '等待下一轮 (请求频繁)');
        return;

      default:
        // OCR失败、验证码错误、网络错误都等下一轮
        this.updateResult(index, 'pending', `等待下一轮 (${result.message})`);
        return;
    }
  }

  /**
   * 单次尝试兑换
   */
  private async attemptOnce(
    code: string
  ): Promise<{ status: AttemptResult; message: string }> {
    try {
      // 1. 获取验证码
      const captchaResult = await this.getCaptcha();
      if (captchaResult.rateLimited) {
        return { status: 'rate_limited', message: '请求过于频繁' };
      }
      if (!captchaResult.data) {
        return { status: 'network_error', message: '获取验证码失败' };
      }

      // 2. OCR 识别
      const captchaCode = await ocrService.recognizeCaptcha(captchaResult.data.captchaBase64Image);

      if (!captchaCode) {
        return { status: 'ocr_failed', message: 'OCR 识别失败' };
      }

      // 3. 提交兑换
      const result = await model.redeemCode({
        captchaCode,
        captchaUuid: captchaResult.data.captchaUuid,
        code,
      });

      if (result.ok || result.code === 0) {
        return { status: 'success', message: '激活成功' };
      }

      const errorMsg = result.msg || '激活失败';

      // 判断错误类型：验证码错误需要重试，其他都是兑换码问题
      if (errorMsg.includes('验证码')) {
        return { status: 'captcha_error', message: errorMsg };
      }

      // 兑换码不存在、已失效、已被使用、格式不正确等都归为 code_invalid
      return { status: 'code_invalid', message: errorMsg };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return { status: 'network_error', message };
    }
  }

  /**
   * 获取验证码
   */
  private async getCaptcha(): Promise<{ data: CaptchaData | null; rateLimited: boolean }> {
    try {
      const response = await model.getCaptcha();
      if (response.ok && response.data) {
        return { data: response.data, rateLimited: false };
      }
      // 检查是否请求过于频繁
      const msg = response.msg || '';
      if (msg.includes('频繁') || msg.includes('稍后')) {
        return { data: null, rateLimited: true };
      }
      return { data: null, rateLimited: false };
    } catch (error) {
      console.error('获取验证码失败:', error);
      return { data: null, rateLimited: false };
    }
  }

  /**
   * 更新结果
   */
  private updateResult(index: number, status: RedeemStatus, message: string): void {
    if (index >= 0 && index < this.results.length) {
      const result = this.results[index];
      result.status = status;
      result.message = message;
      result.timestamp = new Date().toLocaleString('zh-CN');
      this.onUpdate?.();
    }
  }

  /**
   * 获取处理进度百分比
   */
  get progress(): number {
    if (this.results.length === 0) return 0;
    const completed = this.results.filter(
      (r) => r.status === 'success' || r.status === 'used'
    ).length;
    return Math.round((completed / this.results.length) * 100);
  }

  /**
   * 获取成功数量
   */
  get successCount(): number {
    return this.results.filter((r) => r.status === 'success').length;
  }

  /**
   * 获取已被使用数量
   */
  get usedCount(): number {
    return this.results.filter((r) => r.status === 'used').length;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.codes = [];
    this.results = [];
    this.isProcessing = false;
    this.currentIndex = 0;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const redeemBatchInstance = new RedeemBatchInstance();
