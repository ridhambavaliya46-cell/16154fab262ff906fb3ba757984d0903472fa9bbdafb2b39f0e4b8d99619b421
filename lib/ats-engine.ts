/**
 * Deterministic ATS Keyword Matching & Algorithmic Scoring Engine
 * Uses Tokenization, TF-IDF Vectorization, and Cosine Similarity (DSA Optimization)
 */

// Curated technical taxonomy with compound keywords
const TECH_TAXONOMY = new Set([
  'react',
  'react.js',
  'next.js',
  'typescript',
  'javascript',
  'node.js',
  'nodejs',
  'express',
  'python',
  'golang',
  'go',
  'java',
  'c++',
  'rust',
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'graphql',
  'rest api',
  'microservices',
  'docker',
  'kubernetes',
  'k8s',
  'aws',
  'aws lambda',
  'amazon web services',
  'gcp',
  'google cloud',
  'azure',
  'ci/cd',
  'github actions',
  'terraform',
  'kafka',
  'rabbitmq',
  'elasticsearch',
  'tailwind',
  'tailwind css',
  'html5',
  'css3',
  'redux',
  'zustand',
  'webpack',
  'vite',
  'system design',
  'distributed systems',
  'unit testing',
  'jest',
  'cypress',
  'playwright',
  'agile',
  'scrum',
  'product management',
  'sql',
  'nosql',
  'prisma',
  'drizzle',
  'linux',
  'git',
  'oauth',
  'security',
  'performance optimization',
]);

// English stop words filter
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'let', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves', 'looking', 'role', 'team', 'years', 'experience',
  'responsibilities', 'qualifications', 'requirements', 'must', 'plus', 'preferred', 'skills',
]);

/**
 * Weighting of the two independent components of the ATS score.
 *
 * Keyword coverage is the auditable one ("x of y required terms appear in your
 * resume"). Semantic proximity is a bag-of-words cosine similarity and only
 * measures vocabulary overlap. Keeping them separate is what stopped a resume
 * covering 2 of 7 keywords (29%) from being reported as an 86% match.
 */
const COVERAGE_WEIGHT = 55;
const SEMANTIC_WEIGHT = 45;
/** Cosine similarity of two short documents rarely exceeds ~0.45; this rescales. */
const SEMANTIC_STRETCH = 2.2;
/** Display caps only. Scoring always uses the complete term sets. */
const MAX_REPORTED_MATCHED = 12;
const MAX_REPORTED_MISSING = 12;

export interface ScoreBreakdown {
  /** 0-100. Auditable keyword coverage. */
  keywordCoverage: number;
  /** 0-100. Calibrated vector proximity (not a recruiter judgement). */
  semanticProximity: number;
  /** 0-100. Weighted blend of the two components above. */
  overall: number;
}

export interface InputQuality {
  resumeChars: number;
  jobDescriptionChars: number;
  /** False whenever no score could be computed honestly. */
  scorable: boolean;
  /** Machine-readable reason for `scorable === false`. */
  reason: 'ok' | 'empty_resume' | 'empty_job_description' | 'no_keyword_signal';
  /** Sentence shown to the user when nothing could be scored. */
  explanation: string;
}

/**
 * Generic recruiting filler.
 *
 * These words repeat in almost every posting, carry no role signal, and were
 * therefore being promoted into the "required keyword" set purely by appearing
 * twice. That diluted keyword coverage (the denominator grew with filler the
 * candidate could never meaningfully evidence) and put phrases like "Nice people
 * apply" into the required list. They are filtered from BOTH documents so the
 * two sides stay symmetric.
 */
const GENERIC_JD_NOISE = new Set([
  'work', 'works', 'working', 'worked', 'candidate', 'candidates', 'applicant', 'applicants',
  'company', 'companies', 'organisation', 'organizations', 'team', 'teams', 'people',
  'including', 'include', 'includes', 'including:', 'strong', 'excellent', 'good', 'great',
  'new', 'person', 'persons', 'ability', 'able', 'knowledge', 'understanding', 'familiar',
  'across', 'within', 'using', 'use', 'uses', 'join', 'joining', 'help', 'helps',
  'benefit', 'benefits', 'offer', 'offers', 'offering', 'environment', 'environments',
  'opportunity', 'opportunities', 'level', 'levels', 'high', 'well', 'bonus', 'ideal',
  'ideally', 'preferably', 'looking', 'join', 'want', 'wants', 'need', 'needs',
  'please', 'kind', 'nice', 'vibes', 'apply', 'kindness', 'wonderful', 'matters',
  'least', 'ideally', 'minimum', 'preferably', 'professional', 'stakeholder', 'stakeholders',
]);

export interface AtsMatchAnalysis {
  /** Blended 0-100 ATS score. Read `scoreBreakdown` for the components. */
  matchScore: number;
  /** 0-100 semantic proximity on its own. */
  semanticMatchScore: number;
  cosineSimilarity: number;
  /** 0-1 exact keyword coverage: matched / required. */
  keywordCoverageRatio: number;
  keywordCoveragePercent: number;
  scoreBreakdown: ScoreBreakdown;
  /** Every required keyword found in the resume (JD vocabulary only). */
  keywordsMatched: string[];
  /** Every required keyword absent from the resume (JD vocabulary only). */
  keywordsMissing: string[];
  matchedCount: number;
  missingCount: number;
  requiredCount: number;
  /** Subset of the above restricted to recognised tools/technologies. */
  skillsMatched: string[];
  skillsMissing: string[];
  /** Display-capped lists persisted on the scan record. */
  presentKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  summary: string;
  inputQuality: InputQuality;
  starSuggestions: Array<{ original: string; suggestion: string; keyword: string }>;
}

// Multi-word / hyphen-slash taxonomy entries ("system design", "rest api", "ci/cd").
const COMPOUND_TAXONOMY = Array.from(TECH_TAXONOMY).filter((p) => /[\s/]/.test(p));

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes a raw word token.
 * Returns null when the token carries no signal.
 *
 * Trailing punctuation had to be stripped: "AWS." was kept verbatim by the old
 * sanitizer, so sentence-final skills never matched their taxonomy entry.
 */
function normalizeToken(raw: string): string | null {
  let word = raw.replace(/^[.\-]+/, '');
  // Preserve genuine dotted taxonomy keys such as "node.js" / "next.js".
  if (!TECH_TAXONOMY.has(word)) {
    word = word.replace(/[.\-]+$/, '');
  }
  if (word.length < 2) return null;
  if (word === 'nodejs') word = 'node.js';
  if (word === 'k8s') word = 'kubernetes';
  return word;
}

export class AtsAlgorithmicEngine {
  /**
   * Tokenizes and normalizes text, extracting single words and compound domain tokens.
   */
  tokenize(text: string): { tokens: string[]; frequency: Map<string, number> } {
    const clean = text.toLowerCase();
    const freq = new Map<string, number>();
    const tokens: string[] = [];

    const bump = (term: string, count: number) => {
      freq.set(term, (freq.get(term) || 0) + count);
      for (let i = 0; i < count; i++) tokens.push(term);
    };

    // 1. Extract compound taxonomy phrases first ("system design", "rest api", "ci/cd").
    // Matched regions are blanked out so their constituent words are not counted
    // a second time by the single-word pass below.
    let residue = clean;
    for (const phrase of COMPOUND_TAXONOMY) {
      const regex = new RegExp(`(?<![a-z0-9])${escapeRegExp(phrase)}(?![a-z0-9])`, 'g');
      if (!regex.test(residue)) continue;
      regex.lastIndex = 0;
      const matches = residue.match(regex);
      if (matches && matches.length) {
        bump(phrase, matches.length);
        residue = residue.replace(regex, ' ');
      }
    }

    // 2. Extract standard word tokens from what is left.
    // Normalization happens BEFORE the stop-word test: the character filter above
    // keeps sentence-final periods ("only."), so filtering on the raw token let
    // "only." and "people." through as requirements while the bare words were
    // correctly discarded.
    const rawWords = residue
      .replace(/[^a-z0-9+#.]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    for (const word of rawWords) {
      const normalized = normalizeToken(word);
      if (!normalized || STOP_WORDS.has(normalized) || GENERIC_JD_NOISE.has(normalized)) continue;
      bump(normalized, 1);
    }

    return { tokens, frequency: freq };
  }

  /**
   * Computes term-frequency weights for a document against a corpus vocabulary.
   * Curated technical terms receive an emphasis multiplier.
   */
  private computeTermWeights(
    freqMap: Map<string, number>,
    totalTokens: number,
    vocabulary: Set<string>
  ): Map<string, number> {
    const vector = new Map<string, number>();

    for (const term of vocabulary) {
      const count = freqMap.get(term) || 0;
      const tf = totalTokens > 0 ? count / totalTokens : 0;
      const boost = TECH_TAXONOMY.has(term) ? 2.5 : 1.0;
      vector.set(term, tf * boost);
    }

    return vector;
  }

  /**
   * Calculates Cosine Similarity between two term-frequency vectors.
   */
  private computeCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [key, valA] of vecA.entries()) {
      const valB = vecB.get(key) || 0;
      dotProduct += valA * valB;
      normA += valA * valA;
    }

    for (const valB of vecB.values()) {
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Primary Deterministic Matcher: computes exact keyword delta and calibrated score.
   *
   * The vocabulary is derived from the JOB DESCRIPTION ONLY. Including
   * resume-only terms (the previous behaviour) let an unrelated resume claim
   * "present" keywords and report perfect coverage.
   */
  analyzeMatch(jobDescription: string, resumeText: string): AtsMatchAnalysis {
    const jd = (jobDescription || '').trim();
    const resume = (resumeText || '').trim();

    const jdData = this.tokenize(jd);
    const resumeData = this.tokenize(resume);

    // Required vocabulary: what the job actually asks for.
    const vocabulary = new Set<string>();
    for (const term of jdData.frequency.keys()) {
      if (TECH_TAXONOMY.has(term) || (jdData.frequency.get(term) || 0) >= 2) {
        vocabulary.add(term);
      }
    }

    const inputQuality = (reason: InputQuality['reason'], explanation: string): InputQuality => ({
      resumeChars: resume.length,
      jobDescriptionChars: jd.length,
      scorable: false,
      reason,
      explanation,
    });

    // No JD signal, or nothing to compare against -> no score rather than a fake one.
    let quality: InputQuality;
    if (jd.length === 0) {
      quality = inputQuality(
        'empty_job_description',
        'No job description was supplied, so no match score could be computed.'
      );
    } else if (resume.length === 0) {
      quality = inputQuality(
        'empty_resume',
        'No resume text was supplied, so no match score could be computed.'
      );
    } else if (vocabulary.size === 0 || jdData.tokens.length === 0) {
      quality = inputQuality(
        'no_keyword_signal',
        'No recognizable role keywords were found in this job description, so no match score could be computed. Paste the full posting including its requirements section.'
      );
    } else if (resumeData.tokens.length === 0) {
      quality = inputQuality(
        'empty_resume',
        'The resume text contained no readable words, so no match score could be computed.'
      );
    } else {
      quality = { resumeChars: resume.length, jobDescriptionChars: jd.length, scorable: true, reason: 'ok', explanation: '' };
    }

    if (!quality.scorable) {
      return {
        matchScore: 0,
        semanticMatchScore: 0,
        cosineSimilarity: 0,
        keywordCoverageRatio: 0,
        keywordCoveragePercent: 0,
        scoreBreakdown: { keywordCoverage: 0, semanticProximity: 0, overall: 0 },
        keywordsMatched: [],
        keywordsMissing: [],
        matchedCount: 0,
        missingCount: 0,
        requiredCount: vocabulary.size,
        skillsMatched: [],
        skillsMissing: [],
        presentKeywords: [],
        missingKeywords: [],
        strengths: [],
        summary: quality.explanation,
        inputQuality: quality,
        starSuggestions: [],
      };
    }

    const jdVector = this.computeTermWeights(
      jdData.frequency,
      jdData.tokens.length,
      vocabulary
    );
    const resumeVector = this.computeTermWeights(
      resumeData.frequency,
      resumeData.tokens.length,
      vocabulary
    );

    const cosineSim = this.computeCosineSimilarity(jdVector, resumeVector);

    // Identify Keyword Delta (Matched vs Missing in Resume) over JD terms only.
    const keywordsMatched: string[] = [];
    const missingCandidates: Array<{ term: string; score: number }> = [];

    for (const [term, weight] of jdVector.entries()) {
      if ((resumeData.frequency.get(term) || 0) > 0) {
        keywordsMatched.push(term);
      } else if (weight > 0.005 || TECH_TAXONOMY.has(term)) {
        missingCandidates.push({ term, score: weight });
      }
    }

    // Sort by technical weight. Keep the FULL missing set for scoring; only the
    // displayed list is capped (the old code capped first, which inflated scores
    // for candidates missing dozens of keywords).
    missingCandidates.sort((a, b) => b.score - a.score);
    const keywordsMissing = missingCandidates.map((m) => m.term);

    const matchedCount = keywordsMatched.length;
    const missingCount = keywordsMissing.length;
    const requiredCount = matchedCount + missingCount;

    const keywordCoverage = requiredCount > 0 ? matchedCount / requiredCount : 0;
    const semanticProximity = Math.min(1, cosineSim * SEMANTIC_STRETCH);
    const rawScore = keywordCoverage * COVERAGE_WEIGHT + semanticProximity * SEMANTIC_WEIGHT;
    const matchScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    const skillsMatched = keywordsMatched.filter((term) => TECH_TAXONOMY.has(term));
    const skillsMissing = keywordsMissing.filter((term) => TECH_TAXONOMY.has(term));

    // Formulate strengths. Nothing is asserted here that the text did not support.
    const strengths: string[] = [];
    if (matchedCount > 0) {
      strengths.push(
        `Your resume evidences ${matchedCount} of the ${requiredCount} required keywords: ${keywordsMatched
          .slice(0, 5)
          .join(', ')}${matchedCount > 5 ? ', …' : ''}.`
      );
    }
    if (skillsMatched.length > 0) {
      strengths.push(`Matched tools and technologies: ${skillsMatched.slice(0, 6).join(', ')}.`);
    }
    if (matchedCount >= 8 && matchScore >= 75) {
      strengths.push('Broad keyword overlap with the core requirements in this posting.');
    }

    // Build summary
    let summary: string;
    if (matchedCount === 0) {
      summary = `No overlap found between this job description and the resume across ${missingCount} required keywords.`;
    } else if (matchScore >= 80) {
      summary = `Strong alignment at ${matchScore}% (keyword coverage ${Math.round(
        keywordCoverage * 100
      )}%, semantic proximity ${Math.round(semanticProximity * 100)}%). The resume evidences ${keywordsMatched
        .slice(0, 4)
        .join(', ')}, covering ${matchedCount} of ${requiredCount} required keywords.${
        missingCount > 0
          ? ` Addressing the ${missingCount} missing keyword${missingCount === 1 ? '' : 's'} would strengthen this application.`
          : ' No required keywords are missing.'
      }`;
    } else if (matchScore >= 50) {
      summary = `Moderate alignment at ${matchScore}% (keyword coverage ${Math.round(
        keywordCoverage * 100
      )}%, semantic proximity ${Math.round(semanticProximity * 100)}%). The resume evidences ${keywordsMatched
        .slice(0, 4)
        .join(', ')}. It is missing ${missingCount} required keyword${missingCount === 1 ? '' : 's'}${
        keywordsMissing.length ? `, including ${keywordsMissing.slice(0, 4).join(', ')}` : ''
      }.`;
    } else {
      summary = `Weak alignment at ${matchScore}% (keyword coverage ${Math.round(
        keywordCoverage * 100
      )}%, semantic proximity ${Math.round(semanticProximity * 100)}%). Only ${matchedCount} of ${requiredCount} required keywords are evidenced${
        keywordsMissing.length ? `, and the resume lacks ${keywordsMissing.slice(0, 4).join(', ')}` : ''
      }.`;
    }

    // Deterministic STAR suggestions.
    // These are structural prompts only. No metric, employer or achievement is
    // invented here — the previous version fabricated percentages that users then
    // submitted to real employers.
    const starSuggestions = keywordsMissing.slice(0, 3).map((kw) => ({
      original: `(No bullet in your resume currently evidences ${kw}.)`,
      suggestion: `Add a bullet from your own experience that demonstrates ${kw}, written as: action + how you did it + measurable result. Substitute your real numbers — leave "[add metric]" if you cannot substantiate one.`,
      keyword: kw,
    }));

    return {
      matchScore,
      semanticMatchScore: Math.round(semanticProximity * 100),
      cosineSimilarity: Number(cosineSim.toFixed(3)),
      keywordCoverageRatio: Number(keywordCoverage.toFixed(3)),
      keywordCoveragePercent: Math.round(keywordCoverage * 100),
      scoreBreakdown: {
        keywordCoverage: Math.round(keywordCoverage * 100),
        semanticProximity: Math.round(semanticProximity * 100),
        overall: matchScore,
      },
      keywordsMatched,
      keywordsMissing,
      matchedCount,
      missingCount,
      requiredCount,
      skillsMatched,
      skillsMissing,
      presentKeywords: keywordsMatched.slice(0, MAX_REPORTED_MATCHED),
      missingKeywords: keywordsMissing.slice(0, MAX_REPORTED_MISSING),
      strengths,
      summary,
      inputQuality: quality,
      starSuggestions,
    };
  }
}

export const atsEngine = new AtsAlgorithmicEngine();

/**
 * True when a term is one of the curated tools/technologies.
 *
 * Exported so the highlighter can label spans as "tool" vs plain "keyword"
 * using the SAME taxonomy the score was computed with, instead of carrying a
 * second list that would drift.
 */
export function isTechnicalTerm(term: string): boolean {
  return TECH_TAXONOMY.has((term || '').toLowerCase());
}
