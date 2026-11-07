<?php
/**
 * Baracca - Back-office (archicad.baracca.fr)
 * Métriques d'utilisation du configurateur, calculées depuis data/
 * (users.json, configurations.json, soumissions/, metriques.jsonl)
 * et affichées avec des graphiques dans le tableau de bord.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/users.php';
require_once __DIR__ . '/configurations.php';
require_once __DIR__ . '/soumissions.php';
require_once __DIR__ . '/catalogue.php';

// ---------------------------------------------------------------------------
// Log d'événements (connexions) — lu pour la heatmap
// ---------------------------------------------------------------------------

function archicad_metriques_file(): string
{
    return ARCHICAD_DATA_DIR . '/metriques.jsonl';
}

// Événement de connexion (appelé au login)
function archicad_stats_log_login(string $userId): void
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    $file = archicad_metriques_file();
    $lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
    $lines[] = json_encode(['ts' => time(), 'user' => $userId], JSON_UNESCAPED_UNICODE);
    if (count($lines) > 5000) {
        $lines = array_slice($lines, -5000);
    }
    file_put_contents($file, implode("\n", $lines) . "\n", LOCK_EX);
}

function archicad_stats_login_events(): array
{
    $file = archicad_metriques_file();
    if (!is_file($file)) {
        return [];
    }
    $out = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $e = json_decode($line, true);
        if (is_array($e) && isset($e['ts'])) {
            $out[] = (int) $e['ts'];
        }
    }
    return $out;
}

// ---------------------------------------------------------------------------
// Normalisation d'une configuration enregistrée (tolère l'ancien schéma)
// ---------------------------------------------------------------------------

function stats_normalize_config(array $cfg): array
{
    if (empty($cfg['instances']) || !is_array($cfg['instances'])) {
        $murs = [];
        foreach (['nord', 'est', 'sud', 'ouest'] as $f) {
            $murs[$f] = $cfg['murs'][$f] ?? ['actif' => true, 'ouvertures' => [], 'surface' => null, 'surfaceInt' => null];
        }
        $cfg['instances'] = [['id' => 'm0', 'x' => 0, 'y' => 0, 'moduleId' => $cfg['moduleId'] ?? null, 'murs' => $murs]];
    }
    if (isset($cfg['surfaceToiture']) && empty($cfg['surfacesToiture'])) {
        // ancien schéma : une surface de toiture unique -> comptée une seule fois (clé fictive)
        $cfg['surfacesToiture'] = ['m0' => ['toit' => $cfg['surfaceToiture']]];
    }
    return $cfg;
}

// ---------------------------------------------------------------------------
// Collecte de toutes les métriques
// ---------------------------------------------------------------------------

function archicad_stats_collect(): array
{
    $users = archicad_load_users();
    $configs = archicad_load_configurations();
    $soumissions = archicad_load_soumissions();

    $names = [
        'modules' => array_column(archicad_load_catalogue('modules'), 'nom', 'id'),
        'formes' => array_column(archicad_load_catalogue('formes'), 'nom', 'id'),
        'murs' => array_column(archicad_load_catalogue('murs'), 'nom', 'id'),
        'planchers' => array_column(archicad_load_catalogue('planchers'), 'nom', 'id'),
        'toitures' => array_column(archicad_load_catalogue('toitures'), 'nom', 'id'),
        'surfaces' => array_column(archicad_load_catalogue('surfaces'), 'nom', 'id'),
        'interieurs' => array_column(archicad_load_catalogue('interieurs'), 'nom', 'id'),
        'couvertures' => array_column(archicad_load_catalogue('couvertures'), 'nom', 'id'),
        'menuiseries' => array_column(archicad_load_catalogue('menuiseries'), 'nom', 'id'),
        'fenetres_toit' => array_column(archicad_load_catalogue('fenetres_toit'), 'nom', 'id'),
        'autonomie' => array_column(archicad_load_catalogue('autonomie'), 'nom', 'id'),
    ];
    $name = function (string $kind, ?string $id) use ($names): string {
        if ($id === null || $id === '') {
            return '—';
        }
        return $names[$kind][$id] ?? $id;
    };
    $add = function (array &$acc, ?string $id): void {
        if ($id !== null && $id !== '') {
            $acc[$id] = ($acc[$id] ?? 0) + 1;
        }
    };

    $agg = [
        'modules' => [], 'formes' => [], 'murs' => [], 'planchers' => [], 'toitures' => [],
        'ext' => [], 'int' => [], 'couvertures' => [], 'intToiture' => [], 'autonomie' => [],
        'menuiseries' => [], 'fenetresToit' => [],
    ];
    $modulesParProjet = ['1 module' => 0, '2 modules' => 0, '3 modules et +' => 0];
    $nbOuvrants = 0;
    $nbFenetresToit = 0;

    $mursCat = archicad_load_catalogue('murs');
    $toituresCat = archicad_load_catalogue('toitures');
    $firstIntId = $names['interieurs'] ? (string) array_key_first($names['interieurs']) : null;

    $configsParUser = []; // userId => ['nb' => n, 'first' => ts]
    foreach ($configs as $rec) {
        $cfg = stats_normalize_config(is_array($rec['config'] ?? null) ? $rec['config'] : []);
        $uid = (string) ($rec['userId'] ?? '');
        $ts = strtotime((string) ($rec['created'] ?? '')) ?: time();
        if (!isset($configsParUser[$uid])) {
            $configsParUser[$uid] = ['nb' => 0, 'first' => $ts];
        }
        $configsParUser[$uid]['nb']++;
        $configsParUser[$uid]['first'] = min($configsParUser[$uid]['first'], $ts);

        $insts = is_array($cfg['instances'] ?? null) ? $cfg['instances'] : [];
        $nb = max(1, count($insts));
        $modulesParProjet[$nb === 1 ? '1 module' : ($nb === 2 ? '2 modules' : '3 modules et +')]++;
        $murDef = null;
        foreach ($mursCat as $m) {
            if (($m['id'] ?? '') === ($cfg['murType'] ?? '')) {
                $murDef = $m;
            }
        }
        foreach ($insts as $inst) {
            $add($agg['modules'], $inst['moduleId'] ?? $cfg['moduleId'] ?? null);
            foreach (($inst['murs'] ?? []) as $face) {
                $add($agg['ext'], $face['surface'] ?? ($murDef['surface'] ?? null));
                $add($agg['int'], $face['surfaceInt'] ?? $firstIntId);
                foreach (($face['ouvertures'] ?? []) as $o) {
                    $nbOuvrants++;
                    $add($agg['menuiseries'], $o['menuiserieId'] ?? null);
                }
            }
        }
        $add($agg['formes'], $cfg['forme'] ?? null);
        $add($agg['murs'], $cfg['murType'] ?? null);
        $add($agg['planchers'], $cfg['plancher'] ?? null);
        $add($agg['toitures'], $cfg['toiture'] ?? null);
        $add($agg['autonomie'], $cfg['autonomie'] ?? null);
        $toitDef = null;
        foreach ($toituresCat as $t) {
            if (($t['id'] ?? '') === ($cfg['toiture'] ?? '')) {
                $toitDef = $t;
            }
        }
        foreach (($cfg['surfacesToiture'] ?? []) as $perInst) {
            foreach ((array) $perInst as $sid) {
                $add($agg['couvertures'], ($sid !== null && $sid !== '') ? $sid : ($toitDef['surface'] ?? null));
            }
        }
        foreach (($cfg['surfacesIntToiture'] ?? []) as $perInst) {
            foreach ((array) $perInst as $sid) {
                $add($agg['intToiture'], ($sid !== null && $sid !== '') ? $sid : $firstIntId);
            }
        }
        foreach (($cfg['fenetresToit'] ?? []) as $perInst) {
            foreach ((array) $perInst as $fen) {
                foreach ((array) $fen as $f) {
                    $nbFenetresToit++;
                    $add($agg['fenetresToit'], $f['fenetreId'] ?? null);
                }
            }
        }
    }

    // soumissions par user
    $soumParUser = []; // userId => ['nb' => n, 'first' => ts]
    foreach ($soumissions as $s) {
        $uid = (string) ($s['utilisateur']['id'] ?? '');
        $ts = strtotime((string) ($s['soumis_le'] ?? '')) ?: time();
        if (!isset($soumParUser[$uid])) {
            $soumParUser[$uid] = ['nb' => 0, 'first' => $ts];
        }
        $soumParUser[$uid]['nb']++;
        $soumParUser[$uid]['first'] = min($soumParUser[$uid]['first'], $ts);
    }

    // conversion par user + délai 1re config -> 1re soumission + activité
    $now = time();
    $conversion = [];
    $delais = [];
    $dormants = [];
    $userNames = [];
    foreach ($users as $u) {
        $uid = (string) ($u['id'] ?? '');
        $userNames[$uid] = trim(($u['prenom'] ?? '') . ' ' . ($u['nom'] ?? '')) ?: (string) ($u['email'] ?? $uid);
        $c = $configsParUser[$uid] ?? ['nb' => 0, 'first' => null];
        $s = $soumParUser[$uid] ?? ['nb' => 0, 'first' => null];
        $conversion[$uid] = ['nb' => $c['nb'], 'soumis' => $s['nb'] > 0 ? 1 : 0, 'nbSoum' => $s['nb']];
        if ($c['first'] !== null && $s['first'] !== null && $s['first'] >= $c['first']) {
            $delais[] = $s['first'] - $c['first'];
        }
        $lastAct = max(
            strtotime((string) ($u['last_login'] ?? '')) ?: 0,
            strtotime((string) ($u['last_soumission'] ?? '')) ?: 0,
            (int) ($u['session_opened_at'] ?? 0)
        );
        foreach ($configs as $rec) {
            if ((string) ($rec['userId'] ?? '') === $uid) {
                $lastAct = max($lastAct, strtotime((string) ($rec['updated'] ?? '')) ?: 0);
            }
        }
        if ($lastAct > 0 && $lastAct < $now - 30 * 86400) {
            $dormants[$uid] = $userNames[$uid];
        }
    }

    // heatmap connexions : 7 jours (lun..dim) x 24 h
    $grid = array_fill(0, 7, array_fill(0, 24, 0));
    foreach (archicad_stats_login_events() as $ts) {
        $grid[((int) date('w', $ts) + 6) % 7][(int) date('G', $ts)]++;
    }

    // libellés catalogue (couvertures : repli sur l'ancien catalogue « surfaces » pour les vieux id)
    $nameCouv = function (?string $id) use ($name): string {
        $n = $name('couvertures', $id);
        return $n !== ($id ?? '—') && $n !== '—' ? $n : $name('surfaces', $id);
    };
    $labeled = function (string $kind, array $counts) use ($name, $nameCouv): array {
        $out = [];
        arsort($counts);
        foreach ($counts as $id => $n) {
            $out[$kind === 'couvertures' ? $nameCouv($id) : $name($kind, $id)] = $n;
        }
        return $out;
    };

    return [
        'nbUsers' => count($users),
        'nbConfigs' => count($configs),
        'nbSoumissions' => count($soumissions),
        'tauxConversion' => count($configs) > 0 ? (int) round(count($soumissions) / count($configs) * 100) : 0,
        'usersAyantSoumis' => count(array_filter($conversion, fn ($c) => $c['soumis'] === 1)),
        'delaiMoyen' => $delais ? array_sum($delais) / count($delais) : null,
        'nbOuvrants' => $nbOuvrants,
        'nbFenetresToit' => $nbFenetresToit,
        'modulesParProjet' => $modulesParProjet,
        'dormants' => $dormants,
        'userNames' => $userNames,
        'conversion' => $conversion,
        'grid' => $grid,
        'top' => [
            'modules' => $labeled('modules', $agg['modules']),
            'formes' => $labeled('formes', $agg['formes']),
            'murs' => $labeled('murs', $agg['murs']),
            'planchers' => $labeled('planchers', $agg['planchers']),
            'toitures' => $labeled('toitures', $agg['toitures']),
            'couvertures' => $labeled('couvertures', $agg['couvertures']),
            'ext' => $labeled('surfaces', $agg['ext']),
            'int' => $labeled('interieurs', $agg['int']),
            'intToiture' => $labeled('interieurs', $agg['intToiture']),
            'autonomie' => $labeled('autonomie', $agg['autonomie']),
            'menuiseries' => $labeled('menuiseries', $agg['menuiseries']),
            'fenetresToit' => $labeled('fenetres_toit', $agg['fenetresToit']),
        ],
    ];
}

// ---------------------------------------------------------------------------
// Rendu graphique (barres CSS, sans dépendance externe)
// ---------------------------------------------------------------------------

// Barres horizontales : $items = [libellé => valeur]
function stats_bars(array $items, string $empty = 'Aucune donnée pour le moment.'): string
{
    if ($items === []) {
        return '<p class="admin-hint">' . htmlspecialchars($empty) . '</p>';
    }
    $max = max(1, max($items));
    $html = '<div class="stats-bars">';
    foreach ($items as $label => $v) {
        $pct = max(2, round($v / $max * 100));
        $html .= '<div class="stats-bar-row">'
            . '<span class="stats-bar-label">' . htmlspecialchars((string) $label) . '</span>'
            . '<span class="stats-bar-track"><span class="stats-bar-fill" style="width:' . $pct . '%"></span></span>'
            . '<span class="stats-bar-val">' . (int) $v . '</span>'
            . '</div>';
    }
    return $html . '</div>';
}

// Heatmap 7 jours x 24 h
function stats_heatmap(array $grid): string
{
    $max = 1;
    foreach ($grid as $row) {
        $max = max($max, max($row));
    }
    $jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    $html = '<table class="stats-heatmap"><thead><tr><th></th>';
    for ($h = 0; $h < 24; $h++) {
        $html .= '<th>' . ($h % 3 === 0 ? $h . 'h' : '') . '</th>';
    }
    $html .= '</tr></thead><tbody>';
    foreach ($jours as $i => $j) {
        $html .= '<tr><th>' . $j . '</th>';
        for ($h = 0; $h < 24; $h++) {
            $v = $grid[$i][$h];
            $alpha = $v > 0 ? round(0.12 + 0.88 * $v / $max, 2) : 0;
            $html .= '<td style="background:rgba(122,138,119,' . $alpha . ')" title="' . $j . ' ' . $h . 'h : ' . $v . ' connexion(s)">' . ($v > 0 ? $v : '') . '</td>';
        }
        $html .= '</tr>';
    }
    return $html . '</tbody></table>';
}
