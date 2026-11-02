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
      label: 'Role requirements found',
      value: scoreBreakdown.keywordCoverage,
      definition: `${matchedCount} of the ${requiredCount} terms this posting is actually asking for appear in your resume${
        requiredCount > 0 ? '' : ', so there is nothing to count yet'
      }. Common filler words in job ads are excluded from both sides of that fraction.`,
      movesIt:
        'Only include a role requirement if it reflects your real experience. Add context that shows how you used that skill.',
    },
    {
      id: 'semantic',
      label: 'Similar wording',
      value: scoreBreakdown.semanticProximity,
      definition:
        'A look at how closely the language in your resume reflects the language in the job posting.',
      movesIt:
        'Describe your real experience in clear language that connects to the role.',
    },
    {
      id: 'overall',
      label: 'Resume match',
      value: scoreBreakdown.overall,
      definition: `Combines role requirements found (${COVERAGE_WEIGHT}%) with similar wording (${SEMANTIC_WEIGHT}%). It is a guide to your documents, not a hiring prediction.`,
      movesIt: 'It follows from the two comparisons above.',
    },
  ];

  const advice: string[] = [];
  if (scorable && missingCount > 0) {
    advice.push(
      `${missingCount} role requirement${missingCount === 1 ? ' is' : 's are'} not in your resume yet. Add only the ones that reflect your real experience, with enough detail to explain how you used them.`
    );
  }
  if (scorable) {
    advice.push(
      'Review the comparison again after you edit your resume to see what changed.'
    );
  }

  return {
    scorable,
    unscoreableReason: scorable ? null : (quality?.explanation ?? null),
    formula: `overall = ${COVERAGE_WEIGHT}% × keyword coverage + ${SEMANTIC_WEIGHT}% × semantic proximity`,
    rows,
    notMeasured: [
      'Whether an employer will choose to interview you.',
      'Grammar, spelling, or writing style.',
      'Seniority, years of experience or employment gaps.',
      'Whether a human will like your resume — no algorithm predicts that.',
    ],
    advice,
    recomputed,
  };
}
