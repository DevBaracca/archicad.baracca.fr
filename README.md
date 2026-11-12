# Baracca — Configurateur de modules pour Archicad

Configurateur web (React + Vite) qui génère un fichier JSON d'échange,
consommé par les scripts Python `baracca_import.py` (création d'éléments)
ou `baracca_import_hotlink.py` (modules .mod) côté Archicad.

## Démarrer

```bash
npm install
npm run dev        # développement : http://localhost:5173
npm run build      # production : génère le dossier configurateur/
```

## Structure du site PHP

Ce dossier est désormais un site PHP complet (même mise en page que `dev.baracca.fr`
et `invest.baracca.fr`), dans lequel l'application React est intégrée :

```
index.php                      Accueil (présentation du configurateur)
configurateur.php              Page d'intégration de l'application (iframe) — réservée aux clients connectés.
                                 Mise en page : hero compact, encart explicatif au-dessus de l'iframe ;
                                 dans l'app, plan et élévation empilés à gauche, réglages à droite,
                                 sur fond de page foncé.
inscription.php                Création d'un compte client (accès au configurateur)
connexion.php                  Connexion client (email = identifiant)
deconnexion.php                Déconnexion client
compte.php                     Espace client : profil (modifiable, réf. cadastrale), mot de passe, configurations (ouvrir/supprimer)
mentions-legales.php           Pages légales
cgu.php
politique-confidentialite.php
send_newsletter.php            Inscription newsletter (footer)
config.php                     Configuration générale (identifiants admin, chemins)
data/                          Stockage JSON (comptes, configurations, soumissions) — protégé par .htaccess
includes/head.html             En-tête + navigation (partagés)
includes/footer.php            Pied de page (newsletter, réseaux sociaux, légal)
includes/auth.php              Session client + limitation de débit des connexions
includes/users.php             Comptes clients (création, recherche, mot de passe)
includes/configurations.php    Configurations enregistrées par les clients
includes/soumissions.php       Configurations soumises via « Soumettre »
includes/catalogue.php         Catalogues du configurateur (menuiseries, modèles de modules, enveloppe)
includes/admin-auth.php        Session administrateur + CSRF
includes/admin-head.php        En-tête du back-office
includes/admin-footer.php      Pied de page du back-office
admin/                         Back-office (tableau de bord, utilisateurs, administrateurs, soumissions, catalogues)
assets/                        CSS, JS, images du site (dont admin.css pour le back-office)
configurateur/                 Application React compilée (générée par le build)
src/                           Source React de l'application (Vite, racine = src/)
php/api_session.php            API : état de la session client (pour l'application React)
php/api_configurations.php     API : enregistrer/lister/charger/supprimer une configuration
php/api_catalogue.php          API : lecture des catalogues (pour l'application React)
php/soumettre.php              API : bouton « Soumettre » (envoi de la configuration à Baracca)
php/trace_module.php           Endpoint optionnel de traçage des configurations
TEST/                          Exemple de JSON + script Python d'import Archicad
```

## Comptes clients, configurations et back-office

L'accès au configurateur nécessite un **compte client**, créé en ligne depuis
`inscription.php` : nom, prénom, adresse (numéro de rue, rue, code postal, ville),
référence cadastrale (facultative), email et mot de passe. L'email sert
d'identifiant de connexion (`connexion.php`).

Depuis l'onglet « Export JSON » du configurateur, un client connecté peut :

- **enregistrer** sa configuration pour la reprendre ultérieurement (bouton
  « Enregistrer cette configuration », liste « Mes configurations » avec
  Charger / Supprimer) — les configurations sont aussi listées sur `compte.php`,
  qui permet de les rouvrir directement dans le configurateur (`?config=<id>`)
  **et de les supprimer** ; `compte.php` permet aussi de **modifier son profil**
  (y compris l'email identifiant et la **référence cadastrale**) et de
  **changer son mot de passe** (mot de passe actuel demandé, CSRF) ;
- **soumettre** son dossier (bouton « Soumettre ») : la configuration est
  enregistrée dans `data/soumissions/` et l'architecte est averti par e-mail
  (`dev@baracca.fr`) ; il retrouve le fichier JSON correspondant dans le
  back-office (`admin/soumissions.php`).

**Tableau de bord « Statistiques d'utilisation »** (`admin/index.php`, calculs dans
`includes/stats.php`, vue `includes/admin-stats.php`, graphiques en barres CSS +
heatmap, sans dépendance externe) : KPIs (utilisateurs, configs, soumissions, taux
de conversion, délai moyen 1ʳᵉ config → 1ʳᵉ soumission, ouvrants/fenêtres de toit
posés, comptes dormants +30 j), heatmap des connexions 7 j × 24 h (log
`data/metriques.jsonl` alimenté à chaque login), conversion par utilisateur (top 10),
répartition du nombre de modules par projet, et tops catalogue (modules, formes,
murs, planchers, complexe de toiture, couverture, revêtements ext/int, sous-face
de toiture, autonomie, ouvrants, fenêtres de toit) agrégés sur toutes les
configurations enregistrées (ancien schéma toléré).

**Métriques d'utilisation** : chaque compte client (`data/users.json`) enregistre
`created` (date de création), le nombre de configurations, `last_login`
(dernière connexion, au login), `last_soumission` (dernière soumission, au clic
« Soumettre ») et le temps de connexion par session (`sessions`,
`session_seconds`, `last_session_seconds`, clôturée au logout ou au login
suivant si la session est restée ouverte, plafonnée à 24 h). Affichées dans le
back-office : colonne « Dernière connexion » sur `admin/utilisateurs.php` et
carte « Statistiques d'utilisation » sur la fiche `admin/utilisateur.php`.

Le **back-office** (`/admin/`) permet de gérer les comptes clients
(**modifier leurs informations** depuis la fiche `admin/utilisateur.php`,
réinitialiser un mot de passe, supprimer un compte et ses configurations),
de consulter les soumissions, de gérer les **catalogues du configurateur**
(lien « Configurateur » dans le menu) et de gérer les **administrateurs**
(`admin/administrateurs.php` : ajout, changement de mot de passe, suppression
sauf le dernier). Les administrateurs sont stockés dans `data/admins.json` ;
au premier chargement, le compte défini dans `config.php`
(`ARCHICAD_ADMIN_USERNAME` / `ARCHICAD_ADMIN_PASSWORD_HASH`, ex. `admin` /
`Baracca2025!`) y est repris automatiquement, puis la gestion se fait depuis
la page « Administrateurs » du menu.

Stockage : fichiers JSON dans `data/` (même modèle que les sites invest et
blog), sans base de données. Le dossier est interdit au web par `data/.htaccess`
et son contenu n'est pas versionné (voir `.gitignore`).

Pour définir un nouveau mot de passe administrateur, deux possibilités :
changer le mot de passe depuis la page « Administrateurs » du back-office
(`admin/administrateurs.php`), ou — pour le compte d'amorçage uniquement —
générer un hash bcrypt et remplacer `ARCHICAD_ADMIN_PASSWORD_HASH` dans
`config.php` :

```bash
php -r "echo password_hash('votre_mot_de_passe', PASSWORD_DEFAULT);"
```

## Déployer

1. `npm install` (si besoin)
2. `npm run build` → génère le dossier `configurateur/`
   (l'application est servie sous `/configurateur/`, intégrée par iframe
   dans `configurateur.php`)
3. Copiez sur votre hébergement PHP **uniquement les fichiers d'exécution** :
   - pages `.php` (`index`, `configurateur`, `inscription`, `connexion`,
     `deconnexion`, `compte`, `mentions-legales`, `cgu`,
     `politique-confidentialite`, `send_newsletter`)
   - `config.php` (pensez à y changer le mot de passe administrateur)
   - `includes/` (`head.html`, `footer.php`, `auth.php`, `users.php`,
     `configurations.php`, `soumissions.php`, `catalogue.php`,
     `admin-auth.php`, `admin-head.php`, `admin-footer.php`)
   - `admin/` (back-office, dont `configurateur.php` pour les catalogues)
   - `assets/` (CSS, JS, images — dont `images/catalogue/` pour les visuels
     des menuiseries envoyés depuis le back-office)
   - `configurateur/` (l'application compilée — c'est elle qui est servie)
   - `data/.htaccess` (le dossier `data/` et son contenu sont créés
     automatiquement à la première utilisation)
   - `php/` (`api_session.php`, `api_configurations.php`, `api_catalogue.php`,
     `soumettre.php`, et `trace_module.php` si vous activez le traçage)
   - `TEST/` (le JSON exemple est lié depuis le pied de page)

   **Inutile sur le serveur** (build local uniquement) : `node_modules/`
   (centaines de Mo, dépendances de build), `src/` (source React),
   `package.json` et `vite.config.js` (utilisés seulement par Vite
   au moment du build). Le dossier `configurateur/` contient déjà
   l'application compilée, autonome (HTML + CSS + JS).
4. Si le site est servi sous un sous-dossier, ajustez `base`
   dans `vite.config.js` avant de builder.
5. Renommez `htaccess.txt` en `.htaccess` dans `configurateur/`
   (politique iframe) — voir section « Sécurité iframe » ci-dessous.

## Configurateur côté client : carte « Mes informations »

La colonne de droite contient la carte « Réglages » (onglets Module, Murs &
ouvrages) et, en dessous, la carte « Mes informations » : tarif global,
enregistrement des configurations (à côté de « Mes configurations », seul le
login de connexion est affiché) et bouton « Soumettre » en bas de carte. Le
fichier JSON n'y est pas affiché et les actions copier/télécharger ne sont
possibles que depuis le back-office (soumissions).

## Catalogues du configurateur (back-office)

Les catalogues proposés aux clients sont gérés depuis le back-office
(`admin/configurateur.php`, lien « Configurateur » du menu admin), en trois
cartes : **Structure** (Modules, Isolation, Formes, Autonomie, + onglet
**Promotions** épinglé à droite de la ligne des onglets), **Catalogue**
(Charpentes, Murs, Planchers, Toitures, Ouvrants, Fenêtres de toit, systèmes
Aut.) et **Revêtements** (Extérieur, Intérieur, Toiture). L'ajout
/ la modification d'un élément se fait dans une **boîte
(modale, descendue de 20 px pour ne pas être cachée par le menu fixe)** :
bouton « + » à côté du titre de la rubrique, crayon bleu pour modifier,
croix blanche sur fond rouge pour supprimer ; à la validation la boîte se
referme. Le contenu des pages admin est descendu de 20 px (menu fixe).

- **Modules** — géométrie prédéfinie (longueur, largeur, hauteur
  sous plafond, **toiture choisie dans la rubrique Toitures**, pente,
  pignon), **éléments d'enveloppe liés (mur, plancher, toiture)** et tarif
  (la surface extérieure est celle du mur choisi).
  Le client choisit un modèle dans l'onglet « Module » : géométrie et
  enveloppe lui sont alors présentées en lecture seule (pas de module
  « sur mesure »).
- **Murs** — types de mur porteur (épaisseur, surface, couleur rgb, favori
  Archicad, tarif), liés aux modules.
- **Planchers** — épaisseur (dessinée en élévation), favori Archicad, tarif,
  liés aux modules.
- **Toitures** — géométrie monopente/deux pentes/terrasse, épaisseur, surface,
  couleur rgb, favori, tarif (à l'identique des murs), liées aux modules.
- **Revêtements — Extérieur** (`surfaces.json`) — habillage extérieur des
  murs : visuel téléversé (utilisé dans les élévations du configurateur) et
  tarif au m². Choisi sur la carte d'un mur, côté client.
- **Revêtements — Intérieur** (`interieurs.json`) — revêtements intérieurs
  (murs et sous-face de toiture) : visuel, nom, tarif au m². Choisi sur la
  carte d'un mur (avec l'extérieur) ou d'un pent de toiture (avec la
  couverture), côté client.
- **Revêtements — Toiture** (`couvertures.json`) — couvertures de toiture
  (revêtement de toiture) : visuel, nom, tarif au m², choisi **par pent** côté
  client. Les trois rubriques de revêtements n'ont **pas de favori Archicad**.
- **Ouvrants** — baies vitrées, fenêtres et portes, avec visuel (image
  envoyée depuis le back-office, stockée dans `assets/images/catalogue/`),
  dimensions (largeur × hauteur), favori Archicad et tarif. Le client
  choisit l'ouvrant dans ce catalogue (onglet « Ouvrants ») et
  la positionne sur le mur par pas de 60 cm (flèches « − » / « + »,
  affichage en cm, minimum 7,8 cm — pas de saisie libre).
- **Fenêtres de toit** — à l'identique des ouvrants (visuel, nom, dimensions,
  favori Archicad, coût unitaire). Le client les pose sur un **pent de
  toiture** (clic sur la toiture : « + rajouter une fenêtre de toit »,
  catalogue + position le long du bas de pente, même grille 7,8 cm + 60 cm
  que les ouvrants). Sur le plan, chaque fenêtre est symbolisée par un
  **cadre en pointillé** placé à 20 px de la ligne directrice du bas de pente,
  dont la profondeur projetée tient compte de la pente du versant
  (hauteur × cos pente). Ligne « Fenêtres de toit » au chiffrage (coûts
  unitaires), export `module.toiture.pents[*].fenetres[]`.
- **systèmes Aut.** — systèmes autonomes (panneaux solaires, batterie,
  poêle, récupération d'eau…) : comme les ouvrants (visuel, nom, dimensions,
  favori Archicad) avec un **coût unitaire**.
- **Autonomie** (zone Structure) — packs d'autonomie : chaque élément est
  une **liste de systèmes autonomes** (cases à cocher vers l'onglet
  « systèmes Aut. »), avec visuel et « par défaut » possible. Le client
  choisit un pack dans la rubrique « Autonomie » des réglages généraux
  (fonctionnement identique à « Performance énergétique") ; le coût du
  pack = somme des coûts unitaires de ses systèmes, repris dans la ligne
  « Autonomie » du chiffrage et dans l'export (`module.autonomie`).
- **Promotions** (zone Structure, onglet épinglé à droite, `promotions.json`) —
  codes promotionnels : **code**, **période** (date de début / de fin,
  incluses), **réduction en %** et **modules auxquels la promotion est
  affectée** (cases à cocher). Côté client, une rubrique « Promotion » des
  réglages généraux permet de saisir le code : s'il est actif (date du jour
  dans la période) et affecté à un module utilisé, la réduction s'applique
  aux **éléments de ces modules** (murs, plancher et façade au prorata des
  surfaces, complexe de toiture, couverture, ouvrants, charpente, fenêtres
  de toit — le module lui-même n'a pas de tarif, et l'autonomie n'est pas
  concernée) — ligne « Promotion » (négative, avec sa base HT) au chiffrage,
  `metriques.tarif.promo` / `promoBase` et `metriques.promotion` dans l'export.

**Marge par rubrique** (zones Catalogue et Revêtements) : chaque onglet de ces
deux zones porte un champ « Marge » (coefficient, **1 par défaut** = aucune
marge, 1,15 = +15 %), saisi à droite de la ligne des onglets et stocké dans
`data/catalogue/marges.json`. Côté client, le chiffrage applique ce coefficient
au prix de chaque élément utilisé, selon son onglet : murs × marge « Murs »,
revêtement extérieur × marge « Extérieur », intérieur × marge « Intérieur »,
plancher × marge « Planchers », complexe de toiture × marge « Toitures »,
couverture × marge « Toiture » (couvertures), ouvrants × marge « Ouvrants »,
fenêtres de toit × marge « Fenêtres de toit », charpente × marge « Charpentes »,
systèmes autonomie × marge « systèmes Aut. ». Les rubriques de la zone
Structure (modules, isolation, formes, autonomie) n'ont pas de marge. Les
marges sont servies par `php/api_catalogue.php` (`marges`) et reprises dans
`metriques.tarif` de l'export.

Convention de dessin : la **ligne directrice** des murs est à l'intérieur du
module, l'épaisseur est rejetée vers l'extérieur (plan et élévations, à
échelle unique horizontal/vertical). La position des ouvertures est mesurée
depuis l'origine de la ligne directrice : en élévation, une menuiserie au
minimum (7,8 cm) apparaît donc à 7,8 cm + épaisseur du mur du bord extérieur.

Unités : toutes les **dimensions linéaires** (géométrie du module, épaisseur
de mur, épaisseur de plancher, largeur/hauteur des menuiseries, position des
ouvertures) sont affichées et saisies en **cm avec une précision au mm**
(0,1 cm, ex. « 33,5 cm ») côté configurateur et back-office ; le stockage
(catalogues JSON, export vers Archicad) reste en **mètres**. Les surfaces
restent en m² et les volumes en m³. Couleurs des murs : stockées en **rgb**
(choix r/g/b dans le back-office), affichées en **hexadécimal** (#rrggbb)
dans le plan et les élévations du configurateur.

**Favoris Archicad** : murs, planchers, toitures et menuiseries portent un
champ `favori` (nom du favori Archicad à appliquer, vide = aucun ; les
surfaces n'en ont pas). Le favori est repris dans l'export JSON
(`module.murs[*].favori`, `module.plancher.favori`, `module.facade.favori`,
`module.toiture.favori`, `module.murs[*].ouvertures[*].favori`) pour que
`baracca_import.py` applique le bon favori Archicad. La **toiture** exportée
porte aussi sa géométrie (`module.toiture.geometrie`) et son épaisseur
(`module.toiture.epaisseur`) ; les murs exportent leur revêtement extérieur
(`module.murs[*].surface`) et leur revêtement intérieur
(`module.murs[*].surfaceInterieur`) ; chaque pent de toiture exporte son
revêtement de toiture (`module.toiture.pents[*].surface`) et son revêtement
intérieur (`module.toiture.pents[*].surfaceInterieur`).

Plancher : en élévation, le plancher est dessiné sous les murs — sa **ligne
directrice est en haut** (point bas des murs), son épaisseur s'étend vers le
bas, ses bords à **21,7 cm au-delà de la ligne directrice des murs** (la
représentation du plancher est donc 21,7 cm plus large que les lignes
directrices), et le **trait du sol est à 20 cm sous le bas du plancher**.
Dans l'export JSON, `module.plancher` est un objet
`{ nom, favori, epaisseur, longueur, largeur }` avec
`longueur/largeur = dimensions du module + 2 × 0,217 m` (référence : ligne
directrice des murs). La **surface plancher** reste calculée sur la ligne
directrice des murs ; l'**emprise au sol** (surface plancher + épaisseur des
murs rejetée à l'extérieur) est une métrique affichée et exportée
(`metriques.empriseAuSol`).

Toiture : en élévation, la toiture est dessinée en **bande d'épaisseur** au-
dessus de sa **ligne directrice en bas** (le haut des murs). Si le mur a une
surface avec un visuel, celui-ci remplit le mur de l'élévation (motif SVG),
sinon la couleur rgb (affichée en hex) est utilisée.

Chaque élément porte un champ **tarif** : le configurateur additionne les
tarifs pour afficher au client le **tarif global** du projet au fur et à
mesure, repris dans l'export JSON (`metriques.tarif`) :

- **Murs** : (coût au m² du mur + revêtement **extérieur**) × surface
  **extérieure** du mur (ligne directrice + 2 épaisseurs) + revêtement
  **intérieur** × surface **intérieure** (ligne directrice seule, sans les
  épaisseurs de mur ; ouvrants déduits des deux côtés) ;
- **Complexe de toiture** : structure (coût au m² de la toiture) × surface des
  pents sur la **ligne directrice, sans débords** (`areaBase`) + revêtement
  **intérieur** de la sous-face × surface intérieure du pent (rectangle
  `ligne directrice − 2 épaisseurs de mur`, projeté selon la pente, sans
  débords — `areaBaseInt`) ;
- **Couverture** : coût au m² du revêtement de **toiture** choisi par pent ×
  surface **avec débords** ;
- **Autonomie** : somme des **coûts unitaires** des systèmes autonomes du
  pack choisi (rubrique « Autonomie » des réglages généraux) ;
- **Fenêtres de toit** : somme des **coûts unitaires** des fenêtres posées
  sur les pents de toiture.

Stockage : `data/catalogue/` (JSON, hors git, amorcé automatiquement au
premier chargement avec les valeurs historiques du configurateur), **un
fichier par rubrique** : `menuiseries.json`, `modules.json`, `murs.json`,
`planchers.json`, `surfaces.json` (Extérieur), `interieurs.json` (Intérieur),
`couvertures.json` (Toiture), `toitures.json`, `systemes_aut.json`
(systèmes autonomes), `autonomie.json` (packs autonomie) et
`fenetres_toit.json` (fenêtres de toit) (structure
`{"items": [...]}` ; l'ancien fichier unique `enveloppe.json` est éclaté
automatiquement à la première lecture). L'application React lit les
catalogues en lecture seule via `php/api_catalogue.php` (menuiseries,
modules, murs/planchers/surfaces/interieurs/couvertures/toitures,
systemes_aut/autonomie/fenetres_toit) ; si l'API est indisponible, elle retombe sur les
catalogues par défaut définis en tête de `src/App.jsx` (`MURS`, `PLANCHERS`,
`FACADES`, `INTERIEURS`, `COUVERTURES`, `TOITURES`, `SYSTEMES_AUT`,
`AUTONOMIES`). La géométrie de toiture reste
un vocabulaire fixe (`archicad_catalogue_toiture_types()` : monopente, deux
pentes, terrasse) — champ `type` des éléments de la rubrique Toitures.

## Schéma d'export JSON

Le schéma est versionné (`schemaVersion: "1.0"`). Toute évolution doit
rester rétro-compatible, car les scripts Archicad s'appuient sur la
clé `module` et ses sous-clés `dimensions`, `plancher`, `toiture`,
`murs`. Le détail des tarifs figure dans `metriques.tarif` (module, mur,
plancher, façade, menuiseries, total) — ajout rétro-compatible.

## Métriques multi-sites (tableau de bord)

Le tableau de bord (`admin/index.php`) agrège aussi les événements des autres
sites baracca.fr. Chaque site envoie ses événements en POST serveur -> serveur
au collecteur central `php/stats_collect.php` de ce site, protégé par le jeton
partagé `ARCHICAD_STATS_COLLECT_TOKEN` (identique dans le `config.php` de chaque
site) :

```
POST https://configurateur.baracca.fr/php/stats_collect.php
{"token": "…", "site": "invest", "event": "login", "user": "…", "detail": "…"}
```

Sites autorisés : `configurateur`, `invest`, `blog`, `dev`. Événements :
`login`, `vue`, `telechargement`, `contact`, `newsletter`, `demande`,
`config`, `soumission`. Les événements sont ajoutés à `data/metriques.jsonl`
(champs `site` / `event` / `user` / `detail`, plafond 20 000 lignes) puis
agrégés par site dans `includes/stats.php` (`archicad_stats_collect()` →
clé `sites`) et affichés dans la carte « Métriques des sites baracca.fr ».
Côté émetteur, `includes/stats_client.php` (invest, blog) envoie l'événement
sans jamais bloquer la page (timeout 2 s, erreurs ignorées).

## Sécurité iframe (recommandé)

Sur le serveur qui héberge `configurateur/`, autorisez l'affichage en iframe
depuis votre seul domaine, via nginx :

```
add_header Content-Security-Policy "frame-ancestors https://votre-site.fr";
```

ou Apache (.htaccess) :

```
Header set Content-Security-Policy "frame-ancestors https://votre-site.fr"
```

**Important** : `frame-ancestors` compare l'**origine** (schéma + hôte) de la page
qui intègre l'iframe. La liste doit contenir exactement l'adresse du site déployé —
s'y déployez sur un sous-domaine, celui-ci doit figurer dans la liste, sinon le
navigateur bloque l'iframe. Ici le site est servi sur `https://configurateur.baracca.fr`,
d'où le `htaccess.txt` :

```
Header always set Content-Security-Policy "frame-ancestors https://configurateur.baracca.fr https://baracca.fr https://www.baracca.fr"
```
