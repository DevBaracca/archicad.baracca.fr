<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Gestion des catalogues du configurateur : menuiseries (baies vitrées,
 * fenêtres, portes — avec visuel et référence Archicad), modèles de modules
 * (géométrie prédéfinie uniquement), isolations (type de mur + plancher +
 * toiture), formes de toiture (géométrie, pentes), charpentes, enveloppe
 * (murs, planchers, toitures) et revêtements en trois onglets : « Extérieur »
 * (surfaces — habillage des murs), « Intérieur » (murs + sous-face de toiture)
 * et « Toiture » (couvertures, par pent). Chaque élément porte un tarif ;
 * le configurateur en calcule le tarif global du projet.
 *
 * L'ajout / la modification d'un élément se fait dans une boîte (modale) :
 * bouton « + » à côté du titre de la rubrique, crayon pour modifier,
 * croix rouge pour supprimer ; à la validation la boîte se referme.
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/catalogue.php';
require_once __DIR__ . '/../includes/configurations.php';

archicad_admin_require_auth();

$section = (string) ($_GET['section'] ?? 'modules');
// Onglets : Structure (Modules, Isolation, Formes, Autonomie), Catalogue (Charpentes,
// Murs, Planchers, Complexe de toiture, Ouvrants, Fenêtres de toit, systèmes Aut.),
// Revêtements (Extérieur = surfaces, Intérieur, Toiture = couvertures)
// et Modèles (configurations « modèles » enregistrées par les administrateurs)
// (l'ancien onglet « enveloppe » est éclaté en sous-onglets)
if ($section === 'enveloppe') {
    $sous0 = (string) ($_GET['sous'] ?? '');
    $section = in_array($sous0, ['murs', 'planchers', 'toitures', 'surfaces', 'interieurs', 'couvertures'], true) ? $sous0 : 'murs';
}
if (!in_array($section, ['modules', 'isolation', 'formes', 'charpentes', 'autonomie', 'promotions', 'systemes_aut', 'fenetres_toit', 'murs', 'planchers', 'toitures', 'menuiseries', 'surfaces', 'interieurs', 'couvertures', 'modeles'], true)) {
    $section = 'modules';
}

function cat_redirect(string $section, string $flash, string $err = ''): void
{
    $url = 'configurateur.php?section=' . urlencode($section) . '&flash=' . urlencode($flash);
    if ($err !== '') {
        $url .= '&err=' . urlencode($err);
    }
    header('Location: ' . $url);
    exit;
}

// Rubriques gérées par save_enveloppe / delete_enveloppe : enveloppe
// (murs, planchers, toitures) + revêtements (Extérieur, Intérieur, Toiture)
function cat_enveloppe_kinds(): array
{
    return ['murs', 'planchers', 'surfaces', 'interieurs', 'couvertures', 'toitures'];
}

function cat_num(string $key): float
{
    $v = str_replace(',', '.', trim((string) ($_POST[$key] ?? '')));
    return is_numeric($v) ? (float) $v : 0.0;
}

function cat_eur(float $tarif): string
{
    return number_format($tarif, 2, ',', ' ');
}

// Dimension affichée en cm, précision au mm (0,1 cm) — stockage en m
function cat_cm(float $m): string
{
    return number_format($m * 100, 1, ',', '') . ' cm';
}

// Valeur de champ <input type="number"> saisie en cm (stockage en m)
function cat_cm_input(float $m): string
{
    return (string) round($m * 100, 1);
}

// Couleur d'affichage en hexadécimal (#rrggbb), à partir du rgb stocké
// (le choix des couleurs dans le formulaire reste en rgb : r/g/b)
function cat_hex(array $rgb): string
{
    $h = '#';
    foreach ([0, 1, 2] as $i) {
        $h .= str_pad(dechex(max(0, min(255, (int) ($rgb[$i] ?? 0)))), 2, '0', STR_PAD_LEFT);
    }
    return $h;
}

// Valeur échappée d'un champ de l'élément enveloppe en cours d'édition
function cat_env_field(array $editEnv, string $sous, string $key, string $default = ''): string
{
    return htmlspecialchars((string) (($editEnv['sous'] === $sous && $editEnv['item']) ? ($editEnv['item'][$key] ?? $default) : $default));
}

// Options <option> d'une liste déroulante de catalogue, élément $current présélectionné
function cat_select_options(array $items, string $current): string
{
    $h = '';
    foreach ($items as $it) {
        $id = (string) ($it['id'] ?? '');
        $h .= '<option value="' . htmlspecialchars($id) . '"' . ($id === $current ? ' selected' : '') . '>'
            . htmlspecialchars((string) ($it['nom'] ?? $id)) . '</option>';
    }
    return $h;
}

// Vignette du visuel d'un élément de catalogue ('—' si aucun)
function cat_thumb(array $item): string
{
    $img = (string) ($item['image'] ?? '');
    if ($img === '') {
        return '<span class="admin-no-image">—</span>';
    }
    return '<img src="../' . ltrim(htmlspecialchars($img), '/') . '" alt="" class="admin-catalogue-thumb">';
}

// ----- Icônes et modale -----
function cat_icon_edit(): string
{
    return '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M11.2 1.8a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L5.6 13.4l-3.2.9.9-3.2 8.9-8.3z" fill="currentColor"/></svg>';
}

function cat_icon_delete(): string
{
    return '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
}

// Enregistre le drapeau « par défaut » d'une rubrique (modules, isolation,
// formes, charpentes) : un seul élément par défaut à la fois
function cat_save_defaut(string $kind, array $item): void
{
    // La case « défaut » n'est plus dans les formulaires (étoile dans la liste) :
    // on ne modifie le drapeau que si le champ est explicitement soumis.
    if (!array_key_exists('defaut', $_POST)) {
        return;
    }
    $v = isset($_POST['defaut']);
    archicad_catalogue_upsert($kind, ['defaut' => $v], (string) $item['id']);
    if ($v) {
        archicad_catalogue_set_default($kind, (string) $item['id']);
    }
}

// Bouton « + » à côté du titre d'une rubrique (ouvre la boîte d'ajout)
function cat_btn_add(string $href, string $title): string
{
    return '<a class="btn-add" href="' . htmlspecialchars($href) . '" title="' . htmlspecialchars($title) . '">+</a>';
}

// Action « modifier » (crayon) dans une ligne de liste
function cat_action_edit(string $href): string
{
    return '<a class="icon-btn" href="' . htmlspecialchars($href) . '" title="Modifier">' . cat_icon_edit() . '</a>';
}

// Action « supprimer » (croix rouge) dans une ligne de liste
function cat_action_delete(string $actionUrl, string $csrf, string $action, string $id, string $confirm, string $extraHidden = ''): string
{
    return '<form method="post" action="' . htmlspecialchars($actionUrl) . '" class="admin-inline-form" onsubmit="return confirm(\''
        . addslashes($confirm) . '\');">'
        . '<input type="hidden" name="csrf" value="' . htmlspecialchars($csrf) . '">'
        . '<input type="hidden" name="action" value="' . htmlspecialchars($action) . '">'
        . $extraHidden
        . '<input type="hidden" name="id" value="' . htmlspecialchars($id) . '">'
        . '<button type="submit" class="icon-btn danger" title="Supprimer">' . cat_icon_delete() . '</button>'
        . '</form>';
}

// Action « définir par défaut » (étoile) dans une ligne de liste
function cat_action_defaut(string $actionUrl, string $csrf, string $section, string $id, bool $isDefaut): string
{
    // Sélectionné = étoile verte (indicateur) ; sinon étoile grisée cliquable
    if ($isDefaut) {
        return '<span class="icon-btn defaut-on" title="Élément par défaut">★</span>';
    }
    return '<form method="post" action="' . htmlspecialchars($actionUrl) . '" class="admin-inline-form">'
        . '<input type="hidden" name="csrf" value="' . htmlspecialchars($csrf) . '">'
        . '<input type="hidden" name="action" value="set_defaut">'
        . '<input type="hidden" name="sous" value="' . htmlspecialchars($section) . '">'
        . '<input type="hidden" name="id" value="' . htmlspecialchars($id) . '">'
        . '<button type="submit" class="icon-btn defaut-off" title="Définir comme élément par défaut">★</button>'
        . '</form>';
}

// Boîte (modale) d'ajout / modification : ouverte quand on édite ou ajoute
function modal_open(string $closeHref): void
{
    echo '<div class="modal-backdrop" onclick="if(event.target===this)location.href=\''
        . htmlspecialchars($closeHref, ENT_QUOTES) . '\'">'
        . '<div class="modal" role="dialog" aria-modal="true">'
        . '<a class="modal-close" href="' . htmlspecialchars($closeHref) . '" title="Fermer">' . cat_icon_delete() . '</a>';
}

function modal_close(): void
{
    echo '</div></div>';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!archicad_admin_csrf_verify($_POST['csrf'] ?? null)) {
        cat_redirect($section, 'csrf');
    }
    $action = (string) ($_POST['action'] ?? '');

    // ----- Menuiseries -----
    if ($action === 'save_menuiserie') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        $type = (string) ($_POST['type'] ?? 'baie');
        if (!in_array($type, ['baie', 'fenetre', 'porte'], true)) {
            $type = 'baie';
        }
        // Saisie en cm (précision mm) — stockage en m
        $largeur = round(cat_num('largeur') / 100, 3);
        $hauteur = round(cat_num('hauteur') / 100, 3);
        $tarif = round(cat_num('tarif'), 2);
        if ($nom === '' || $largeur <= 0 || $hauteur <= 0) {
            cat_redirect('menuiseries', 'invalid');
        }
        $item = archicad_catalogue_upsert('menuiseries', [
            'nom' => $nom,
            'type' => $type,
            'largeur' => $largeur,
            'hauteur' => $hauteur,
            'favori' => trim((string) ($_POST['favori'] ?? '')),
            'tarif' => $tarif,
        ], $id !== '' ? $id : null);
        // Visuel : suppression demandée, ou nouvel envoi
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('menuiseries', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id']);
            if (!$stored['ok']) {
                cat_redirect('menuiseries', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('menuiseries', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_redirect('menuiseries', 'saved');
    }
    if ($action === 'delete_menuiserie') {
        archicad_catalogue_delete('menuiseries', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('menuiseries', 'deleted');
    }

    // ----- Fenêtres de toit (onglet « Fenêtres de toit », zone Catalogue) -----
    // À l'identique des ouvrants (visuel, nom, dimensions, favori, coût
    // unitaire) — posées sur les pents de toiture côté client.
    if ($action === 'save_fenetre_toit') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        // Saisie en cm (précision mm) — stockage en m
        $largeur = round(cat_num('largeur') / 100, 3);
        $hauteur = round(cat_num('hauteur') / 100, 3);
        $tarif = round(cat_num('tarif'), 2);
        if ($nom === '' || $largeur <= 0 || $hauteur <= 0) {
            cat_redirect('fenetres_toit', 'invalid');
        }
        $item = archicad_catalogue_upsert('fenetres_toit', [
            'nom' => $nom,
            'largeur' => $largeur,
            'hauteur' => $hauteur,
            'favori' => trim((string) ($_POST['favori'] ?? '')),
            'tarif' => $tarif,
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('fenetres_toit', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'fenetres_toit');
            if (!$stored['ok']) {
                cat_redirect('fenetres_toit', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('fenetres_toit', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_redirect('fenetres_toit', 'saved');
    }
    if ($action === 'delete_fenetre_toit') {
        archicad_catalogue_delete('fenetres_toit', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('fenetres_toit', 'deleted');
    }

    // ----- Marge de la rubrique active (zones Catalogue et Revêtements) -----
    // Champ « Marge » à droite de la ligne des onglets : coefficient appliqué au
    // chiffrage côté client (prix de l'élément × marge de son onglet ; 1 = aucune).
    if ($action === 'save_marge') {
        $kind = (string) ($_POST['kind'] ?? '');
        if (!in_array($kind, archicad_marge_kinds(), true)) {
            cat_redirect($section, 'invalid');
        }
        $v = str_replace(',', '.', trim((string) ($_POST['marge'] ?? '')));
        $marge = is_numeric($v) ? max(0, round((float) $v, 4)) : 1.0;
        archicad_marge_save($kind, $marge);
        cat_redirect($kind, 'saved');
    }

    // ----- Modèles de modules (géométrie uniquement) -----
    if ($action === 'set_defaut') {
        // Définit l'élément comme « par défaut » de sa rubrique (un seul à la fois)
        $sous = (string) ($_POST['sous'] ?? '');
        $id = trim((string) ($_POST['id'] ?? ''));
        if (in_array($sous, ['modules', 'isolation', 'formes', 'charpentes', 'autonomie'], true) && $id !== '') {
            archicad_catalogue_set_default($sous, $id);
        }
        cat_redirect($section, 'saved');
    }
    if ($action === 'save_module') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        // Saisie en cm — stockage en m ; longueur/largeur : 2 cm mini, 482 cm maxi, paliers de 60 cm
        $longueur = min(4.82, max(0.02, round(cat_num('longueur') / 100, 3)));
        $largeur = min(4.82, max(0.02, round(cat_num('largeur') / 100, 3)));
        $hauteur = round(cat_num('hauteur') / 100, 3);
        if ($nom === '' || $longueur <= 0 || $largeur <= 0 || $hauteur <= 0) {
            cat_redirect('modules', 'invalid');
        }
        // Un module définit sa géométrie + la nature de chaque côté (mur ou
        // charpente). L'isolation (mur, plancher, toiture), la forme de
        // toiture et les surfaces sont choisis côté client. Le tarif n'est
        // plus saisi ici mais reste stocké en base.
        $faces = [];
        foreach (['nord', 'est', 'sud', 'ouest'] as $fk) {
            $v = (string) ($_POST['face_' . $fk] ?? 'mur');
            $faces[$fk] = $v === 'charpente' ? 'charpente' : 'mur';
        }
        $fields = [
            'nom' => $nom,
            'longueur' => $longueur,
            'largeur' => $largeur,
            'hauteur' => $hauteur,
            'faces' => $faces,
            // visibilité des constituants côté client (cochés = visibles)
            'visibilite' => [
                'murs' => isset($_POST['vis_murs']),
                'complexe_toiture' => isset($_POST['vis_complexe_toiture']),
                'plancher' => isset($_POST['vis_plancher']),
                'couverture' => isset($_POST['vis_couverture']),
            ],
        ];
        if (isset($_POST['tarif'])) {
            $fields['tarif'] = round(cat_num('tarif'), 2);
        }
        $item = archicad_catalogue_upsert('modules', $fields, $id !== '' ? $id : null);
        // Visuel du module (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('modules', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'modules');
            if (!$stored['ok']) {
                cat_redirect('modules', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('modules', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_save_defaut('modules', $item);
        cat_redirect('modules', 'saved');
    }
    if ($action === 'delete_module') {
        archicad_catalogue_delete('modules', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('modules', 'deleted');
    }

    // ----- Isolations (type de mur + plancher + toiture) -----
    if ($action === 'save_isolation') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        if ($nom === '') {
            cat_redirect('isolation', 'invalid');
        }
        $ref = function (string $posted, string $kind, array $list): string {
            $rid = (string) $posted;
            if ($rid === '' || archicad_catalogue_find($kind, $rid) === null) {
                $rid = (string) ($list[0]['id'] ?? '');
            }
            return $rid;
        };
        $item = archicad_catalogue_upsert('isolation', [
            'nom' => $nom,
            'mur' => $ref((string) ($_POST['mur'] ?? ''), 'murs', archicad_load_catalogue('murs')),
            'plancher' => $ref((string) ($_POST['plancher'] ?? ''), 'planchers', archicad_load_catalogue('planchers')),
            'toiture' => $ref((string) ($_POST['toiture'] ?? ''), 'toitures', archicad_load_catalogue('toitures')),
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('isolation', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'isolation');
            if (!$stored['ok']) {
                cat_redirect('isolation', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('isolation', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_save_defaut('isolation', $item);
        cat_redirect('isolation', 'saved');
    }
    if ($action === 'delete_isolation') {
        archicad_catalogue_delete('isolation', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('isolation', 'deleted');
    }

    // ----- Systèmes autonomes (onglet « systèmes Aut. », zone Catalogue) -----
    // À l'identique des ouvrants : visuel, nom, dimensions, favori Archicad,
    // mais avec un coût UNITAIRE.
    if ($action === 'save_systeme_aut') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        // Saisie en cm (précision mm) — stockage en m
        $largeur = round(cat_num('largeur') / 100, 3);
        $hauteur = round(cat_num('hauteur') / 100, 3);
        $tarif = round(cat_num('tarif'), 2);
        if ($nom === '' || $largeur <= 0 || $hauteur <= 0) {
            cat_redirect('systemes_aut', 'invalid');
        }
        $item = archicad_catalogue_upsert('systemes_aut', [
            'nom' => $nom,
            'largeur' => $largeur,
            'hauteur' => $hauteur,
            'favori' => trim((string) ($_POST['favori'] ?? '')),
            'tarif' => $tarif, // coût unitaire
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('systemes_aut', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'systemes_aut');
            if (!$stored['ok']) {
                cat_redirect('systemes_aut', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('systemes_aut', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_redirect('systemes_aut', 'saved');
    }
    if ($action === 'delete_systeme_aut') {
        archicad_catalogue_delete('systemes_aut', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('systemes_aut', 'deleted');
    }

    // ----- Autonomie (pack = liste de systèmes autonomes, zone Structure) -----
    if ($action === 'save_autonomie') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        if ($nom === '') {
            cat_redirect('autonomie', 'invalid');
        }
        $sysIds = array_column(archicad_load_catalogue('systemes_aut'), 'id');
        $posted = $_POST['systemes'] ?? [];
        $posted = is_array($posted) ? $posted : [$posted];
        // références valides uniquement, sans doublon, ordre conservé
        $systemes = array_values(array_unique(array_filter(array_map('strval', $posted), fn ($r) => in_array($r, $sysIds, true))));
        $item = archicad_catalogue_upsert('autonomie', [
            'nom' => $nom,
            'systemes' => $systemes,
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('autonomie', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'autonomie');
            if (!$stored['ok']) {
                cat_redirect('autonomie', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('autonomie', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_save_defaut('autonomie', $item);
        cat_redirect('autonomie', 'saved');
    }
    if ($action === 'delete_autonomie') {
        archicad_catalogue_delete('autonomie', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('autonomie', 'deleted');
    }

    // ----- Modèles (configurations « modèles » enregistrées par les admins) -----
    if ($action === 'delete_config') {
        archicad_admin_delete_configuration(trim((string) ($_POST['id'] ?? '')));
        cat_redirect('modeles', 'deleted');
    }
    if ($action === 'update_config') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        if ($nom === '') {
            cat_redirect('modeles', 'invalid');
        }
        $file = (isset($_FILES['visuel']) && is_array($_FILES['visuel'])) ? $_FILES['visuel'] : null;
        $res = archicad_admin_update_configuration($id, $nom, $description, $file, isset($_POST['remove_visuel']));
        if (!$res['ok']) {
            cat_redirect('modeles', 'invalid', (string) ($res['error'] ?? ''));
        }
        cat_redirect('modeles', 'saved');
    }

    // ----- Promotions (onglet « Promotions », zone Structure) -----
    // Code + période (dateDebut/dateFin incluses) + réduction (%) + modules
    // auxquels la promotion est affectée.
    if ($action === 'save_promotion') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $code = strtoupper(trim((string) ($_POST['code'] ?? '')));
        $dateDebut = (string) ($_POST['dateDebut'] ?? '');
        $dateFin = (string) ($_POST['dateFin'] ?? '');
        $reduction = max(0, min(100, round(cat_num('reduction'), 2)));
        $dateOk = fn (string $d) => (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        if ($code === '' || !$dateOk($dateDebut) || !$dateOk($dateFin) || $dateDebut > $dateFin) {
            cat_redirect('promotions', 'invalid');
        }
        $modIds = array_column(archicad_load_catalogue('modules'), 'id');
        $posted = $_POST['modules'] ?? [];
        $posted = is_array($posted) ? $posted : [$posted];
        $modules = array_values(array_unique(array_filter(array_map('strval', $posted), fn ($r) => in_array($r, $modIds, true))));
        archicad_catalogue_upsert('promotions', [
            'code' => $code,
            'dateDebut' => $dateDebut,
            'dateFin' => $dateFin,
            'reduction' => $reduction,
            'modules' => $modules,
        ], $id !== '' ? $id : null);
        cat_redirect('promotions', 'saved');
    }
    if ($action === 'delete_promotion') {
        archicad_catalogue_delete('promotions', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('promotions', 'deleted');
    }

    // ----- Formes de toiture (géométrie + pente(s)) -----
    if ($action === 'save_forme') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        $geometrie = (string) ($_POST['geometrie'] ?? 'monopente');
        if (!in_array($geometrie, array_column(archicad_catalogue_forme_geometries(), 'id'), true)) {
            $geometrie = 'monopente';
        }
        $pente = max(0, min(90, (int) round(cat_num('pente'))));
        $pente1 = max(0, min(90, (int) round(cat_num('pente1'))));
        $pente2 = max(0, min(90, (int) round(cat_num('pente2'))));
        $depassee = max(0, min(200, round(cat_num('depassee') * 10) / 10)); // débordée de toiture, en cm
        // deux pentes : une pente par versant ; monopente / quatre pentes : une pente
        if ($geometrie === 'deuxpentes' ? ($pente1 <= 0 || $pente2 <= 0) : $pente <= 0) {
            cat_redirect('formes', 'invalid');
        }
        if ($nom === '') {
            cat_redirect('formes', 'invalid');
        }
        if ($geometrie === 'deuxpentes') {
            $pente = $pente1; // « pente » dénormalisée = pente du versant 1
        }
        $item = archicad_catalogue_upsert('formes', [
            'nom' => $nom,
            'geometrie' => $geometrie,
            'pente' => $pente,
            'pente1' => $pente1,
            'pente2' => $pente2,
            'depassee' => $depassee, // débordée de toiture en cm (surface + élévations)
            'pignon' => $geometrie === 'deuxpentes', // dénormalisé (deux pentes = pignon)
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('formes', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'formes');
            if (!$stored['ok']) {
                cat_redirect('formes', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('formes', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_save_defaut('formes', $item);
        cat_redirect('formes', 'saved');
    }
    if ($action === 'delete_forme') {
        archicad_catalogue_delete('formes', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('formes', 'deleted');
    }

    // ----- Charpentes (visuel, nom, épaisseur, couleur, coût unitaire, référence Archicad) -----
    if ($action === 'save_charpente') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        // Saisie en cm (précision mm) — stockage en m
        $epaisseur = round(cat_num('epaisseur') / 100, 3);
        $tarif = round(cat_num('tarif'), 2);
        if ($nom === '' || $epaisseur <= 0) {
            cat_redirect('charpentes', 'invalid');
        }
        $item = archicad_catalogue_upsert('charpentes', [
            'nom' => $nom,
            'epaisseur' => $epaisseur,
            'rgb' => [
                max(0, min(255, (int) round(cat_num('r')))),
                max(0, min(255, (int) round(cat_num('g')))),
                max(0, min(255, (int) round(cat_num('b')))),
            ],
            'favori' => trim((string) ($_POST['favori'] ?? '')),
            'tarif' => $tarif,
        ], $id !== '' ? $id : null);
        // Visuel (suppression demandée ou nouvel envoi)
        if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
            $fs = archicad_catalogue_image_fs_path((string) $item['image']);
            if ($fs !== null && is_file($fs)) {
                unlink($fs);
            }
            archicad_catalogue_upsert('charpentes', ['image' => ''], (string) $item['id']);
        }
        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], 'charpentes');
            if (!$stored['ok']) {
                cat_redirect('charpentes', 'image', (string) $stored['error']);
            }
            $old = (string) ($item['image'] ?? '');
            if ($old !== '' && $old !== $stored['webPath']) {
                $fs = archicad_catalogue_image_fs_path($old);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
            }
            archicad_catalogue_upsert('charpentes', ['image' => (string) $stored['webPath']], (string) $item['id']);
        }
        cat_save_defaut('charpentes', $item);
        cat_redirect('charpentes', 'saved');
    }
    if ($action === 'delete_charpente') {
        archicad_catalogue_delete('charpentes', trim((string) ($_POST['id'] ?? '')));
        cat_redirect('charpentes', 'deleted');
    }

    // ----- Enveloppe (murs, planchers, surfaces, toitures) -----
    if ($action === 'save_enveloppe') {
        $sous = (string) ($_POST['sous'] ?? '');
        if (!in_array($sous, cat_enveloppe_kinds(), true)) {
            cat_redirect('modules', 'invalid');
        }
        $id = trim((string) ($_POST['id'] ?? ''));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        $tarif = round(cat_num('tarif'), 2);
        if ($nom === '') {
            cat_redirect($sous, 'invalid');
        }
        $fields = ['nom' => $nom, 'tarif' => $tarif];
        // Référence de revêtement (catalogues surfaces / interieurs / couvertures) :
        // id valide du catalogue, sinon son premier élément
        $refOf = function (string $kind, string $posted): string {
            $list = archicad_load_catalogue($kind);
            $id = (string) $posted;
            if ($id === '' || archicad_catalogue_find($kind, $id) === null) {
                $id = (string) ($list[0]['id'] ?? '');
            }
            return $id;
        };
        if ($sous === 'murs' || $sous === 'toitures') {
            // référence Archicad ('' = aucun) — les surfaces n'en ont pas
            $fields['favori'] = trim((string) ($_POST['favori'] ?? ''));
            $fields['surface'] = $refOf('surfaces', (string) ($_POST['surface'] ?? ''));
            // Saisie en cm (précision mm) — stockage en m
            $epaisseur = round(cat_num('epaisseur') / 100, 3);
            if ($epaisseur <= 0) {
                cat_redirect($sous, 'invalid');
            }
            $fields['epaisseur'] = $epaisseur;
            $fields['rgb'] = [
                max(0, min(255, (int) round(cat_num('r')))),
                max(0, min(255, (int) round(cat_num('g')))),
                max(0, min(255, (int) round(cat_num('b')))),
            ];
            if ($sous === 'murs') {
                // revêtement INTÉRIEUR par défaut du mur (catalogue interieurs.json)
                $fields['interieur'] = $refOf('interieurs', (string) ($_POST['interieur'] ?? ''));
            }
            if ($sous === 'toitures') {
                // revêtements par défaut du complexe de toiture, appliqués à chaque
                // pent côté client : sous-face (interieurs.json) + couverture (couvertures.json)
                $fields['interieur'] = $refOf('interieurs', (string) ($_POST['interieur'] ?? ''));
                $fields['couverture'] = $refOf('couvertures', (string) ($_POST['couverture'] ?? ''));
            }
        }
        if ($sous === 'planchers') {
            $fields['favori'] = trim((string) ($_POST['favori'] ?? ''));
            // revêtements par défaut du plancher, appliqués côté client :
            // surface supérieure (interieurs.json) et chants (surfaces.json)
            $fields['revetement_sup'] = $refOf('interieurs', (string) ($_POST['revetement_sup'] ?? ''));
            $fields['revetement_chants'] = $refOf('surfaces', (string) ($_POST['revetement_chants'] ?? ''));
            // Saisie en cm (précision mm) — stockage en m
            $epaisseur = round(cat_num('epaisseur') / 100, 3);
            if ($epaisseur <= 0) {
                cat_redirect($sous, 'invalid');
            }
            $fields['epaisseur'] = $epaisseur;
        }
        // La géométrie de la toiture ne se règle plus ici (rubrique « Formes »)
        $item = archicad_catalogue_upsert($sous, $fields, $id !== '' ? $id : null);
        // Chaque rubrique a son propre onglet : on y retourne après sauvegarde
        $destSection = $sous;
        // Visuel téléversé (suppression demandée ou nouvel envoi) — toutes les
        // rubriques du configurateur ont un visuel (sous-dossier = rubrique)
        if (in_array($sous, cat_enveloppe_kinds(), true)) {
            if (isset($_POST['remove_image']) && (string) ($item['image'] ?? '') !== '') {
                $fs = archicad_catalogue_image_fs_path((string) $item['image']);
                if ($fs !== null && is_file($fs)) {
                    unlink($fs);
                }
                archicad_catalogue_upsert($sous, ['image' => ''], (string) $item['id']);
                $item = archicad_catalogue_find($sous, (string) $item['id']) ?? $item;
            }
            if (isset($_FILES['image']) && is_array($_FILES['image'])) {
                $stored = archicad_catalogue_store_image($_FILES['image'], (string) $item['id'], $sous);
                if (!$stored['ok']) {
                    cat_redirect($destSection, 'image', (string) $stored['error']);
                }
                $old = (string) ($item['image'] ?? '');
                if ($old !== '' && $old !== $stored['webPath']) {
                    $fs = archicad_catalogue_image_fs_path($old);
                    if ($fs !== null && is_file($fs)) {
                        unlink($fs);
                    }
                }
                archicad_catalogue_upsert($sous, ['image' => (string) $stored['webPath']], (string) $item['id']);
            }
        }
        cat_redirect($destSection, 'saved');
    }
    if ($action === 'delete_enveloppe') {
        $sous = (string) ($_POST['sous'] ?? '');
        if (!in_array($sous, cat_enveloppe_kinds(), true)) {
            cat_redirect('modules', 'invalid');
        }
        archicad_catalogue_delete($sous, trim((string) ($_POST['id'] ?? '')));
        cat_redirect($sous, 'deleted');
    }

    cat_redirect($section, 'invalid');
}

// ----- Affichage -----

$flash = (string) ($_GET['flash'] ?? '');
$flashErr = (string) ($_GET['err'] ?? '');
$flashMessage = null;
if ($flash === 'saved') {
    $flashMessage = ['success', 'Élément enregistré dans le catalogue.'];
} elseif ($flash === 'deleted') {
    $flashMessage = ['success', 'Élément supprimé du catalogue.'];
} elseif ($flash === 'invalid') {
    $flashMessage = ['error', 'Vérifiez les champs obligatoires (nom renseigné, dimensions strictement positives).'];
} elseif ($flash === 'csrf') {
    $flashMessage = ['error', 'Jeton de sécurité invalide.'];
} elseif ($flash === 'image') {
    $flashMessage = ['error', $flashErr !== '' ? $flashErr : 'Image non enregistrée.'];
}

$csrf = archicad_admin_csrf_token();
$menuiseries = archicad_load_catalogue('menuiseries');
$modules = archicad_load_catalogue('modules');
$isolations = archicad_load_catalogue('isolation');
$formes = archicad_load_catalogue('formes');
$charpentes = archicad_load_catalogue('charpentes');
$systemesAut = archicad_load_catalogue('systemes_aut');
$autonomies = archicad_load_catalogue('autonomie');
$fenetresToit = archicad_load_catalogue('fenetres_toit');
$promotions = archicad_load_catalogue('promotions');
$murs = archicad_load_catalogue('murs');
$planchers = archicad_load_catalogue('planchers');
$facades = archicad_load_catalogue('surfaces');       // revêtements Extérieur
$interieurs = archicad_load_catalogue('interieurs');   // revêtements Intérieur
$couvertures = archicad_load_catalogue('couvertures'); // revêtements Toiture (couvertures)
$toitures = archicad_catalogue_toitures();
$modeles = archicad_configurations_modeles();          // configurations « modèles » (admins)

$typeLabels = ['baie' => 'Baie vitrée', 'fenetre' => 'Fenêtre', 'porte' => 'Porte'];
$toitureLabels = array_column($toitures, 'nom', 'id');
$formeNames = array_column($formes, 'nom', 'id');
$formeGeometries = archicad_catalogue_forme_geometries();
$formeGeoLabels = array_column($formeGeometries, 'nom', 'id');
$murNames = array_column($murs, 'nom', 'id');
$plancherNames = array_column($planchers, 'nom', 'id');
$facadeNames = array_column($facades, 'nom', 'id');
$systemeAutNames = array_column($systemesAut, 'nom', 'id');
$moduleNames = array_column($modules, 'nom', 'id');

$new = isset($_GET['new']);
$editMenuiserie = null;
$editModule = null;
$editIsolation = null;
$editForme = null;
$editCharpente = null;
$editSystemeAut = null;
$editAutonomie = null;
$editFenetreToit = null;
$editPromotion = null;
$editModele = null;
$editEnv = ['sous' => '', 'item' => null];
if (($editId = trim((string) ($_GET['edit'] ?? ''))) !== '') {
    if ($section === 'menuiseries') {
        $editMenuiserie = archicad_catalogue_find('menuiseries', $editId);
    } elseif ($section === 'fenetres_toit') {
        $editFenetreToit = archicad_catalogue_find('fenetres_toit', $editId);
    } elseif ($section === 'modules') {
        $editModule = archicad_catalogue_find('modules', $editId);
    } elseif ($section === 'isolation') {
        $editIsolation = archicad_catalogue_find('isolation', $editId);
    } elseif ($section === 'formes') {
        $editForme = archicad_catalogue_find('formes', $editId);
    } elseif ($section === 'charpentes') {
        $editCharpente = archicad_catalogue_find('charpentes', $editId);
    } elseif ($section === 'systemes_aut') {
        $editSystemeAut = archicad_catalogue_find('systemes_aut', $editId);
    } elseif ($section === 'autonomie') {
        $editAutonomie = archicad_catalogue_find('autonomie', $editId);
    } elseif ($section === 'promotions') {
        $editPromotion = archicad_catalogue_find('promotions', $editId);
    } elseif ($section === 'modeles') {
        $m = archicad_find_configuration($editId);
        $editModele = ($m !== null && !empty($m['modele'])) ? $m : null;
    } elseif (in_array($section, cat_enveloppe_kinds(), true)) {
        $sous = $section;
        $editEnv = ['sous' => $sous, 'item' => archicad_catalogue_find($sous, $editId)];
    }
}
// Rubrique active (édition ou ajout) — ouvre la boîte correspondante
$envSous = $editEnv['sous'];
if ($envSous === '' && $new && in_array($section, cat_enveloppe_kinds(), true)) {
    $envSous = $section;
}

$pageTitle = 'Configurateur';
$adminPage = 'configurateur'; // classe de page admin-configurateur (fond façon client)
include __DIR__ . '/../includes/admin-head.php';
?>

    <?php if ($flashMessage): ?>
      <p class="admin-flash <?= $flashMessage[0] ?>"><?= htmlspecialchars($flashMessage[1]) ?></p>
    <?php endif; ?>

<?php
// Trois cartes façon client : Structure (Modules, Isolation, Formes, Autonomie),
// Catalogue (Charpentes, Murs, Planchers, Complexe de toiture, Ouvrants,
// systèmes Aut.), Revêtements (Extérieur, Intérieur, Toiture).
// Chaque carte porte ses sous-onglets ; la rubrique active s'ouvre dans sa carte.
$groupes = [
    'structure' => ['label' => 'Structure', 'sections' => [
        ['modules', 'Modules', count($modules)],
        ['isolation', 'Isolation', count($isolations)],
        ['formes', 'Formes', count($formes)],
        ['autonomie', 'Autonomie', count($autonomies)],
    ]],
    'catalogue' => ['label' => 'Catalogue', 'sections' => [
        ['charpentes', 'Charpentes', count($charpentes)],
        ['murs', 'Murs', count($murs)],
        ['planchers', 'Planchers', count($planchers)],
        ['toitures', 'Complexe de toiture', count($toitures)],
        ['menuiseries', 'Ouvrants', count($menuiseries)],
        ['fenetres_toit', 'Fenêtres de toit', count($fenetresToit)],
        ['systemes_aut', 'systèmes Aut.', count($systemesAut)],
    ]],
    'surfaces' => ['label' => 'Revêtements', 'sections' => [
        ['surfaces', 'Extérieur', count($facades)],
        ['interieurs', 'Intérieur', count($interieurs)],
        ['couvertures', 'Toiture', count($couvertures)],
    ]],
    'modeles' => ['label' => 'Modèles', 'sections' => [
        ['modeles', 'Configurations modèles', count($modeles)],
    ]],
];
$groupeOf = [
    'modules' => 'structure', 'isolation' => 'structure', 'formes' => 'structure', 'autonomie' => 'structure', 'promotions' => 'structure',
    'charpentes' => 'catalogue', 'murs' => 'catalogue', 'planchers' => 'catalogue',
    'toitures' => 'catalogue', 'menuiseries' => 'catalogue', 'fenetres_toit' => 'catalogue', 'systemes_aut' => 'catalogue',
    'surfaces' => 'surfaces', 'interieurs' => 'surfaces', 'couvertures' => 'surfaces',
    'modeles' => 'modeles',
];
$groupeActif = $groupeOf[$section] ?? 'structure';
?>
<?php foreach ($groupes as $gkey => $g): ?>
    <div class="admin-card admin-groupe<?= $groupeActif === $gkey ? ' actif' : '' ?>">
      <h2 class="admin-groupe-title"><?= $g['label'] ?></h2>
      <nav class="admin-tabs admin-subtabs">
        <?php foreach ($g['sections'] as [$s, $label, $nb]): ?>
        <a href="configurateur.php?section=<?= $s ?>"<?= $section === $s ? ' class="active"' : '' ?>><?= $label ?> (<?= $nb ?>)</a>
        <?php endforeach; ?>
        <?php if ($groupeActif === $gkey && $gkey === 'structure'): // onglet « Promotions » épinglé à droite de la ligne des onglets ?>
        <a href="configurateur.php?section=promotions" style="margin-left:auto"<?= $section === 'promotions' ? ' class="active"' : '' ?>>Promotions (<?= count($promotions) ?>)</a>
        <?php endif; ?>
        <?php if ($groupeActif === $gkey && in_array($section, archicad_marge_kinds(), true)): // champ Marge fixé à droite de la ligne des onglets ?>
        <form method="post" action="configurateur.php?section=<?= $section ?>" class="admin-marge-form" title="Coefficient de marge appliqué au chiffrage client pour cette rubrique (1 = aucune marge, 1,15 = +15 %)">
          <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
          <input type="hidden" name="action" value="save_marge">
          <input type="hidden" name="kind" value="<?= $section ?>">
          <label for="marge-input">Marge</label>
          <input type="number" id="marge-input" name="marge" step="0.01" min="0" value="<?= htmlspecialchars((string) archicad_marge_get($section)) ?>">
          <button type="submit" class="btn small">OK</button>
        </form>
        <?php endif; ?>
      </nav>
      <?php if ($groupeActif === $gkey): ?>

    <?php if ($section === 'menuiseries'): ?>
    <div class="admin-card">
      <h2>Ouvrants (<?= count($menuiseries) ?>) <?= cat_btn_add('configurateur.php?section=menuiseries&new=1', 'Ajouter un ouvrant') ?></h2>
      <p class="admin-hint">Le client choisit un ouvrant (baie vitrée, fenêtre, porte) dans ce catalogue pour l'intégrer à un mur (onglet « Murs &amp; ouvertures » du configurateur) ; seule la position sur le mur reste à définir. Le visuel est affiché dans le configurateur.</p>
      <?php if ($menuiseries === []): ?>
        <p class="admin-hint">Aucune menuiserie dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Visuel</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Dimensions</th>
              <th>Référence Archicad</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($menuiseries as $m): ?>
              <tr>
                <td>
                  <?php if (($m['image'] ?? '') !== ''): ?>
                    <img src="../<?= ltrim(htmlspecialchars((string) $m['image']), '/') ?>" alt="" class="admin-catalogue-thumb">
                  <?php else: ?>
                    <span class="admin-no-image">—</span>
                  <?php endif; ?>
                </td>
                <td><strong><?= htmlspecialchars((string) $m['nom']) ?></strong></td>
                <td><?= htmlspecialchars($typeLabels[$m['type'] ?? ''] ?? (string) ($m['type'] ?? '')) ?></td>
                <td><?= cat_cm((float) $m['largeur']) ?> × <?= cat_cm((float) $m['hauteur']) ?></td>
                <td><?= ($m['favori'] ?? '') !== '' ? htmlspecialchars((string) $m['favori']) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=menuiseries&edit=' . urlencode((string) $m['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=menuiseries', $csrf, 'delete_menuiserie', (string) $m['id'], 'Supprimer cette menuiserie du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editMenuiserie || $new): modal_open('configurateur.php?section=menuiseries'); ?>
    <div class="admin-card">
      <h2><?= $editMenuiserie ? 'Modifier : ' . htmlspecialchars((string) $editMenuiserie['nom']) : 'Ajouter un ouvrant' ?></h2>
      <form method="post" action="configurateur.php?section=menuiseries" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_menuiserie">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editMenuiserie['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editMenuiserie && ($editMenuiserie['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editMenuiserie['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="m-image">Visuel (image)</label>
          <input type="file" id="m-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="m-nom">Nom</label>
            <input type="text" id="m-nom" name="nom" required value="<?= htmlspecialchars((string) ($editMenuiserie['nom'] ?? '')) ?>" placeholder="Baie vitrée 1,20 × 2,15 m">
          </div>
          <div class="admin-form-row">
            <label for="m-type">Type</label>
            <select id="m-type" name="type">
              <?php foreach ($typeLabels as $value => $label): ?>
                <option value="<?= $value ?>"<?= (($editMenuiserie['type'] ?? 'baie') === $value) ? ' selected' : '' ?>><?= $label ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="m-largeur">Largeur (cm)</label>
            <input type="number" id="m-largeur" name="largeur" step="0.1" min="10" required value="<?= htmlspecialchars($editMenuiserie ? cat_cm_input((float) $editMenuiserie['largeur']) : '120') ?>">
          </div>
          <div class="admin-form-row">
            <label for="m-hauteur">Hauteur (cm)</label>
            <input type="number" id="m-hauteur" name="hauteur" step="0.1" min="10" required value="<?= htmlspecialchars($editMenuiserie ? cat_cm_input((float) $editMenuiserie['hauteur']) : '215') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="m-tarif">Coût unitaire (€)</label>
            <input type="number" id="m-tarif" name="tarif" step="0.01" min="0" value="<?= htmlspecialchars((string) ($editMenuiserie['tarif'] ?? '0')) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="m-favori">Référence Archicad</label>
            <input type="text" id="m-favori" name="favori" value="<?= htmlspecialchars((string) ($editMenuiserie['favori'] ?? '')) ?>" placeholder="Nom de la référence Archicad (ex. Baracca — Porte), vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=menuiseries" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'fenetres_toit'): ?>
    <div class="admin-card">
      <h2>Fenêtres de toit (<?= count($fenetresToit) ?>) <?= cat_btn_add('configurateur.php?section=fenetres_toit&new=1', 'Ajouter une fenêtre de toit') ?></h2>
      <p class="admin-hint">À l'identique des ouvrants (visuel, nom, dimensions, référence Archicad, coût unitaire) : le client choisit une fenêtre de toit dans ce catalogue pour la poser sur un pent de toiture (clic sur la toiture dans le configurateur) ; elle est symbolisée par un cadre en pointillé sur le plan. Le visuel est affiché dans le configurateur.</p>
      <?php if ($fenetresToit === []): ?>
        <p class="admin-hint">Aucune fenêtre de toit dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Visuel</th>
              <th>Nom</th>
              <th>Dimensions</th>
              <th>Référence Archicad</th>
              <th>Coût unitaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($fenetresToit as $ft): ?>
              <tr>
                <td><?= cat_thumb($ft) ?></td>
                <td><strong><?= htmlspecialchars((string) $ft['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($ft['largeur'] ?? 0)) ?> × <?= cat_cm((float) ($ft['hauteur'] ?? 0)) ?></td>
                <td><?= ($ft['favori'] ?? '') !== '' ? htmlspecialchars((string) $ft['favori']) : '—' ?></td>
                <td><?= cat_eur((float) ($ft['tarif'] ?? 0)) ?> €</td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=fenetres_toit&edit=' . urlencode((string) $ft['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=fenetres_toit', $csrf, 'delete_fenetre_toit', (string) $ft['id'], 'Supprimer cette fenêtre de toit du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editFenetreToit || $new): modal_open('configurateur.php?section=fenetres_toit'); ?>
    <div class="admin-card">
      <h2><?= $editFenetreToit ? 'Modifier : ' . htmlspecialchars((string) $editFenetreToit['nom']) : 'Ajouter une fenêtre de toit' ?></h2>
      <form method="post" action="configurateur.php?section=fenetres_toit" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_fenetre_toit">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editFenetreToit['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editFenetreToit && ($editFenetreToit['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editFenetreToit['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="ft-image">Visuel (image)</label>
          <input type="file" id="ft-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max. Affiché dans le configurateur.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ft-nom">Nom</label>
            <input type="text" id="ft-nom" name="nom" required value="<?= htmlspecialchars((string) ($editFenetreToit['nom'] ?? '')) ?>" placeholder="Fenêtre de toit 0,78 × 0,98 m">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ft-largeur">Largeur (cm)</label>
            <input type="number" id="ft-largeur" name="largeur" step="0.1" min="10" required value="<?= htmlspecialchars($editFenetreToit ? cat_cm_input((float) $editFenetreToit['largeur']) : '78') ?>">
          </div>
          <div class="admin-form-row">
            <label for="ft-hauteur">Hauteur (cm)</label>
            <input type="number" id="ft-hauteur" name="hauteur" step="0.1" min="10" required value="<?= htmlspecialchars($editFenetreToit ? cat_cm_input((float) $editFenetreToit['hauteur']) : '98') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ft-tarif">Coût unitaire (€)</label>
            <input type="number" id="ft-tarif" name="tarif" step="0.01" min="0" value="<?= htmlspecialchars((string) ($editFenetreToit['tarif'] ?? '0')) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ft-favori">Référence Archicad</label>
            <input type="text" id="ft-favori" name="favori" value="<?= htmlspecialchars((string) ($editFenetreToit['favori'] ?? '')) ?>" placeholder="Nom de la référence Archicad, vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=fenetres_toit" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'systemes_aut'): ?>
    <div class="admin-card">
      <h2>systèmes Aut. (<?= count($systemesAut) ?>) <?= cat_btn_add('configurateur.php?section=systemes_aut&new=1', 'Ajouter un système autonome') ?></h2>
      <p class="admin-hint">Systèmes autonomes (panneaux solaires, batterie, poêle, récupération d'eau…) : comme les ouvrants (visuel, nom, dimensions, référence Archicad) avec un <strong>coût unitaire</strong>. Ils sont regroupés en « packs » dans l'onglet « Autonomie » (zone Structure) ; le client choisit un pack dans la rubrique « Autonomie » du configurateur, et le visuel est affiché.</p>
      <?php if ($systemesAut === []): ?>
        <p class="admin-hint">Aucun système autonome dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Visuel</th>
              <th>Nom</th>
              <th>Dimensions</th>
              <th>Référence Archicad</th>
              <th>Coût unitaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($systemesAut as $s): ?>
              <tr>
                <td><?= cat_thumb($s) ?></td>
                <td><strong><?= htmlspecialchars((string) $s['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($s['largeur'] ?? 0)) ?> × <?= cat_cm((float) ($s['hauteur'] ?? 0)) ?></td>
                <td><?= ($s['favori'] ?? '') !== '' ? htmlspecialchars((string) $s['favori']) : '—' ?></td>
                <td><?= cat_eur((float) ($s['tarif'] ?? 0)) ?> €</td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=systemes_aut&edit=' . urlencode((string) $s['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=systemes_aut', $csrf, 'delete_systeme_aut', (string) $s['id'], 'Supprimer ce système autonome du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editSystemeAut || $new): modal_open('configurateur.php?section=systemes_aut'); ?>
    <div class="admin-card">
      <h2><?= $editSystemeAut ? 'Modifier : ' . htmlspecialchars((string) $editSystemeAut['nom']) : 'Ajouter un système autonome' ?></h2>
      <form method="post" action="configurateur.php?section=systemes_aut" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_systeme_aut">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editSystemeAut['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editSystemeAut && ($editSystemeAut['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editSystemeAut['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="sa-image">Visuel (image)</label>
          <input type="file" id="sa-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max. Affiché dans le configurateur.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="sa-nom">Nom</label>
            <input type="text" id="sa-nom" name="nom" required value="<?= htmlspecialchars((string) ($editSystemeAut['nom'] ?? '')) ?>" placeholder="Panneaux solaires 3 kWc">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="sa-largeur">Largeur (cm)</label>
            <input type="number" id="sa-largeur" name="largeur" step="0.1" min="10" required value="<?= htmlspecialchars($editSystemeAut ? cat_cm_input((float) $editSystemeAut['largeur']) : '100') ?>">
          </div>
          <div class="admin-form-row">
            <label for="sa-hauteur">Hauteur (cm)</label>
            <input type="number" id="sa-hauteur" name="hauteur" step="0.1" min="10" required value="<?= htmlspecialchars($editSystemeAut ? cat_cm_input((float) $editSystemeAut['hauteur']) : '100') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="sa-tarif">Coût unitaire (€)</label>
            <input type="number" id="sa-tarif" name="tarif" step="0.01" min="0" value="<?= htmlspecialchars((string) ($editSystemeAut['tarif'] ?? '0')) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="sa-favori">Référence Archicad</label>
            <input type="text" id="sa-favori" name="favori" value="<?= htmlspecialchars((string) ($editSystemeAut['favori'] ?? '')) ?>" placeholder="Nom de la référence Archicad, vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=systemes_aut" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'modules'): ?>
    <div class="admin-card">
      <h2>Modules (<?= count($modules) ?>) <?= cat_btn_add('configurateur.php?section=modules&new=1', 'Ajouter un module') ?></h2>
      <p class="admin-hint">Le client choisit un modèle dans ce catalogue (onglet « Module » du configurateur) : longueur, largeur et hauteur sous plafond sont définis par le modèle — le client ne peut pas les modifier. L'isolation (mur, plancher, toiture), la forme de toiture et les surfaces sont choisis séparément, côté client (onglets « Isolation » et « Formes »).</p>
      <?php if ($modules === []): ?>
        <p class="admin-hint">Aucun modèle de module dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Visuel</th>
              <th>Nom</th>
              <th>Géométrie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($modules as $mod): ?>
              <tr>
                <td><?= cat_thumb($mod) ?></td>
                <td><strong><?= htmlspecialchars((string) $mod['nom']) ?></strong></td>
                <td><?= cat_cm((float) $mod['longueur']) ?> × <?= cat_cm((float) $mod['largeur']) ?> — h <?= cat_cm((float) $mod['hauteur']) ?><?php $ch = array_keys(array_filter($mod['faces'] ?? [], fn($v) => $v === 'charpente')); if ($ch !== []): ?> — charpente : <?= htmlspecialchars(implode(', ', array_map('ucfirst', $ch))) ?><?php endif; ?></td>
                <td class="admin-actions">
                  <?= cat_action_defaut('configurateur.php?section=modules', $csrf, 'modules', (string) $mod['id'], !empty($mod['defaut'])) ?>
                  <?= cat_action_edit('configurateur.php?section=modules&edit=' . urlencode((string) $mod['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=modules', $csrf, 'delete_module', (string) $mod['id'], 'Supprimer ce modèle de module du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editModule || $new): modal_open('configurateur.php?section=modules'); ?>
    <div class="admin-card">
      <h2><?= $editModule ? 'Modifier : ' . htmlspecialchars((string) $editModule['nom']) : 'Ajouter un module' ?></h2>
      <form method="post" action="configurateur.php?section=modules" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_module">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editModule['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editModule && ($editModule['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editModule['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="mod-image">Visuel (image)</label>
          <input type="file" id="mod-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mod-nom">Nom</label>
            <input type="text" id="mod-nom" name="nom" required value="<?= htmlspecialchars((string) ($editModule['nom'] ?? '')) ?>" placeholder="Module 6,00 × 3,00 m — h 2,80 m">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row admin-form-check">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mod-longueur">Longueur (cm)</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-dir="-1" aria-label="Diminuer la longueur" title="−60 cm"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <input type="number" id="mod-longueur" name="longueur" step="60" min="2" max="482" readonly tabindex="-1" required value="<?= htmlspecialchars($editModule ? cat_cm_input((float) $editModule['longueur']) : '482') ?>">
              <button type="button" class="step-btn" data-dir="1" aria-label="Augmenter la longueur" title="+60 cm"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>
            <span class="admin-hint">De 2 à 482 cm, par paliers de 60 cm (flèches uniquement).</span>
          </div>
          <div class="admin-form-row">
            <label for="mod-largeur">Largeur (cm)</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-dir="-1" aria-label="Diminuer la largeur" title="−60 cm"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <input type="number" id="mod-largeur" name="largeur" step="60" min="2" max="482" readonly tabindex="-1" required value="<?= htmlspecialchars($editModule ? cat_cm_input((float) $editModule['largeur']) : '300') ?>">
              <button type="button" class="step-btn" data-dir="1" aria-label="Augmenter la largeur" title="+60 cm"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>
            <span class="admin-hint">De 2 à 482 cm, par paliers de 60 cm (flèches uniquement).</span>
          </div>
          <div class="admin-form-row">
            <label for="mod-hauteur">Hauteur sous plafond (cm)</label>
            <input type="number" id="mod-hauteur" name="hauteur" step="0.1" min="100" required value="<?= htmlspecialchars($editModule ? cat_cm_input((float) $editModule['hauteur']) : '280') ?>">
          </div>
        </div>
        <script>
        (function () {
          var MIN = 2, MAX = 482, STEP = 60; // comme les positions des fenêtres côté client
          document.querySelectorAll('.stepper').forEach(function (st) {
            var inp = st.querySelector('input');
            st.querySelectorAll('.step-btn').forEach(function (b) {
              b.addEventListener('click', function () {
                var v = parseFloat(String(inp.value).replace(',', '.')) || MIN;
                v = Math.min(MAX, Math.max(MIN, v + parseInt(b.getAttribute('data-dir'), 10) * STEP));
                inp.value = v;
              });
            });
          });
        })();
        </script>
        <hr class="admin-sep">
        <p class="admin-sep-label">Nature des côtés du module</p>
        <?php
        // Mini-plan du module (comme côté client) : un clic sur un côté bascule
        // mur / charpente. Charpente = fond clair + contour pointillé.
        $modFaces = is_array($editModule['faces'] ?? null) ? $editModule['faces'] : [];
        foreach (['nord', 'est', 'sud', 'ouest'] as $fk) {
            $modFaces[$fk] = ($modFaces[$fk] ?? 'mur') === 'charpente' ? 'charpente' : 'mur';
        }
        $modL = max(0.5, (float) ($editModule['longueur'] ?? 6.0));
        $modl = max(0.5, (float) ($editModule['largeur'] ?? 3.0));
        $planW = 340; $planH = 230; $planMargin = 46; $planEp = 16;
        $planScale = min(($planW - 2 * $planMargin) / $modL, ($planH - 2 * $planMargin) / $modl);
        $pl = $modL * $planScale; $pb = $modl * $planScale;
        $px0 = ($planW - $pl) / 2; $py0 = ($planH - $pb) / 2;
        $faceRect = [
            'nord' => ['x' => $px0, 'y' => $py0 - $planEp, 'w' => $pl, 'h' => $planEp],
            'sud' => ['x' => $px0, 'y' => $py0 + $pb, 'w' => $pl, 'h' => $planEp],
            'ouest' => ['x' => $px0 - $planEp, 'y' => $py0, 'w' => $planEp, 'h' => $pb],
            'est' => ['x' => $px0 + $pl, 'y' => $py0, 'w' => $planEp, 'h' => $pb],
        ];
        ?>
        <svg id="mod-plan" viewBox="0 0 <?= $planW ?> <?= $planH ?>" style="width:100%;max-width:340px;height:auto;border:1px solid var(--gray-border);border-radius:var(--border-radius);background:#fff;" role="img" aria-label="Plan du module — cliquez un côté pour basculer mur / charpente">
          <rect x="<?= $px0 ?>" y="<?= $py0 ?>" width="<?= $pl ?>" height="<?= $pb ?>" fill="#faf7f2" stroke="#a8a29e" stroke-dasharray="5 4" />
          <?php foreach ($faceRect as $fk => $r): ?>
          <rect class="mod-face <?= $modFaces[$fk] === 'charpente' ? 'charpente' : 'mur' ?>" data-face="<?= $fk ?>"
            x="<?= $r['x'] ?>" y="<?= $r['y'] ?>" width="<?= $r['w'] ?>" height="<?= $r['h'] ?>" />
          <?php endforeach; ?>
        </svg>
        <p class="admin-hint">Cliquez un côté pour basculer <strong>mur</strong> / <strong>charpente</strong> (charpente : fond clair, contour pointillé — pas de mur sur ce côté).</p>
        <p class="admin-hint" id="mod-faces-status"></p>
        <?php foreach (['nord', 'est', 'sud', 'ouest'] as $fk): ?>
        <input type="hidden" name="face_<?= $fk ?>" id="face_<?= $fk ?>" value="<?= $modFaces[$fk] ?>">
        <?php endforeach; ?>
        <script>
        (function () {
          var labels = { mur: 'Mur', charpente: 'Charpente' };
          var status = document.getElementById('mod-faces-status');
          function refresh() {
            var parts = [];
            document.querySelectorAll('#mod-plan .mod-face').forEach(function (r) {
              var fk = r.getAttribute('data-face');
              var inp = document.getElementById('face_' + fk);
              var v = inp ? inp.value : 'mur';
              r.setAttribute('class', 'mod-face ' + v);
              parts.push(fk.charAt(0).toUpperCase() + fk.slice(1) + ' : ' + (labels[v] || v));
            });
            if (status) status.textContent = parts.join(' — ');
          }
          document.querySelectorAll('#mod-plan .mod-face').forEach(function (r) {
            r.addEventListener('click', function () {
              var fk = r.getAttribute('data-face');
              var inp = document.getElementById('face_' + fk);
              if (inp) inp.value = inp.value === 'mur' ? 'charpente' : 'mur';
              refresh();
            });
          });
          refresh();
        })();
        </script>
        <hr class="admin-sep">
        <p class="admin-sep-label">Visibilité des constituants dans le configurateur</p>
        <?php
        // Cases à cocher : rendre visible ou non chaque constituant du module côté client
        $modVis = is_array($editModule['visibilite'] ?? null) ? $editModule['visibilite'] : [];
        foreach (['murs' => 'Murs', 'complexe_toiture' => 'Complexe de toiture', 'plancher' => 'Plancher', 'couverture' => 'Couverture'] as $vk => $vlabel):
            $checked = !array_key_exists($vk, $modVis) || !empty($modVis[$vk]); // visible par défaut
        ?>
        <label><input type="checkbox" name="vis_<?= $vk ?>" value="1"<?= $checked ? ' checked' : '' ?>> <?= $vlabel ?></label>
        <?php endforeach; ?>
        <hr class="admin-sep">
        <p class="admin-hint">Un module ne définit que sa géométrie : l'isolation (mur, plancher, toiture) se choisit dans l'onglet « Isolation », la forme de toiture dans l'onglet « Formes ».</p>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=modules" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'isolation'): ?>
    <div class="admin-card">
      <h2>Isolations (<?= count($isolations) ?>) <?= cat_btn_add('configurateur.php?section=isolation&new=1', 'Ajouter une isolation') ?></h2>
      <p class="admin-hint">L'onglet « Isolation » du configurateur : le client choisit ici le type de mur porteur, de plancher et de toiture du module (références vers les onglets Murs, Planchers et Complexe de toiture). Le visuel est affiché dans le configurateur.</p>
      <?php if ($isolations === []): ?>
        <p class="admin-hint">Aucune isolation dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Mur</th><th>Plancher</th><th>Toiture</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($isolations as $iso): ?>
              <tr>
                <td><?= cat_thumb($iso) ?></td>
                <td><strong><?= htmlspecialchars((string) $iso['nom']) ?></strong></td>
                <td><?= htmlspecialchars($murNames[$iso['mur'] ?? ''] ?? (string) ($iso['mur'] ?? '—')) ?></td>
                <td><?= htmlspecialchars($plancherNames[$iso['plancher'] ?? ''] ?? (string) ($iso['plancher'] ?? '—')) ?></td>
                <td><?= htmlspecialchars($toitureLabels[$iso['toiture'] ?? ''] ?? (string) ($iso['toiture'] ?? '—')) ?></td>
                <td class="admin-actions">
                  <?= cat_action_defaut('configurateur.php?section=isolation', $csrf, 'isolation', (string) $iso['id'], !empty($iso['defaut'])) ?>
                  <?= cat_action_edit('configurateur.php?section=isolation&edit=' . urlencode((string) $iso['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=isolation', $csrf, 'delete_isolation', (string) $iso['id'], 'Supprimer cette isolation du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editIsolation || $new): modal_open('configurateur.php?section=isolation'); ?>
    <div class="admin-card">
      <h2><?= $editIsolation ? 'Modifier : ' . htmlspecialchars((string) $editIsolation['nom']) : 'Ajouter une isolation' ?></h2>
      <form method="post" action="configurateur.php?section=isolation" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_isolation">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editIsolation['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editIsolation && ($editIsolation['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editIsolation['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="iso-image">Visuel (image)</label>
          <input type="file" id="iso-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="iso-nom">Nom</label>
            <input type="text" id="iso-nom" name="nom" required value="<?= htmlspecialchars((string) ($editIsolation['nom'] ?? '')) ?>" placeholder="Isolation standard">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row admin-form-check">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="iso-mur">Type de mur</label>
            <select id="iso-mur" name="mur">
              <?php foreach ($murs as $mur): ?>
                <option value="<?= htmlspecialchars((string) $mur['id']) ?>"<?= (($editIsolation['mur'] ?? ($murs[0]['id'] ?? '')) === $mur['id']) ? ' selected' : '' ?>><?= htmlspecialchars((string) $mur['nom']) ?><?= !empty($mur['epaisseur']) ? ' — ép. ' . cat_cm((float) $mur['epaisseur']) : '' ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="admin-form-row">
            <label for="iso-plancher">Type de plancher</label>
            <select id="iso-plancher" name="plancher">
              <?php foreach ($planchers as $p): ?>
                <option value="<?= htmlspecialchars((string) $p['id']) ?>"<?= (($editIsolation['plancher'] ?? ($planchers[0]['id'] ?? '')) === $p['id']) ? ' selected' : '' ?>><?= htmlspecialchars((string) $p['nom']) ?><?= !empty($p['epaisseur']) ? ' — ép. ' . cat_cm((float) $p['epaisseur']) : '' ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="admin-form-row">
            <label for="iso-toiture">Type de toiture</label>
            <select id="iso-toiture" name="toiture">
              <?php foreach ($toitures as $t): ?>
                <option value="<?= htmlspecialchars((string) $t['id']) ?>"<?= (($editIsolation['toiture'] ?? ($toitures[0]['id'] ?? '')) === $t['id']) ? ' selected' : '' ?>><?= htmlspecialchars((string) $t['nom']) ?><?= !empty($t['epaisseur']) ? ' — ép. ' . cat_cm((float) $t['epaisseur']) : '' ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=isolation" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'modeles'): ?>
    <div class="admin-card">
      <h2>Configurations modèles (<?= count($modeles) ?>)</h2>
      <p class="admin-hint">Configurations enregistrées par un administrateur avec la case « enregistrer en tant que modèle » (zone Sauvegardes du configurateur, avec description et copie PNG du plan). Elles sont proposées aux nouveaux clients à la création de leur compte (page intermédiaire avant le configurateur) et rechargeables à tout moment via le bouton « Modèles » du configurateur. Le crayon permet de modifier le nom, la description et le visuel.</p>
      <?php if ($modeles === []): ?>
        <p class="admin-hint">Aucun modèle pour le moment : connectez-vous au configurateur avec un compte administrateur, puis enregistrez une configuration en cochant « enregistrer en tant que modèle ».</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Nom</th><th>Visuel</th><th>Description</th><th>Enregistré par</th><th>Créé le</th><th>Modifié le</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($modeles as $m): ?>
              <tr>
                <td><strong><?= htmlspecialchars((string) $m['nom']) ?></strong></td>
                <td><?php if ((string) ($m['visuel'] ?? '') !== ''): ?><img src="../<?= ltrim(htmlspecialchars((string) $m['visuel']), '/') ?>" alt="" class="admin-catalogue-thumb"><?php else: ?><span class="admin-hint">—</span><?php endif; ?></td>
                <td><?= htmlspecialchars(mb_strimwidth((string) ($m['description'] ?? ''), 0, 120, '…')) ?></td>
                <td><?= htmlspecialchars((string) ($m['userId'] ?? '')) ?></td>
                <td><?= htmlspecialchars((string) ($m['created'] ?? '')) ?></td>
                <td><?= htmlspecialchars((string) ($m['updated'] ?? '')) ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=modeles&edit=' . urlencode((string) $m['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=modeles', $csrf, 'delete_config', (string) $m['id'], 'Supprimer ce modèle ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editModele): modal_open('configurateur.php?section=modeles'); ?>
    <div class="admin-card">
      <h2>Modifier le modèle : <?= htmlspecialchars((string) $editModele['nom']) ?></h2>
      <form method="post" action="configurateur.php?section=modeles" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="update_config">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) $editModele['id']) ?>">
        <div class="modal-visual-row">
          <?php if ((string) ($editModele['visuel'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editModele['visuel']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_visuel" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="mo-visuel">Nouveau visuel (copie PNG du plan)</label>
          <input type="file" id="mo-visuel" name="visuel" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="admin-form-row">
          <label for="mo-nom">Nom</label>
          <input type="text" id="mo-nom" name="nom" required value="<?= htmlspecialchars((string) $editModele['nom']) ?>">
        </div>
        <div class="admin-form-row">
          <label for="mo-desc">Description (visible par les clients lors du choix du modèle)</label>
          <textarea id="mo-desc" name="description" rows="3"><?= htmlspecialchars((string) ($editModele['description'] ?? '')) ?></textarea>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=modeles" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'autonomie'): ?>
    <div class="admin-card">
      <h2>Autonomie (<?= count($autonomies) ?>) <?= cat_btn_add('configurateur.php?section=autonomie&new=1', 'Ajouter un pack autonomie') ?></h2>
      <p class="admin-hint">Packs « Autonomie » proposés dans la rubrique « Autonomie » des réglages généraux du configurateur : chaque pack est une <strong>liste de systèmes autonomes</strong> (onglet « systèmes Aut. » de la zone Catalogue). Le coût du pack = somme des coûts unitaires de ses systèmes. Le visuel est affiché dans le configurateur.</p>
      <?php if ($autonomies === []): ?>
        <p class="admin-hint">Aucun pack autonomie dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Systèmes autonomes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($autonomies as $a): ?>
              <?php $sysNames = array_values(array_filter(array_map(fn ($sid) => $systemeAutNames[$sid] ?? null, is_array($a['systemes'] ?? null) ? $a['systemes'] : []))); ?>
              <tr>
                <td><?= cat_thumb($a) ?></td>
                <td><strong><?= htmlspecialchars((string) $a['nom']) ?></strong></td>
                <td><?= $sysNames ? htmlspecialchars(implode(', ', $sysNames)) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_defaut('configurateur.php?section=autonomie', $csrf, 'autonomie', (string) $a['id'], !empty($a['defaut'])) ?>
                  <?= cat_action_edit('configurateur.php?section=autonomie&edit=' . urlencode((string) $a['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=autonomie', $csrf, 'delete_autonomie', (string) $a['id'], 'Supprimer ce pack autonomie du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editAutonomie || $new): modal_open('configurateur.php?section=autonomie'); ?>
    <div class="admin-card">
      <h2><?= $editAutonomie ? 'Modifier : ' . htmlspecialchars((string) $editAutonomie['nom']) : 'Ajouter un pack autonomie' ?></h2>
      <form method="post" action="configurateur.php?section=autonomie" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_autonomie">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editAutonomie['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editAutonomie && ($editAutonomie['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editAutonomie['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="au-image">Visuel (image)</label>
          <input type="file" id="au-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max. Affiché dans le configurateur.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="au-nom">Nom</label>
            <input type="text" id="au-nom" name="nom" required value="<?= htmlspecialchars((string) ($editAutonomie['nom'] ?? '')) ?>" placeholder="Autonomie standard">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row admin-form-check">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="admin-form-row">
          <label>Systèmes autonomes du pack (onglet « systèmes Aut. »)</label>
          <?php if ($systemesAut === []): ?>
            <p class="admin-hint">Aucun système autonome dans le catalogue « systèmes Aut. » — créez-en d'abord dans la zone Catalogue.</p>
          <?php else: ?>
            <?php $selSys = is_array($editAutonomie['systemes'] ?? null) ? $editAutonomie['systemes'] : []; ?>
            <?php foreach ($systemesAut as $s): ?>
              <label class="admin-hint" style="display:flex; gap:6px; align-items:center;">
                <input type="checkbox" name="systemes[]" value="<?= htmlspecialchars((string) $s['id']) ?>"<?= in_array((string) $s['id'], $selSys, true) ? ' checked' : '' ?>>
                <?= htmlspecialchars((string) $s['nom']) ?> — <?= cat_cm((float) ($s['largeur'] ?? 0)) ?> × <?= cat_cm((float) ($s['hauteur'] ?? 0)) ?><?= +($s['tarif'] ?? 0) > 0 ? ' — ' . cat_eur((float) $s['tarif']) . ' €' : '' ?>
              </label>
            <?php endforeach; ?>
          <?php endif; ?>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=autonomie" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'promotions'): ?>
    <?php $today = date('Y-m-d'); ?>
    <div class="admin-card">
      <h2>Promotions (<?= count($promotions) ?>) <?= cat_btn_add('configurateur.php?section=promotions&new=1', 'Ajouter une promotion') ?></h2>
      <p class="admin-hint">Codes promotionnels (zone Structure, onglet épinglé à droite) : un <strong>code</strong>, une <strong>période</strong> (date de début et de fin, incluses) et une <strong>réduction en %</strong>, affectée à un ou plusieurs <strong>modules</strong>. Côté client, le code saisi dans la rubrique « Promotion » des réglages généraux applique la réduction, tant que la date du jour est dans la période, aux <strong>éléments des modules concernés</strong> (murs, plancher, toitures, couverture, ouvrants, charpente, fenêtres de toit — le module lui-même n'a pas de tarif).</p>
      <?php if ($promotions === []): ?>
        <p class="admin-hint">Aucune promotion pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Code</th><th>Période</th><th>Réduction</th><th>Modules affectés</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($promotions as $p): ?>
              <?php $mods = array_values(array_filter(array_map(fn ($mid) => $moduleNames[$mid] ?? null, is_array($p['modules'] ?? null) ? $p['modules'] : []))); ?>
              <?php $active = ($p['dateDebut'] ?? '') <= $today && $today <= ($p['dateFin'] ?? ''); ?>
              <tr>
                <td><strong><?= htmlspecialchars((string) $p['code']) ?></strong></td>
                <td>du <?= htmlspecialchars((string) $p['dateDebut']) ?> au <?= htmlspecialchars((string) $p['dateFin']) ?></td>
                <td>−<?= htmlspecialchars((string) $p['reduction']) ?> %</td>
                <td><?= $mods ? htmlspecialchars(implode(', ', $mods)) : '—' ?></td>
                <td><?= $active ? '<span class="admin-badge-defaut">active</span>' : 'inactive' ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=promotions&edit=' . urlencode((string) $p['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=promotions', $csrf, 'delete_promotion', (string) $p['id'], 'Supprimer cette promotion ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editPromotion || $new): modal_open('configurateur.php?section=promotions'); ?>
    <div class="admin-card">
      <h2><?= $editPromotion ? 'Modifier : ' . htmlspecialchars((string) $editPromotion['code']) : 'Ajouter une promotion' ?></h2>
      <form method="post" action="configurateur.php?section=promotions">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_promotion">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editPromotion['id'] ?? '')) ?>">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pr-code">Code promotion</label>
            <input type="text" id="pr-code" name="code" required value="<?= htmlspecialchars((string) ($editPromotion['code'] ?? '')) ?>" placeholder="BARACCA10" style="text-transform:uppercase">
          </div>
          <div class="admin-form-row">
            <label for="pr-reduction">Réduction (%)</label>
            <input type="number" id="pr-reduction" name="reduction" step="0.5" min="0" max="100" required value="<?= htmlspecialchars((string) ($editPromotion['reduction'] ?? '10')) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pr-debut">Date de début</label>
            <input type="date" id="pr-debut" name="dateDebut" required value="<?= htmlspecialchars((string) ($editPromotion['dateDebut'] ?? $today)) ?>">
          </div>
          <div class="admin-form-row">
            <label for="pr-fin">Date de fin (incluse)</label>
            <input type="date" id="pr-fin" name="dateFin" required value="<?= htmlspecialchars((string) ($editPromotion['dateFin'] ?? date('Y-m-d', strtotime('+30 days')))) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="admin-form-row">
          <label>Modules auxquels la promotion est affectée</label>
          <?php if ($modules === []): ?>
            <p class="admin-hint">Aucun module dans le catalogue — créez-en d'abord dans l'onglet « Modules ».</p>
          <?php else: ?>
            <?php $selMods = is_array($editPromotion['modules'] ?? null) ? $editPromotion['modules'] : []; ?>
            <?php foreach ($modules as $m): ?>
              <label class="admin-hint" style="display:flex; gap:6px; align-items:center;">
                <input type="checkbox" name="modules[]" value="<?= htmlspecialchars((string) $m['id']) ?>"<?= in_array((string) $m['id'], $selMods, true) ? ' checked' : '' ?>>
                <?= htmlspecialchars((string) $m['nom']) ?> — <?= cat_cm((float) $m['longueur']) ?> × <?= cat_cm((float) $m['largeur']) ?> cm
              </label>
            <?php endforeach; ?>
          <?php endif; ?>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=promotions" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'formes'): ?>
    <div class="admin-card">
      <h2>Formes de toiture (<?= count($formes) ?>) <?= cat_btn_add('configurateur.php?section=formes&new=1', 'Ajouter une forme') ?></h2>
      <p class="admin-hint">Formes de toiture proposées dans les modules : la géométrie (monopente, deux pentes = pignon, quatre pentes = croupe) et la pente de chaque versant sont définies ici, puis référencées par chaque module. Le visuel est affiché dans le configurateur.</p>
      <?php if ($formes === []): ?>
        <p class="admin-hint">Aucune forme de toiture dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Géométrie</th><th>Pente(s)</th><th>Débordée</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($formes as $fo): ?>
              <tr>
                <td><?= cat_thumb($fo) ?></td>
                <td><strong><?= htmlspecialchars((string) $fo['nom']) ?></strong></td>
                <td><?= htmlspecialchars($formeGeoLabels[$fo['geometrie'] ?? ''] ?? (string) ($fo['geometrie'] ?? '')) ?></td>
                <td><?= ($fo['geometrie'] ?? '') === 'deuxpentes' ? (int) ($fo['pente1'] ?? 0) . '° / ' . (int) ($fo['pente2'] ?? 0) . '° (par versant)' : (int) ($fo['pente'] ?? 0) . '°' ?></td>
                <td><?= (float) ($fo['depassee'] ?? 30) ?> cm</td>
                <td class="admin-actions">
                  <?= cat_action_defaut('configurateur.php?section=formes', $csrf, 'formes', (string) $fo['id'], !empty($fo['defaut'])) ?>
                  <?= cat_action_edit('configurateur.php?section=formes&edit=' . urlencode((string) $fo['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=formes', $csrf, 'delete_forme', (string) $fo['id'], 'Supprimer cette forme de toiture du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editForme || $new): modal_open('configurateur.php?section=formes'); ?>
    <div class="admin-card">
      <h2><?= $editForme ? 'Modifier : ' . htmlspecialchars((string) $editForme['nom']) : 'Ajouter une forme de toiture' ?></h2>
      <form method="post" action="configurateur.php?section=formes" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_forme">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editForme['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editForme && ($editForme['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editForme['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="fo-image">Visuel (image)</label>
          <input type="file" id="fo-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="fo-nom">Nom</label>
            <input type="text" id="fo-nom" name="nom" required value="<?= htmlspecialchars((string) ($editForme['nom'] ?? '')) ?>" placeholder="Deux pentes 45° — pignon">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row admin-form-check">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="fo-geometrie">Géométrie</label>
            <select id="fo-geometrie" name="geometrie">
              <?php foreach ($formeGeometries as $g): ?>
                <option value="<?= htmlspecialchars((string) $g['id']) ?>"<?= (($editForme['geometrie'] ?? 'monopente') === $g['id']) ? ' selected' : '' ?>><?= htmlspecialchars((string) $g['nom']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="modal-row" id="fo-row-pente">
          <div class="admin-form-row">
            <label for="fo-pente">Pente (°) — monopente / quatre pentes</label>
            <input type="number" id="fo-pente" name="pente" step="1" min="0" max="90" required value="<?= htmlspecialchars((string) ($editForme['pente'] ?? '30')) ?>">
          </div>
        </div>
        <div class="modal-row" id="fo-row-pentes">
          <div class="admin-form-row">
            <label for="fo-pente1">Pente versant 1 (°)</label>
            <input type="number" id="fo-pente1" name="pente1" step="1" min="1" max="90" value="<?= htmlspecialchars((string) ($editForme['pente1'] ?? $editForme['pente'] ?? '30')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="fo-pente2">Pente versant 2 (°)</label>
            <input type="number" id="fo-pente2" name="pente2" step="1" min="1" max="90" value="<?= htmlspecialchars((string) ($editForme['pente2'] ?? $editForme['pente'] ?? '30')) ?>">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="fo-depassee">Débordée de toiture (cm)</label>
            <input type="number" id="fo-depassee" name="depassee" step="0.1" min="0" max="200" value="<?= htmlspecialchars((string) ($editForme['depassee'] ?? '30')) ?>">
            <span class="admin-hint">Débord de la toiture au-delà des murs, utilisé pour le calcul de la surface et les élévations. 0 = aucun débord. Par défaut : 30 cm.</span>
          </div>
        </div>
        <script>
        (function () {
          var sel = document.getElementById('fo-geometrie');
          if (!sel) return;
          var toggle = function () {
            var deux = sel.value === 'deuxpentes';
            document.getElementById('fo-row-pente').style.display = deux ? 'none' : '';
            document.getElementById('fo-row-pentes').style.display = deux ? '' : 'none';
            document.getElementById('fo-pente').required = !deux;
          };
          sel.addEventListener('change', toggle);
          toggle();
        })();
        </script>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=formes" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif ($section === 'charpentes'): ?>
    <div class="admin-card">
      <h2>Charpentes (<?= count($charpentes) ?>) <?= cat_btn_add('configurateur.php?section=charpentes&new=1', 'Ajouter une charpente') ?></h2>
      <p class="admin-hint">Charpentes (à l'identique des ouvrants) : visuel, nom, épaisseur, couleur, coût unitaire et référence Archicad.</p>
      <?php if ($charpentes === []): ?>
        <p class="admin-hint">Aucune charpente dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Épaisseur</th><th>Couleur</th><th>Référence Archicad</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($charpentes as $ch): $rgbC = $ch['rgb'] ?? [140, 107, 89]; ?>
              <tr>
                <td><?= cat_thumb($ch) ?></td>
                <td><strong><?= htmlspecialchars((string) $ch['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($ch['epaisseur'] ?? 0.20)) ?></td>
                <td><span class="admin-color-swatch" style="background-color: <?= cat_hex($rgbC) ?>;"></span> <?= cat_hex($rgbC) ?></td>
                <td><?= ($ch['favori'] ?? '') !== '' ? htmlspecialchars((string) $ch['favori']) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_defaut('configurateur.php?section=charpentes', $csrf, 'charpentes', (string) $ch['id'], !empty($ch['defaut'])) ?>
                  <?= cat_action_edit('configurateur.php?section=charpentes&edit=' . urlencode((string) $ch['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=charpentes', $csrf, 'delete_charpente', (string) $ch['id'], 'Supprimer cette charpente du catalogue ?') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($editCharpente || $new): modal_open('configurateur.php?section=charpentes'); ?>
    <div class="admin-card">
      <h2><?= $editCharpente ? 'Modifier : ' . htmlspecialchars((string) $editCharpente['nom']) : 'Ajouter une charpente' ?></h2>
      <form method="post" action="configurateur.php?section=charpentes" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_charpente">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editCharpente['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editCharpente && ($editCharpente['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editCharpente['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="ch-image">Visuel (image)</label>
          <input type="file" id="ch-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ch-nom">Nom</label>
            <input type="text" id="ch-nom" name="nom" required value="<?= htmlspecialchars((string) ($editCharpente['nom'] ?? '')) ?>" placeholder="Charpente traditionnelle">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row admin-form-check">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ch-epaisseur">Épaisseur (cm)</label>
            <input type="number" id="ch-epaisseur" name="epaisseur" step="0.1" min="1" required value="<?= htmlspecialchars($editCharpente ? cat_cm_input((float) ($editCharpente['epaisseur'] ?? 0.20)) : '20') ?>">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row">
            <?php $rgbCh = $editCharpente['rgb'] ?? [140, 107, 89]; ?>
            <label>Couleur (aperçu, affichée en hex <?= cat_hex($rgbCh) ?>)</label>
            <div class="admin-color-inputs">
              <input type="number" name="r" min="0" max="255" value="<?= (int) ($rgbCh[0] ?? 0) ?>" aria-label="Rouge">
              <input type="number" name="g" min="0" max="255" value="<?= (int) ($rgbCh[1] ?? 0) ?>" aria-label="Vert">
              <input type="number" name="b" min="0" max="255" value="<?= (int) ($rgbCh[2] ?? 0) ?>" aria-label="Bleu">
              <span class="admin-color-swatch" style="background-color: <?= cat_hex($rgbCh) ?>;"></span>
            </div>
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ch-tarif">Coût unitaire (€)</label>
            <input type="number" id="ch-tarif" name="tarif" step="0.01" min="0" value="<?= htmlspecialchars((string) ($editCharpente['tarif'] ?? '0')) ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="ch-favori">Référence Archicad</label>
            <input type="text" id="ch-favori" name="favori" value="<?= htmlspecialchars((string) ($editCharpente['favori'] ?? '')) ?>" placeholder="Nom de la référence Archicad (ex. Baracca — Charpente), vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=charpentes" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif (in_array($section, ['surfaces', 'interieurs', 'couvertures'], true)): ?>
    <?php
      // Carte « Revêtements » : trois onglets — Extérieur (surfaces, habillage
      // des murs), Intérieur (murs + sous-face de toiture) et Toiture
      // (couvertures, par pent). Mêmes champs : visuel, nom, tarif au m² ;
      // pas de référence Archicad pour ces rubriques.
      $revOnglets = [
        'surfaces' => [
          'label' => 'Extérieur', 'items' => $facades,
          'hint' => "Revêtements d'habillage extérieur des murs, choisis côté client sur la carte d'un mur ; le visuel téléversé est utilisé dans les élévations du configurateur.",
          'add' => 'Ajouter un revêtement extérieur', 'placeholder' => 'Bardage bois',
          'empty' => 'Aucun revêtement extérieur dans le catalogue pour le moment.',
          'del' => 'Supprimer ce revêtement extérieur du catalogue ?',
        ],
        'interieurs' => [
          'label' => 'Intérieur', 'items' => $interieurs,
          'hint' => "Revêtements intérieurs (murs et sous-face de toiture), choisis côté client ; leur coût au m² est ajouté au chiffrage des murs et du complexe de toiture.",
          'add' => 'Ajouter un revêtement intérieur', 'placeholder' => 'Placo BA13 + peinture',
          'empty' => 'Aucun revêtement intérieur dans le catalogue pour le moment.',
          'del' => 'Supprimer ce revêtement intérieur du catalogue ?',
        ],
        'couvertures' => [
          'label' => 'Toiture', 'items' => $couvertures,
          'hint' => "Couvertures de toiture choisies par pent côté client ; leur coût au m² est appliqué à la ligne « Couverture » du chiffrage (surface avec débords).",
          'add' => 'Ajouter une couverture de toiture', 'placeholder' => 'Bardeaux bois',
          'empty' => 'Aucune couverture de toiture dans le catalogue pour le moment.',
          'del' => 'Supprimer cette couverture du catalogue ?',
        ],
      ];
      $rev = $revOnglets[$section];
      $revItems = $rev['items'];
    ?>
    <div class="admin-card">
      <h2><?= $rev['label'] ?> (<?= count($revItems) ?>) <?= cat_btn_add('configurateur.php?section=' . $section . '&new=1', $rev['add']) ?></h2>
      <p class="admin-hint"><?= $rev['hint'] ?> Pas de référence Archicad pour cette rubrique.</p>
      <?php if ($revItems === []): ?>
        <p class="admin-hint"><?= $rev['empty'] ?></p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Coût au m²</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($revItems as $f): ?>
              <tr>
                <td>
                  <?php if (($f['image'] ?? '') !== ''): ?>
                    <img src="../<?= ltrim(htmlspecialchars((string) $f['image']), '/') ?>" alt="" class="admin-catalogue-thumb">
                  <?php else: ?>
                    <span class="admin-no-image">—</span>
                  <?php endif; ?>
                </td>
                <td><strong><?= htmlspecialchars((string) $f['nom']) ?></strong></td>
                <td><?= cat_eur((float) ($f['tarif'] ?? 0)) ?> €/m²</td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=' . $section . '&edit=' . urlencode((string) $f['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=' . $section, $csrf, 'delete_enveloppe', (string) $f['id'], $rev['del'], '<input type="hidden" name="sous" value="' . $section . '">') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
    <?php if ($envSous === $section && ($editEnv['item'] || $new)): modal_open('configurateur.php?section=' . $section); ?>
    <div class="admin-card">
      <h3><?= $editEnv['item'] ? 'Modifier : ' . htmlspecialchars((string) $editEnv['item']['nom']) : $rev['add'] ?></h3>
      <form method="post" action="configurateur.php?section=<?= $section ?>" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_enveloppe">
        <input type="hidden" name="sous" value="<?= $section ?>">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editEnv['item']['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editEnv['item'] && ($editEnv['item']['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editEnv['item']['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="fa-image">Visuel (image)</label>
          <input type="file" id="fa-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.<?= $section === 'surfaces' ? ' Utilisé dans les élévations du configurateur.' : '' ?></span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="fa-nom">Nom</label>
            <input type="text" id="fa-nom" name="nom" required value="<?= cat_env_field($editEnv, $section, 'nom') ?>" placeholder="<?= $rev['placeholder'] ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="fa-tarif">Coût au m² (€/m²)</label>
            <input type="number" id="fa-tarif" name="tarif" step="0.01" min="0" value="<?= cat_env_field($editEnv, $section, 'tarif', '0') ?>">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=<?= $section ?>" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php elseif (in_array($section, ['murs', 'planchers', 'toitures'], true)): ?>
    <div class="admin-card">
      <?php if ($section === 'murs'): ?>
      <h2>Murs porteurs (<?= count($murs) ?>) <?= cat_btn_add('configurateur.php?section=murs&new=1', 'Ajouter un type de mur') ?></h2>
      <p class="admin-hint">Types de mur porteur : épaisseur, couleur, revêtements par défaut (extérieur « Extérieur » / intérieur « Intérieur », appliqués côté client), référence Archicad, coût au m² — liés aux modules.</p>
      <?php if ($murs === []): ?>
        <p class="admin-hint">Aucun type de mur dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Épaisseur</th><th>Couleur</th><th>Référence Archicad</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($murs as $mur): $rgb = $mur['rgb'] ?? [158, 158, 158]; ?>
              <tr>
                <td><?= cat_thumb($mur) ?></td>
                <td><strong><?= htmlspecialchars((string) $mur['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($mur['epaisseur'] ?? 0.20)) ?></td>
                <td><span class="admin-color-swatch" style="background-color: <?= cat_hex($rgb) ?>;"></span> <?= cat_hex($rgb) ?></td>
                <td><?= ($mur['favori'] ?? '') !== '' ? htmlspecialchars((string) $mur['favori']) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=murs&edit=' . urlencode((string) $mur['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=murs', $csrf, 'delete_enveloppe', (string) $mur['id'], 'Supprimer ce type de mur du catalogue ?', '<input type="hidden" name="sous" value="murs">') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
      <?php elseif ($section === 'planchers'): ?>
      <h2>Planchers (<?= count($planchers) ?>) <?= cat_btn_add('configurateur.php?section=planchers&new=1', 'Ajouter un plancher') ?></h2>
      <p class="admin-hint">Types de plancher : épaisseur (dessinée en élévation, +21,7 cm au-delà de la ligne directrice des murs), revêtements par défaut (supérieur « Intérieur » / chants « Extérieur », appliqués côté client), référence Archicad, coût au m² — liés aux modules.</p>
      <?php if ($planchers === []): ?>
        <p class="admin-hint">Aucun plancher dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Épaisseur</th><th>Référence Archicad</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($planchers as $p): ?>
              <tr>
                <td><?= cat_thumb($p) ?></td>
                <td><strong><?= htmlspecialchars((string) $p['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($p['epaisseur'] ?? 0.20)) ?></td>
                <td><?= ($p['favori'] ?? '') !== '' ? htmlspecialchars((string) $p['favori']) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=planchers&edit=' . urlencode((string) $p['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=planchers', $csrf, 'delete_enveloppe', (string) $p['id'], 'Supprimer ce plancher du catalogue ?', '<input type="hidden" name="sous" value="planchers">') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
      <?php else: ?>
      <h2>Complexe de toiture (<?= count($toitures) ?>) <?= cat_btn_add('configurateur.php?section=toitures&new=1', 'Ajouter un type de toiture') ?></h2>
      <p class="admin-hint">Types de toiture : épaisseur (bande au-dessus de la ligne directrice en élévation), couleur, revêtements par défaut (sous-face « Intérieur » / couverture « Toiture », appliqués à chaque pent côté client), référence Archicad, coût au m². La géométrie (monopente / deux pentes / quatre pentes) se règle dans l'onglet « Formes ».</p>
      <?php if ($toitures === []): ?>
        <p class="admin-hint">Aucun type de toiture dans le catalogue pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr><th>Visuel</th><th>Nom</th><th>Épaisseur</th><th>Couleur</th><th>Référence Archicad</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <?php foreach ($toitures as $t): $rgbT = $t['rgb'] ?? [120, 113, 108]; ?>
              <tr>
                <td><?= cat_thumb($t) ?></td>
                <td><strong><?= htmlspecialchars((string) $t['nom']) ?></strong></td>
                <td><?= cat_cm((float) ($t['epaisseur'] ?? 0.30)) ?></td>
                <td><span class="admin-color-swatch" style="background-color: <?= cat_hex($rgbT) ?>;"></span> <?= cat_hex($rgbT) ?></td>
                <td><?= ($t['favori'] ?? '') !== '' ? htmlspecialchars((string) $t['favori']) : '—' ?></td>
                <td class="admin-actions">
                  <?= cat_action_edit('configurateur.php?section=toitures&edit=' . urlencode((string) $t['id'])) ?>
                  <?= cat_action_delete('configurateur.php?section=toitures', $csrf, 'delete_enveloppe', (string) $t['id'], 'Supprimer ce type de toiture du catalogue ?', '<input type="hidden" name="sous" value="toitures">') ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
      <?php endif; ?>
    </div>

    <?php if ($envSous === 'murs' && ($editEnv['item'] || $new)): modal_open('configurateur.php?section=' . $section); ?>
    <div class="admin-card">
      <h3><?= $editEnv['item'] ? 'Modifier : ' . htmlspecialchars((string) $editEnv['item']['nom']) : 'Ajouter un type de mur' ?></h3>
      <form method="post" action="configurateur.php?section=<?= $section ?>" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_enveloppe">
        <input type="hidden" name="sous" value="murs">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editEnv['item']['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editEnv['item'] && ($editEnv['item']['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editEnv['item']['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="mur-image">Visuel (image)</label>
          <input type="file" id="mur-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mur-nom">Nom</label>
            <input type="text" id="mur-nom" name="nom" required value="<?= cat_env_field($editEnv, 'murs', 'nom') ?>" placeholder="Mur CLT 140 mm">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mur-epaisseur">Épaisseur (cm)</label>
            <input type="number" id="mur-epaisseur" name="epaisseur" step="0.1" min="1" required value="<?= htmlspecialchars($editEnv['item'] ? cat_cm_input((float) ($editEnv['item']['epaisseur'] ?? 0.14)) : '14') ?>">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row">
            <?php $rgbEdit = $editEnv['item']['rgb'] ?? [158, 158, 158]; ?>
            <label>Couleur (aperçu plan, affichée en hex <?= cat_hex($rgbEdit) ?>)</label>
            <div class="admin-color-inputs">
              <input type="number" name="r" min="0" max="255" value="<?= (int) ($rgbEdit[0] ?? 0) ?>" aria-label="Rouge">
              <input type="number" name="g" min="0" max="255" value="<?= (int) ($rgbEdit[1] ?? 0) ?>" aria-label="Vert">
              <input type="number" name="b" min="0" max="255" value="<?= (int) ($rgbEdit[2] ?? 0) ?>" aria-label="Bleu">
              <span class="admin-color-swatch" style="background-color: <?= cat_hex($rgbEdit) ?>;"></span>
            </div>
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mur-tarif">Coût au m² (€/m²)</label>
            <input type="number" id="mur-tarif" name="tarif" step="0.01" min="0" value="<?= cat_env_field($editEnv, 'murs', 'tarif', '0') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mur-surface">Revêtement extérieur par défaut (catalogue « Extérieur »)</label>
            <select id="mur-surface" name="surface"><?= cat_select_options($facades, (string) ($editEnv['item']['surface'] ?? ($facades[0]['id'] ?? ''))) ?></select>
          </div>
          <div class="admin-form-row">
            <label for="mur-interieur">Revêtement intérieur par défaut (catalogue « Intérieur »)</label>
            <select id="mur-interieur" name="interieur"><?= cat_select_options($interieurs, (string) ($editEnv['item']['interieur'] ?? ($interieurs[0]['id'] ?? ''))) ?></select>
          </div>
        </div>
        <p class="admin-hint">Ces revêtements sont présélectionnés par défaut dans le configurateur client (le client peut les changer mur par mur).</p>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="mur-favori">Référence Archicad</label>
            <input type="text" id="mur-favori" name="favori" value="<?= cat_env_field($editEnv, 'murs', 'favori') ?>" placeholder="Nom de la référence Archicad (ex. Baracca — Mur CLT), vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=<?= $section ?>" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php if ($envSous === 'planchers' && ($editEnv['item'] || $new)): modal_open('configurateur.php?section=' . $section); ?>
    <div class="admin-card">
      <h3><?= $editEnv['item'] ? 'Modifier : ' . htmlspecialchars((string) $editEnv['item']['nom']) : 'Ajouter un plancher' ?></h3>
      <form method="post" action="configurateur.php?section=<?= $section ?>" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_enveloppe">
        <input type="hidden" name="sous" value="planchers">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editEnv['item']['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editEnv['item'] && ($editEnv['item']['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editEnv['item']['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="pl-image">Visuel (image)</label>
          <input type="file" id="pl-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pl-nom">Nom</label>
            <input type="text" id="pl-nom" name="nom" required value="<?= cat_env_field($editEnv, 'planchers', 'nom') ?>" placeholder="Dalle CLT + chape">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pl-epaisseur">Épaisseur (cm)</label>
            <input type="number" id="pl-epaisseur" name="epaisseur" step="0.1" min="1" required value="<?= htmlspecialchars($editEnv['item'] ? cat_cm_input((float) ($editEnv['item']['epaisseur'] ?? 0.20)) : '20') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pl-tarif">Coût au m² (€/m²)</label>
            <input type="number" id="pl-tarif" name="tarif" step="0.01" min="0" value="<?= cat_env_field($editEnv, 'planchers', 'tarif', '0') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pl-rev-sup">Revêtement supérieur par défaut (catalogue « Intérieur »)</label>
            <select id="pl-rev-sup" name="revetement_sup"><?= cat_select_options($interieurs, (string) ($editEnv['item']['revetement_sup'] ?? ($interieurs[0]['id'] ?? ''))) ?></select>
          </div>
          <div class="admin-form-row">
            <label for="pl-rev-chants">Revêtement des chants par défaut (catalogue « Extérieur »)</label>
            <select id="pl-rev-chants" name="revetement_chants"><?= cat_select_options($facades, (string) ($editEnv['item']['revetement_chants'] ?? ($facades[0]['id'] ?? ''))) ?></select>
          </div>
        </div>
        <p class="admin-hint">Ces revêtements sont présélectionnés par défaut dans le configurateur client.</p>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="pl-favori">Référence Archicad</label>
            <input type="text" id="pl-favori" name="favori" value="<?= cat_env_field($editEnv, 'planchers', 'favori') ?>" placeholder="Nom de la référence Archicad (ex. Baracca — Dalle CLT), vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=<?= $section ?>" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php if ($envSous === 'toitures' && ($editEnv['item'] || $new)): modal_open('configurateur.php?section=' . $section); ?>
    <div class="admin-card">
      <h3><?= $editEnv['item'] ? 'Modifier : ' . htmlspecialchars((string) $editEnv['item']['nom']) : 'Ajouter un type de toiture' ?></h3>
      <form method="post" action="configurateur.php?section=<?= $section ?>" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
        <input type="hidden" name="action" value="save_enveloppe">
        <input type="hidden" name="sous" value="toitures">
        <input type="hidden" name="id" value="<?= htmlspecialchars((string) ($editEnv['item']['id'] ?? '')) ?>">
        <div class="modal-visual-row">
          <?php if ($editEnv['item'] && ($editEnv['item']['image'] ?? '') !== ''): ?>
            <img src="../<?= ltrim(htmlspecialchars((string) $editEnv['item']['image']), '/') ?>" alt="" class="modal-visual-img">
            <label class="admin-hint"><input type="checkbox" name="remove_image" value="1"> Supprimer le visuel</label>
          <?php endif; ?>
          <label for="to-image">Visuel (image)</label>
          <input type="file" id="to-image" name="image" accept="image/*">
          <span class="admin-hint">JPG, PNG, WebP ou GIF — 5 Mo max.</span>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="to-nom">Nom</label>
            <input type="text" id="to-nom" name="nom" required value="<?= cat_env_field($editEnv, 'toitures', 'nom') ?>" placeholder="Toiture deux pentes">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="to-epaisseur">Épaisseur (cm)</label>
            <input type="number" id="to-epaisseur" name="epaisseur" step="0.1" min="1" required value="<?= htmlspecialchars($editEnv['item'] ? cat_cm_input((float) ($editEnv['item']['epaisseur'] ?? 0.30)) : '30') ?>">
          </div>
        </div>
        <div class="modal-row">
          <div class="admin-form-row">
            <?php $rgbToit = $editEnv['item']['rgb'] ?? [120, 113, 108]; ?>
            <label>Couleur (aperçu élévation, affichée en hex <?= cat_hex($rgbToit) ?>)</label>
            <div class="admin-color-inputs">
              <input type="number" name="r" min="0" max="255" value="<?= (int) ($rgbToit[0] ?? 0) ?>" aria-label="Rouge">
              <input type="number" name="g" min="0" max="255" value="<?= (int) ($rgbToit[1] ?? 0) ?>" aria-label="Vert">
              <input type="number" name="b" min="0" max="255" value="<?= (int) ($rgbToit[2] ?? 0) ?>" aria-label="Bleu">
              <span class="admin-color-swatch" style="background-color: <?= cat_hex($rgbToit) ?>;"></span>
            </div>
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="to-tarif">Coût au m² (€/m²)</label>
            <input type="number" id="to-tarif" name="tarif" step="0.01" min="0" value="<?= cat_env_field($editEnv, 'toitures', 'tarif', '0') ?>">
          </div>
        </div>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="to-interieur">Revêtement intérieur par défaut — sous-face (catalogue « Intérieur »)</label>
            <select id="to-interieur" name="interieur"><?= cat_select_options($interieurs, (string) ($editEnv['item']['interieur'] ?? ($interieurs[0]['id'] ?? ''))) ?></select>
          </div>
          <div class="admin-form-row">
            <label for="to-couverture">Couverture de toiture par défaut (catalogue « Toiture »)</label>
            <select id="to-couverture" name="couverture"><?= cat_select_options($couvertures, (string) ($editEnv['item']['couverture'] ?? ($couvertures[0]['id'] ?? ''))) ?></select>
          </div>
        </div>
        <p class="admin-hint">Ces revêtements sont appliqués par défaut à chaque pent de toiture dans le configurateur client.</p>
        <hr class="admin-sep">
        <div class="modal-row">
          <div class="admin-form-row">
            <label for="to-favori">Référence Archicad</label>
            <input type="text" id="to-favori" name="favori" value="<?= cat_env_field($editEnv, 'toitures', 'favori') ?>" placeholder="Nom de la référence Archicad (ex. Baracca — Toiture deux pentes), vide = aucune">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-cta">Enregistrer</button>
          <a href="configurateur.php?section=<?= $section ?>" class="btn btn-secondary">Annuler</a>
        </div>
      </form>
    </div>
    <?php modal_close(); endif; ?>

    <?php endif; ?>
      <?php endif; ?>
    </div>
<?php endforeach; ?>
<?php
include __DIR__ . '/../includes/admin-footer.php';
