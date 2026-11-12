<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Back-office : authentification administrateur (session + hash bcrypt),
 * limitation de débit des tentatives de connexion et protection CSRF.
 */

require_once __DIR__ . '/../config.php';

// Cookie de session renforcé (identique à l'espace client)
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function archicad_admin_is_logged_in(): bool
{
    return !empty($_SESSION['archicad_admin']);
}

// ---------------------------------------------------------------------------
// Comptes administrateurs du configurateur (data/admins.json, hash bcrypt).
// Amorçage : au premier chargement, le compte défini dans config.php
// (ARCHICAD_ADMIN_USERNAME / ARCHICAD_ADMIN_PASSWORD_HASH) est repris dans
// le fichier ; ensuite la gestion se fait depuis admin/administrateurs.php.
// ---------------------------------------------------------------------------

function archicad_admins_file(): string
{
    return ARCHICAD_DATA_DIR . '/admins.json';
}

function archicad_load_admins(): array
{
    $file = archicad_admins_file();
    if (!is_file($file)) {
        // Amorçage depuis config.php (compte historique)
        $admins = [[
            'id' => 'admin-legacy',
            'username' => ARCHICAD_ADMIN_USERNAME,
            'hash' => ARCHICAD_ADMIN_PASSWORD_HASH,
            'created' => date('Y-m-d'),
        ]];
        if (!is_dir(ARCHICAD_DATA_DIR)) {
            mkdir(ARCHICAD_DATA_DIR, 0775, true);
        }
        file_put_contents($file, json_encode(['admins' => $admins], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $admins;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data['admins'] ?? null) ? $data['admins'] : [];
}

function archicad_save_admins(array $admins): bool
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    return file_put_contents(archicad_admins_file(), json_encode(['admins' => array_values($admins)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

function archicad_find_admin_by_username(string $username): ?array
{
    foreach (archicad_load_admins() as $admin) {
        if (hash_equals(strtolower((string) ($admin['username'] ?? '')), strtolower($username))) {
            return $admin;
        }
    }
    return null;
}

function archicad_admin_add(string $username, string $password): array|false
{
    $username = trim($username);
    if ($username === '' || strlen($password) < 8 || archicad_find_admin_by_username($username) !== null) {
        return false;
    }
    $admins = archicad_load_admins();
    $admin = [
        'id' => bin2hex(random_bytes(8)),
        'username' => $username,
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'created' => date('Y-m-d'),
    ];
    $admins[] = $admin;
    return archicad_save_admins($admins) ? $admin : false;
}

function archicad_admin_set_password(string $id, string $password): bool
{
    $admins = archicad_load_admins();
    foreach ($admins as $i => $admin) {
        if (($admin['id'] ?? '') === $id) {
            $admins[$i]['hash'] = password_hash($password, PASSWORD_DEFAULT);
            return archicad_save_admins($admins);
        }
    }
    return false;
}

// Suppression d'un administrateur (impossible de supprimer le dernier)
function archicad_admin_delete(string $id): bool
{
    $admins = archicad_load_admins();
    if (count($admins) <= 1) {
        return false;
    }
    foreach ($admins as $i => $admin) {
        if (($admin['id'] ?? '') === $id) {
            unset($admins[$i]);
            return archicad_save_admins($admins);
        }
    }
    return false;
}

function archicad_admin_login(string $username, string $password): bool
{
    $admin = archicad_find_admin_by_username($username);
    if ($admin !== null && password_verify($password, (string) $admin['hash'])) {
        session_regenerate_id(true);
        $_SESSION['archicad_admin'] = true;
        $_SESSION['archicad_admin_username'] = (string) $admin['username'];
        return true;
    }
    return false;
}

function archicad_admin_require_auth(): void
{
    if (!archicad_admin_is_logged_in()) {
        header('Location: index.php');
        exit;
    }
}

function archicad_admin_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// ---------------------------------------------------------------------------
// Limitation de débit des connexions admin (par IP)
// Mêmes constantes que l'espace client : 5 échecs / 15 min de blocage
// ---------------------------------------------------------------------------

function archicad_admin_rate_limit_file(): string
{
    return ARCHICAD_DATA_DIR . '/admin-rate-limit.json';
}

function archicad_admin_rate_limit_load(): array
{
    $file = archicad_admin_rate_limit_file();
    if (!is_file($file)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function archicad_admin_rate_limit_save(array $data): void
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    file_put_contents(archicad_admin_rate_limit_file(), json_encode($data), LOCK_EX);
}

function archicad_admin_rate_limit_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function archicad_admin_rate_limit_is_blocked(): bool
{
    $data = archicad_admin_rate_limit_load();
    $ip = archicad_admin_rate_limit_ip();
    if (empty($data[$ip]['blocked_until'])) {
        return false;
    }
    if (time() >= (int) $data[$ip]['blocked_until']) {
        unset($data[$ip]);
        archicad_admin_rate_limit_save($data);
        return false;
    }
    return true;
}

function archicad_admin_rate_limit_blocked_seconds(): int
{
    $data = archicad_admin_rate_limit_load();
    $ip = archicad_admin_rate_limit_ip();
    return max(0, (int) ($data[$ip]['blocked_until'] ?? 0) - time());
}

function archicad_admin_rate_limit_failure(): void
{
    $data = archicad_admin_rate_limit_load();
    $ip = archicad_admin_rate_limit_ip();
    $data[$ip]['failures'] = (int) ($data[$ip]['failures'] ?? 0) + 1;
    if ($data[$ip]['failures'] >= ARCHICAD_LOGIN_MAX_ATTEMPTS) {
        $data[$ip]['blocked_until'] = time() + ARCHICAD_LOGIN_BLOCK_SECONDS;
        $data[$ip]['failures'] = 0;
    }
    archicad_admin_rate_limit_save($data);
}

function archicad_admin_rate_limit_success(): void
{
    $data = archicad_admin_rate_limit_load();
    unset($data[archicad_admin_rate_limit_ip()]);
    archicad_admin_rate_limit_save($data);
}

// ---------------------------------------------------------------------------
// Protection CSRF des formulaires du back-office
// ---------------------------------------------------------------------------

function archicad_admin_csrf_token(): string
{
    if (empty($_SESSION['archicad_admin_csrf'])) {
        $_SESSION['archicad_admin_csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['archicad_admin_csrf'];
}

function archicad_admin_csrf_verify(?string $token): bool
{
    return $token !== null && !empty($_SESSION['archicad_admin_csrf'])
        && hash_equals((string) $_SESSION['archicad_admin_csrf'], $token);
}
