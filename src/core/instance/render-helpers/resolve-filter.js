/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 */

//  调用resolveAsset函数并获取其返回值，如果返回值不存在，则返回 identity，identity返回同参数一样的值
export function resolveFilter (id: string): Function {
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
