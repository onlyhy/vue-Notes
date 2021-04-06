/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 将传入的mixin对象与this.options合并后，将新对象作为this.options传给之后所有的Vue实例
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
