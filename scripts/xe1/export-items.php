<?php
/*
 * XE-1.0 (docs/phase-4/P4.9-xe1-explanations.md): export the wave-1 items from production, read only.
 * Wave 1 = servable shared en items of the v1 practice types, A2-B2, in the topic trees of the Exams practice skills
 * (MultiAdmin resources/data/exam/practice-topics.v1.json), collocations excluded (they show sense cards).
 *
 * Run from the MultiAdmin root: php <repo>/scripts/xe1/export-items.php <repo>/tmp/xe1
 * Bank content only: no learner data is read.
 */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$out = rtrim($argv[1] ?? '', '/') ?: exit("usage: export-items.php <out-dir>\n");
$db = Illuminate\Support\Facades\DB::connection('mysql_production');
$db->statement('SET SESSION TRANSACTION READ ONLY');

$map = json_decode(file_get_contents(getcwd().'/resources/data/exam/practice-topics.v1.json'), true, 512, JSON_THROW_ON_ERROR);
$types = $map['types'];
$servable = array_map(fn ($s) => $s->value, App\Enums\Edu\ContentStatus::servable());
$topics = collect($db->table('edu_topics')->where('learning_language', 'en')->get(['id', 'slug', 'category', 'parent_id', 'cefr_min', 'cefr_max', 'status', 'meta']))->keyBy('id');
$children = $topics->groupBy('parent_id');
$tree = function (array $ids) use ($children, &$tree): array {
    $all = $ids;
    foreach ($ids as $id) {
        $kids = ($children[$id] ?? collect())->pluck('id')->map(fn ($v) => (int) $v)->all();
        if ($kids) {
            $all = array_merge($all, $tree($kids));
        }
    }

    return array_values(array_unique($all));
};

$items = [];
$topicIds = [];
foreach ($map['skills'] as $skill => $def) {
    if ($skill === 'vocabulary.collocations') {
        continue;
    }
    $roots = $topics->whereIn('slug', $def['topics'])->pluck('id')->map(fn ($v) => (int) $v)->all();
    $ids = $tree($roots);
    $topicIds = array_merge($topicIds, $ids);
    $rows = $db->table('edu_items as i')
        ->where('i.learning_language', 'en')->whereIn('i.status', $servable)->whereNull('i.retired_at')
        ->where('i.visibility', 'shared')->where('i.publication_allowed', 1)->whereIn('i.type', $types)->whereIn('i.cefr', ['A2', 'B1', 'B2'])
        ->where(fn ($q) => $q->whereIn('i.topic_id', $ids)->orWhereExists(fn ($e) => $e->selectRaw('1')->from('edu_item_topics as t')
            ->whereColumn('t.item_id', 'i.id')->whereIn('t.topic_id', $ids)))
        ->get(['i.id', 'i.uuid', 'i.type', 'i.topic_id', 'i.cefr', 'i.payload', 'i.content_hash', 'i.provenance', 'i.source_ref', 'i.status',
            'i.generator_model', 'i.prompt_version', 'i.updated_at']);
    foreach ($rows as $r) {
        $items[$r->id] ??= ['id' => (int) $r->id, 'uuid' => $r->uuid, 'type' => $r->type, 'cefr' => $r->cefr, 'topic_id' => (int) $r->topic_id,
            'topic' => $topics[$r->topic_id]->slug ?? null, 'payload' => json_decode($r->payload, true), 'content_hash' => $r->content_hash,
            'provenance' => $r->provenance, 'source_ref' => $r->source_ref, 'status' => $r->status, 'generator_model' => $r->generator_model,
            'prompt_version' => $r->prompt_version, 'updated_at' => (string) $r->updated_at, 'skills' => []];
        $items[$r->id]['skills'][] = $skill;
    }
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

file_put_contents("$out/items.json", json_encode(['format' => 'xe1-items/1', 'exported_at' => now()->toIso8601String(), 'servable' => $servable,
    'items' => array_values($items)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
file_put_contents("$out/topics.json", json_encode(['format' => 'xe1-topics/1', 'topics' => $usedTopics], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo count($items)." items, ".count($usedTopics)." topics\n";
