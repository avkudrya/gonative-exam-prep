<?php

/*
 * One paid call: semantic review of an assessment guide by a second vendor (P1.1).
 * Runs inside MultiAdmin so the call goes through MeteredLlm with the Exams keys and is
 * recorded in ai_usage_events (feature `exam`) of the local database.
 *
 *   php benchmarks/guide-review/run.php <review-dir> <MultiAdmin path> --approved-cap=<capUsd>
 *
 * Refuses to run without the owner's cap from the manifest, when the guide changed since the
 * manifest, or when the review already has a response.
 */

use App\Services\Edu\Ai\LlmRequest;
use App\Services\Edu\Ai\MeteredLlm;
use App\Services\Edu\Ai\ModelRouter;

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
    fwrite(STDERR, "usage: php run.php <review-dir> <MultiAdmin path> --approved-cap=<usd>\n");
    exit(2);
}

$repo = dirname(__DIR__, 2);
$manifest = json_decode(file_get_contents("{$dir}/manifest.json"), true, flags: JSON_THROW_ON_ERROR);
$guidePath = "{$repo}/{$manifest['guide']}";

if ($approved === null || abs($approved - (float) $manifest['capUsd']) > 1e-9) {
    fail("Owner approval needed: pass --approved-cap={$manifest['capUsd']} (manifest capUsd).");
}
if (hash_file('sha256', $guidePath) !== $manifest['guideSha256']) {
    fail('The guide changed since the manifest: update guideSha256 and the estimate first.');
}
if (file_exists("{$dir}/response.json")) {
    fail('This review already has a response.json; a new review needs a new directory.');
}
$route = $manifest['route'];
$p = $manifest['pricingUsdPerMillion'];
$maxUsd = ($manifest['estimate']['inputTokens'] * $p['input'] + $route['max_output_tokens'] * $p['output']) / 1e6;
if ($maxUsd > $manifest['capUsd']) {
    fail(sprintf('Worst case $%.2f exceeds the cap $%.2f.', $maxUsd, $manifest['capUsd']));
}

require "{$multiAdmin}/vendor/autoload.php";
$app = require "{$multiAdmin}/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$computation = 'For each criterion: low = the highest band reached by climbing from band 4 while every feature of each band is true '
    .'(none → floor band 3); high = the highest band whose features are all true, or low + 1 when that next band misses exactly one feature; '
    .'every limiter answered true caps both low and high at its capBand. The criterion result is the range low..high; the task score is '
    .'the mean of the four criteria, shown to users only as a coarse approximate range.';

$llm = app(MeteredLlm::class)->forProduct($manifest['product'])
    ->withRouter(ModelRouter::fromConfig()->withRoutes([$manifest['task'] => $route]));
$request = new LlmRequest(
    task: $manifest['task'],
    language: 'en',
    system: file_get_contents("{$dir}/system.txt"),
    user: json_encode(['computation' => $computation, 'guide' => json_decode(file_get_contents($guidePath), true)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
    schema: json_decode(file_get_contents("{$dir}/schema.json"), true),
    schemaName: 'guide_review',
    promptVersion: 'guide-review-1',
    singleAttempt: true,
);

$response = $llm->call($request);

file_put_contents("{$dir}/response.json", json_encode($response->data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n");
file_put_contents("{$dir}/receipt.json", json_encode([
    'date' => date('c'),
    'model' => $response->model,
    'inputTokens' => $response->usage->inputTokens,
    'outputTokens' => $response->usage->outputTokens,
    'reasoningTokens' => $response->usage->reasoningTokens,
    'costUsd' => round($response->costUsd, 4),
    'aiUsageEventId' => $response->usageEventId,
    'guideSha256' => $manifest['guideSha256'],
], JSON_PRETTY_PRINT)."\n");
printf("done: %s, $%.4f, %d items\n", $response->model, $response->costUsd, count($response->data['items'] ?? []));
