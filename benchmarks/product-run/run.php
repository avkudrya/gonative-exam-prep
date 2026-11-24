<?php

/*
 * Paid run of the PRODUCT assessment pipeline on synthetic benchmark essays (P2.8): the real path
 * (attempt → submit with quota admission → AttemptAssessment) of a local MultiAdmin sandbox, for a
 * test account. Spend is recorded in ai_usage_events (feature `exam`) and ex_assessments.
 *
 *   php benchmarks/product-run/run.php <run-dir> <MultiAdmin path> [--approved-cap=<capUsd>]
 *
 * Without --approved-cap: dry run (cases, sizes, worst case; no call, no write). With it: refuses
 * unless it equals the config's capUsd, the dataset is unchanged and the database is the local
 * sandbox; stops before a case whose worst case would pass the cap. Raw results (quotes of the
 * synthetic essays, model text) go to <run-dir>/responses/ (not committed); metrics.json is.
 */

use App\Models\Multi\Exam\Assessment;
use App\Models\Multi\Exam\Profile;
use App\Models\Multi\Front\User;
use App\Services\Exam\Api\ExamPresenter;
use App\Services\Exam\Assessment\AttemptAssessment;
use App\Services\Exam\Attempts\ExamAttempts;
use App\Services\Exam\Attempts\SubmitAttempt;
use App\Services\Products\Accounts\ProductGrants;
use App\Services\Products\ProductConfig;

function fail(string $message): never
{
    fwrite(STDERR, $message."\n");
    exit(1);
}

[$self, $dir, $multiAdmin] = $argv + [null, null, null];
$approved = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--approved-cap=')) {
        $approved = (float) substr($arg, strlen('--approved-cap='));
    }
}
if (!$dir || !$multiAdmin || !is_dir($dir) || !is_file("{$multiAdmin}/artisan")) {
    fwrite(STDERR, "usage: php run.php <run-dir> <MultiAdmin path> [--approved-cap=<usd>]\n");
    exit(2);
}
$repo = dirname(__DIR__, 2);
$config = json_decode(file_get_contents("{$dir}/config.json"), true, flags: JSON_THROW_ON_ERROR);
$datasetPath = "{$repo}/{$config['dataset']}";
if (hash_file('sha256', $datasetPath) !== $config['datasetSha256']) {
    fail('The dataset changed since the config: update datasetSha256 first.');
}
$items = [];
foreach (file($datasetPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $item = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
    $items[$item['id']] = $item;
}

/** The essay of a case; an added injection becomes its own paragraph after the given one. */
function essay(array $case, array $items): string
{
    $text = $items[$case['item']]['text'] ?? fail("Unknown item {$case['item']}");
    if (isset($case['insert'])) {
        $paragraphs = preg_split('/\n\s*\n/', $text);
        array_splice($paragraphs, $case['insert']['afterParagraph'], 0, [$case['insert']['text']]);
        $text = implode("\n\n", $paragraphs);
    }

    return $text;
}

$cases = $config['cases'];
$worst = (float) $config['perAssessmentWorstUsd'];
printf("run %s: %d cases (%s), worst case $%.2f each, expected ≈ $%.2f, cap $%.2f\n", $config['runId'], count($cases),
    implode(', ', array_map(fn ($l) => $l.' '.count(array_filter($cases, fn ($c) => $c['feedback'] === $l)), ['ru', 'en'])),
    $worst, count($cases) * $config['expectedUsdPerAssessment'], $config['capUsd']);
foreach ($cases as $case) {
    $text = essay($case, $items);
    printf("  %-22s %-30s %s %4d words%s\n", $case['id'], $case['item'], $case['feedback'], count(preg_split('/\s+/u', trim($text))), isset($case['injection']) ? ' injection' : '');
}
if ($approved === null) {
    echo "Dry run only. Pass --approved-cap={$config['capUsd']} after the owner's approval.\n";
    exit(0);
}
if (abs($approved - (float) $config['capUsd']) > 1e-9) {
    fail("Owner approval needed: pass --approved-cap={$config['capUsd']} (config capUsd).");
}
if (is_file("{$dir}/responses/summary.json")) {
    fail('This run already has results; a new run needs a new directory.');
}

require "{$multiAdmin}/vendor/autoload.php";
$app = require "{$multiAdmin}/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$db = config('database.connections.'.config('database.default'));
if (($db['host'] ?? null) !== '127.0.0.1' || (string) ($db['port'] ?? '') !== '3306' || ($db['database'] ?? null) !== 'multi' || ($db['username'] ?? null) !== 'multiadmin_local') {
    fail('The database is not the local sandbox; refusing to run.');
}
// The job only calls AttemptAssessment::execute(); run it inline and queue nothing.
config(['queue.connections.exam' => ['driver' => 'null'], 'exam.assessment.enabled' => true]);

$user = User::whereRaw('LOWER(email) = ?', [strtolower($config['account'])])->firstOrFail();
$product = ProductConfig::for('exams');
$grants = app(ProductGrants::class);
if (!$grants->active((int) $user->id, $product)->exists()) {
    $grants->grant($user, $product, 1, ['granted_by' => 'benchmarks/product-run', 'run' => $config['runId']]);
}
$profile = Profile::findOrFail($user->id);
$original = $profile->feedback_language;

@mkdir("{$dir}/responses", 0775, true);
$spent = 0.0;
$results = [];
try {
    foreach ($cases as $case) {
        if ($spent + $worst > $config['capUsd']) {
            echo "stop: spent $".round($spent, 4)." + worst $worst would pass the cap\n";
            break;
        }
        $item = $items[$case['item']];
        Profile::whereKey($user->id)->update(['feedback_language' => $case['feedback']]);
        $attempt = app(ExamAttempts::class)->create($user, ['exam_key' => $item['examKey'], 'custom_prompt' => $item['prompt']]);
        $attempt = app(ExamAttempts::class)->saveDraft($user, $attempt->uuid, 0, essay($case, $items));
        $started = microtime(true);
        $submitted = app(SubmitAttempt::class)->submit($user, $attempt->uuid, $config['runId'].'-'.$case['id']);
        if ($submitted['reused']) {
            fail("{$case['id']}: reused an earlier result; use a new account or run id");
        }
        app(AttemptAssessment::class)->execute($submitted['assessment']->id);
        $assessment = Assessment::findOrFail($submitted['assessment']->id);
        $spent += (float) $assessment->cost_usd;
        // The model's own criterion reasons, before ResultMapper removes score sentences (ScoreMentions).
        $parent = App\Models\Multi\Edu\GenerationRun::find($assessment->generation_run_id);
        $raw = Illuminate\Support\Facades\DB::table('edu_generation_steps')->whereIn('run_id', $parent->progress['children'] ?? [])->where('step', 'assess')
            ->pluck('output')->map(fn ($o) => json_decode((string) $o, true)['data']['reason'] ?? null)->filter()->values()->all();
        $scoreClass = 'App\\Services\\Exam\\Assessment\\ScoreMentions';
        $row = ['case' => $case, 'uuid' => $assessment->uuid, 'status' => $assessment->status, 'cost_usd' => (float) $assessment->cost_usd,
            'raw_reasons' => $raw, 'raw_reasons_with_score' => class_exists($scoreClass) ? count(array_filter($raw, fn ($r) => $scoreClass::has($r))) : null,
            'reserved_usd' => (float) $assessment->reserved_usd, 'seconds' => round(microtime(true) - $started, 1),
            'result' => $assessment->result, 'presented' => app(ExamPresenter::class)->assessment($assessment)];
        file_put_contents("{$dir}/responses/{$case['id']}.json", json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n");
        $results[] = $row;
        printf("%-22s %-8s $%.4f %5.1fs total $%.4f\n", $case['id'], $assessment->status, $assessment->cost_usd, $row['seconds'], $spent);
    }
} finally {
    Profile::whereKey($user->id)->update(['feedback_language' => $original]);
}
file_put_contents("{$dir}/responses/summary.json", json_encode(['date' => date('c'), 'spentUsd' => round($spent, 4), 'count' => count($results)], JSON_PRETTY_PRINT)."\n");
printf("done: %d assessments, $%.4f\n", count($results), $spent);
