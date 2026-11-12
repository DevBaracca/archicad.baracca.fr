<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Espace client : authentification par compte (email + mot de passe,
 * session PHP + bcrypt), sur le même modèle que l'espace investisseurs
 * du site invest.baracca.fr. Les comptes sont créés en ligne (inscription.php)
 * et gérés depuis le back-office (data/users.json).
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/users.php';
require_once __DIR__ . '/stats.php'; // log d'événements de connexion (métriques)

// Cookie de session renforcé : inaccessible en JavaScript, envoyé uniquement sur ce site (SameSite=Lax)
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function archicad_is_logged_in(): bool
{
    return !empty($_SESSION['archicad_user_id']);
}

function archicad_login(string $email, string $password): bool
{
    $user = archicad_find_user_by_email($email);
    if ($user !== null && password_verify($password, (string) $user['hash'])) {
        // Nouvel identifiant de session à la connexion (protection contre la fixation de session)
        session_regenerate_id(true);
        $_SESSION['archicad_user_id'] = (string) $user['id'];
        // Métriques : date de dernière connexion + ouverture de session + log événement (heatmap)
        archicad_touch_login((string) $user['id']);
        archicad_stats_log_login((string) $user['id']);
        return true;
    }
    return false;
}

// Compte client actuellement connecté (null si non connecté)
function archicad_current_user(): ?array
{
    $id = (string) ($_SESSION['archicad_user_id'] ?? '');
    if ($id === '') {
        return null;
    }
    return archicad_find_user_by_id($id);
}

function archicad_logout(): void
{
    // Métrique : clôture de la session (durée cumulée) avant de détruire la session
    $uid = (string) ($_SESSION['archicad_user_id'] ?? '');
    if ($uid !== '') {
        archicad_touch_logout($uid);
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// ============================================
// Protection CSRF des formulaires de l'espace client (compte.php)
// ============================================

function archicad_csrf_token(): string
{
    if (empty($_SESSION['archicad_user_csrf'])) {
        $_SESSION['archicad_user_csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['archicad_user_csrf'];
}

function archicad_csrf_verify(?string $token): bool
{
    return $token !== null && !empty($_SESSION['archicad_user_csrf'])
        && hash_equals((string) $_SESSION['archicad_user_csrf'], $token);
}

// ============================================
// Limitation de débit des connexions (par IP)
// ============================================

function archicad_rate_limit_file(): string
{
    return ARCHICAD_DATA_DIR . '/rate-limit.json';
}

function archicad_rate_limit_load(): array
{
    $file = archicad_rate_limit_file();
    if (!is_file($file)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data)) {
        return [];
    }
    // Nettoyage des entrées dont la fenêtre et le blocage sont expirés
    $now = time();
    foreach ($data as $ip => $entry) {
        $windowExpired = (int) ($entry['window_start'] ?? 0) + ARCHICAD_LOGIN_WINDOW_SECONDS <= $now;
        $blockExpired = (int) ($entry['blocked_until'] ?? 0) <= $now;
        if ($windowExpired && $blockExpired) {
            unset($data[$ip]);
        }
    }
    return $data;
}

function archicad_rate_limit_save(array $data): void
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    file_put_contents(archicad_rate_limit_file(), json_encode($data), LOCK_EX);
}

function archicad_rate_limit_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function archicad_rate_limit_is_blocked(): bool
{
    $entry = archicad_rate_limit_load()[archicad_rate_limit_ip()] ?? null;
    return is_array($entry) && (int) ($entry['blocked_until'] ?? 0) > time();
}

function archicad_rate_limit_blocked_seconds(): int
{
    $entry = archicad_rate_limit_load()[archicad_rate_limit_ip()] ?? null;
    if (!is_array($entry)) {
        return 0;
    }
    return max(0, (int) ($entry['blocked_until'] ?? 0) - time());
}

function archicad_rate_limit_failure(): void
{
    $ip = archicad_rate_limit_ip();
    $data = archicad_rate_limit_load();
    $now = time();
    $entry = $data[$ip] ?? ['failures' => 0, 'window_start' => $now, 'blocked_until' => 0];
    if ((int) $entry['window_start'] + ARCHICAD_LOGIN_WINDOW_SECONDS <= $now) {
        // La fenêtre est expirée : on repart à zéro
        $entry = ['failures' => 0, 'window_start' => $now, 'blocked_until' => 0];
    }
    $entry['failures']++;
    if ($entry['failures'] >= ARCHICAD_LOGIN_MAX_ATTEMPTS) {
        $entry['failures'] = 0;
        $entry['window_start'] = $now;
        $entry['blocked_until'] = $now + ARCHICAD_LOGIN_BLOCK_SECONDS;
    }
    $data[$ip] = $entry;
    archicad_rate_limit_save($data);
}

function archicad_rate_limit_success(): void
{
    $ip = archicad_rate_limit_ip();
    $data = archicad_rate_limit_load();
    if (isset($data[$ip])) {
        unset($data[$ip]);
        archicad_rate_limit_save($data);
    }
}
