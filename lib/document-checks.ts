/**
 * Honest, measurable ATS document checks.
 *
 * Two rules govern everything in this file:
 *
 *  1. A check reports `pass` / `warn` / `fail` ONLY when ResumeSetu actually
 *     measured something. Anything the tool genuinely cannot determine is
 *     reported as `not_tested` with `measured: false` — it is never turned into
 *     an invented percentage. Previously the dashboard rendered invented
 *     "OCR 92%", "Impact verb ratio 78%" and "Quantified metrics 85%" figures
 *     that no code ever computed.
 *  2. `estimated: true` marks a result derived from a heuristic (for example a
 *     column-layout risk signal inferred from whitespace runs).
 */

export type DocumentCheckStatus = 'pass' | 'warn' | 'fail' | 'not_tested';

export interface DocumentCheck {
  id: string;
  label: string;
  status: DocumentCheckStatus;
  /** True only when ResumeSetu performed a real measurement for this check. */
  measured: boolean;
  /** True when the result comes from a heuristic rather than a direct fact. */
  estimated: boolean;
  detail: string;
}

export interface DocumentCheckReport {
  checks: DocumentCheck[];
  measuredCount: number;
  notTestedCount: number;
  wordCount: number;
  characterCount: number;
  /** Original file name when the checks ran against an uploaded document. */
  sourceName: string | null;
  /** True when the checks describe a document ResumeSetu generated itself. */
  generatedByResumeSetu: boolean;
}

const STANDARD_HEADINGS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Summary', patterns: [/^(professional\s+)?summary\b/i, /^profile\b/i, /^objective\b/i] },
  {
    label: 'Experience',
    patterns: [/^(professional|work|employment)\s+experience\b/i, /^experience\b/i, /^career history\b/i],
  },
  {
    label: 'Skills',
    patterns: [/^(technical\s+)?skills\b/i, /^core\s+(competencies|skills)\b/i, /^competencies\b/i, /^technologies\b/i],
  },
  { label: 'Education', patterns: [/^education\b/i, /^academic background\b/i] },
  { label: 'Projects', patterns: [/^projects?\b/i, /^selected projects\b/i] },
  {
    label: 'Certifications',
    patterns: [/^certifications?\b/i, /^licenses?\b/i, /^courses?\b/i],
  },
  { label: 'Achievements', patterns: [/^achievements?\b/i, /^awards?\b/i, /^honors?\b/i, /^publications?\b/i] },
];

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/;
const PROFILE_PATTERN = /(https?:\/\/[^\s)]+|www\.[^\s)]+|(?:linkedin|github|gitlab|behance|dribbble)\.com\/[^\s)]+)/i;

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * Column/table risk heuristic.
 *
 * Extracted plain text carries no layout boxes, so a true column count cannot
 * be measured. What *is* measurable is the fingerprint a two-column or table
 * layout leaves behind: repeated runs of 3+ spaces, hard tabs, or pipe/bullet
 * rows with many aligned fields. A high hit count is reported as an estimated
 * warning, never as a measured verdict.
 */
function evaluateColumnRisk(text: string): { risky: boolean; signals: string[] } {
  const lines = text.split('\n');
  let wideGapLines = 0;
  let tabLines = 0;
  let multiFieldLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (/\t{1,}/.test(line)) tabLines += 1;
    if (/\S {3,}\S/.test(line)) wideGapLines += 1;
    if (line.split(/\s{3,}|\s\|\s|\t/).filter((cell) => cell.trim()).length >= 3) multiFieldLines += 1;
  }

  const nonEmpty = lines.filter((line) => line.trim()).length || 1;
  const wideGapRatio = wideGapLines / nonEmpty;
  const multiFieldRatio = multiFieldLines / nonEmpty;
  const signals: string[] = [];

  if (wideGapRatio > 0.25) signals.push(`${Math.round(wideGapRatio * 100)}% of lines contain wide internal gaps`);
  if (tabLines > 2) signals.push(`${tabLines} line(s) use hard tab alignment`);
  if (multiFieldRatio > 0.3) signals.push(`${Math.round(multiFieldRatio * 100)}% of lines look like aligned table rows`);

  return { risky: signals.length >= 2, signals };
}

/**
 * Runs every document check ResumeSetu can actually perform.
 *
 * @param text                Extracted document text (already OCR-validated upstream).
 * @param options.sourceName   Original file name, when the text came from an upload.
 * @param options.generated   Set when the document is a ResumeSetu DOCX export.
 */
export function runDocumentChecks(
  text: string,
  options: { sourceName?: string | null; generated?: boolean } = {}
): DocumentCheckReport {
  const body = (text || '').trim();
  const wordCount = countWords(body);
  const checks: DocumentCheck[] = [];

  // 1. Text extraction — a real measurement: we either have a text layer or we do not.
  checks.push(
    wordCount >= 25
      ? {
          id: 'text_extraction',
          label: 'Readable text',
          status: 'pass',
          measured: true,
          estimated: false,
          detail: `A selectable text layer was found: ${wordCount.toLocaleString('en-US')} words, ${body.length.toLocaleString(
            'en-US'
          )} characters found in the document.`,
        }
      : {
          id: 'text_extraction',
          label: 'Readable text',
          status: 'fail',
          measured: true,
          estimated: false,
          detail: `We could read only ${wordCount} word(s). If this is a scanned image, try a text-based PDF or Word file instead.`,
        }
  );

  // 2. Single-column layout — measured for our own export, heuristic otherwise.
  if (options.generated) {
    checks.push({
      id: 'single_column_layout',
          label: 'Easy-to-read layout',
      status: 'pass',
      measured: true,
      estimated: false,
      detail: 'This document is generated by ResumeSetu as a single-column, table-free Word file with a standard top-to-bottom reading order.',
    });
  } else {
    const risk = evaluateColumnRisk(body);
    checks.push(
      risk.risky
        ? {
            id: 'single_column_layout',
      label: 'Easy-to-read layout',
            status: 'warn',
            measured: true,
            estimated: true,
            detail: `This file may use columns or tables (${risk.signals.join(
              '; '
            )}). A simple one-column layout can make your experience easier to follow.`,
          }
        : {
            id: 'single_column_layout',
          label: 'Easy-to-read layout',
            status: 'not_tested',
            measured: false,
            estimated: false,
            detail:
              'We can’t confirm the layout of an uploaded file from its text alone. Word drafts from ResumeSetu use a clear one-column layout.',
          }
    );
  }

  // 3. Heading structure — check for familiar resume section names.
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const headingPresence = STANDARD_HEADINGS.map((section) => ({
    label: section.label,
    found: lines.some((line) => section.patterns.some((pattern) => pattern.test(line))),
  }));
  const foundHeadings = headingPresence.filter((section) => section.found).map((section) => section.label);
  const missingHeadings = headingPresence.filter((section) => !section.found).map((section) => section.label);

  checks.push(
    foundHeadings.length === 0
      ? {
          id: 'heading_structure',
          label: 'Resume sections',
          status: 'fail',
          measured: true,
          estimated: false,
          detail:
            'We couldn’t find familiar headings like Summary, Experience, Skills, or Education. Adding clear section headings can make your resume easier to read.',
        }
      : {
          id: 'heading_structure',
          label: 'Resume sections',
          status: missingHeadings.length === 0 ? 'pass' : 'warn',
          measured: true,
          estimated: false,
          detail: `Found: ${foundHeadings.join(', ')}.${
            missingHeadings.length ? ` Not detected: ${missingHeadings.join(', ')}.` : ''
          }`,
        }
  );

  // 4. Contact information — a real measurement on the extracted text.
  const email = body.match(EMAIL_PATTERN)?.[0] || null;
  const phone = PHONE_PATTERN.test(body) ? 'found' : null;
  const profile = body.match(PROFILE_PATTERN)?.[0] || null;
  const missingContact = [
    email ? null : 'email address',
    phone ? null : 'phone number',
    profile ? null : 'profile/portfolio link',
  ].filter(Boolean) as string[];

  checks.push(
    missingContact.length === 0
      ? {
          id: 'contact_info',
          label: 'Contact information',
          status: 'pass',
          measured: true,
          estimated: false,
          detail: 'An email address, a phone number and an external profile link were all found in the document text.',
        }
      : {
          id: 'contact_info',
          label: 'Contact information',
          status: missingContact.length === 3 ? 'fail' : 'warn',
          measured: true,
          estimated: false,
          detail: `Not found in the document text: ${missingContact.join(', ')}. Employers need an email address and phone number to contact you.`,
        }
  );

  // 5. Third-party ATS parser pass — explicitly unmeasured, by design.
  checks.push({
    id: 'ats_parser_pass',
          label: 'Hiring system compatibility',
    status: 'not_tested',
    measured: false,
    estimated: false,
    detail:
      'Not checked. We don’t send your resume to employers or their hiring systems.',
  });

  return {
    checks,
    measuredCount: checks.filter((check) => check.measured).length,
    notTestedCount: checks.filter((check) => !check.measured).length,
    wordCount,
    characterCount: body.length,
    sourceName: options.sourceName ?? null,
    generatedByResumeSetu: Boolean(options.generated),
  };
}
