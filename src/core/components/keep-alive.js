/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

// 优先获取组件的name字段，如果name不存在则获取组件的tag
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

/*
  遍历cache，取出每一项的name值，与新的缓存规则匹配
  匹配不上，则新的缓存规则下该组件已经不需要被缓存，调用pruneCacheEntry函数将这个组件实例销毁掉，并从cache对象中剔除
 */
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  // 判断当前没有处于被渲染状态的组件，将其销毁
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

// 函数式组件
export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,    // 匹配到的组件被缓存
    exclude: patternTypes,    // 任何匹配到的组件都不会缓存
    max: [String, Number]     // 缓存组件的数量
  },

  created () {
    // 存储需要缓存的组件
    /*
      this.cache = {
      'key1':'组件1',
      'key2':'组件2',
      // ...
      }
     */
    this.cache = Object.create(null)
    // 存储每个需要缓存的组件的key
    this.keys = []
  },

  destroyed () {
    // 将被缓存的且当前没有处于被渲染状态的组件都销毁掉且从this.cache中剔除
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render () {
    // 获取默认插槽中的第一个组件节点
    const slot = this.$slots.default
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 获取该组件节点的名称
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // 如果name与include规则不匹配或者与exclude规则匹配则表示不缓存，直接返回vnode
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      /* 获取组件的key */
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      /* 如果命中缓存(该组件有缓存)，则直接从缓存中拿 vnode 的组件实例 */
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        /* 调整该组件key的顺序，将其从原来的地方删掉并重新放在最后一个 */
        remove(keys, key)
        keys.push(key)
      } else {
        /* 如果没有命中缓存，则将其设置进缓存 */
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        /* 如果配置了max并且缓存的长度超过了this.max，则从缓存中删除第一个 */
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      /* 最后设置keepAlive标记位 */
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
