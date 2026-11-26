<?php
/*
 * XE-4 (docs/phase-4/P4.12-xe4-explanations.md): export the XE-4 items from production, read only.
 * Scope: docs/phase-4/xe4/scope.json — our explained items of the two topics WG's rv1 gives a new spec version (content_hash must equal
 * the hash our bundle pinned) and the three items rv1 edits (before rv1: rv1's before_hash; after: its after_hash). Same shape as XE-3
 * (tmp/xe4/items.json, topics.json) with every explanation row and its review reasons. Also counts reviewed explanation rows of other
 * items in those topics (rows we did not write would hide too). Records whether rv1 is already applied.
 *
 * Run from the MultiAdmin root: php <repo>/scripts/xe4/export-items.php <repo> [<out dir>]
 * Bank content only: no learner data is read.
 */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = rtrim($argv[1] ?? '', '/') ?: exit("usage: export-items.php <repo>\n");
// Optional second argument: another output folder (check-after.py compares an export taken after rv1 with the expected state).
$out = rtrim($argv[2] ?? "$repo/tmp/xe4", '/');
is_dir($out) || mkdir($out, 0777, true);
$db = Illuminate\Support\Facades\DB::connection('mysql_production');
$db->statement('SET SESSION TRANSACTION READ ONLY');

$scope = json_decode(file_get_contents("$repo/docs/phase-4/xe4/scope.json"), true, 512, JSON_THROW_ON_ERROR);
$expected = array_column($scope['respec'], 'content_hash', 'id');
$edited = collect($scope['edited'])->keyBy('id');
$ids = array_merge(array_keys($expected), $edited->keys()->all());
$servable = array_map(fn ($s) => $s->value, App\Enums\Edu\ContentStatus::servable());
$topics = collect($db->table('edu_topics')->where('learning_language', 'en')->get(['id', 'slug', 'category', 'parent_id', 'cefr_min', 'cefr_max', 'status', 'meta']))->keyBy('id');
$editedState = [];

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
        $problems[] = "content_hash differs from our bundle: {$r->id}";
    }
    if ($edited->has($r->id)) {
        $e = $edited[$r->id];
        $editedState[$r->id] = match ($r->content_hash) { $e['before_hash'] => 'before_rv1', $e['after_hash'] => 'after_rv1', default => 'other' };
        if ($editedState[$r->id] === 'other') {
            $problems[] = "content_hash is neither rv1 before nor after: {$r->id}";
        }
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

// Reviewed explanation rows of other items in the spec topics: they would hide too, so they are reported, not exported.
$specTopicIds = $topics->filter(fn ($t) => isset($scope['spec_updates'][$t->slug]))->keys()->all();
$others = $db->table('edu_item_explanations as x')->join('edu_items as i', 'i.id', '=', 'x.item_id')->whereIn('i.topic_id', $specTopicIds)
    ->whereNotIn('i.id', array_merge($ids, $scope['retired_by_rv1']))->whereNull('i.retired_at')
    ->whereExists(fn ($q) => $q->from('edu_content_reviews as r')->whereColumn('r.entity_id', 'x.id')->where('r.entity_type', 'explanation'))
    ->selectRaw('count(*) as n, count(distinct i.id) as items')->first();
$specVersions = collect($specTopicIds)->mapWithKeys(fn ($id) => [$topics[$id]->slug => (int) $db->table('edu_topic_specs')->where('topic_id', $id)->whereIn('status', $servable)->max('version')])->all();

file_put_contents("$out/items.json", json_encode(['format' => 'xe4-items/1', 'exported_at' => now()->toIso8601String(), 'edited_state' => $editedState, 'spec_versions_now' => $specVersions, 'servable' => $servable,
    'items' => array_values($items)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
file_put_contents("$out/topics.json", json_encode(['format' => 'xe4-topics/1', 'topics' => $usedTopics], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode(['items' => count($items), 'topics' => count($usedTopics), 'problems' => $problems, 'edited_state' => $editedState,
    'spec_versions_now' => $specVersions, 'other_reviewed_rows_in_spec_topics' => ['rows' => (int) $others->n, 'items' => (int) $others->items],
    'with_rows' => count(array_filter($items, fn ($i) => $i['explanations'] !== []))])."\n";
