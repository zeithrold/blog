import { z } from 'zod'

const UUIDSchema = z.uuid()

/**
 * 校验 uuid 参数
 * @param uuid - 从查询参数中获取的 uuid 值
 * @throws 如果校验失败会抛出错误
 */
export function validateUUID(uuid: unknown): string | undefined {
  // 检查是否为数组
  if (Array.isArray(uuid)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'uuid must be a string or undefined',
    })
  }

  // 检查类型
  if (uuid !== undefined && typeof uuid !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'uuid must be a string or undefined',
    })
  }

  if (uuid !== undefined && !UUIDSchema.safeParse(uuid).success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'uuid must be a valid UUID',
    })
  }

  return uuid
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
