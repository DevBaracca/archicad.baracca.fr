<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Espace client : authentification par compte (email + mot de passe,
 * session PHP + bcrypt), sur le même modèle que l'espace investisseurs
 * du site invest.baracca.fr. Les comptes sont créés en ligne (inscription.php)
 * et gérés depuis le back-office (data/users.json).
 */

require_once __DIR__ . '/../config.php';
// admin-auth.php démarre la session (cookie renforcé) et fournit les comptes
// administrateurs du back-office (data/admins.json) : un admin peut aussi se
// connecter à l'espace client / au configurateur avec son compte admin.
require_once __DIR__ . '/admin-auth.php';
require_once __DIR__ . '/users.php';
require_once __DIR__ . '/stats.php'; // log d'événements de connexion (métriques)

// Filet de sécurité si la session n'est pas encore démarrée (admin-auth.php la démarre)
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function archicad_is_logged_in(): bool
{
    return !empty($_SESSION['archicad_user_id']);
}

// Session administrateur active (connecté au back-office dans ce navigateur) :
// l'admin bascule directement dans le configurateur, sans compte client
function archicad_is_admin(): bool
{
    return !empty($_SESSION['archicad_admin']);
}

// Administrateur actuellement connecté via la session (null sinon)
function archicad_current_admin(): ?array
{
    $username = (string) ($_SESSION['archicad_admin_username'] ?? '');
    if ($username === '') {
        return null;
    }
    return archicad_find_admin_by_username($username);
}

// Accès au configurateur : compte client OU session administrateur
function archicad_can_use_configurateur(): bool
{
    return archicad_is_logged_in() || archicad_is_admin();
}

// Compte effectif des API du configurateur : le compte client, ou à défaut
// l'administrateur avec un id dédié « admin:<username> » (enregistrement des
// configurations et soumissions possibles aussi pour un admin)
function archicad_api_user(): ?array
{
    $user = archicad_current_user();
    if ($user !== null) {
        return $user;
    }
    $admin = archicad_current_admin();
    if ($admin === null) {
        return null;
    }
    return [
        'id' => 'admin:' . (string) $admin['username'],
        'email' => '',
        'nom' => (string) $admin['username'],
        'prenom' => 'Admin',
        'admin' => true,
    ];
}

// Connexion à l'espace client : email + mot de passe d'un compte client,
// OU identifiant + mot de passe d'un administrateur du back-office
function archicad_login(string $identifier, string $password): bool
{
    $user = archicad_find_user_by_email($identifier);
    if ($user !== null && password_verify($password, (string) $user['hash'])) {
        // Nouvel identifiant de session à la connexion (protection contre la fixation de session)
        session_regenerate_id(true);
        // Une seule identité par session : on écarte une éventuelle session admin
        unset($_SESSION['archicad_admin'], $_SESSION['archicad_admin_username']);
        $_SESSION['archicad_user_id'] = (string) $user['id'];
        // Métriques : date de dernière connexion + ouverture de session + log événement (heatmap)
        archicad_touch_login((string) $user['id']);
        archicad_stats_log_login((string) $user['id']);
        return true;
    }
    // Compte administrateur du back-office : la session admin est posée,
    // elle donne accès au configurateur (et au back-office)
    $admin = archicad_find_admin_by_username($identifier);
    if ($admin !== null && password_verify($password, (string) $admin['hash'])) {
        session_regenerate_id(true);
        // Une seule identité par session : on écarte une éventuelle session client
        unset($_SESSION['archicad_user_id'], $_SESSION['archicad_user_csrf']);
        $_SESSION['archicad_admin'] = true;
        $_SESSION['archicad_admin_username'] = (string) $admin['username'];
        archicad_stats_log_login('admin:' . (string) $admin['username']); // métrique (heatmap connexions)
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
