<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Configurations enregistrées par les clients dans le configurateur
 * (data/configurations.json), pour pouvoir les reprendre ultérieurement.
 */

require_once __DIR__ . '/../config.php';

function archicad_configurations_file(): string
{
    return ARCHICAD_DATA_DIR . '/configurations.json';
}

// ---------------------------------------------------------------------------
// Visuels des configurations « modèles » (copies PNG du plan), servis en web
// depuis assets/images/modeles/ (comme les visuels du catalogue)
// ---------------------------------------------------------------------------

function archicad_modeles_images_dir(): string
{
    return __DIR__ . '/../assets/images/modeles';
}

// Convertit un chemin web (/assets/images/modeles/x.png) en chemin filesystem,
// ou null si le chemin sort du dossier des visuels de modèles
function archicad_modele_visuel_fs_path(string $webPath): ?string
{
    $prefix = '/assets/images/modeles/';
    if (strpos($webPath, $prefix) !== 0) {
        return null;
    }
    $rel = substr($webPath, strlen($prefix));
    if ($rel === '' || strpos($rel, '/') !== false || strpos($rel, '..') !== false) {
        return null;
    }
    return archicad_modeles_images_dir() . '/' . $rel;
}

function archicad_modele_delete_visuel_file(?string $webPath): void
{
    if ($webPath === null || $webPath === '') {
        return;
    }
    $fs = archicad_modele_visuel_fs_path($webPath);
    if ($fs !== null && is_file($fs)) {
        @unlink($fs);
    }
}

// Stocke un PNG envoyé en data URL (capture du plan côté client) → chemin web,
// ou null si la data URL n'est pas un PNG valide (5 Mo max)
function archicad_modele_store_visuel_data(string $id, string $dataUrl): ?string
{
    if (!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $m)) {
        return null;
    }
    $bin = base64_decode($m[1], true);
    if ($bin === false || strlen($bin) === 0 || strlen($bin) > 5 * 1024 * 1024) {
        return null;
    }
    if (substr($bin, 0, 8) !== "\x89PNG\r\n\x1a\n" || @getimagesizefromstring($bin) === false) {
        return null;
    }
    $dir = archicad_modeles_images_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $name = $id . '_' . bin2hex(random_bytes(4)) . '.png';
    if (file_put_contents($dir . '/' . $name, $bin, LOCK_EX) === false) {
        return null;
    }
    return '/assets/images/modeles/' . $name;
}

// Stocke un fichier image uploadé (édition depuis le back-office).
// Retourne ['ok' => bool, 'webPath' => ?string, 'error' => ?string].
function archicad_modele_store_visuel_file(array $file, string $id): array
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
    $dir = archicad_modeles_images_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $name = $id . '_' . bin2hex(random_bytes(4)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        return $fail('Échec de l\'enregistrement de l\'image.');
    }
    return ['ok' => true, 'webPath' => '/assets/images/modeles/' . $name, 'error' => null];
}

function archicad_load_configurations(): array
{
    $file = archicad_configurations_file();
    if (!is_file($file)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || !isset($data['configurations']) || !is_array($data['configurations'])) {
        return [];
    }
    return $data['configurations'];
}

function archicad_save_configurations(array $configurations): bool
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    return file_put_contents(archicad_configurations_file(), json_encode(['configurations' => array_values($configurations)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

// Configurations d'un client, de la plus récente à la plus ancienne
function archicad_user_configurations(string $userId): array
{
    $list = array_values(array_filter(archicad_load_configurations(), function ($c) use ($userId) {
        return ($c['userId'] ?? '') === $userId;
    }));
    usort($list, function ($a, $b) {
        return strcmp((string) ($b['updated'] ?? ''), (string) ($a['updated'] ?? ''));
    });
    return $list;
}

function archicad_find_configuration(string $id): ?array
{
    foreach (archicad_load_configurations() as $c) {
        if (($c['id'] ?? '') === $id) {
            return $c;
        }
    }
    return null;
}

/**
 * Enregistre une configuration pour un client. Si $id est fourni et appartient
 * au client, la configuration est mise à jour ; sinon une nouvelle est créée.
 * $config est l'état brut du configurateur, $json le fichier d'export généré.
 * $modele = true marque la configuration comme « modèle » (réservé aux admins,
 * vérifié côté API) : proposée aux nouveaux clients et listée dans le back-office.
 * $description et $visuelData (data URL PNG de la capture du plan) sont
 * enregistrés pour toute sauvegarde manuelle (modèle ou non).
 * Retourne l'enregistrement.
 */
function archicad_save_configuration(string $userId, string $nom, array $config, ?string $id = null, ?string $json = null, bool $modele = false, string $description = '', ?string $visuelData = null): array
{
    $configs = archicad_load_configurations();
    $now = date('Y-m-d H:i:s');
    if ($id !== null && $id !== '') {
        foreach ($configs as $i => $c) {
            if (($c['id'] ?? '') === $id && ($c['userId'] ?? '') === $userId) {
                $configs[$i]['nom'] = $nom;
                $configs[$i]['config'] = $config;
                if ($json !== null) {
                    $configs[$i]['json'] = $json;
                }
                $configs[$i]['modele'] = $modele;
                $configs[$i]['description'] = $description;
                if ($visuelData !== null && $visuelData !== '') {
                    $web = archicad_modele_store_visuel_data((string) $c['id'], $visuelData);
                    if ($web !== null) {
                        archicad_modele_delete_visuel_file((string) ($c['visuel'] ?? ''));
                        $configs[$i]['visuel'] = $web;
                    }
                }
                $configs[$i]['updated'] = $now;
                archicad_save_configurations($configs);
                return $configs[$i];
            }
        }
    }
    $record = [
        'id' => bin2hex(random_bytes(8)),
        'userId' => $userId,
        'nom' => $nom,
        'config' => $config,
        'json' => $json ?? '',
        'modele' => $modele,
        'description' => $description,
        'visuel' => '',
        'created' => $now,
        'updated' => $now,
    ];
    if ($visuelData !== null && $visuelData !== '') {
        $web = archicad_modele_store_visuel_data((string) $record['id'], $visuelData);
        if ($web !== null) {
            $record['visuel'] = $web;
        }
    }
    $configs[] = $record;
    archicad_save_configurations($configs);
    return $record;
}

// Toutes les configurations marquées « modèle » (enregistrées par un admin),
// de la plus récente à la plus ancienne
function archicad_configurations_modeles(): array
{
    $list = array_values(array_filter(archicad_load_configurations(), fn ($c) => !empty($c['modele'])));
    usort($list, fn ($a, $b) => strcmp((string) ($b['updated'] ?? ''), (string) ($a['updated'] ?? '')));
    return $list;
}

/**
 * Copie un modèle dans les configurations d'un client (nouvel id, le client en
 * devient propriétaire ; le flag « modele » n'est pas repris).
 * Retourne le nouvel enregistrement, ou null si le modèle est introuvable.
 */
function archicad_apply_modele(string $modeleId, string $userId): ?array
{
    $src = archicad_find_configuration($modeleId);
    if ($src === null || empty($src['modele']) || !is_array($src['config'] ?? null)) {
        return null;
    }
    return archicad_save_configuration($userId, (string) $src['nom'], $src['config'], null, (string) ($src['json'] ?? ''));
}

// Suppression réservée au back-office (peu importe le propriétaire) ;
// supprime aussi le visuel du modèle si présent
function archicad_admin_delete_configuration(string $id): bool
{
    $configs = archicad_load_configurations();
    foreach ($configs as $i => $c) {
        if (($c['id'] ?? '') === $id) {
            archicad_modele_delete_visuel_file((string) ($c['visuel'] ?? ''));
            unset($configs[$i]);
            return archicad_save_configurations($configs);
        }
    }
    return false;
}

/**
 * Modification d'un modèle depuis le back-office : nom, description, et visuel
 * (nouveau fichier uploadé, ou suppression demandée ; l'ancien fichier est
 * alors supprimé). $visuelFile est une entrée $_FILES ou null.
 * Retourne ['ok' => bool, 'error' => ?string].
 */
function archicad_admin_update_configuration(string $id, string $nom, string $description, ?array $visuelFile = null, bool $removeVisuel = false): array
{
    $configs = archicad_load_configurations();
    foreach ($configs as $i => $c) {
        if (($c['id'] ?? '') === $id && !empty($c['modele'])) {
            if ($visuelFile !== null && ($visuelFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $stored = archicad_modele_store_visuel_file($visuelFile, $id);
                if (!$stored['ok']) {
                    return ['ok' => false, 'error' => (string) $stored['error']];
                }
                archicad_modele_delete_visuel_file((string) ($c['visuel'] ?? ''));
                $configs[$i]['visuel'] = (string) $stored['webPath'];
            } elseif ($removeVisuel && (string) ($c['visuel'] ?? '') !== '') {
                archicad_modele_delete_visuel_file((string) $c['visuel']);
                $configs[$i]['visuel'] = '';
            }
            $configs[$i]['nom'] = $nom;
            $configs[$i]['description'] = $description;
            $configs[$i]['updated'] = date('Y-m-d H:i:s');
            archicad_save_configurations($configs);
            return ['ok' => true, 'error' => null];
        }
    }
    return ['ok' => false, 'error' => 'Modèle introuvable.'];
}

// Suppression réservée au propriétaire de la configuration
function archicad_delete_configuration(string $userId, string $id): bool
{
    $configs = archicad_load_configurations();
    foreach ($configs as $i => $c) {
        if (($c['id'] ?? '') === $id && ($c['userId'] ?? '') === $userId) {
            unset($configs[$i]);
            return archicad_save_configurations($configs);
        }
    }
    return false;
}

// Suppression de toutes les configurations d'un client (ex. à la suppression de son compte)
function archicad_delete_user_configurations(string $userId): void
{
    $configs = array_values(array_filter(archicad_load_configurations(), function ($c) use ($userId) {
        return ($c['userId'] ?? '') !== $userId;
    }));
    archicad_save_configurations($configs);
}

function archicad_count_configurations(string $userId): int
{
    return count(array_filter(archicad_load_configurations(), function ($c) use ($userId) {
        return ($c['userId'] ?? '') === $userId;
    }));
}

function archicad_configurations_total(): int
{
    return count(archicad_load_configurations());
}
