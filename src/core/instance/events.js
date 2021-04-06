/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners  //父组件注册的事件
  if (listeners) {
    updateComponentListeners(vm, listeners) // 将父组件向子组件注册的事件注册到子组件的实例中
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

// 事件相关的实例方法
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // 接受两个参数：第一个参数是订阅的事件名（可以是数组，表示订阅多个事件），第二个参数是回调函数（触发所订阅的事件时执行）
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 数组则是订阅多个事件，遍历，将每个事件递归调用$on方法
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 单个事件，以事件名作为key
      // 尝试在当前实例的_events属性中获取其对应的事件列表，如果获取不到就给其赋空数组为默认值，并将第二个参数回调函数添加进去
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }
  // 监听一个自定义事件，只触发一次，一旦触发之后，监听器就会被移除
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 定义一个子函数on
    // 子函数内部先通过$off方法移除订阅的事件，这样确保改事件不会被再次触发
    // 然后再执行原本的回调fn
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    // 因为on替换了原本的fn,导致在_events中存储的事件会变成'xxx':[on]
    // 当触发$off时，xxx对应的回调函数列表中没有fn，会移除失败
    // 因此给on上绑定一个fn，属性值为用户传入的回调fn，这样移除时就能找到
    on.fn = fn
    // 先通过$on方法订阅事件，回调函数不是原本的fn而是子函数on
    // 当event被触发时，会执行子函数on
    vm.$on(event, on)
    return vm
  }
  // 移除自定义事件监听器，根据参数的不同作出不同的处理
  // 如果没有提供参数，则移除所有的事件监听器；
  // 如果只提供了事件，则移除该事件所有的监听器；
  // 如果同时提供了事件与回调，则只移除这个回调的监听器。
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 第一个参数是要触发的事件名，之后的附加参数都会传给被触发事件的回调函数
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 根据传入的事件名从当前实例的_events属性中获取到该事件名对应的回调函数cbs
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 获取传入的附加参数args
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
