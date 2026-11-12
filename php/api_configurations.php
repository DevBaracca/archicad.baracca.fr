<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * API (même origine) : configurations enregistrées par le client connecté,
 * consommée par l'application React du configurateur.
 * Actions (corps JSON en POST) : list, save, get, delete.
 * Chaque action est strictement limitée aux configurations du compte connecté.
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/configurations.php';

header('Content-Type: application/json; charset=utf-8');

$user = archicad_current_user();
if ($user === null) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Non connecté.']);
    exit;
}

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = [];
}
$action = (string) ($body['action'] ?? '');
$userId = (string) $user['id'];

switch ($action) {
    case 'list':
        $list = array_map(function ($c) {
            return [
                'id' => (string) $c['id'],
                'nom' => (string) $c['nom'],
                'created' => (string) $c['created'],
                'updated' => (string) $c['updated'],
            ];
        }, archicad_user_configurations($userId));
        echo json_encode(['ok' => true, 'configurations' => $list]);
        break;

    case 'save':
        $nom = trim((string) ($body['nom'] ?? ''));
        $config = $body['config'] ?? null;
        if ($nom === '' || !is_array($config)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Nom ou configuration invalide.']);
            break;
        }
        $id = isset($body['id']) ? (string) $body['id'] : null;
        $json = isset($body['json']) ? (string) $body['json'] : null;
        $record = archicad_save_configuration($userId, $nom, $config, $id, $json);
        echo json_encode([
            'ok' => true,
            'configuration' => [
                'id' => (string) $record['id'],
                'nom' => (string) $record['nom'],
                'created' => (string) $record['created'],
                'updated' => (string) $record['updated'],
            ],
        ]);
        break;

    case 'get':
        $config = archicad_find_configuration((string) ($body['id'] ?? ''));
        if ($config === null || ($config['userId'] ?? '') !== $userId) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Configuration introuvable.']);
            break;
        }
        echo json_encode(['ok' => true, 'configuration' => $config]);
        break;

    case 'delete':
        $ok = archicad_delete_configuration($userId, (string) ($body['id'] ?? ''));
        if (!$ok) {
            http_response_code(404);
        }
        echo json_encode(['ok' => $ok, 'error' => $ok ? null : 'Configuration introuvable.']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Action inconnue.']);
}
