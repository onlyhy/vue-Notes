/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      // 没有传入definition参数，表示获取指令/过滤器，从存放指令的地方根据指令id来读取指令并返回
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        // 传入definition参数，表示注册指令/过滤器
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          // 如果definition对象中不存在name属性时，则使用组件id作为组件的name属性
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        // 如果是函数，则默认监听bind和update两个事件，即将definition函数分别赋给bind和update两个属性
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 如果definition参数不是一个函数，那么即认为它是用户自定义的指令对象，直接将其保存在this.options['directives']中
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
