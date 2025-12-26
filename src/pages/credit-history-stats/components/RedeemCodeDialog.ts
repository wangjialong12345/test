import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { RedeemBatchInstance } from '../service/instances/redeem-batch';
import { RedeemResult } from '../service/types';
import { ocrService, OCRStatus } from '../service/ocr-service';

@Component({
  name: 'RedeemCodeDialog',
})
export default class RedeemCodeDialog extends Vue {
  @Prop({ type: Boolean, required: true })
  readonly visible!: boolean;

  private instance = new RedeemBatchInstance();
  inputText = '';

  /** OCR 状态 */
  ocrStatus: OCRStatus = 'idle';

  get dialogVisible(): boolean {
    return this.visible;
  }

  set dialogVisible(val: boolean) {
    this.$emit('update:visible', val);
  }

  get codeCount(): number {
    return this.parseCodes().length;
  }

  get isProcessing(): boolean {
    return this.instance.isProcessing;
  }

  /** OCR 是否正在加载 */
  get isOCRLoading(): boolean {
    return this.ocrStatus === 'loading';
  }

  /** OCR 是否加载失败 */
  get isOCRError(): boolean {
    return this.ocrStatus === 'error';
  }

  /** 是否可以开始（OCR 就绪且有兑换码） */
  get canStart(): boolean {
    return this.ocrStatus === 'ready' && this.codeCount > 0 && !this.isProcessing;
  }

  get progress(): number {
    return this.instance.progress;
  }

  get progressStatus(): 'success' | 'exception' | 'warning' | undefined {
    if (this.progress === 100) {
      if (this.instance.successCount > 0) {
        return 'success';
      }
      return 'warning';
    }
    return undefined;
  }

  get results(): RedeemResult[] {
    return this.instance.results;
  }

  get successCount(): number {
    return this.instance.successCount;
  }

  get usedCount(): number {
    return this.instance.usedCount;
  }

  get failedCount(): number {
    return this.instance.failedCount;
  }

  get pendingCount(): number {
    return this.results.filter((r) => r.status === 'pending').length;
  }

  @Watch('visible')
  onVisibleChange(val: boolean): void {
    if (val) {
      // 对话框打开时预加载 OCR
      this.preloadOCR();
    } else {
      if (!this.isProcessing) {
        this.reset();
      }
    }
  }

  /** 预加载 OCR 服务 */
  private async preloadOCR(): Promise<void> {
    this.ocrStatus = ocrService.status;

    // 监听状态变化
    ocrService.onStatusChange = (status) => {
      this.ocrStatus = status;
      this.$forceUpdate();
    };

    // 如果还未初始化，开始初始化
    if (this.ocrStatus === 'idle' || this.ocrStatus === 'error') {
      try {
        await ocrService.initialize();
      } catch (error) {
        console.error('[RedeemCodeDialog] OCR 初始化失败:', error);
      }
    }
  }

  private parseCodes(): string[] {
    return this.inputText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => this.normalizeCode(line));
  }

  /**
   * 将干扰格式的兑换码转换为正常格式
   * 例如：2WGX干3783扰BQRJ → 2WGX-3783-BQRJ
   */
  private normalizeCode(code: string): string {
    // 提取所有字母和数字
    const chars = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // 如果是12个字符，按 4-4-4 格式重组
    if (chars.length === 12) {
      return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
    }
    // 其他情况保持原样（去除非字母数字后大写）
    return chars;
  }

  async handleStart(): Promise<void> {
    const codes = this.parseCodes();
    if (codes.length === 0) return;

    this.instance.onUpdate = () => {
      this.$forceUpdate();
    };

    this.instance.onComplete = () => {
      this.$emit('complete');
      this.$forceUpdate();
    };

    await this.instance.startBatch(codes);
  }

  handleClose(): void {
    if (this.isProcessing) return;
    this.$emit('update:visible', false);
    this.$emit('close');
  }

  private reset(): void {
    this.inputText = '';
    this.instance.reset();
  }
}
