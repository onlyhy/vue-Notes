/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {} //用户传入的一个包含组件向选项的对象参数
    const Super = this // 指向父类，即基础Vue类
    const SuperId = Super.cid // 父类的cid属性，无论是基础 Vue类还是从基础 Vue类继承而来的类，都有一个cid属性，作为该类的唯一标识
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {}) // 缓存池，用于缓存创建出来的类

    // 在缓存池中先尝试获取是否之前已经创建过的该子类，如果之前创建过，则直接返回之前创建的(为了性能考虑)
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 获取选项参数中的name字段，在开发环境下校验name字段是否合法
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 创建一个类Sub，这就是将要继承基础Vue类的子类
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 继承父类原型
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 为子类添加唯一标识cid
    Sub.cid = cid++
    // 合并父类与子类的options后赋予子类的options属性
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 将父类保存到子类的super属性中，以确保子类中能够拿到父类
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.

    // 如果选项中存在props，初始化props(把参数中传入的props选项代理到原型的_props中)
    if (Sub.options.props) {
      initProps(Sub)
    }
    // 初始化computed属性（遍历参数中传入的computed选项，将每一项都调用调用defineComputed函数定义到子类原型上）
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage


    // 将父类中的一些属性复制到子类中
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.

    // 给子类新增三个独有的属性
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 使用父类的cid作为key，创建好的子类作为value，存入缓存池cachedCtors中
    // 最终将创建好的子类Sub返回
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
