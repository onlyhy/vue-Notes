/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

// text：待解析的文本内容
// delimiters：包裹变量的符号
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // 如果没有传入delimiters参数，则是检测文本是否包含{{}}，如果传入了值，就会检测文本是否包含传入的值
  // vue中，用户可自定义文本内包含变量所使用的符号
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // 匹配文本内容是否包含变量，不包含则直接返回
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []
   /**
   * let lastIndex = tagRE.lastIndex = 0
   * 上面这行代码等同于下面这两行代码:
   * tagRE.lastIndex = 0
   * let lastIndex = tagRE.lastIndex
   */
  // 当调用exec( )的正则表达式对象具有修饰符g时，它将把当前正则表达式对象的lastIndex属性设置为紧挨着匹配子串的字符位置
  // 当同一个正则表达式第二次调用exec( )，它会将从lastIndex属性所指示的字符串处开始检索，如果exec( )没有发现任何匹配结果，它会将lastIndex重置为0
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  // exec()在一个字符串中执行匹配检索，没有找到任何匹配就返回null，找到一个匹配就返回一个数组
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      // 先把'{{'前面的文本放入tokens中
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    // 取出'{{ }}'中间的变量exp
    const exp = parseFilters(match[1].trim())
    // 把变量exp改成_s(exp)形式也放入tokens中
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    // 设置lastIndex 以保证下一轮循环时，只从'}}'后面再开始匹配正则
    lastIndex = index + match[0].length
  }
  // 当剩下的text不再被正则匹配上时，表示所有变量已经处理完毕
  // 此时如果lastIndex < text.length，表示在最后一个变量后面还有文本
  // 最后将后面的文本再加入到tokens中
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  // 最后把数组tokens中的所有元素用'+'拼接起来
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
