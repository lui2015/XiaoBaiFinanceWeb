/**
 * 统一响应、错误码、错误抛出/捕获工具
 * 与 docs/接口字段详表.md §0 对齐
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const ErrorCode = {
  OK: 0,
  // 通用
  BAD_REQUEST: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  METHOD_NOT_ALLOWED: 1005,
  CONFLICT: 1006,
  TOO_MANY_REQUESTS: 1007,
  INTERNAL_ERROR: 1500,
  // 校验
  VALIDATION_FAILED: 2001,
  // 鉴权
  TOKEN_EXPIRED: 2101,
  TOKEN_INVALID: 2102,
  CAPTCHA_REQUIRED: 2103,
  CAPTCHA_INVALID: 2104,
  ACCOUNT_LOCKED: 2105,
  ACCOUNT_BANNED: 2106,
  ACCOUNT_NOT_EXIST: 2107,
  PASSWORD_INVALID: 2108,
  // 短信
  SMS_RATE_LIMITED: 2201,
  SMS_DAILY_LIMITED: 2202,
  SMS_CODE_INVALID: 2203,
  SMS_CODE_EXPIRED: 2204,
  // 内容
  ARTICLE_NOT_PUBLISHED: 3001,
  CONTENT_SANITIZE_BLOCKED: 3002,
  UPLOAD_FILE_INVALID: 3003,
  UPLOAD_FILE_TOO_LARGE: 3004,
  // 业务
  ALREADY_FAVORITED: 4001,
  ALREADY_LIKED: 4002,
} as const;
export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export class ApiError extends Error {
  code: ErrorCodeType;
  httpStatus: number;
  details?: unknown;
  constructor(code: ErrorCodeType, message: string, httpStatus = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export const ApiErrors = {
  badRequest: (msg = '请求参数错误', details?: unknown) =>
    new ApiError(ErrorCode.BAD_REQUEST, msg, 400, details),
  unauthorized: (msg = '未登录或登录已失效') =>
    new ApiError(ErrorCode.UNAUTHORIZED, msg, 401),
  forbidden: (msg = '无权操作') =>
    new ApiError(ErrorCode.FORBIDDEN, msg, 403),
  notFound: (msg = '资源不存在') =>
    new ApiError(ErrorCode.NOT_FOUND, msg, 404),
  conflict: (msg = '资源冲突') =>
    new ApiError(ErrorCode.CONFLICT, msg, 409),
  tooMany: (msg = '请求过于频繁') =>
    new ApiError(ErrorCode.TOO_MANY_REQUESTS, msg, 429),
  internal: (msg = '服务器内部错误') =>
    new ApiError(ErrorCode.INTERNAL_ERROR, msg, 500),
};

export function ok<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(
    { code: 0, message: 'ok', data, traceId: makeTraceId() },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function fail(err: unknown) {
  const traceId = makeTraceId();
  if (err instanceof ApiError) {
    return NextResponse.json(
      { code: err.code, message: err.message, data: err.details ?? null, traceId },
      { status: err.httpStatus },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        code: ErrorCode.VALIDATION_FAILED,
        message: '参数校验失败',
        data: err.flatten().fieldErrors,
        traceId,
      },
      { status: 400 },
    );
  }
  console.error('[api-error]', traceId, err);
  return NextResponse.json(
    { code: ErrorCode.INTERNAL_ERROR, message: '服务器内部错误', data: null, traceId },
    { status: 500 },
  );
}

export function makeTraceId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function apiHandler<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

/** 把 BigInt 安全序列化为字符串 / number */
export function jsonSafe<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val)),
  );
}
