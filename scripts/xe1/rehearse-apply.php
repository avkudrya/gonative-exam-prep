<?php

/**
 * XE-1.4 rehearsal (docs/phase-4/P4.9-xe1-explanations.md): exam:apply-explanations --bundle=xe1 on an isolated SQLite copy of exactly
 * what the command reads in production — the wave-1 items, their topics with the reviewed specifications and their existing explanation
 * rows, from the SELECT-only export in tmp/xe1 (items.json, topics.json). No live database, HTTP or AI.
 *
 * 1. SELECT-only preview; a stale token is refused without writes; apply; preview after (existing); replay with zero changes;
 * 2. items, topics and specifications unchanged; explanation rows and reviews exactly as planned; ItemExplanations::current() shows
 *    every bundle text (checked inside the command);
 * 3. timings.
 * Writes docs/phase-4/xe1/apply-rehearsal-php<major.minor>.json.
 *
 * usage: php -d memory_limit=2G scripts/xe1/rehearse-apply.php <MultiAdmin>
 */
declare(strict_types=1);

$backend = realpath($argv[1] ?? '') ?: throw new RuntimeException('usage: rehearse-apply.php <MultiAdmin>');
$root = dirname(__DIR__, 2);
$scratch = sys_get_temp_dir().'/xe1-rehearsal-'.bin2hex(random_bytes(6)).'.sqlite';
touch($scratch);
// Isolation before the app boots: environment variables win over MultiAdmin's .env.
foreach (['DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => $scratch, 'CACHE_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'SESSION_DRIVER' => 'array'] as $k => $v) {
    putenv("{$k}={$v}");
    $_ENV[$k] = $_SERVER[$k] = $v;
}
chdir($backend);
require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\Exam\Explanations\ApplyExplanationsXe1;
use App\Services\Exam\Explanations\ExplanationsBundleXe1;
use Illuminate\Support\Facades\DB;

$db = DB::connection();
if ($db->getDriverName() !== 'sqlite' || realpath($db->getConfig('database')) !== realpath($scratch) || config('database.default') !== 'sqlite') {
    throw new RuntimeException('Not the scratch SQLite: refusing to run.');
}
foreach (['2026_11_15_100000_create_edu_engine_tables.php', '2026_11_16_150000_complete_edu_foundation_tables.php',
    '2026_11_16_190000_add_edu_semantic_reviews_and_private_cache_scope.php'] as $m) {
    (require $backend.'/database/migrations/'.$m)->up();
}

$items = json_decode(file_get_contents($root.'/tmp/xe1/items.json'), true)['items'];
$topics = json_decode(file_get_contents($root.'/tmp/xe1/topics.json'), true)['topics'];
$now = date('Y-m-d H:i:s');
foreach ($topics as $t) {
    DB::table('edu_topics')->insert(['id' => $t['id'], 'learning_language' => 'en', 'slug' => $t['slug'], 'category' => $t['category'], 'parent_id' => null,
        'cefr_min' => $t['cefr'][0], 'cefr_max' => $t['cefr'][1], 'status' => $t['status'], 'provenance' => 'ai_generated', 'meta' => json_encode($t['meta']),
        'created_at' => $now, 'updated_at' => $now]);
    DB::table('edu_topic_specs')->insert(['topic_id' => $t['id'], 'version' => $t['spec']['version'], 'spec' => json_encode($t['spec']['spec'], JSON_UNESCAPED_UNICODE),
        'status' => 'ai_cross_reviewed', 'provenance' => 'ai_generated', 'created_at' => $now, 'updated_at' => $now]);
}
foreach (array_chunk($items, 500) as $chunk) {
    DB::table('edu_items')->insert(array_map(fn ($i) => ['id' => $i['id'], 'uuid' => $i['uuid'], 'learning_language' => 'en', 'type' => $i['type'], 'topic_id' => $i['topic_id'],
        'cefr' => $i['cefr'], 'payload' => json_encode($i['payload'], JSON_UNESCAPED_UNICODE), 'content_hash' => $i['content_hash'], 'provenance' => $i['provenance'],
        'source_ref' => $i['source_ref'], 'status' => $i['status'], 'visibility' => 'shared', 'publication_allowed' => 1, 'generator_model' => $i['generator_model'],
        'prompt_version' => $i['prompt_version'], 'created_at' => $now, 'updated_at' => $now], $chunk));
    $rows = [];
    foreach ($chunk as $i) {
        foreach ($i['explanations'] ?? [] as $lang => $x) {
            $rows[] = ['item_id' => $i['id'], 'language' => $lang, 'text' => $x['text'], 'provenance' => $x['provenance'], 'status' => $x['status'], 'created_at' => $now, 'updated_at' => $now];
        }
    }
    if ($rows) {
        DB::table('edu_item_explanations')->insert($rows);
    }
}

$fingerprint = fn () => [
    'items' => hash('sha256', json_encode(DB::table('edu_items')->orderBy('id')->get(['id', 'content_hash', 'payload', 'status', 'topic_id'])->all())),
    'topics' => hash('sha256', json_encode(DB::table('edu_topics')->orderBy('id')->get()->all())),
    'specs' => hash('sha256', json_encode(DB::table('edu_topic_specs')->orderBy('id')->get()->all())),
];
$before = $fingerprint();
$bundle = ExplanationsBundleXe1::load();
$service = app(ApplyExplanationsXe1::class);
$report = ['php' => PHP_VERSION, 'bundle_sha256' => $bundle['sha256'], 'scope' => ['items' => count($items), 'topics' => count($topics),
    'explanation_rows_before' => DB::table('edu_item_explanations')->count()]];

$t = microtime(true);
$preview = $service->run(false, null, $bundle);
$report['preview'] = $preview + ['seconds' => round(microtime(true) - $t, 1)];
try {
    $service->run(true, str_repeat('0', 64), $bundle);
    $report['stale_token'] = 'NOT REFUSED';
} catch (RuntimeException $e) {
    $report['stale_token'] = $e->getMessage();
}
$report['writes_after_refusal'] = DB::table('edu_content_reviews')->count();
$t = microtime(true);
$applied = $service->run(true, $preview['state_token'], $bundle);
$report['apply'] = $applied + ['seconds' => round(microtime(true) - $t, 1)];
$t = microtime(true);
$after = $service->run(false, null, $bundle);
$report['preview_after'] = ['created' => $after['created'], 'existing' => $after['existing'], 'shown' => $after['shown'], 'seconds' => round(microtime(true) - $t, 1)];
$replay = $service->run(true, $after['state_token'], $bundle);
$report['replay'] = ['created' => $replay['created'], 'existing' => $replay['existing']];
$report['rows_after'] = DB::table('edu_item_explanations')->selectRaw('language, provenance, status, count(*) as n')->groupBy('language', 'provenance', 'status')
    ->orderBy('language')->orderBy('provenance')->get()->map(fn ($r) => (array) $r)->all();
$report['reviews_after'] = DB::table('edu_content_reviews')->selectRaw('reason, status, count(*) as n')->groupBy('reason', 'status')->get()->map(fn ($r) => (array) $r)->all();
$report['unchanged'] = $before === $fingerprint() ? 'items, topics and specifications unchanged' : 'CHANGED';

$v = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;
file_put_contents($root."/docs/phase-4/xe1/apply-rehearsal-php{$v}.json", json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)."\n");
unlink($scratch);
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
