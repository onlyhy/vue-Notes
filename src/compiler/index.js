/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 模板解析阶段：用正则等方式解析template模板中的指令、class、style等数据，形成AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化阶段：遍历AST，找出其中的静态节点，并打上标记（在进行patch的过程中，DOM-Diff会直接跳过静态节点，减少比较的过程，优化了patch的性能）
    optimize(ast, options)
  }
  // 代码生成阶段：将AST转换成渲染函数render函数字符串的过程，得到结果是 render函数 的字符串以及 staticRenderFns 字符串
  const code = generate(ast, options)
  return {
    ast, //抽象语法树
    render: code.render, // 渲染函数
    staticRenderFns: code.staticRenderFns // 静态渲染函数
  }
})
