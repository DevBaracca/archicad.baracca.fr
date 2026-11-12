<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Gestion des administrateurs du configurateur (data/admins.json) :
 * liste, ajout d'un administrateur, changement de mot de passe, suppression
 * (impossible de supprimer le dernier administrateur).
 */

require_once __DIR__ . '/../includes/admin-auth.php';

archicad_admin_require_auth();

$admins = archicad_load_admins();
$message = null; // ['success'|'error', texte]

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!archicad_admin_csrf_verify($_POST['csrf'] ?? null)) {
        $message = ['error', 'Jeton de sécurité invalide.'];
    } elseif (isset($_POST['ajouter'])) {
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $confirmation = (string) ($_POST['confirmation'] ?? '');
        if ($username === '') {
            $message = ['error', "L'identifiant est obligatoire."];
        } elseif (strlen($password) < 8) {
            $message = ['error', 'Le mot de passe doit contenir au moins 8 caractères.'];
        } elseif ($password !== $confirmation) {
            $message = ['error', 'La confirmation du mot de passe ne correspond pas.'];
        } elseif (archicad_find_admin_by_username($username) !== null) {
            $message = ['error', 'Un administrateur existe déjà avec cet identifiant.'];
        } else {
            $message = archicad_admin_add($username, $password) !== false
                ? ['success', "Administrateur « $username » ajouté."]
                : ['error', "Impossible d'ajouter l'administrateur."];
        }
        $admins = archicad_load_admins();
    } elseif (isset($_POST['reinit'])) {
        $id = (string) ($_POST['id'] ?? '');
        $password = (string) ($_POST['password'] ?? '');
        $confirmation = (string) ($_POST['confirmation'] ?? '');
        if (strlen($password) < 8) {
            $message = ['error', 'Le mot de passe doit contenir au moins 8 caractères.'];
        } elseif ($password !== $confirmation) {
            $message = ['error', 'La confirmation du mot de passe ne correspond pas.'];
        } else {
            $message = archicad_admin_set_password($id, $password)
                ? ['success', 'Mot de passe mis à jour.']
                : ['error', 'Administrateur introuvable.'];
        }
    } elseif (isset($_POST['supprimer'])) {
        $id = (string) ($_POST['id'] ?? '');
        $message = archicad_admin_delete($id)
            ? ['success', 'Administrateur supprimé.']
            : ['error', 'Suppression impossible (administrateur introuvable ou dernier administrateur restant).'];
        $admins = archicad_load_admins();
    }
}

$pageTitle = 'Administrateurs';
$adminPage = 'administrateurs';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1>Administrateurs du configurateur</h1>
      <p>Les administrateurs ont accès à ce back-office. Le compte initial est défini dans <code>config.php</code> et repris automatiquement dans <code>data/admins.json</code> au premier chargement.</p>
      <?php if ($message !== null): ?>
        <p class="admin-message admin-message-<?= $message[0] ?>"><?= htmlspecialchars($message[1]) ?></p>
      <?php endif; ?>
    </div>
    <div class="admin-card">
      <h2>Administrateurs (<?= count($admins) ?>)</h2>
      <table class="admin-table">
        <thead>
          <tr><th>Identifiant</th><th>Créé le</th><th>Nouveau mot de passe</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <?php foreach ($admins as $admin): ?>
            <?php $aid = (string) ($admin['id'] ?? ''); ?>
            <tr>
              <td><strong><?= htmlspecialchars((string) $admin['username']) ?></strong></td>
              <td><?= htmlspecialchars((string) ($admin['created'] ?? '')) ?></td>
              <td>
                <form method="post" action="administrateurs.php" class="admin-form-inline">
                  <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
                  <input type="hidden" name="id" value="<?= htmlspecialchars($aid) ?>">
                  <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="8 caractères min." style="width:180px">
                  <input type="password" name="confirmation" required minlength="8" autocomplete="new-password" placeholder="Confirmation" style="width:150px">
                  <button type="submit" name="reinit" value="1" class="btn btn-secondary btn-small">Changer le mot de passe</button>
                </form>
              </td>
              <td>
                <?php if (count($admins) > 1): ?>
                  <form method="post" action="administrateurs.php" onsubmit="return confirm('Supprimer cet administrateur ?');">
                    <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
                    <input type="hidden" name="id" value="<?= htmlspecialchars($aid) ?>">
                    <button type="submit" name="supprimer" value="1" class="btn-danger btn-small">Supprimer</button>
                  </form>
                <?php else: ?>
                  <span class="admin-hint">dernier administrateur</span>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <div class="admin-card">
      <h2>Ajouter un administrateur</h2>
      <form method="post" action="administrateurs.php" class="admin-form-inline">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
        <div>
          <label for="username">Identifiant</label>
          <input type="text" id="username" name="username" required autocomplete="username" placeholder="ex. architecte">
        </div>
        <div>
          <label for="password">Mot de passe</label>
          <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password" placeholder="8 caractères minimum">
        </div>
        <div>
          <label for="confirmation">Confirmation</label>
          <input type="password" id="confirmation" name="confirmation" required minlength="8" autocomplete="new-password">
        </div>
        <button type="submit" name="ajouter" value="1" class="btn btn-cta">Ajouter</button>
      </form>
    </div>
<?php
include __DIR__ . '/../includes/admin-footer.php';
