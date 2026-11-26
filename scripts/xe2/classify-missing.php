<?php
/*
 * XE-2.3 (docs/phase-4/P4.10-xe2-explanations.md): which "missing" answers Opus listed are already accepted in production.
 * WG (2026-11-26) found that XE-1's list counted contractions and full forms that Edu's English profile already treats as the same
 * answer. Each missing answer is compared with the item's accepted answers through EnglishProfile::answersEquivalent (what
 * AnswerChecker uses for typed answers); closed items (multiple_choice, gap_choice) cannot take a new answer and are listed apart.
 * No database: the items come from the SELECT-only export.
 *
 * Run from the MultiAdmin root: php <repo>/scripts/xe2/classify-missing.php <repo>/tmp/xe2
 */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$dir = rtrim($argv[1] ?? '', '/') ?: exit("usage: classify-missing.php <tmp/xe2>\n");
$items = [];
foreach (json_decode(file_get_contents("$dir/items.json"), true)['items'] as $i) {
    $items[$i['id']] = $i;
}
// The same profile AnswerChecker::profile() resolves.
$profile = App\Services\Edu\Languages\LanguageRegistry::fromConfig()->get('en');
$accepted = function (array $i): array {
    $p = $i['payload'];

    return match ($i['type']) {
        'gap_fill' => array_merge(...array_map(fn ($g) => $g['accepted'], $p['gaps'])),
        'word_forms' => array_merge(...array_map(fn ($f) => $f['accepted'], $p['fields'])),
        'error_correction' => array_merge(...array_map(fn ($e) => $e['corrections'], $p['errors'])),
        'transformation', 'ordering' => $p['accepted'],
        default => [],
    };
};
$out = ['already_accepted' => [], 'closed_item' => [], 'to_add' => []];
foreach (json_decode(file_get_contents("$dir/opus-checked.json"), true)['accepted_missing'] as $m) {
    $i = $items[$m['id']];
    if (in_array($i['type'], ['multiple_choice', 'gap_choice'], true)) {
        $out['closed_item'][] = $m + ['type' => $i['type']];
        continue;
    }
    $same = null;
    foreach ($accepted($i) as $a) {
        // Ordering and transformation answers are whole sentences: the final full stop is ignored, as in the checker.
        if ($profile->answersEquivalent(rtrim($m['missing'], '.'), rtrim($a, '.'))) {
            $same = $a;
            break;
        }
    }
    $out[$same === null ? 'to_add' : 'already_accepted'][] = $m + ['type' => $i['type']] + ($same === null ? [] : ['same_as' => $same]);
}
file_put_contents("$dir/missing-classified.json", json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo json_encode(array_map('count', $out)), "\n";
