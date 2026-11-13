<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Page intermédiaire après la création d'un compte client : choisir entre la
 * configuration par défaut du configurateur et un « modèle » enregistré par un
 * administrateur (coché « enregistrer en tant que modèle » dans le configurateur).
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/configurations.php';

// Réservé aux comptes clients connectés (un admin va directement au configurateur)
$user = archicad_current_user();
if ($user === null) {
    if (archicad_is_admin()) {
        header('Location: configurateur.php');
        exit;
    }
    header('Location: connexion.php');
    exit;
}

$modeles = archicad_configurations_modeles();
$erreur = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $choix = (string) ($_POST['choix'] ?? '');
    if ($choix === 'defaut') {
        header('Location: configurateur.php');
        exit;
    }
    if ($choix === 'modele') {
        // Le modèle est copié dans les configurations du client (il en devient
        // propriétaire), puis chargé dans le configurateur via ?config=<id>
        $rec = archicad_apply_modele((string) ($_POST['id'] ?? ''), (string) $user['id']);
        if ($rec !== null) {
            header('Location: configurateur.php?config=' . urlencode((string) $rec['id']));
            exit;
        }
        $erreur = 'Ce modèle est introuvable.';
    }
}

$pageTitle = 'Point de départ - Baracca';
$pageDescription = 'Choisissez la configuration par défaut ou un modèle Baracca pour démarrer dans le configurateur de modules.';
include 'includes/head.html';
?>
  <style>
    .modele-grid { display: grid; gap: 12px; margin: 18px 0 22px; }
    .modele-card { display: block; border: 1px solid var(--border, #e7e5e4); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: border-color .15s, background .15s; }
    .modele-card:hover { border-color: #a8a29e; background: #fafaf9; }
    .modele-card input { margin-right: 10px; }
    .modele-card strong { font-size: 1.02rem; }
    .modele-card .modele-meta { display: block; margin-top: 4px; font-size: .85rem; color: var(--muted, #78716c); }
    .modele-card .modele-visuel { display: block; margin-top: 8px; max-width: 100%; max-height: 360px; border-radius: 8px; border: 1px solid var(--border, #e7e5e4); }
  </style>
  <section class="section">
    <div class="container">
      <div class="auth-card">
        <span class="section-tag">Bienvenue</span>
        <h1>Par quoi souhaitez-vous commencer ?</h1>
        <p>
          Bonjour <?= htmlspecialchars((string) ($user['prenom'] ?? '')) ?> — choisissez la
          <strong>configuration par défaut</strong> du configurateur, ou partez d'un
          <strong>modèle</strong> enregistré par l'équipe Baracca.
        </p>

        <?php if ($erreur !== ''): ?>
          <div class="alert alert-error"><?= htmlspecialchars($erreur) ?></div>
        <?php endif; ?>

        <div class="modele-grid">
          <form method="post" action="modele.php">
            <input type="hidden" name="choix" value="defaut">
            <label class="modele-card">
              <input type="radio" name="pick" checked onchange="this.form.submit()">
              <strong>Configuration par défaut</strong>
              <span class="modele-meta">Le configurateur démarre avec les réglages par défaut définis dans le back-office (module, isolation, forme de toiture, charpente, revêtements).</span>
            </label>
          </form>
          <?php foreach ($modeles as $m): ?>
            <form method="post" action="modele.php">
              <input type="hidden" name="choix" value="modele">
              <input type="hidden" name="id" value="<?= htmlspecialchars((string) $m['id']) ?>">
              <label class="modele-card">
                <input type="radio" name="pick" onchange="this.form.submit()">
                <strong>Modèle — <?= htmlspecialchars((string) $m['nom']) ?></strong>
                <?php if ((string) ($m['description'] ?? '') !== ''): ?>
                  <span class="modele-meta"><?= nl2br(htmlspecialchars((string) $m['description'])) ?></span>
                <?php endif; ?>
                <?php if ((string) ($m['visuel'] ?? '') !== ''): ?>
                  <img class="modele-visuel" src="<?= htmlspecialchars((string) $m['visuel']) ?>" alt="Aperçu du modèle <?= htmlspecialchars((string) $m['nom']) ?>">
                <?php endif; ?>
                <span class="modele-meta">Enregistré par <?= htmlspecialchars((string) ($m['userId'] ?? '')) ?> — modifié le <?= htmlspecialchars((string) ($m['updated'] ?? '')) ?>. Une copie est créée dans vos configurations.</span>
              </label>
            </form>
          <?php endforeach; ?>
        </div>

        <p class="auth-links"><a href="configurateur.php">Passer cette étape et ouvrir le configurateur</a></p>
      </div>
    </div>
  </section>

<?php include 'includes/footer.php'; ?>
