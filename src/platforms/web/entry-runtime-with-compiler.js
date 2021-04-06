/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 首先缓存原型上的$mount方法，然后重新定义该方法（原型上的$mount方法在src/platform/web/runtime/index.js中定义）
const mount = Vue.prototype.$mount
// 第一个参数表示挂载的元素，可以是字符串或者DOM对象
// 如果是字符串在浏览器环境下会调用query方法转换成DOM对象
// 第二个参数和服务端渲染相关，在patch函数中用到，浏览器环境下不需要传第二个
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  // vue不能挂载到body,html这样的根节点（由于挂载之后会替换被挂载的对象）
  // Vue会将模板中的内容替换el对应的DOM元素，如果是body或html元素时，替换之后将会破坏整个DOM文档
  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 如果用户没有手写render方法，则会把el或者template字符串转成render方法添加到options上
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          // template是id选择符
          // 获取选择符对应的DOM元素的innerHTML作为模板
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 是一个DOM元素
        template = template.innerHTML
      } else {
        // 既不是字符串也不是DOM元素，抛出警告
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // template不存在，根据传入的el参数调用getOuterHTML函数获取外部模板
      template = getOuterHTML(el)
    }
    // 获取到模板之后，将其编译成渲染函数
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 所有vue组件的渲染最红都需要render方法，这个过程是vue的一个”在线编译“的过程，调用compileToFunctions实现
      // 最后调用原型上的$mount方法实现
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用缓存的$mount方法
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
