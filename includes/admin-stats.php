<?php
/**
 * Baracca - Back-office (configurateur.baracca.fr)
 * Section « Statistiques d'utilisation » du tableau de bord.
 * Inclus par admin/index.php (qui a déjà require includes/stats.php).
 */
$stats = archicad_stats_collect();

// Conversion par utilisateur (top 10 par nb de configs) : barres configs vs soumis
$convItems = [];
$conv = $stats['conversion'];
uasort($conv, fn ($a, $b) => $b['nb'] <=> $a['nb']);
foreach (array_slice($conv, 0, 10, true) as $uid => $c) {
    if ($c['nb'] === 0) {
        continue;
    }
    $convItems[($stats['userNames'][$uid] ?? $uid) . ' — configs'] = $c['nb'];
    $convItems[($stats['userNames'][$uid] ?? $uid) . ' — soumis'] = $c['nbSoum'];
}
?>
    <div class="admin-card">
      <h2>Statistiques d'utilisation</h2>
      <p class="admin-hint">Calculées depuis les comptes, configurations enregistrées, soumissions et connexions (data/).</p>
      <div class="stats-kpis">
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['nbUsers'] ?></span><span class="stats-kpi-k">utilisateurs</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['nbConfigs'] ?></span><span class="stats-kpi-k">configurations enregistrées</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['nbSoumissions'] ?></span><span class="stats-kpi-k">soumissions</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['tauxConversion'] ?> %</span><span class="stats-kpi-k">taux de conversion (soumissions / configs)</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['usersAyantSoumis'] ?></span><span class="stats-kpi-k">utilisateurs ayant soumis</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['delaiMoyen'] !== null ? archicad_format_duree((int) round($stats['delaiMoyen'])) : '—' ?></span><span class="stats-kpi-k">délai moyen 1ʳᵉ config → 1ʳᵉ soumission</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['nbOuvrants'] ?></span><span class="stats-kpi-k">ouvrants placés</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= $stats['nbFenetresToit'] ?></span><span class="stats-kpi-k">fenêtres de toit posées</span></div>
        <div class="stats-kpi"><span class="stats-kpi-v"><?= count($stats['dormants']) ?></span><span class="stats-kpi-k">comptes dormants (+30 j)</span></div>
      </div>
    </div>

    <div class="admin-grid stats-grid">
      <div class="admin-card">
        <h3>Connexions par jour et heure</h3>
        <p class="admin-hint">Heatmap des 7 jours de la semaine × 24 h (connexions enregistrées, tous sites confondus).</p>
        <?= stats_heatmap($stats['grid']) ?>
      </div>
      <div class="admin-card">
        <h3>Métriques des sites baracca.fr</h3>
        <p class="admin-hint">Événements remontés au collecteur central (<code>php/stats_collect.php</code>) par chaque site : connexions, vues d'articles, téléchargements, contacts, newsletters… Le site courant (configurateur) est inclus.</p>
        <?php
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
        $parSite = [];
        foreach ($stats['sites'] as $site => $s) {
            $parSite[$site . '.baracca.fr'] = $s['total'];
        }
        arsort($parSite);
        ?>
        <?php if ($stats['sites'] === []): ?>
          <p class="admin-hint">Aucun événement enregistré pour le moment.</p>
        <?php else: ?>
          <h4>Événements par site</h4>
          <?= stats_bars($parSite, 'Aucun événement.') ?>
          <?php foreach ($stats['sites'] as $site => $s): ?>
            <h4><?= htmlspecialchars($site) ?>.baracca.fr — <?= $s['total'] ?> événement(s), <?= count($s['users']) ?> utilisateur(s) distinct(s)</h4>
            <?= stats_bars(array_combine(array_map($labelEvent, array_keys($s['events'])), array_values($s['events'])), 'Aucun événement.') ?>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
      <div class="admin-card">
        <h3>Conversion par utilisateur (top 10)</h3>
        <p class="admin-hint">Configurations enregistrées vs soumissions, par client.</p>
        <?= stats_bars($convItems, 'Aucune configuration enregistrée.') ?>
      </div>
      <div class="admin-card">
        <h3>Modules par projet</h3>
        <?= stats_bars($stats['modulesParProjet'], 'Aucune configuration enregistrée.') ?>
      </div>
      <div class="admin-card">
        <h3>Comptes dormants (+30 jours sans activité)</h3>
        <?php if ($stats['dormants'] === []): ?>
          <p class="admin-hint">Aucun compte dormant.</p>
        <?php else: ?>
          <ul class="stats-list">
            <?php foreach ($stats['dormants'] as $nom): ?>
              <li><?= htmlspecialchars($nom) ?></li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
      </div>
    </div>

    <div class="admin-card">
      <h2>Choix catalogue les plus fréquents</h2>
      <p class="admin-hint">Agrégés sur toutes les configurations enregistrées (par face / par pent / par projet).</p>
      <div class="stats-grid stats-grid-3">
        <div class="admin-card stats-mini"><h3>Modules</h3><?= stats_bars($stats['top']['modules']) ?></div>
        <div class="admin-card stats-mini"><h3>Formes de toiture</h3><?= stats_bars($stats['top']['formes']) ?></div>
        <div class="admin-card stats-mini"><h3>Murs porteurs</h3><?= stats_bars($stats['top']['murs']) ?></div>
        <div class="admin-card stats-mini"><h3>Planchers</h3><?= stats_bars($stats['top']['planchers']) ?></div>
        <div class="admin-card stats-mini"><h3>Complexe de toiture</h3><?= stats_bars($stats['top']['toitures']) ?></div>
        <div class="admin-card stats-mini"><h3>Couverture (toiture)</h3><?= stats_bars($stats['top']['couvertures']) ?></div>
        <div class="admin-card stats-mini"><h3>Revêtement extérieur (murs)</h3><?= stats_bars($stats['top']['ext']) ?></div>
        <div class="admin-card stats-mini"><h3>Revêtement intérieur (murs)</h3><?= stats_bars($stats['top']['int']) ?></div>
        <div class="admin-card stats-mini"><h3>Sous-face de toiture (intérieur)</h3><?= stats_bars($stats['top']['intToiture']) ?></div>
        <div class="admin-card stats-mini"><h3>Pack autonomie</h3><?= stats_bars($stats['top']['autonomie']) ?></div>
        <div class="admin-card stats-mini"><h3>Ouvrants (menuiseries)</h3><?= stats_bars($stats['top']['menuiseries']) ?></div>
        <div class="admin-card stats-mini"><h3>Fenêtres de toit</h3><?= stats_bars($stats['top']['fenetresToit']) ?></div>
      </div>
    </div>
