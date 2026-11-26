<?php
/*
 * XE-2.0 (docs/phase-4/P4.10-xe2-explanations.md): export the wave-2 items from production, read only.
 * Wave 2 = servable shared en items of grammar topics that wave 1 did not explain: not in the applied XE-1 bundle
 * (MultiAdmin resources/data/edu/explanations-xe1.json) and not rejected by XE-1 (docs/phase-4/xe1/wg-handoff.json; WG repairs them).
 * All types and levels. Output has the same shape as XE-1 (tmp/xe2/items.json, topics.json).
 *
 * Run from the MultiAdmin root: php <repo>/scripts/xe2/export-items.php <repo>/tmp/xe2
 * Bank content only: no learner data is read.
 */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$out = rtrim($argv[1] ?? '', '/') ?: exit("usage: export-items.php <out-dir>\n");
$db = Illuminate\Support\Facades\DB::connection('mysql_production');
$db->statement('SET SESSION TRANSACTION READ ONLY');

$repo = dirname(__DIR__, 2);
$wave1 = array_flip(array_column(json_decode(file_get_contents(getcwd().'/resources/data/edu/explanations-xe1.json'), true, 512, JSON_THROW_ON_ERROR)['items'], 'item_id'));
$rejected = array_flip(array_column(json_decode(file_get_contents($repo.'/docs/phase-4/xe1/wg-handoff.json'), true, 512, JSON_THROW_ON_ERROR)['rejected'], 'id'));
$servable = array_map(fn ($s) => $s->value, App\Enums\Edu\ContentStatus::servable());
$topics = collect($db->table('edu_topics')->where('learning_language', 'en')->get(['id', 'slug', 'category', 'parent_id', 'cefr_min', 'cefr_max', 'status', 'meta']))->keyBy('id');
$grammar = $topics->where('category', 'grammar')->keys()->map(fn ($v) => (int) $v)->all();

$items = [];
$topicIds = [];
$skipped = ['wave1' => 0, 'rejected' => 0];
$rows = $db->table('edu_items as i')
    ->where('i.learning_language', 'en')->whereIn('i.status', $servable)->whereNull('i.retired_at')
    ->where('i.visibility', 'shared')->where('i.publication_allowed', 1)->whereIn('i.topic_id', $grammar)
    ->orderBy('i.id')
    ->get(['i.id', 'i.uuid', 'i.type', 'i.topic_id', 'i.cefr', 'i.payload', 'i.content_hash', 'i.provenance', 'i.source_ref', 'i.status',
        'i.generator_model', 'i.prompt_version', 'i.updated_at']);
foreach ($rows as $r) {
    if (isset($wave1[$r->id]) || isset($rejected[$r->id])) {
        $skipped[isset($wave1[$r->id]) ? 'wave1' : 'rejected']++;
        continue;
    }
    $topicIds[] = (int) $r->topic_id;
    $items[$r->id] = ['id' => (int) $r->id, 'uuid' => $r->uuid, 'type' => $r->type, 'cefr' => $r->cefr, 'topic_id' => (int) $r->topic_id,
        'topic' => $topics[$r->topic_id]->slug ?? null, 'payload' => json_decode($r->payload, true), 'content_hash' => $r->content_hash,
        'provenance' => $r->provenance, 'source_ref' => $r->source_ref, 'status' => $r->status, 'generator_model' => $r->generator_model,
        'prompt_version' => $r->prompt_version, 'updated_at' => (string) $r->updated_at, 'skills' => []];
}
// Extra topic links and existing explanations of the exported items.
foreach (array_chunk(array_keys($items), 1000) as $chunk) {
    foreach ($db->table('edu_item_topics')->whereIn('item_id', $chunk)->get(['item_id', 'topic_id', 'is_primary']) as $t) {
        $items[$t->item_id]['item_topics'][] = ['topic' => $topics[$t->topic_id]->slug ?? null, 'primary' => (bool) $t->is_primary];
        $topicIds[] = (int) $t->topic_id;
    }
    foreach ($db->table('edu_item_explanations')->whereIn('item_id', $chunk)->get(['item_id', 'language', 'text', 'provenance', 'status']) as $x) {
        $items[$x->item_id]['explanations'][$x->language] = ['text' => $x->text, 'provenance' => $x->provenance, 'status' => $x->status];
    }
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

file_put_contents("$out/items.json", json_encode(['format' => 'xe2-items/1', 'exported_at' => now()->toIso8601String(), 'servable' => $servable,
    'items' => array_values($items)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
file_put_contents("$out/topics.json", json_encode(['format' => 'xe2-topics/1', 'topics' => $usedTopics], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo count($items)." items, ".count($usedTopics)." topics, skipped ".json_encode($skipped)."\n";
