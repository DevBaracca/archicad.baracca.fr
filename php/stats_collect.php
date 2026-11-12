<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Collecteur central de métriques multi-sites : les autres sites baracca.fr
 * (invest, blog, dev…) envoient leurs événements ici en POST serveur -> serveur
 * avec le jeton partagé ARCHICAD_STATS_COLLECT_TOKEN (voir config.php).
 * Chaque événement est ajouté à data/metriques.jsonl avec les champs
 * site / event / user / detail, puis agrégé par site dans le tableau de bord
 * (includes/stats.php -> archicad_stats_collect()).
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Accepte du JSON (php://input) ou des champs de formulaire
$payload = json_decode((string) file_get_contents('php://input'), true);
$src = is_array($payload) ? $payload : $_POST;
$token  = (string) ($src['token'] ?? '');
$site   = (string) ($src['site'] ?? '');
$event  = (string) ($src['event'] ?? '');
$user   = (string) ($src['user'] ?? '');
$detail = (string) ($src['detail'] ?? '');

$sitesOk  = ['configurateur', 'invest', 'blog', 'dev'];
$eventsOk = ['login', 'vue', 'telechargement', 'contact', 'newsletter', 'demande', 'config', 'soumission'];

if ($token === '' || !hash_equals(ARCHICAD_STATS_COLLECT_TOKEN, $token)
    || !in_array($site, $sitesOk, true) || !in_array($event, $eventsOk, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Accès refusé.']);
    exit;
}

if (!is_dir(ARCHICAD_DATA_DIR)) {
    mkdir(ARCHICAD_DATA_DIR, 0775, true);
}
$file = ARCHICAD_DATA_DIR . '/metriques.jsonl';
$lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
$lines[] = json_encode([
    'ts' => time(),
    'site' => $site,
    'event' => $event,
    'user' => $user !== '' ? $user : null,
    'detail' => $detail !== '' ? mb_substr($detail, 0, 200) : null,
], JSON_UNESCAPED_UNICODE);
if (count($lines) > 20000) {
    $lines = array_slice($lines, -20000);
}
file_put_contents($file, implode("\n", $lines) . "\n", LOCK_EX);

echo json_encode(['ok' => true]);
