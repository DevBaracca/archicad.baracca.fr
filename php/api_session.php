<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * API (même origine) : état de la session client, consommée par l'application
 * React du configurateur (servie sous /configurateur/, intégrée par iframe).
 * N'expose jamais le hash du mot de passe.
 */
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$user = archicad_current_user();
if ($user === null) {
    echo json_encode(['loggedIn' => false, 'user' => null]);
} else {
    echo json_encode([
        'loggedIn' => true,
        'user' => [
            'id' => (string) $user['id'],
            'email' => (string) $user['email'],
            'nom' => (string) ($user['nom'] ?? ''),
            'prenom' => (string) ($user['prenom'] ?? ''),
        ],
    ]);
}
