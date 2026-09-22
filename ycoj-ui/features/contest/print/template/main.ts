/**
 * The printable-contest document template, written to the compiler shadow FS
 * at `PRINT_MAIN_PATH`. It reads `content.json` (see `buildTypstFiles` for the
 * serialization contract) and `include`s the generated `file` of each problem
 * and extra section. All text is original YCOJ styling — bilingual labels are
 * chosen from `paper.language`.
 */
export const MAIN_SOURCE = `// YCOJ printable contest paper.
#import "preamble.typ": print-math, print-note, print-rule

#let paper = json("content.json")
#let problems = paper.problems
#let languages = paper.languages
#let extras = paper.extraSections

// ---- localized labels --------------------------------------------------------
#let labels = (
  zh: (
    problemName: "题目名称",
    problemType: "题目类型",
    directory: "子目录",
    executable: "可执行文件",
    inputFile: "输入文件名",
    outputFile: "输出文件名",
    stdInput: "标准输入",
    stdOutput: "标准输出",
    timeLimit: "时间限制",
    memoryLimit: "内存限制",
    testcaseCount: "测试点数目",
    scoreNote: "分数分配",
    pretestCount: "预测试点数目",
    submitHeading: "提交源程序文件名",
    compileHeading: "编译选项",
    emptyCell: "——",
    pageNumber: (now, total) => [第 #now 页 ～ 共 #total 页],
    nameWrap: (name) => [（#name）],
    forLanguage: (name) => [对于 #name 语言],
  ),
  zh_TW: (
    problemName: "題目名稱",
    problemType: "題目類型",
    directory: "子目錄",
    executable: "可執行檔",
    inputFile: "輸入檔名",
    outputFile: "輸出檔名",
    stdInput: "標準輸入",
    stdOutput: "標準輸出",
    timeLimit: "時間限制",
    memoryLimit: "記憶體限制",
    testcaseCount: "測試點數目",
    scoreNote: "分數分配",
    pretestCount: "預測試點數目",
    submitHeading: "提交源程式檔名",
    compileHeading: "編譯選項",
    emptyCell: "——",
    pageNumber: (now, total) => [第 #now 頁 ～ 共 #total 頁],
    nameWrap: (name) => [（#name）],
    forLanguage: (name) => [對於 #name 語言],
  ),
  en: (
    problemName: "Problem",
    problemType: "Type",
    directory: "Directory",
    executable: "Executable",
    inputFile: "Input file",
    outputFile: "Output file",
    stdInput: "standard input",
    stdOutput: "standard output",
    timeLimit: "Time limit",
    memoryLimit: "Memory limit",
    testcaseCount: "Test cases",
    scoreNote: "Score",
    pretestCount: "Pretests",
    submitHeading: "Submission file names",
    compileHeading: "Compile options",
    emptyCell: "—",
    pageNumber: (now, total) => [Page #now of #total],
    nameWrap: (name) => [ (#name)],
    forLanguage: (name) => name,
  ),
)
#let L = if paper.language == "zh" {
  labels.zh
} else if paper.language == "zh_TW" {
  labels.zh_TW
} else {
  // Non-Chinese papers (en, kr, jp) use English labels — the neutral
  // fallback rather than Chinese wording on a non-Chinese paper.
  labels.en
}

// ---- fonts & base style ------------------------------------------------------
#let serif-stack = ("Libertinus Serif", "Noto Serif CJK SC")
// CJK bold convention: bold CJK runs switch to the sans face while Latin
// keeps the serif bold.
#let display-stack = ("Libertinus Serif", "Noto Sans CJK SC")
#let mono-stack = ("DejaVu Sans Mono", "Noto Serif CJK SC")

#set document(title: paper.title)
#set text(
  font: serif-stack,
  size: 12pt,
  lang: if paper.language == "en" { "en" }
    else if paper.language == "jp" { "ja" }
    else if paper.language == "kr" { "ko" }
    else { "zh" },
)
#set par(first-line-indent: (amount: 2em, all: true), leading: 0.8em, spacing: 0.9em)
#set heading(bookmarked: true)
#set raw(tab-size: 4)
#set table(stroke: 0.4pt + luma(60), inset: (x: 7pt, y: 5pt))
#show math.equation: set text(font: "New Computer Modern Math")
#show link: set text(fill: rgb("#1d4ed8"))
#show strong: it => {
  set text(font: display-stack)
  it
}
#show raw: it => {
  show strong: st => st
  set text(font: mono-stack, size: 10.5pt)
  if it.block {
    block(
      width: 100%,
      fill: luma(247),
      stroke: (left: 1.5pt + luma(110)),
      inset: (x: 9pt, y: 6pt),
      it,
    )
  } else {
    it
  }
}
#show heading.where(level: 1): it => {
  set text(font: display-stack, size: 16pt, weight: "bold")
  set par(first-line-indent: 0pt)
  align(center, it.body)
  v(0.3em)
}
#show heading.where(level: 2): it => {
  set text(font: display-stack, size: 13pt, weight: "bold")
  set par(first-line-indent: 0pt)
  pad(top: 0.7em, bottom: 0.2em, it.body)
}
#show heading.where(level: 3): it => {
  set text(font: display-stack, size: 12pt, weight: "bold")
  set par(first-line-indent: 0pt)
  pad(top: 0.5em, bottom: 0.15em, it.body)
}
#show heading.where(level: 4): it => {
  set text(font: display-stack, size: 12pt)
  set par(first-line-indent: 0pt)
  pad(top: 0.4em, bottom: 0.1em, it.body)
}
#show figure: it => {
  set par(first-line-indent: 0pt)
  pad(top: 4pt, bottom: 4pt, it)
}
#show list: set par(first-line-indent: 0pt)
#show enum: set par(first-line-indent: 0pt)
#show quote: set par(first-line-indent: 0pt)

#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
  footer: context {
    set par(first-line-indent: 0pt)
    set text(size: 9pt)
    align(center, (L.pageNumber)(counter(page).get().first(), counter(page).final().first()))
  },
)

// ---- title block -------------------------------------------------------------
#align(center)[
  #set par(first-line-indent: 0pt)
  #v(1em)
  #text(font: display-stack, size: 20pt, weight: "bold")[#paper.title]
  #if paper.subtitle != "" [
    #v(0.35em)
    #text(font: display-stack, size: 15pt, weight: "bold")[#paper.subtitle]
  ]
  #if paper.dateText != "" [
    #v(0.5em)
    #text(size: 12pt)[#paper.dateText]
  ]
  #v(0.6em)
]

// ---- overview table ----------------------------------------------------------
#let std-cell(value, fallback) = if value == "" {
  text(fill: luma(80))[#fallback]
} else {
  raw(value)
}
#let overview-rows = (
  (L.problemName, problems.map(p => p.title)),
  (L.problemType, problems.map(p => p.problemType)),
  ..if paper.noiStyle {
    (
      (L.directory, problems.map(p => raw(p.directory))),
      (L.executable, problems.map(p => raw(p.executable))),
    )
  },
  ..if paper.fileIo {
    (
      (L.inputFile, problems.map(p => std-cell(p.inputFile, L.stdInput))),
      (L.outputFile, problems.map(p => std-cell(p.outputFile, L.stdOutput))),
    )
  },
  (L.timeLimit, problems.map(p => p.timeLimit)),
  (L.memoryLimit, problems.map(p => p.memoryLimit)),
  (L.testcaseCount, problems.map(p => p.testcaseCount)),
  ..if problems.any(p => p.scoreNote != "") {
    ((L.scoreNote, problems.map(p => p.scoreNote)),)
  },
  ..if paper.usePretest {
    ((L.pretestCount, problems.map(p => p.pretestCount)),)
  },
)
#figure(table(
  columns: (17%, ..(1fr,) * problems.len()),
  align: (column, _) => if column == 0 { left + horizon } else { center + horizon },
  fill: (column, _) => if column == 0 { luma(243) },
  ..for (label, cells) in overview-rows {
    (strong[#label], ..cells)
  }
))

// ---- submission filenames (NOI style) ----------------------------------------
#if paper.noiStyle and problems.len() > 0 and languages.len() > 0 [
  #v(0.5em)
  #text(font: display-stack, size: 12.5pt, weight: "bold")[#L.submitHeading]
  #v(0.2em)
  #figure(table(
    columns: (24%, ..(1fr,) * problems.len()),
    align: (column, _) => if column == 0 { left + horizon } else { center + horizon },
    fill: (column, _) => if column == 0 { luma(243) },
    ..for (index, lang) in languages.enumerate() {
      (
        [#(L.forLanguage)(lang.displayName)],
        ..problems.map(p => raw(p.submitFilenames.at(index, default: ""))),
      )
    }
  ))
]

// ---- compile options ---------------------------------------------------------
#if languages.len() > 0 [
  #v(0.5em)
  #text(font: display-stack, size: 12.5pt, weight: "bold")[#L.compileHeading]
  #v(0.2em)
  #figure(table(
    columns: (auto, 1fr),
    align: left + horizon,
    fill: (column, _) => if column == 0 { luma(243) },
    ..for lang in languages {
      (
        strong[#lang.displayName],
        if lang.compileOptions == "" { [#L.emptyCell] } else { raw(lang.compileOptions) },
      )
    }
  ))
]

// ---- contest notice ----------------------------------------------------------
#if paper.hasNotice {
  include "notice.typ"
}

// ---- problem pages -----------------------------------------------------------
// 'problem-index' counts the problems whose pages have been completed, so it
// equals the index of the problem currently being typeset — exactly what the
// running header needs. 'in-problems' flips once the front matter ends, which
// keeps the cover and info pages header-free.
#let problem-index = counter("ycoj-print-problem")
#let in-problems = state("ycoj-print-problems", false)
#set page(header: context {
  let on = in-problems.at(here())
  if on {
    let idx = problem-index.get().at(0)
    set par(first-line-indent: 0pt)
    set text(size: 9pt)
    [#paper.title]
    if paper.subtitle != "" { [ — #paper.subtitle] }
    h(1fr)
    if idx < problems.len() {
      let current = problems.at(idx)
      [#current.title#(L.nameWrap)(current.name)]
    }
    v(-3pt)
    line(length: 100%, stroke: 0.35pt + luma(90))
  }
})
#in-problems.update(true)
#for (index, problem) in problems.enumerate() {
  pagebreak()
  heading(level: 1)[#problem.title#(L.nameWrap)(problem.name)]
  include problem.file
  problem-index.step()
}
#for extra in extras {
  pagebreak()
  include extra.file
}
`;
