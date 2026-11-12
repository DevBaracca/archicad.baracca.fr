<?php
/**
 * Baracca - Site configurateur.baracca.fr
 * Configuration générale
 */

// Fuseau horaire
date_default_timezone_set('Europe/Paris');

// Back-office : identifiants de connexion administrateur.
// L'accès au configurateur, lui, fonctionne avec des comptes clients
// (email + mot de passe) créés en ligne depuis inscription.php.
define('ARCHICAD_ADMIN_USERNAME', 'admin');
// Hash bcrypt du mot de passe administrateur — à changer après la première connexion.
// Pour définir un nouveau mot de passe, générez son hash avec :
//   php -r "echo password_hash('votre_mot_de_passe', PASSWORD_DEFAULT);"
// puis remplacez la valeur ci-dessous.
define('ARCHICAD_ADMIN_PASSWORD_HASH', '$2y$12$ggZv1OhTcaaIzsPnu3tIP.CZy46c8uWl/jXwv.VPvElnAHrIiMOTa');

// Chemins
define('ARCHICAD_DATA_DIR', __DIR__ . '/data');

// URL publique du site (liens absolus dans les e-mails de notification)
define('ARCHICAD_SITE_URL', 'https://configurateur.baracca.fr');

// Jeton partagé du collecteur de métriques multi-sites (php/stats_collect.php) :
// les autres sites baracca.fr (invest, blog, dev) y envoient leurs événements
// en POST serveur -> serveur avec ce jeton (identique dans leur config.php).
define('ARCHICAD_STATS_COLLECT_TOKEN', '9db708b595a5a8002de69d8b464edc1bea83878f');

// Limitation de débit des connexions à l'espace client (par adresse IP)
define('ARCHICAD_LOGIN_MAX_ATTEMPTS', 5);     // échecs autorisés...
define('ARCHICAD_LOGIN_WINDOW_SECONDS', 900);  // ...dans une fenêtre de 15 minutes...
define('ARCHICAD_LOGIN_BLOCK_SECONDS', 900);   // ...avant un blocage de 15 minutes
