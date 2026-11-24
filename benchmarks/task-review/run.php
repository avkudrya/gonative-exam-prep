<?php

/*
 * One paid call: review of our own Task 2 practice prompts by a second vendor (P2.8).
 * Runs inside MultiAdmin so the call goes through MeteredLlm with the Exams keys and is
 * recorded in ai_usage_events (feature `exam`) of the local database.
 *
 *   php benchmarks/task-review/run.php <review-dir> <MultiAdmin path> --approved-cap=<capUsd>
 *
 * Without --approved-cap it only prints the request size and the worst case (no call).
 * Refuses to call without the owner's cap from the manifest, when the prompts changed since the
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
    fwrite(STDERR, "usage: php run.php <review-dir> <MultiAdmin path> [--approved-cap=<usd>]\n");
    exit(2);
}

$repo = dirname(__DIR__, 2);
$manifest = json_decode(file_get_contents("{$dir}/manifest.json"), true, flags: JSON_THROW_ON_ERROR);
$sourcePath = "{$repo}/{$manifest['source']}";
if (hash_file('sha256', $sourcePath) !== $manifest['sourceSha256']) {
    fail('The prompts changed since the manifest: update sourceSha256 and the estimate first.');
}
$source = json_decode(file_get_contents($sourcePath), true, flags: JSON_THROW_ON_ERROR);
$user = json_encode(['prompts' => array_map(fn ($p) => ['id' => $p['id'], 'type' => $p['type'], 'text' => $p['text']], $source['prompts'])],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$system = file_get_contents("{$dir}/system.txt");
$schema = file_get_contents("{$dir}/schema.json");
$route = $manifest['route'];
$p = $manifest['pricingUsdPerMillion'];
// About 4 characters per token, plus the schema; the call is refused if the worst case exceeds the cap.
$inputTokens = (int) ceil((strlen($system) + strlen($user) + strlen($schema)) / 4);
$maxUsd = ($inputTokens * $p['input'] + $route['max_output_tokens'] * $p['output']) / 1e6;
printf("prompts: %d, input ≈ %d tokens, worst case $%.3f, cap $%.2f\n", count($source['prompts']), $inputTokens, $maxUsd, $manifest['capUsd']);
if ($maxUsd > $manifest['capUsd']) {
    fail(sprintf('Worst case $%.2f exceeds the cap $%.2f.', $maxUsd, $manifest['capUsd']));
}
if ($approved === null) {
    echo "Dry run only. Pass --approved-cap={$manifest['capUsd']} after the owner's approval.\n";
    exit(0);
}
if (abs($approved - (float) $manifest['capUsd']) > 1e-9) {
    fail("Owner approval needed: pass --approved-cap={$manifest['capUsd']} (manifest capUsd).");
}
if (file_exists("{$dir}/response.json")) {
    fail('This review already has a response.json; a new review needs a new directory.');
}

require "{$multiAdmin}/vendor/autoload.php";
$app = require "{$multiAdmin}/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$llm = app(MeteredLlm::class)->forProduct($manifest['product'])
    ->withRouter(ModelRouter::fromConfig()->withRoutes([$manifest['task'] => $route]));
$response = $llm->call(new LlmRequest(
    task: $manifest['task'],
    language: 'en',
    system: $system,
    user: $user,
    schema: json_decode($schema, true),
    schemaName: 'task_review',
    promptVersion: 'task-review-1',
    singleAttempt: true,
));

file_put_contents("{$dir}/response.json", json_encode($response->data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n");
file_put_contents("{$dir}/receipt.json", json_encode([
    'date' => date('c'),
    'model' => $response->model,
    'inputTokens' => $response->usage->inputTokens,
    'outputTokens' => $response->usage->outputTokens,
    'reasoningTokens' => $response->usage->reasoningTokens,
    'costUsd' => round($response->costUsd, 4),
    'aiUsageEventId' => $response->usageEventId,
    'sourceSha256' => $manifest['sourceSha256'],
], JSON_PRETTY_PRINT)."\n");
printf("done: %s, $%.4f, %d items\n", $response->model, $response->costUsd, count($response->data['items'] ?? []));
