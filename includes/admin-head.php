<?php
// Attendu avant inclusion : $pageTitle (optionnel), $adminPage (section active)
// Mise en page graphique du header/footer du blog (structure .header/.nav de style.css)
$adminPage = $adminPage ?? '';
$adminLoggedIn = archicad_admin_is_logged_in();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title><?= isset($pageTitle) && $pageTitle !== '' ? htmlspecialchars($pageTitle) . ' | ' : '' ?>Administration Baracca</title>
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="stylesheet" href="../assets/css/admin.css">
</head>
<body class="admin-body<?= ($adminPage ?? '') === 'configurateur' ? ' admin-configurateur' : '' ?>">
  <!-- Header (mise en page du site) -->
  <header class="header">
    <div class="container">
      <nav class="nav">
        <a href="../index.php" class="logo">
          <img src="../assets/images/logo-baracca-bandeau.png" alt="Baracca — Administration" class="header-logo">
        </a>
        <?php if ($adminLoggedIn): ?>
          <ul class="nav-links">
            <li><a href="index.php"<?= $adminPage === 'index' ? ' class="active"' : '' ?>>Tableau de bord</a></li>
            <li><a href="utilisateurs.php"<?= $adminPage === 'utilisateurs' ? ' class="active"' : '' ?>>Utilisateurs</a></li>
            <li><a href="soumissions.php"<?= $adminPage === 'soumissions' ? ' class="active"' : '' ?>>Soumissions</a></li>
            <li><a href="configurateur.php"<?= $adminPage === 'configurateur' ? ' class="active"' : '' ?>>Configurateur</a></li>
            <li><a href="administrateurs.php"<?= $adminPage === 'administrateurs' ? ' class="active"' : '' ?>>Administrateurs</a></li>
          </ul>
        <?php else: ?>
          <ul class="nav-links">
            <li><a href="../index.php">Accueil</a></li>
            <li><a href="../configurateur.php">Configurateur</a></li>
          </ul>
        <?php endif; ?>
        <div class="nav-actions">
          <?php if ($adminLoggedIn): ?>
            <a href="logout.php" class="btn btn-secondary">Se déconnecter</a>
          <?php else: ?>
            <a href="index.php" class="nav-admin" title="Administration" aria-label="Administration">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </a>
          <?php endif; ?>
          <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </nav>

      <!-- Mobile Menu -->
      <div class="mobile-menu hidden" id="mobile-menu">
        <ul>
          <?php if ($adminLoggedIn): ?>
            <li><a href="index.php">Tableau de bord</a></li>
            <li><a href="utilisateurs.php">Utilisateurs</a></li>
            <li><a href="soumissions.php">Soumissions</a></li>
            <li><a href="configurateur.php">Configurateur</a></li>
            <li><a href="administrateurs.php">Administrateurs</a></li>
            <li><a href="logout.php">Se déconnecter</a></li>
          <?php else: ?>
            <li><a href="../index.php">Accueil</a></li>
            <li><a href="../configurateur.php">Configurateur</a></li>
          <?php endif; ?>
        </ul>
      </div>
    </div>
  </header>
  <main class="admin-main">
