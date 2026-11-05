<?php
/**
 * Baracca - Site archicad.baracca.fr
 * Catalogues du configurateur (data/catalogue/, un fichier JSON par rubrique :
 * menuiseries.json, modules.json, isolation.json, formes.json, charpentes.json,
 * murs.json, planchers.json, surfaces.json, interieurs.json, couvertures.json,
 * toitures.json) : menuiseries (baies vitrées, fenêtres, portes — avec visuel),
 * modèles de modules (géométrie prédéfinie uniquement), isolations (type de mur
 * + plancher + toiture), formes de toiture (géométrie, pentes), charpentes, murs,
 * planchers, toitures, et revêtements : « surfaces » = habillage EXTÉRIEUR des
 * murs, « interieurs » = revêtements INTÉRIEURS (murs + sous-face de toiture),
 * « couvertures » = revêtement de TOITURE (par pent, ligne « Couverture »).
 * Chaque élément porte un tarif, additionné par le configurateur pour afficher
 * le tarif global du projet.
 *
 * Gérés depuis le back-office (admin/configurateur.php), lus par
 * l'application React via php/api_catalogue.php. Au premier chargement,
 * chaque catalogue est amorcé avec les valeurs par défaut ci-dessous.
 */

require_once __DIR__ . '/../config.php';

// Chaque kind a son propre fichier JSON dans data/catalogue/ :
// menuiseries.json, modules.json, isolation.json, formes.json, charpentes.json,
// murs.json, planchers.json, surfaces.json, interieurs.json, couvertures.json,
// toitures.json (structure {"items": [...]}).
function archicad_catalogue_dir(): string
{
    return ARCHICAD_DATA_DIR . '/catalogue';
}

function archicad_catalogue_file(string $kind): string
{
    return archicad_catalogue_dir() . '/' . $kind . '.json';
}

/**
 * Migration one-shot : l'ancien fichier unique enveloppe.json est éclaté en
 * fichiers séparés (murs/planchers/surfaces/toitures), puis supprimé.
 */
function archicad_catalogue_migrate_enveloppe_file(): void
{
    $old = archicad_catalogue_dir() . '/enveloppe.json';
    if (!is_file($old)) {
        return;
    }
    $data = json_decode((string) file_get_contents($old), true);
    if (is_array($data)) {
        // Ancienne clé "facades" -> "surfaces"
        if (isset($data['facades']) && !isset($data['surfaces'])) {
            $data['surfaces'] = $data['facades'];
            unset($data['facades']);
        }
        foreach (['murs', 'planchers', 'surfaces', 'toitures'] as $kind) {
            $file = archicad_catalogue_dir() . '/' . $kind . '.json';
            if (!is_file($file) && isset($data[$kind]) && is_array($data[$kind])) {
                file_put_contents(
                    $file,
                    json_encode(['items' => array_values($data[$kind])], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                    LOCK_EX
                );
            }
        }
    }
    unlink($old);
}

/**
 * Migration one-shot : les anciens modèles de modules embarquaient mur /
 * plancher / toiture (+ forme). Ces références sont reprises dans une
 * isolation « standard » (isolation.json) avant d'être retirées des modules :
 * un module ne garde plus que sa géométrie, l'enveloppe et la forme de
 * toiture sont choisies côté client (onglets Isolation et Formes).
 */
function archicad_catalogue_migrate_isolation_from_modules(): void
{
    $isoFile = archicad_catalogue_file('isolation');
    if (is_file($isoFile)) {
        $data = json_decode((string) file_get_contents($isoFile), true);
        if (is_array($data) && count($data['items'] ?? []) > 0) {
            return; // rubrique isolation déjà renseignée
        }
    }
    $modFile = archicad_catalogue_file('modules');
    if (!is_file($modFile)) {
        return;
    }
    $mods = json_decode((string) file_get_contents($modFile), true);
    foreach (($mods['items'] ?? []) as $m) {
        if (!empty($m['mur']) || !empty($m['plancher']) || !empty($m['toiture'])) {
            archicad_save_catalogue('isolation', [[
                'id' => 'isolation-standard',
                'nom' => 'Isolation standard',
                'mur' => (string) ($m['mur'] ?? ''),
                'plancher' => (string) ($m['plancher'] ?? ''),
                'toiture' => (string) ($m['toiture'] ?? ''),
                'image' => '',
                'favori' => '',
                'created' => date('Y-m-d'),
                'updated' => date('Y-m-d H:i:s'),
            ]]);
            return;
        }
    }
}

// Dossier public des visuels du catalogue (servi par le serveur web)
function archicad_catalogue_images_dir(): string
{
    return __DIR__ . '/../assets/images/catalogue';
}

// Convertit un chemin web stocké dans le catalogue (/assets/images/catalogue/...)
// en chemin filesystem, ou null si le chemin sort du dossier du catalogue.
function archicad_catalogue_image_fs_path(string $webPath): ?string
{
    $prefix = '/assets/images/catalogue/';
    if (!str_starts_with($webPath, $prefix)) {
        return null;
    }
    $rel = substr($webPath, strlen($prefix));
    if ($rel === '' || str_contains($rel, '..')) {
        return null;
    }
    return archicad_catalogue_images_dir() . '/' . $rel;
}

/**
 * Valeurs d'amorçage des catalogues (reprend le catalogue historique du
 * configurateur, tarif à 0 — à renseigner depuis le back-office).
 */
function archicad_catalogue_defaults(string $kind): array
{
    $today = date('Y-m-d');
    switch ($kind) {
        case 'menuiseries':
            return [
                ['id' => 'baie-120x215', 'nom' => 'Baie vitrée 1,20 × 2,15 m', 'type' => 'baie', 'largeur' => 1.20, 'hauteur' => 2.15, 'favori' => '', 'tarif' => 0, 'image' => '', 'created' => $today],
                ['id' => 'fenetre-90x120', 'nom' => 'Fenêtre 0,90 × 1,20 m', 'type' => 'fenetre', 'largeur' => 0.90, 'hauteur' => 1.20, 'favori' => '', 'tarif' => 0, 'image' => '', 'created' => $today],
                ['id' => 'porte-90x205', 'nom' => 'Porte 0,90 × 2,05 m', 'type' => 'porte', 'largeur' => 0.90, 'hauteur' => 2.05, 'favori' => '', 'tarif' => 0, 'image' => '', 'created' => $today],
                ['id' => 'porte-fenetre-180x215', 'nom' => 'Porte-fenêtre 1,80 × 2,15 m', 'type' => 'baie', 'largeur' => 1.80, 'hauteur' => 2.15, 'favori' => '', 'tarif' => 0, 'image' => '', 'created' => $today],
            ];
        case 'formes':
            // Formes de toiture : géométrie (monopente / deux pentes / quatre
            // pentes) et pente(s) en degrés — deux pentes permet une pente
            // différente par versant (pente1 / pente2). Un modèle de module
            // référence l'id d'une forme.
            return [
                ['id' => 'forme-monopente-15', 'nom' => 'Monopente 15°', 'geometrie' => 'monopente', 'pente' => 15, 'pente1' => 15, 'pente2' => 15, 'pignon' => false, 'defaut' => true, 'image' => '', 'created' => $today],
                ['id' => 'forme-deuxpentes-30', 'nom' => 'Deux pentes 30° / 30°', 'geometrie' => 'deuxpentes', 'pente' => 30, 'pente1' => 30, 'pente2' => 30, 'pignon' => true, 'image' => '', 'created' => $today],
                ['id' => 'forme-deuxpentes-45', 'nom' => 'Deux pentes 45° / 45°', 'geometrie' => 'deuxpentes', 'pente' => 45, 'pente1' => 45, 'pente2' => 45, 'pignon' => true, 'image' => '', 'created' => $today],
                ['id' => 'forme-quatrepentes-30', 'nom' => 'Quatre pentes 30° (croupe)', 'geometrie' => 'quatrepentes', 'pente' => 30, 'pente1' => 30, 'pente2' => 30, 'pignon' => false, 'image' => '', 'created' => $today],
            ];
        case 'charpentes':
            // Charpentes (à l'identique des ouvrants : visuel, nom, épaisseur,
            // couleur, coût unitaire, référence Archicad)
            return [
                ['id' => 'charpente-tradi', 'nom' => 'Charpente traditionnelle', 'epaisseur' => 0.20, 'defaut' => true, 'image' => '', 'rgb' => [140, 107, 89], 'favori' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'isolation':
            // Isolation : type de mur, de plancher et de toiture (références
            // vers les catalogues murs / planchers / toitures), choisie côté
            // client (onglet « Isolation » du configurateur)
            $murs = archicad_load_catalogue('murs');
            $planchers = archicad_load_catalogue('planchers');
            $toitures = archicad_load_catalogue('toitures');
            return [
                ['id' => 'isolation-standard', 'nom' => 'Isolation standard', 'defaut' => true, 'mur' => (string) ($murs[0]['id'] ?? ''), 'plancher' => (string) ($planchers[0]['id'] ?? ''), 'toiture' => (string) ($toitures[0]['id'] ?? ''), 'image' => '', 'favori' => '', 'created' => $today],
            ];
        case 'modules':
            // Un modèle de module définit sa géométrie (longueur, largeur,
            // hauteur sous plafond), son visuel, et pour chaque côté s'il
            // s'agit d'un mur ou d'une charpente (faces : nord/est/sud/ouest)
            $facesAllMur = ['nord' => 'mur', 'est' => 'mur', 'sud' => 'mur', 'ouest' => 'mur'];
            return [
                ['id' => 'module-6x3', 'nom' => 'Module 6,00 × 3,00 m — h 2,80 m', 'defaut' => true, 'longueur' => 6.0, 'largeur' => 3.0, 'hauteur' => 2.8, 'faces' => $facesAllMur, 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'module-9x36', 'nom' => 'Module 9,00 × 3,60 m — h 2,80 m', 'longueur' => 9.0, 'largeur' => 3.6, 'hauteur' => 2.8, 'faces' => $facesAllMur, 'image' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'murs':
            // favori = nom du favori Archicad à utiliser ('' = aucun, à
            // renseigner depuis le back-office) — repris dans l'export JSON.
            // surface = id d'une surface (sous-catalogue "surfaces") dont le
            // visuel est utilisé dans les élévations.
            return [
                ['id' => 'clt90', 'nom' => 'Mur CLT 90 mm', 'epaisseur' => 0.09, 'image' => '', 'surface' => 'bardage_bois', 'rgb' => [140, 107, 89], 'favori' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'clt140', 'nom' => 'Mur CLT 140 mm', 'epaisseur' => 0.14, 'image' => '', 'surface' => 'bardage_bois', 'rgb' => [140, 107, 89], 'favori' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'ossature160', 'nom' => 'Ossature bois 160 mm', 'epaisseur' => 0.16, 'image' => '', 'surface' => 'enduit', 'rgb' => [194, 169, 133], 'favori' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'bloc200', 'nom' => 'Bloc béton 200 mm', 'epaisseur' => 0.20, 'image' => '', 'surface' => 'brique', 'rgb' => [158, 158, 158], 'favori' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'planchers':
            // épaisseur (m) du plancher, affichée en élévation et exportée
            return [
                ['id' => 'clt_dalle', 'nom' => 'Dalle CLT + chape', 'epaisseur' => 0.30, 'image' => '', 'favori' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'plancher_bois', 'nom' => 'Plancher bois sur lambourdes', 'epaisseur' => 0.24, 'image' => '', 'favori' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'dalle_beton', 'nom' => 'Dalle béton', 'epaisseur' => 0.20, 'image' => '', 'favori' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'surfaces':
            // Surfaces = revêtements d'habillage EXTÉRIEUR des murs : visuel
            // téléversé depuis le back-office (image), utilisé dans les
            // élévations. Pas de favori. Onglet « Extérieur » du back-office.
            return [
                ['id' => 'bardage_bois', 'nom' => 'Bardage bois', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'enduit', 'nom' => 'Enduit minéral', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'tole', 'nom' => 'Tôle nervurée', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'brique', 'nom' => 'Brique de parement', 'image' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'interieurs':
            // Revêtements INTÉRIEURS (murs + sous-face de toiture), onglet
            // « Intérieur » : visuel, nom, tarif au m² — le tarif est ajouté
            // au chiffrage des murs et du complexe de toiture. Pas de favori.
            return [
                ['id' => 'placo_ba13', 'nom' => 'Placo BA13 + peinture', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'lambris_bois', 'nom' => 'Lambris bois', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'lambris_pvc', 'nom' => 'Lambris PVC', 'image' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'couvertures':
            // Couvertures de TOITURE (revêtement de toiture, choisi par pent),
            // onglet « Toiture » : visuel, nom, tarif au m² appliqué à la
            // surface AVEC débords (ligne « Couverture » du chiffrage).
            return [
                ['id' => 'bardeaux_bois', 'nom' => 'Bardeaux bois', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'joint_debout', 'nom' => 'Tôle joint debout', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'tuiles_terre_cuite', 'nom' => 'Tuiles terre cuite', 'image' => '', 'tarif' => 0, 'created' => $today],
                ['id' => 'epdm', 'nom' => 'Membrane EPDM (terrasse)', 'image' => '', 'tarif' => 0, 'created' => $today],
            ];
        case 'toitures':
            // Rubrique toiture : épaisseur (m) dessinée au-dessus de la ligne
            // directrice en élévation, surface, couleur, favori — la géométrie
            // (monopente/deux pentes/terrasse) se règle dans la rubrique « Formes »
            return [
                ['id' => 'toit-monopente', 'nom' => 'Toiture monopente', 'epaisseur' => 0.30, 'image' => '', 'surface' => '', 'rgb' => [120, 113, 108], 'favori' => 'Baracca — Toiture monopente', 'tarif' => 0, 'created' => $today],
                ['id' => 'toit-deuxpentes', 'nom' => 'Toiture deux pentes', 'epaisseur' => 0.30, 'image' => '', 'surface' => '', 'rgb' => [120, 113, 108], 'favori' => 'Baracca — Toiture deux pentes', 'tarif' => 0, 'created' => $today],
                ['id' => 'toit-terrasse', 'nom' => 'Terrasse plate', 'epaisseur' => 0.25, 'image' => '', 'surface' => '', 'rgb' => [120, 113, 108], 'favori' => 'Baracca — Toiture terrasse', 'tarif' => 0, 'created' => $today],
            ];
    }
    return [];
}

/**
 * Rubrique « Toitures » (toitures.json — éléments complets : géométrie,
 * épaisseur, surface, couleur, favori Archicad, tarif). Un modèle de module
 * référence l'id d'un élément de cette rubrique.
 */
function archicad_catalogue_toitures(): array
{
    return archicad_load_catalogue('toitures');
}

/**
 * Nature d'un côté de module : mur (plein) ou charpente (pan de toiture,
 * le côté n'est pas un mur).
 */
function archicad_catalogue_face_types(): array
{
    return [
        ['id' => 'mur', 'nom' => 'Mur'],
        ['id' => 'charpente', 'nom' => 'Charpente'],
    ];
}

/**
 * Géométries de forme de toiture (rubrique « formes ») : deux pentes = pignon,
 * quatre pentes = croupe (pas de pignon).
 */
function archicad_catalogue_forme_geometries(): array
{
    return [
        ['id' => 'monopente', 'nom' => 'Monopente'],
        ['id' => 'deuxpentes', 'nom' => 'Deux pentes (pignon)'],
        ['id' => 'quatrepentes', 'nom' => 'Quatre pentes (croupe)'],
    ];
}

// Rubriques dont un élément peut être marqué « par défaut » (appliqué à la
// première ouverture du configurateur côté client)
function archicad_catalogue_defaultable_kinds(): array
{
    return ['modules', 'isolation', 'formes', 'charpentes'];
}

/**
 * Normalise le champ « defaut » (booléen) des rubriques defaultable et, si
 * aucun élément n'est marqué par défaut, marque le premier.
 */
function archicad_catalogue_normalize_defaut(string $kind, array $items): array
{
    if (!in_array($kind, archicad_catalogue_defaultable_kinds(), true)) {
        return $items;
    }
    $changed = false;
    $hasDefaut = false;
    foreach ($items as $i => $item) {
        $v = !empty($item['defaut']);
        if (!$v) {
            $items[$i]['defaut'] = false;
            $changed = true;
        } else {
            $hasDefaut = true;
        }
    }
    if (!$hasDefaut && isset($items[0])) {
        $items[0]['defaut'] = true;
        $changed = true;
    }
    if ($changed) {
        archicad_save_catalogue($kind, $items);
    }
    return $items;
}

/**
 * Marque un élément comme « par défaut » et retire le drapeau des autres
 * éléments de la rubrique (un seul défaut par rubrique).
 */
function archicad_catalogue_set_default(string $kind, string $id): void
{
    if (!in_array($kind, archicad_catalogue_defaultable_kinds(), true)) {
        return;
    }
    $items = archicad_load_catalogue($kind);
    $changed = false;
    foreach ($items as $i => $item) {
        $v = (($item['id'] ?? '') === $id);
        if (!empty($item['defaut']) !== $v) {
            $items[$i]['defaut'] = $v;
            $changed = true;
        }
    }
    if ($changed) {
        archicad_save_catalogue($kind, $items);
    }
}

function archicad_save_catalogue(string $kind, array $items): bool
{
    if (!is_dir(archicad_catalogue_dir())) {
        mkdir(archicad_catalogue_dir(), 0775, true);
    }
    archicad_catalogue_migrate_enveloppe_file();
    $file = archicad_catalogue_file($kind);
    $data = ['items' => array_values($items)];
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

function archicad_load_catalogue(string $kind): array
{
    archicad_catalogue_migrate_enveloppe_file();
    archicad_catalogue_migrate_isolation_from_modules();
    if (!is_file(archicad_catalogue_file($kind))) {
        // Premier chargement : amorce le catalogue avec les valeurs par défaut
        archicad_save_catalogue($kind, archicad_catalogue_defaults($kind));
    }
    $data = json_decode((string) file_get_contents(archicad_catalogue_file($kind)), true);
    if (!is_array($data)) {
        return [];
    }
    $items = is_array($data['items'] ?? null) ? $data['items'] : [];
    // Rétro-compatibilité : favori Archicad ('' = aucun) et visuel ('')
    foreach ($items as $i => $item) {
        if (!array_key_exists('favori', $item)) {
            $items[$i]['favori'] = '';
        }
        if (!array_key_exists('image', $item)) {
            $items[$i]['image'] = '';
        }
    }
    $items = archicad_catalogue_normalize_defaut($kind, $items);
    if ($kind === 'murs' || $kind === 'toitures') {
        // Surface par défaut = première surface du catalogue surfaces.json
        $firstSurface = (string) (archicad_load_catalogue('surfaces')[0]['id'] ?? '');
        foreach ($items as $i => $item) {
            if (empty($item['surface'])) {
                $items[$i]['surface'] = $firstSurface;
            }
        }
    }
    if ($kind === 'murs') {
        foreach ($items as $i => $item) {
            if (empty($item['epaisseur'])) {
                $items[$i]['epaisseur'] = 0.14;
            }
            if (empty($item['rgb'])) {
                $items[$i]['rgb'] = [158, 158, 158];
            }
        }
    }
    if ($kind === 'planchers') {
        // Épaisseur en m (défaut 20 cm)
        foreach ($items as $i => $item) {
            if (empty($item['epaisseur'])) {
                $items[$i]['epaisseur'] = 0.20;
            }
        }
    }
    if ($kind === 'toitures') {
        // Migration : la géométrie (champ « type ») quitte la rubrique toitures
        // (elle se règle dans la rubrique « formes »)
        $changedToitures = false;
        foreach ($items as $i => $item) {
            if (array_key_exists('type', $items[$i])) {
                unset($items[$i]['type']);
                $changedToitures = true;
            }
            if (empty($item['epaisseur'])) {
                $items[$i]['epaisseur'] = 0.30;
            }
            if (empty($item['rgb'])) {
                $items[$i]['rgb'] = [120, 113, 108];
            }
        }
        if ($changedToitures) {
            archicad_save_catalogue('toitures', $items);
        }
    }
    if ($kind === 'formes') {
        // Migration : ancienne forme {pente, pignon} -> {geometrie, pente1, pente2}
        // (pignon = deux pentes ; deux pentes : pente1 = pente2 = pente)
        $changedFormes = false;
        foreach ($items as $i => $item) {
            if (empty($item['geometrie'])) {
                $items[$i]['geometrie'] = !empty($item['pignon']) ? 'deuxpentes' : 'monopente';
                $changedFormes = true;
            }
            if (!in_array($items[$i]['geometrie'], ['monopente', 'deuxpentes', 'quatrepentes'], true)) {
                $items[$i]['geometrie'] = 'monopente';
                $changedFormes = true;
            }
            if (!isset($item['pente']) || !is_numeric($item['pente'])) {
                $items[$i]['pente'] = 15;
                $changedFormes = true;
            }
            if (!isset($item['pente1']) || !is_numeric($item['pente1'])) {
                $items[$i]['pente1'] = (float) $items[$i]['pente'];
                $changedFormes = true;
            }
            if (!isset($item['pente2']) || !is_numeric($item['pente2'])) {
                $items[$i]['pente2'] = (float) $items[$i]['pente'];
                $changedFormes = true;
            }
            // pignon dénormalisé : deux pentes = pignon, quatre pentes = croupe
            if (!array_key_exists('pignon', $item) || $item['pignon'] !== ($items[$i]['geometrie'] === 'deuxpentes')) {
                $items[$i]['pignon'] = $items[$i]['geometrie'] === 'deuxpentes';
                $changedFormes = true;
            }
        }
        if ($changedFormes) {
            archicad_save_catalogue('formes', $items);
        }
    }
    if ($kind === 'charpentes') {
        foreach ($items as $i => $item) {
            if (empty($item['epaisseur'])) {
                $items[$i]['epaisseur'] = 0.20;
            }
            if (empty($item['rgb'])) {
                $items[$i]['rgb'] = [140, 107, 89];
            }
        }
    }
    if ($kind === 'isolation') {
        // Références valides vers murs / planchers / toitures (à défaut le
        // premier élément de chaque catalogue)
        $refs = [
            'mur' => ['murs', archicad_load_catalogue('murs')],
            'plancher' => ['planchers', archicad_load_catalogue('planchers')],
            'toiture' => ['toitures', archicad_load_catalogue('toitures')],
        ];
        foreach ($items as $i => $item) {
            foreach ($refs as $key => [$kindRef, $list]) {
                if (empty($item[$key]) || archicad_catalogue_find($kindRef, (string) $item[$key]) === null) {
                    $items[$i][$key] = (string) ($list[0]['id'] ?? '');
                }
            }
        }
    }
    if ($kind === 'modules') {
        // Migration : un module ne garde que sa géométrie (nom, longueur,
        // largeur, hauteur, visuel) — forme / enveloppe / pente / pignon sont
        // désormais choisis côté client (onglets Isolation et Formes) ; les
        // anciennes références ont été reprises dans la rubrique isolation
        $changedModules = false;
        foreach ($items as $i => $item) {
            foreach (['forme', 'mur', 'plancher', 'toiture', 'facade', 'pente', 'pignon'] as $k) {
                if (array_key_exists($k, $items[$i])) {
                    unset($items[$i][$k]);
                    $changedModules = true;
                }
            }
            // Chaque côté du module : mur ou charpente (défaut mur)
            $facesOld = $item['faces'] ?? null;
            $faces = [];
            foreach (['nord', 'est', 'sud', 'ouest'] as $fk) {
                $v = is_array($facesOld) ? (string) ($facesOld[$fk] ?? 'mur') : 'mur';
                if (!in_array($v, ['mur', 'charpente'], true)) {
                    $v = 'mur';
                }
                $faces[$fk] = $v;
                if (!is_array($facesOld) || ($facesOld[$fk] ?? null) !== $v) {
                    $changedModules = true;
                }
            }
            $items[$i]['faces'] = $faces;
        }
        if ($changedModules) {
            archicad_save_catalogue('modules', $items);
        }
    }
    return $items;
}

function archicad_catalogue_find(string $kind, string $id): ?array
{
    foreach (archicad_load_catalogue($kind) as $item) {
        if (($item['id'] ?? '') === $id) {
            return $item;
        }
    }
    return null;
}

/**
 * Crée ou met à jour un élément du catalogue. Si $id est fourni et existe,
 * les champs sont fusionnés sur l'élément existant ; sinon un nouvel élément
 * est créé. Retourne l'élément enregistré.
 */
function archicad_catalogue_upsert(string $kind, array $fields, ?string $id = null): array
{
    $items = archicad_load_catalogue($kind);
    $now = date('Y-m-d H:i:s');
    if ($id !== null && $id !== '') {
        foreach ($items as $i => $item) {
            if (($item['id'] ?? '') === $id) {
                $items[$i] = array_merge($item, $fields, ['id' => $id, 'updated' => $now]);
                archicad_save_catalogue($kind, $items);
                return $items[$i];
            }
        }
    }
    $item = array_merge($fields, ['id' => bin2hex(random_bytes(8)), 'created' => $now, 'updated' => $now]);
    $items[] = $item;
    archicad_save_catalogue($kind, $items);
    return $item;
}

function archicad_catalogue_delete(string $kind, string $id): bool
{
    $items = archicad_load_catalogue($kind);
    foreach ($items as $i => $item) {
        if (($item['id'] ?? '') === $id) {
            // Supprime le visuel associé (menuiseries)
            $image = (string) ($item['image'] ?? '');
            if ($image !== '') {
                $fs = archicad_catalogue_image_fs_path($image);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            unset($items[$i]);
            return archicad_save_catalogue($kind, $items);
        }
    }
    return false;
}

function archicad_catalogue_total_items(): int
{
    return count(archicad_load_catalogue('menuiseries'))
        + count(archicad_load_catalogue('modules'))
        + count(archicad_load_catalogue('isolation'))
        + count(archicad_load_catalogue('formes'))
        + count(archicad_load_catalogue('charpentes'))
        + count(archicad_load_catalogue('murs'))
        + count(archicad_load_catalogue('planchers'))
        + count(archicad_load_catalogue('surfaces'))
        + count(archicad_load_catalogue('interieurs'))
        + count(archicad_load_catalogue('couvertures'))
        + count(archicad_load_catalogue('toitures'));
}

/**
 * Enregistre un visuel (menuiserie, surface...) envoyé depuis le back-office.
 * Retourne ['ok' => bool, 'webPath' => ?string, 'error' => ?string].
 */
function archicad_catalogue_store_image(array $file, string $id, string $subdir = 'menuiseries'): array
{
    $fail = fn (string $error) => ['ok' => false, 'webPath' => null, 'error' => $error];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return $fail('Aucun fichier envoyé.');
    }
    if ((int) ($file['size'] ?? 0) > 5 * 1024 * 1024) {
        return $fail('Image trop lourde (5 Mo maximum).');
    }
    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
        return $fail('Format non accepté (jpg, png, webp, gif).');
    }
    $tmp = (string) ($file['tmp_name'] ?? '');
    if ($tmp === '' || !is_file($tmp) || @getimagesize($tmp) === false) {
        return $fail('Fichier image invalide.');
    }
    $dir = archicad_catalogue_images_dir() . '/' . $subdir;
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $name = $id . '_' . bin2hex(random_bytes(4)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        return $fail('Échec de l\'enregistrement de l\'image.');
    }
    return ['ok' => true, 'webPath' => '/assets/images/catalogue/' . $subdir . '/' . $name, 'error' => null];
}
