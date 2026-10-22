/**
 * Unit tests for the deterministic scoring, document-check and grounding layers.
 *
 * These modules contain every rule that decides what a candidate is told about
 * their own resume, so they are exercised directly rather than through HTTP.
 *
 * Covers the cases called out as regressions:
 *  - empty resume
 *  - incomplete / signal-free job description
 *  - missing keywords (the 2-of-7 vs "86% match" contradiction)
 *  - hallucinated metrics, certifications and employers
 *  - DOCX round-trip content integrity
 *
 * Run with: npm run test:unit
 */
import { atsEngine } from '../lib/ats-engine.js';
import { runDocumentChecks } from '../lib/document-checks.js';
import {
  enforceGrounding,
  redactUnsupportedDates,
  redactUnsupportedMetrics,
  validateAgainstSource,
} from '../lib/grounding.js';
import { generateResumeDocx, verifyDocxIntegrity } from '../lib/docx-generator.js';
import { buildResumeHighlights, DEFAULT_MAX_HIGHLIGHTS } from '../lib/resume-highlight.js';
import { buildScoreExplanation, COVERAGE_WEIGHT, SEMANTIC_WEIGHT } from '../lib/score-explainer.js';
import { checkIpBurstLimit, resetIpBurstLimits } from '../lib/burst-limiter.js';
import {
  decodeEntities,
  tokenizeHighlightedHtml,
  tokenText,
} from '../src/lib/highlight-tokens.js';
import {
  buildContentSecurityPolicy,
  clerkFrontendOrigin,
  SECURITY_HEADERS,
  HSTS_HEADER,
} from '../lib/csp.js';
import {
  buildPaymentMessage,
  buildTelegramUrl,
  isReferenceExpired,
  issuePaymentReference,
  ownerTelegramHandle,
  sanitizeAvatarUrl,
  verifyPaymentReference,
} from '../lib/payment.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_SCAN_LIMIT, PRO_PRICE_INR, PRO_UNLIMITED_CREDITS, remainingScansFor } from '../src/config.js';

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n[${title}]`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SW_ENGINEER_RESUME = `ALEX CHEN
Full Stack Software Engineer | San Francisco, CA | alex.chen@example.com | +1 (415) 555-0142 | linkedin.com/in/alexchen

PROFESSIONAL SUMMARY
Full stack software engineer with 5 years of production experience building distributed web
applications using React, TypeScript, Node.js, Express and PostgreSQL.

CORE COMPETENCIES
React, TypeScript, Node.js, Express, JavaScript, PostgreSQL, Docker, Redis, REST APIs,
Git, Unit Testing (Jest), Agile/Scrum.

EXPERIENCE
Senior Software Engineer | FinTech Systems (2022 - Present)
- Architected and deployed microservices handling 15,000 requests per minute using Node.js, TypeScript and Redis.
- Built responsive customer portals using React and Tailwind CSS.
- Optimized PostgreSQL queries, decreasing average query response time by 42%.

Software Engineer | CloudScale Apps (2019 - 2022)
- Developed RESTful APIs in Node.js and Express connected to PostgreSQL.
- Implemented Docker containerization for engineering team development environments.

EDUCATION
B.S. Computer Science, State University, 2019
`;

const FULLSTACK_JD = `Job Title: Senior Full Stack Engineer
About the Role:
We are looking for a Senior Full Stack Engineer to lead architecture across our distributed
microservices and frontend client applications.

Key Responsibilities:
- Build high-scale web apps using React, Next.js, TypeScript and Node.js.
- Architect and optimize REST and GraphQL microservices backed by PostgreSQL and Redis.
- Deploy and monitor distributed cloud infrastructure on AWS.
- Drive CI/CD automation pipelines, automated end-to-end testing and strict TypeScript typings.

Requirements:
- 4+ years of production experience in React, TypeScript and Node.js.
- Solid understanding of relational database indexing and caching.
- Hands-on experience with Docker, CI/CD pipelines and cloud primitives.
- Strong communication and cross-functional leadership skills.`;

/** A JD that mentions none of the recognised taxonomy and repeats no term twice. */
const UNUSABLE_JD = `We want someone wonderful. Kindness matters. Please be kind.
Great vibes only. Nice people apply. Good people only.`;

// ---------------------------------------------------------------------------
// 1. Empty and unusable inputs
// ---------------------------------------------------------------------------
section('empty and unusable inputs');

{
  const emptyResume = atsEngine.analyzeMatch(FULLSTACK_JD, '');
  check('empty resume is not scorable', emptyResume.inputQuality.scorable === false);
  check('empty resume reason is empty_resume', emptyResume.inputQuality.reason === 'empty_resume');
  check('empty resume scores 0', emptyResume.matchScore === 0);
  check('empty resume has no matched keywords', emptyResume.matchedCount === 0);
  check('empty resume has no star suggestions', emptyResume.starSuggestions.length === 0);
  check(
    'empty resume explains itself',
    /no resume text/i.test(emptyResume.inputQuality.explanation),
    emptyResume.inputQuality.explanation
  );

  const whitespaceResume = atsEngine.analyzeMatch(FULLSTACK_JD, '   \n\t  ');
  check('whitespace-only resume is not scorable', whitespaceResume.inputQuality.scorable === false);

  const emptyJd = atsEngine.analyzeMatch('', SW_ENGINEER_RESUME);
  check('empty JD is not scorable', emptyJd.inputQuality.scorable === false);
  check('empty JD reason is empty_job_description', emptyJd.inputQuality.reason === 'empty_job_description');

  const unusable = atsEngine.analyzeMatch(UNUSABLE_JD, SW_ENGINEER_RESUME);
  check('signal-free JD is not scorable', unusable.inputQuality.scorable === false);
  check('signal-free JD reason is no_keyword_signal', unusable.inputQuality.reason === 'no_keyword_signal');
  check('signal-free JD does not invent a score', unusable.matchScore === 0);
  check('signal-free JD reports no required keywords', unusable.requiredCount === 0);

  const emptyBoth = atsEngine.analyzeMatch('', '');
  check('both empty is not scorable', emptyBoth.inputQuality.scorable === false);
  check('both empty scores 0', emptyBoth.matchScore === 0);
}

// ---------------------------------------------------------------------------
// 2. Missing keywords and the score/coverage contradiction
// ---------------------------------------------------------------------------
section('missing keywords');

{
  const full = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);

  check('scan is scorable', full.inputQuality.scorable === true);
  check('required keywords were identified', full.requiredCount > 0, `required=${full.requiredCount}`);
  check(
    'matched + missing always equals required',
    full.matchedCount + full.missingCount === full.requiredCount,
    `${full.matchedCount}+${full.missingCount} != ${full.requiredCount}`
  );
  check(
    'every missing keyword is genuinely absent from the resume',
    full.keywordsMissing.every((term) => !new RegExp(`\\b${escape(term)}\\b`, 'i').test(SW_ENGINEER_RESUME)),
    full.keywordsMissing.filter((term) => new RegExp(`\\b${escape(term)}\\b`, 'i').test(SW_ENGINEER_RESUME)).join(', ')
  );
  check(
    'every matched keyword really appears in the resume',
    full.keywordsMatched.every((term) => new RegExp(`\\b${escape(term)}\\b`, 'i').test(SW_ENGINEER_RESUME)),
    full.keywordsMatched.join(', ')
  );
  check(
    'coverage ratio equals matched/required',
    Math.abs(full.keywordCoverageRatio - full.matchedCount / full.requiredCount) < 0.001
  );
  check(
    'coverage percent matches the ratio within display rounding',
    Math.abs(full.keywordCoveragePercent / 100 - full.keywordCoverageRatio) <= 0.005,
    `percent=${full.keywordCoveragePercent} ratio=${full.keywordCoverageRatio}`
  );

  /*
   * The reported regression: the dashboard showed "86% match" while the keyword
   * counters said 2 of 7 (29%). The invariant is that coverage and the blended
   * score are distinct numbers, and coverage is always derivable from the
   * counts. A blended score above 70 with coverage below 40 must be explained by
   * a high semantic component — never by a hidden or inflated coverage figure.
   */
  const blended = full.scoreBreakdown.overall;
  const expectedFromParts = Math.round(
    (full.keywordCoverageRatio * 55 + (full.semanticMatchScore / 100) * 45)
  );
  check(
    'blended score is reproducible from its two components',
    Math.abs(blended - expectedFromParts) <= 1,
    `blended=${blended} parts=${expectedFromParts}`
  );
  check(
    'keyword coverage is capped by its own denominator',
    full.keywordCoveragePercent <= 100 && full.keywordCoveragePercent >= 0
  );
  check(
    'skillsMatched is a subset of keywordsMatched',
    full.skillsMatched.every((term) => full.keywordsMatched.includes(term))
  );
  check(
    'skillsMissing is a subset of keywordsMissing',
    full.skillsMissing.every((term) => full.keywordsMissing.includes(term))
  );
  check(
    'display lists never exceed the full sets',
    full.missingKeywords.length <= full.missingCount && full.presentKeywords.length <= full.matchedCount
  );

  // A resume sharing nothing with the posting must not score well.
  const unrelated = atsEngine.analyzeMatch(FULLSTACK_JD, 'Pastry chef. 10 years in bread, laminated dough and bakery ovens.');
  check('unrelated resume scores low', unrelated.matchScore < 25, `score=${unrelated.matchScore}`);
  check('unrelated resume has near-zero coverage', unrelated.keywordCoveragePercent < 25, `coverage=${unrelated.keywordCoveragePercent}%`);
  check('unrelated resume reports its gaps', unrelated.missingCount > 0);

  // A perfect resume scores 100 coverage without inventing anything.
  const perfect = atsEngine.analyzeMatch(
    'React TypeScript Node.js Docker Kubernetes AWS Terraform GraphQL Redis PostgreSQL Kafka playwright',
    'React TypeScript Node.js Docker Kubernetes AWS Terraform GraphQL Redis PostgreSQL Kafka playwright'
  );
  check('identical texts reach 100% coverage', perfect.keywordCoveragePercent === 100, `coverage=${perfect.keywordCoveragePercent}`);
  check('identical texts have no gaps', perfect.missingCount === 0);
  check('identical texts score 100', perfect.matchScore === 100, `score=${perfect.matchScore}`);
}

// ---------------------------------------------------------------------------
// 3. Determinism and stability
// ---------------------------------------------------------------------------
section('determinism');

{
  const a = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);
  const b = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);
  check('repeated analysis is identical', JSON.stringify(a) === JSON.stringify(b));

  const scored = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);
  check(
    'summary never overstates coverage',
    !scored.summary.includes('86%') || scored.matchScore === 86,
    scored.summary
  );
  check('strengths never exceed the matched count', scored.strengths.length <= scored.matchedCount + 2);
  check(
    'star suggestions only reference genuinely missing keywords',
    scored.starSuggestions.every((item) => scored.keywordsMissing.includes(item.keyword))
  );
  check(
    'star suggestions instruct the candidate rather than inventing for them',
    scored.starSuggestions.every((item) => /your own experience|add a bullet/i.test(item.suggestion))
  );
}

// ---------------------------------------------------------------------------
// 4. Document checks
// ---------------------------------------------------------------------------
section('document checks');

{
  const report = runDocumentChecks(SW_ENGINEER_RESUME, { sourceName: 'alex-chen.pdf' });
  const byId = Object.fromEntries(report.checks.map((check_) => [check_.id, check_]));

  check('text extraction is measured and passes', byId.text_extraction.measured && byId.text_extraction.status === 'pass');
  check('section headings are measured and found', byId.heading_structure.measured && byId.heading_structure.status !== 'fail');
  check('contact info is measured and found', byId.contact_info.measured && byId.contact_info.status === 'pass');
  check(
    'column layout is explicitly not tested for an uploaded file',
    byId.single_column_layout.status === 'not_tested' && byId.single_column_layout.measured === false
  );
  check(
    'third-party ATS parser result is explicitly not tested',
    byId.ats_parser_pass.status === 'not_tested' && byId.ats_parser_pass.measured === false
  );
  check('every check carries human-readable detail', report.checks.every((c) => c.detail.length > 20));
  check(
    'an unmeasured check is never given a pass/warn/fail verdict',
    report.checks.every((c) => c.measured || c.status === 'not_tested')
  );
  check(
    'an estimated result is always surfaced as a warning',
    report.checks.every((c) => !c.estimated || c.status === 'warn')
  );

  const generated = runDocumentChecks(SW_ENGINEER_RESUME, { generated: true });
  const generatedById = Object.fromEntries(generated.checks.map((c) => [c.id, c]));
  check(
    'generated export asserts a real single-column layout',
    generatedById.single_column_layout.status === 'pass' && generatedById.single_column_layout.measured === true
  );

  const empty = runDocumentChecks('', {});
  const emptyById = Object.fromEntries(empty.checks.map((c) => [c.id, c]));
  check('empty document fails text extraction', emptyById.text_extraction.status === 'fail');
  check('empty document fails headings', emptyById.heading_structure.status === 'fail');
  check('empty document reports zero words', empty.wordCount === 0);

  // A resume with no headings and no contact details must be flagged, not scored.
  const proseOnly = runDocumentChecks('word '.repeat(60), {});
  const proseById = Object.fromEntries(proseOnly.checks.map((c) => [c.id, c]));
  check('prose with no headings fails the heading check', proseById.heading_structure.status === 'fail');
  check('prose with no contact details fails contact info', proseById.contact_info.status === 'fail');
}

// ---------------------------------------------------------------------------
// 5. Hallucination prevention
// ---------------------------------------------------------------------------
section('grounding');

{
  const invented = 'Reduced p99 latency by 38% and increased conversion by 12%. AWS Certified Solutions Architect.';
  const report = validateAgainstSource(invented, SW_ENGINEER_RESUME);

  check('unverifiable output is not marked grounded', report.grounded === false);
  check(
    'the invented 38% is flagged',
    report.findings.some((f) => f.kind === 'fabricated_metric' && f.excerpt.includes('38%')),
    JSON.stringify(report.findings)
  );
  check(
    'the invented certification is flagged',
    report.findings.some((f) => f.kind === 'unsupported_credential')
  );

  const redacted = redactUnsupportedMetrics(invented, SW_ENGINEER_RESUME);
  check('the invented 38% is replaced by a placeholder', redacted.text.includes('[add metric]') && !redacted.text.includes('38%'));
  check('the real 12% is also replaced because it is not in the source', !redacted.text.includes('12%'));

  // Numbers that ARE in the source must survive untouched.
  const supported = 'Cut query response time by 42% across the PostgreSQL fleet.';
  const kept = redactUnsupportedMetrics(supported, SW_ENGINEER_RESUME);
  check('a metric from the source resume is preserved', kept.text.includes('42%'), kept.text);
  check('no redaction is reported for a supported metric', kept.redactions.length === 0);

  const clean = validateAgainstSource(
    'Optimized PostgreSQL queries, decreasing average query response time by 42%.',
    SW_ENGINEER_RESUME
  );
  check('fully grounded output passes', clean.grounded === true, JSON.stringify(clean.findings));

  const noSource = validateAgainstSource('Anything at all.', '');
  check('no source resume means not grounded', noSource.grounded === false);
  check('no source resume is reported explicitly', noSource.findings[0].kind === 'source_unavailable');

  const enforced = enforceGrounding(invented, SW_ENGINEER_RESUME);
  check('enforceGrounding returns redacted text', !enforced.text.includes('38%'));
  check('enforceGrounding attaches a report', enforced.report.findings.length > 0);

  // Years are dates, not performance metrics.
  const withYear = redactUnsupportedMetrics('Worked at FinTech Systems from 2022 to 2026.', SW_ENGINEER_RESUME);
  check('a 4-digit year is not treated as a fabricated metric', !withYear.text.includes('[add metric]'), withYear.text);

  // A date can be present in the source in one part of a range and still be
  // contradicted by an invented second year. Years are checked separately from
  // metrics so an output cannot quietly change an employment timeline.
  const contradictoryTimeline = validateAgainstSource(
    'Senior Software Engineer | FinTech Systems (2022 - 2023).',
    SW_ENGINEER_RESUME
  );
  check(
    'a year absent from the source is flagged as a contradictory date',
    contradictoryTimeline.findings.some((f) => f.kind === 'unsupported_date' && f.excerpt === '2023'),
    JSON.stringify(contradictoryTimeline.findings)
  );
  const redactedDate = redactUnsupportedDates('Senior Software Engineer | FinTech Systems (2022 - 2023).', SW_ENGINEER_RESUME);
  check(
    'an unsupported date is replaced with a confirmation placeholder',
    redactedDate.text.includes('[confirm date]') && !redactedDate.text.includes('2023')
  );
  const enforcedTimeline = enforceGrounding(
    'Senior Software Engineer | FinTech Systems (2022 - 2023).',
    SW_ENGINEER_RESUME
  );
  check(
    'enforceGrounding prevents a contradictory year reaching the draft',
    enforcedTimeline.text.includes('[confirm date]') && enforcedTimeline.report.findings.some((f) => f.kind === 'unsupported_date')
  );

  // An employer that IS in the resume must not be flagged.
  const knownEmployer = validateAgainstSource(
    'At FinTech Systems I built customer portals.',
    SW_ENGINEER_RESUME
  );
  check(
    'a known employer is not flagged',
    !knownEmployer.findings.some((f) => f.kind === 'unsupported_employer')
  );

  const unknownEmployer = validateAgainstSource(
    'At Globex Industries I rebuilt the payments platform.',
    SW_ENGINEER_RESUME
  );
  check(
    'an unknown employer is flagged for review',
    unknownEmployer.findings.some((f) => f.kind === 'unsupported_employer'),
    JSON.stringify(unknownEmployer.findings)
  );

  // A posting requirement the resume never mentions must not be written into
  // the document as existing experience.
  const claimsMissingSkill = validateAgainstSource(
    'Built and deployed CI/CD pipelines on AWS with Kubernetes.',
    SW_ENGINEER_RESUME,
    FULLSTACK_JD
  );
  check(
    'a JD-required skill absent from the resume is flagged as unsupported',
    claimsMissingSkill.findings.some((f) => f.kind === 'unsupported_skill' && f.excerpt === 'ci/cd'),
    JSON.stringify(claimsMissingSkill.findings)
  );
  check('unsupported skills make the output not grounded', claimsMissingSkill.grounded === false);

  const enforcesMissingSkill = enforceGrounding(
    'Built and deployed CI/CD pipelines on AWS with Kubernetes.',
    SW_ENGINEER_RESUME,
    FULLSTACK_JD
  );
  check(
    'enforceGrounding reports the unsupported skill',
    enforcesMissingSkill.report.findings.some((f) => f.kind === 'unsupported_skill'),
    JSON.stringify(enforcesMissingSkill.report.findings)
  );

  // A skill the resume DOES contain must never be flagged, even with a JD.
  const hasSkill = validateAgainstSource(
    'Containerized services with Docker and queried PostgreSQL.',
    SW_ENGINEER_RESUME,
    FULLSTACK_JD
  );
  check(
    'skills present in the resume are not flagged',
    !hasSkill.findings.some((f) => f.kind === 'unsupported_skill'),
    JSON.stringify(hasSkill.findings)
  );

  // Without a job description the skill pass is simply not run.
  const noJd = validateAgainstSource('Built CI/CD pipelines.', SW_ENGINEER_RESUME);
  check(
    'no job description means no unsupported_skill findings',
    !noJd.findings.some((f) => f.kind === 'unsupported_skill')
  );

  // REGRESSION: a gap checklist names missing terms honestly. It must not be
  // read as the candidate claiming skills they do not have.
  const gapChecklist = validateAgainstSource(
    `Full stack engineer with React and PostgreSQL.\n\nGAPS — keywords this job description asks for that your resume does not evidence:\n  - aws\n  - kubernetes\n  - graphql\n\nThese are gaps, not achievements. Only claim them if you genuinely have that experience.`,
    SW_ENGINEER_RESUME,
    FULLSTACK_JD
  );
  check(
    'a gap checklist is not reported as claimed skills',
    !gapChecklist.findings.some((f) => f.kind === 'unsupported_skill'),
    JSON.stringify(gapChecklist.findings)
  );

  // REGRESSION: EMPLOYER_PATTERN uses the `i` flag, so its `[A-Z]` classes
  // match lowercase too. Ordinary prose after a preposition used to be reported
  // as an employer the candidate had invented.
  const prose = validateAgainstSource(
    'React, TypeScript and Node.js cover the keywords this posting asks for that your resume does not evidence yet.',
    SW_ENGINEER_RESUME
  );
  check(
    'lowercase prose after a preposition is not an employer',
    !prose.findings.some((f) => f.kind === 'unsupported_employer'),
    JSON.stringify(prose.findings)
  );

  // Capitalised multi-word names must STILL be caught, and mixed-case ordinary
  // phrases after a preposition must not be either.
  const mixedCase = validateAgainstSource(
    'I improved this with React and TypeScript across the stack.',
    SW_ENGINEER_RESUME
  );
  check(
    'an ordinary mixed-case phrase is not an employer',
    !mixedCase.findings.some((f) => f.kind === 'unsupported_employer'),
    JSON.stringify(mixedCase.findings)
  );
}

// ---------------------------------------------------------------------------
// 6. DOCX export integrity
// ---------------------------------------------------------------------------
section('docx integrity');

const tailoredText = `ALEX CHEN
alex.chen@example.com | linkedin.com/in/alexchen

PROFESSIONAL SUMMARY
Full stack software engineer with 5 years of production experience.

CORE COMPETENCIES
React, TypeScript, Node.js, Express, PostgreSQL, Docker, Redis.

PROFESSIONAL EXPERIENCE
Senior Software Engineer | FinTech Systems
- Architected and deployed microservices handling 15,000 requests per minute using Node.js, TypeScript and Redis.
- Optimized PostgreSQL queries, decreasing average query response time by 42%.

EDUCATION
B.S. Computer Science, State University, 2019`;

const docxResult = await generateResumeDocx({
  candidateName: 'Alex Chen',
  jobTitle: 'Senior Full Stack Engineer',
  tailoredText,
});

check('docx buffer is produced', Buffer.isBuffer(docxResult) && docxResult.length > 1000);
check('docx has the zip magic number', docxResult.subarray(0, 2).toString('binary') === 'PK');

const integrity = await verifyDocxIntegrity(docxResult, tailoredText);
check('docx integrity is verified', integrity.verified, integrity.detail);
check('docx round-trips at least 95% of content lines', integrity.contentCoverage >= 0.95, `${integrity.contentCoverage}`);
check('docx integrity lists no missing samples', integrity.missingSamples.length === 0, integrity.missingSamples.join(' | '));

const emptyDocx = await generateResumeDocx({ tailoredText: 'One line of content.' });
const emptyIntegrity = await verifyDocxIntegrity(emptyDocx, 'Something completely different that was never written.');
check('a content mismatch is detected', emptyIntegrity.verified === false);

const nameOmitted = await generateResumeDocx({ candidateName: null, tailoredText });
const nameIntegrity = await verifyDocxIntegrity(nameOmitted, tailoredText);
check('omitting the name still exports valid content', nameIntegrity.verified, nameIntegrity.detail);

// ---------------------------------------------------------------------------
// 6b. Recruiter-facing resume highlighting
// ---------------------------------------------------------------------------
section('resume highlighting');

{
  const analysis = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);
  const built = buildResumeHighlights({
    resumeText: SW_ENGINEER_RESUME,
    matchedKeywords: analysis.keywordsMatched,
    missingKeywords: analysis.missingKeywords,
  });

  check(
    'segments reconstruct the original text byte-for-byte',
    built.segments.map((s) => s.text).join('') === SW_ENGINEER_RESUME
  );
  check(
    'every highlight is a literal substring of the resume',
    built.highlights.every((h) => SW_ENGINEER_RESUME.slice(h.start, h.end) === h.text && h.text.length > 0),
    JSON.stringify(built.highlights.map((h) => h.text))
  );
  check('highlights are ordered and non-overlapping', (() => {
    let cursor = -1;
    for (const h of built.highlights) {
      if (h.start < cursor) return false;
      cursor = h.end;
    }
    return true;
  })());
  check('the default cap is respected', built.highlights.length <= DEFAULT_MAX_HIGHLIGHTS, `${built.highlights.length}`);
  check('highlights carry a label and a reason', built.highlights.every((h) => h.label.length > 0 && h.reason.length > 0));
  check(
    'keyword highlights name the requirement they answer',
    built.highlights.filter((h) => h.category === 'keyword').every((h) => Boolean(h.jdRequirement)),
    JSON.stringify(built.highlights.filter((h) => h.category === 'keyword'))
  );
  check('every highlight is marked as explicit in the source', built.highlights.every((h) => h.evidence === 'explicit_in_source'));

  // THE INVARIANT: a gap can only be highlighted if its characters exist in
  // the resume, which by definition of "missing" they do not.
  const missing = analysis.missingKeywords;
  check('the fixture actually has missing keywords', missing.length > 0, JSON.stringify(missing));
  check(
    'a missing keyword is never highlighted',
    missing.every((term) => !built.highlights.some((h) => h.text.toLowerCase().includes(term.toLowerCase()))),
    JSON.stringify(built.highlights.map((h) => h.text))
  );
  check(
    'missing keywords cannot be smuggled in through the option',
    buildResumeHighlights({
      resumeText: SW_ENGINEER_RESUME,
      matchedKeywords: analysis.keywordsMatched,
      missingKeywords: ['kubernetes', 'graphql', 'next.js'],
    }).highlights.every((h) => !['kubernetes', 'graphql', 'next.js'].some((m) => h.text.toLowerCase().includes(m)))
  );

  check(
    'a quantified line is offered as an achievement',
    built.highlights.some((h) => h.category === 'achievement' && h.text.includes('42%')),
    JSON.stringify(built.highlights.map((h) => h.category))
  );
  check(
    'a leadership line is offered as a responsibility',
    built.highlights.some((h) => h.category === 'responsibility'),
    JSON.stringify(built.highlights.map((h) => `${h.category}:${h.text}`))
  );

  // Certifications come from the same pattern the grounding validator flags, so
  // a phrase must be either acceptable evidence or a fabrication — never both.
  const withCert = buildResumeHighlights({
    resumeText: `${SW_ENGINEER_RESUME}CERTIFICATIONS\nAWS Certified Solutions Architect\n`,
    matchedKeywords: analysis.keywordsMatched,
    missingKeywords: analysis.missingKeywords,
  });
  check(
    'a certification in the resume is highlighted as such',
    withCert.highlights.some((h) => h.category === 'certification' && h.text.toLowerCase().includes('aws certified')),
    JSON.stringify(withCert.highlights.map((h) => `${h.category}:${h.text}`))
  );

  // Selectivity: never silently hide drops.
  const capped = buildResumeHighlights({
    resumeText: SW_ENGINEER_RESUME,
    matchedKeywords: analysis.keywordsMatched,
    missingKeywords: analysis.missingKeywords,
    maxHighlights: 3,
  });
  check('an explicit cap is honoured', capped.highlights.length <= 3, `${capped.highlights.length}`);
  check(
    'dropped matches are counted rather than vanished',
    capped.hiddenBySelectivity >= 0 && capped.highlights.length + capped.hiddenBySelectivity >= capped.highlights.length
  );
  check('the capped pass still preserves the text', capped.segments.map((s) => s.text).join('') === SW_ENGINEER_RESUME);

  // Edges.
  const emptyBuilt = buildResumeHighlights({ resumeText: '' });
  check('an empty resume yields no highlights and no throw', emptyBuilt.highlights.length === 0 && emptyBuilt.segments.length === 0);
  const noTerms = buildResumeHighlights({ resumeText: 'Some plain sentence with no match at all.', matchedKeywords: [] });
  check('no matched keywords yields an untouched read', noTerms.highlights.length === 0);
  check('the JD requirement is null when there is nothing to point at', noTerms.highlights.every((h) => h.jdRequirement === null));
}

// ---------------------------------------------------------------------------
// 6c. Highlighted DOCX export must not change a single character
// ---------------------------------------------------------------------------
section('highlighted docx export');

{
  const spans = buildResumeHighlights({ resumeText: tailoredText })
    .highlights.map((h) => ({ start: h.start, end: h.end }));
  const highlightedDocx = await generateResumeDocx({
    candidateName: 'Alex Chen',
    jobTitle: 'Senior Full Stack Engineer',
    tailoredText,
    highlights: spans,
  });
  const highlightedIntegrity = await verifyDocxIntegrity(highlightedDocx, tailoredText);
  check('a highlighted export still round-trips its content', highlightedIntegrity.verified, highlightedIntegrity.detail);
  check('a highlighted export covers the same lines', highlightedIntegrity.contentCoverage >= 0.95, `${highlightedIntegrity.contentCoverage}`);

  const cleanDocx = await generateResumeDocx({ candidateName: 'Alex Chen', jobTitle: 'Senior Full Stack Engineer', tailoredText });
  check('shading actually changes the file', !highlightedDocx.equals(cleanDocx));

  const outOfRange = await generateResumeDocx({ tailoredText, highlights: [{ start: -50, end: 999999 }] });
  const outOfRangeIntegrity = await verifyDocxIntegrity(outOfRange, tailoredText);
  check('out-of-range spans cannot corrupt the export', outOfRangeIntegrity.verified, outOfRangeIntegrity.detail);
}

// ---------------------------------------------------------------------------
// 6d. Score clarity — the explanation must match the engine, not marketing
// ---------------------------------------------------------------------------
section('score clarity');

{
  const analysis = atsEngine.analyzeMatch(FULLSTACK_JD, SW_ENGINEER_RESUME);
  const explanation = buildScoreExplanation({
    scoreBreakdown: analysis.scoreBreakdown,
    matchedCount: analysis.matchedCount,
    requiredCount: analysis.requiredCount,
    missingCount: analysis.missingCount,
    inputQuality: analysis.inputQuality,
  });

  check('the formula quotes the real weights', explanation.formula === `overall = ${COVERAGE_WEIGHT}% × keyword coverage + ${SEMANTIC_WEIGHT}% × semantic proximity`, explanation.formula);
  check('the weights still add to 100', COVERAGE_WEIGHT + SEMANTIC_WEIGHT === 100);
  check('the explanation recomputes the engine total', explanation.recomputed === analysis.scoreBreakdown.overall, `${explanation.recomputed} vs ${analysis.scoreBreakdown.overall}`);
  check('three components are explained', explanation.rows.length === 3, `${explanation.rows.length}`);
  check('component values stay inside 0-100', explanation.rows.every((row) => row.value >= 0 && row.value <= 100));
  check('every row defines itself and how it moves', explanation.rows.every((row) => row.definition.length > 20 && row.movesIt.length > 20));
  check('the coverage row states the real denominator', explanation.rows[0].definition.includes(`${analysis.requiredCount}`), explanation.rows[0].definition);
  check('what the score cannot measure is disclosed', explanation.notMeasured.length >= 3);
  check('a scorable analysis has no unscoreable reason', explanation.scorable && explanation.unscoreableReason === null);
  check('advice forbids unearned keywords', explanation.advice.join(' ').includes('never'), explanation.advice.join(' | '));

  // Edge case: an empty resume must refuse to score rather than show 0 as fact.
  const unscorable = atsEngine.analyzeMatch(FULLSTACK_JD, '');
  const unscorableExplanation = buildScoreExplanation({
    scoreBreakdown: unscorable.scoreBreakdown,
    matchedCount: unscorable.matchedCount,
    requiredCount: unscorable.requiredCount,
    inputQuality: unscorable.inputQuality,
  });
  check('an unscorable input is reported as unscorable', unscorableExplanation.scorable === false);
  check('the engine sentence explains why', Boolean(unscorableExplanation.unscoreableReason && unscorableExplanation.unscoreableReason.length > 10), unscorableExplanation.unscoreableReason ?? '');
  check('no advice is invented when nothing was scored', unscorableExplanation.advice.length === 0, JSON.stringify(unscorableExplanation.advice));

  // Edge case: a posting with no recognised keywords after noise filtering.
  const noiseOnly = atsEngine.analyzeMatch(UNUSABLE_JD, SW_ENGINEER_RESUME);
  check('a signal-free posting is not scorable', noiseOnly.inputQuality.scorable === false && noiseOnly.inputQuality.reason === 'no_keyword_signal');
  const zeroRequired = buildScoreExplanation({
    scoreBreakdown: { keywordCoverage: 0, semanticProximity: 0, overall: 0 },
    matchedCount: 0,
    requiredCount: 0,
    inputQuality: noiseOnly.inputQuality,
  });
  check('a zero denominator is explained, not shown as 0% coverage', zeroRequired.rows[0].definition.includes('nothing to count'), zeroRequired.rows[0].definition);

  // Edge case: components that disagree with the stored total must surface as a
  // mismatch (the test above asserts equality for real data).
  const tampered = buildScoreExplanation({
    scoreBreakdown: { keywordCoverage: 100, semanticProximity: 100, overall: 40 },
    matchedCount: 10,
    requiredCount: 10,
  });
  check('a tampered total is detectable by recomputation', tampered.recomputed === 100 && tampered.rows[2].value === 40, `${tampered.recomputed}`);
}

// ---------------------------------------------------------------------------
// 7. Free / Pro limits and throttling
// ---------------------------------------------------------------------------
section('free and pro limits');

{
  check('free tier allowance is the documented 3 scans', FREE_SCAN_LIMIT === 3);
  check('pro price is unchanged', PRO_PRICE_INR === 249, `${PRO_PRICE_INR}`);
  check('pro sentinel is documented as effectively unlimited', PRO_UNLIMITED_CREDITS === 9999);
  check('a fresh free user has the full allowance', remainingScansFor('free', 0) === FREE_SCAN_LIMIT);
  check('a free user who used everything gets zero', remainingScansFor('free', FREE_SCAN_LIMIT) === 0);
  check('free credits never go negative', remainingScansFor('free', 99) === 0);
  check('pro is reported as the unlimited sentinel', remainingScansFor('pro', 500) === PRO_UNLIMITED_CREDITS);

  // A fresh IP is allowed; repeated traffic is throttled with a retry hint and
  // is never reported as a paywall event (the client opens the upgrade modal on
  // 402, so conflating the two would sell upgrades to users who polled fast).
  resetIpBurstLimits();
  const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  check('a fresh ip is allowed', checkIpBurstLimit(ip).allowed === true);

  let throttled = false;
  let retryHint = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = checkIpBurstLimit(ip);
    if (!result.allowed) {
      throttled = true;
      retryHint = result.retryAfterSeconds ?? 0;
      check('throttling never claims a paywall is required', !('paywallRequired' in result));
      break;
    }
  }
  check('repeated requests from one ip are eventually throttled', throttled);
  check('a throttled response carries a retry hint', retryHint > 0, `${retryHint}`);
  check('a different ip is unaffected', checkIpBurstLimit('198.51.100.7').allowed === true);
}

// ---------------------------------------------------------------------------
// 8. Code viewer tokenisation
// ---------------------------------------------------------------------------
section('code viewer');

{
  // Regression: highlight.js escapes text, and tokens are rendered as React
  // children rather than injected HTML, so the entities must be decoded or every
  // JSON quote would be displayed to the user as the literal text `&quot;`.
  check('decodeEntities decodes a quote', decodeEntities('&quot;a&quot;') === '"a"');
  check('decodeEntities decodes an ampersand', decodeEntities('x &amp; y') === 'x & y');
  check('decodeEntities decodes angle brackets', decodeEntities('&lt;script&gt;') === '<script>');
  check('decodeEntities leaves unknown entities alone', decodeEntities('&bogus;') === '&bogus;');

  const tokens = tokenizeHighlightedHtml(
    '<span class="hljs-attr">&quot;a&quot;</span><span class="hljs-string">&quot;x &amp; y&quot;</span>'
  );
  check('tokens carry the highlighter class', tokens[0].cls === 'hljs-attr');
  check('tokens decode escaped quotes', tokens[0].text === '"a"');
  check('tokens decode escaped ampersands', tokens[1].text === '"x & y"');

  const roundTrip = tokenText(tokens);
  check('tokenizing round-trips to the original text', roundTrip === '"a""x & y"', roundTrip);
  check('no HTML entity survives tokenization', !roundTrip.includes('&quot;') && !roundTrip.includes('&amp;'));

  // Only allow-listed spans survive; everything else is inert text.
  const hostile = tokenizeHighlightedHtml(
    'before<img src=x onerror="alert(1)"><span class="hljs-string">safe</span><script>alert(2)</script>after'
  );
  const hostileText = tokenText(hostile);
  check('an injected img tag does not become a token class', hostile.every((t) => t.cls === null || t.cls.startsWith('hljs-')));
  check('allow-listed hljs classes still apply', hostile.some((t) => t.cls === 'hljs-string'));
  // Non-allow-listed tags are dropped entirely, which is the stricter and
  // safer outcome: a compromised or malformed highlighter response cannot
  // contribute markup or text at all.
  check('injected tags are dropped, not rendered', !hostileText.includes('<') && !hostileText.includes('>'), hostileText);
  check('surrounding legitimate text is preserved', hostileText.startsWith('before') && hostileText.endsWith('after'), hostileText);
  check('the allow-listed token text survives intact', hostileText.includes('safe'), hostileText);

  const plain = tokenizeHighlightedHtml('just text, no tags');
  check('plain text yields a single unstyled token', plain.length === 1 && plain[0].cls === null);

  const unbalanced = tokenizeHighlightedHtml('<span class="hljs-string">unclosed');
  check('an unterminated tag does not throw', Array.isArray(unbalanced) && unbalanced.length > 0);
  check('an unterminated tag still yields the text', tokenText(unbalanced).includes('unclosed'));
}

// ---------------------------------------------------------------------------
// 9. Payment routing and anti-tamper
// ---------------------------------------------------------------------------
section('payment routing');

{
  const USER_ID = 'user_real_candidate';

  // --- handle resolution --------------------------------------------------
  const originalTelegram = process.env.OWNER_TELEGRAM;
  delete process.env.OWNER_TELEGRAM;
  check('a missing handle falls back to the built-in default', ownerTelegramHandle() === 'TheCreatorOfAkatsuki');

  process.env.OWNER_TELEGRAM = '@SomeOwner';
  check('a leading @ is stripped', ownerTelegramHandle() === 'SomeOwner');

  process.env.OWNER_TELEGRAM = 'not a valid handle!';
  check('a malformed handle is rejected rather than linked', ownerTelegramHandle() === 'TheCreatorOfAkatsuki');

  process.env.OWNER_TELEGRAM = 'ab'; // too short
  check('a too-short handle is rejected', ownerTelegramHandle() === 'TheCreatorOfAkatsuki');

  process.env.OWNER_TELEGRAM = '1startsWithDigit';
  check('a handle starting with a digit is rejected', ownerTelegramHandle() === 'TheCreatorOfAkatsuki');

  if (originalTelegram === undefined) delete process.env.OWNER_TELEGRAM;
  else process.env.OWNER_TELEGRAM = originalTelegram;

  // --- avatar URL sanitisation -------------------------------------------
  check('a blank avatar resolves to null', sanitizeAvatarUrl('') === null);
  check('undefined avatar resolves to null', sanitizeAvatarUrl(undefined) === null);
  check('a root-relative path is allowed', sanitizeAvatarUrl('/img/owner.jpg') === '/img/owner.jpg');
  check('a protocol-relative URL is rejected', sanitizeAvatarUrl('//evil.com/x.png') === null);
  check('a javascript: URL is rejected', sanitizeAvatarUrl('javascript:alert(1)') === null);
  check('a data: URL is rejected', sanitizeAvatarUrl('data:image/svg+xml,<svg onload=alert(1)>') === null);
  check('an http URL is rejected in favour of https', sanitizeAvatarUrl('http://evil.com/x.png') === null);
  check('an https URL is allowed', sanitizeAvatarUrl('https://cdn.example.com/o.png') === 'https://cdn.example.com/o.png');

  // --- reference signing --------------------------------------------------
  const reference = issuePaymentReference(USER_ID);
  check('a reference has the documented shape', /^RSA-[A-Z2-7]{16}-[A-F0-9]{10}$/.test(reference), reference);

  /*
   * Regression: an earlier design emitted a bare opaque MAC, which could never be
   * recomputed — so every honest reference failed its own check and the failure
   * was indistinguishable from forgery. A base32 timestamp payload travels with
   * the MAC, making `sign(payload) === mac` a real authenticity test.
   */
  const verification = verifyPaymentReference(reference);
  check('a freshly minted reference verifies', verification.valid === true, JSON.stringify(verification));
  check(
    'the reference round-trips its issue timestamp',
    Math.abs((verification.issuedAt ?? 0) - Math.floor(Date.now() / 1000)) <= 2,
    String(verification.issuedAt)
  );
  check('a reference verifies regardless of case', verifyPaymentReference(reference.toLowerCase()).valid === true);
  check('surrounding whitespace is tolerated', verifyPaymentReference(`  ${reference}  `).valid === true);

  // The security property: nobody without SESSION_SECRET can mint one.
  check('a fabricated reference is rejected', verifyPaymentReference('RSA-AAAAAAAA-AAAAAAAAAA').valid === false);
  check('a truncated reference is rejected', verifyPaymentReference('RSA-ABC').valid === false);
  check('an empty reference is rejected', verifyPaymentReference('').valid === false);
  check('free text is rejected', verifyPaymentReference('i paid the admin').valid === false);
  check('a reference with no prefix is rejected', verifyPaymentReference(`${reference.slice(4)}`).valid === false);

  // Changing any single character of a real reference must fail.
  const flippedMac = reference.slice(0, -1) + (reference.endsWith('A') ? 'B' : 'A');
  check('a tampered MAC is rejected', verifyPaymentReference(flippedMac).valid === false, flippedMac);

  const flippedPayload = `RSA-${'A'.repeat(8)}-${reference.slice(-10)}`;
  check('a tampered payload is rejected', verifyPaymentReference(flippedPayload).valid === false);

  // A reference issued by a *different* secret must not verify here.
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'a-completely-different-secret-value';
  check('a reference from another secret is rejected', verifyPaymentReference(reference).valid === false);
  process.env.SESSION_SECRET = previousSecret;
  check('it verifies again once the secret is restored', verifyPaymentReference(reference).valid === true);

  // Expiry, measured on the decoded timestamp rather than a guess.
  const now = Date.now();
  const oldRef = issuePaymentReference(USER_ID, now - 31 * 86400_000);
  const oldIssued = verifyPaymentReference(oldRef).issuedAt ?? 0;
  check('a 31-day-old reference is expired', isReferenceExpired(oldIssued, now) === true);
  check(
    'a 29-day-old reference is not expired',
    isReferenceExpired(verifyPaymentReference(issuePaymentReference(USER_ID, now - 29 * 86400_000)).issuedAt ?? 0, now) === false
  );

  // --- message construction ----------------------------------------------
  const message = buildPaymentMessage(
    { userId: USER_ID, email: 'real@example.com', displayName: 'Real Candidate', priceInr: 249 },
    reference
  );
  check('the message carries the real email', message.includes('real@example.com'));
  check('the message carries the signed reference', message.includes(reference));
  check('the message states the price', message.includes('249'));

  /*
   * Injection: a display name or email containing newlines must not be able to
   * append fabricated lines to what the admin reads. A crafted name like
   * "Bob\nPayment already received: yes" must arrive as one inert line.
   */
  const injected = buildPaymentMessage(
    {
      userId: USER_ID,
      email: 'victim@corp.com',
      displayName: 'Bob\nPayment already received: yes',
      priceInr: 249,
    },
    reference
  );
  const injectedLines = injected.split('\n');
  const nameLine = injectedLines.find((line) => line.startsWith('Name:')) ?? '';
  check(
    'an injected newline cannot forge a standalone field',
    !injectedLines.some((line) => line.trim() === 'Payment already received: yes'),
    injected
  );
  check('the injected name is collapsed onto a single line', nameLine === 'Name: Bob Payment already received: yes', nameLine);

  const angle = buildPaymentMessage(
    { userId: USER_ID, email: '<script>alert(1)</script>@x.com', displayName: null, priceInr: 249 },
    reference
  );
  check('angle brackets are stripped from the email field', !angle.includes('<script>'), angle);
  check('no raw HTML survives into the message', !/[<>]/.test(angle.split('Registered email:')[1]?.split('\n')[0] ?? ''));

  // --- deep link ----------------------------------------------------------
  const url = buildTelegramUrl(message);
  check('the deep link targets the owner handle', url.startsWith('https://t.me/'), url.slice(0, 40));
  check('the deep link carries a text parameter', url.includes('?text='));

  // Exactly one layer of encoding: a decoded message must contain real newlines.
  const decoded = decodeURIComponent(new URL(url).searchParams.get('text') ?? '');
  check('newlines survive a single decode', decoded.split('\n').length > 5, String(decoded.split('\n').length));
  check('the decoded message is not double-encoded', !decoded.includes('%0A'), decoded.slice(0, 120));

  const custom = buildTelegramUrl(message, 'SomeoneElse');
  check('the destination handle is a parameter, not hard-coded', custom.startsWith('https://t.me/SomeoneElse'));
}

// ---------------------------------------------------------------------------
// 10. Migration correctness
// ---------------------------------------------------------------------------
section('migrations');

{
  const migrationPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'supabase',
    'migrations',
    '202610030001_application_status_saved.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');

  check('the migration adds SAVED to the enum', /alter\s+type\s+public\.application_status\s+add\s+value(\s+if\s+not\s+exists)?\s+'SAVED'/i.test(sql));
  check('the migration is idempotent', /add\s+value\s+if\s+not\s+exists/i.test(sql));

  // Assertions run against executable SQL only. The file also *documents* these
  // pitfalls in prose, and matching the prose would prove nothing.
  const executable = sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  check(
    'the migration adds SAVED to the enum (executable statement)',
    /alter\s+type\s+public\.application_status\s+add\s+value(\s+if\s+not\s+exists)?\s+'SAVED'/i.test(executable)
  );

  /*
   * The previous version wrapped ALTER TYPE in BEGIN/COMMIT and caught every
   * error with `when others then null`. That combination is why the enum was
   * still missing: the statement could fail and the migration would still look
   * like it had succeeded. Both are regressions worth locking out.
   */
  check('the migration does not wrap ALTER TYPE in a transaction', !/^\s*begin\s*;/im.test(executable));
  check('the migration does not wrap it in a commit', !/^\s*commit\s*;/im.test(executable));
  check('the migration swallows no errors', !/exception\s+when/i.test(executable), executable);
  check('the migration does not catch all errors', !/when\s+others/i.test(executable));

  /*
   * Allowed statements: the additive ALTER TYPE itself, plus the conventional
   * `notify pgrst, 'reload schema'` that makes the new enum value visible to
   * PostgREST without a restart. Every other executable statement is a
   * regression — this file must never grow a DROP, UPDATE, or a second
   * mutation of the enum.
   */
  const statements = executable
    .split(';')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  const isAllowedStatement = (stmt: string) =>
    /^alter\s+type\s+public\.application_status\s+add\s+value(\s+if\s+not\s+exists)?\s+'SAVED'$/i.test(
      stmt
    ) || /^notify\s+pgrst,\s*'reload schema'$/i.test(stmt);
  check(
    'the migration contains only the additive ALTER TYPE and the pgrst reload',
    statements.length > 0 && statements.every(isAllowedStatement),
    executable
  );
  check(
    'the migration still contains its one additive statement',
    statements.some((stmt) => /^alter\s+type/i.test(stmt)),
    executable
  );
}

// ---------------------------------------------------------------------------
// 11. Content Security Policy
// ---------------------------------------------------------------------------
section('content security policy');

{
  /*
   * Regression that motivated this module: the policy originally allowed only
   * `https://clerk.com`, but Clerk serves clerk-js from the instance's own
   * Frontend API host. That blocks the Clerk bundle outright — every sign-in
   * fails in production while local tests pass, because the dev server's CSP is
   * not exercised the same way. The origin is therefore derived from the
   * publishable key.
   */
  // Built rather than pasted: a hand-typed base64 fixture silently decodes to
  // garbage and would make this block pass or fail for the wrong reason.
  const clerkHost = 'coherent-gecko-6012.clerk.accounts.dev$';
  const realKey = `pk_test_${Buffer.from(clerkHost).toString('base64url').replace(/=+$/, '')}`;
  const origin = clerkFrontendOrigin(realKey);
  check('a publishable key yields its Clerk origin', origin === 'https://coherent-gecko-6012.clerk.accounts.dev', String(origin));

  const prod = buildContentSecurityPolicy({ isDev: false, clerkPublishableKey: realKey });
  check('production policy allows the Clerk instance origin', prod.includes('https://coherent-gecko-6012.clerk.accounts.dev'), prod);
  check(
    'the Clerk origin is in script-src, not only connect-src',
    /script-src[^;]*clerk\.accounts\.dev/.test(prod),
    prod
  );
  check('the Clerk origin is in connect-src', /connect-src[^;]*clerk\.accounts\.dev/.test(prod));
  check('clerk.com remains allowed for redirects', prod.includes('https://clerk.com'));
  check('Google is allowed as an OAuth frame source', /frame-src[^;]*accounts\.google\.com/.test(prod), prod);

  const dev = buildContentSecurityPolicy({ isDev: true, clerkPublishableKey: realKey });
  check("dev policy allows 'unsafe-eval' for Vite HMR", dev.includes("'unsafe-eval'"), dev);
  check('dev policy allows the Google font stylesheet', dev.includes('https://fonts.googleapis.com'));
  check('production policy omits unsafe-eval', !prod.includes("'unsafe-eval'"), prod);
  // index.html loads these fonts from Google Fonts in every environment, so the
  // production policy must allow them too. This assertion previously encoded the
  // opposite — pinning a bug that blocked every font stylesheet in production.
  check(
    'production policy allows the Google font stylesheet',
    /style-src[^;]*https:\/\/fonts\.googleapis\.com/.test(prod),
    prod
  );
  check(
    'production policy allows the Google font files',
    /font-src[^;]*https:\/\/fonts\.gstatic\.com/.test(prod),
    prod
  );
  check('production upgrades insecure requests', prod.includes('upgrade-insecure-requests'));
  check('dev policy omits upgrade-insecure-requests', !dev.includes('upgrade-insecure-requests'));

  // Hardening that must never be loosened.
  check('policy forbids object-src', prod.includes("object-src 'none'"));
  check('policy forbids framing via frame-ancestors', prod.includes("frame-ancestors 'none'"));
  check('policy forbids inline script attributes', prod.includes("script-src-attr 'none'"));
  check('policy pins base-uri', prod.includes("base-uri 'self'"));
  check('policy pins form-action', prod.includes("form-action 'self'"));
  check('policy never allows inline script', !/script-src[^;]*'unsafe-inline'/.test(prod), prod);
  check('policy never allows wildcard script-src', !prod.includes('script-src *'), prod);

  // A missing or malformed key must not produce a broken or injected directive.
  check('a missing key yields no origin', clerkFrontendOrigin(undefined) === null);
  check('an empty key yields no origin', clerkFrontendOrigin('') === null);
  check('a non-Clerk string yields no origin', clerkFrontendOrigin('https://evil.com') === null);

  const noKey = buildContentSecurityPolicy({ isDev: false, clerkPublishableKey: '' });
  check('a missing key still produces a valid policy', noKey.includes("default-src 'self'"));
  check('a missing key emits no stray semicolons', !/;;/.test(noKey) && !/;\s*;/.test(noKey));

  /*
   * A base64 payload that decodes to something other than a Clerk hostname must
   * be rejected: the value is interpolated into a response header, so trusting
   * it would allow header/policy injection.
   */
  const hostile = Buffer.from('evil.com/x; script-src *').toString('base64url').replace(/=+$/, '');
  check('a non-Clerk decoded host is rejected', clerkFrontendOrigin(`pk_test_${hostile}`) === null);
  const injected = buildContentSecurityPolicy({ isDev: false, clerkPublishableKey: `pk_test_${hostile}` });
  check('a hostile key cannot inject a directive', !injected.includes('script-src *'), injected);
  check('a hostile key cannot terminate the policy early', injected.split(';').length >= 8, injected);

  // Header set.
  check('nosniff is set', SECURITY_HEADERS['X-Content-Type-Options'] === 'nosniff');
  check('framing is denied', SECURITY_HEADERS['X-Frame-Options'] === 'DENY');
  check('camera and microphone are blocked', SECURITY_HEADERS['Permissions-Policy'].includes('camera=()'));
  check('HSTS includes subdomains', HSTS_HEADER.includes('includeSubDomains'));
}

// ---------------------------------------------------------------------------
// 13. Deployment gate integrity
// ---------------------------------------------------------------------------
section('deployment gate');

// The `head: true` trap, pinned.
//
// Verified against this project's live database: for a table that does not
// exist, `select('*', { head: true })` resolves with `error: null` while
// `select('*').limit(1)` correctly returns PGRST205. A checker that uses
// `head: true` therefore reports every table as present — including ones that
// were never created — which is the exact failure a deploy gate exists to catch.
/** Removes // and /* *\/ comments so prose about a pattern cannot match it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const script of ['check-deployment.ts', 'check-schema.ts']) {
  const source = stripComments(
    readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', script), 'utf8')
  );
  check(`${script} does not probe existence with head: true`, !/head:\s*true/.test(source));
}

// The AI-binding reachability check exists because a dead binding is otherwise
// invisible: getModelPipeline skips providers with no key and runModel falls back
// to local placeholder text, so cover_letter shipped bound to Gemini + OpenAI
// while only GROQ_API_KEY was set, and every cover letter silently degraded.
{
  const checker = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'check-deployment.ts'),
    'utf8'
  );
  check('the deploy gate checks AI task bindings', checker.includes('task_bindings'));
  check('the deploy gate reasons about provider keys', checker.includes('GROQ_API_KEY'));
  check('an unreachable binding is reported as a failure', /no reachable model/.test(checker));

  // Every default binding must keep a reachable model behind an unconfigured
  // primary, so a fresh install cannot reproduce the dead cover_letter chain.
  const defaults = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'db.ts'),
    'utf8'
  );
  const bindingBlocks = defaults.split('const DEFAULT_TASK_BINDINGS')[1]?.split('};')[0] ?? '';
  check('cover_letter keeps a Groq fallback', /cover_letter:[\s\S]*?fallbackModelId: 'llm_groq_llama70b'/.test(bindingBlocks));
  check('no default binding falls back to a keyless provider', !/fallbackModelId: 'llm_openai_gpt4o'/.test(bindingBlocks));
}

if (failures.length) {
  console.error(`${failures.length} of ${passed + failures.length} unit checks failed:`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(`All ${passed} unit checks passed.`);
