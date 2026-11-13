<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Connexion à l'espace client (accès au configurateur)
 */
require_once __DIR__ . '/includes/auth.php';

// Déjà connecté (compte client ou session administrateur) : direction le configurateur
if (archicad_can_use_configurateur()) {
    header('Location: configurateur.php');
    exit;
}

$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['identifier'], $_POST['password'])) {
    if (archicad_rate_limit_is_blocked()) {
        $minutes = (int) ceil(archicad_rate_limit_blocked_seconds() / 60);
        $loginError = 'Trop de tentatives de connexion. Réessayez dans ' . $minutes . ' min.';
    } elseif (archicad_login((string) $_POST['identifier'], (string) $_POST['password'])) {
        archicad_rate_limit_success();
        header('Location: configurateur.php');
        exit;
    } else {
        archicad_rate_limit_failure();
        $loginError = 'Identifiant ou mot de passe incorrect.';
    }
}

$pageTitle = 'Connexion - Baracca';
$pageDescription = 'Connectez-vous à votre espace client Baracca pour accéder au configurateur de modules.';
include 'includes/head.html';
?>

  <section class="section">
    <div class="container">
      <div class="auth-card auth-card-narrow">
        <span class="section-tag">Espace client</span>
        <h1>Connexion</h1>
        <p>Connectez-vous avec votre email et votre mot de passe pour accéder au configurateur.
        Les administrateurs du back-office peuvent se connecter ici avec leur identifiant admin :
        ils basculent directement dans le configurateur (et restent connectés au back-office).</p>

        <?php if ($loginError !== ''): ?>
          <div class="alert alert-error"><?= htmlspecialchars($loginError) ?></div>
        <?php endif; ?>

        <form method="post" action="connexion.php" class="auth-form">
          <div class="form-group">
            <label for="identifier">Email ou identifiant administrateur</label>
            <input type="text" id="identifier" name="identifier" required autofocus autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Mot de passe</label>
            <div class="password-field">
              <input type="password" id="password" name="password" required autocomplete="current-password">
              <button type="button" class="password-toggle" id="password-toggle" aria-label="Afficher le mot de passe" title="Afficher / masquer le mot de passe">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                  <line class="eye-slash" x1="4" y1="4" x2="20" y2="20"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-cta">Se connecter</button>
          </div>
          <p class="auth-links">Pas encore de compte ? <a href="inscription.php">Créer un compte</a></p>
        </form>
      </div>
    </div>
  </section>

<script>
  // Bascule afficher/masquer le mot de passe (icône œil)
  (function () {
    var btn = document.getElementById('password-toggle');
    var input = document.getElementById('password');
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('visible', show);
      btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      btn.title = show ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
    });
  })();
</script>

<?php include 'includes/footer.php'; ?>
