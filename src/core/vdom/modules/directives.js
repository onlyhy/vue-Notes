/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}

// 如果新旧VNode中只要有一方涉及到了指令，就调用_update方法去处理指令逻辑
function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

function _update (oldVnode, vnode) {
  // 判断当前节点vnode对应的旧节点oldVnode是不是一个空节点，是的话，表明当前节点是一个新创建的节点
  const isCreate = oldVnode === emptyNode
  // 判断当前节点vnode是不是一个空节点，如果是的话，表明当前节点对应的旧节点将要被销毁
  const isDestroy = vnode === emptyNode
  // 旧的指令集合，即oldVnode中保存的指令
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  // 新的指令集合，即vnode中保存的指令
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)
  // 保存需要触发inserted指令钩子函数的指令列表
  const dirsWithInsert = []
  // 保存需要触发componentUpdated指令钩子函数的指令列表
  const dirsWithPostpatch = []

  // 对比新旧指令合集并触发对应的指令钩子函数
  let key, oldDir, dir
  // 循环newDirs，并分别从oldDirs和newDirs取出当前循环到的指令分别保存在变量oldDir和dir中
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    // 判断当前循环到的指令名key在旧的指令列表oldDirs中是否存在
    if (!oldDir) {
      // 不存在，说明该指令是首次绑定到元素上的一个新指令
      // 调用callHook触发指令中的bind钩子函数
      // new directive, bind
      callHook(dir, 'bind', vnode, oldVnode)
      /* 
        如果该新指令在定义时设置了inserted钩子函数，那么将该指令添加到dirsWithInsert中，
        以保证执行完所有指令的bind钩子函数后再执行指令的inserted钩子函数
      */
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      // 存在，则是更新指令
      // 保存上一次指令的value值和arg属性值
      dir.oldValue = oldDir.value
      dir.oldArg = oldDir.arg
      // 调用callHook触发指令中的update钩子函数
      callHook(dir, 'update', vnode, oldVnode)
      /*
        如果该指令在定义时设置了componentUpdated钩子函数，那么将该指令添加到dirsWithPostpatch中，
        以保证让指令所在的组件的VNode及其子VNode全部更新完后再执行指令的componentUpdated钩子函数 
       */
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }
  /* 
  判断dirsWithInsert数组中是否有元素，
  如果有，则循环dirsWithInsert数组，依次执行每一个指令的inserted钩子函数
  */
  if (dirsWithInsert.length) {
    /* 
      没有直接执行inserted钩子函数
      因为指令的inserted钩子函数必须在被绑定元素插入到父节点时调用
      当虚拟DOM渲染更新的insert钩子函数被调用的时候就标志着当前节点已经被插入到父节点了
      所以我们要在虚拟DOM渲染更新的insert钩子函数内执行指令的inserted钩子函数
    */
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    // 当一个新创建的元素被插入到父节点中时虚拟DOM渲染更新的insert钩子函数和指令的inserted钩子函数都要被触发
    if (isCreate) {
      /*
        把这两个钩子函数通过调用mergeVNodeHook方法进行合并，然后统一在虚拟DOM渲染更新的insert钩子函数中触发，
        这样就保证了元素确实被插入到父节点中才执行的指令的inserted钩子函数 
       */
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      callInsert()
    }
  }
/*
  同理，也需要保证指令所在的组件的VNode及其子VNode全部更新完后再执行指令的componentUpdated钩子函数
  将虚拟DOM渲染更新的postpatch钩子函数和指令的componentUpdated钩子函数进行合并触发
 */
  if (dirsWithPostpatch.length) {
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    for (key in oldDirs) {
      // 被废弃的指令，进行解绑
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

// 模板中使用到的指令从存放指令的地方取出来，并将其格式进行统一化
function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
