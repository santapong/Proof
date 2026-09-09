#!/usr/bin/env node
// Independent frozen-fixture study. No provider calls, dispatch, threshold tuning, or dependency installation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rankContext, trainModel } from './lib/software-context.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let outputBase = join(ROOT, 'docs/examples/software-efficiency-evaluation');
if (args.length) {
  assert(args.length === 2 && args[0] === '--out', 'Usage: node scripts/evaluate-software-context.mjs [--out /absolute/report-basename]');
  outputBase = resolve(args[1]);
}
for (const ext of ['.json', '.md']) assert(!existsSync(`${outputBase}${ext}`), `Refusing to overwrite prior evidence: ${outputBase}${ext}`);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const rows = text => text.trim().split('\n').map(line => JSON.parse(line));
const stamp = () => new Date().toISOString();
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const trigrams = text => {
  const words = normalize(text).split(' ');
  return new Set(words.slice(2).map((_, i) => words.slice(i, i + 3).join(' ')));
};
const jaccard = (left, right) => {
  const union = new Set([...left, ...right]);
  return union.size ? [...left].filter(item => right.has(item)).length / union.size : 0;
};
const freeze = JSON.parse(read('docs/examples/software-routing-eval.freeze.json'));
const fixtureText = read(freeze.fixture);
assert.equal(sha256(fixtureText), freeze.fixtureSha256, 'Frozen evaluation fixture changed');
assert.equal(sha256(read(freeze.normativeSource)), freeze.normativeSourceSha256, 'Normative source changed; retain this holdout and register a separate study');
const cases = rows(fixtureText);
assert.equal(cases.length, freeze.rows);
assert.equal(new Set(cases.map(row => row.id)).size, cases.length, 'Evaluation IDs must be unique');
const allowedSkills = new Set(JSON.parse(read(freeze.normativeSource)).matrix.map(row => row.skill));
for (const row of cases) {
  assert.equal(row.split, 'evaluation');
  assert.equal(typeof row.task, 'string');
  assert.equal(typeof row.mustAbstain, 'boolean');
  assert.equal(row.acceptableSkills.length === 0, row.mustAbstain);
  for (const skill of row.acceptableSkills) assert(allowedSkills.has(skill), `Unknown expected skill ${skill}`);
}

const startedAt = stamp();
// Baseline first is intentional: neither the train fixture nor a learned artifact has been loaded yet.
const baselineStartedAt = stamp();
const baseline = cases.map(row => rankContext({ root: ROOT, task: row.task, limit: 3 }));
const baselineCompletedAt = stamp();
for (const result of baseline) {
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.learned.status, 'disabled');
}

// Leakage checks operate on training text without printing or incorporating it into oracle labels.
const trainingPath = 'docs/examples/software-routing-train.jsonl';
const trainingText = read(trainingPath);
const training = rows(trainingText);
const overlaps = [];
const nearOverlaps = [];
let maximumTrigramJaccard = 0;
for (const test of cases) {
  const testTrigrams = trigrams(test.task);
  for (const train of training) {
    if (test.id === train.id || normalize(test.task) === normalize(train.task)) overlaps.push({ evaluationId: test.id, trainingId: train.id });
    const similarity = jaccard(testTrigrams, trigrams(train.task));
    maximumTrigramJaccard = Math.max(maximumTrigramJaccard, similarity);
    if (similarity >= 0.8) nearOverlaps.push({ evaluationId: test.id, trainingId: train.id, trigramJaccard: similarity });
  }
}
assert.equal(overlaps.length, 0, 'Exact train/evaluation overlap invalidates study');
assert(training.every(row => row.split === 'train' && row.reviewed === true), 'Training fixture lacks required split/review metadata');
assert.equal(new Set(training.map(row => row.id)).size, training.length, 'Duplicate training IDs');

const modelDirectory = mkdtempSync(join(tmpdir(), 'proof-software-evaluation-'));
const modelPath = join(modelDirectory, 'model.json');
const trainingStartedAt = stamp();
trainModel({ root: ROOT, dataPath: join(ROOT, trainingPath), outPath: modelPath });
const trainingCompletedAt = stamp();
const learned = cases.map(row => rankContext({ root: ROOT, task: row.task, modelPath, limit: 3 }));
const learnedCompletedAt = stamp();
for (let index = 0; index < cases.length; index++) {
  assert.equal(learned[index].advisoryOnly, true);
  assert.deepEqual(learned[index].lexical, baseline[index].lexical, 'Optional model changed lexical baseline');
  assert.equal(learned[index].outcome, baseline[index].outcome, 'Optional model silently changed baseline outcome');
  assert.equal(learned[index].sourceSha256, baseline[index].sourceSha256, 'Source changed during experiment');
}
assert.equal(sha256(read(freeze.fixture)), freeze.fixtureSha256);
assert.equal(sha256(read(trainingPath)), sha256(trainingText), 'Training fixture changed during experiment');

const arm = (row, candidates, abstained) => ({
  abstained,
  candidates: candidates.map(candidate => candidate.skill),
  top1Correct: !row.mustAbstain && !abstained && row.acceptableSkills.includes(candidates[0]?.skill),
  top3Recall: !row.mustAbstain && !abstained && candidates.slice(0, 3).some(candidate => row.acceptableSkills.includes(candidate.skill)),
  abstentionCorrect: row.mustAbstain ? abstained : null,
});
const perCase = cases.map((row, index) => {
  const base = baseline[index];
  const hint = learned[index];
  return {
    id: row.id, group: row.group, acceptableSkills: row.acceptableSkills, mustAbstain: row.mustAbstain,
    lexical: arm(row, base.lexical.candidates ?? [], base.outcome === 'abstain'),
    learned: arm(row, hint.learned.candidates ?? [], hint.learned.status === 'abstain'),
    learnedStatus: hint.learned.status,
    proxy: {
      baselineCandidateEntrypointCharacters: base.readPlan.totalCharacters,
      optionalModelUnionEntrypointCharacters: hint.readPlan.totalCharacters,
      allEntrypointCharacters: base.readPlan.allEntrypointCharacters,
      baselineResponseCharacters: JSON.stringify(base).length + 1,
      optionalModelResponseCharacters: JSON.stringify(hint).length + 1,
      label: 'UTF-16 character counts; entrypoints exclude required references, boundaries, task evidence, host discovery, and runtime usage. Response counts use compact JSON plus newline, matching the final CLI serialization.',
    },
  };
});
const fraction = (numerator, denominator) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });
const summarize = selected => Object.fromEntries(['lexical', 'learned'].map(name => {
  const intended = selected.filter(row => !row.mustAbstain);
  const abstain = selected.filter(row => row.mustAbstain);
  const answered = intended.filter(row => !row[name].abstained);
  return [name, {
    top1Accuracy: fraction(intended.filter(row => row[name].top1Correct).length, intended.length),
    top3CandidateRecall: fraction(intended.filter(row => row[name].top3Recall).length, intended.length),
    nonAbstainedCoverage: fraction(answered.length, intended.length),
    conditionalTop1Accuracy: fraction(answered.filter(row => row[name].top1Correct).length, answered.length),
    requiredAbstentionAccuracy: fraction(abstain.filter(row => row[name].abstentionCorrect).length, abstain.length),
    falsePositiveSuggestions: abstain.filter(row => !row[name].abstained).map(row => row.id),
  }];
}));
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const implementationPaths = ['scripts/software-context.mjs', 'scripts/lib/software-context.mjs', 'scripts/evaluate-software-context.mjs'];
const record = {
  schemaVersion: 1,
  study: 'Independent frozen synthetic software skill retrieval evaluation; advisory output only',
  status: 'measured; no activation or efficiency improvement inferred',
  startedAt, baselineStartedAt, baselineCompletedAt, trainingStartedAt, trainingCompletedAt, learnedCompletedAt,
  environment: { node: process.version, platform: process.platform, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() },
  provenance: {
    fixturePath: freeze.fixture, fixtureSha256: freeze.fixtureSha256,
    freezeSha256: sha256(read('docs/examples/software-routing-eval.freeze.json')),
    normativeSourceSha256: freeze.normativeSourceSha256,
    trainingPath, trainingSha256: sha256(trainingText), trainingRows: training.length,
    trainedSkills: [...new Set(training.map(row => row.skill))].sort(),
    modelPath, modelSha256: sha256(readFileSync(modelPath)),
    sourceSha256: baseline[0].sourceSha256,
    implementationSha256: Object.fromEntries(implementationPaths.map(path => [path, sha256(read(path))])),
  },
  controls: {
    baselineRanBeforeTraining: true,
    learnedDisabledInBaseline: true,
    lexicalOutputUnchangedWhenModelEnabled: true,
    overallOutcomeUnchangedWhenModelEnabled: true,
    exactIdOrNormalizedTaskOverlap: overlaps,
    trigramJaccardAtLeastPointEight: nearOverlaps,
    maximumTrigramJaccard,
    leakageLimit: 'No exact or high trigram overlap is not proof of semantic independence. Both corpora are synthetic software intents and share normative skill boundaries; future claims require fresh independently labeled team tasks.',
    noLabelsOrThresholdsTunedToOutcomes: true,
    noLiveProviderCallsOrSkillDispatch: true,
  },
  metrics: {
    overall: summarize(perCase),
    core: summarize(perCase.filter(row => row.group === 'core')),
    neighbor: summarize(perCase.filter(row => row.group === 'neighbor')),
    ambiguous: summarize(perCase.filter(row => row.group === 'ambiguous')),
    outOfDomain: summarize(perCase.filter(row => row.group === 'out-of-domain')),
    top1PairedChanges: {
      learnedWins: perCase.filter(row => !row.mustAbstain && row.learned.top1Correct && !row.lexical.top1Correct).map(row => row.id),
      learnedLosses: perCase.filter(row => !row.mustAbstain && !row.learned.top1Correct && row.lexical.top1Correct).map(row => row.id),
    },
  },
  contextProxy: {
    responseSerialization: 'compact JSON plus trailing newline; matches final CLI. Initial evidence used the earlier pretty-printed CLI serialization and is retained unchanged.',
    baselineMeanCandidateEntrypointCharacters: average(perCase.map(row => row.proxy.baselineCandidateEntrypointCharacters)),
    optionalModelMeanUnionEntrypointCharacters: average(perCase.map(row => row.proxy.optionalModelUnionEntrypointCharacters)),
    allEntrypointCharacters: perCase[0].proxy.allEntrypointCharacters,
    baselineMeanResponseCharacters: average(perCase.map(row => row.proxy.baselineResponseCharacters)),
    optionalModelMeanResponseCharacters: average(perCase.map(row => row.proxy.optionalModelResponseCharacters)),
    interpretation: 'Static context inventory only. Comparing selected entrypoints with eagerly loading every entrypoint is not a measured task or host baseline. Required references, adjudication, retrieval output, and actual tokenizer/provider usage can dominate or erase any reduction. No real token or cost savings measured.',
  },
  limitations: [
    'One independently authored 48-case synthetic fixture; no real software-team distribution or deployment evidence.',
    'Top-3 recall measures candidate inclusion and never successful route selection or domain work.',
    'The learned arm is a separate advisory hint; its metrics do not change the lexical outcome or prove end-to-end dispatch quality.',
    'Abstention is assessed separately from accuracy to expose unnecessary suggestions on ambiguous or unrelated tasks.',
    'The frozen fixture becomes a regression set once outcomes inform implementation changes; use a new hidden evaluation set for another improvement claim.',
    'No language-model behavior, real token consumption, latency, task completion, or post-deployment incident response was measured by this runner.',
  ],
  perCase,
};
const fmt = value => `${value.numerator}/${value.denominator}${value.rate === null ? '' : ` (${(value.rate * 100).toFixed(1)}%)`}`;
const report = [
  '# Software context evaluation — independent frozen synthetic fixture', '',
  `Executed ${learnedCompletedAt} on Node ${process.version}; base commit \`${record.environment.baseCommit}\`.`, '',
  'These results measure candidate retrieval and abstention. They do not establish token savings, automated route correctness, or completed software work.', '',
  '| Population / metric | Lexical baseline | Optional learned hint |',
  '|---|---:|---:|',
  ...['overall', 'core', 'neighbor'].flatMap(group => ['top1Accuracy', 'top3CandidateRecall', 'nonAbstainedCoverage'].map(metric => `| ${group} / ${metric} | ${fmt(record.metrics[group].lexical[metric])} | ${fmt(record.metrics[group].learned[metric])} |`)),
  ...['ambiguous', 'outOfDomain'].map(group => `| ${group} / required abstention | ${fmt(record.metrics[group].lexical.requiredAbstentionAccuracy)} | ${fmt(record.metrics[group].learned.requiredAbstentionAccuracy)} |`), '',
  `The baseline ran before training. Enabling the model left every lexical candidate list and overall outcome unchanged. Exact normalized task/ID overlap: ${overlaps.length}; trigram similarity ≥0.8: ${nearOverlaps.length}; maximum trigram Jaccard: ${maximumTrigramJaccard.toFixed(3)}. These automated checks do not exclude semantic overlap.`, '',
  `Mean candidate-entrypoint inventory: lexical ${record.contextProxy.baselineMeanCandidateEntrypointCharacters.toFixed(0)} characters; optional model union ${record.contextProxy.optionalModelMeanUnionEntrypointCharacters.toFixed(0)}; all entrypoints ${record.contextProxy.allEntrypointCharacters}. Mean full JSON response: lexical ${record.contextProxy.baselineMeanResponseCharacters.toFixed(0)} characters; optional model ${record.contextProxy.optionalModelMeanResponseCharacters.toFixed(0)}. Counts exclude required reference reads and runtime context. Loading all skills is an inventory comparison, not a measured baseline.`, '',
  'The per-case candidate lists, false positives, hashes, control checks, and limitations are in the adjacent JSON record. The fixture and labels were frozen before either corpus comparison or model execution; no labels or thresholds were tuned to pass. Any follow-up that learns from these failures must use fresh unseen requests for an improvement claim.', '',
  'No live provider was called, no domain skill was dispatched by this runner, and no model or prompt change was activated.', '',
  `Reproduce to a new evidence path: \`node scripts/evaluate-software-context.mjs --out /tmp/proof-evaluation-rerun\`. The runner refuses to overwrite prior records.`, '',
];
writeFileSync(`${outputBase}.json`, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
writeFileSync(`${outputBase}.md`, report.join('\n'), { flag: 'wx' });
console.log(JSON.stringify({ output: [`${outputBase}.json`, `${outputBase}.md`], metrics: record.metrics, contextProxy: record.contextProxy }, null, 2));
