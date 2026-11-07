<?php
/**
 * Baracca - Back-office (archicad.baracca.fr)
 * Gestion des comptes clients du configurateur
 */

require_once __DIR__ . '/../includes/admin-auth.php';
require_once __DIR__ . '/../includes/users.php';
require_once __DIR__ . '/../includes/configurations.php';

archicad_admin_require_auth();

$users = archicad_load_users();
$success = (string) ($_GET['success'] ?? '');

$pageTitle = 'Utilisateurs';
$adminPage = 'utilisateurs';
include __DIR__ . '/../includes/admin-head.php';
?>
    <div class="admin-card">
      <h1>Utilisateurs du configurateur</h1>
      <p>Les clients créent eux-mêmes leur compte depuis la page d'inscription. Cliquez sur le nom d'un client pour voir sa fiche détaillée : c'est depuis cette fiche que vous pouvez réinitialiser son mot de passe ou supprimer son compte (ses configurations enregistrées sont alors supprimées également).</p>
      <?php if ($success === 'deleted'): ?>
        <p class="admin-message admin-message-success">Compte supprimé, ainsi que ses configurations enregistrées.</p>
      <?php endif; ?>
    </div>
    <div class="admin-card">
      <h2>Clients inscrits (<?= count($users) ?>)</h2>
      <?php if ($users === []): ?>
        <p class="admin-hint">Aucun compte client pour le moment.</p>
      <?php else: ?>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Réf. cadastrale</th>
              <th>Configs</th>
              <th>Dernière connexion</th>
              <th>Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($users as $user): ?>
              <tr>
                <td>
                  <strong><a href="utilisateur.php?id=<?= urlencode((string) ($user['id'] ?? '')) ?>"><?= htmlspecialchars(trim((string) ($user['prenom'] ?? '') . ' ' . (string) ($user['nom'] ?? ''))) ?></a></strong>
                </td>
                <td><?= htmlspecialchars((string) ($user['email'] ?? '')) ?></td>
                <td><?= htmlspecialchars((string) ($user['telephone'] ?? '')) ?></td>
                <td><?= htmlspecialchars((string) ($user['reference_cadastrale'] ?? '')) ?></td>
                <td><?= archicad_count_configurations((string) ($user['id'] ?? '')) ?></td>
                <td><?= ($user['last_login'] ?? '') !== '' ? htmlspecialchars((string) $user['last_login']) : '—' ?></td>
                <td><?= htmlspecialchars((string) ($user['created'] ?? '')) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
<?php
include __DIR__ . '/../includes/admin-footer.php';
