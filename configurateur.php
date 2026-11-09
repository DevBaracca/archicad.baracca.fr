<?php
/**
 * Baracca - Site archicad.baracca.fr
 * Page du configurateur — réservée aux clients connectés (compte client requis)
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/configurations.php';

// Connecté = session active ET compte toujours existant
$user = archicad_current_user();
$isLoggedIn = $user !== null;

// Chargement d'une configuration enregistrée (?config=<id>) — réservée au propriétaire
$configId = '';
if ($isLoggedIn && isset($_GET['config'])) {
    $candidate = (string) $_GET['config'];
    $config = archicad_find_configuration($candidate);
    if ($config !== null && ($config['userId'] ?? '') === (string) $user['id']) {
        $configId = $candidate;
    }
}

$pageTitle = 'Configurateur - Baracca';
$pageDescription = 'Configurateur de modules Baracca : définissez dimensions, toiture, murs et ouvertures, puis exportez le fichier JSON pour Archicad.';
include 'includes/head.html';
?>

  <!-- Hero Section (compact : le configurateur remonte sous le titre) -->
  <section class="hero hero-compact">
    <div class="container">
      <div class="hero-content fade-in">
        <h1>Configurateur de modules</h1>
        <p class="hero-subtitle">Concevez, modifiez, obtenez un chiffrage en temps réel</p>
      </div>
      <?php if ($isLoggedIn): ?>
        <div class="hero-side fade-in">
          <p class="hero-user">
            Connecté en tant que <strong><?= htmlspecialchars(trim(($user['prenom'] ?? '') . ' ' . ($user['nom'] ?? ''))) ?></strong><br>
            <a href="compte.php">Mon compte</a> — <a href="deconnexion.php">Se déconnecter</a>
          </p>
          <p class="hero-user-note">
            Avec votre compte client, vous pouvez enregistrer vos configurations pour les reprendre
            plus tard (onglet « Export JSON ») et les soumettre à Baracca via le bouton « Soumettre ».
            À défaut, aucune donnée n'est transmise, à l'exception de l'adresse e-mail si vous vous
            inscrivez à la newsletter en pied de page.
          </p>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <!-- Configurateur -->
  <section class="section" style="padding-top: var(--spacing-md);">
    <div class="container">
      <?php if ($isLoggedIn): ?>
        <div class="fade-in">
          <iframe
            id="configurateur-frame"
            src="/configurateur/index.html<?= ($configId !== '' ? '?config=' . urlencode($configId) . '&' : '?') ?>v=<?= @filemtime(__DIR__ . '/configurateur/index.html') ?: time() ?>"
            width="100%" height="900"
            style="border:0; background:transparent;"
            title="Configurateur de modules Baracca">
          </iframe>
        </div>

      <?php else: ?>
        <div class="fade-in" style="margin-top: var(--spacing-xl);">
          <div class="auth-card auth-card-narrow auth-card-center">
            <span class="section-tag">Espace client</span>
            <h2>Compte client requis</h2>
            <p>
              L'accès au configurateur est réservé aux clients disposant d'un compte.
              Créez votre compte (gratuit) ou connectez-vous avec votre email et votre mot de passe :
              vous pourrez alors enregistrer vos configurations et les soumettre à Baracca.
            </p>
            <div class="auth-actions auth-actions-center">
              <a href="inscription.php" class="btn btn-cta">Créer un compte</a>
              <a href="connexion.php" class="btn btn-secondary">Se connecter</a>
            </div>
          </div>
        </div>
      <?php endif; ?>

      <!-- Encart explicatif, juste en-dessous du configurateur -->
      <div class="config-intro fade-in">
        <p>
          Le configurateur ci-dessus fonctionne directement dans votre navigateur :
          réglez les dimensions, la toiture, les murs et les ouvertures, visualisez le plan
          et les élévations, puis téléchargez le fichier JSON du module. Ce fichier est lu
          côté Archicad par le script Python Baracca (API JSON officielle + add-on Tapir),
          qui génère automatiquement murs, toiture, plancher et ouvertures.
        </p>
        <p>
          Besoin d'un point de départ ? Un <a href="TEST/Baracca_Module_01.json">exemple de fichier JSON</a>
          est disponible pour visualiser le format d'échange attendu.
        </p>
      </div>
    </div>
  </section>

  <script>
    // Iframe adaptative : hauteur = hauteur du contenu de l'app React
    // (grandit ET rétrécit selon les onglets / zones ouvertes) -> plus de scrolling
    (function () {
      var frame = document.getElementById('configurateur-frame');
      if (!frame) return;
      var last = 0;
      function fit() {
        try {
          var doc = frame.contentDocument;
          if (!doc || !doc.body) return;
          // uniquement le contenu réel du body : documentElement.scrollHeight inclut
          // la hauteur courante de l'iframe -> le blanc augmenterait à chaque resize
          var h = doc.body.scrollHeight;
          var next = Math.max(600, h + 16); // 600 px mini
          if (Math.abs(next - last) > 2) { frame.height = next; last = next; }
        } catch (e) { /* cross-origin : on garde la hauteur fixe */ }
      }
      frame.addEventListener('load', function () {
        fit();
        try {
          if (window.ResizeObserver) {
            var ro = new ResizeObserver(fit);
            ro.observe(frame.contentDocument.body);
            ro.observe(frame.contentDocument.documentElement);
          } else {
            setInterval(fit, 400);
          }
        } catch (e) { setInterval(fit, 400); }
      });
      window.addEventListener('resize', fit);
    })();
  </script>

<?php include 'includes/footer.php'; ?>
