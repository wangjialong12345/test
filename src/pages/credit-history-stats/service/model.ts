/* eslint-disable lines-between-class-members */
import axios from 'axios';
import { QueryApiKeys, QueryCreditHistory, CaptchaData, RedeemRequest } from './types';

/** 接口响应结构（该接口响应格式与项目标准不同） */
interface CreditHistoryResponse<T> {
  code: number;
  msg: string;
  ok: boolean;
  data: T;
}

/** 外部接口基础地址 */
const EXTERNAL_BASE_URL = 'https://www.88code.org';

const instance = axios.create({
  baseURL: EXTERNAL_BASE_URL,
  timeout: 30000,
});

/** 认证 Token（从 88code.org 获取） */
const AUTH_TOKEN = 'b42b9475a136455092963c868ee1acef';

instance.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  return config;
});

/** 兑换码接口基础地址 */
const REDEEM_BASE_URL = 'https://www.88code.ai';

const redeemInstance = axios.create({
  baseURL: REDEEM_BASE_URL,
  timeout: 30000,
});

redeemInstance.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  return config;
});

export default class Model {
  static readonly URL_OF_QUERY_CREDIT_HISTORY =
    '/admin-api/cc-admin/system/subscription/my/credit-history';

  static readonly URL_OF_TOGGLE_KEY_STATUS =
    '/admin-api/cc-admin/api-key/toggle-status';

  static readonly URL_OF_QUERY_API_KEYS = '/admin-api/cc-admin/api-key/query';

  static readonly URL_OF_GET_CAPTCHA = '/admin-api/login/getCaptcha';

  static readonly URL_OF_REDEEM_CODE = '/admin-api/cc-admin/system/redeem-code/redeem';

  async queryCreditHistory(
    options: QueryCreditHistory.QueryOptions
  ): Promise<CreditHistoryResponse<QueryCreditHistory.QueryResult>> {
    const { data } = await instance.get<
      CreditHistoryResponse<QueryCreditHistory.QueryResult>
    >(Model.URL_OF_QUERY_CREDIT_HISTORY, {
      params: options,
    });
    return data;
  }

  /** 切换 API Key 状态（禁用/启用） */
  async toggleKeyStatus(
    keyId: string
  ): Promise<CreditHistoryResponse<boolean>> {
    const { data } = await instance.post<CreditHistoryResponse<boolean>>(
      `${Model.URL_OF_TOGGLE_KEY_STATUS}/${keyId}`
    );
    return data;
  }

  /** 查询 API Key 列表 */
  async queryApiKeys(
    options: QueryApiKeys.QueryOptions
  ): Promise<CreditHistoryResponse<QueryApiKeys.QueryResult>> {
    const { data } = await instance.post<
      CreditHistoryResponse<QueryApiKeys.QueryResult>
    >(Model.URL_OF_QUERY_API_KEYS, options);
    return data;
  }

  /** 获取验证码 */
  async getCaptcha(): Promise<CreditHistoryResponse<CaptchaData>> {
    const { data } = await redeemInstance.get<CreditHistoryResponse<CaptchaData>>(
      Model.URL_OF_GET_CAPTCHA
    );
    return data;
  }

  /** 兑换码激活 */
  async redeemCode(
    request: RedeemRequest
  ): Promise<CreditHistoryResponse<unknown>> {
    const { data } = await redeemInstance.post<CreditHistoryResponse<unknown>>(
      Model.URL_OF_REDEEM_CODE,
      request
    );
    return data;
  }
}

export const model = new Model();
