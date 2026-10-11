# C++ submission similarity engine

This engine returns evidence for administrator review. A high score identifies similar source code; it does not prove copying, establish authorship, or automatically impose a penalty. Independently written solutions to the same standard algorithm can resemble each other. No submitted code is compiled, run, or sent to an external service.

## Research basis

The design uses local, position-independent fingerprints described in [Schleimer, Wilkerson, and Aiken's Winnowing paper](https://theory.stanford.edu/~aiken/publications/papers/sigmod03.pdf). The paper motivates normalization, a minimum meaningful match length, and rightmost-minimum fingerprint selection so insertions and reordered blocks leave useful matches. This implementation uses 16-token shingles and windows of five hashes: a shared normalized span of at least 20 tokens contributes a fingerprint.

[JPlag's official documentation](https://github.com/jplag/JPlag/wiki) also discusses token matching, minimum match length, and excluding shared starter code. The engine follows those design principles without importing JPlag or claiming its parser, normalization, or matching implementation. Generic headers and `using namespace std` are ignored here; configurable contest-specific starter-code exclusion remains a possible extension.

## Preparation

`prepareCpp(source)` retains source line locations while splicing escaped newlines, skipping whitespace/comments, and tokenizing identifiers, operators, numeric literals, ordinary strings, characters, and raw strings. String contents remain significant even when they look like comments. Operators, keywords, familiar C++ library operations, and literal values remain distinct. Library classification recognizes call, type, and stream sites after checking scalar/template declarators, so ordinary variables named `count`, `min`, `max`, `size`, or `array` remain renameable. Explicit `std::` operations retain their names even when an unqualified name is shadowed. Declaration inference is a lexical heuristic with bounded local template lookback, rather than C++ name resolution. Numeric digit separators and numeric letter case are normalized; equivalent numeric spellings such as `3` and `0x3` are not evaluated.

`#include`, `#pragma`, `using namespace std`, and `std::` qualification do not contribute to similarity. Macros and conditional directives are retained lexically and raise a warning; no preprocessor is run. Only a single built-in scalar declaration whose identifier appears once in the entire source is removed, and only if it has no initializer or a simple numeric/boolean constant initializer. Constructors, volatile declarations, calls, arrays, and arbitrary expressions are retained. This is deliberately conservative rather than general dead-code elimination.

Identifiers are numbered by first appearance within each shingle or structural statement. Thus `a = a + b` matches `x = x + y`, while `x = x + x` has a different equality signature. Canonicalization restarts locally, so moving a block, inserting an unrelated variable, or renaming helper parameters does not renumber the rest of the program's features. Exact whole-source comparisons additionally use a global equality-preserving canonical stream.

Preparation produces three views:

- **Token:** the multiplicity of all canonical 16-token shingles, independent of their order.
- **Fingerprint:** rightmost-minimum winnowing of those shingles, including original token positions. SHA-256 keys identify features; 32-bit hashes select minima and never determine equality by themselves.
- **Structure:** a token-weighted bag of canonical statement/control-header segments. Braces delimit segments; function signatures are omitted from this view, leaving helper bodies comparable with an inline original. This is a lexical structural heuristic, not an AST, control-flow graph, dependency graph, or semantic-equivalence analysis.

Literal and feature digests keep a long string literal from being replicated in every neighboring feature. Features are reusable across all comparisons of the same submission.

## Comparison and evidence

For each view, let `S` be the shared feature weight using the smaller occurrence count of each feature, and let `L` and `R` be the submissions' total feature weights. Its score is:

```text
100 × (0.7 × S / min(L, R) + 0.3 × 2S / (L + R))
```

The containment term preserves evidence when copied core code is surrounded by padding. The Dice term accounts for unequal submission sizes. The overall score is the larger of `0.8 token + 0.2 fingerprint` and `0.8 structure + 0.2 token`. Different core algorithms can share generic statements, so structural agreement without any matching 16-token fingerprint region is capped at 35. Sources with fewer than 40 meaningful tokens are capped at 55, including exact copies, and receive a short-source warning. Empty/boilerplate-only sources score zero. Exact global canonical matches of sufficiently long programs score 100.

Matching fingerprint occurrences are paired once each rather than expanding repeated tokens into a Cartesian product. Overlapping matches on the same relative offset are merged. A region can use local identifier mappings; it does not assert that a single global variable mapping exists across all matched regions. The report includes original one-based line ranges and normalized token counts. It retains the 100 largest regions, displays them in source order, and warns if additional evidence was omitted. Scores always use all features.

Reordered substantial blocks normally retain token/fingerprint evidence and identical structural bags. Helper extraction retains statement and body-shingle evidence, with a small change from call sites and signatures. Loop rewrites such as `for` to `while` can retain matching body statements but receive a lower score when headers and increments change. Complete algorithm rewrites, reordered expressions, macros hiding the algorithm, custom library types, or semantic-equivalent implementations with little shared source may be missed. Scores and review thresholds have not been calibrated against a labeled production plagiarism corpus.

## Resource bounds

Preparation rejects sources above 256 KiB or 30,000 lexical tokens before returning a result. Preparation and comparison share a ten-second soft timeout: `prepareCpp(source, { deadline })` and `compareCpp(left, right, { deadline })` accept an absolute `Date.now()` deadline and clamp it to at most ten seconds from entry. Exceeding the timeout throws `PlagiarismLimitError` with `deadline-exceeded`, but the worker treats it as a soft failure: a source or pair that reaches the timeout is skipped or omitted from the report instead of failing the whole job. `source-too-large` and `too-many-tokens` are detected before analysis. No partial/truncated score is returned.

With fixed shingle/window lengths, preparation is linear in input size. Comparison scans feature bags and occurrence lists linearly, then sorts evidence in `O(f log f)` for `f` fingerprint occurrences. Repetitive input never creates a quadratic occurrence cross-product. Deadline checks occur throughout feature loops and again before returning.

The asynchronous executor must enforce the five-minute wall-clock budget outside this synchronous engine, so a stalled worker can be terminated. Prepare one problem's maximum 20 representatives at a time and release them before the next problem. Retaining all 80 worst-case prepared submissions can exceed the worker's 192 MiB heap allowance. A skipped oversized source or a soft-timeout source or pair must be omitted from the report rather than converted to similarity zero.

## Warning contract

`warnings: string[]` contains finite machine codes for frontend translation:

| Code | Meaning |
| --- | --- |
| `short-source` | Too few meaningful tokens for strong evidence. |
| `preprocessor-not-expanded` | Macros/conditional compilation are compared lexically. |
| `incomplete-comment` | Source ends inside a block comment. |
| `incomplete-raw-string` | Source ends inside a raw string. |
| `incomplete-string` | Source ends inside an ordinary string/character literal. |
| `unused-scalar-ignored` | Conservative unused scalar filtering removed declarations. |
| `evidence-regions-limited` | Only the 100 largest regions are displayed; scores are complete. |

## Project structure

The backend feature lives under `packages/hydrooj/src/lib/plagiarism/`:

- `engine.ts` contains the synchronous C++ lexical preparation and comparison engine; `index.ts` exports its public API.
- `executor.ts` starts and supervises the isolated CPU worker in `worker.ts`.
- `contest/` contains contest snapshots, persistent job storage, orchestration, and report types.
- `benchmark.ts` runs the full-size local stress workloads.

HTTP integration remains in `packages/hydrooj/src/handler/contestPlagiarism.ts`. Backend regression tests are grouped under `packages/hydrooj/tests/plagiarism/`. The frontend screen, report, source review, messages, and browser tests live together in `ycoj-ui/features/contest/plagiarism/`; transport methods and shared API response types remain in their existing API directories.

## Verification and benchmark

Run from the repository root:

```powershell
yarn test:plagiarism
yarn bench
node --max-old-space-size=192 -r @hydrooj/register packages/hydrooj/src/lib/plagiarism/benchmark.ts
```

`benchmark/plagiarism.bench.ts` uses bounded fixtures (128 statements and a 20-pair event) for CodSpeed simulation. The standalone stress benchmark retains long sources and the full 760-pair contest workload.

The 16 regression tests cover copying/renaming (including library-named variables/helpers), qualified library distinctions, bounded repetitive comparison preparation, comments and padding, helper extraction, block moves, equivalent loop rewrites, unrelated algorithm/input boilerplate, variable equality, operators/library/literal distinctions, raw strings, original line mapping, lexical warnings, input/deadline errors, repeated tokens, and a full event's 760 pairs.

Measured on 2026-10-11, Windows x64, Node.js 22.23.2, Intel Core i5-12400F, with a 192 MiB V8 old-space limit:

| Workload | Comparisons | Total including preparation | Slowest pair | Sampled peak heap |
| --- | ---: | ---: | ---: | ---: |
| Typical 20-participant × four-problem event | 760 | 81 ms | 1.32 ms | 10.1 MiB |
| Distinct long sources, up to 64 KiB each, about 14,000 tokens each | 760 | 6.83 s | 32.11 ms | 173.1 MiB |
| About 18,000 repetitive tokens, with one changed suffix | 1 | Preparation measured separately | 0.50 ms | Included in process |

These synthetic benchmarks verify ample headroom on this host, including high-frequency fingerprints and large feature bags. They are not a guarantee for arbitrary hardware or accuracy evidence. The event's representative-count limit gives at most `4 × 20 × 19 / 2 = 760` comparisons; worker startup, database/source loading, persistence, and frontend polling are outside the engine benchmark.
