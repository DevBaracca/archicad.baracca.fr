<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Bouton « Soumettre » du configurateur : enregistre la configuration du
 * client connecté (data/soumissions/) et avertit l'architecte par e-mail
 * (dev@baracca.fr). L'architecte retrouve le fichier JSON dans le
 * back-office (admin/soumissions.php).
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/soumissions.php';

header('Content-Type: application/json; charset=utf-8');

// Compte client connecté, ou session administrateur (id « admin:<username> »)
$user = archicad_api_user();
if ($user === null) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Non connecté.']);
    exit;
}

$data = json_decode((string) file_get_contents('php://input'), true);
if (!$data || !isset($data['module'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON invalide']);
    exit;
}

$record = archicad_add_soumission($data, $user);
if ($record === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Enregistrement impossible.']);
    exit;
}

// Métrique : date de la dernière soumission du client
archicad_touch_soumission((string) $user['id']);

// Avertissement e-mail à l'architecte : le dossier est à regarder,
// le fichier JSON est à récupérer dans le back-office.
$mailEnvoye = archicad_notifier_soumission($record, $data);

echo json_encode(['ok' => true, 'id' => $record['fichier'], 'mail' => $mailEnvoye]);
