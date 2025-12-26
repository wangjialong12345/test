import { createWorker, Worker, PSM } from 'tesseract.js';

/**
 * OCR 服务 - 用于识别验证码图片中的数字
 */
class OCRService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化 Tesseract Worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = await createWorker({
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js',
      });

      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });

      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  /**
   * 识别验证码图片
   * @param base64Image Base64 编码的图片数据
   * @returns 识别结果（4位数字）或 null
   */
  async recognizeCaptcha(base64Image: string): Promise<string | null> {
    try {
      await this.initialize();
    } catch (initError) {
      console.error('OCR 初始化失败:', initError);
      return null;
    }

    if (!this.worker) {
      console.error('OCR Worker 未初始化');
      return null;
    }

    try {
      const processedImage = await this.preprocessImage(base64Image);
      console.log('[OCR] 图像预处理完成，开始识别...');

      const { data: { text, confidence } } = await this.worker.recognize(processedImage);
      console.log(`[OCR] 识别结果: "${text}", 置信度: ${confidence}`);

      const result = this.validateResult(text);
      if (result) {
        console.log(`[OCR] 验证通过: ${result}`);
      } else {
        console.log(`[OCR] 验证失败，原始文本: "${text}"`);
      }
      return result;
    } catch (error) {
      console.error('OCR 识别失败:', error);
      return null;
    }
  }

  /**
   * 图像预处理 - 针对彩色干扰验证码
   * 特点：大号彩色数字 + 小号彩色干扰文字 + 细线
   * 策略：使用开运算（先腐蚀后膨胀）去除细小元素，保留粗笔画数字
   */
  private async preprocessImage(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取 Canvas 上下文'));
          return;
        }

        // 放大图像 (4倍 -> 约 300 DPI)
        const scale = 4;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // 创建二值图像数组
        const binary = new Uint8Array(width * height);

        // 第一步：提取所有彩色像素（数字和干扰都是彩色的）
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;

            // 彩色像素：饱和度高且不是纯白/纯黑
            if (saturation > 0.2 && max > 50 && max < 250) {
              binary[y * width + x] = 1; // 前景
            }
          }
        }

        // 第二步：强力腐蚀 - 去除细线和小字（腐蚀半径 3）
        const erodeRadius = 3;
        const eroded = new Uint8Array(width * height);
        for (let y = erodeRadius; y < height - erodeRadius; y++) {
          for (let x = erodeRadius; x < width - erodeRadius; x++) {
            // 只有当周围全是前景时才保留
            let allForeground = true;
            outer: for (let dy = -erodeRadius; dy <= erodeRadius; dy++) {
              for (let dx = -erodeRadius; dx <= erodeRadius; dx++) {
                if (binary[(y + dy) * width + (x + dx)] === 0) {
                  allForeground = false;
                  break outer;
                }
              }
            }
            if (allForeground) {
              eroded[y * width + x] = 1;
            }
          }
        }

        // 第三步：膨胀 - 恢复数字大小（膨胀半径 4，比腐蚀大一点）
        const dilateRadius = 4;
        const dilated = new Uint8Array(width * height);
        for (let y = dilateRadius; y < height - dilateRadius; y++) {
          for (let x = dilateRadius; x < width - dilateRadius; x++) {
            if (eroded[y * width + x] === 1) {
              // 膨胀周围像素
              for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
                for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
                  dilated[(y + dy) * width + (x + dx)] = 1;
                }
              }
            }
          }
        }

        // 第四步：应用结果到图像
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (dilated[y * width + x] === 1) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            } else {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log('[OCR] 预处理完成，图像尺寸:', width, 'x', height);

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = base64Image;
    });
  }

  /**
   * Otsu 阈值算法
   */
  private otsuThreshold(data: Uint8ClampedArray): number {
    const histogram = new Array(256).fill(0);
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
      total++;
    }

    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;

      wF = total - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    return threshold;
  }

  /**
   * 验证识别结果 - 尝试提取4位数字
   */
  private validateResult(text: string): string | null {
    // 移除所有空白字符
    const cleaned = text.replace(/\s/g, '');
    // 只保留数字
    const digits = cleaned.replace(/[^0-9]/g, '');

    // 如果正好4位数字，直接返回
    if (digits.length === 4) {
      return digits;
    }

    // 如果多于4位，取前4位
    if (digits.length > 4) {
      return digits.substring(0, 4);
    }

    // 少于4位，返回 null
    return null;
  }

  /**
   * 销毁 Worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

export const ocrService = new OCRService();
