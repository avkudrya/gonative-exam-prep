<?php
/*
 * XE-3 (docs/phase-4/P4.11-xe3-explanations.md): export the XE-3 items from production, read only.
 * Scope: docs/phase-4/xe3/scope.json — the items WG repaired (each must have WG's new content_hash), the XE-1 items whose gap may also
 * stay empty, and #422 (teacher typo). The same shape as XE-2 (tmp/xe3/items.json, topics.json); every explanation row of the items
 * is exported with its id, so the bundle can pin what it replaces.
 *
 * Run from the MultiAdmin root: php <repo>/scripts/xe3/export-items.php <repo>
 * Bank content only: no learner data is read.
 */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = rtrim($argv[1] ?? '', '/') ?: exit("usage: export-items.php <repo>\n");
$out = "$repo/tmp/xe3";
$db = Illuminate\Support\Facades\DB::connection('mysql_production');
$db->statement('SET SESSION TRANSACTION READ ONLY');

$scope = json_decode(file_get_contents("$repo/docs/phase-4/xe3/scope.json"), true, 512, JSON_THROW_ON_ERROR);
$expected = array_column($scope['edited'], 'content_hash', 'id');
$ids = array_merge(array_keys($expected), $scope['optional_word_xe1'], $scope['empty_ok_rewrite_xe1'], array_column($scope['typo_fix'], 'id'));
$servable = array_map(fn ($s) => $s->value, App\Enums\Edu\ContentStatus::servable());
$topics = collect($db->table('edu_topics')->where('learning_language', 'en')->get(['id', 'slug', 'category', 'parent_id', 'cefr_min', 'cefr_max', 'status', 'meta']))->keyBy('id');

$items = [];
$topicIds = [];
$problems = [];
$rows = $db->table('edu_items as i')->whereIn('i.id', $ids)->orderBy('i.id')
    ->get(['i.id', 'i.uuid', 'i.type', 'i.topic_id', 'i.cefr', 'i.payload', 'i.content_hash', 'i.provenance', 'i.source_ref', 'i.status',
        'i.generator_model', 'i.prompt_version', 'i.updated_at', 'i.retired_at', 'i.visibility', 'i.publication_allowed', 'i.learning_language']);
foreach ($rows as $r) {
    if (! in_array($r->status, $servable, true) || $r->retired_at !== null || $r->visibility !== 'shared' || ! $r->publication_allowed || $r->learning_language !== 'en') {
        $problems[] = "not servable: {$r->id}";
    }
    if (isset($expected[$r->id]) && $expected[$r->id] !== $r->content_hash) {
        $problems[] = "content_hash differs from WG's receipt: {$r->id}";
    }
    $topicIds[] = (int) $r->topic_id;
    $items[$r->id] = ['id' => (int) $r->id, 'uuid' => $r->uuid, 'type' => $r->type, 'cefr' => $r->cefr, 'topic_id' => (int) $r->topic_id,
        'topic' => $topics[$r->topic_id]->slug ?? null, 'payload' => json_decode($r->payload, true), 'content_hash' => $r->content_hash,
        'provenance' => $r->provenance, 'source_ref' => $r->source_ref, 'status' => $r->status, 'generator_model' => $r->generator_model,
        'prompt_version' => $r->prompt_version, 'updated_at' => (string) $r->updated_at, 'skills' => [], 'explanations' => []];
}
foreach (array_diff($ids, array_keys($items)) as $missing) {
    $problems[] = "missing: $missing";
}
foreach ($db->table('edu_item_topics')->whereIn('item_id', $ids)->get(['item_id', 'topic_id', 'is_primary']) as $t) {
    $items[$t->item_id]['item_topics'][] = ['topic' => $topics[$t->topic_id]->slug ?? null, 'primary' => (bool) $t->is_primary];
    $topicIds[] = (int) $t->topic_id;
}
foreach ($db->table('edu_item_explanations')->whereIn('item_id', $ids)->orderBy('id')->get(['id', 'item_id', 'language', 'text', 'provenance', 'status']) as $x) {
    $items[$x->item_id]['explanations'][$x->language] = ['row_id' => (int) $x->id, 'text' => $x->text, 'provenance' => $x->provenance, 'status' => $x->status,
        'reviews' => $db->table('edu_content_reviews')->where('entity_type', 'explanation')->where('entity_id', $x->id)->orderBy('id')->pluck('reason')->all()];
}
// The specification the explanation is checked against: the latest servable version, without review-only sections and
// grounding fields — the same view as Edu\Generation\ReferenceBuilder::spec().
$spec = function (int $topicId) use ($db, $servable): ?array {
    $row = $db->table('edu_topic_specs')->where('topic_id', $topicId)->whereIn('status', $servable)->orderByDesc('version')->first(['version', 'spec']);
    if (! $row) {
        return null;
    }
    $data = array_diff_key(json_decode($row->spec, true), array_flip(['format', 'coverage_notes', 'terminology']));
    foreach ($data as $section => $entries) {
        if (is_array($entries) && array_is_list($entries)) {
            $data[$section] = array_map(fn ($e) => is_array($e) ? array_diff_key($e, array_flip(['source_quote', 'added'])) : $e, $entries);
        }
    }

    return ['version' => (int) $row->version, 'spec' => $data];
};
$usedTopics = $topics->only(array_values(array_unique($topicIds)))->map(fn ($t) => ['id' => (int) $t->id, 'slug' => $t->slug, 'category' => $t->category,
    'parent' => $t->parent_id ? ($topics[$t->parent_id]->slug ?? null) : null, 'cefr' => [$t->cefr_min, $t->cefr_max], 'status' => $t->status,
    'meta' => json_decode((string) $t->meta, true), 'spec' => $spec((int) $t->id)])->values();

file_put_contents("$out/items.json", json_encode(['format' => 'xe3-items/1', 'exported_at' => now()->toIso8601String(), 'servable' => $servable,
    'items' => array_values($items)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
file_put_contents("$out/topics.json", json_encode(['format' => 'xe3-topics/1', 'topics' => $usedTopics], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode(['items' => count($items), 'topics' => count($usedTopics), 'problems' => $problems,
    'with_rows' => count(array_filter($items, fn ($i) => $i['explanations'] !== []))])."\n";
