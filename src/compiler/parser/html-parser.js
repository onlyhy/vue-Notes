/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
// 标签属性
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/

// 匹配开始标签的正则
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 开始标签结束符，可判断是否为自闭合标签
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
// HTML注释
const comment = /^<!\--/
// 条件注释
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

// HTML解析器
export function parseHTML (html, options) {
  // 栈是用来维护AST节点层级的，还可以用来检测标签是否正确闭合
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no   //用来检测一个标签是否是可以省略闭合标签的非自闭合标签
  let index = 0    //解析游标，标识当前从何处开始解析模板字符串
  let last,   // 存储剩余还未解析的模板字符串
      lastTag // 存储着位于 stack 栈顶的元素
  // 开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)
    // 当前html字符串要么没有父节点要么父节点不是纯文本标签
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      /**
       * 如果html字符串是以'<'开头,则有以下几种可能
       * 开始标签:<div>
       * 结束标签:</div>
       * 注释:<!-- 我是注释 -->
       * 条件注释:<!-- [if !IE] --> <!-- [endif] -->
       * DOCTYPE:<!DOCTYPE html>
       * 需要一一去匹配尝试
       */
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          // 若为注释，则继续查找是否存在'-->'
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 若存在'-->'，继续判断options中是否保留注释
            if (options.shouldKeepComment) {
              // 若保留注释，则把注释截取出来传给options.comment，创建注释类型的AST节点
              // 从第4位（"<!--"长度为4）开始截取，直到-->处，截取得到的内容就是注释的真实内容
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 若不保留注释，则将游标移动到'-->'之后，继续向后解析
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 解析是否是条件注释
        if (conditionalComment.test(html)) {
          // 若为条件注释，则继续查找是否存在']>'
          const conditionalEnd = html.indexOf(']>')

          // 若存在 ']>',则从原本的html字符串中把条件注释截掉（条件注释不存在与真正的DOM树种，不需要调用钩子函数创建AST节点）
          // 把剩下的内容重新赋给html，继续向后匹配
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 解析是否是DOCTYPE
        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // 解析是否是结束标签
        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // 匹配是否是开始标签
        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      // '<' 不在第一个位置，文本开头，解析文本类型
      if (textEnd >= 0) {
        // 如果html字符串不是以'<'开头,说明'<'前面的都是纯文本，无需处理
        // 那就把'<'以后的内容拿出来赋给rest
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          /**
           * 用'<'以后的内容rest去匹配endTag、startTagOpen、comment、conditionalComment
           * 如果都匹配不上，表示'<'是属于文本本身的内容
           */
        // 在'<'之后查找是否还有'<'
          next = rest.indexOf('<', 1)
          // 如果没有了，表示'<'后面也是文本
          if (next < 0) break
          // 如果还有，表示'<'是文本中的一个字符
          textEnd += next
          // 那就把next之后的内容截出来继续下一轮循环匹配
          rest = html.slice(textEnd)
        }
        // '<'是结束标签的开始 ,说明从开始到'<'都是文本，截取出来
        text = html.substring(0, textEnd)
      }
      // 整个模板字符串里没有找到`<`,说明整个模板字符串都是纯文本
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }
      // 把截取出来的text转化成textAST
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 父元素为script、style、textarea时，其内部的内容全部当做纯文本处理
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 将整个字符串作为文本对待（经过上述所有逻辑处理过后，html字符串没有任何变化，即没有匹配上任何一条规则)
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  // 处理栈中剩余未处理的标签,pos为0，逐个警告缺少闭合标签
  parseEndTag()

  // 移动解析游标，解析完一部分就把游标向后移动一部分，确保不会重复解析
  function advance (n) {
    index += n // index为解析游标
    html = html.substring(n)
  }
  // 解析开始标签
  function parseStartTag () {
    const start = html.match(startTagOpen)
    // '<div></div>'.match(startTagOpen)  => ['<div','div',index:0,input:'<div></div>']
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      /**
     * <div a=1 b=2 c=3></div>
     * 从<div之后到开始标签的结束符号'>'之前，一直匹配属性attrs
     * 所有属性匹配完之后，html字符串还剩下
     * 自闭合标签剩下：'/>'
     * 非自闭合标签剩下：'></div>'
     */
      // 多个标签属性，循环匹配，匹配出第一个标签属性后，就把该属性截掉，用剩下的字符串继续匹配，直到不再满足正则为止
      // 如果剩下的字符串不符合开始标签的结束特征（startTagClose）并且符合标签属性的特征的话，那就说明还有未提取出的标签属性，那就进入循环，继续提取，直到把所有标签属性都提取完毕
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      /**
     * 这里判断了该标签是否为自闭合标签
     * 自闭合标签如:<input type='text' />
     * 非自闭合标签如:<div></div>
     * '></div>'.match(startTagClose) => [">", "", index: 0, input: "></div>", groups: undefined]
     * '/><div></div>'.match(startTagClose) => ["/>", "/", index: 0, input: "/><div></div>", groups: undefined]
     * 因此，我们可以通过end[1]是否是"/"来判断该标签是否是自闭合标签
     */
      // 根据end[1]是否为""判断是否为自闭合标签（/>），非自闭合为""，自闭合为"/"
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
  // 对parseStartTag函数的解析结果进行进一步处理
  function handleStartTag (match) {
    const tagName = match.tagName         // 开始标签的标签名
    const unarySlash = match.unarySlash   // 是否为自闭合标签的标志，自闭合为"/",非自闭合为""

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash // 布尔值，标志是否为自闭合标签

    const l = match.attrs.length   // match.attrs 数组的长度
    const attrs = new Array(l)     // 一个与match.attrs数组长度相等的数组
    // 循环处理提取出来的标签属性数组match.attrs
    for (let i = 0; i < l; i++) {
      // 标签属性数组中的每一个属性对象，每个元素对象
      const args = match.attrs[i]
      // 存储标签属性的属性值
      const value = args[3] || args[4] || args[5] || ''
      // 兼容性处理
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines

      // 将处理好的结果存入之前定义好的与match.attrs数组长度相等的attrs数组中
      attrs[i] = {
        name: args[1],    // 标签属性的属性名，如class
        value: decodeAttr(value, shouldDecodeNewlines) // 标签属性的属性值，如class对应的a
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 非自闭合标签，将标签推入栈中
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    // 闭合标签，调用start钩子函数，创建AST节点
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  // 解析结束标签
  // 参数：结束标签名、结束标签在html字符串中的起始和结束位置
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 在栈中寻找与tagName相同的标签并记录其所在的位置pos，如果tagName不存在，则将pos置为0
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        // stack中存在索引大于pos的元素，那么该元素缺少闭合标签，在非生产环境抛出警告
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        // 闭合
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 把pos位置以后的元素都从stack栈中弹出
      // 把lastTag更新为栈顶元素
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    }
    // 浏览器会自动把</br>解析成<br>，</p>会自动补全<p></p>
    else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end) //创建<br>AST节点
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
