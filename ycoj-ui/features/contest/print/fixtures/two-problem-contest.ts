import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import type { PrintFixture } from '@/features/contest/print/fixtures/types';

const problem1001Statement = {
  zh: `## 题目描述

给定两个整数 $a$ 和 $b$，输出它们的和。

![数据范围示意](file://range.png)

## 输入格式

一行两个整数 $a, b$，满足

$$
-10^9 \\le a, b \\le 10^9
$$

## 输出格式

一行一个整数，表示 $a + b$。

## 样例

| 输入   | 输出 |
| ------ | ---- |
| 1 2    | 3    |
| -1 1   | 0    |

## 提示

:::info
预测试点与正式测试点相同。
:::

参考实现：

\`\`\`cpp
#include <cstdio>
int main() {
  long long a, b;
  scanf("%lld%lld", &a, &b);
  printf("%lld\\n", a + b);
}
\`\`\`
`,
  en: `## Description

Given two integers $a$ and $b$, print their sum.

## Input

Two integers $a, b$ on one line.

## Output

One integer $a + b$.
`,
};

const problem1002Statement = `## 题目描述

给定 $n$ 个整数，将它们从小到大排序后输出。

## 输入格式

第一行一个整数 $n$。第二行 $n$ 个整数 $a_1, a_2, \\dots, a_n$。

## 输出格式

一行 $n$ 个整数，用空格分隔。

## 样例

输入：

\`\`\`
3
3 1 2
\`\`\`

输出：

\`\`\`
1 2 3
\`\`\`
`;

const problem1001Doc = {
  _id: '66ff00000000000000000011',
  domainId: 'system',
  docType: 10,
  docId: 1001,
  pid: 'P1001',
  owner: 2,
  title: 'A+B Problem',
  nSubmit: 0,
  nAccept: 0,
  tag: [],
  content: JSON.stringify(problem1001Statement),
  data: [],
  config: {
    count: 10,
    memoryMax: 512,
    memoryMin: 512,
    timeMax: 1000,
    timeMin: 1000,
    type: 'default',
    subType: 'aplusb',
    langs: ['cc.cc17o2', 'py.py3'],
  },
  additional_file: [
    {
      _id: 'additional_file/range.png',
      name: 'range.png',
      size: 20480,
      etag: 'etag-range',
      lastModified: new Date('2026-01-21T00:00:00.000Z'),
    },
  ],
};

const problem1002Doc = {
  _id: '66ff00000000000000000012',
  domainId: 'system',
  docType: 10,
  docId: 1002,
  owner: 2,
  title: '排序',
  nSubmit: 0,
  nAccept: 0,
  tag: [],
  content: problem1002Statement,
  data: [],
  config: {
    count: 20,
    memoryMax: 256,
    memoryMin: 256,
    timeMax: 2000,
    timeMin: 2000,
    type: 'default',
    langs: ['cc.cc17o2', 'py.py3'],
  },
};

/**
 * Minimal two-problem contest: one bilingual file-I/O problem with image,
 * math, table, code and a directive; one plain zh markdown problem. The
 * `document` half records the default draft at language `zh`.
 */
export const twoProblemContest: PrintFixture = {
  name: 'two-problem-contest',
  response: {
    tdoc: {
      _id: '66ff00000000000000000001',
      docId: '7',
      docType: 30,
      domainId: 'system',
      owner: 2,
      beginAt: new Date('2026-02-07T01:00:00.000Z'),
      endAt: new Date('2026-02-07T05:00:00.000Z'),
      attend: 0,
      title: 'YCOJ 冬季赛 2026',
      content:
        '本次竞赛共 2 题，时长 4 小时。\n\n![海报](file://poster.png)\n\n祝大家取得好成绩！',
      rule: 'oi',
      pids: [1001, 1002],
      duration: 0,
      files: [
        {
          _id: 'files/poster.png',
          name: 'poster.png',
          size: 10240,
          etag: 'etag-poster',
          lastModified: new Date('2026-01-20T00:00:00.000Z'),
        },
      ],
    },
    tsdoc: null,
    owner_udoc: {
      _id: 2,
      uname: 'admin',
      mail: 'admin@example.com',
      avatar: '',
    },
    // The backend's problem.getList merges string `pdoc.pid` keys (e.g.
    // "P1001") into pdict alongside the numeric docId keys; keep the payload
    // faithful so print UI code cannot regress to enumerating pdict keys.
    pdict: {
      1001: problem1001Doc,
      P1001: problem1001Doc,
      1002: problem1002Doc,
    } as ContestManagementResponse['pdict'],
    files: [
      {
        _id: 'files/poster.png',
        name: 'poster.png',
        size: 10240,
        etag: 'etag-poster',
        lastModified: new Date('2026-01-20T00:00:00.000Z'),
      },
    ],
    privateFiles: [],
  },
  document: {
    language: 'zh',
    title: 'YCOJ 冬季赛 2026',
    subtitle: '',
    dayName: '',
    dateText: '2026年2月7日09:00 ~ 13:00',
    beginAt: '2026-02-07T01:00:00.000Z',
    endAt: '2026-02-07T05:00:00.000Z',
    notice:
      '本次竞赛共 2 题，时长 4 小时。\n\n![海报](file://poster.png)\n\n祝大家取得好成绩！',
    noiStyle: true,
    fileIo: true,
    usePretest: false,
    languages: [
      {
        id: 'cc.cc14o2',
        displayName: 'C++',
        compileOptions: '-O2 -std=c++14 -static',
      },
    ],
    problems: [
      {
        problemId: 1001,
        pid: 'P1001',
        name: 'p1001',
        title: 'A+B Problem',
        problemType: 'default',
        statement: problem1001Statement.zh.trim(),
        timeLimit: '1 s',
        memoryLimit: '512 MiB',
        directory: 'aplusb',
        executable: 'aplusb.cpp',
        inputFile: 'aplusb.in',
        outputFile: 'aplusb.out',
        submitFilenames: ['aplusb.cpp'],
        testcaseCount: '10',
        scoreNote: '是',
        pretestCount: '',
      },
      {
        problemId: 1002,
        name: 'p1002',
        title: '排序',
        problemType: 'default',
        statement: problem1002Statement.trim(),
        timeLimit: '2 s',
        memoryLimit: '256 MiB',
        directory: 'p1002',
        executable: 'p1002.cpp',
        inputFile: '',
        outputFile: '',
        submitFilenames: ['p1002.cpp'],
        testcaseCount: '20',
        scoreNote: '是',
        pretestCount: '',
      },
    ],
    extraSections: [],
  },
};
