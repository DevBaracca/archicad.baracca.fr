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
 * Retourne l'enregistrement.
 */
function archicad_save_configuration(string $userId, string $nom, array $config, ?string $id = null, ?string $json = null): array
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
        'created' => $now,
        'updated' => $now,
    ];
    $configs[] = $record;
    archicad_save_configurations($configs);
    return $record;
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
