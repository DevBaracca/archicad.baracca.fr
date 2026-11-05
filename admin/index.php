<?php
/**
 * Baracca - Back-office (archicad.baracca.fr)
 * Connexion administrateur + tableau de bord
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/users.php';
require_once __DIR__ . '/../includes/configurations.php';
require_once __DIR__ . '/../includes/soumissions.php';
require_once __DIR__ . '/../includes/catalogue.php';

$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username'], $_POST['password'])) {
    if (archicad_admin_rate_limit_is_blocked()) {
        $minutes = (int) ceil(archicad_admin_rate_limit_blocked_seconds() / 60);
        $loginError = 'Trop de tentatives de connexion. Réessayez dans ' . $minutes . ' min.';
    } elseif (archicad_admin_login((string) $_POST['username'], (string) $_POST['password'])) {
        archicad_admin_rate_limit_success();
        header('Location: index.php');
        exit;
    } else {
        archicad_admin_rate_limit_failure();
        $loginError = 'Identifiants incorrects.';
    }
}

if (!archicad_admin_is_logged_in()) {
    $pageTitle = 'Connexion';
    include __DIR__ . '/../includes/admin-head.php';
    ?>
    <div class="admin-card admin-login">
      <h1>Administration Baracca</h1>
      <p class="admin-hint">Back-office du site archicad.baracca.fr</p>
      <?php if ($loginError !== ''): ?>
        <p class="admin-message admin-message-error"><?= htmlspecialchars($loginError) ?></p>
      <?php endif; ?>
      <form method="post" action="index.php">
        <div class="admin-form-row">
          <label for="username">Identifiant</label>
          <input type="text" id="username" name="username" required autofocus autocomplete="username">
        </div>
        <div class="admin-form-row">
          <label for="password">Mot de passe</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-cta">Se connecter</button>
      </form>
    </div>
    <?php
    include __DIR__ . '/../includes/admin-footer.php';
    exit;
}

archicad_admin_require_auth();
$pageTitle = 'Tableau de bord';
$adminPage = 'index';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1>Tableau de bord</h1>
      <p>Gérez les comptes clients du configurateur et consultez les configurations soumises, depuis cette interface.</p>
    </div>
    <div class="admin-grid">
      <div class="admin-card">
        <h2>Utilisateurs</h2>
        <p class="admin-stat"><?= archicad_users_count() ?></p>
        <p>Comptes clients ayant accès au configurateur (inscrits en ligne, profil complet : identité, adresse, référence cadastrale).</p>
        <a href="utilisateurs.php" class="btn btn-secondary btn-icon" title="Ouvrir les utilisateurs" aria-label="Ouvrir les utilisateurs">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>
        </a>
      </div>
      <div class="admin-card">
        <h2>Soumissions</h2>
        <p class="admin-stat"><?= archicad_soumissions_count() ?></p>
        <p>Configurations envoyées à Baracca via le bouton « Soumettre » du configurateur.</p>
        <a href="soumissions.php" class="btn btn-secondary btn-icon" title="Ouvrir les soumissions" aria-label="Ouvrir les soumissions">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>
        </a>
      </div>
      <div class="admin-card">
        <h2>Configurations enregistrées</h2>
        <p class="admin-stat"><?= archicad_configurations_total() ?></p>
        <p>Configurations enregistrées par les clients dans leur espace (onglet « Export JSON » du configurateur). Elles restent la propriété de chaque client.</p>
        <a href="../configurateur.php" class="btn btn-secondary btn-icon" target="_blank" title="Ouvrir le configurateur" aria-label="Ouvrir le configurateur">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>
        </a>
      </div>
      <div class="admin-card">
        <h2>Configurateur</h2>
        <p class="admin-stat"><?= archicad_catalogue_total_items() ?></p>
        <p>Éléments des catalogues proposés aux clients dans le configurateur : ouvrants, modules, formes de toiture, charpentes, enveloppe (murs, planchers, toitures) et revêtements (Extérieur, Intérieur, Toiture), avec leurs tarifs et favoris Archicad.</p>
        <a href="configurateur.php" class="btn btn-secondary btn-icon" title="Ouvrir le configurateur (catalogues)" aria-label="Ouvrir le configurateur (catalogues)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>
        </a>
      </div>
    </div>
<?php
include __DIR__ . '/../includes/admin-footer.php';
