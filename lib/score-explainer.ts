/**
 * Turns the deterministic score into sentences the candidate can act on.
 *
 * This lives in `lib/` rather than in the component so the wording rules are
 * unit-testable: every number shown here must come from the engine's own
 * breakdown, and every explanation must match what the engine actually
 * computes (weights, denominator, stretch factor). If the engine changes, a
 * test here fails before a user reads a wrong sentence.
 */

export interface ScoreComponentRow {
  id: 'coverage' | 'semantic' | 'overall';
  label: string;
  value: number;
  /** What the number literally measures. */
  definition: string;
  /** What can honestly change it. */
  movesIt: string;
}

export interface ScoreExplanation {
  /** True only when the engine could compute a score honestly. */
  scorable: boolean;
  /** Engine sentence explaining why no score could be computed, if any. */
  unscoreableReason: string | null;
  /** Auditable formula, with the engine's real weights. */
  formula: string;
  rows: ScoreComponentRow[];
  /** Dimensions this number deliberately does not include. */
  notMeasured: string[];
  /** Next steps, phrased so they cannot be read as "fake it until you make it". */
  advice: string[];
  /** Recomputed from the components; must equal `overall` (tested). */
  recomputed: number;
}

export interface ScoreExplanationInput {
  scoreBreakdown: { keywordCoverage: number; semanticProximity: number; overall: number };
  matchedCount: number;
  requiredCount: number;
  missingCount?: number;
  inputQuality?: { scorable: boolean; reason: string; explanation: string } | null;
}

/** Kept in sync with COVERAGE_WEIGHT / SEMANTIC_WEIGHT in ats-engine.ts. */
export const COVERAGE_WEIGHT = 55;
export const SEMANTIC_WEIGHT = 45;

export function buildScoreExplanation(input: ScoreExplanationInput): ScoreExplanation {
  const { scoreBreakdown, matchedCount, requiredCount } = input;
  const quality = input.inputQuality ?? null;
  const scorable = quality ? quality.scorable : true;
  const missingCount = input.missingCount ?? Math.max(0, requiredCount - matchedCount);

  const recomputed = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (scoreBreakdown.keywordCoverage * COVERAGE_WEIGHT +
          scoreBreakdown.semanticProximity * SEMANTIC_WEIGHT) /
          100
      )
    )
  );

  const rows: ScoreComponentRow[] = [
    {
      id: 'coverage',
      label: 'Keyword coverage',
      value: scoreBreakdown.keywordCoverage,
      definition: `${matchedCount} of the ${requiredCount} terms this posting is actually asking for appear in your resume${
        requiredCount > 0 ? '' : ', so there is nothing to count yet'
      }. Common filler words in job ads are excluded from both sides of that fraction.`,
      movesIt:
        'Only by adding a term you can genuinely evidence from your own work. A keyword listed without proof behind it is what screening filters and interviewers catch first.',
    },
    {
      id: 'semantic',
      label: 'Semantic proximity',
      value: scoreBreakdown.semanticProximity,
      definition:
        'Vocabulary overlap between your resume and the posting, measured as calibrated cosine similarity over both documents’ term frequencies.',
      movesIt:
        'By describing your real experience in the posting’s own vocabulary — the same achievements phrased the way this employer phrases them.',
    },
    {
      id: 'overall',
      label: 'Overall ATS score',
      value: scoreBreakdown.overall,
      definition: `A weighted blend: ${COVERAGE_WEIGHT}% keyword coverage plus ${SEMANTIC_WEIGHT}% semantic proximity, rounded to a whole number.`,
      movesIt: 'It follows from the two rows above; there is no separate lever to pull.',
    },
  ];

  const advice: string[] = [];
  if (scorable && missingCount > 0) {
    advice.push(
      `${missingCount} required term${missingCount === 1 ? ' is' : 's are'} missing. Add the ones you truly have as bullets with context and a result — never as a bare keyword, and never for experience you do not have.`
    );
  }
  if (scorable) {
    advice.push(
      'Re-run this scan after each edit: coverage changes immediately, proximity changes as your phrasing converges with the posting.'
    );
  }

  return {
    scorable,
    unscoreableReason: scorable ? null : (quality?.explanation ?? null),
    formula: `overall = ${COVERAGE_WEIGHT}% × keyword coverage + ${SEMANTIC_WEIGHT}% × semantic proximity`,
    rows,
    notMeasured: [
      'Formatting and layout (this is text analysis, not a visual ATS renderer).',
      'Grammar, spelling and tone.',
      'Seniority, years of experience or employment gaps.',
      'Whether a human will like your resume — no algorithm predicts that.',
    ],
    advice,
    recomputed,
  };
}
