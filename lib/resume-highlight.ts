/**
 * Deterministic, presentation-only resume highlighting.
 *
 * WHY THIS EXISTS
 * ---------------
 * Candidates need to see WHICH parts of their own resume answer the posting —
 * but a highlighter that invents, rewrites or over-marks a resume is worse than
 * none at all. This module is therefore a pure function with three hard rules:
 *
 *  1. TEXT PRESERVATION. Every highlighted span is a literal substring of the
 *     input text, and `segments.map(s => s.text).join('')` reproduces the input
 *     byte-for-byte. Nothing is re-worded, reordered or inserted. The unit
 *     tests assert this round trip.
 *  2. NO INVENTION. A span can only exist where the candidate's own text has
 *     the characters. A required keyword the resume does NOT contain (a "gap")
 *     can never be highlighted, because there is nothing to point at.
 *  3. SELECTIVITY. Caps keep the page readable: a resume is not a wall of
 *     colour. Candidates dropped by the caps are counted in `hiddenBySelectivity`
 *     so the UI can say "N more matches not highlighted" instead of hiding them
 *     silently.
 *
 * Category, reason and the related job-description requirement are computed
 * here so the UI only renders them — the explanation panel never has to guess.
 */

import { isTechnicalTerm } from './ats-engine.js';
import { CREDENTIAL_PATTERN } from './grounding.js';

/** Alias so the highlighter and the grounding validator label one list. */
const CERTIFICATION_PATTERN = CREDENTIAL_PATTERN;

export type ResumeHighlightCategory =
  | 'tool'
  | 'skill'
  | 'keyword'
  | 'certification'
  | 'achievement'
  | 'responsibility';

export interface ResumeHighlight {
  id: string;
  /** Start offset in the ORIGINAL text. */
  start: number;
  /** End offset (exclusive) in the ORIGINAL text. */
  end: number;
  /** Exact substring `text.slice(start, end)` — never a rewritten form. */
  text: string;
  category: ResumeHighlightCategory;
  /** Short category label for the legend and the explanation panel. */
  label: string;
  /** Why this is worth a recruiter's attention for THIS posting. */
  reason: string;
  /** The job-description requirement this answers, when there is one. */
  jdRequirement: string | null;
  /** Always true by construction: the span is literally in the source. */
  evidence: 'explicit_in_source';
  /** Ranking used for selectivity; 1 = most relevant. */
  importance: number;
}

export interface ResumeSegment {
  text: string;
  highlightId: string | null;
}

export interface ResumeHighlightResult {
  /** Ordered plain-text segments whose concatenation equals the input exactly. */
  segments: ResumeSegment[];
  highlights: ResumeHighlight[];
  /** Candidates dropped by the selectivity caps (never silently invented). */
  hiddenBySelectivity: number;
}

export interface BuildHighlightsOptions {
  resumeText: string;
  /** Job-description terms the resume already evidences. Usually `keywordsMatched`. */
  matchedKeywords?: string[] | null;
  /** Gaps. Passed in so tests can prove they are NEVER highlighted. */
  missingKeywords?: string[] | null;
  /** Upper bound on rendered highlights. Default `DEFAULT_MAX_HIGHLIGHTS`. */
  maxHighlights?: number;
}

/** Display caps. Scoring is unaffected — these only shape the preview. */
export const DEFAULT_MAX_HIGHLIGHTS = 14;
const MAX_OCCURRENCES_PER_TERM = 2;
const MAX_ACHIEVEMENTS = 4;
const MAX_CERTIFICATIONS = 3;
const MAX_LEADERSHIP = 3;

const CATEGORY_LABEL: Record<ResumeHighlightCategory, string> = {
  tool: 'Tool / technology',
  skill: 'Skill',
  keyword: 'Role keyword',
  certification: 'Certification',
  achievement: 'Quantified achievement',
  responsibility: 'Leadership / responsibility',
};

const KEYWORD_REASON =
  'Required by this job description and present in your own resume, so a recruiter scanning for it will find it.';
const ACHIEVEMENT_REASON =
  'A quantified result from your own resume. Numbers like this make the impact easier to evaluate — confirm the figure is current before you send it.';
const CERTIFICATION_REASON =
  'A certification stated in your own resume. Confirm it is still valid and relevant before applying.';
const LEADERSHIP_REASON =
  'A leadership or ownership verb in a line that also matches this posting — useful evidence for senior or lead responsibilities.';

/** Numbers with a measurable unit, e.g. "42%", "15,000 requests", "3x". */
const ACHIEVEMENT_PATTERN =
  /(?:[$€£]\s?)?\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s*(?:%|percent\b|x\b|ms\b|requests?\b|users?\b|records?\b|customers?\b|clients?\b|rows?\b|queries?\b|lines?\b|files?\b|minutes?\b|hours?\b|days?\b|weeks?\b|months?\b|k\b|kb\b|mb\b|gb\b)/gi;

const LEADERSHIP_PATTERN =
  /\b(?:led|mentored|managed|directed|architected|founded|launched|owned|drove|headed|supervised|coordinated|established)\b/gi;

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary regex for an arbitrary term.
 *
 * The boundary mirrors the ATS tokenizer: "c++" and "ci/cd" must match, and
 * "aws" must not match inside "draws". Lookbehind/lookahead around the term
 * keep alphanumerics (and the +/#/. chars the tokenizer keeps) attached.
 */
function termRegex(term: string): RegExp {
  return new RegExp(`(?<![a-z0-9+#])${escapeRegExp(term.toLowerCase())}(?![a-z0-9+#])`, 'gi');
}

interface Candidate {
  start: number;
  end: number;
  category: ResumeHighlightCategory;
  reason: string;
  jdRequirement: string | null;
  importance: number;
}

function overlaps(a: Candidate, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function buildResumeHighlights(options: BuildHighlightsOptions): ResumeHighlightResult {
  const text = options.resumeText || '';
  const matched = [...new Set((options.matchedKeywords || []).map((k) => k.toLowerCase()).filter(Boolean))];
  const missing = new Set((options.missingKeywords || []).map((k) => k.toLowerCase()).filter(Boolean));
  const maxHighlights = Math.max(0, options.maxHighlights ?? DEFAULT_MAX_HIGHLIGHTS);

  if (!text || maxHighlights === 0) {
    return { segments: [], highlights: [], hiddenBySelectivity: 0 };
  }

  const keywordCandidates: Candidate[] = [];
  const certificationCandidates: Candidate[] = [];
  const achievementCandidates: Candidate[] = [];
  const leadershipCandidates: Candidate[] = [];
  let hiddenBySelectivity = 0;
  const lower = text.toLowerCase();

  // -------------------------------------------------------------------------
  // Group 1 — job-relevant terms the resume actually evidences.
  // Ranked: tools/technologies first, then longer (more specific) phrases,
  // then the order the engine produced them in.
  // -------------------------------------------------------------------------
  const termCandidates = matched
    // Defensive: a "missing" term must never be highlighted even if a caller
    // passes it in `matchedKeywords` by mistake.
    .filter((term) => !missing.has(term))
    .map((term, order) => ({
      term,
      order,
      tech: isTechnicalTerm(term),
      specificity: term.split(/[\s/]+/).length + term.length / 50,
    }))
    .sort((a, b) => {
      if (a.tech !== b.tech) return a.tech ? -1 : 1;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return a.order - b.order;
    });

  for (const { term } of termCandidates) {
    const regex = termRegex(term);
    let occurrences = 0;
    for (const match of text.matchAll(regex)) {
      // Every later occurrence is a deliberate non-highlight, counted so the UI
      // can say how many were dropped instead of hiding them.
      if (occurrences >= MAX_OCCURRENCES_PER_TERM) {
        hiddenBySelectivity += 1;
        continue;
      }
      keywordCandidates.push({
        start: match.index,
        end: match.index + match[0].length,
        category: isTechnicalTerm(term) ? 'tool' : 'keyword',
        reason: KEYWORD_REASON,
        jdRequirement: term,
        importance: 1,
      });
      occurrences += 1;
    }
  }

  // -------------------------------------------------------------------------
  // Group 2 — certifications the resume states.
  // -------------------------------------------------------------------------
  for (const match of text.matchAll(CERTIFICATION_PATTERN)) {
    certificationCandidates.push({
      start: match.index,
      end: match.index + match[0].length,
      category: 'certification',
      reason: CERTIFICATION_REASON,
      jdRequirement: null,
      importance: 2,
    });
  }

  // -------------------------------------------------------------------------
  // Group 3 — genuine quantified results.
  // -------------------------------------------------------------------------
  for (const match of text.matchAll(ACHIEVEMENT_PATTERN)) {
    const raw = match[0];
    // A bare year is a date, not an achievement; it is simply not a candidate.
    if (/^\d{4}$/.test(raw.trim())) continue;
    achievementCandidates.push({
      start: match.index,
      end: match.index + raw.length,
      category: 'achievement',
      reason: ACHIEVEMENT_REASON,
      jdRequirement: null,
      importance: 3,
    });
  }

  // -------------------------------------------------------------------------
  // Group 4 — leadership verbs, but only inside lines that already match the
  // posting. "Mentored juniors" in an unrelated hobby line is not evidence for
  // this role, and marking it would only add noise.
  // -------------------------------------------------------------------------
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const lineForKeyword = (index: number): boolean => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    const start = lineStarts[lo];
    const end = text.indexOf('\n', start);
    const line = lower.slice(start, end === -1 ? text.length : end);
    return matched.some((term) => termRegex(term).test(line));
  };

  for (const match of text.matchAll(LEADERSHIP_PATTERN)) {
    if (!lineForKeyword(match.index)) continue;
    leadershipCandidates.push({
      start: match.index,
      end: match.index + match[0].length,
      category: 'responsibility',
      reason: LEADERSHIP_REASON,
      jdRequirement: null,
      importance: 4,
    });
  }

  // -------------------------------------------------------------------------
  // Selection. Evidence groups take a guaranteed slice FIRST (they have small,
  // hard caps), then keywords fill every remaining slot. A single global rank
  // would let a keyword-dense resume take all 14 slots and leave zero
  // achievements, certifications or leadership lines — which is exactly the
  // noise-free page the candidate asked for, but never the whole story.
  // -------------------------------------------------------------------------
  const accepted: Candidate[] = [];
  const groups = [certificationCandidates, achievementCandidates, leadershipCandidates];
  const groupCaps = [MAX_CERTIFICATIONS, MAX_ACHIEVEMENTS, MAX_LEADERSHIP];
  const takenPerGroup = [0, 0, 0];
  const minKeywordShare = Math.max(1, Math.ceil(maxHighlights * 0.6));
  const otherShare = Math.max(0, maxHighlights - minKeywordShare);

  let otherTaken = 0;
  let progress = true;
  while (progress && otherTaken < otherShare && accepted.length < maxHighlights) {
    progress = false;
    for (let g = 0; g < groups.length && otherTaken < otherShare && accepted.length < maxHighlights; g++) {
      if (takenPerGroup[g] >= groupCaps[g]) continue;
      const list = groups[g];
      let candidate: Candidate | undefined;
      while (list.length > 0 && !candidate) {
        const next = list.shift()!;
        if (!accepted.some((a) => overlaps(a, next))) candidate = next;
      }
      if (!candidate) continue;
      accepted.push(candidate);
      takenPerGroup[g] += 1;
      otherTaken += 1;
      progress = true;
    }
  }
  for (const list of groups) hiddenBySelectivity += list.length;

  const keywordBudget = Math.max(0, maxHighlights - accepted.length);
  let keywordTaken = 0;
  for (const candidate of keywordCandidates) {
    if (keywordTaken >= keywordBudget) {
      hiddenBySelectivity += 1;
      continue;
    }
    if (accepted.some((a) => overlaps(a, candidate))) continue;
    accepted.push(candidate);
    keywordTaken += 1;
  }

  accepted.sort((a, b) => a.start - b.start);
  const kept = accepted;

  const highlights: ResumeHighlight[] = kept.map((candidate, index) => ({
    id: `hl_${index + 1}`,
    start: candidate.start,
    end: candidate.end,
    text: text.slice(candidate.start, candidate.end),
    category: candidate.category,
    label: CATEGORY_LABEL[candidate.category],
    reason: candidate.reason,
    jdRequirement: candidate.jdRequirement,
    evidence: 'explicit_in_source',
    importance: candidate.importance,
  }));

  const segments: ResumeSegment[] = [];
  let cursor = 0;
  for (const highlight of highlights) {
    if (highlight.start > cursor) {
      segments.push({ text: text.slice(cursor, highlight.start), highlightId: null });
    }
    segments.push({ text: text.slice(highlight.start, highlight.end), highlightId: highlight.id });
    cursor = highlight.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlightId: null });
  if (segments.length === 0) segments.push({ text, highlightId: null });

  // Invariant: the preview is a presentation layer, never a rewrite.
  const reconstructed = segments.map((segment) => segment.text).join('');
  if (reconstructed !== text) {
    // Cannot happen with the slicing above; kept as a hard assertion so a future
    // refactor that mutates text fails loudly here instead of in production.
    throw new Error('resume-highlight: segments do not reconstruct the source text');
  }

  return { segments, highlights, hiddenBySelectivity };
}
