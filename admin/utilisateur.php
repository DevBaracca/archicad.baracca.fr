<?php
/**
 * Baracca - Back-office (archicad.baracca.fr)
 * Fiche détaillée d'un compte client : profil complet, réinitialisation
 * du mot de passe et suppression du compte (et de ses configurations)
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/users.php';
require_once __DIR__ . '/../includes/configurations.php';

archicad_admin_require_auth();

$id = (string) ($_GET['id'] ?? '');
$user = archicad_find_user_by_id($id);
if ($user === null) {
    header('Location: utilisateurs.php');
    exit;
}

$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!archicad_admin_csrf_verify($_POST['csrf'] ?? null)) {
        $message = ['error', 'Jeton de sécurité invalide.'];
    } elseif (isset($_POST['supprimer'])) {
        // Suppression du compte et de ses configurations enregistrées
        archicad_delete_user_configurations($id);
        archicad_delete_user($id);
        header('Location: utilisateurs.php?success=deleted');
        exit;
    } elseif (isset($_POST['reinit'])) {
        $password = (string) ($_POST['password'] ?? '');
        if (strlen($password) < 8) {
            $message = ['error', 'Le mot de passe doit contenir au moins 8 caractères.'];
        } else {
            $message = archicad_set_user_password($id, $password)
                ? ['success', 'Mot de passe réinitialisé.']
                : ['error', 'Utilisateur introuvable.'];
        }
    } elseif (isset($_POST['maj_profil'])) {
        // Modification des informations du client (y compris email et réf. cadastrale)
        $fields = [];
        foreach (['nom', 'prenom', 'email', 'telephone', 'adresse_numero', 'adresse_rue', 'code_postal', 'ville', 'reference_cadastrale'] as $f) {
            $fields[$f] = trim((string) ($_POST[$f] ?? ''));
        }
        $updated = archicad_update_user($id, $fields);
        if ($updated === false) {
            $message = ['error', "Informations non enregistrées : email invalide ou déjà utilisé par un autre compte."];
        } else {
            $user = $updated;
            $message = ['success', 'Informations mises à jour.'];
        }
    }
}

$nbConfigs = archicad_count_configurations($id);
$telephone = (string) ($user['telephone'] ?? '');

$pageTitle = 'Fiche client';
$adminPage = 'utilisateurs';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1><?= htmlspecialchars(trim((string) ($user['prenom'] ?? '') . ' ' . (string) ($user['nom'] ?? ''))) ?></h1>
      <p><a href="utilisateurs.php">← Retour à la liste des utilisateurs</a></p>
      <?php if ($message !== ''): ?>
        <p class="admin-message admin-message-<?= $message[0] ?>"><?= htmlspecialchars($message[1]) ?></p>
      <?php endif; ?>
      <table class="admin-table">
        <tbody>
          <tr><th>Configurations enregistrées</th><td><?= $nbConfigs ?></td></tr>
          <tr><th>Inscrit le</th><td><?= htmlspecialchars((string) ($user['created'] ?? '')) ?></td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-card">
      <h2>Statistiques d'utilisation</h2>
      <table class="admin-table">
        <tbody>
          <tr><th>Dernière connexion</th><td><?= ($user['last_login'] ?? '') !== '' ? htmlspecialchars((string) $user['last_login']) : 'jamais' ?></td></tr>
          <tr><th>Dernière soumission</th><td><?= ($user['last_soumission'] ?? '') !== '' ? htmlspecialchars((string) $user['last_soumission']) : 'jamais' ?></td></tr>
          <tr><th>Sessions de connexion</th><td><?= (int) ($user['sessions'] ?? 0) ?></td></tr>
          <tr><th>Temps total connecté</th><td><?= archicad_format_duree((int) ($user['session_seconds'] ?? 0)) ?></td></tr>
          <tr><th>Durée de la dernière session</th><td><?= isset($user['last_session_seconds']) ? archicad_format_duree((int) $user['last_session_seconds']) : '—' ?></td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-card">
      <h2>Modifier les informations</h2>
      <div class="admin-edit-zone">
      <form method="post" action="utilisateur.php?id=<?= urlencode($id) ?>" class="admin-form">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
        <div class="modal-row stack">
          <div class="admin-form-row">
            <label for="nom">Nom</label>
            <input type="text" id="nom" name="nom" required value="<?= htmlspecialchars((string) ($user['nom'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="prenom">Prénom</label>
            <input type="text" id="prenom" name="prenom" required value="<?= htmlspecialchars((string) ($user['prenom'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="email">Email (identifiant)</label>
            <input type="email" id="email" name="email" required value="<?= htmlspecialchars((string) ($user['email'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="telephone">Téléphone</label>
            <input type="tel" id="telephone" name="telephone" value="<?= htmlspecialchars($telephone) ?>">
          </div>
        </div>
        <div class="modal-row stack">
          <div class="admin-form-row">
            <label for="adresse_numero">Numéro</label>
            <input type="text" id="adresse_numero" name="adresse_numero" value="<?= htmlspecialchars((string) ($user['adresse_numero'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="adresse_rue">Rue</label>
            <input type="text" id="adresse_rue" name="adresse_rue" value="<?= htmlspecialchars((string) ($user['adresse_rue'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="code_postal">Code postal</label>
            <input type="text" id="code_postal" name="code_postal" inputmode="numeric" maxlength="5" value="<?= htmlspecialchars((string) ($user['code_postal'] ?? '')) ?>">
          </div>
          <div class="admin-form-row">
            <label for="ville">Ville</label>
            <input type="text" id="ville" name="ville" value="<?= htmlspecialchars((string) ($user['ville'] ?? '')) ?>">
          </div>
        </div>
        <div class="modal-row stack">
          <div class="admin-form-row">
            <label for="reference_cadastrale">Référence cadastrale (facultative)</label>
            <input type="text" id="reference_cadastrale" name="reference_cadastrale" value="<?= htmlspecialchars((string) ($user['reference_cadastrale'] ?? '')) ?>">
          </div>
        </div>
        <div class="admin-actions">
          <button type="submit" name="maj_profil" value="1" class="btn btn-secondary">Enregistrer les informations</button>
        </div>
      </form>
      <hr class="admin-sep">
      <form method="post" action="utilisateur.php?id=<?= urlencode($id) ?>" class="admin-form-inline">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
        <div>
          <label for="password">Nouveau mot de passe</label>
          <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password" placeholder="8 caractères minimum">
        </div>
        <button type="submit" name="reinit" value="1" class="btn btn-secondary">Réinitialiser le mot de passe</button>
      </form>
      </div>
    </div>
    <div class="admin-card">
      <h2>Supprimer le compte</h2>
      <p class="admin-hint">La suppression est définitive : le compte et ses <?= $nbConfigs ?> configuration(s) enregistrée(s) seront supprimés.</p>
      <form method="post" action="utilisateur.php?id=<?= urlencode($id) ?>" onsubmit="return confirm('Supprimer définitivement ce compte client et ses configurations enregistrées ?');">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
        <button type="submit" name="supprimer" value="1" class="btn-danger">Supprimer le compte</button>
      </form>
    </div>
<?php
include __DIR__ . '/../includes/admin-footer.php';
