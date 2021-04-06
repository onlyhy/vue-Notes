import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 用Function实现的类，通过new Vue去实例化
// 不用ES6的class实现的原因：xxxMixin函数的调用，把Vue当参数传入，它的功能都是在给Vue的prototype上扩展方法，按功能扩散到多个模块中，不是在一个模块中实现所有，用class难以实现
// 且这样做方便维护和管理代码

// new Vue()的主要逻辑就是：合并配置，调用一些初始化函数，触发生命周期钩子函数，调用$mount开启下一个阶段。
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用_init进行一些初始化工作
  // 核心
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
