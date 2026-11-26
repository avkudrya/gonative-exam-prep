<?php

/*
 * Clean base reports for the Academic Task 1 benchmark set S-T1 (P5.4; the P1.4 protocol of benchmarks/s-bases): one vendor
 * writes each report on one of our tasks (instruction, data tables, code facts), the other proofreads it and checks the data. Runs inside MultiAdmin so every call goes through MeteredLlm with the
 * Exams keys and is recorded in ai_usage_events (feature `exam`) of the local database.
 *
 *   php benchmarks/t1-bases/run.php <MultiAdmin path>                          dry run: plan and estimate
 *   php benchmarks/t1-bases/run.php <MultiAdmin path> --apply --approved-cap=<capUsd>
 *
 * Resumable: bases already in the output file are skipped. Before every call the worst
 * case of that call is checked against what is left of the cap; the run stops instead of
 * going over. Results: benchmarks/sources/t1a-bases.jsonl (synthetic text, committed) and
 * receipt.json (every call with tokens and cost).
 */

use App\Services\Edu\Ai\LlmRequest;
use App\Services\Edu\Ai\MeteredLlm;
use App\Services\Edu\Ai\ModelPricing;
use App\Services\Edu\Ai\ModelRouter;

function fail(string $message): never
{
    fwrite(STDERR, $message."\n");
    exit(1);
}

$multiAdmin = $argv[1] ?? null;
$apply = in_array('--apply', $argv, true);
$approved = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--approved-cap=')) {
        $approved = (float) substr($arg, strlen('--approved-cap='));
    }
}
if (!$multiAdmin || !is_file("{$multiAdmin}/artisan")) {
    fwrite(STDERR, "usage: php run.php <MultiAdmin path> [--apply --approved-cap=<usd>]\n");
    exit(2);
}

$dir = __DIR__;
$repo = dirname(__DIR__, 2);
$manifest = json_decode(file_get_contents("{$dir}/manifest.json"), true, flags: JSON_THROW_ON_ERROR);
// The task as the writer and the checker see it: the instruction, the data as tables and the code facts (the reviewed input).
$prompts = array_column(json_decode(file_get_contents("{$repo}/{$manifest['reviewInput']}"), true, flags: JSON_THROW_ON_ERROR)['items'], null, 'id');
$instructions = array_column(json_decode(file_get_contents("{$repo}/{$manifest['tasks']}"), true, flags: JSON_THROW_ON_ERROR)['items'], 'instruction', 'id');
$taskView = fn (string $id) => ['instruction' => $instructions[$id], 'visuals' => $prompts[$id]['charts']];
$outPath = "{$repo}/{$manifest['output']}";
$receiptPath = "{$dir}/receipt.json";
$cap = (float) $manifest['capUsd'];
if ($apply && ($approved === null || abs($approved - $cap) > 1e-9)) {
    fail("Owner approval needed: pass --approved-cap={$cap} (manifest capUsd).");
}

require "{$multiAdmin}/vendor/autoload.php";
$app = require "{$multiAdmin}/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$done = [];
if (is_file($outPath)) {
    foreach (array_filter(explode("\n", file_get_contents($outPath))) as $line) {
        $done[json_decode($line, true)['id']] = true;
    }
}
$receipt = is_file($receiptPath) ? json_decode(file_get_contents($receiptPath), true) : ['calls' => [], 'totalUsd' => 0.0];
$writeSystem = file_get_contents("{$dir}/write.txt");
$checkSystem = file_get_contents("{$dir}/check.txt");
$writeSchema = ['type' => 'object', 'additionalProperties' => false, 'required' => ['report'], 'properties' => ['report' => ['type' => 'string']]];
$checkSchema = ['type' => 'object', 'additionalProperties' => false, 'required' => ['clean', 'issues'], 'properties' => [
    'clean' => ['type' => 'boolean'],
    'issues' => ['type' => 'array', 'items' => ['type' => 'object', 'additionalProperties' => false,
        'required' => ['quote', 'correction', 'reason', 'kind'], 'properties' => [
            'quote' => ['type' => 'string'], 'correction' => ['type' => 'string'], 'reason' => ['type' => 'string'],
            'kind' => ['type' => 'string', 'enum' => ['grammar', 'spelling', 'punctuation', 'word_choice', 'phrasing', 'data']],
        ]]],
]];

$pricing = ModelPricing::fromConfig();
$other = fn (string $provider) => $provider === 'anthropic' ? 'openai' : 'anthropic';
$worst = function (array $route, int $inputChars) use ($pricing): float {
    $usd = $pricing->estimateMax($route['model'], $inputChars, $route['max_output_tokens']);
    if ($usd === null) {
        fail("No price for {$route['model']}: add it to config/edu_models.php pricing first.");
    }

    return $usd;
};
$essayChars = 1500; // ~200 words
$pending = array_values(array_filter($manifest['items'], fn ($i) => !isset($done[$i['id']])));
$worstTotal = 0.0;
foreach ($pending as $item) {
    $promptChars = mb_strlen(json_encode($taskView($item['taskId']), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    $worstTotal += $worst($manifest['routes'][$item['author']], mb_strlen($writeSystem) + $promptChars + 40)
        + $worst($manifest['routes'][$other($item['author'])], mb_strlen($checkSystem) + $promptChars + $essayChars + 40);
}
printf("Bases: %d planned, %d done, %d pending; worst case for pending $%.2f; spent so far $%.4f of cap $%.2f\n",
    count($manifest['items']), count($done), count($pending), $worstTotal, $receipt['totalUsd'], $cap);
if (!$apply) {
    echo "Dry run: no AI calls. A paid run needs --apply --approved-cap={$cap}.\n";
    exit(0);
}

$call = function (string $id, string $step, array $route, string $system, array $user, array $schema, string $name) use (&$receipt, $receiptPath, $cap, $worst, $manifest) {
    $userJson = json_encode($user, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $max = $worst($route, mb_strlen($system) + mb_strlen($userJson));
    if ($receipt['totalUsd'] + $max > $cap) {
        return null;
    }
    $task = "exam.t1_base_{$step}";
    $llm = app(MeteredLlm::class)->forProduct($manifest['product'])
        ->withRouter(ModelRouter::fromConfig()->withRoutes([$task => $route]));
    $response = $llm->call(new LlmRequest(
        task: $task, language: 'en', system: $system, user: $userJson, schema: $schema, schemaName: $name,
        promptVersion: $manifest['promptVersions'][$step], singleAttempt: true,
    ));
    $receipt['calls'][] = ['id' => $id, 'step' => $step, 'model' => $response->model, 'inputTokens' => $response->usage->inputTokens,
        'outputTokens' => $response->usage->outputTokens, 'reasoningTokens' => $response->usage->reasoningTokens,
        'costUsd' => round($response->costUsd, 5), 'aiUsageEventId' => $response->usageEventId, 'date' => date('c')];
    $receipt['totalUsd'] = round($receipt['totalUsd'] + $response->costUsd, 5);
    file_put_contents($receiptPath, json_encode($receipt, JSON_PRETTY_PRINT)."\n");

    return $response;
};

foreach ($pending as $item) {
    $question = $taskView($item['taskId']);
    $writer = $manifest['routes'][$item['author']];
    $checker = $manifest['routes'][$other($item['author'])];
    try {
        $written = $call($item['id'], 'write', $writer, $writeSystem, ['task' => $question], $writeSchema, 'base_report');
        if ($written === null) {
            echo "Cap reached before {$item['id']}: stopping.\n";
            break;
        }
        $essay = (string) ($written->data['report'] ?? '');
        $checked = $call($item['id'], 'check', $checker, $checkSystem, ['task' => $question, 'report' => $essay], $checkSchema, 'base_check');
        if ($checked === null) {
            echo "Cap reached before checking {$item['id']}: stopping (its essay is not kept).\n";
            break;
        }
    } catch (Throwable $e) {
        fwrite(STDERR, "{$item['id']}: ".$e->getMessage()."\n");
        continue;
    }
    $record = ['id' => $item['id'], 'taskId' => $item['taskId'],
        'author' => ['provider' => $writer['provider'], 'model' => $written->model], 'text' => $essay,
        'check' => ['provider' => $checker['provider'], 'model' => $checked->model, 'clean' => (bool) ($checked->data['clean'] ?? false) && ($checked->data['issues'] ?? []) === [],
            'issues' => $checked->data['issues'] ?? []]];
    file_put_contents($outPath, json_encode($record, JSON_UNESCAPED_UNICODE)."\n", FILE_APPEND);
    printf("  %s %-9s %4d words  %s  $%.4f\n", $item['id'], $item['author'], str_word_count($essay),
        $record['check']['clean'] ? 'clean' : count($record['check']['issues']).' issue(s)', $receipt['totalUsd']);
}
printf("Spent $%.4f of $%.2f.\n", $receipt['totalUsd'], $cap);
