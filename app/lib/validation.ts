import { z } from 'zod'

const UUIDSchema = z.uuid()

/**
 * 校验 start_cursor 参数
 * @param startCursor - 从查询参数中获取的 startCursor 值
 * @throws 如果校验失败会抛出错误
 */
export function validateStartCursor(startCursor: unknown): string | undefined {
  // 检查是否为数组
  if (Array.isArray(startCursor)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'start_cursor must be a string or undefined',
    })
  }

  // 检查类型
  if (startCursor !== undefined && typeof startCursor !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'start_cursor must be a string or undefined',
    })
  }

  if (startCursor !== undefined && !UUIDSchema.safeParse(startCursor).success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'start_cursor must be a valid UUID',
    })
  }

  return startCursor
}

/**
 * 校验其他查询参数的通用函数
 * @param value - 要校验的值
 * @param paramName - 参数名称
 * @param schema - Zod schema
 */
export function validateQueryParam<T>(
  value: unknown,
  paramName: string,
  schema: z.ZodSchema<T>,
): T | undefined {
  // 检查是否为数组
  if (Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${paramName} must be a single value`,
    })
  }

  // 如果未提供，返回 undefined
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  // 使用 schema 校验
  const result = schema.safeParse(value)
  if (!result.success) {
    const errorMessages = result.error.issues.map(issue => issue.message).join(', ')
    throw createError({
      statusCode: 400,
      statusMessage: `${paramName} is invalid: ${errorMessages}`,
    })
  }

  return result.data
}

/**
 * 校验主查询参数的通用函数，不能为undefined，其余与validateQueryParam相同
 * @param value - 要校验的值
 * @param paramName - 参数名称
 * @param schema - Zod schema
 */
export function validateMainParam<T>(
  value: unknown,
  paramName: string,
  schema: z.ZodSchema<T>,
): T {
  if (value === undefined || value === null || value === '') {
    throw createError({
      statusCode: 400,
      statusMessage: `${paramName} must be defined`,
    })
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: `${paramName} is invalid: ${result.error.issues.map(issue => issue.message).join(', ')}`,
    })
  }
  return result.data
}
