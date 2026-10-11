const explanationKeys: Record<string, string> = {
  'Only C++ submissions are supported.': 'explanations.cppOnly',
  'Source code is empty or unavailable.': 'explanations.emptySource',
  'Source code exceeds the 64 KiB analysis limit.': 'explanations.sourceLimit',
  'Stored source code is unavailable.': 'explanations.storedSourceUnavailable',
  'Stored source code could not be read.':
    'explanations.storedSourceUnreadable',
  'C++ submissions may contain at most 262144 bytes.':
    'explanations.engineByteLimit',
  'C++ submissions may contain at most 30000 lexical tokens.':
    'explanations.tokenLimit',
  'The C++ similarity comparison exceeded its ten-second soft time limit.':
    'explanations.pairTimeout',
  'The plagiarism check exceeded the five-minute time limit. Please try again.':
    'explanations.contestTimeout',
  'The plagiarism check failed. Please try again.': 'taskFailed',
  'Plagiarism checks support contests with at most four problems.':
    'explanations.problemLimit',
  'Plagiarism checks support contests with at most 20 participants.':
    'explanations.participantLimit',
  'The similarity report exceeded the storage limit.':
    'explanations.reportLimit',
};

export function localizePlagiarismExplanation(
  message: string,
  translate: (key: string) => string
) {
  const key = explanationKeys[message];
  return key ? translate(key) : message;
}
