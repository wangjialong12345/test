/** 积分历史记录实体 */
export interface CreditHistoryItem {
  /** 记录ID */
  id: number;
  /** 员工ID */
  employeeId: number;
  /** 订阅ID */
  subscriptionId: number;
  /** 操作类型 */
  operationType: string;
  /** 操作类型描述 */
  operationTypeDesc: string;
  /** 积分变动 */
  creditChange: number;
  /** 变动前积分 */
  creditsBefore: number;
  /** 变动后积分 */
  creditsAfter: number;
  /** 描述 */
  description: string;
  /** Key ID（可能需要通过 keyName 映射） */
  keyId?: string;
  /** Key名称 */
  keyName: string;
  /** 请求模型 */
  requestModel: string;
  /** 输入Token数 */
  inputTokens: number;
  /** 输出Token数 */
  outputTokens: number;
  /** 缓存创建Token数 */
  cacheCreateTokens: number;
  /** 缓存读取Token数 */
  cacheReadTokens: number;
  /** 总费用 */
  totalCost: number;
  /** 创建时间 */
  createdAt: string;
  /** 已使用积分 */
  creditsUsed: number;
  /** 剩余积分 */
  remainingCredits: number;
}

/** 默认额度上限（美元） */
export const DEFAULT_COST_LIMIT = 165;

/** API Key 信息 */
export interface ApiKeyInfo {
  /** 记录ID */
  id: number;
  /** Key ID */
  keyId: string;
  /** Key 名称 */
  name: string;
  /** 订阅ID */
  subscriptionId: number | null;
  /** 订阅名称 */
  subscriptionName: string | null;
  /** 描述 */
  description: string | null;
  /** API Key（完整） */
  apiKey: string | null;
  /** 脱敏后的 API Key */
  maskedApiKey: string;
  /** 前缀 */
  prefix: string;
  /** 是否启用 */
  isActive: boolean;
  /** 过期时间 */
  expiresAt: string | null;
  /** 最后使用时间 */
  lastUsedAt: string | null;
  /** 总请求数 */
  totalRequests: number;
  /** 总Token数 */
  totalTokens: number;
  /** 总消费 */
  totalCost: number;
  /** 当前并发数 */
  currentConcurrency: number | null;
  /** 日消费 */
  dailyCost: number | null;
  /** 使用量 */
  usage: number | null;
  /** 员工ID */
  employeeId: number;
  /** 创建人 */
  createdBy: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 查询 API Key 列表 */
export namespace QueryApiKeys {
  /** 查询参数 */
  export interface QueryOptions {
    /** 页码 */
    pageNum: number;
    /** 每页大小 */
    pageSize: number;
  }

  /** 查询结果 */
  export interface QueryResult {
    /** 页码 */
    pageNum: number;
    /** 每页大小 */
    pageSize: number;
    /** 总数 */
    total: number;
    /** 总页数 */
    pages: number;
    /** 列表数据 */
    list: ApiKeyInfo[];
  }
}

/** 查询积分历史 */
export namespace QueryCreditHistory {
  /** 查询参数 */
  export interface QueryOptions {
    /** 页码 */
    pageNum: number;
    /** 每页大小 */
    pageSize: number;
  }

  /** 查询结果 */
  export interface QueryResult {
    /** 页码 */
    pageNum: number;
    /** 每页大小 */
    pageSize: number;
    /** 总数 */
    total: number;
    /** 总页数 */
    pages: number;
    /** 列表数据 */
    list: CreditHistoryItem[];
  }
}

/** 验证码数据 */
export interface CaptchaData {
  /** Base64 编码的验证码图片 */
  captchaBase64Image: string;
  /** 验证码唯一标识 */
  captchaUuid: string;
  /** 过期时间（秒） */
  expireSeconds: number;
}

/** 兑换码激活请求参数 */
export interface RedeemRequest {
  /** 验证码（4位数字） */
  captchaCode: string;
  /** 验证码唯一标识 */
  captchaUuid: string;
  /** 兑换码 */
  code: string;
}

/** 兑换码处理状态 */
export type RedeemStatus = 'pending' | 'success' | 'used';

/** 兑换码处理结果 */
export interface RedeemResult {
  /** 兑换码 */
  code: string;
  /** 处理状态 */
  status: RedeemStatus;
  /** 结果消息 */
  message: string;
  /** 处理时间 */
  timestamp: string;
  /** 重试次数 */
  retryCount: number;
}
