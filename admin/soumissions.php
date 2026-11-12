<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Configurations soumises à Baracca via le bouton « Soumettre » du configurateur
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/soumissions.php';

archicad_admin_require_auth();

$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['supprimer'])) {
    if (!archicad_admin_csrf_verify($_POST['csrf'] ?? null)) {
        $message = ['error', 'Jeton de sécurité invalide.'];
    } else {
        $message = archicad_delete_soumission((string) ($_POST['fichier'] ?? ''))
            ? ['success', 'Soumission supprimée.']
            : ['error', 'Soumission introuvable.'];
    }
}

$soumissions = archicad_load_soumissions();
$pageTitle = 'Soumissions';
$adminPage = 'soumissions';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1>Soumissions</h1>
      <p>Configurations envoyées à Baracca par les clients via le bouton « Soumettre » du configurateur. Le fichier JSON téléchargé est le format d'échange consommé par les scripts Python côté Archicad.</p>
      <?php if ($message !== ''): ?>
        <p class="admin-message admin-message-<?= $message[0] ?>"><?= htmlspecialchars($message[1]) ?></p>
      <?php endif; ?>
    </div>
    <div class="admin-card">
      <h2>Configurations soumises (<?= count($soumissions) ?>)</h2>
      <?php if ($soumissions === []): ?>
        <p class="admin-hint">Aucune soumission pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Module</th>
              <th>Surface plancher</th>
              <th>Client</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($soumissions as $soumission): ?>
              <tr>
                <td><?= htmlspecialchars($soumission['soumis_le']) ?></td>
                <td><strong><?= htmlspecialchars($soumission['module']) ?></strong></td>
                <td><?= htmlspecialchars($soumission['surface']) ?> m²</td>
                <td>
                  <?php if ($soumission['utilisateur'] !== null): ?>
                    <strong><?= htmlspecialchars(trim(($soumission['utilisateur']['prenom'] ?? '') . ' ' . ($soumission['utilisateur']['nom'] ?? ''))) ?></strong>
                    <div class="admin-sub"><?= htmlspecialchars((string) ($soumission['utilisateur']['email'] ?? '')) ?></div>
                  <?php else: ?>
                    <span class="admin-sub">—</span>
                  <?php endif; ?>
                </td>
                <td>
                  <div class="admin-actions">
                    <a href="soumission.php?fichier=<?= urlencode($soumission['fichier']) ?>" class="icon-btn" title="Télécharger le JSON" aria-label="Télécharger le JSON">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
                    </a>
                    <form method="post" action="soumissions.php" class="admin-inline-form" onsubmit="return confirm('Supprimer définitivement cette soumission ?');">
                      <input type="hidden" name="csrf" value="<?= htmlspecialchars(archicad_admin_csrf_token()) ?>">
                      <input type="hidden" name="fichier" value="<?= htmlspecialchars($soumission['fichier']) ?>">
                      <button type="submit" name="supprimer" value="1" class="icon-btn danger" title="Supprimer" aria-label="Supprimer">
                        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
<?php
include __DIR__ . '/../includes/admin-footer.php';
