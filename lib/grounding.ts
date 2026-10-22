/**
 * Final grounding validation for AI-generated resume content.
 *
 * Every tailored resume / cover letter is compared against the candidate's own
 * uploaded resume text before it is returned or stored. The model is prompted to
 * stay strictly factual, but prompts are not guarantees: a rewrite can still
 * invent "reduced latency by 38%" or "AWS Certified", which the candidate then
 * submits to a real employer.
 *
 * Two enforcement levels:
 *  - `fabricated_metric` findings are rewritten in place to an explicit
 *    `[add metric]` placeholder, so a number ResumeSetu made up can never reach
 *    the exported document.
 *  - `unsupported_credential` / `unsupported_employer` / `unsupported_skill` /
 *    `unsupported_date`
 *    findings are reported to the UI rather than silently edited, because
 *    deleting text can mangle an otherwise correct sentence.
 */

import { atsEngine, isTechnicalTerm } from './ats-engine.js';

export type GroundingFindingKind =
  | 'fabricated_metric'
  | 'unsupported_credential'
  | 'unsupported_employer'
  | 'unsupported_skill'
  | 'unsupported_date'
  | 'source_unavailable';

export interface GroundingFinding {
  id: string;
  kind: GroundingFindingKind;
  severity: 'high' | 'medium';
  /** Exact substring that triggered the finding. */
  excerpt: string;
  explanation: string;
}

export interface GroundingRedaction {
  original: string;
  replacement: string;
}

export interface GroundingReport {
  /** True when nothing unsupported was detected and a source resume was available. */
  grounded: boolean;
  findings: GroundingFinding[];
  redactions: GroundingRedaction[];
  checkedSentences: number;
  /** Short sentence suitable for display directly to the candidate. */
  note: string;
}

const METRIC_PLACEHOLDER = '[add metric]';
const DATE_PLACEHOLDER = '[confirm date]';

/** Trailing units that make a bare number a measurable claim. */
const METRIC_PATTERN =
  /(\$|€|£)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%|percent|x\b|ms\b|milliseconds?\b|s\b|seconds?\b|min(?:ute)?s?\b|hours?\b|hrs?\b|days?\b|weeks?\b|months?\b|years?\b|k\b|kb\b|mb\b|gb\b|tb\b|requests?\b|users?\b|records?\b|customers?\b|clients?\b|rows?\b|queries?\b|requests\/sec|kpi|mrr|arr|revenue\b|lines?\b|files?\b)/gi;

/** Calendar years are factual claims too; they are not performance metrics. */
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/g;

/**
 * Certifications a model can invent. Exported so the highlighter labels the
 * same set as "certification" instead of carrying a second, drifting list.
 */
export const CREDENTIAL_PATTERN =
  /\b(aws certified|azure certified|google cloud certified|certified kubernetes|pmp|certified scrummaster|scrum master|csm|cfa|cpa|cissp|cism|comptia|six sigma|lean six sigma|tensorflow certified|databricks certified)\b/gi;

/**
 * Two-word capitalized names that behave like employer references in a bullet
 * ("…at Acme Corp led…"). Single capitalized words are deliberately ignored:
 * they collide with sentence starts and skill names far too often. The
 * preposition is matched case-insensitively while the name itself stays
 * case-sensitive, so "At Globex" is caught alongside "at Acme".
 */
const EMPLOYER_PATTERN =
  /\b(?:at|with|for|joined)\s+([A-Z][a-zA-Z0-9&.'-]+(?:\s+[A-Z][a-zA-Z0-9&.'-]+){1,2})\b/gi;

/** Capitalized sequences that are role titles or products, not employers. */
const EMPLOYER_STOPWORDS = new Set([
  'Google',
  'Microsoft',
  'Amazon',
  'Azure',
  'AWS',
  'GCP',
]);

/** Bare years (2019, 2022) are dates, not performance metrics. */
function looksLikeYear(raw: string): boolean {
  const digits = raw.replace(/,/g, '');
  return /^\d{4}$/.test(digits) && Number(digits) >= 1900 && Number(digits) <= 2099;
}

function normalizeNumeric(raw: string): string {
  return raw.replace(/,/g, '').replace(/\.0+$/, '');
}

/** True when the same numeric value appears somewhere in the source resume. */
function numericSupported(raw: string, sourceNumbers: Set<string>): boolean {
  const normalized = normalizeNumeric(raw);
  if (looksLikeYear(normalized)) return true;
  if (sourceNumbers.has(normalized)) return true;
  // 15000 vs "15,000" vs "15k" — compare the leading integer too.
  const asNumber = Number(normalized);
  if (!Number.isFinite(asNumber)) return false;
  for (const candidate of sourceNumbers) {
    if (!/^\d+$/.test(candidate)) continue;
    if (Number(candidate) === asNumber) return true;
  }
  return false;
}

function collectSourceNumbers(source: string): Set<string> {
  const numbers = new Set<string>();
  for (const match of source.matchAll(/\d[\d,.]*/g)) {
    const normalized = normalizeNumeric(match[0].replace(/[.,]$/, ''));
    if (normalized) numbers.add(normalized);
  }
  // "15k" also satisfies a generated "15,000".
  for (const match of source.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) {
    numbers.add(String(Math.round(Number(match[1]) * 1000)));
  }
  return numbers;
}

function collectSourceYears(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(YEAR_PATTERN), (match) => match[0]));
}

function normalizeForContainment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ');
}

/**
 * Replaces every measurable claim in `text` that the source resume does not
 * support with an explicit `[add metric]` placeholder.
 */
export function redactUnsupportedMetrics(
  text: string,
  sourceResume: string
): { text: string; redactions: GroundingRedaction[] } {
  const source = (sourceResume || '').trim();
  if (!text || !source) return { text: text || '', redactions: [] };

  const sourceNumbers = collectSourceNumbers(source);
  const redactions: GroundingRedaction[] = [];

  const replaced = text.replace(METRIC_PATTERN, (match, currency: string, digits: string) => {
    if (numericSupported(digits, sourceNumbers)) return match;
    const redaction = { original: match.trim(), replacement: METRIC_PLACEHOLDER };
    redactions.push(redaction);
    return currency ? `${currency.trim()} ${METRIC_PLACEHOLDER}` : METRIC_PLACEHOLDER;
  });

  return { text: replaced, redactions };
}

/**
 * Replaces a generated calendar year that never appears in the source resume.
 * A date conflict is more damaging than an unfilled metric, so the exported
 * document asks the candidate to confirm it instead of presenting it as fact.
 */
export function redactUnsupportedDates(
  text: string,
  sourceResume: string
): { text: string; redactions: GroundingRedaction[] } {
  const sourceYears = collectSourceYears(sourceResume || '');
  const redactions: GroundingRedaction[] = [];
  const replaced = (text || '').replace(YEAR_PATTERN, (year) => {
    if (sourceYears.has(year)) return year;
    redactions.push({ original: year, replacement: DATE_PLACEHOLDER });
    return DATE_PLACEHOLDER;
  });
  return { text: replaced, redactions };
}

/**
 * Compares generated content against the candidate's own resume text.
 *
 * When no source resume is available the check cannot be performed at all; that
 * is reported as a finding rather than silently treated as "grounded".
 *
 * `jobDescription` is optional. When supplied, a second pass catches the most
 * damaging fabrication of all: a term the posting requires, that the resume
 * never mentions, appearing in the generated document as if the candidate had
 * it. Missing keywords must stay visible as gaps — never migrate into the work
 * history.
 */
export function validateAgainstSource(
  generated: string,
  sourceResume: string,
  jobDescription?: string
): GroundingReport {
  const output = (generated || '').trim();
  const source = (sourceResume || '').trim();
  const sentences = output.split(/\n+/).filter((line) => line.trim());
  const findings: GroundingFinding[] = [];

  if (!source) {
    findings.push({
      id: 'source_unavailable',
      kind: 'source_unavailable',
      severity: 'high',
      excerpt: '',
      explanation:
        'No source resume text was available to verify this output against, so ResumeSetu cannot confirm it is free of invented claims.',
    });
    return {
      grounded: false,
      findings,
      redactions: [],
      checkedSentences: sentences.length,
      note: 'Not verified: ResumeSetu had no source resume text to compare this document against.',
    };
  }

  const sourceNumbers = collectSourceNumbers(source);
  const sourceYears = collectSourceYears(source);
  const sourceLower = normalizeForContainment(source);

  for (const sentence of sentences) {
    for (const match of sentence.matchAll(METRIC_PATTERN)) {
      const digits = match[2] || '';
      if (!digits || numericSupported(digits, sourceNumbers)) continue;
      findings.push({
        id: `metric:${match[0].trim()}`,
        kind: 'fabricated_metric',
        severity: 'high',
        excerpt: match[0].trim(),
        explanation: 'This number does not appear anywhere in your uploaded resume, so it was replaced with a placeholder rather than presented as your result.',
      });
    }
  }

  for (const match of output.matchAll(CREDENTIAL_PATTERN)) {
    const credential = match[0];
    if (sourceLower.includes(normalizeForContainment(credential))) continue;
    findings.push({
      id: `credential:${credential}`,
      kind: 'unsupported_credential',
      severity: 'high',
      excerpt: credential,
      explanation: 'This certification is not in your uploaded resume. Only add it if you actually hold it.',
    });
  }

  for (const match of output.matchAll(YEAR_PATTERN)) {
    const year = match[0];
    if (sourceYears.has(year)) continue;
    findings.push({
      id: `date:${year}`,
      kind: 'unsupported_date',
      severity: 'high',
      excerpt: year,
      explanation: `The year ${year} does not appear in your uploaded resume, so it may contradict your actual timeline. Confirm it before submitting.`,
    });
  }

  for (const match of output.matchAll(EMPLOYER_PATTERN)) {
    const employer = (match[1] || '').trim();
    if (!employer || EMPLOYER_STOPWORDS.has(employer.split(/\s+/)[0])) continue;
    // The pattern carries the `i` flag so the prepositions match case-free,
    // which also lets `[A-Z]` match lowercase letters. A real name in this
    // position is capitalised, so re-assert that here — otherwise ordinary
    // prose such as "asks for that your resume does not evidence" was reported
    // as an unknown employer the candidate supposedly worked for.
    if (!employer.split(/\s+/).every((word) => /^[A-Z]/.test(word))) continue;
    if (sourceLower.includes(normalizeForContainment(employer))) continue;
    findings.push({
      id: `employer:${employer}`,
      kind: 'unsupported_employer',
      severity: 'medium',
      excerpt: employer,
      explanation: 'This organisation is not mentioned in your uploaded resume. Verify it is somewhere you actually worked before submitting.',
    });
  }

  // Skills the posting demands but the resume never mentions must not appear in
  // a generated resume as existing expertise. Only curated technical terms are
  // checked, so ordinary English rewording cannot trigger a false positive.
  //
  // A mention is only a CLAIM if it sits on a line that does not present it as a
  // gap. The local fallback appends "GAPS — keywords this job description asks
  // for that your resume does not evidence: aws, kubernetes …", which names the
  // same terms honestly; flagging those would teach the candidate to distrust a
  // correct warning.
  if (jobDescription && jobDescription.trim()) {
    const jdData = atsEngine.tokenize(jobDescription);
    const sourceData = atsEngine.tokenize(source);
    const outputData = atsEngine.tokenize(output);
    const gapContext =
      /\b(gaps?|missing|not (?:in|found in|evidenced by|present in|in your)|do(?:es)? not (?:have|evidence|appear|match)|don't have|absent from|lacks?|only claim|if you genuinely|checklist|add (?:a|this|it|them|bullet)|keywords this job description asks)\b/i;
    const outputLines = output.split('\n');
    const lineFrequencies = outputLines.map((line) => atsEngine.tokenize(line).frequency);
    // Gap lists are a header line followed by bullets with no blank line
    // between them ("- aws" carries no marker of its own), so the marker
    // applies to the rest of the block, and resets at the next blank line.
    let inGapBlock = false;
    const gapLine = outputLines.map((line) => {
      if (!line.trim()) {
        inGapBlock = false;
        return false;
      }
      if (gapContext.test(line)) {
        inGapBlock = true;
        return true;
      }
      return inGapBlock;
    });

    for (const [term] of jdData.frequency) {
      if (!isTechnicalTerm(term)) continue;
      if ((sourceData.frequency.get(term) || 0) > 0) continue;
      if ((outputData.frequency.get(term) || 0) === 0) continue;
      const claimingMentions = lineFrequencies.filter(
        (frequency, index) => (frequency.get(term) || 0) > 0 && !gapLine[index]
      ).length;
      if (claimingMentions === 0) continue;
      findings.push({
        id: `skill:${term}`,
        kind: 'unsupported_skill',
        severity: 'high',
        excerpt: term,
        explanation: `"${term}" is asked for by this job description but does not appear anywhere in your uploaded resume. Remove it from the draft or confirm you genuinely have this skill before you send it.`,
      });
    }
  }

  const redacted = redactUnsupportedMetrics(output, source);
  const uniqueFindings = Array.from(
    new Map(findings.map((finding) => [finding.id, finding])).values()
  );

  const notes: string[] = [];
  if (redacted.redactions.length > 0) {
    notes.push(
      `${redacted.redactions.length} unsupported number${redacted.redactions.length === 1 ? ' was' : 's were'} replaced with [add metric].`
    );
  }
  const unsupportedNonMetrics = uniqueFindings.filter((finding) => finding.kind !== 'fabricated_metric').length;
  if (unsupportedNonMetrics > 0) {
    notes.push(
      `${unsupportedNonMetrics} item${unsupportedNonMetrics === 1 ? '' : 's'} could not be verified against your resume and ${unsupportedNonMetrics === 1 ? 'needs' : 'need'} your review before you submit.`
    );
  }

  return {
    grounded: uniqueFindings.length === 0,
    findings: uniqueFindings,
    redactions: redacted.redactions,
    checkedSentences: sentences.length,
    note: notes.length
      ? notes.join(' ')
      : 'Every claim in this document maps back to your uploaded resume.',
  };
}

/**
 * Applies metric redaction and returns the report that should be persisted with
 * the document.
 *
 * The returned `text` is what callers must store and export: redactions are
 * applied in place, so a fabricated number can never reach the Word file even
 * though the finding is still shown to the candidate for review.
 */
export function enforceGrounding(
  generated: string,
  sourceResume: string,
  jobDescription?: string
): { text: string; report: GroundingReport } {
  const report = validateAgainstSource(generated, sourceResume, jobDescription);
  const metrics = redactUnsupportedMetrics(generated, sourceResume);
  const dates = redactUnsupportedDates(metrics.text, sourceResume);
  return {
    text: dates.text,
    report: { ...report, redactions: [...metrics.redactions, ...dates.redactions] },
  };
}
