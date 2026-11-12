<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Onglet « site » du tableau de bord (invest / blog) : métriques de ce site
 * remontées au collecteur central (php/stats_collect.php).
 * Inclus par admin/index.php, qui fournit $stats (archicad_stats_collect())
 * et $siteTab (clé du site sélectionné).
 */
$site = (string) ($siteTab ?? 'invest');
$s = $stats['sites'][$site] ?? null;
$siteUrl = 'https://' . $site . '.baracca.fr';
$eventLabels = [
    'login' => 'Connexions',
    'vue' => 'Vues d’articles',
    'telechargement' => 'Téléchargements',
    'contact' => 'Messages de contact',
    'newsletter' => 'Inscriptions newsletter',
    'demande' => 'Demandes',
    'config' => 'Configurations enregistrées',
    'soumission' => 'Soumissions',
];
$labelEvent = fn (string $ev) => $eventLabels[$ev] ?? $ev;
$eventsBars = $s
    ? array_combine(array_map($labelEvent, array_keys($s['events'])), array_values($s['events']))
    : [];
?>
    <div class="admin-card">
      <h2><?= htmlspecialchars($site) ?>.baracca.fr</h2>
      <p class="admin-hint">
        Métriques remontées par ce site au collecteur central (<code>php/stats_collect.php</code>).
        <a href="<?= htmlspecialchars($siteUrl) ?>" target="_blank" rel="noopener">Voir le site</a> ·
        <a href="<?= htmlspecialchars($siteUrl) ?>/admin/" target="_blank" rel="noopener">Son back-office</a>
      </p>
      <?php if (!$s): ?>
        <p class="admin-hint">Aucun événement remonté pour ce site pour le moment (voir le déploiement des sites émetteurs).</p>
      <?php else: ?>
        <div class="stats-kpis">
          <div class="stats-kpi"><span class="stats-kpi-v"><?= (int) $s['total'] ?></span><span class="stats-kpi-k">événements</span></div>
          <div class="stats-kpi"><span class="stats-kpi-v"><?= count($s['users']) ?></span><span class="stats-kpi-k">utilisateurs distincts</span></div>
          <div class="stats-kpi"><span class="stats-kpi-v"><?= (int) ($s['events']['login'] ?? 0) ?></span><span class="stats-kpi-k">connexions</span></div>
        </div>
      <?php endif; ?>
    </div>
<?php if ($s): ?>
    <div class="admin-grid stats-grid">
      <div class="admin-card">
        <h3>Événements</h3>
        <?= stats_bars($eventsBars, 'Aucun événement.') ?>
      </div>
      <div class="admin-card">
        <h3>Connexions par jour et heure</h3>
        <p class="admin-hint">Heatmap des 7 jours de la semaine × 24 h (connexions de <?= htmlspecialchars($site) ?>.baracca.fr).</p>
        <?= stats_heatmap($s['grid']) ?>
      </div>
    </div>
<?php endif; ?>
