# GoNative Exam Prep
## Complete Technical Specification, Architecture Research & Implementation Plan

**Project:** GoNative Educational Ecosystem  
**Product:** AI-Powered Language Exam Preparation Platform  
**First supported exam:** IELTS  
**First implementation:** IELTS Writing Checker  
**Initial platform:** Web  
**Preferred stack:** Next.js, TypeScript, Laravel, MySQL  
**Architecture:** Multilingual, multi-exam, AI-driven  
**Document status:** Initial specification for repository investigation and implementation planning

---

# 1. Project Vision

We want to develop a professional, AI-powered language examination preparation platform integrated into the existing **GoNative and Worksheet Generator ecosystem**.

The platform should help students prepare for recognized language examinations through:

- AI-powered examination assessment.
- Writing evaluation and feedback.
- Personalized learning plans.
- Vocabulary development.
- Grammar improvement.
- Targeted educational exercises.
- Practice examinations.
- Progress tracking.
- Continuous reassessment.

The product should go beyond conventional AI essay checking.

Its most important feature should be the ability to transform examination results into **personalized, actionable learning programs**.

For example:

A student submits an IELTS Writing Task 2 essay.

The platform identifies:

- Weak argument development.
- Repeated article errors.
- Limited academic vocabulary.
- Inappropriate collocations.
- Poor paragraph transitions.

Instead of simply returning a score, the system should:

1. Explain the identified weaknesses.
2. Recommend relevant grammar topics.
3. Select appropriate vocabulary from GoNative.
4. Create personalized vocabulary lists where necessary.
5. Generate targeted exercises using Worksheet Generator.
6. Assign further examination practice.
7. Monitor improvement over subsequent attempts.

This creates a continuous learning cycle:

**Assessment → Weakness Analysis → Personalized Practice → Reassessment → Updated Learning Plan**

The objective is to develop a complete AI-assisted examination preparation ecosystem, not merely another essay checker.

---

# 2. Core Business and Engineering Principles

The following requirements are fundamental.

## 2.1 AI-first operation

The product should be designed for operation by a solo developer, assisted by AI.

We do not want a business that depends on:

- Hiring examination tutors.
- Employing teachers to review every submission.
- Manual essay correction.
- Human-led onboarding.
- Individual customer consultations.
- Manually developing hundreds of examination questions.
- Maintaining large teams of educational specialists.

The system should automate content generation, assessment, personalized recommendations, and practice preparation wherever technically reliable.

However, AI-generated output must be independently validated.

**AI automation does not justify inaccurate assessments or misleading claims about examination readiness.**

## 2.2 Reuse existing infrastructure

Before developing new educational functionality, investigate what already exists in:

1. GoNative.
2. Worksheet Generator.

Reuse existing services, educational data, exercises, translations, and content-generation mechanisms wherever possible.

Avoid developing competing implementations of the same functionality.

## 2.3 Multilingual architecture

IELTS is the first examination, not the only examination the platform will ever support.

The fundamental architecture must support multiple learning languages and examination systems from day one.

Adding a new language or examination should not require redesigning the core database, assessment engine, or learning-plan infrastructure.

## 2.4 Self-service product

The application must be suitable for international self-service distribution.

Users should be able to:

- Discover the product through search.
- Register independently.
- Try the assessment functionality.
- Understand the results.
- Purchase access.
- Prepare without contacting support.

Avoid functionality requiring manual customer setup.

## 2.5 Reliability over feature count

A narrow, reliable IELTS Writing Checker is more valuable than a complete examination preparation platform producing questionable results.

We should expand gradually, based on independently evaluated quality.

---

# 3. Mandatory First Step: Repository Investigation

**Do not begin implementing the application immediately.**

First, investigate the existing GoNative and Worksheet Generator repositories.

The investigation must identify reusable functionality and define appropriate integration boundaries.

## 3.1 GoNative investigation

Study:

1. Backend architecture.
2. Database schemas.
3. User accounts.
4. Authentication.
5. Vocabulary database.
6. CEFR classification.
7. Existing vocabulary collections and word lists.
8. Vocabulary translations.
9. Word definitions and lexical meanings.
10. Grammar topics and exercises.
11. Sentence examples.
12. Spaced repetition and learning-progress tracking.
13. AI provider integrations.
14. Prompt-management mechanisms.
15. Existing exercise generation.
16. Exercise evaluation.
17. Administrative interfaces.
18. Subscription and entitlement infrastructure.
19. Cross-platform account synchronization.
20. Existing APIs and integration patterns.

Pay particular attention to the existing **vocabulary collections grouped by levels and topics**.

These collections may become one of the most valuable components of the Exam Prep platform.

Determine how users can create, assign, modify, and study vocabulary collections through existing GoNative functionality.

## 3.2 Worksheet Generator investigation

The Worksheet Generator is actively being developed.

Investigate its actual current implementation, not only its original specification.

Study:

- Shared educational content services.
- Vocabulary integration.
- Grammar integration.
- AI generation pipeline.
- AI model configuration.
- Exercise types.
- Structured exercise formats.
- Validation mechanisms.
- Translation support.
- CEFR handling.
- Worksheet creation.
- Content versioning.
- Reusable exercise entities.
- User permissions.
- Relevant APIs.
- Existing administration tools.

Determine which functionality is implemented, planned, incomplete, or experimental.

Do not assume that all previously specified Worksheet Generator features are production-ready.

## 3.3 Mnemonic investigation restrictions

**Do not perform a separate comprehensive audit of Mnemonic.**

The initial investigation should focus exclusively on GoNative and Worksheet Generator.

Some grammar materials originally developed by an English-language teacher in Mnemonic may already be incorporated into Worksheet Generator.

If these materials are available through Worksheet Generator, investigate and reuse them through that existing integration.

Do not create an additional direct dependency on Mnemonic without a clear reason.

If essential educational functionality is missing and could only be obtained directly from Mnemonic, document the gap and request a separate architectural decision.

Do not independently expand the investigation into Mnemonic.

## 3.4 Expected investigation outcome

Identify:

- Reusable services.
- Reusable educational data.
- Existing API capabilities.
- Missing functionality.
- Technical limitations.
- Integration risks.
- Recommended architecture.
- Necessary extensions.
- Functionality that should remain independent.

**The initial investigation is read-only. Do not modify production databases or existing applications during this phase.**

---

# 4. Product Architecture

The proposed platform consists of several logical layers.

## Layer A — Shared Educational Infrastructure

Provided primarily by GoNative and Worksheet Generator.

Responsibilities:

- Vocabulary.
- Grammar.
- Translations.
- CEFR metadata.
- Exercise generation.
- Exercise validation.
- Learning progress.
- Vocabulary collections.
- Spaced repetition.

## Layer B — Exam Engine

New examination-specific infrastructure.

Responsibilities:

- Examination definitions.
- Examination providers.
- Exam versions.
- Test sections.
- Task types.
- Official assessment criteria.
- Assessment strategies.
- Scoring configurations.
- Practice examination generation.
- User attempts.
- Assessment results.

## Layer C — Personalized Learning Engine

Transforms assessments into learning activities.

Responsibilities:

- Skill profiles.
- Error classification.
- Weakness analysis.
- Vocabulary recommendations.
- Grammar recommendations.
- Personalized exercise selection.
- Study-plan generation.
- Progress monitoring.
- Reassessment scheduling.

## Layer D — Product Interface

The user-facing web application.

Responsibilities:

- Exam selection.
- User goals.
- Writing submission.
- Assessment visualization.
- Feedback.
- Study plans.
- Vocabulary assignments.
- Practice exercises.
- Examination simulation.
- Progress dashboard.
- Payments.

These layers may exist within the same backend.

Do not introduce microservices or additional databases unless necessary.

Prefer well-defined modules and APIs.

---

# 5. Multilingual and Multi-Exam Foundation

The system must not assume every examination uses English or IELTS scoring.

Potential future learning languages include all languages currently supported by GoNative.

Potential examination systems include:

- IELTS Academic.
- IELTS General Training.
- Cambridge English examinations.
- TOEFL.
- PTE Academic.
- Goethe-Zertifikat.
- telc Deutsch.
- DELF/DALF.
- DELE.
- CAPLE Portuguese examinations.
- Additional examination systems.

This is an architectural extensibility requirement, not an instruction to implement every examination immediately.

## 5.1 Examination hierarchy

Investigate a suitable model based on concepts such as:

**Language → Exam Provider → Exam → Exam Version → Section → Task Type → Assessment Rubric**

Example:

Language: English  
Provider: IELTS  
Exam: IELTS Academic  
Version: Applicable exam specification  
Section: Writing  
Task: Task 2  
Rubric: IELTS Writing Task 2 assessment criteria

Another example:

Language: German  
Provider: Goethe-Institut  
Exam: Goethe-Zertifikat B1  
Section: Schreiben  
Task: Exam-specific writing task  
Rubric: Relevant examination criteria

The same generic exam infrastructure should support both examples.

## 5.2 Examination-specific configuration

Different exams may require different:

- Task formats.
- Time limits.
- Word limits.
- Scoring systems.
- Assessment criteria.
- Weighting rules.
- Passing requirements.
- Language levels.
- Answer formats.
- Examination sections.

Do not hardcode IELTS band scores into generic assessment entities.

Use configurable assessment strategies and scoring models.

## 5.3 Exam versioning

Examination specifications can change.

Store:

- Exam specification version.
- Source references.
- Effective dates where available.
- Rubric version.
- Task configuration version.
- Validation strategy version.

Historical assessments should retain the versions used when they were evaluated.

Do not silently reinterpret historical scores after changes to evaluation rules.

---

# 6. Initial Examination: IELTS

IELTS will be the first supported examination.

The initial implementation should focus on Writing.

Support the distinction between:

- IELTS Academic.
- IELTS General Training.

Both share Writing Task 2 essay requirements, while Task 1 differs.

## 6.1 Official examination specifications

Before implementation, verify the latest official IELTS documentation.

Primary sources:

https://ielts.org/

https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing

https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-writing

https://ielts.org/take-a-test/preparation-resources/writing-test-resources/

https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail

Verify:

- Task structure.
- Timing.
- Minimum word counts.
- Assessment criteria.
- Band descriptors.
- Task weighting.
- Differences between Academic and General Training.
- Relevant scoring conventions.

As currently documented, IELTS Writing includes two tasks, with Task 2 contributing twice the weight of Task 1.

However, do not implement scoring rules based solely on this specification document.

Confirm the current official requirements.

## 6.2 Writing assessment criteria

IELTS Writing uses four assessment dimensions:

1. Task Achievement or Task Response.
2. Coherence and Cohesion.
3. Lexical Resource.
4. Grammatical Range and Accuracy.

Implement criterion-specific evaluation.

Each criterion should produce:

- An estimated assessment where sufficiently validated.
- Evidence supporting the assessment.
- Identified problems.
- Severity and frequency.
- Relevant examples.
- Improvement recommendations.

Do not allow the assessment engine to invent unsupported findings.

## 6.3 Initial implementation order

Prioritize:

### Stage 1 — IELTS Writing Task 2

Essay assessment.

This is the preferred starting point because it avoids the additional complexity of interpreting charts and other visual stimuli.

### Stage 2 — IELTS Academic Writing Task 1

Data and process descriptions.

Support tasks involving:

- Charts.
- Graphs.
- Tables.
- Process diagrams.
- Maps.

For chart-based tasks, preserve the underlying numerical data.

The assessor must have access to accurate structured information rather than relying exclusively on image interpretation.

### Stage 3 — IELTS General Training Task 1

Letter writing.

Support:

- Formal letters.
- Semi-formal letters.
- Informal letters.

Evaluate purpose, task coverage, tone, organization, and language.

### Stage 4 — Complete Writing Simulation

Combine Tasks 1 and 2 in a timed examination session.

Apply verified weighting and scoring rules.

Do not calculate a full IELTS overall score from Writing alone.

---

# 7. Writing Checker — Core User Experience

The Writing Checker must be usable as a standalone product.

A user should not need to complete an entire examination preparation course before submitting an essay.

## 7.1 User flow

### Step 1 — Select examination

Example:

IELTS Academic → Writing → Task 2.

### Step 2 — Select task

Options:

- Choose a generated practice task.
- Choose an existing saved task.
- Enter an external task prompt manually.

Avoid assuming an externally supplied prompt is valid or complete.

### Step 3 — Submit response

Initially support typed or pasted text.

Potential future inputs:

- DOCX.
- PDF.
- Images of handwritten responses.

Document/image extraction is outside the initial MVP.

### Step 4 — Assessment

Evaluate the submission using the examination-specific rubric.

### Step 5 — Results

Show:

- Estimated band range or criterion estimates, only if appropriately calibrated.
- Criterion-level feedback.
- Identified weaknesses.
- Highlighted errors.
- Suggested corrections.
- Improved examples.
- Priority recommendations.

### Step 6 — Personalized practice

Allow the user to:

- Learn recommended vocabulary.
- Practice weak grammar topics.
- Generate targeted exercises.
- Try a similar Writing task.
- Compare attempts.

### Step 7 — Save progress

Store the attempt, assessment, weaknesses, and recommended activities.

---

# 8. Reliable AI Assessment

**Assessment accuracy is the primary technical and commercial risk.**

Do not implement a basic prompt asking an AI model to assign an IELTS band and treat the response as reliable.

A polished explanation does not prove that the assigned score is correct.

## 8.1 Assessment pipeline

Recommended conceptual pipeline:

1. Validate the examination task.
2. Normalize the submitted answer.
3. Count words.
4. Identify relevant structural features.
5. Retrieve examination-specific rubric criteria.
6. Evaluate each criterion independently.
7. Identify evidence supporting each assessment.
8. Detect contradictions and unsupported findings.
9. Perform independent validation.
10. Apply calibrated scoring rules where available.
11. Produce structured feedback.
12. Extract recurring language weaknesses.
13. Save assessment metadata.
14. Generate learning recommendations.

The actual implementation should be determined after the repository and AI benchmark investigation.

## 8.2 Criterion-specific evaluation

Avoid using one unrestricted model response for the entire evaluation.

Investigate separating assessment into specialized steps.

Examples:

**Task Response**

- Does the response answer the actual question?
- Is the position clear?
- Are relevant ideas developed?
- Are examples appropriate?
- Are important requirements missing?

**Coherence and Cohesion**

- Is the structure logical?
- Are paragraphs appropriately organized?
- Are cohesive devices used naturally?
- Is progression clear?

**Lexical Resource**

- Vocabulary range.
- Repetition.
- Word choice.
- Collocations.
- Register.
- Precision.
- Word formation.

**Grammatical Range and Accuracy**

- Sentence structures.
- Grammatical variety.
- Recurring errors.
- Accuracy.
- Errors affecting communication.

Use the appropriate official rubric definitions rather than relying only on these simplified examples.

## 8.3 Evidence-based feedback

Assessment findings should reference specific parts of the student's response where possible.

Example:

```json
{
  "finding_type": "grammar_error",
  "skill": "articles",
  "original_text": "Government should invest in education",
  "suggestion": "The government should invest in education",
  "explanation": "The reference is to the government as an institution in this context.",
  "severity": "minor",
  "source_span": {
    "start": 0,
    "end": 37
  }
}
```

This is an illustrative structure.

The system must validate that source spans actually refer to the user's text.

Use structured findings rather than storing only a large block of unstructured AI feedback.

## 8.4 Independent validation

Investigate:

- Independent assessment passes.
- Different AI models for selected validation tasks.
- Deterministic consistency checks.
- Disagreement detection.
- Rubric-constrained evaluation.
- Calibration against examiner-scored examples.

Multiple AI models agreeing with one another does not establish that they agree with trained human examiners.

## 8.5 Score reliability

Treat all AI scores as estimates.

The system must not claim to provide official IELTS assessment.

If reliable calibration is unavailable, prefer descriptive feedback and broad readiness indicators over unsupported precise band scores.

When sufficient calibration exists, investigate reporting:

- Estimated criterion bands.
- An uncertainty interval or range.
- Areas where scoring confidence is limited.
- Historical trends.

Do not create artificial numerical precision.

A student's readiness should never be determined solely from a single Writing attempt.

---

# 9. AI Quality Benchmark — Mandatory Before Full Development

This phase is a critical decision gate.

We must determine whether the available AI models can provide feedback accurate enough for a commercial product.

## 9.1 Evaluation dataset

Investigate legally usable examination preparation examples and examiner-scored responses.

Prefer official IELTS materials and other documented reference examples where permitted.

Verify licensing and permitted usage.

Do not scrape or redistribute copyrighted examination materials without authorization.

Where examiner-scored reference data is available, use it to evaluate:

- Criterion-level score agreement.
- Overall score deviation.
- Error detection.
- False corrections.
- Quality of explanations.
- Feedback consistency.

Do not represent AI-generated scores or AI-generated reference answers as independently verified human ground truth.

## 9.2 Benchmark experiments

Compare:

- Different AI providers.
- Different models.
- Different prompt strategies.
- Independent versus combined criterion evaluation.
- Single-pass versus multi-stage assessment.
- Assessment with and without reference materials.
- Error-focused validation strategies.

## 9.3 Metrics

Track:

- Mean absolute error against trusted examiner scores where available.
- Percentage of estimates within 0.5 and 1.0 IELTS band where meaningful.
- Criterion-level disagreement.
- False-positive error detection.
- Missed important errors.
- Unsupported feedback claims.
- Stability across repeated evaluations.
- Feedback usefulness.
- Processing latency.
- Cost per assessment.

Benchmark datasets should be separated from examples used to develop prompts or calibrate models.

Avoid optimizing prompts on the same samples used for final evaluation.

## 9.4 Limitations

Without independently scored reference examples, automated testing can measure consistency and structural quality, but cannot establish agreement with official examiners.

Document this limitation explicitly.

If accurate band prediction cannot be demonstrated, the product should still be able to launch as a useful **Writing Feedback & Practice Tool** without misleading score claims.

---

# 10. Structured Student Skill Profile

One of the most important architectural requirements is to store language weaknesses as structured data.

Do not store assessment results exclusively as human-readable feedback.

We need persistent information that can power individualized learning.

## 10.1 Skill taxonomy

Possible skill categories:

- Grammar.
- Vocabulary.
- Coherence.
- Writing structure.
- Task fulfillment.
- Register.
- Argument development.
- Reading comprehension.
- Listening comprehension.
- Speaking fluency.
- Pronunciation.

The taxonomy must be extensible.

Example:

```json
{
  "learning_language": "en",
  "exam_id": "ielts-academic",
  "skills": [
    {
      "skill": "grammar.articles",
      "status": "needs_practice",
      "observations": 8,
      "priority": "high"
    },
    {
      "skill": "vocabulary.academic_collocations",
      "status": "needs_practice",
      "observations": 5,
      "priority": "medium"
    },
    {
      "skill": "writing.argument_development",
      "status": "needs_improvement",
      "priority": "high"
    }
  ]
}
```

The example is conceptual, not a finalized schema.

## 10.2 Skill history

Track changes over time.

For example:

- How frequently does the user make article-related errors?
- Does vocabulary variety improve?
- Are repeated mistakes disappearing?
- Is paragraph organization becoming more consistent?
- Are improvements demonstrated in subsequent assessments?

Avoid treating one error as sufficient evidence of a persistent weakness.

Track evidence counts, recency, and uncertainty.

## 10.3 Separation from examination scores

Generic language skills and exam-specific assessment results should remain separate.

A user may improve grammar significantly without immediately improving the IELTS Task Response criterion.

The architecture must support both types of progress.

---

# 11. Personalized Vocabulary — GoNative Integration

**This is a central product feature, not an optional future enhancement.**

The platform should use the existing GoNative vocabulary infrastructure to provide individualized vocabulary preparation.

GoNative already contains vocabulary collections organized by subjects and levels.

We should reuse these resources rather than building a second vocabulary-learning system.

## 11.1 Existing collection reuse

Investigate:

- Vocabulary collection structure.
- Topic taxonomy.
- CEFR classification.
- Vocabulary selection.
- Word translations.
- Existing user lists.
- Custom list creation.
- Vocabulary training.
- Spaced repetition.
- Learning progress.

Determine how Exam Prep can select existing collections and assign them to a user.

## 11.2 Personalized vocabulary analysis

The Writing assessment engine should identify relevant vocabulary weaknesses.

Examples:

- Limited vocabulary range.
- Excessive repetition.
- Incorrect collocations.
- Inappropriate register.
- Unnatural expressions.
- Incorrect word forms.
- Weak topic-specific vocabulary.

Example:

Student frequently writes:

- very important
- very big problem
- good solution
- a lot of people

The system may recommend more precise expressions such as:

- crucial
- significant challenge
- effective approach
- a substantial number of people

However, recommendations must be context-aware.

Do not automatically replace ordinary words with unnecessarily complicated alternatives.

The objective is accurate, natural, appropriate English — not maximum lexical complexity.

## 11.3 Vocabulary recommendation pipeline

Recommended flow:

1. Analyze the student's response.
2. Identify vocabulary weaknesses.
3. Map weaknesses to lexical concepts or topics.
4. Search existing GoNative vocabulary.
5. Select appropriate words and expressions.
6. Respect the user's approximate proficiency level.
7. Avoid already-mastered vocabulary where learning history is available.
8. Generate missing useful items when needed.
9. Validate newly generated vocabulary and translations.
10. Build a personalized vocabulary collection.
11. Make it available through GoNative learning functionality.

## 11.4 Two collection types

### A. Existing GoNative collections

Use topic- and level-based collections already available.

For example:

- Academic vocabulary.
- Environment.
- Education.
- Technology.
- Social issues.
- Collocations.
- Common academic expressions.

These are illustrative examples; inspect actual available collections.

### B. Personalized collections

Create collections based on the student's actual mistakes and learning needs.

Example:

**IELTS Writing — My Weak Vocabulary**

Containing:

- New expressions.
- Useful collocations.
- Commonly misused words.
- Contextual examples.
- Appropriate translations.
- Relevant grammatical metadata.

## 11.5 Shared vocabulary data

Use the existing GoNative vocabulary and translation model wherever possible.

Avoid copying vocabulary into an independent Exam Prep database.

For additional vocabulary generated by AI, preserve:

- Source.
- Meaning.
- Language.
- Translation.
- Context.
- Quality status.
- User ownership where applicable.

Do not automatically add unreviewed user-specific content to globally trusted shared dictionaries.

## 11.6 Cross-product learning

Investigate whether the user can study the assigned vocabulary through:

- GoNative web.
- GoNative mobile.
- Exam Prep web.

Prefer reusing GoNative's existing learning engine and spaced-repetition system.

Do not build a second spaced-repetition engine unless existing functionality cannot support the requirements.

---

# 12. Grammar and Personalized Exercises

Integrate with Worksheet Generator.

The new platform should use the existing educational exercise infrastructure to address weaknesses revealed by assessments.

Example:

IELTS Writing assessment detects repeated article mistakes.

Exam Prep creates a practice recommendation:

**Grammar: Articles — B1/B2**

Worksheet Generator produces:

- Multiple-choice exercises.
- Fill-in-the-blank exercises.
- Error correction.
- Sentence transformation where appropriate.

The system should support:

- Selecting existing exercises.
- Generating personalized exercises.
- Assigning exercises.
- Recording completion.
- Evaluating answers.
- Updating the skill profile.

## Integration principles

1. Reuse the Worksheet Generator's generation pipeline.
2. Reuse its quality validation.
3. Reuse its grammar taxonomy.
4. Reuse existing verified examples.
5. Avoid duplicating exercise engines.
6. Preserve language-independent content formats.

If Worksheet Generator does not yet expose the required APIs, propose minimal reusable extensions.

Do not fork its educational logic into Exam Prep.

---

# 13. Personalized Learning Plan Engine

The learning plan should combine examination preparation with targeted language improvement.

## 13.1 Initial user profile

Collect only information needed for useful recommendations:

- Selected examination.
- Target score or required result.
- Current approximate level, if known.
- Planned examination date, if known.
- Available study time.
- Preferred instruction/reference language.

Allow users to begin without answering every question.

## 13.2 Diagnostic assessment

Start with Writing.

Later expand to:

- Reading.
- Listening.
- Speaking.

Do not claim to assess overall IELTS readiness from Writing alone.

## 13.3 Study-plan generation

Generate plans based on:

- Examination requirements.
- Target score.
- Available time.
- Assessment history.
- Skill weaknesses.
- Vocabulary knowledge.
- Grammar progress.
- Existing GoNative resources.
- Available Worksheet Generator exercises.

Use AI for pedagogical planning, supported by deterministic scheduling and resource-availability constraints.

## 13.4 Recommended activities

A typical plan may include:

- Vocabulary study.
- Grammar exercises.
- Writing practice.
- Reviewing previous mistakes.
- Timed examination tasks.
- Reassessment.

## 13.5 Adaptive updates

Reassess periodically.

Update priorities when:

- The user demonstrates improvement.
- Recurring errors persist.
- New weaknesses appear.
- Examination deadlines approach.
- The user completes recommended activities.

Preserve historical plans and decisions.

Do not entirely regenerate the plan after every minor interaction.

## 13.6 Feasibility

Do not promise that a user can reach a particular band within a specific number of days.

Use realistic, uncertainty-aware recommendations.

Progress estimates should reflect demonstrated performance, not motivational guesses.

---

# 14. Practice Examination Content Generation

The long-term system should generate original examination-style practice materials.

These must be pedagogically appropriate and consistent with the supported examination's specifications.

## 14.1 Original content

Use AI to generate original practice tasks.

Do not reproduce protected official examination questions without permission.

Generated practice materials should be clearly labeled as unofficial.

## 14.2 Quality validation

Validate:

- Task format.
- Task completeness.
- Difficulty.
- Linguistic quality.
- Answer correctness.
- Distractor plausibility.
- Alignment with the selected examination.
- Ambiguity.
- Repetition.

## 14.3 Practice task library

Store tasks with:

- Exam.
- Exam version.
- Section.
- Task type.
- Difficulty.
- Topic.
- Language.
- Generated content.
- Validation status.
- Origin.
- Generation model.
- Prompt version.

Reuse validated tasks where appropriate rather than generating everything repeatedly.

## 14.4 IELTS Academic Task 1 visual materials

This area requires special attention.

For data-based tasks, consider generating structured datasets first, then rendering charts or tables deterministically.

For example:

Structured data → chart renderer → task prompt → independently validated reference interpretation.

Avoid asking an image model to invent a chart containing potentially inconsistent or unreadable numbers.

For process diagrams or maps, evaluate separate generation and validation strategies.

---

# 15. Future Reading, Listening and Speaking Modules

The architecture should accommodate all major examination sections, but these modules should not be implemented simultaneously.

## 15.1 Reading

Potential features:

- AI-generated reading passages.
- Examination-specific questions.
- Timed tests.
- Answer validation.
- Vocabulary extraction.
- Reading weakness analysis.

Question answers must be grounded in the passage.

## 15.2 Listening

Potential features:

- AI-generated dialogues and monologues.
- Text-to-speech.
- Multiple speaker voices.
- Listening questions.
- Transcripts.
- Listening comprehension assessment.

Validate pronunciation, clarity, timing, question correctness, and consistency between audio and transcript.

## 15.3 Speaking

Potential features:

- Voice-based examination simulations.
- Speech transcription.
- Follow-up questions.
- Fluency analysis.
- Grammar feedback.
- Vocabulary feedback.
- Speaking practice history.

Pronunciation assessment requires specialized evaluation methods.

Speech-to-text output alone is not sufficient to measure pronunciation reliably.

Do not claim official Speaking band accuracy without appropriate calibration.

---

# 16. User Interface and User Experience

The initial platform should be web-first.

Prefer the existing Next.js architecture where appropriate.

The interface should be optimized for:

- Desktop.
- Laptop.
- Tablet.
- Mobile browsers.

## 16.1 Core pages

Proposed pages:

1. Landing page.
2. Exam selection.
3. User dashboard.
4. Writing practice.
5. Writing editor.
6. Assessment results.
7. Detailed error analysis.
8. Personalized learning plan.
9. Vocabulary assignments.
10. Grammar practice.
11. Practice history.
12. Progress dashboard.
13. Subscription and billing.
14. Profile and settings.

Do not implement every page in the first UI iteration.

## 16.2 Writing editor

Requirements:

- Clean writing environment.
- Task instructions.
- Word count.
- Optional timer.
- Autosave.
- Draft persistence.
- Clear submission process.

Prevent accidental loss of essays.

## 16.3 Assessment interface

The results should be understandable without educational expertise.

Possible presentation:

- Assessment summary.
- Criterion breakdown.
- Annotated essay.
- Important errors.
- Suggested improvements.
- Personalized practice.
- Historical comparison.

Avoid overwhelming users with excessive AI-generated text.

Prioritize the most actionable findings.

---

# 17. Internationalization

The application must use a multilingual architecture from the beginning.

For the first release, support:

- English interface.
- Russian interface.

Investigate reuse of existing GoNative or Worksheet Generator localization infrastructure.

Future interface languages may include:

- Ukrainian.
- Portuguese (European).
- Polish.
- German.
- French.
- Spanish.

## Independent language settings

Distinguish:

1. Interface language.
2. Examination/learning language.
3. Explanation language.
4. Translation/reference language.

Example:

Interface: Russian  
Exam: IELTS Academic  
Learning language: English  
Feedback language: Russian  
Vocabulary translations: Russian

The system should support explanatory feedback in Russian while maintaining correct English examination terminology.

Additional learning languages must not require rewriting the assessment architecture.

---

# 18. Database and Domain Model

The agent must propose an appropriate data model after examining existing infrastructure.

Potential entities include:

### Examination configuration

- Exam providers.
- Exams.
- Exam versions.
- Sections.
- Task types.
- Assessment rubrics.
- Scoring strategies.
- Task templates.

### Examination content

- Practice tasks.
- Task assets.
- Generated examinations.
- Content versions.
- Validation records.

### User assessment

- User examination goals.
- Exam sessions.
- User attempts.
- Assessment jobs.
- Assessment results.
- Criterion assessments.
- Error findings.
- Skill observations.
- Assessment versions.

### Personalized learning

- User skill profiles.
- Learning plans.
- Plan versions.
- Learning recommendations.
- Vocabulary assignments.
- Exercise assignments.
- Activity completion.
- Reassessment history.

### Operational data

- AI generation jobs.
- Provider/model configurations.
- Prompt versions.
- Token usage.
- Costs.
- Validation failures.
- User entitlements.

Do not create all these tables blindly.

First determine what can be represented by existing GoNative and Worksheet entities.

The final design should minimize duplication while preserving clear ownership.

---

# 19. Cross-Product User Accounts and Data Synchronization

Investigate options for integration with existing GoNative users.

Potential goals:

- Shared login.
- Existing account recognition.
- Vocabulary synchronization.
- Shared learning history where appropriate.
- Cross-product navigation.
- Consistent subscription entitlements.

Do not assume that existing accounts can be merged automatically.

Review current authentication systems.

Preserve privacy, authorization boundaries, and user consent.

## Subscription separation

Exam Prep may have its own paid packages.

Existing GoNative Premium access should not automatically imply unlimited Exam Prep usage unless explicitly configured.

Likewise, buying Exam Prep should not necessarily grant full GoNative Premium.

Define clear cross-product entitlement rules.

---

# 20. Monetization

The application must support self-service payments.

Explore reuse of existing Paddle infrastructure.

The initial pricing is hypothetical.

## Free tier

Potential functionality:

- Limited sample Writing evaluations.
- Basic feedback.
- Sample examination tasks.
- Limited vocabulary recommendations.

Provide enough value for users to evaluate the product.

## Writing Checker packages

Example:

- Small pack of full Writing evaluations.
- Larger pack with lower per-evaluation cost.

## Exam Prep packages

Example:

- 30-day preparation.
- 90-day preparation.

Features may include:

- Writing assessment quotas.
- Practice tasks.
- Personalized study plans.
- Vocabulary assignments.
- Grammar exercises.
- Progress history.
- Reassessment.

## AI cost controls

Do not offer uncontrolled unlimited AI assessments.

Implement:

- Generation quotas.
- Evaluation quotas.
- Model-specific cost tracking.
- Rate limiting.
- Retry limits.
- Abuse prevention.
- Cost per paid customer.

Pricing decisions should consider expected AI usage and payment processing costs.

---

# 21. SEO and International Self-Service Acquisition

Organic acquisition is a fundamental business goal.

We already have an existing audience within GoNative/Mnemonic, which may support initial discovery.

However, the product should also acquire users independently.

## Potential SEO topics

Examples:

- IELTS Writing Checker.
- IELTS Essay Checker.
- IELTS Writing Task 2 Practice.
- IELTS Academic Writing Feedback.
- IELTS General Training Letter Checker.
- IELTS Writing Band Estimator.
- IELTS Vocabulary Practice.
- IELTS Writing Grammar Exercises.

Provide useful tools rather than only informational articles.

## SEO strategy

Consider:

- Free writing assessment previews.
- Original practice tasks.
- Example feedback.
- Educational guides.
- Topic-specific practice pages.
- Relevant internal links.
- Multilingual landing pages.

Avoid mass-producing thin AI-generated pages.

Keep private user attempts and assessment reports non-indexed.

## Cross-promotion

Explore appropriate links from:

- GoNative.
- Worksheet Generator.
- Existing educational pages.
- Existing user communications.

Do not automatically enroll users in marketing communications without appropriate permissions.

---

# 22. Administration and Monitoring

Reuse existing administrative infrastructure where suitable.

Required operational visibility:

- Assessment requests.
- Assessment failures.
- AI provider errors.
- Evaluation latency.
- Model usage.
- Cost per assessment.
- Rubric versions.
- Prompt versions.
- Validation disagreements.
- Generated practice content.
- User-reported assessment problems.
- Vocabulary recommendation failures.
- Worksheet integration errors.

Allow review and debugging of assessment pipelines without exposing unnecessary private user information.

Support configurable AI models and fallback strategies.

---

# 23. Security, Privacy and Content Protection

Implement:

- Authentication.
- Authorization.
- Secure essay storage.
- Appropriate retention and deletion controls.
- Per-user data isolation.
- Safe API integration.
- Rate limiting.
- Payment authorization.
- Background job security.
- Input validation.
- Prompt-injection defenses.
- Private assessment history.

User essays may contain personal information.

Avoid unnecessary sharing or logging of submitted text.

Review AI provider data-handling policies.

Respect applicable data protection requirements, including GDPR where relevant.

Do not reuse private user essays to train shared models or publish them as examples without appropriate permission.

---

# 24. Testing Strategy

## 24.1 Backend testing

Cover:

- Exam configuration.
- Rubric selection.
- User attempts.
- Assessment persistence.
- Authorization.
- Assessment versioning.
- Background jobs.
- Quota enforcement.
- Retry handling.
- Vocabulary assignments.
- Worksheet integration.
- Payment entitlements.

## 24.2 AI assessment testing

Cover:

- Rubric adherence.
- Score consistency.
- Unsupported claims.
- Error detection.
- False corrections.
- Different writing levels.
- Short submissions.
- Off-topic essays.
- Responses that ignore task requirements.
- Unusual but valid writing styles.
- Repeated submissions.
- Incomplete tasks.

## 24.3 Recommendation testing

Verify:

- Detected weaknesses map to real educational topics.
- Suggested vocabulary exists or is appropriately generated.
- Vocabulary is not needlessly duplicated.
- Recommendations match the user's language level.
- Exercises address the intended weakness.
- Learning progress is not overstated.

## 24.4 Multilingual architecture testing

Verify that the domain model supports:

- English IELTS Writing.
- German Goethe Writing.
- Portuguese CAPLE Writing.
- Different scoring systems.
- Different assessment criteria.
- Different feedback languages.
- Different vocabulary translation languages.

Future exams do not need full functional implementation during the initial phase.

Architectural and integration tests are sufficient where appropriate.

---

# 25. Development Roadmap

## Phase 0 — Repository Audit and Architecture Research

**Read-only investigation. No production changes.**

Tasks:

1. Investigate GoNative.
2. Investigate Worksheet Generator.
3. Inspect vocabulary collections.
4. Inspect grammar and exercise APIs.
5. Inspect AI integrations.
6. Inspect existing validation pipelines.
7. Inspect user accounts.
8. Inspect learning-progress tracking.
9. Inspect payment infrastructure.
10. Propose Exam Engine architecture.
11. Propose Assessment Engine architecture.
12. Propose personalized learning integration.
13. Design a multilingual domain model.
14. Identify required APIs and extensions.
15. Identify implementation risks.

Deliverable: Architecture and integration report.

---

## Phase 1 — IELTS Writing Assessment Proof of Concept

**This is the most important initial engineering phase.**

Do not begin with a complete frontend.

Start with IELTS Academic Writing Task 2.

Implement an experimental backend or evaluation harness capable of:

1. Accepting essay tasks.
2. Accepting written responses.
3. Evaluating the four IELTS Writing criteria.
4. Producing structured feedback.
5. Detecting grammatical and lexical weaknesses.
6. Running independent validation.
7. Recording model usage and cost.
8. Comparing assessments against trusted reference examples where available.

Compare different models and prompting strategies.

Measure accuracy and consistency.

Determine whether the system can produce commercially useful feedback.

Deliverable: **IELTS AI Assessment Benchmark Report**.

If band prediction is not sufficiently reliable, recommend a narrower feedback product rather than forcing a misleading scoring system into production.

---

## Phase 2 — Exam Engine and Writing Checker Backend

Implement:

- Exam configuration.
- Exam versioning.
- Task definitions.
- Assessment rubrics.
- User attempts.
- Assessment jobs.
- Criterion assessments.
- Feedback findings.
- Skill observations.
- Assessment history.
- AI cost tracking.
- API endpoints.

---

## Phase 3 — Writing Checker Web MVP

Implement:

- English and Russian UI.
- Account access.
- IELTS Academic Task 2 practice.
- Essay editor.
- Autosave.
- Submission.
- Assessment feedback.
- Annotated corrections.
- Attempt history.
- Basic progress tracking.
- Initial usage limits.

Focus on fast and intuitive UX.

---

## Phase 4 — Personalized GoNative Integration

Implement:

- Skill-profile updates.
- Grammar recommendations.
- Vocabulary collection recommendations.
- Personalized vocabulary lists.
- GoNative learning links or integration.
- Worksheet Generator exercises.
- Learning-plan generation.
- Completion tracking.

This phase should make assessment results directly actionable.

---

## Phase 5 — IELTS Writing Expansion

Add:

- Academic Task 1.
- General Training Task 1.
- Complete Writing simulations.
- Timed sessions.
- Expanded practice-task library.
- More detailed progress tracking.

Validate assessment accuracy separately for the new task types.

---

## Phase 6 — Monetization and Public Launch

Implement:

- Self-service payments.
- Assessment packages.
- Preparation packages.
- Billing and entitlements.
- AI usage limits.
- Landing pages.
- Initial SEO tools.
- Cross-promotion from GoNative.
- Conversion analytics.
- Operational monitoring.

---

## Phase 7 — Full IELTS Exam Prep

Expand gradually into:

- Reading.
- Listening.
- Speaking.
- Complete practice exams.
- Comprehensive readiness tracking.
- Personalized study schedules.
- Reassessment workflows.

Each section requires its own quality benchmarks.

---

## Phase 8 — Additional Languages and Examinations

Use the established architecture to support additional examinations.

Potential candidates:

- Cambridge B2/C1.
- Goethe/telc B1.
- CAPLE CIPLE A2.
- Other exams relevant to GoNative languages.

Select future exams based on demand, competition, content requirements, and assessment reliability.

Do not launch additional exams merely because the architecture supports them.

---

# 26. Required Initial Deliverables

**Your first assignment is investigation and technical planning — not implementation.**

Produce the following reports.

## A. GoNative Infrastructure Assessment

Document existing educational content, APIs, authentication, progress tracking, vocabulary collections, and reusable services.

## B. Worksheet Generator Assessment

Identify implemented educational generation, validation, exercise, translation, and content-reuse capabilities.

## C. Proposed Exam Engine Architecture

Describe modules, APIs, data flows, exam configuration, scoring strategies, and versioning.

## D. AI Writing Assessment Strategy

Propose a reliable, evidence-based IELTS assessment pipeline.

Explain model selection, independent validation, scoring limitations, and calibration.

## E. AI Benchmark Plan

Define evaluation datasets, test cases, metrics, provider comparisons, and expected cost measurement.

## F. Personalized Learning Architecture

Explain how assessment weaknesses become grammar practice, vocabulary assignments, and learning plans.

## G. GoNative Vocabulary Integration

Explain how existing vocabulary collections and personalized word lists will be selected, created, synchronized, and studied.

## H. Worksheet Generator Integration

Define how generated exercises can be requested, assigned, completed, and evaluated without duplicating the exercise engine.

## I. Database Design

Provide entity definitions, relationships, indexes, ownership boundaries, migration strategy, and versioning.

## J. Multilingual and Multi-Exam Verification

Demonstrate how additional languages and examinations can be supported without restructuring the core system.

## K. MVP Specification

Define the precise initial scope, acceptance criteria, and features deliberately deferred.

## L. Implementation Plan

Break development into engineering tasks with dependencies, technical risks, tests, and expected complexity.

## M. Cost and Monetization Model

Estimate AI generation and assessment costs using documented model pricing and measurable token usage.

Identify cost controls required for commercial operation.

## N. Open Questions and Risks

Identify unresolved issues requiring architectural or product decisions.

---

# 27. Final Engineering Instructions

1. Begin with repository investigation.
2. Investigate GoNative and Worksheet Generator only.
3. Do not independently audit Mnemonic.
4. Reuse grammar already incorporated into Worksheet Generator.
5. Do not duplicate GoNative vocabulary infrastructure.
6. Use existing GoNative vocabulary collections in personalized preparation.
7. Design a multilingual, multi-exam architecture.
8. Implement IELTS first.
9. Begin technical validation with Academic Writing Task 2.
10. Treat AI assessment reliability as a critical requirement.
11. Never present unvalidated AI band estimates as official results.
12. Store educational weaknesses as structured data.
13. Design assessment-to-learning recommendation workflows.
14. Reuse Worksheet Generator for personalized exercises.
15. Reuse GoNative for vocabulary learning and progress tracking.
16. Keep AI providers interchangeable.
17. Track AI usage and costs.
18. Protect private user submissions.
19. Avoid unnecessary architectural complexity.
20. Optimize for a solo developer maintaining an international self-service product.

## Initial stopping point

After completing the repository investigation and technical planning:

- Present findings.
- Identify reusable infrastructure.
- Recommend architecture.
- Present the AI benchmark design.
- Explain major risks.
- List required decisions.
- Provide an implementation roadmap.

**Stop before modifying production code, production databases, or existing application contracts.**

The first implementation milestone, after architecture approval, should be a measurable IELTS Writing assessment proof of concept rather than a complete web application.

---

# Ultimate Objective

Build an AI-powered multilingual examination preparation platform that transforms examination assessment into personalized language improvement.

The system should combine:

**Exam-specific assessment + GoNative vocabulary + Worksheet Generator exercises + personalized learning plans + continuous progress tracking.**

IELTS Writing Checker is the first commercial product capability.

IELTS Exam Prep is the first complete examination program.

Additional languages and examinations should become extensions of the same reliable educational infrastructure.

The final platform must be commercially viable, technically maintainable, educationally useful, and operable without a dedicated team of teachers or examination assessors.