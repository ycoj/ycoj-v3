/** CNOI statement template, adapted only to the YCOJ content JSON fields. */
export const MAIN_SOURCE = `#import "preamble.typ": print-math, print-rule

#let data = json("content.json")
#let (problems,) = data
#let cjk-align-mark = box(width: 0pt, hide[兔])

#set document(title: data.title)
#set page(paper: "a4", margin: (left: 2.5cm, right: 2.5cm, top: 2.5cm, bottom: 2.5cm))
#set text(lang: "zh", font: ("Latin Modern Roman 12", "SimSun"), size: 12pt)
#set par(first-line-indent: (amount: 2em, all: true), spacing: 0.7em, leading: 0.7em)

// From <https://guide.typst.dev/FAQ/fix-enum-list>
#let correctly-indent-list-and-enum-items(doc) = {
  show list: li => {
    for (i, it) in li.children.enumerate() {
      let nesting = state("list-nesting", 0)
      let indent = context h((nesting.get() + 1) * li.indent)
      let marker = context {
        let n = nesting.get()
        if type(li.marker) == array {
          li.marker.at(calc.rem-euclid(n, li.marker.len()))
        } else if type(li.marker) == content {
          li.marker
        } else {
          li.marker(n)
        }
      }
      let list-fronter = {
        marker
        h(li.body-indent)
      }
      let item-data = {
        list-fronter
        nesting.update(x => x + 1)
        it.body + parbreak()
        nesting.update(x => x - 1)
      }
      context {
        set par(first-line-indent: 0pt, hanging-indent: measure(list-fronter).width)
        pad(left: li.indent, item-data)
      }
    }
  }
  show enum: en => {
    let start = if en.start == auto {
      if en.children.first().has("number") {
        if en.reversed { en.children.first().number } else { 1 }
      } else {
        if en.reversed { en.children.len() } else { 1 }
      }
    } else {
      en.start
    }
    let number = start
    for (i, it) in en.children.enumerate() {
      number = if it.has("number") { it.number } else { number }
      if en.reversed { number = start - i }
      let parents = state("enum-parents", ())
      let indent = context h((parents.get().len() + 1) * en.indent)
      let num = if en.full {
        context numbering(en.numbering, ..parents.get(), number)
      } else {
        numbering(en.numbering, number)
      }
      let max-num = if en.full {
        context numbering(en.numbering, ..parents.get(), en.children.len())
      } else {
        numbering(en.numbering, en.children.len())
      }
      num = context box(
        width: measure(max-num).width,
        align(right, text(overhang: false, num)),
      )
      if not en.reversed { number += 1 }
      let enum-fronter = {
        num
        h(en.body-indent)
      }
      let item-data = {
        enum-fronter
        parents.update(arr => arr + (number,))
        it.body + parbreak()
        parents.update(arr => arr.slice(0, -1))
      }
      context {
        set par(first-line-indent: 0pt, hanging-indent: measure(enum-fronter).width)
        pad(left: en.indent, item-data)
      }
    }
  }
  doc
}
#show: correctly-indent-list-and-enum-items
#set enum(indent: 1.75em, numbering: x => numbering("1.", x))
#set list(indent: 1.75em, marker: ([•], [–], [∗], [·]).map(x => x))
#show footnote.entry: it => {
  set par(first-line-indent: 0pt)
  pad(
    grid(
      columns: (8pt, 1fr),
      align: (right, left),
      context super(counter(footnote).display(it.note.numbering)), it.note.body,
    ),
    left: it.indent,
    bottom: it.gap,
  )
}

#let in-raw = state("in-raw", false)
#show strong: st => {
  if in-raw.get() { st } else {
    set text(font: ("Latin Modern Roman 12", "SimHei"))
    show regex("\\p{sc=Hani}+"): s => {
      underline(s, offset: 3pt, stroke: (
        cap: "round",
        thickness: 0.1em,
        dash: (array: (0em, 1em), phase: 0.5em),
      ))
    }
    st
  }
}
#show heading.where(level: 1): it => {
  set text(size: 18pt, weight: "regular", font: ("Latin Modern Roman 17", "SimHei"))
  set heading(bookmarked: true)
  pad(top: 10pt, align(center, h(2em) + it.body))
}
#show heading.where(level: 2): it => {
  set text(size: 13pt, weight: "regular", font: ("Latin Modern Roman 12", "SimHei"))
  set heading(bookmarked: true)
  pad(left: 1.5em, top: 1em, bottom: .5em, [【] + it.body + [】])
}
#show emph: it => {
  if in-raw.get() { it } else {
    set text(font: "Latin Modern Roman", weight: "bold")
    it
  }
}
#show link: set text(fill: rgb("#ed028c"))
#show raw: it => {
  in-raw.update(true)
  let mono-font = ("Fira Mono", "SimSun")
  set text(font: mono-font, size: 12pt)
  show strong: it => text(it.body, weight: "medium")
  if not it.block { it } else {
    let border = 0.4pt + rgb("#0000ff")
    show raw.line: jt => {
      block(
        place(
          dx: -9pt - measure([#jt.number]).width,
          text(fill: rgb("#808080"), size: 10pt, [#jt.number]) + cjk-align-mark,
        )
          + par(
            leading: 0.65em,
            spacing: 0em,
            first-line-indent: 0em,
            hanging-indent: 1.5em,
            cjk-align-mark + jt,
          ),
      )
    }
    block(
      inset: (left: 9pt),
      block(
        width: 100% + 3pt,
        stroke: (x: border),
        inset: (x: 3pt, top: 6pt, bottom: 9pt),
        place(
          dx: -3pt,
          dy: -6pt,
          line(stroke: border, length: 100% + 3pt * 2),
        )
          + {
            set par(spacing: 0pt)
            it
          }
          + place(
            dx: -3pt,
            dy: 9pt,
            line(stroke: border, length: 100% + 3pt * 2),
          ),
      ),
    )
  }
  in-raw.update(false)
}
#set raw(tab-size: 4, theme: "./tuackCodeTheme.tmTheme")

#show figure: it => pad(top: 9pt, bottom: 6pt, it)
#set figure(numbering: none)
#show math.equation: set text(font: "New Computer Modern Math")
#set table(stroke: 0.3pt)

#align(center)[
  #if data.title != "" {
    text(size: 22pt, weight: "bold", font: ("Latin Modern Roman 12", "SimHei"), data.title)
  }

  #if data.subtitle != "" {
    text(size: 22pt, font: ("Latin Modern Roman 17", "SimHei"), data.subtitle)
  }

  #if data.dayName != "" {
    text(size: 22pt, font: ("Latin Modern Roman 17", "KaiTi"), data.dayName)
  }

  #if data.dateText != "" {
    text(
      size: 15pt,
      font: ("Latin Modern Roman 17", "SimHei"),
      "时间：" + {
        let parts = data.dateText.split(" ~ ")
        if parts.len() == 2 { parts.first() + [ $~$ ] + parts.last() } else { data.dateText }
      },
    )
  }
]

#if problems.len() > 0 {
  figure(table(
    columns: (
      if problems.len() >= 4 { 22% } else { 1fr },
      ..for _ in range(0, problems.len()) { (1fr,) },
    ),
    align: left + bottom,
    [题目名称],
    ..for i in problems { (i.title,) },
    [题目类型],
    ..for i in problems { (i.problemType,) },
    ..if data.noiStyle {
      (
        [目录],
        ..for i in problems { (raw(i.directory),) },
        [程序文件名],
        ..for i in problems { (raw(i.executable),) },
      )
    },
    ..if data.fileIo {
      (
        [输入文件名],
        ..for i in problems { (raw(i.inputFile),) },
        [输出文件名],
        ..for i in problems { (raw(i.outputFile),) },
      )
    },
    [每个测试点时限],
    ..for i in problems { (i.timeLimit,) },
    [内存限制],
    ..for i in problems { (i.memoryLimit,) },
    if data.noiStyle { [测试点数目] } else { [子任务数目] },
    ..for i in problems { (i.testcaseCount,) },
    ..if data.noiStyle {
      ([测试点是否等分 ], ..for i in problems { (i.scoreNote,) })
    },
    ..if data.usePretest {
      ([预测试点数目], ..for i in problems { (i.pretestCount,) })
    },
  ))
}

#let calc-language-name-content(c) = {
  let w = 36pt
  if measure(c).width <= w { c + h(w - measure(c).width) } else { c }
}

#if data.noiStyle and problems.len() > 0 and data.languages.len() > 0 {
  [
    提交源程序文件名
    #figure(table(
      columns: (
        if problems.len() >= 4 { 22% } else { 1fr },
        ..for _ in range(0, problems.len()) { (1fr,) },
      ),
      align: left + bottom,
      ..for i in range(0, data.languages.len()) {
        (
          [对于#context calc-language-name-content(data.languages.at(i).displayName)语言],
          ..for p in problems { (raw(p.submitFilenames.at(i, default: "")),) },
        )
      },
    ))
  ]
}

#if problems.len() > 0 and data.languages.len() > 0 {
  [
    编译选项
    #figure(table(
      columns: (
        if problems.len() >= 4 { 22% } else { 1fr },
        ..for _ in range(0, problems.len()) { (1fr,) },
      ),
      align: (left + bottom, center + bottom),
      ..for lang in data.languages {
        (
          [对于#context calc-language-name-content(lang.displayName)语言],
          table.cell(colspan: problems.len(), raw(lang.compileOptions)),
        )
      },
    ))
  ]
}

#set table(
  stroke: (x, y) => (
    left: if x > 0 { .4pt },
    bottom: 2pt,
    top: if y == 0 { 2pt } else if y == 1 { 1.2pt } else { .4pt },
  ),
  align: center + horizon,
)

#if data.hasNotice { include "notice.typ" }
#for extra in data.extraSections { include extra.file }

#let current-problem-idx = counter("current-problem-idx")
#set page(
  header: context {
    if problems.len() > 0 {
      let prob = problems.at(current-problem-idx.get().at(0))
      set par(first-line-indent: 0em)
      [
        #text(size: 10pt, font: ("Latin Modern Roman", "SimSun"))[
          #data.title
          #data.subtitle
          #h(1fr)
          #data.dayName
          #prob.title（#prob.name）
        ]
        #v(-4pt)
        #line(length: 100%, stroke: 0.3pt)
      ]
    }
  },
  numbering: (now, total) => [#text(
    size: 10pt,
  )[第 #(now) 页 ~~~~ 共 #link((page: total, x: 2.5cm, y: 1.5cm))[#text(fill: rgb("#0000ff"))[#(total)]] 页]],
)

#for (i, p) in problems.enumerate() {
  pagebreak()
  heading(level: 1, [#p.title（#p.name）])
  include p.file
  current-problem-idx.step()
}
`;
