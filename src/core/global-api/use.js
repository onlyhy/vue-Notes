/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 用来存储已安装过的插件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 首先判断插件是否已存在，存在则直接返回，防止重复安装
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 获取传入的其余参数，使用toArray方法将其转换为数组
    const args = toArray(arguments, 1)
    // 将Vue插入到该数组的第一个位置（因为在后期调用install方法时，Vue必须作为第一个参数传入）
    args.unshift(this)
    // 传入的插件如果是一个提供了 install 方法的对象，那么就执行该对象中提供的 install 方法并传入参数完成插件安装
    // 如果传入的插件是一个函数，那么就把这个函数当作install方法执行，同时传入参数完成插件安装
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 插件安装完成之后，将该插件添加进已安装插件列表中，防止重复安装
    installedPlugins.push(plugin)
    return this
  }
}
