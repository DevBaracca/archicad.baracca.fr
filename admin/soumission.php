<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Téléchargement du JSON d'une soumission (réservé à l'administrateur)
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/soumissions.php';

archicad_admin_require_auth();

$path = archicad_soumission_path((string) ($_GET['fichier'] ?? ''));
if ($path === null) {
    http_response_code(404);
    exit('Soumission introuvable.');
}

$fichier = basename($path);
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $fichier . '"');
header('Content-Length: ' . (string) filesize($path));
readfile($path);
