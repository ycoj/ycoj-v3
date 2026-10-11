export const PLAGIARISM_METHODS = ['heuristic', 'tree-sitter'] as const;
export type PlagiarismMethod = typeof PLAGIARISM_METHODS[number];
export const DEFAULT_PLAGIARISM_METHOD: PlagiarismMethod = 'tree-sitter';
export const TREE_SITTER_ENGINE_VERSION = 'cpp-tree-sitter-v1';
