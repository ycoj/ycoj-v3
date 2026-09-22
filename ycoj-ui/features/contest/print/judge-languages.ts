/**
 * Display metadata for Hydro judge language ids (`family.version`, e.g.
 * `cc.cc17o2`). The contest management response does not carry the server's
 * `/ui/languages` catalog, so the print draft relies on this static table;
 * ids it does not know fall back to the raw id so editors can fix the label.
 *
 * `compileOptions` mirrors what the paper's submission table prints: the
 * `o2` version suffix adds `-O2`, versioned `cc.ccXX`/`c.cXX` ids add the
 * matching `-std=` flag. Everything else stays empty until edited.
 */
const LANGUAGE_FAMILY_LABELS: Record<string, string> = {
  bash: 'Bash',
  c: 'C',
  cc: 'C++',
  cpp: 'C++',
  cs: 'C#',
  go: 'Golang',
  hs: 'Haskell',
  java: 'Java',
  js: 'NodeJS',
  kt: 'Kotlin',
  pas: 'Pascal',
  php: 'PHP',
  py: 'Python',
  r: 'R',
  rb: 'Ruby',
  rs: 'Rust',
};

/** Version ids whose label differs from the bare family label. */
const LANGUAGE_VERSION_LABELS: Record<string, string> = {
  'kt.jvm': 'Kotlin/JVM',
  'py.pypy': 'PyPy',
  'py.pypy2': 'PyPy 2',
  'py.pypy3': 'PyPy 3',
  'py.py2': 'Python 2',
  'py.py3': 'Python 3',
};

/**
 * Submission file extension per language family. `cc`/`cpp`/`cxx` share
 * `.cpp`, `py`/`python` share `.py`; unknown families fall back to their own
 * sanitized family name (e.g. `hs.x` → `<name>.hs` style ids stay readable),
 * or `txt` when the family is unusable as an extension.
 */
const LANGUAGE_FAMILY_EXTENSIONS: Record<string, string> = {
  bash: 'sh',
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cs: 'cs',
  cxx: 'cpp',
  go: 'go',
  hs: 'hs',
  java: 'java',
  js: 'js',
  kt: 'kt',
  pas: 'pas',
  php: 'php',
  py: 'py',
  python: 'py',
  r: 'r',
  rb: 'rb',
  rs: 'rs',
  sh: 'sh',
};

export type JudgeLanguageInfo = {
  displayName: string;
  compileOptions: string;
};

function languageFamily(id: string): string {
  return id.split('.')[0] ?? id;
}

// `cc.cc17o2` → C++17 with `-O2 -std=c++17`; the same shape applies to
// `c.c11`/`c.c11o2` (C11 `-std=c11`). Versionless ids keep the family label.
function cFamilyInfo(
  family: 'c' | 'cc',
  version: string | undefined
): JudgeLanguageInfo | null {
  if (version === undefined || version === '') {
    return { displayName: family === 'cc' ? 'C++' : 'C', compileOptions: '' };
  }
  const match = /^(?:cc|c)(\d+)(o2)?$/.exec(version);
  if (!match) return null;
  const standard = family === 'cc' ? `c++${match[1]}` : `c${match[1]}`;
  const displayName = `${family === 'cc' ? 'C++' : 'C'}${match[1]}`;
  return {
    displayName,
    compileOptions: `${match[2] ? '-O2 ' : ''}-std=${standard}`,
  };
}

export function judgeLanguageInfo(id: string): JudgeLanguageInfo {
  const family = languageFamily(id);
  const dotIndex = id.indexOf('.');
  const version = dotIndex === -1 ? undefined : id.slice(dotIndex + 1);

  if (family === 'cc' || family === 'cpp' || family === 'cxx') {
    const info = cFamilyInfo('cc', version);
    if (info) return info;
  } else if (family === 'c') {
    const info = cFamilyInfo('c', version);
    if (info) return info;
  }

  const versionLabel = LANGUAGE_VERSION_LABELS[id];
  if (versionLabel) return { displayName: versionLabel, compileOptions: '' };

  const familyLabel = LANGUAGE_FAMILY_LABELS[family];
  return {
    displayName: familyLabel ?? id,
    compileOptions: '',
  };
}

export function judgeLanguageExtension(id: string): string {
  const family = languageFamily(id).toLowerCase();
  const known = LANGUAGE_FAMILY_EXTENSIONS[family];
  if (known) return known;
  const sanitized = family.replace(/[^a-z0-9]+/g, '');
  return sanitized || 'txt';
}
