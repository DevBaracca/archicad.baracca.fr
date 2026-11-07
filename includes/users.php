<?php
/**
 * Baracca - Site archicad.baracca.fr
 * Comptes clients du configurateur (email + mot de passe, hash bcrypt),
 * créés en ligne depuis inscription.php et gérés depuis le back-office
 * (data/users.json).
 */

require_once __DIR__ . '/../config.php';

function archicad_users_file(): string
{
    return ARCHICAD_DATA_DIR . '/users.json';
}

function archicad_load_users(): array
{
    $file = archicad_users_file();
    if (!is_file($file)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || !isset($data['users']) || !is_array($data['users'])) {
        return [];
    }
    return $data['users'];
}

function archicad_save_users(array $users): bool
{
    if (!is_dir(ARCHICAD_DATA_DIR)) {
        mkdir(ARCHICAD_DATA_DIR, 0775, true);
    }
    return file_put_contents(archicad_users_file(), json_encode(['users' => array_values($users)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

function archicad_users_count(): int
{
    return count(archicad_load_users());
}

function archicad_find_user_by_email(string $email): ?array
{
    foreach (archicad_load_users() as $user) {
        if (hash_equals(strtolower((string) ($user['email'] ?? '')), strtolower($email))) {
            return $user;
        }
    }
    return null;
}

function archicad_find_user_by_id(string $id): ?array
{
    foreach (archicad_load_users() as $user) {
        if (($user['id'] ?? '') === $id) {
            return $user;
        }
    }
    return null;
}

/**
 * Crée un compte client. $fields : email, nom, prenom, telephone, adresse_numero,
 * adresse_rue, code_postal, ville, reference_cadastrale (facultative).
 * Retourne le compte créé, ou false si l'email est invalide ou déjà utilisé.
 */
function archicad_add_user(array $fields, string $password): array|false
{
    $email = strtolower(trim((string) ($fields['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || archicad_find_user_by_email($email) !== null) {
        return false;
    }
    $users = archicad_load_users();
    $user = [
        'id' => bin2hex(random_bytes(8)),
        'email' => $email,
        'nom' => trim((string) ($fields['nom'] ?? '')),
        'prenom' => trim((string) ($fields['prenom'] ?? '')),
        'telephone' => trim((string) ($fields['telephone'] ?? '')),
        'adresse_numero' => trim((string) ($fields['adresse_numero'] ?? '')),
        'adresse_rue' => trim((string) ($fields['adresse_rue'] ?? '')),
        'code_postal' => trim((string) ($fields['code_postal'] ?? '')),
        'ville' => trim((string) ($fields['ville'] ?? '')),
        'reference_cadastrale' => trim((string) ($fields['reference_cadastrale'] ?? '')),
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'created' => date('Y-m-d'),
    ];
    $users[] = $user;
    return archicad_save_users($users) ? $user : false;
}

function archicad_delete_user(string $id): bool
{
    $users = archicad_load_users();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') === $id) {
            unset($users[$i]);
            return archicad_save_users($users);
        }
    }
    return false;
}

function archicad_set_user_password(string $id, string $password): bool
{
    $users = archicad_load_users();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') === $id) {
            $users[$i]['hash'] = password_hash($password, PASSWORD_DEFAULT);
            return archicad_save_users($users);
        }
    }
    return false;
}

/**
 * Met à jour le profil d'un compte client (nom, prénom, email, téléphone,
 * adresse, code postal, ville, référence cadastrale). L'email doit rester
 * valide et unique (hors ce compte). Retourne le compte mis à jour, ou false.
 */
function archicad_update_user(string $id, array $fields): array|false
{
    $email = strtolower(trim((string) ($fields['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $other = archicad_find_user_by_email($email);
    if ($other !== null && (string) ($other['id'] ?? '') !== $id) {
        return false; // email déjà utilisé par un autre compte
    }
    $users = archicad_load_users();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') === $id) {
            $users[$i]['email'] = $email;
            foreach (['nom', 'prenom', 'telephone', 'adresse_numero', 'adresse_rue', 'code_postal', 'ville', 'reference_cadastrale'] as $f) {
                $users[$i][$f] = trim((string) ($fields[$f] ?? ''));
            }
            return archicad_save_users($users) ? $users[$i] : false;
        }
    }
    return false;
}

/**
 * Change le mot de passe d'un compte après vérification du mot de passe
 * actuel. Retourne true en cas de succès, ou le message d'erreur.
 */
function archicad_change_user_password(string $id, string $current, string $new): true|string
{
    $user = archicad_find_user_by_id($id);
    if ($user === null) {
        return 'Compte introuvable.';
    }
    if (!password_verify($current, (string) $user['hash'])) {
        return 'Le mot de passe actuel est incorrect.';
    }
    if (strlen($new) < 8) {
        return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
    }
    return archicad_set_user_password($id, $new) ? true : 'Impossible d\'enregistrer le nouveau mot de passe.';
}

// ---------------------------------------------------------------------------
// Métriques d'utilisation (statistiques par compte client)
// ---------------------------------------------------------------------------

// Durée maximale imputée à une session restée ouverte (1 jour)
const ARCHICAD_SESSION_MAX_SECONDS = 86400;

/**
 * Enregistre une connexion : date de dernière connexion + ouverture de
 * session (une éventuelle session précédente restée ouverte est clôturée).
 */
function archicad_touch_login(string $id): void
{
    $users = archicad_load_users();
    $now = time();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') !== $id) {
            continue;
        }
        archicad_close_session($users[$i], $now);
        $users[$i]['last_login'] = date('Y-m-d H:i:s', $now);
        $users[$i]['session_opened_at'] = $now;
        archicad_save_users($users);
        return;
    }
}

/**
 * Enregistre une déconnexion : clôture la session ouverte et cumule sa durée
 * (nombre de sessions, durée totale, durée de la dernière session).
 */
function archicad_touch_logout(string $id): void
{
    $users = archicad_load_users();
    $now = time();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') === $id) {
            archicad_close_session($users[$i], $now);
            archicad_save_users($users);
            return;
        }
    }
}

// Clôture la session ouverte du compte $user (si présente) et cumule la durée
function archicad_close_session(array &$user, int $now): void
{
    if (empty($user['session_opened_at'])) {
        return;
    }
    $duree = min(max(0, $now - (int) $user['session_opened_at']), ARCHICAD_SESSION_MAX_SECONDS);
    $user['session_seconds'] = (int) ($user['session_seconds'] ?? 0) + $duree;
    $user['sessions'] = (int) ($user['sessions'] ?? 0) + 1;
    $user['last_session_seconds'] = $duree;
    unset($user['session_opened_at']);
}

// Enregistre une soumission (date de la dernière soumission)
function archicad_touch_soumission(string $id): void
{
    $users = archicad_load_users();
    foreach ($users as $i => $user) {
        if (($user['id'] ?? '') === $id) {
            $users[$i]['last_soumission'] = date('Y-m-d H:i:s');
            archicad_save_users($users);
            return;
        }
    }
}

// Formate une durée en secondes : « 2 h 15 min », « 45 min », « 30 s »
function archicad_format_duree(int $secondes): string
{
    if ($secondes < 60) {
        return $secondes . ' s';
    }
    $min = (int) floor($secondes / 60);
    if ($min < 60) {
        return $min . ' min';
    }
    $h = (int) floor($min / 60);
    $reste = $min % 60;
    return $reste > 0 ? "$h h $reste min" : "$h h";
}
