<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Connexion administrateur + tableau de bord
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/users.php';
require_once __DIR__ . '/../includes/configurations.php';
require_once __DIR__ . '/../includes/soumissions.php';
require_once __DIR__ . '/../includes/stats.php';

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
      <p class="admin-hint">Back-office du site configurateur.baracca.fr</p>
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
$stats = archicad_stats_collect(); // métriques multi-sites (compteurs des onglets)
// Onglets du tableau de bord : un onglet par site baracca.fr
$tabsSites = ['configurateur' => 'Configurateur', 'invest' => 'Invest', 'blog' => 'Blog'];
$siteTab = (string) ($_GET['site'] ?? 'configurateur');
if (!isset($tabsSites[$siteTab])) {
    $siteTab = 'configurateur';
}
$pageTitle = 'Tableau de bord';
$adminPage = 'index';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1>Tableau de bord</h1>
      <p>Gérez les comptes clients du configurateur et consultez les configurations soumises, depuis cette interface.</p>
      <nav class="admin-tabs admin-subtabs">
        <?php foreach ($tabsSites as $key => $label): ?>
          <a href="index.php?site=<?= $key ?>"<?= $siteTab === $key ? ' class="active"' : '' ?>><?= $label ?> (<?= (int) ($stats['sites'][$key]['total'] ?? 0) ?>)</a>
        <?php endforeach; ?>
      </nav>
    </div>
<?php if ($siteTab === 'configurateur'): ?>
    <div class="admin-grid">
      <div class="admin-card admin-dash-card">
        <div class="admin-dash-head">
          <h2><a href="utilisateurs.php" class="admin-dash-link">Utilisateurs <span class="admin-dash-count"><?= archicad_users_count() ?></span></a></h2>
          <p class="admin-dash-desc">Comptes clients ayant accès au configurateur (inscrits en ligne, profil complet : identité, adresse, référence cadastrale).</p>
        </div>
      </div>
      <div class="admin-card admin-dash-card">
        <div class="admin-dash-head">
          <h2><a href="soumissions.php" class="admin-dash-link">Soumissions <span class="admin-dash-count"><?= archicad_soumissions_count() ?></span></a></h2>
          <p class="admin-dash-desc">Configurations envoyées à Baracca via le bouton « Soumettre » du configurateur.</p>
        </div>
      </div>
      <div class="admin-card admin-dash-card">
        <div class="admin-dash-head">
          <h2><a href="../configurateur.php" target="_blank" class="admin-dash-link">Configurations enregistrées <span class="admin-dash-count"><?= archicad_configurations_total() ?></span></a></h2>
          <p class="admin-dash-desc">Configurations enregistrées par les clients dans leur espace (onglet « Export JSON » du configurateur). Elles restent la propriété de chaque client.</p>
        </div>
      </div>
      <div class="admin-card admin-dash-card">
        <div class="admin-dash-head">
          <h2><a href="administrateurs.php" class="admin-dash-link">Administrateurs <span class="admin-dash-count"><?= count(archicad_load_admins()) ?></span></a></h2>
          <p class="admin-dash-desc">Comptes administrateurs du back-office (ajout, changement de mot de passe, suppression du dernier excepté). Le compte initial vient de <code>config.php</code>.</p>
        </div>
      </div>
    </div>
<?php
// Statistiques d'utilisation du configurateur (graphiques) sous les cartes
include __DIR__ . '/../includes/admin-stats.php';
else:
// Onglet invest / blog : métriques de ce site, remontées au collecteur central
include __DIR__ . '/../includes/admin-site-stats.php';
endif;
include __DIR__ . '/../includes/admin-footer.php';
