<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Création d'un compte client (accès au configurateur)
 */
require_once __DIR__ . '/includes/auth.php';

// Déjà connecté : inutile de recréer un compte
if (archicad_is_logged_in()) {
    header('Location: configurateur.php');
    exit;
}

$errors = [];
$old = [
    'nom' => '', 'prenom' => '', 'email' => '', 'telephone' => '', 'adresse_numero' => '',
    'adresse_rue' => '', 'code_postal' => '', 'ville' => '', 'reference_cadastrale' => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (array_keys($old) as $field) {
        $old[$field] = trim((string) ($_POST[$field] ?? ''));
    }
    $password = (string) ($_POST['password'] ?? '');
    $confirmation = (string) ($_POST['confirmation'] ?? '');

    if ($old['nom'] === '') {
        $errors[] = 'Le nom est obligatoire.';
    }
    if ($old['prenom'] === '') {
        $errors[] = 'Le prénom est obligatoire.';
    }
    if (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Adresse email invalide.';
    } elseif (archicad_find_user_by_email($old['email']) !== null) {
        $errors[] = 'Un compte existe déjà avec cette adresse email.';
    }
    if ($old['telephone'] === '') {
        $errors[] = 'Le téléphone est obligatoire.';
    } elseif (!preg_match('/^\+?[0-9\s.\-()]{8,20}$/', $old['telephone'])) {
        $errors[] = 'Le numéro de téléphone est invalide.';
    }
    if ($old['adresse_numero'] === '') {
        $errors[] = 'Le numéro de rue est obligatoire.';
    }
    if ($old['adresse_rue'] === '') {
        $errors[] = 'La rue est obligatoire.';
    }
    if (!preg_match('/^\d{5}$/', $old['code_postal'])) {
        $errors[] = 'Le code postal doit contenir 5 chiffres.';
    }
    if ($old['ville'] === '') {
        $errors[] = 'La ville est obligatoire.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'Le mot de passe doit contenir au moins 8 caractères.';
    } elseif ($password !== $confirmation) {
        $errors[] = 'La confirmation du mot de passe ne correspond pas.';
    }

    if ($errors === []) {
        $user = archicad_add_user($old, $password);
        if ($user === false) {
            $errors[] = 'Impossible de créer le compte. Veuillez réessayer.';
        } else {
            // Connexion immédiate après inscription, puis page intermédiaire :
            // choix entre la configuration par défaut et un modèle (modele.php)
            archicad_login($old['email'], $password);
            header('Location: modele.php');
            exit;
        }
    }
}

$pageTitle = 'Créer un compte - Baracca';
$pageDescription = 'Créez votre compte client Baracca pour accéder au configurateur de modules, enregistrer vos configurations et les soumettre à Baracca.';
include 'includes/head.html';
?>

  <section class="section">
    <div class="container">
      <div class="auth-card">
        <span class="section-tag">Espace client</span>
        <h1>Créer un compte</h1>
        <p>Ce compte vous donne accès au configurateur de modules : vous pourrez enregistrer vos configurations pour les reprendre plus tard et les soumettre à Baracca.</p>

        <?php if ($errors !== []): ?>
          <div class="alert alert-error">
            <ul class="alert-list">
              <?php foreach ($errors as $error): ?>
                <li><?= htmlspecialchars($error) ?></li>
              <?php endforeach; ?>
            </ul>
          </div>
        <?php endif; ?>

        <form method="post" action="inscription.php" class="auth-form">
          <div class="auth-grid">
            <div class="form-group">
              <label for="nom">Nom <span class="required">*</span></label>
              <input type="text" id="nom" name="nom" required autocomplete="family-name" value="<?= htmlspecialchars($old['nom']) ?>">
            </div>
            <div class="form-group">
              <label for="prenom">Prénom <span class="required">*</span></label>
              <input type="text" id="prenom" name="prenom" required autocomplete="given-name" value="<?= htmlspecialchars($old['prenom']) ?>">
            </div>
            <div class="form-group">
              <label for="email">Email (identifiant de connexion) <span class="required">*</span></label>
              <input type="email" id="email" name="email" required autocomplete="email" value="<?= htmlspecialchars($old['email']) ?>">
            </div>
            <div class="form-group">
              <label for="telephone">Téléphone <span class="required">*</span></label>
              <input type="tel" id="telephone" name="telephone" required autocomplete="tel" value="<?= htmlspecialchars($old['telephone']) ?>" placeholder="06 12 34 56 78">
            </div>
          </div>
          <hr class="auth-separator">
          <div class="auth-grid">
            <div class="form-group">
              <label for="adresse_numero">Numéro <span class="required">*</span></label>
              <input type="text" id="adresse_numero" name="adresse_numero" required autocomplete="address-line1" value="<?= htmlspecialchars($old['adresse_numero']) ?>" placeholder="12 bis">
            </div>
            <div class="form-group">
              <label for="adresse_rue">Rue <span class="required">*</span></label>
              <input type="text" id="adresse_rue" name="adresse_rue" required autocomplete="address-line2" value="<?= htmlspecialchars($old['adresse_rue']) ?>" placeholder="Rue des Lilas">
            </div>
            <div class="form-group">
              <label for="code_postal">Code postal <span class="required">*</span></label>
              <input type="text" id="code_postal" name="code_postal" required autocomplete="postal-code" inputmode="numeric" maxlength="5" value="<?= htmlspecialchars($old['code_postal']) ?>" placeholder="91300">
            </div>
            <div class="form-group">
              <label for="ville">Ville <span class="required">*</span></label>
              <input type="text" id="ville" name="ville" required autocomplete="address-level2" value="<?= htmlspecialchars($old['ville']) ?>" placeholder="Massy">
            </div>
          </div>
          <hr class="auth-separator">
          <div class="auth-grid">
            <div class="form-group">
              <label for="reference_cadastrale">Référence cadastrale (facultative)</label>
              <input type="text" id="reference_cadastrale" name="reference_cadastrale" autocomplete="off" value="<?= htmlspecialchars($old['reference_cadastrale']) ?>">
            </div>
          </div>
          <hr class="auth-separator">
          <div class="auth-grid">
            <div class="form-group">
              <label for="password">Mot de passe <span class="required">*</span></label>
              <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
              <small class="form-hint">8 caractères minimum.</small>
            </div>
            <div class="form-group">
              <label for="confirmation">Confirmer le mot de passe <span class="required">*</span></label>
              <input type="password" id="confirmation" name="confirmation" required minlength="8" autocomplete="new-password">
            </div>
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-cta">Créer mon compte</button>
          </div>
          <p class="auth-links">Vous avez déjà un compte ? <a href="connexion.php">Se connecter</a></p>
        </form>
      </div>
    </div>
  </section>

<?php include 'includes/footer.php'; ?>
