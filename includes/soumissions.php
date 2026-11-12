<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Configurations soumises à Baracca via le bouton « Soumettre » du
 * configurateur (data/soumissions/, un fichier JSON par soumission),
 * consultables depuis le back-office.
 */

require_once __DIR__ . '/../config.php';

function archicad_soumissions_dir(): string
{
    return ARCHICAD_DATA_DIR . '/soumissions';
}

/**
 * Enregistre une soumission pour un client connecté.
 * Retourne ['fichier' => nom du fichier créé, ...] ou null en cas d'échec.
 */
function archicad_add_soumission(array $configuration, array $user): ?array
{
    if (!is_dir(archicad_soumissions_dir())) {
        mkdir(archicad_soumissions_dir(), 0775, true);
    }
    $nom = preg_replace('/[^A-Za-z0-9_-]/', '_', (string) ($configuration['module']['nom'] ?? 'module'));
    $fichier = date('Ymd_His') . '_' . (string) $user['id'] . '_' . $nom . '.json';
    // Évite l'écrasement si deux soumissions identiques dans la même seconde
    if (is_file(archicad_soumissions_dir() . '/' . $fichier)) {
        $fichier = date('Ymd_His') . '_' . (string) $user['id'] . '_' . $nom . '-' . bin2hex(random_bytes(3)) . '.json';
    }
    $record = [
        'soumis_le' => date('Y-m-d H:i:s'),
        'utilisateur' => [
            'id' => (string) $user['id'],
            'email' => (string) $user['email'],
            'nom' => (string) ($user['nom'] ?? ''),
            'prenom' => (string) ($user['prenom'] ?? ''),
        ],
        'configuration' => $configuration,
    ];
    $ok = file_put_contents(
        archicad_soumissions_dir() . '/' . $fichier,
        json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
    if ($ok === false) {
        return null;
    }
    return ['fichier' => $fichier] + $record;
}

// Liste des soumissions, de la plus récente à la plus ancienne
function archicad_load_soumissions(): array
{
    $dir = archicad_soumissions_dir();
    if (!is_dir($dir)) {
        return [];
    }
    $out = [];
    foreach (glob($dir . '/*.json') ?: [] as $file) {
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data)) {
            continue;
        }
        $out[] = [
            'fichier' => basename($file),
            'soumis_le' => (string) ($data['soumis_le'] ?? ''),
            'utilisateur' => is_array($data['utilisateur'] ?? null) ? $data['utilisateur'] : null,
            'module' => (string) ($data['configuration']['module']['nom'] ?? ''),
            'surface' => (string) ($data['configuration']['metriques']['surfacePlancher'] ?? ''),
            'donnees' => $data,
        ];
    }
    // Le préfixe Ymd_His du nom de fichier permet un tri chronologique
    usort($out, function ($a, $b) {
        return strcmp($b['fichier'], $a['fichier']);
    });
    return $out;
}

function archicad_soumission_path(string $fichier): ?string
{
    $fichier = basename($fichier);
    $path = archicad_soumissions_dir() . '/' . $fichier;
    return is_file($path) ? $path : null;
}

function archicad_delete_soumission(string $fichier): bool
{
    $path = archicad_soumission_path($fichier);
    return $path !== null && unlink($path);
}

function archicad_soumissions_count(): int
{
    $dir = archicad_soumissions_dir();
    if (!is_dir($dir)) {
        return 0;
    }
    return count(glob($dir . '/*.json') ?: []);
}

// ---------------------------------------------------------------------------
// Notification e-mail à l'architecte (bouton « Soumettre »)
// ---------------------------------------------------------------------------

/**
 * Construit l'e-mail avertissant l'architecte (dev@baracca.fr) qu'un dossier
 * vient d'être soumis : le fichier JSON est à récupérer dans le back-office.
 */
function archicad_construire_email_soumission(array $soumission, array $configuration): array
{
    $utilisateur = is_array($soumission['utilisateur'] ?? null) ? $soumission['utilisateur'] : [];
    $module = (string) ($configuration['module']['nom'] ?? 'module');
    $surface = (string) ($configuration['metriques']['surfacePlancher'] ?? '');
    $client = trim((string) ($utilisateur['prenom'] ?? '') . ' ' . (string) ($utilisateur['nom'] ?? ''));
    $emailClient = (string) ($utilisateur['email'] ?? '');

    $message = "Bonjour,\n\n"
        . "Un client vient de soumettre un dossier depuis le configurateur de modules.\n\n"
        . "Client : " . ($client !== '' ? $client : '—') . ($emailClient !== '' ? ' <' . $emailClient . '>' : '') . "\n"
        . "Module : " . $module . "\n"
        . ($surface !== '' ? 'Surface plancher : ' . $surface . " m²\n" : '')
        . "Soumis le : " . (string) ($soumission['soumis_le'] ?? date('Y-m-d H:i:s')) . "\n\n"
        . "Le fichier JSON du module est à récupérer dans le back-office :\n"
        . ARCHICAD_SITE_URL . "/admin/soumissions.php\n\n"
        . "— Notification automatique du site " . (string) parse_url(ARCHICAD_SITE_URL, PHP_URL_HOST) . "\n";

    $headers = 'From: no-reply@baracca.fr' . "\r\n"
        . ($emailClient !== '' ? 'Reply-To: ' . $emailClient . "\r\n" : '')
        . 'X-Mailer: PHP/' . phpversion() . "\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n";

    return [
        'to' => 'dev@baracca.fr',
        'sujet' => 'Baracca — dossier soumis : ' . $module,
        'message' => $message,
        'headers' => $headers,
    ];
}

/**
 * Envoie la notification à l'architecte. Retourne true si l'envoi a réussi.
 * (@mail : un avertissement PHP ne doit pas corrompre la réponse JSON de l'API)
 */
function archicad_notifier_soumission(array $soumission, array $configuration): bool
{
    $email = archicad_construire_email_soumission($soumission, $configuration);
    return @mail($email['to'], $email['sujet'], $email['message'], $email['headers']);
}
