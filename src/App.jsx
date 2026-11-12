import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
// Vue 3D (Three.js) chargée à la demande : le bundle three (~700 kB) est isolé dans un chunk séparé
const Vue3D = React.lazy(() => import("./Vue3D.jsx"));
import { createPortal } from "react-dom";

/* =================================================================
   Catalogues par défaut — repli si l'API du site est indisponible.
   En production, les catalogues sont gérés depuis le back-office
   (admin/configurateur.php) et servis par /php/api_catalogue.php :
   menuiseries (avec visuel), modèles de modules et enveloppe
   (murs, planchers, façades) — chaque élément porte un tarif.
================================================================= */
const MURS = [
  { id: "clt90", nom: "Mur CLT 90 mm", epaisseur: 0.09, materiau: "CLT", surface: "bardage_bois", rgb: [140, 107, 89], favori: "" },
  { id: "clt140", nom: "Mur CLT 140 mm", epaisseur: 0.14, materiau: "CLT", surface: "bardage_bois", rgb: [140, 107, 89], favori: "" },
  { id: "ossature160", nom: "Ossature bois 160 mm", epaisseur: 0.16, materiau: "Ossature bois", surface: "enduit", rgb: [194, 169, 133], favori: "" },
  { id: "bloc200", nom: "Bloc béton 200 mm", epaisseur: 0.20, materiau: "Béton", surface: "brique", rgb: [158, 158, 158], favori: "" },
];
const TOITURES = [
  { id: "monopente", nom: "Monopente", type: "monopente", epaisseur: 0.30, surface: "", rgb: [120, 113, 108], favori: "Baracca — Toiture monopente" },
  { id: "deuxpentes", nom: "Deux pentes", type: "deuxpentes", epaisseur: 0.30, surface: "", rgb: [120, 113, 108], favori: "Baracca — Toiture deux pentes" },
  { id: "terrasse", nom: "Terrasse plate", type: "terrasse", epaisseur: 0.25, surface: "", rgb: [120, 113, 108], favori: "Baracca — Toiture terrasse" },
];
const FORMES = [
  { id: "forme-monopente-15", nom: "Monopente 15°", geometrie: "monopente", pente: 15, pente1: 15, pente2: 15, pignon: false, image: "" },
  { id: "forme-deuxpentes-30", nom: "Deux pentes 30° / 30°", geometrie: "deuxpentes", pente: 30, pente1: 30, pente2: 30, pignon: true, image: "" },
  { id: "forme-deuxpentes-45", nom: "Deux pentes 45° / 45°", geometrie: "deuxpentes", pente: 45, pente1: 45, pente2: 45, pignon: true, image: "" },
  { id: "forme-quatrepentes-30", nom: "Quatre pentes 30° (croupe)", geometrie: "quatrepentes", pente: 30, pente1: 30, pente2: 30, pignon: false, image: "" },
];
const GEO_LABELS = {
  monopente: "Monopente",
  deuxpentes: "Deux pentes (pignon)",
  quatrepentes: "Quatre pentes (croupe)",
  terrasse: "Terrasse plate",
};
const ISOLATIONS = [
  { id: "isolation-standard", nom: "Isolation standard", mur: "clt140", plancher: "clt_dalle", toiture: "monopente", image: "" },
];
const CHARPENTES = [
  { id: "charpente-tradi", nom: "Charpente traditionnelle", epaisseur: 0.20, rgb: [140, 107, 89], favori: "", tarif: 0, image: "" },
];
// Systèmes autonomes (catalogue « systèmes Aut. » du back-office) : coût unitaire
const SYSTEMES_AUT = [
  { id: "panneaux-3kwc", nom: "Panneaux solaires 3 kWc", largeur: 1.65, hauteur: 0.99, favori: "", tarif: 0, image: "" },
  { id: "batterie-5kwh", nom: "Batterie de stockage 5 kWh", largeur: 0.80, hauteur: 0.50, favori: "", tarif: 0, image: "" },
  { id: "poele-6kw", nom: "Poêle à granulés 6 kW", largeur: 0.60, hauteur: 0.60, favori: "", tarif: 0, image: "" },
  { id: "eau-pluie-5m3", nom: "Récupération d'eau de pluie 5 m³", largeur: 1.20, hauteur: 1.00, favori: "", tarif: 0, image: "" },
];
// Packs « Autonomie » (catalogue « autonomie ») : liste de systèmes autonomes
const AUTONOMIES = [
  { id: "autonomie-standard", nom: "Autonomie standard", defaut: true, systemes: ["panneaux-3kwc", "batterie-5kwh"], image: "" },
];
// Fenêtres de toit (catalogue « Fenêtres de toit » du back-office) : coût unitaire
const FENETRES_TOIT = [
  { id: "velux-78x98", nom: "Fenêtre de toit 0,78 × 0,98 m", largeur: 0.78, hauteur: 0.98, favori: "", tarif: 0, image: "" },
  { id: "velux-114x118", nom: "Fenêtre de toit 1,14 × 1,18 m", largeur: 1.14, hauteur: 1.18, favori: "", tarif: 0, image: "" },
  { id: "puits-lumiere-100", nom: "Puits de lumière 1,00 × 1,00 m", largeur: 1.00, hauteur: 1.00, favori: "", tarif: 0, image: "" },
];
const PLANCHERS = [
  { id: "clt_dalle", nom: "Dalle CLT + chape", epaisseur: 0.30, favori: "" },
  { id: "plancher_bois", nom: "Plancher bois sur lambourdes", epaisseur: 0.24, favori: "" },
  { id: "dalle_beton", nom: "Dalle béton", epaisseur: 0.20, favori: "" },
];
const FACADES = [
  { id: "bardage_bois", nom: "Bardage bois", image: "" },
  { id: "enduit", nom: "Enduit minéral", image: "" },
  { id: "tole", nom: "Tôle nervurée", image: "" },
  { id: "brique", nom: "Brique de parement", image: "" },
];
// Revêtements intérieurs (murs + sous-face de toiture) — catalogue « Intérieur »
const INTERIEURS = [
  { id: "placo_ba13", nom: "Placo BA13 + peinture", image: "" },
  { id: "lambris_bois", nom: "Lambris bois", image: "" },
  { id: "lambris_pvc", nom: "Lambris PVC", image: "" },
];
// Couvertures de toiture (revêtement de toiture, par pent) — catalogue « Toiture »
const COUVERTURES = [
  { id: "bardeaux_bois", nom: "Bardeaux bois", image: "" },
  { id: "joint_debout", nom: "Tôle joint debout", image: "" },
  { id: "tuiles_terre_cuite", nom: "Tuiles terre cuite", image: "" },
  { id: "epdm", nom: "Membrane EPDM (terrasse)", image: "" },
];
const FACES = [
  { key: "nord", label: "Mur Nord" },
  { key: "est", label: "Mur Est" },
  { key: "sud", label: "Mur Sud" },
  { key: "ouest", label: "Mur Ouest" },
];

const DEFAULTS = {
  nom: "Baracca_Module_01",
  moduleId: null, // modèle de module choisi dans le catalogue (géométrie seule)
  isolation: null, // isolation choisie (catalogue « isolation » : mur + plancher + toiture)
  autonomie: null, // pack autonomie choisi (catalogue « autonomie » : liste de systèmes autonomes)
  promoCode: "", // code promotion saisi par le client (rubrique « Promotion »)
  forme: null, // forme de toiture choisie (catalogue « formes » : géométrie, pentes)
  charpente: null, // charpente choisie (catalogue « charpentes »)
  geometrie: null, // géométrie de la forme : monopente / deuxpentes / quatrepentes
  depassee: null, // débord de toiture chosen côté client (cm) ; null = valeur de la forme (back-office)
  longueur: 6.0,
  largeur: 3.0,
  hauteur: 2.8,
  murType: "clt140",
  toiture: "monopente",
  pente: 15, // pente du versant 1 (monopente / quatre pentes : pente unique)
  pente2: null, // pente du versant 2 (deux pentes asymétriques)
  pignon: true,
  plancher: "clt_dalle",
  revetementPlancher: null,    // revêtement de la surface SUPÉRIEURE du plancher (catalogue « Intérieur »)
  revetementChantPlancher: null, // revêtement des CHANTS (côtés) du plancher (catalogue « Extérieur » / surfaces)
  facade: "bardage_bois",
  surfaceToiture: null, // (ancien schéma) surface de toiture unique — migré vers surfacesToiture
  surfacesToiture: {}, // { [instId]: { [versant]: couvertureId|null } } — un revêtement de TOITURE (catalogue « Toiture ») par pent de chaque module
  surfacesIntToiture: {}, // { [instId]: { [versant]: interieurId|null } } — un revêtement INTÉRIEUR (sous-face) par pent de chaque module
  fenetresToit: {}, // { [instId]: { [versant]: [{ fenetreId, largeur, hauteur, position }] } } — fenêtres de toit posées sur chaque pent (position le long du bas de pente, en m)
  // Modules placés côte à côte : chaque instance a une position absolue
  // (x, y en mètres, coin haut-gauche) et son propre modèle ; le module initial
  // en (0,0). Chaque instance a ses propres murs (actif = mur, sinon charpente)
  instances: [
    {
      id: "m0", x: 0, y: 0, moduleId: null,
      murs: {
        // surface = revêtement EXTÉRIEUR (null = celui du type de mur) ;
        // surfaceInt = revêtement INTÉRIEUR (null = premier du catalogue « Intérieur »)
        nord: { actif: true, ouvertures: [], surface: null, surfaceInt: null },
        est: { actif: true, ouvertures: [], surface: null, surfaceInt: null },
        sud: { actif: true, ouvertures: [], surface: null, surfaceInt: null },
        ouest: { actif: true, ouvertures: [], surface: null, surfaceInt: null },
      },
    },
  ],
  selInst: "m0", // instance sélectionnée (carte du mur / élévation)
};

/* ----- Modules multiples (positions absolues x/y en mètres) ----- */
const instOf = (d, id) => (d.instances || []).find((i) => i.id === id) || (d.instances || [])[0];
const modelMurs = (faces) =>
  Object.fromEntries(FACES.map((f) => [f.key, { actif: (faces?.[f.key] ?? "mur") === "mur", ouvertures: [], surface: null, surfaceInt: null }]));
export const bboxOf = (d, dmOf) => {
  const insts = d.instances?.length ? d.instances : [{ x: 0, y: 0, moduleId: d.moduleId }];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const i of insts) {
    const dm = dmOf(i);
    minX = Math.min(minX, i.x); minY = Math.min(minY, i.y);
    maxX = Math.max(maxX, i.x + dm.longueur); maxY = Math.max(maxY, i.y + dm.largeur);
  }
  return { minX, minY, maxX, maxY };
};
// Dimensions du modèle d'une instance (chaque module ajouté peut avoir son propre modèle)
export const dimsOf = (d, env, inst) => {
  const m = env.modules?.find((x) => x.id === (inst?.moduleId || d.moduleId)) || env.modules?.[0];
  return m
    ? { longueur: +m.longueur, largeur: +m.largeur, hauteur: +m.hauteur, faces: m.faces, nom: m.nom, id: m.id, visibilite: m.visibilite }
    : { longueur: d.longueur, largeur: d.largeur, hauteur: d.hauteur, faces: null, nom: null, id: d.moduleId, visibilite: null };
};
// visibilité des constituants d'un module (cases du back-office « Modules ») : tout visible par défaut
const visOfInst = (d, env, inst) => dimsOf(d, env, inst).visibilite || { murs: true, complexe_toiture: true, plancher: true, couverture: true };
// visibilité d'un pent via son instance propriétaire
const pentVisOf = (d, env, p) => visOfInst(d, env, (d.instances || []).find((i) => i.id === p.instId) || { moduleId: d.moduleId });
// arête (mur) visible si l'un des DEUX modules du côté commun a ses murs visibles :
// un module « plancher seul » juxtaposé à un module avec murs laisse le mur commun au voisin
const edgeMursVisible = (d, env, e) =>
  visOfInst(d, env, e.inst).murs || (e.nb ? visOfInst(d, env, e.nb).murs : false);
// épaisseur du mur porteur (isolation choisie) — sert de gap entre les lignes
// directrices de deux modules adjacents (le mur commun occupe cet espace)
export const epMurOf = (d, env) => +((env.murs.find((m) => m.id === d.murType) || env.murs[0])?.epaisseur ?? 0.14);
const spanXm = (d, env) => { const b = bboxOf(d, (i) => dimsOf(d, env, i)); return b.maxX - b.minX; }; // longueur cumulée
const spanYm = (d, env) => { const b = bboxOf(d, (i) => dimsOf(d, env, i)); return b.maxY - b.minY; }; // largeur cumulée
const nbInst = (d) => Math.max(1, d.instances?.length || 1);

/* Versants (pents) d'un module selon la géométrie de toiture */
const versantsOf = (toitType) =>
  toitType === "deuxpentes" ? ["nord", "sud"]
  : toitType === "quatrepentes" ? ["nord", "est", "sud", "ouest"]
  : toitType === "terrasse" ? ["toit"]
  : ["sud"]; // monopente : 1 versant (gouttière au sud)

/* ----- Revêtements : catalogues « Toiture » (couvertures) et « Intérieur » -----
   couvListOf : repli rétro-compat — si le catalogue couvertures est absent
   (vieille API), on retombe sur les surfaces (extérieur), comme avant. */
export const couvListOf = (env) => (env.couvertures?.length ? env.couvertures : env.facades);
export const intListOf = (env) => env.interieurs || [];
// id de couverture effectif d'un pent : valeur enregistrée si elle existe dans
// le catalogue, sinon le défaut (champ surface de la toiture), sinon le 1er
export const couvIdOf = (env, id, fallback) => {
  const l = couvListOf(env);
  if (id && l.some((c) => c.id === id)) return id;
  if (fallback && l.some((c) => c.id === fallback)) return fallback;
  return l[0]?.id ?? id ?? "";
};
// id de revêtement intérieur effectif : valeur enregistrée si valide, sinon le
// repli (revêtement intérieur par défaut de l'élément : mur, plancher, toiture),
// sinon le premier du catalogue « Intérieur » ("" si le catalogue est vide)
export const intIdOf = (env, id, fallback) => {
  const l = intListOf(env);
  if (!l.length) return "";
  if (id && l.some((c) => c.id === id)) return id;
  if (fallback && l.some((c) => c.id === fallback)) return fallback;
  return l[0].id;
};

/* Surface d'un versant côté INTÉRIEUR (sous-face du complexe de toiture) :
   la ligne directrice de la toiture part de la face EXTÉRIEURE des murs, donc
   la sous-face intérieure s'obtient sur le rectangle intérieur (ligne
   directrice - 2 épaisseurs de mur), projeté selon la pente du versant. */
const toitAreaInt = (dmInt, p1, p2, tt, v, nbV) => {
  const c1 = Math.cos((p1 * Math.PI) / 180), c2 = Math.cos((p2 * Math.PI) / 180);
  if (tt === "terrasse") return (dmInt.longueur * dmInt.largeur) / nbV;
  if (tt === "deuxpentes") {
    const t1 = Math.tan((p1 * Math.PI) / 180);
    const hF = hauteurFaitageDm(dmInt, p1, p2, "deuxpentes");
    const run1 = t1 > 0 ? Math.min(Math.max(hF / t1, 0), dmInt.largeur) : dmInt.largeur / 2;
    const run2 = dmInt.largeur - run1;
    return dmInt.longueur * (v === "nord" ? run1 / c1 : run2 / c2);
  }
  if (tt === "quatrepentes") return surfaceToitureDm(dmInt, p1, p2, tt) / 4;
  return dmInt.longueur * (dmInt.largeur / c1); // monopente
};

/* Liste numérotée des pents de tous les modules (pour le chiffrage et la carte toiture) */
function pentsOf(d, env) {
  const toitType = toitTypeOf(d, env);
  const toiture = toitureDefOf(d, env);
  const epToit = +(toiture?.epaisseur ?? 0.30);
  const forme = formeDefOf(d, env);
  // débordée : champ client (d.depassee) sinon champ back-office de la forme, en cm ; défaut = épaisseur toiture
  const dep = Math.max(0, +(d.depassee ?? forme?.depassee ?? epToit * 100)) / 100; // en m (client > forme > épaisseur)
  const c1 = Math.cos((pente1Of(d) * Math.PI) / 180);
  const c2 = Math.cos((pente2Of(d) * Math.PI) / 180);
  const keys = versantsOf(toitType);
  const out = [];
  let n = 0;
  const insts = d.instances?.length ? d.instances : [{ id: "m0", moduleId: d.moduleId }];
  // côtés communs à deux modules ACCOLÉS (mur commun, même profondeur) : pas de débord dessus.
  // eachEdge a besoin de l'épaisseur du MUR (pas de la toiture) pour reconnaître les voisins collés
  const epMur = epMurOf(d, env);
  const edges = eachEdge(d, (i) => dimsOf(d, env, i), epMur);
  // côté commun avec un voisin QUI A un complexe de toiture (un module sans toit
  // ne supprime pas le débord) ; le module lui-même a forcément un toit (pentsOf l'ignore sinon)
  const commun = (instId, face) => edges.some((e) => e.inst.id === instId && e.face === face && !!e.edge
    && visOfInst(d, env, e.inst).complexe_toiture);
  insts.forEach((inst, idx) => {
    const dm = dimsOf(d, env, inst);
    // visibilité du complexe de toiture (back-office « Modules ») : si décoché,
    // les pents de ce module ne sont PAS créés (pas de plan, pas de chiffrage, pas d'export)
    if (!visOfInst(d, env, inst).complexe_toiture) return;
    // rectangle intérieur (sous-face) : ligne directrice - 2 épaisseurs de mur
    const dmInt = { ...dm, longueur: Math.max(0.01, dm.longueur - 2 * epMur), largeur: Math.max(0.01, dm.largeur - 2 * epMur) };
    const nbPigExt = (commun(inst.id, "est") ? 0 : 1) + (commun(inst.id, "ouest") ? 0 : 1); // pignons extérieurs
    const extPerim = FACES.reduce((s, f) => s + (commun(inst.id, f.key) ? 0 : murLongueurDm(dm, f.key)), 0);
    for (const v of keys) {
      n++;
      let area, areaBase; // areaBase = surface sur la ligne directrice, SANS débords (complexe de toiture)
      if (toitType === "terrasse") { areaBase = (dm.longueur * dm.largeur) / keys.length; area = areaBase; }
      else if (toitType === "deuxpentes") {
        // faitage éventuellement décalé (pentes différentes) : chaque versant a sa
        // propre largeur horizontale run1 (nord) / run2 (sud), pas largeur/2
        const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
        const hF = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), "deuxpentes");
        const run1 = t1 > 0 ? Math.min(Math.max(hF / t1, 0), dm.largeur) : dm.largeur / 2;
        const run2 = dm.largeur - run1;
        areaBase = dm.longueur * (v === "nord" ? run1 / c1 : run2 / c2);
        area = areaBase + dm.longueur * dep * nbPigExt;
      }
      else if (toitType === "quatrepentes") { areaBase = surfaceToitureDm(dm, pente1Of(d), pente2Of(d), toitType) / 4; area = areaBase + (dep * extPerim) / 4; }
      else { areaBase = dm.longueur * (dm.largeur / c1); area = areaBase + dm.longueur * dep * nbPigExt; } // monopente
      out.push({
        numero: n, instId: inst.id, instIndex: idx + 1, versant: v, area, areaBase,
        areaBaseInt: toitAreaInt(dmInt, pente1Of(d), pente2Of(d), toitType, v, keys.length), // sous-face intérieure : - 2 épaisseurs de mur
        // couverture masquée pour ce module -> pas de revêtement de toiture créé
        surfaceId: visOfInst(d, env, inst).couverture ? couvIdOf(env, d.surfacesToiture?.[inst.id]?.[v], toiture?.couverture ?? toiture?.surface) : "",
        surfaceIntId: intIdOf(env, d.surfacesIntToiture?.[inst.id]?.[v], toiture?.interieur), // revêtement intérieur (sous-face)
      });
    }
  });
  return out;
}

/* Arêtes (murs) de la configuration : un côté commun à deux modules est
   compté une seule fois, et un mur est prioritaire sur une charpente
   (arête active si l'un des deux côtés est un mur). */
function eachEdge(d, dmOf, ep) {
  const insts = d.instances?.length ? d.instances : [];
  const tol = 0.02; // tolérance 2 cm (positions arrondies, etc.)
  const r = (v) => Math.round(v * 100) / 100; // clé de jonction stable, arrondie au cm
  const seen = new Set();
  let num = 0;
  const out = [];
  for (const inst of insts) {
    const dm = dmOf(inst);
    // chevauchement partiel autorisé sur l'autre axe (jonctions en T comprises)
    const chevY = (j) => { const dj = dmOf(j); return j.y < inst.y + dm.largeur - tol && j.y + dj.largeur > inst.y + tol; };
    const chevX = (j) => { const dj = dmOf(j); return j.x < inst.x + dm.longueur - tol && j.x + dj.longueur > inst.x + tol; };
    for (const f of FACES) {
      let nb = null, nface = null, key = null;
      if (f.key === "est") {
        const x = inst.x + dm.longueur + ep;
        nb = insts.find((j) => Math.abs(j.x - x) < tol && chevY(j));
        if (nb) { const dj = dmOf(nb); key = `V${r(x)}:${r(Math.max(inst.y, nb.y))}-${r(Math.min(inst.y + dm.largeur, nb.y + dj.largeur))}`; nface = "ouest"; }
      } else if (f.key === "ouest") {
        nb = insts.find((j) => Math.abs(j.x + dmOf(j).longueur + ep - inst.x) < tol && chevY(j));
        if (nb) { const dj = dmOf(nb); key = `V${r(inst.x)}:${r(Math.max(inst.y, nb.y))}-${r(Math.min(inst.y + dm.largeur, nb.y + dj.largeur))}`; nface = "est"; }
      } else if (f.key === "sud") {
        const y = inst.y + dm.largeur + ep;
        nb = insts.find((j) => Math.abs(j.y - y) < tol && chevX(j));
        if (nb) { const dj = dmOf(nb); key = `H${r(Math.max(inst.x, nb.x))}-${r(Math.min(inst.x + dm.longueur, nb.x + dj.longueur))}:${r(y)}`; nface = "nord"; }
      } else {
        nb = insts.find((j) => Math.abs(j.y + dmOf(j).largeur + ep - inst.y) < tol && chevX(j));
        if (nb) { const dj = dmOf(nb); key = `H${r(Math.max(inst.x, nb.x))}-${r(Math.min(inst.x + dm.longueur, nb.x + dj.longueur))}:${r(inst.y)}`; nface = "sud"; }
      }
      const a = inst.murs[f.key];
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
        const b = nb.murs[nface];
        out.push({ inst, face: f.key, actif: !!(a?.actif || b?.actif), a, b, edge: key, nb, nface, numero: ++num });
      } else {
        out.push({ inst, face: f.key, actif: !!a?.actif, a, b: null, edge: null, numero: ++num });
      }
    }
  }
  return out;
}
const API_SESSION = "/php/api_session.php";
const API_CONFIGS = "/php/api_configurations.php";
const API_SOUMETTRE = "/php/soumettre.php";
const API_CATALOGUE = "/php/api_catalogue.php";

/* =================================================================
   Calculs
================================================================= */
/* Surface plancher : cumul des surfaces entre 4 murs de chaque module
   (ligne directrice), hors dépassement du plancher */
const surfacePlancher = (d, env) => {
  const insts = d.instances?.length ? d.instances : [{ moduleId: d.moduleId }];
  return insts.reduce((s, i) => { const dm = dimsOf(d, env, i); return s + dm.longueur * dm.largeur; }, 0);
};

/* Emprise au sol : globale (bounding box de tous les modules + épaisseur des
   murs rejetée vers l'extérieur de la ligne directrice) */
const empriseAuSol = (d, env, murDef) =>
  (spanXm(d, env) + 2 * murDef.epaisseur) * (spanYm(d, env) + 2 * murDef.epaisseur);

/* Épaisseur du plancher retenu (m), défaut 20 cm */
export const epaisseurPlancher = (d, planchers) =>
  +((planchers.find((p) => p.id === d.plancher) || planchers[0])?.epaisseur ?? 0.20);

/* Élément de la rubrique « Toitures » référencé par le module (repli sur la
   recherche par type géométrique pour les anciennes configurations) */
export const toitureDefOf = (d, env) =>
  env.toitures.find((t) => t.id === d.toiture)
  || env.toitures.find((t) => t.type === d.toiture)
  || env.toitures[0]
  || { id: "monopente", nom: "Monopente", type: "monopente", favori: "", epaisseur: 0.30, rgb: [120, 113, 108], surface: "" };
/* Forme de toiture choisie côté client (onglet « Formes », catalogue « formes » :
   géométrie + pentes) ; repli sur la forme référencée par l'ancien modèle */
export const formeDefOf = (d, env) => {
  const mod = env.modules?.find((m) => m.id === d.moduleId);
  const formeId = d.forme || mod?.forme || null;
  return formeId ? env.formes?.find((f) => f.id === formeId) || null : null;
};

/* Géométrie de toiture effective : la forme du module prioritairement,
   sinon le type de l'élément toiture (rétro-compatibilité terrasse) */
export const toitTypeOf = (d, env) =>
  d.geometrie || formeDefOf(d, env)?.geometrie || toitureDefOf(d, env).type || "monopente";

/* Pente du versant 2 en degrés (deux pentes asymétriques ; = pente sinon) */
export const pente2Of = (d) => +(d.pente2 ?? d.pente ?? 15);
export const pente1Of = (d) => +(d.pente ?? 15);

/* Versions « dims » (chaque instance de module a son propre modèle, donc ses
   propres longueur/largeur/hauteur) — pentes globales (forme des réglages) */
function surfaceToitureDm(dm, p1, p2, tt) {
  if (tt === "terrasse") return dm.longueur * dm.largeur;
  const c1 = Math.cos((p1 * Math.PI) / 180);
  if (tt === "deuxpentes") {
    // 2 versants, chacun selon sa propre pente ; faitage éventuellement décalé
    // (pentes différentes) : le versant nord fait run1, le sud largeur - run1
    const c2 = Math.cos((p2 * Math.PI) / 180);
    const t1 = Math.tan((p1 * Math.PI) / 180), t2 = Math.tan((p2 * Math.PI) / 180);
    const hF = hauteurFaitageDm(dm, p1, p2, "deuxpentes");
    const run1 = t1 > 0 ? Math.min(Math.max(hF / t1, 0), dm.largeur) : dm.largeur / 2;
    const run2 = dm.largeur - run1;
    return dm.longueur * (run1 / c1 + run2 / c2);
  }
  // monopente : 1 versant sur toute la largeur ; quatre pentes : projection / cos
  return dm.longueur * (dm.largeur / c1);
}

export function hauteurFaitageDm(dm, p1, p2, tt) {
  if (tt === "terrasse") return 0;
  const t1 = Math.tan((p1 * Math.PI) / 180);
  if (tt === "monopente") return t1 * dm.largeur;
  if (tt === "quatrepentes") return t1 * (dm.largeur / 2);
  // deux pentes, éventuellement asymétriques : h = l / (1/tan p1 + 1/tan p2)
  const t2 = Math.tan((p2 * Math.PI) / 180);
  if (t1 <= 0) return dm.largeur * t2;
  if (t2 <= 0) return dm.largeur * t1;
  return dm.largeur / (1 / t1 + 1 / t2);
}

const surfaceToiture = (d, tt) =>
  surfaceToitureDm({ longueur: d.longueur, largeur: d.largeur }, pente1Of(d), pente2Of(d), tt);
const hauteurFaitage = (d, tt) =>
  hauteurFaitageDm({ longueur: d.longueur, largeur: d.largeur }, pente1Of(d), pente2Of(d), tt);
// cumul de la surface de toiture sur toutes les instances = somme des aires
// des pents (pentsOf) : identique au chiffrage estimatif, débords de rive
// compris — ainsi « Réglages généraux », le chiffrage et l'export JSON affichent
// la même surface, y compris en deux pentes asymétriques
const surfaceToitureTotale = (d, env, tt) =>
  pentsOf(d, env).reduce((s, p) => s + p.area, 0);

/* Volume brut d'un module = parallélépipède (L × l × H) + partie triangulaire de la
   toiture au-dessus des murs : prisme triangulaire en monopente/deux pentes
   (section = l × hF / 2), pyramide approchée en quatre pentes (L × l × hF / 3). */
const volumeBrutInst = (d, env, dm) => {
  const box = dm.longueur * dm.largeur * dm.hauteur;
  const tt = toitTypeOf(d, env);
  if (tt === "terrasse") return box;
  const hF = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), tt);
  if (tt === "quatrepentes") return box + (dm.longueur * dm.largeur * hF) / 3;
  return box + (dm.longueur * (dm.largeur * hF)) / 2;
};
const volumeBrutOf = (d, env) =>
  (d.instances?.length ? d.instances : [{ moduleId: d.moduleId }])
    .reduce((s, i) => s + volumeBrutInst(d, env, dimsOf(d, env, i)), 0);

const murLongueurDm = (dm, face) =>
  face === "nord" || face === "sud" ? dm.longueur : dm.largeur;
const murLongueur = (d, face) => murLongueurDm({ longueur: d.longueur, largeur: d.largeur }, face);

/* Position des ouvertures sur le mur, mesurée depuis l'origine de la ligne
   directrice (à l'intérieur du mur, l'épaisseur étant rejetée vers
   l'extérieur) : affichée en cm, ajustée par pas de 60 cm (flèches),
   minimum 7,8 cm — pas de saisie libre (stockage en m) */
const POSITION_MIN = 0.078; // 7,8 cm
const POSITION_STEP = 0.6;  // 60 cm

/* Plancher : dépasse de 21,7 cm de chaque côté de la ligne directrice des
   murs (référence retenue dans l'export JSON) ; en élévation, la ligne
   directrice du plancher est en haut (point bas des murs) et le trait du
   sol est à 20 cm sous le bas du plancher */
export const PLANCHER_DEPASSEMENT = 0.217; // 21,7 cm de chaque côté
export const SOL_SOUS_PLANCHER = 0.20;     // 20 cm

const surfaceMenuiserie = (m) =>
  (m?.ouvertures || []).reduce((s, o) => s + o.largeur * o.hauteur, 0);

function validerOuverture(d, dm, faceKey, o) {
  const L = murLongueurDm(dm, faceKey);
  return o.position >= POSITION_MIN && o.position + o.largeur <= L && o.hauteur <= dm.hauteur;
}

/* =================================================================
   Tarifs (issus des catalogues du back-office — champ « tarif » de
   chaque élément : modèle de module, mur, plancher, façade, menuiserie)
================================================================= */
const fmtEur = (n) =>
  (Math.round((+n || 0) * 100) / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

/* m -> cm, au dixième près (précision mm), virgule française (7,8 / 33,5 / 150) */
const fmtCm = (m) => String(Math.round(m * 1000) / 10).replace(".", ",");

/* m² -> « 42,0 m² » (virgule française, 1 décimale) */
const fmtM2 = (m2) => m2.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " m²";

/* Couleur d'affichage des murs en hexadécimal (#rrggbb), à partir du rgb
   stocké dans le catalogue (le choix des couleurs reste en rgb côté back-office) */
export const rgbHex = (rgb) =>
  "#" + (Array.isArray(rgb) ? rgb : [158, 158, 158])
    .map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0"))
    .join("");
// mélange deux couleurs hexa (t = 0 -> c1, t = 1 -> c2) — utilisé pour griser
// les segments profonds des élévations
export const mixHex = (c1, c2, t) => {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1), b = p(c2);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("");
};

function tarifOuverture(o, menuiseries) {
  if (!menuiseries) return 0;
  const m = menuiseries.find((x) => x.id === o.menuiserieId);
  return m ? +m.tarif || 0 : 0;
}

/* coût au m² d'un élément de catalogue (murs, planchers, toitures, surfaces) */
const eurM2 = (item) => (item ? +item.tarif || 0 : 0);

/* Coefficient de marge d'une rubrique (champ « Marge » du back-office, zones
   Catalogue et Revêtements) : appliqué au chiffrage — prix de l'élément × marge
   de son onglet. Défaut 1 = aucune marge. */
const margeOf = (env, kind) => {
  const v = env.marges?.[kind];
  return v == null || !isFinite(+v) ? 1 : Math.max(0, +v);
};

/* Murs retenus pour le chiffrage (extérieurs, épaisseurs comprises), avec détail
   par mur : longueur extérieure (ligne directrice + 2 épaisseurs) × hauteur, moins
   les surfaces des ouvrants ; si pignon, + triangle de toiture sur est/ouest et
   épaisseur de toiture sur les 2 versants. */
function mursChiffrage(d, env) {
  const murDef = env.murs.find((m) => m.id === d.murType) || env.murs[0];
  const toiture = toitureDefOf(d, env);
  const toitType = toitTypeOf(d, env);
  const epMur = +(murDef?.epaisseur ?? 0.14);
  const epToit = +(toiture?.epaisseur ?? 0.30);
  const p1 = pente1Of(d), p2 = pente2Of(d);
  const c1 = Math.cos((p1 * Math.PI) / 180);
  const c2 = Math.cos((p2 * Math.PI) / 180);
  let total = 0;
  const detail = [];
  // une arête par mur (côtés communs comptés une fois, mur prioritaire sur charpente)
  eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).forEach((e) => {
    if (!e.actif) return;
    if (!edgeMursVisible(d, env, e)) return; // murs non visibles des deux côtés : pas comptés
    const dm = dimsOf(d, env, e.inst); // dims du modèle de ce module
    const hF = hauteurFaitageDm(dm, p1, p2, toitType);
    const longueurExt = murLongueurDm(dm, e.face) + 2 * epMur; // épaisseurs aux 2 extrémités (EXTÉRIEUR)
    const longueurLD = murLongueurDm(dm, e.face);              // ligne directrice seule (INTÉRIEUR)
    let area = longueurExt * dm.hauteur;    // surface extérieure : mur + revêtement extérieur
    let areaInt = longueurLD * dm.hauteur;  // surface intérieure : revêtement intérieur, SANS les épaisseurs de mur
    // deux pentes = pignon : triangle de toiture sur est/ouest
    if (toitType === "deuxpentes" && (e.face === "est" || e.face === "ouest")) {
      const base = dm.largeur + 2 * epMur;
      const v1 = (base / 2) / c1, v2 = (base / 2) / c2;  // longueur des 2 versants (pentes propres)
      area += (base * hF) / 2 + (v1 + v2) * epToit;     // triangle du pignon + ép. toiture sur les 2 versants (ext.)
      areaInt += (dm.largeur * hF) / 2;                // triangle du pignon côté intérieur (ligne directrice)
    }
    // monopente : le mur nord monte droit jusqu'au faitage (hauteur + hF) ;
    // est/ouest ont le triangle de pignon (pan incliné vu de côté)
    if (toitType === "monopente") {
      if (e.face === "nord") { area = longueurExt * (dm.hauteur + hF); areaInt = longueurLD * (dm.hauteur + hF); }
      else if (e.face === "est" || e.face === "ouest") {
        const base = dm.largeur + 2 * epMur;
        area += (base * hF) / 2 + (base / c1) * epToit; // triangle de pignon + ép. toiture (ext.)
        areaInt += (dm.largeur * hF) / 2;              // triangle côté intérieur (ligne directrice)
      }
    }
    // quatre pentes (croupe) et terrasse : les murs restent rectangulaires,
    // ce sont les versants de toiture qui forment les croupes
    // les ouvrants remplacent de la surface de mur (des deux côtés : ils traversent le mur)
    const ouv = [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])];
    const ouvArea = ouv.reduce((ss, o) => ss + o.largeur * o.hauteur, 0);
    area -= ouvArea;
    areaInt -= ouvArea;
    const surfaceId = e.a?.surface ?? murDef?.surface ?? "";
    const surfaceIntId = intIdOf(env, e.a?.surfaceInt, murDef?.interieur); // revêtement intérieur du mur (défaut = type de mur)
    const sd = env.facades.find((f) => f.id === surfaceId);
    const sdInt = intListOf(env).find((f) => f.id === surfaceIntId);
    // mur + revêtement ext sur la surface EXTÉRIEURE (ligne directrice + épaisseurs) ;
    // revêtement intérieur sur la LIGNE DIRECTRICE seule (sans épaisseurs de mur)
    // montant total = base (mur) + revêtement ext + revêtement int, détaillé à l'affichage
    const amountMur = eurM2(murDef) * margeOf(env, "murs") * area;
    const amountExt = eurM2(sd) * margeOf(env, "surfaces") * area;
    const amountInt = eurM2(sdInt) * margeOf(env, "interieurs") * areaInt;
    const amount = amountMur + amountExt + amountInt;
    total += area;
    detail.push({
      key: e.edge || `${e.inst.id}-${e.face}`,
      numero: e.numero,
      label: `Mur ${e.numero}` + (e.edge ? " (partagé)" : ""),
      instId: e.inst.id, // instance propriétaire de l'arête (promotions)
      surfaceId, surfaceIntId, area, areaInt, amount, amountMur, amountExt, amountInt,
    });
  });
  return { total, detail };
}

/* Surfaces retenues pour le chiffrage : murs (avec détail par mur), plancher
   (ligne directrice), toiture (versant + 2 épaisseurs de toiture, haut et bas),
   ouvrants (nombre d'ouvertures, murs actifs). */
function surfacesChiffrage(d, env) {
  const toiture = toitureDefOf(d, env);
  const toitType = toitTypeOf(d, env);
  const epToit = +(toiture?.epaisseur ?? 0.30);
  const c1 = Math.cos((pente1Of(d) * Math.PI) / 180);
  const c2 = Math.cos((pente2Of(d) * Math.PI) / 180);
  const M = mursChiffrage(d, env);
  // plancher : cumul des surfaces des modules dont le plancher est visible
  const insts0 = d.instances?.length ? d.instances : [{ moduleId: d.moduleId }];
  const plancher = insts0.reduce((s, i) => {
    if (!visOfInst(d, env, i).plancher) return s;
    const dm = dimsOf(d, env, i);
    return s + dm.longueur * dm.largeur;
  }, 0);
  // surface toiture : cumul des pents (couverture si visible, complexe si visible)
  const pents = pentsOf(d, env);
  const toitureS = pents.reduce((s, p) => s + (pentVisOf(d, env, p).couverture ? p.area : 0), 0); // avec débords (couverture)
  const toitureBase = pents.reduce((s, p) => s + (pentVisOf(d, env, p).complexe_toiture ? (p.areaBase ?? p.area) : 0), 0); // sans débords (complexe)
  const edges = eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env));
  const ouvrants = edges.reduce(
    (n, e) => n + (e.actif && edgeMursVisible(d, env, e) ? (e.a?.ouvertures.length || 0) + (e.b?.ouvertures.length || 0) : 0),
    0
  );
  // côtés passés en charpente (pas de mur) : comptés à l'unité
  const charpentes = edges.reduce((n, e) => n + (!e.actif && edgeMursVisible(d, env, e) ? 1 : 0), 0);
  // détail plancher : une ligne par module (plancher visible)
  const plancherDetail = insts0.map((i, idx) => {
    const dm = dimsOf(d, env, i);
    return { key: i.id || `m${idx}`, instId: i.id, label: `Module ${idx + 1}${dm.nom ? ` — ${dm.nom}` : ""}`, area: dm.longueur * dm.largeur };
  }).filter((p, idx) => visOfInst(d, env, insts0[idx]).plancher);
  // surface des CHANTS du plancher (périmètre ligne directrice des modules visibles × épaisseur)
  const epP = epaisseurPlancher(d, env.planchers);
  const plancherChant = insts0.reduce((s, i) => {
    if (!visOfInst(d, env, i).plancher) return s;
    const dm = dimsOf(d, env, i);
    return s + 2 * (dm.longueur + dm.largeur) * epP;
  }, 0);
  // fenêtres de toit : nombre total posées sur les pents
  const fenetresToit = Object.values(d.fenetresToit || {}).reduce(
    (n, perInst) => n + Object.values(perInst || {}).reduce((s, list) => s + (list?.length || 0), 0), 0);
  return { murs: M.total, mursDetail: M.detail, plancher, plancherDetail, plancherChant, toiture: toitureS, toitureBase, pents, ouvrants, charpentes, fenetresToit };
}

function tarifTotal(d, env) {
  const module = env.modules?.find((m) => m.id === d.moduleId);
  const mur = env.murs.find((m) => m.id === d.murType);
  const plancher = env.planchers.find((p) => p.id === d.plancher);
  const facade = env.facades.find((f) => f.id === d.facade);
  const toiture = toitureDefOf(d, env);
  const S = surfacesChiffrage(d, env);
  // Ouvrants : détail par ouverture (mur, menuiserie, dimensions, position, montant) ;
  // coût à l'unité, murs actifs seulement
  const ouvrantsDetail = [];
  eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).forEach((e) => {
    if (!e.actif) return;
    if (!edgeMursVisible(d, env, e)) return; // murs non visibles des deux côtés
    [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])].forEach((o, i) => {
      const m = env.menuiseries?.find((x) => x.id === o.menuiserieId);
      ouvrantsDetail.push({
        key: `${e.edge || `${e.inst.id}-${e.face}`}-ouv-${i}`,
        label: `Mur ${e.numero}` + (e.edge ? " (partagé)" : ""),
        nom: m?.nom || "Ouverture sur mesure",
        largeur: o.largeur, hauteur: o.hauteur, position: o.position,
        amount: tarifOuverture(o, env.menuiseries) * margeOf(env, "menuiseries"),
      });
    });
  });
  const menuiseries = ouvrantsDetail.reduce((s, o) => s + o.amount, 0);
  // murs : somme des montants par mur (coût mur + revêtement extérieur + revêtement intérieur, × surface)
  const murAmount = S.mursDetail.reduce((s, m) => s + m.amount, 0);
  // complexe de toiture : structure (toiture × marge Toitures) sur areaBase = ligne
  // directrice SANS débords ; revêtement intérieur (sous-face × marge Intérieur) sur
  // areaBaseInt = rectangle intérieur (ligne directrice - 2 épaisseurs de mur), sans débords
  const toitureAmount = (S.pents || []).filter((p) => pentVisOf(d, env, p).complexe_toiture).reduce((s, p) => {
    const sdInt = intListOf(env).find((f) => f.id === p.surfaceIntId);
    return s + eurM2(toiture) * margeOf(env, "toitures") * (p.areaBase ?? p.area)
      + eurM2(sdInt) * margeOf(env, "interieurs") * (p.areaBaseInt ?? p.areaBase ?? p.area);
  }, 0);
  // couverture : tarif du revêtement de TOITURE choisi × marge Toiture (couvertures)
  // × surface AVEC débords — seulement si la couverture est visible pour le module
  const couvertureAmount = (S.pents || []).filter((p) => pentVisOf(d, env, p).couverture).reduce((s, p) => {
    const sd = couvListOf(env).find((f) => f.id === p.surfaceId);
    return s + eurM2(sd) * margeOf(env, "couvertures") * p.area;
  }, 0);
  // Charpente : coût unitaire × marge Charpentes × nb de côtés en charpente,
  // avec une ligne de détail par côté charpente
  const charpenteDef = env.charpentes?.find((c) => c.id === d.charpente);
  const charpenteUnit = (charpenteDef ? +charpenteDef.tarif || 0 : 0) * margeOf(env, "charpentes");
  const charpenteDetail = [];
  eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).forEach((e) => {
    if (e.actif || !edgeMursVisible(d, env, e)) return;
    charpenteDetail.push({
      key: e.edge || `${e.inst.id}-${e.face}`,
      label: `Mur ${e.numero}` + (e.edge ? " (partagé)" : "") + " — charpente",
      amount: charpenteUnit,
    });
  });
  const charpenteAmount = charpenteDetail.reduce((s, c) => s + c.amount, 0);
  // Autonomie : somme des coûts unitaires × marge systèmes Aut. des systèmes du pack choisi
  const autoDef = env.autonomies?.find((a) => a.id === d.autonomie);
  const systemesSel = (autoDef?.systemes || [])
    .map((sid) => env.systemesAut?.find((s) => s.id === sid))
    .filter(Boolean);
  // détail du pack autonomie : un système par ligne (nom, dimensions, montant unitaire × marge)
  const autonomieDetail = systemesSel.map((sy) => ({
    id: sy.id, nom: sy.nom, largeur: sy.largeur, hauteur: sy.hauteur,
    amount: (+sy.tarif || 0) * margeOf(env, "systemes_aut"),
  }));
  const autonomieAmount = autonomieDetail.reduce((s, sy) => s + sy.amount, 0);
  // Fenêtres de toit : détail par fenêtre posée (pent, modèle, dimensions, position, montant)
  const fenetresToitDetail = [];
  Object.entries(d.fenetresToit || {}).forEach(([instId, perInst]) => {
    // fenêtres de toit non comptées si le complexe de toiture est masqué pour ce module
    if (!visOfInst(d, env, instOf(d, instId) || { moduleId: d.moduleId }).complexe_toiture) return;
    Object.entries(perInst || {}).forEach(([versant, list]) => (list || []).forEach((f, i) => {
      const m = env.fenetresToit?.find((x) => x.id === f.fenetreId);
      const p = (S.pents || []).find((pp) => pp.instId === instId && pp.versant === versant);
      fenetresToitDetail.push({
        key: `${instId}-${versant}-fen-${i}`,
        label: p ? `Pent ${p.numero} (module ${p.instIndex}, ${p.versant})` : `${instId} / ${versant}`,
        nom: m?.nom || "Fenêtre sur mesure",
        largeur: f.largeur, hauteur: f.hauteur, position: f.position,
        amount: (m ? +m.tarif || 0 : 0) * margeOf(env, "fenetres_toit"),
      });
    }));
  });
  const fenetresToitAmount = fenetresToitDetail.reduce((s, f) => s + f.amount, 0);
  const moduleBrut = module ? +module.tarif || 0 : 0;
  // plancher : base + revêtement supérieur (Intérieur) sur la surface + revêtement des chants (Extérieur)
  const sdPlancherHaut = intListOf(env).find((f) => f.id === intIdOf(env, d.revetementPlancher, plancher?.revetement_sup));
  const sdChant = env.facades.find((f) => f.id === (d.revetementChantPlancher ?? plancher?.revetement_chants ?? mur?.surface));
  const plancherBase = eurM2(plancher) * margeOf(env, "planchers") * S.plancher;
  const plancherHautAmount = eurM2(sdPlancherHaut) * margeOf(env, "interieurs") * S.plancher;
  const plancherChantAmount = eurM2(sdChant) * margeOf(env, "surfaces") * (S.plancherChant || 0);
  const t = {
    module: moduleBrut,
    mur: murAmount,
    plancher: plancherBase + plancherHautAmount + plancherChantAmount,
    plancherBase, plancherHautAmount, plancherChantAmount,
    plancherHautId: sdPlancherHaut?.id || "", plancherChantId: sdChant?.id || "", plancherChantArea: S.plancherChant || 0,
    facade: (facade ? +facade.tarif || 0 : 0) * margeOf(env, "surfaces"),
    toiture: toitureAmount,
    couverture: couvertureAmount,
    menuiseries,
    charpente: charpenteAmount,
    charpenteDetail,
    plancherDetail: (S.plancherDetail || []).map((p) => ({
      ...p,
      amount: eurM2(plancher) * margeOf(env, "planchers") * p.area + eurM2(sdPlancherHaut) * margeOf(env, "interieurs") * p.area,
      amountBase: eurM2(plancher) * margeOf(env, "planchers") * p.area,
      amountHaut: eurM2(sdPlancherHaut) * margeOf(env, "interieurs") * p.area,
    })),
    autonomie: autonomieAmount,
    autonomieNb: systemesSel.length,
    fenetresToit: fenetresToitAmount,
    // détails dépliables (tableaux : exclus de l'export metriques.tarif, filtré aux nombres)
    ouvrantsDetail, fenetresToitDetail, autonomieDetail,
  };
  // détail par pent (numéro, revêtements, montants) — couverture : revêtement de toiture choisi
  // × surface avec débords ; complexe : (toiture + revêtement intérieur) × surface sans débords
  t.pents = (S.pents || []).map((p) => {
    const sdCouv = couvListOf(env).find((f) => f.id === p.surfaceId);
    const sdInt = intListOf(env).find((f) => f.id === p.surfaceIntId);
    const pv = pentVisOf(d, env, p);
    const areaBase = p.areaBase ?? p.area;
    const areaBaseInt = p.areaBaseInt ?? areaBase;
    // complexe : montant de base = structure seule ; sous-face = revêtement intérieur séparé
    const amountBaseStruct = pv.complexe_toiture ? eurM2(toiture) * margeOf(env, "toitures") * areaBase : 0;
    const amountBaseInt = pv.complexe_toiture ? eurM2(sdInt) * margeOf(env, "interieurs") * areaBaseInt : 0;
    return {
      ...p,
      // visibilité des constituants du module : couverture et/ou complexe masqués = montant à 0
      amount: pv.couverture ? eurM2(sdCouv) * margeOf(env, "couvertures") * p.area : 0, // couverture : avec débords
      amountBase: amountBaseStruct + amountBaseInt, // total complexe (structure + sous-face)
      amountBaseStruct, amountBaseInt, areaBase, areaBaseInt,
    };
  });
  // Promotion active (code saisi + période en cours + module affecté) : la
  // réduction s'applique aux ÉLÉMENTS des instances dont le modèle est
  // concerné (murs, ouvrants, charpente, pents, fenêtres de toit, plancher et
  // façade au prorata des surfaces) — pas au module lui-même (pas de tarif)
  // ni à l'autonomie.
  const promo = promoActive(d, env);
  let promoBaseAmount = 0;
  if (promo) {
    const aff = new Set(promo.modules || []);
    const insts = d.instances?.length ? d.instances : [{ id: "m0", moduleId: d.moduleId }];
    const isAff = (instId) => {
      const i = insts.find((x) => x.id === instId);
      return !!i && aff.has(i.moduleId || d.moduleId);
    };
    // murs (détail par arête, attribués à l'instance propriétaire)
    promoBaseAmount += S.mursDetail.filter((m) => isAff(m.instId)).reduce((s, m) => s + m.amount, 0);
    // ouvrants (murs actifs) et charpentes (côtés sans mur), par arête
    eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).forEach((e) => {
      if (!isAff(e.inst.id)) return;
      if (e.actif) {
        promoBaseAmount += [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])]
          .reduce((ss, o) => ss + tarifOuverture(o, env.menuiseries) * margeOf(env, "menuiseries"), 0);
      } else {
        const cd = env.charpentes?.find((c) => c.id === d.charpente);
        promoBaseAmount += (cd ? +cd.tarif || 0 : 0) * margeOf(env, "charpentes");
      }
    });
    // pents : complexe de toiture + couverture
    (t.pents || []).forEach((p) => { if (isAff(p.instId)) promoBaseAmount += (p.amountBase || 0) + (p.amount || 0); });
    // fenêtres de toit, par instance
    Object.entries(d.fenetresToit || {}).forEach(([instId, perInst]) => {
      if (!isAff(instId)) return;
      Object.values(perInst || {}).forEach((list) => (list || []).forEach((f) => {
        const m = env.fenetresToit?.find((x) => x.id === f.fenetreId);
        promoBaseAmount += (m ? +m.tarif || 0 : 0) * margeOf(env, "fenetres_toit");
      }));
    });
    // plancher + façade globale au prorata de la surface des modules concernés
    const totSurf = insts.reduce((s, i) => { const dm = dimsOf(d, env, i); return s + dm.longueur * dm.largeur; }, 0);
    const affSurf = insts.reduce((s, i) => { if (!isAff(i.id)) return s; const dm = dimsOf(d, env, i); return s + dm.longueur * dm.largeur; }, 0);
    const share = totSurf > 0 ? affSurf / totSurf : 0;
    promoBaseAmount += (t.plancher + t.facade) * share;
  }
  t.promoBase = promoBaseAmount; // base HT des éléments concernés (0 si pas de promo)
  t.promo = promo ? -promoBaseAmount * (+promo.reduction || 0) / 100 : 0; // négatif si promo active
  t.promoInfo = promo ? { code: promo.code, reduction: +promo.reduction } : null;
  t.total = t.module + t.mur + t.plancher + t.facade + t.toiture + t.couverture + t.menuiseries + t.charpente + t.autonomie + t.fenetresToit + t.promo;
  return t;
}

/* =================================================================
   Export JSON (schéma v1.0 — consommé par baracca_import.py)
   env = catalogues du back-office (avec repli sur les valeurs par défaut)
================================================================= */
function buildExport(d, env) {
  const murDef = env.murs.find((m) => m.id === d.murType) || env.murs[0];
  const plancherDef = env.planchers.find((p) => p.id === d.plancher) || env.planchers[0];
  const facadeDef = env.facades.find((f) => f.id === (murDef.surface ?? d.facade)) || env.facades[0];
  const toitureDef = toitureDefOf(d, env);
  const toitType = toitTypeOf(d, env);
  const formeDef = formeDefOf(d, env);
  const isoDef = env.isolations?.find((x) => x.id === d.isolation) || null;
  const surfaceDef = env.facades.find((f) => f.id === murDef.surface) || env.facades[0];
  const exportFace = (face, f, instId) => ({
    actif: face.actif,
    nature: face.actif ? "mur" : "charpente", // charpente = pas de mur sur ce côté
    type: murDef.nom,
    epaisseur: murDef.epaisseur,
    materiau: murDef.materiau ?? surfaceDef.nom,
    surface: (env.facades.find((f) => f.id === (face.surface ?? murDef.surface)) || env.facades[0]).nom, // revêtement extérieur choisi pour ce mur
    surfaceInterieur: (intListOf(env).find((i) => i.id === intIdOf(env, face.surfaceInt, murDef.interieur)) || {}).nom ?? "", // revêtement intérieur du mur
    favori: murDef.favori ?? "", // favori Archicad pour ce mur
    longueur: murLongueur(d, f.key),
    hauteur: d.hauteur,
    facade: d.facade,
    ouvertures: face.ouvertures.map((o, i) => ({
      id: `${d.nom}_${instId}_OUV_${f.key.toUpperCase()}_${i + 1}`,
      type: o.type,
      largeur: o.largeur,
      hauteur: o.hauteur,
      position: o.position,
      favori: env.menuiseries?.find((x) => x.id === o.menuiserieId)?.favori ?? "", // favori Archicad de la menuiserie
    })),
  });
  const insts = d.instances?.length ? d.instances : [{ id: "m0", x: 0, y: 0, moduleId: d.moduleId, murs: modelMurs() }];
  // murs du module initial (rétro-compatibilité schéma 1.0)
  const mursData = {};
  FACES.forEach((f) => {
    mursData[f.key] = exportFace(insts[0].murs[f.key] || { actif: true, ouvertures: [], surface: null }, f, insts[0].id);
  });
  // toutes les instances placées (modules côte à côte)
  const instancesData = insts.map((inst) => {
    const dm = dimsOf(d, env, inst);
    return {
      id: inst.id, x: +inst.x.toFixed(3), y: +inst.y.toFixed(3),
      modele: dm.id, modeleNom: dm.nom,
      dimensions: { longueur: dm.longueur, largeur: dm.largeur, hauteur: dm.hauteur },
      murs: Object.fromEntries(FACES.map((f) => [f.key, exportFace(inst.murs[f.key] || { actif: true, ouvertures: [], surface: null }, f, inst.id)])),
    };
  });
  return {
    schemaVersion: "1.0",
    cible: "Archicad JSON API + Tapir",
    module: {
      nom: d.nom,
      modele: env.modules?.find((m) => m.id === d.moduleId)?.nom ?? null, // modèle de module choisi
      isolation: isoDef ? { id: isoDef.id, nom: isoDef.nom } : null, // isolation choisie (mur + plancher + toiture)
      charpente: (env.charpentes?.find((x) => x.id === d.charpente)) || null, // charpente choisie
      autonomie: (() => { // pack autonomie choisi : liste de systèmes autonomes
        const autoDef = env.autonomies?.find((a) => a.id === d.autonomie) || null;
        if (!autoDef) return null;
        return {
          id: autoDef.id, nom: autoDef.nom,
          systemes: (autoDef.systemes || [])
            .map((sid) => env.systemesAut?.find((s) => s.id === sid))
            .filter(Boolean)
            .map((s) => ({ id: s.id, nom: s.nom, largeur: s.largeur, hauteur: s.hauteur, favori: s.favori ?? "" })),
        };
      })(),
      forme: formeDef ? { id: formeDef.id, nom: formeDef.nom } : null, // forme de toiture choisie
      dimensions: { longueur: +spanXm(d, env).toFixed(3), largeur: +spanYm(d, env).toFixed(3), hauteur: d.hauteur }, // cumul de tous les modules
      instances: instancesData, // modules placés côte à côte (grille col/row)
      plancher: {
        nom: plancherDef.nom,
        favori: plancherDef.favori ?? "", // favori Archicad pour le plancher
        epaisseur: +epaisseurPlancher(d, env.planchers).toFixed(3),
        // le plancher est 21,7 cm plus large que les murs, en prenant
        // référence la ligne directrice des murs (de chaque côté)
        longueur: +(spanXm(d, env) + 2 * PLANCHER_DEPASSEMENT).toFixed(3),
        largeur: +(spanYm(d, env) + 2 * PLANCHER_DEPASSEMENT).toFixed(3),
      },
      facade: {
        nom: facadeDef.nom,
        favori: facadeDef.favori ?? "", // favori Archicad pour la façade
      },
      toiture: {
        type: toitureDef.nom,
        geometrie: toitType, // monopente / deuxpentes / quatrepentes / terrasse
        forme: formeDef ? { id: formeDef.id, nom: formeDef.nom } : null, // forme de toiture du module (catalogue « formes »)
        favori: toitureDef.favori ?? "", // favori Archicad pour la toiture
        pents: pentsOf(d, env).map((p) => ({
          numero: p.numero, module: p.instIndex, versant: p.versant,
          surface: (couvListOf(env).find((f) => f.id === p.surfaceId) || couvListOf(env)[0])?.nom ?? "", // revêtement de toiture (catalogue « Toiture »)
          surface_m2: +p.area.toFixed(2),
          surfaceInterieur: (intListOf(env).find((i) => i.id === p.surfaceIntId) || {}).nom ?? "", // revêtement intérieur (sous-face du pent)
          surfaceInterieur_m2: +(p.areaBaseInt ?? p.areaBase ?? p.area).toFixed(2), // sous-face intérieure : - 2 épaisseurs de mur, sans débords
          // fenêtres de toit posées sur ce pent (position le long du bas de pente)
          fenetres: fenetresOfPent(d, p.instId, p.versant).map((f, i) => ({
            id: `${d.nom}_${p.instId}_FEN_${String(p.versant).toUpperCase()}_${i + 1}`,
            largeur: f.largeur,
            hauteur: f.hauteur,
            position: f.position,
            favori: env.fenetresToit?.find((x) => x.id === f.fenetreId)?.favori ?? "",
          })),
        })), // un revêtement de toiture + un intérieur + des fenêtres de toit par pent de chaque module
        epaisseur: +(+(toitureDef.epaisseur ?? 0.30)).toFixed(3),
        pente: toitType === "terrasse" ? null : pente1Of(d), // pente du versant 1
        pente2: toitType === "deuxpentes" ? pente2Of(d) : null, // pente du versant 2 (deux pentes)
        pignon: toitType === "deuxpentes" ? true : toitType === "quatrepentes" ? false : null,
        hauteurFaitage: +hauteurFaitage(d, toitType).toFixed(2),
        surface: +surfaceToitureTotale(d, env, toitType).toFixed(2), // cumul de tous les modules
      },
      murs: mursData,
    },
    metriques: {
      surfacePlancher: +surfacePlancher(d, env).toFixed(2), // ligne directrice des murs
      empriseAuSol: +empriseAuSol(d, env, murDef).toFixed(2), // surface plancher + épaisseur des murs
      surfaceToiture: +surfaceToitureTotale(d, env, toitType).toFixed(2),
      surfaceMenuiserie: +eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).reduce((s, e) => s + surfaceMenuiserie(e.a || {}) + surfaceMenuiserie(e.b || {}), 0).toFixed(2),
      volumeBrut: +volumeBrutOf(d, env).toFixed(2),
      // Ajout rétro-compatible : détail des tarifs (catalogue back-office, marges appliquées)
      tarif: Object.fromEntries(
        Object.entries(tarifTotal(d, env)).filter(([k, v]) => k !== "pents" && typeof v === "number").map(([k, v]) => [k, +v.toFixed(2)])
      ),
      // promotion active (code saisi côté client) : null si aucune
      promotion: (() => { const p = promoActive(d, env); return p ? { code: p.code, reduction: +p.reduction } : null; })(),
    },
  };
}

/* Fusion d'une configuration enregistrée avec les valeurs par défaut
   (tolère l'évolution du schéma entre deux versions) */
function mergeConfig(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  const out = { ...base, ...saved };
  // Anciennes configurations : pignon -> geometrie deux pentes, pente2 = pente
  if (out.geometrie == null && saved.pignon !== undefined) {
    out.geometrie = saved.pignon ? "deuxpentes" : "monopente";
  }
  if (out.pente2 == null) out.pente2 = out.pente;
  // Anciennes configurations (un seul module) : migration vers la grille d'instances
  if (!Array.isArray(out.instances) || out.instances.length === 0) {
    const oldMurs = {};
    FACES.forEach((f) => {
      oldMurs[f.key] = { ...base.instances[0].murs[f.key], ...((saved.murs || {})[f.key] || {}) };
    });
    out.instances = [{ id: "m0", x: 0, y: 0, moduleId: out.moduleId || null, murs: oldMurs }];
  }
  // migration col/row -> positions absolues x/y
  out.instances = out.instances.map((i) => ("x" in i && "y" in i)
    ? { moduleId: out.moduleId, ...i }
    : { ...i, x: (i.col ?? 0) * out.longueur, y: (i.row ?? 0) * out.largeur, moduleId: i.moduleId ?? out.moduleId });
  out.selInst = out.selInst || out.instances[0].id;
  // migration : ancienne surface de toiture unique -> une par pent (1er module)
  if (out.surfaceToiture != null && !out.surfacesToiture?.[out.instances[0].id]) {
    const v = {};
    for (const k of ["nord", "est", "sud", "ouest", "toit"]) v[k] = out.surfaceToiture;
    out.surfacesToiture = { ...(out.surfacesToiture || {}), [out.instances[0].id]: v };
  }
  return out;
}

/* Subdivisions cliquables d'un module sur le plan, pour sélectionner le pent
   de toiture à l'endroit du clic */
function pentParts(d, inst, dimsOf, pents, toitType, x, y, L, l, epPx = 0) {
  const dm = dimsOf(inst);
  // Les pents couvrent aussi l'épaisseur des murs (comme la toiture réelle) :
  // pas de jour entre les pents de deux modules accolés, y compris en jonction en L
  const x0 = x - epPx, y0 = y - epPx, W = L + 2 * epPx, H = l + 2 * epPx;
  const cx = x + L / 2, cy = y + l / 2; // centre = centre de la ligne directrice
  const num = (v) => pents.find((p) => p.instId === inst.id && p.versant === v)?.numero ?? "?";
  if (toitType === "deuxpentes") {
    const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
    const hF = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
    const run1 = t1 > 0 ? Math.min(Math.max(hF / t1, 0), dm.largeur) : dm.largeur / 2;
    const yr = y + (run1 / dm.largeur) * l; // faitage (peut être décalé si asymétrique)
    return [
      { versant: "nord", numero: num("nord"), points: `${x0},${y0} ${x0 + W},${y0} ${x0 + W},${yr} ${x0},${yr}` },
      { versant: "sud", numero: num("sud"), points: `${x0},${yr} ${x0 + W},${yr} ${x0 + W},${y0 + H} ${x0},${y0 + H}` },
    ];
  }
  if (toitType === "quatrepentes") {
    return [
      { versant: "nord", numero: num("nord"), points: `${x0},${y0} ${x0 + W},${y0} ${cx},${cy}` },
      { versant: "sud", numero: num("sud"), points: `${x0},${y0 + H} ${x0 + W},${y0 + H} ${cx},${cy}` },
      { versant: "ouest", numero: num("ouest"), points: `${x0},${y0} ${x0},${y0 + H} ${cx},${cy}` },
      { versant: "est", numero: num("est"), points: `${x0 + W},${y0} ${x0 + W},${y0 + H} ${cx},${cy}` },
    ];
  }
  // monopente / terrasse : un seul versant
  const v = toitType === "terrasse" ? "toit" : "sud";
  return [{ versant: v, numero: num(v), points: `${x0},${y0} ${x0 + W},${y0} ${x0 + W},${y0 + H} ${x0},${y0 + H}` }];
}

/* ----- Fenêtres de toit (posées sur les pents) ----- */
// Bord « bas de pente » d'un pent sur le plan (= bord de la ligne directrice
// du module côté gouttière) : monopente/terrasse -> sud, deux pentes et quatre
// pentes -> le versant lui-même.
export const basPenteOf = (toitType, versant) =>
  toitType === "deuxpentes" || toitType === "quatrepentes" ? versant : "sud";
// Pente du versant (pour projeter le cadre de la fenêtre sur le plan)
export const penteOfPent = (d, toitType, versant) =>
  toitType === "terrasse" ? 0
  : toitType === "deuxpentes" && versant === "sud" ? pente2Of(d)
  : pente1Of(d);
// Longueur du bas de pente d'un pent (m) : nord/sud -> longueur du module,
// est/ouest -> largeur
const basPenteLongueur = (dm, toitType, versant) => {
  const edge = basPenteOf(toitType, versant);
  return edge === "nord" || edge === "sud" ? dm.longueur : dm.largeur;
};
// Profondeur du cadre projetée sur le plan : la hauteur est mesurée dans le
// rampant, sa projection horizontale vaut hauteur × cos(pente)
const fenetreToitProfondeur = (d, toitType, versant, hauteur) =>
  +hauteur * Math.cos((penteOfPent(d, toitType, versant) * Math.PI) / 180);
// Profondeur par défaut du cadre depuis la ligne directrice du bas de pente (px plan)
const FENETRE_TOIT_DEP_PX = 20;
// Liste des fenêtres de toit d'un pent
export const fenetresOfPent = (d, instId, versant) => d.fenetresToit?.[instId]?.[versant] || [];

/* ----- Promotions -----
   Promotion active : le code saisi correspond à une promotion dont la période
   (dateDebut/dateFin, inclus) contient la date du jour ET qui est affectée à
   l'un des modules utilisés dans la configuration. */
function promoActive(d, env) {
  const code = String(d.promoCode || "").trim().toLowerCase();
  if (!code) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  const used = new Set((d.instances?.length ? d.instances : [{ moduleId: d.moduleId }])
    .map((i) => i.moduleId || d.moduleId));
  return (env.promotions || []).find((p) => {
    if (String(p.code || "").trim().toLowerCase() !== code) return false;
    const dd = String(p.dateDebut || ""), df = String(p.dateFin || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dd) || !/^\d{4}-\d{2}-\d{2}$/.test(df)) return false;
    if (!(t >= new Date(dd + "T00:00:00").getTime() && t <= new Date(df + "T23:59:59").getTime())) return false;
    const mods = Array.isArray(p.modules) ? p.modules : [];
    return mods.some((m) => used.has(m));
  }) || null;
}

/* =================================================================
   Plan SVG (vue de dessus)
================================================================= */
function Plan({ d, murs, charpente, toitType, selectedFace, planSel, selInst, cumul, dimsOf, pents, selPent, onSelectFace, onSelectPent, onAddSide, onRemoveInst, w, h, zoom }) {
  const W = w ?? 560, H = h ?? 400, margin = 64;
  const murDef = murs.find((m) => m.id === d.murType) || murs[0];
  // Modules placés côte à côte : positions absolues (x, y en mètres) ; chaque
  // instance a son propre modèle (donc ses longueur/largeur). Ligne directrice
  // à l'INTÉRIEUR, épaisseur des murs vers l'EXTÉRIEUR.
  const insts = d.instances?.length ? d.instances : [{ id: "m0", x: 0, y: 0, moduleId: d.moduleId, murs: modelMurs() }];
  const b = bboxOf(d, dimsOf);
  const totalWm = (b.maxX - b.minX) + 2 * murDef.epaisseur;
  const totalHm = (b.maxY - b.minY) + 2 * murDef.epaisseur;
  const scale = (Math.min(W, H) - 2 * margin) / Math.max(totalWm, totalHm);
  const ep = Math.max(murDef.epaisseur * scale, 4);
  const sumColW = (b.maxX - b.minX) * scale;
  const sumRowH = (b.maxY - b.minY) * scale;
  const gx = (W - sumColW) / 2, gy = (H - sumRowH) / 2;
  const X = (xm) => gx + (xm - b.minX) * scale;
  const Y = (ym) => gy + (ym - b.minY) * scale;
  const Lof = (inst) => dimsOf(inst).longueur * scale;
  const lof = (inst) => dimsOf(inst).largeur * scale;
  const eps = 1e-6;
  // voisin direct sur un côté (position collée, même origine sur l'autre axe)
  const neighborAt = (inst, side) => {
    const dm = dimsOf(inst);
    if (side === "est") return insts.find((j) => Math.abs(j.x - (inst.x + dm.longueur + murDef.epaisseur)) < eps && Math.abs(j.y - inst.y) < eps);
    if (side === "ouest") return insts.find((j) => Math.abs(j.x + dimsOf(j).longueur + murDef.epaisseur - inst.x) < eps && Math.abs(j.y - inst.y) < eps);
    if (side === "sud") return insts.find((j) => Math.abs(j.y - (inst.y + dm.largeur + murDef.epaisseur)) < eps && Math.abs(j.x - inst.x) < eps);
    return insts.find((j) => Math.abs(j.y + dimsOf(j).largeur + murDef.epaisseur - inst.y) < eps && Math.abs(j.x - inst.x) < eps);
  };
  // Arêtes murales via le helper partagé (côtés communs dessinés une seule fois,
  // un mur est prioritaire sur une charpente ; chaque arête est numérotée)
  // visibilité des constituants (définie dans le back-office, partie « Modules »)
  const visOf = (inst) => dimsOf(inst).visibilite || { murs: true, complexe_toiture: true, plancher: true, couverture: true };
  const edges = eachEdge(d, dimsOf, murDef.epaisseur)
    // mur visible si l'un des deux modules du côté commun a ses murs visibles
    .filter((e) => visOf(e.inst).murs || (e.nb && visOf(e.nb).murs))
    .map((e) => ({ ...e, shared: !!e.edge }));
  const edgeRect = (e) => {
    // portée exacte de l'arête (pas de dépassement aux coins : les murs
    // adjacents se raccordent sans doublon au raccord)
    const x = X(e.inst.x), y = Y(e.inst.y), L = Lof(e.inst), l = lof(e.inst);
    if (e.face === "nord") return { x, y: y - ep, w: L, h: ep, horiz: true };
    if (e.face === "sud") return { x, y: y + l, w: L, h: ep, horiz: true };
    if (e.face === "ouest") return { x: x - ep, y, w: ep, h: l, horiz: false };
    return { x: x + L, y, w: ep, h: l, horiz: false };
  };
  // arête sur le bord extérieur de l'ensemble -> libellé affiché
  const isOuter = (e) => {
    const dm = dimsOf(e.inst);
    if (e.face === "nord") return Math.abs(e.inst.y - b.minY) < eps;
    if (e.face === "sud") return Math.abs(e.inst.y + dm.largeur - b.maxY) < eps;
    if (e.face === "ouest") return Math.abs(e.inst.x - b.minX) < eps;
    return Math.abs(e.inst.x + dm.longueur - b.maxX) < eps;
  };
  // libellé à 20 % le long du côté, bouton + à 68 % (pas de chevauchement)
  const labelPos = (e) => {
    const p = edgeRect(e);
    if (e.face === "nord") return [p.x + p.w * 0.2, p.y - 6, "middle"];
    if (e.face === "sud") return [p.x + p.w * 0.2, p.y + p.h + 14, "middle"];
    if (e.face === "ouest") return [p.x - 8, p.y + p.h * 0.2, "end"];
    return [p.x + p.w + 8, p.y + p.h * 0.2, "start"];
  };
  const sideBtn = (inst, side) => {
    const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
    if (side === "nord") return [x + L * 0.5, y - ep - 40];
    if (side === "sud") return [x + L * 0.5, y + l + ep + 40];
    if (side === "ouest") return [x - ep - 40, y + l * 0.5];
    return [x + L + ep + 40, y + l * 0.5];
  };
  // Angles aux jonctions : on rallonge une extrémité d'une épaisseur là où aucun
  // mur perpendiculaire ne remplit le coin (coins extérieurs et jonctions en T)
  const rects = edges.map((e) => ({ e, ...edgeRect(e) }));
  // poteaux charpente aux angles des murs : placés aux intersections des AXES de murs
  // (ligne directrice ± ep/2) -> les angles partagés entre deux modules accolés
  // coïncident exactement et ne sont dessinés qu'une fois
  const postMap = new Map();
  const charpFaces = new Map(); // `${inst.id}:${face}` -> côté extérieur (edge == null) ?
  for (const e of edges) if (!e.actif) charpFaces.set(`${e.inst.id}:${e.face}`, !e.edge);
  for (const inst of insts) {
    const x0 = X(inst.x), y0 = Y(inst.y), L = Lof(inst), l = lof(inst);
    const corners = [
      { x: x0 - ep / 2, y: y0 - ep / 2, faces: ["nord", "ouest"] },
      { x: x0 + L + ep / 2, y: y0 - ep / 2, faces: ["nord", "est"] },
      { x: x0 + L + ep / 2, y: y0 + l + ep / 2, faces: ["sud", "est"] },
      { x: x0 - ep / 2, y: y0 + l + ep / 2, faces: ["sud", "ouest"] },
    ];
    for (const c of corners) {
      // outer = au moins un côté charpente adjacent est un mur EXTÉRIEUR (pas partagé)
      const outer = c.faces.some((f) => charpFaces.get(`${inst.id}:${f}`) === true);
      if (!c.faces.some((f) => charpFaces.has(`${inst.id}:${f}`))) continue;
      const key = `${Math.round(c.x)}:${Math.round(c.y)}`;
      const prev = postMap.get(key);
      postMap.set(key, { x: c.x, y: c.y, s: Math.max(6, (charpente?.epaisseur ?? 0.20) * scale), outer: outer || !!prev?.outer });
    }
  }
  const posts = [...postMap.values()];
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const r of rects) {
    if (r.horiz) {
      const sqL = { x: r.x - ep, y: r.y, w: ep, h: r.h };
      const sqR = { x: r.x + r.w, y: r.y, w: ep, h: r.h };
      if (!rects.some((o) => o !== r && !o.horiz && intersects(sqL, o))) { r.x -= ep; r.w += ep; }
      if (!rects.some((o) => o !== r && !o.horiz && intersects(sqR, o))) { r.w += ep; }
    } else {
      const sqT = { x: r.x, y: r.y - ep, w: r.w, h: ep };
      const sqB = { x: r.x, y: r.y + r.h, w: r.w, h: ep };
      if (!rects.some((o) => o !== r && o.horiz && intersects(sqT, o))) { r.y -= ep; r.h += ep; }
      if (!rects.some((o) => o !== r && o.horiz && intersects(sqB, o))) { r.h += ep; }
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: W * (zoom ?? 1), height: H * (zoom ?? 1) }}>
      <defs>
        {/* quadrillage façon plan d'architecte */}
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 H0 V10" fill="none" stroke="#d9d3cb" strokeWidth="0.6" />
        </pattern>
        {charpente?.image && (
          <pattern id="charpPat" width="80" height="80" patternUnits="userSpaceOnUse">
            <image href={charpente.image} xlinkHref={charpente.image} x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        <pattern id="grid100" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0 H0 V50" fill="none" stroke="#c8c0b4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#grid)" />
      <rect x="0" y="0" width={W} height={H} fill="url(#grid100)" />
      {/* lignes directrices (intérieures) de chaque module + zone toiture cliquable */}
      {insts.map((inst) => (
        <rect key={inst.id} x={X(inst.x)} y={Y(inst.y)} width={Lof(inst)} height={lof(inst)}
          fill="#faf7f2" stroke="#57534e" strokeWidth="1" strokeDasharray="6 4" />
      ))}
      {/* pents de toiture cliquables : un clic affiche le pent cliqué dans la carte */}
      {onSelectPent && insts.filter((inst) => visOf(inst).complexe_toiture).map((inst) => {
        const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
        return pentParts(d, inst, dimsOf, pents, toitType, x, y, L, l, ep).map((pp) => (
          <polygon key={pp.versant}
            points={pp.points}
            fill={planSel === "toiture" && selPent?.instId === inst.id && selPent?.versant === pp.versant ? "rgba(180,83,9,0.14)" : "transparent"}
            stroke="none"
            style={{ cursor: "pointer" }}
            title={`Pent ${pp.numero} (${pp.versant})`}
            onClick={(ev) => onSelectPent(inst.id, pp.versant, ev)}
          />
        ));
      })}
      {/* fenêtres de toit : cadre en pointillé sur le pent, à 20 px du bas de
          pente ; la profondeur du cadre est projetée selon la pente (hauteur × cos) */}
      {insts.filter((inst) => visOf(inst).complexe_toiture).map((inst) => {
        const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
        return Object.entries(d.fenetresToit?.[inst.id] || {}).flatMap(([versant, list]) =>
          (list || []).map((f, i) => {
            const edge = basPenteOf(toitType, versant);
            const hProj = fenetreToitProfondeur(d, toitType, versant, f.hauteur) * scale; // profondeur projetée (px)
            const wPx = f.largeur * scale;
            const dep = FENETRE_TOIT_DEP_PX; // 20 px depuis le bas de pente
            let rx, ry, rw, rh;
            if (edge === "nord") { rx = x + f.position * scale; ry = y + dep; rw = wPx; rh = hProj; }
            else if (edge === "sud") { rx = x + f.position * scale; ry = y + l - dep - hProj; rw = wPx; rh = hProj; }
            else if (edge === "ouest") { rx = x + dep; ry = y + f.position * scale; rw = hProj; rh = wPx; }
            else { rx = x + L - dep - hProj; ry = y + f.position * scale; rw = hProj; rh = wPx; } // est
            return (
              <rect key={`${inst.id}-${versant}-${i}`} x={rx} y={ry} width={rw} height={rh}
                fill="rgba(37,99,235,0.10)" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3"
                pointerEvents="none" title={`Fenêtre de toit — pent ${versant}`} />
            );
          })
        );
      })}
      {/* faitage de chaque module */}
      {insts.filter((inst) => visOf(inst).complexe_toiture).map((inst) => {
        const dm = dimsOf(inst);
        if (toitType === "deuxpentes") {
          const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
          const hFm = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
          const run1 = t1 > 0 ? Math.min(Math.max(hFm / t1, 0), dm.largeur) : dm.largeur / 2;
          const yRidge = Y(inst.y) + run1 * scale;
          return (
            // faîtage prolongé de l'épaisseur des murs : les faîtages de deux modules
            // accolés se rejoignent (pas de décalage à la jonction)
            <line key={inst.id} x1={X(inst.x) - ep} y1={yRidge} x2={X(inst.x) + Lof(inst) + ep} y2={yRidge}
              stroke="#b45309" strokeWidth="2" strokeDasharray="7 5" />
          );
        }
        if (toitType === "quatrepentes") {
          const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
          const x0 = x - ep, y0 = y - ep, W = L + 2 * ep, H = l + 2 * ep; // coins extérieurs des murs
          return (
            <g key={inst.id} stroke="#b45309" strokeWidth="1.5" strokeDasharray="4 4">
              <line x1={x + l / 2 - ep} y1={y + l / 2} x2={x + L - l / 2 + ep} y2={y + l / 2} strokeWidth="2" strokeDasharray="7 5" />
              <line x1={x0} y1={y0} x2={x + l / 2} y2={y + l / 2} />
              <line x1={x0 + W} y1={y0} x2={x + L - l / 2} y2={y + l / 2} />
              <line x1={x0} y1={y0 + H} x2={x + l / 2} y2={y + l / 2} />
              <line x1={x0 + W} y1={y0 + H} x2={x + L - l / 2} y2={y + l / 2} />
            </g>
          );
        }
        return null;
      })}
      {/* murs (arêtes, avec angles aux jonctions) */}
      {/* poteaux charpente des côtés COMMUNS entre deux modules : dessinés AVANT les
          murs (un mur adjacent recouvre le poteau) ; les poteaux de murs extérieurs
          charpente restent visibles, dessinés après les murs */}
      {posts.filter((p) => !p.outer).map((pt, i) => (
        <rect key={"bg-" + i} x={pt.x - pt.s / 2} y={pt.y - pt.s / 2} width={pt.s} height={pt.s}
          fill={charpente?.image ? "url(#charpPat)" : rgbHex(charpente?.rgb || [140, 107, 89])} stroke="#57534e" strokeWidth="1" pointerEvents="none" />
      ))}
      {rects.map(({ e, ...p }, i) => {
        const isSel = selInst === e.inst.id && selectedFace === e.face && planSel !== "toiture";
        const f = FACES.find((x) => x.key === e.face);
        const lp = labelPos(e);
        return (
          <g key={i} onClick={(ev) => onSelectFace(e.inst.id, e.face, ev)} style={{ cursor: "pointer" }}>
            <rect
              x={p.x} y={p.y} width={p.w} height={p.h}
              fill={e.actif ? rgbHex(murDef.rgb) : "#e5e5e5"}
              stroke={isSel ? "#b45309" : "#78716c"}
              strokeWidth={isSel ? 3 : e.actif ? 1 : 2}
              strokeDasharray={e.actif ? undefined : "5 4"}
            />
            {/* charpente : pas de hachures en biais, juste le contour pointillé extérieur
                (les poteaux aux angles sont dessinés une seule fois, voir bloc dédié) */}
            {e.actif && (e.a?.ouvertures || []).map((o, j) => {
              const ow = o.largeur * scale;
              const oh = Math.max(ep + 8, 14);
              const ox = p.horiz ? X(e.inst.x) + o.position * scale : p.x + (p.w - oh) / 2;
              const oy = p.horiz ? p.y + (p.h - oh) / 2 : Y(e.inst.y) + o.position * scale;
              return (
                <rect key={j} x={ox} y={oy}
                  width={p.horiz ? ow : oh} height={p.horiz ? oh : ow}
                  fill={o.type === "porte" ? "#7c2d12" : "#0284c7"} rx="2" />
              );
            })}
            {isOuter(e) && (
              <text className="face-label" x={lp[0]} y={lp[1]} textAnchor={lp[2] || "middle"}
                fill={isSel ? "#b45309" : "#78716c"}>
                {`Mur ${e.numero}`} {e.actif ? `(${e.a.ouvertures.length} ouvrant${e.a.ouvertures.length > 1 ? "s" : ""})` : "(charpente)"}
              </text>
            )}
          </g>
        );
      })}
      {/* boutons + sur chaque côté libre (choix du modèle) ; quand deux côtés
          libres se rejoignent au même endroit (modules en L), un seul + est
          affiché (les doublons de position sont filtrés) */}
      {onAddSide && (() => {
        const btns = [];
        insts.forEach((inst) => {
          FACES.forEach((f) => {
            if (neighborAt(inst, f.key)) return;
            const [cx, cy] = sideBtn(inst, f.key);
            if (btns.some((b) => Math.hypot(b.cx - cx, b.cy - cy) < 26)) return;
            btns.push({ inst, side: f.key, cx, cy });
          });
        });
        return btns.map((b) => (
          <g key={`${b.inst.id}-${b.side}`} onClick={(ev) => onAddSide(b.inst.id, b.side, ev)}
            style={{ cursor: "pointer" }} title={`Ajouter un module au côté ${b.side} (choisir le modèle)`}>
            <circle cx={b.cx} cy={b.cy} r="10" fill="#2563eb" />
            <path d={`M ${b.cx - 4.5} ${b.cy} H ${b.cx + 4.5} M ${b.cx} ${b.cy - 4.5} V ${b.cy + 4.5}`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </g>
        ));
      })()}
      {onRemoveInst && insts.length > 1 && insts.map((inst) => (
        <g key={`rm-${inst.id}`} onClick={() => onRemoveInst(inst.id)}
          style={{ cursor: "pointer" }} title={`Supprimer le module ${inst.id}`}>
          <circle cx={X(inst.x) + Lof(inst) - 30} cy={Y(inst.y) + 30} r="9" fill="#dc2626" />
          <path d={`M ${X(inst.x) + Lof(inst) - 34} ${Y(inst.y) + 26} L ${X(inst.x) + Lof(inst) - 26} ${Y(inst.y) + 34} M ${X(inst.x) + Lof(inst) - 26} ${Y(inst.y) + 26} L ${X(inst.x) + Lof(inst) - 34} ${Y(inst.y) + 34}`} stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      ))}
      {/* poteaux charpente des murs EXTÉRIEURS : visibles au-dessus des murs */}
      {posts.filter((p) => p.outer).map((pt, i) => (
        <rect key={"fg-" + i} x={pt.x - pt.s / 2} y={pt.y - pt.s / 2} width={pt.s} height={pt.s}
          fill={charpente?.image ? "url(#charpPat)" : rgbHex(charpente?.rgb || [140, 107, 89])} stroke="#57534e" strokeWidth="1" pointerEvents="none" />
      ))}
      {/* cotes globales (cumul des modules), dessinées à l'intérieur du module */}
      <line x1={X(b.minX)} y1={Y(b.minY) + 12} x2={X(b.maxX)} y2={Y(b.minY) + 12} stroke="#a8a29e" strokeDasharray="4 3" />
      <text x={gx + sumColW / 2} y={Y(b.minY) + 26} textAnchor="middle" fill="#78716c" fontSize="10">{fmtCm(cumul.longueur)} cm</text>
      <line x1={X(b.maxX) - 12} y1={Y(b.minY)} x2={X(b.maxX) - 12} y2={Y(b.minY) + sumRowH} stroke="#a8a29e" strokeDasharray="4 3" />
      <text x={X(b.maxX) - 26} y={gy + sumRowH / 2} textAnchor="middle" fill="#78716c" fontSize="10"
        transform={`rotate(-90 ${X(b.maxX) - 26} ${gy + sumRowH / 2})`}>{fmtCm(cumul.largeur)} cm</text>
    </svg>
  );
}

/* =================================================================
   Élévation SVG (façade sud)
================================================================= */
function Elevation({ d, murs, planchers, surfaces, interieurs, couvertures, charpente, toiture, toitType, faceKey, faceData, dims, w, h, insts, bbox, depM, onSelectPlancher }) {
  const W = w ?? 560, H = h ?? 320, margin = 60;
  const horiz = faceKey === "nord" || faceKey === "sud";
  // Un segment par module : l'élévation est une vraie projection de la façade,
  // chaque module étant placé à sa position le long de l'axe de la face.
  const segs = (insts && insts.length ? insts : [{
    inst: null,
    dm: dims || { longueur: d.longueur, largeur: d.largeur, hauteur: d.hauteur },
    face: faceData || { actif: true, ouvertures: [], surface: null },
    depth: 0,
  }]);
  // longueur projetée de la façade = span de l'axe (bbox), pas la somme des modules
  const bb = bbox || (horiz
    ? { minX: 0, maxX: dims?.longueur ?? d.longueur, minY: 0, maxY: dims?.largeur ?? d.largeur }
    : { minY: 0, maxY: dims?.largeur ?? d.largeur, minX: 0, maxX: dims?.longueur ?? d.longueur });
  const axisMin = horiz ? bb.minX : bb.minY;
  const Lm = horiz ? bb.maxX - bb.minX : bb.maxY - bb.minY;
  const hMax = Math.max(...segs.map((x) => x.dm.hauteur));
  const murDef = murs.find((m) => m.id === d.murType) || murs[0];
  const plancherDef = planchers.find((p) => p.id === d.plancher) || planchers[0];
  const epP = epaisseurPlancher(d, planchers);
  const epToit = +(toiture.epaisseur ?? 0.30);   // épaisseur de la toiture (m)
  const toitRgb = toiture.rgb || [120, 113, 108];
  const hFmax = Math.max(...segs.map((x) => hauteurFaitageDm(x.dm, pente1Of(d), pente2Of(d), toitType)));
  // Échelle UNIQUE en horizontal et en vertical, sur toute la façade (les
  // proportions sont conservées), en réservant la place de la toiture, du
  // plancher et du sol. Ligne directrice des murs à l'intérieur : la façade
  // dessinée s'étend de l'épaisseur du mur au-delà de la ligne directrice.
  const scale = Math.min(
    (W - 2 * margin) / (Lm + 2 * murDef.epaisseur),
    (H - 2 * margin) / Math.max(hMax + hFmax + epToit + epP + SOL_SOUS_PLANCHER, 3)
  );
  const epPx = murDef.epaisseur * scale;
  const epPxP = epP * scale;                      // épaisseur du plancher en px
  // épaisseur de toiture en px : doublée (x6) seulement en vue de pignon (est/ouest, où on
  // voit l'épaisseur), +30 % en plus ; en vue nord/sud (horiz) on reste à x3
  const epToitPx = epToit * scale * (horiz ? 3 : 6 * 1.3);
  const toitStrokePx = horiz ? 3 : 6 * 1.3;      // épaisseur du contour de toit (idem)
  const depPx = PLANCHER_DEPASSEMENT * scale;     // dépassement du plancher / ligne directrice des murs
  const L = Lm * scale;
  const x0 = (W - L) / 2;
  const ySol = H - margin;                                     // trait du sol
  const yPlancher = ySol - SOL_SOUS_PLANCHER * scale - epPxP;  // ligne directrice du plancher = bas des murs
  const nom = FACES.find((f) => f.key === faceKey).label;
  // Vue extérieure : miroir vu du NORD et de l'EST (l'ordre des segments est
  // déjà inversé côté App). Pas de miroir pour sud et ouest.
  const miroir = faceKey === "nord" || faceKey === "est";
  const xa = x0 - epPx, xb = x0 + L + epPx;   // bords extérieurs de la façade
  const pa = x0 - depPx, pb = x0 + L + depPx; // bords du plancher (21,7 cm au-delà de la ligne directrice)
  const surfaceOf = (face) => surfaces.find((s) => s.id === (face?.surface ?? murDef.surface)) || surfaces[0];
  // segment traversant (côté opposé vu derrière une charpente) : revêtement INTÉRIEUR
  const sdOf = (seg) => seg.traversant
    ? ((interieurs || []).find((x) => x.id === (seg.face?.surfaceInt ?? murDef?.interieur)) || null)
    : surfaceOf(seg.face);
  // visuel de couverture du pent visible sur cette façade (catalogue « Toiture »)
  const couvImgOfSeg = (seg) => {
    if (!horiz) return ""; // vue de pignon : pas de bande de toit remplie
    const list = couvertures?.length ? couvertures : surfaces;
    const raw = d.surfacesToiture?.[seg.inst?.id ?? "m0"]?.[faceKey];
    const fb = toiture?.couverture ?? toiture?.surface;
    const cid = raw && list.some((c) => c.id === raw) ? raw : (fb && list.some((c) => c.id === fb) ? fb : list[0]?.id);
    return list.find((c) => c.id === cid)?.image || "";
  };
  // prolonge un segment (x1,y1)-(x2,y2) de dG/dD px à chaque extrémité, le long de sa direction
  const prolonge = (x1, y1, x2, y2, dG, dD) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    return [x1 - (dx / len) * dG, y1 - (dy / len) * dG, x2 + (dx / len) * dD, y2 + (dy / len) * dD];
  };
  // path de toiture d'un segment ; debG/debD = débord autorisé à gauche/droite
  // (false sur un côté commun à deux modules qui se touchent : pas de débord là)
  const toitOf = (x0s, Ls, yTop, hF, dm, debG = true, debD = true) => {
    // débord de toiture : la vraie valeur (depM en m) convertie en px par l'échelle,
    // identique partout ; en vue de côté (horiz) il est latéral (en x), en pignon il suit la pente
    const debP = (depM ?? epToit) * scale;
    const debL = horiz && debG ? debP : 0;
    const debR = horiz && debD ? debP : 0;
    const xaS = x0s - epPx - debL, xbS = x0s + Ls + epPx + debR;
    const fillToit = mixHex(rgbHex(toitRgb), "#ffffff", 0.55); // bande pleine opaque (teintée couleur toiture), la grille ne transparaît pas
    if (toitType === "terrasse") return { path: `M ${xaS} ${yTop} L ${xbS} ${yTop} L ${xbS} ${yTop - epToitPx} L ${xaS} ${yTop - epToitPx} Z`, fill: fillToit, dash: null, cote: false };
    if (toitType === "monopente") {
      // façade nord = pignon haut : le mur monte jusqu'au toit, la toiture n'est
      // vue que de chant (trait du haut) ; façade sud = versant vu de face (bande)
      if (horiz && faceKey === "nord") return { path: `M ${xaS} ${yTop - hF} L ${xbS} ${yTop - hF}`, fill: "none", dash: null, cote: false };
      if (horiz) return { path: `M ${xaS} ${yTop} L ${xaS} ${yTop - hF} L ${xbS} ${yTop - hF} L ${xbS} ${yTop} Z`, fill: fillToit, dash: null, cote: true };
      // est/ouest : le mur monte aussi jusqu'au toit (pignon monopente) ; le toit
      // dépasse en suivant la ligne de la pente (prolongé de epToitPx à chaque bout,
      // depuis la ligne directrice du mur, sans débord en x)
      const [mx0, my0, mx1, my1] = prolonge(...(faceKey === "ouest" ? [xaS, yTop - hF, xbS, yTop] : [xaS, yTop, xbS, yTop - hF]), debG ? debP : 0, debD ? debP : 0);
      return { path: `M ${mx0} ${my0} L ${mx1} ${my1}`, fill: "none", dash: null, cote: false, pignon: true, apexX: faceKey === "ouest" ? x0s - epPx : x0s + Ls + epPx };
    }
    if (horiz && toitType === "quatrepentes") {
      const rx1 = x0s + (dm.largeur / 2) * scale, rx2 = x0s + Ls - (dm.largeur / 2) * scale;
      return { path: `M ${xaS} ${yTop} L ${rx1} ${yTop - hF} L ${rx2} ${yTop - hF} L ${xbS} ${yTop} Z`, fill: fillToit, dash: null, cote: false };
    }
    if (horiz) return { path: `M ${xaS} ${yTop} L ${xaS} ${yTop - hF} L ${xbS} ${yTop - hF} L ${xbS} ${yTop} Z`, fill: fillToit, dash: null, cote: true };
    // est/ouest, deux pentes ou croupe (vue de pignon) : le mur monte jusqu'au
    // faitage, la toiture n'est dessinée qu'en contour
    const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
    const hFm = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
    const run1 = t1 > 0 ? Math.min(Math.max(hFm / t1, 0), dm.largeur) : dm.largeur / 2;
    const apexX = miroir ? x0s + Ls - run1 * scale : x0s + run1 * scale;
    // débord du toit en suivant la pente : chaque versant est prolongé de epToitPx
    // au-delà du mur, depuis la ligne directrice (sans débord en x)
    const [px0, py0] = prolonge(xaS, yTop, apexX, yTop - hF, debG ? debP : 0, 0);
    const [, , px1, py1] = prolonge(apexX, yTop - hF, xbS, yTop, 0, debD ? debP : 0);
    return { path: `M ${px0} ${py0} L ${apexX} ${yTop - hF} L ${px1} ${py1}`, fill: "none", dash: null, cote: false, pignon: true, apexX };
  };
  // segments projetés à leur vraie position le long de la façade (miroir pour
  // nord/est), puis triés du plus profond au plus proche : le module le plus
  // proche de la face recouvre ceux en retrait (occlusion)
  const placed = segs.map((s) => {
    const pos = horiz ? (s.inst?.x ?? 0) : (s.inst?.y ?? 0);
    const lenM = horiz ? s.dm.longueur : s.dm.largeur;
    const hM = s.dm.hauteur * scale;
    const hF = hauteurFaitageDm(s.dm, pente1Of(d), pente2Of(d), toitType) * scale;
    let x0s = x0 + (pos - axisMin) * scale;
    if (miroir) x0s = x0 + (Lm - (pos - axisMin) - lenM) * scale;
    const Ls = lenM * scale;
    // pas de débord de toiture sur un côté commun à deux modules qui se touchent
    const eps = 1e-6;
    const posOf = (o) => (horiz ? o.inst?.x : o.inst?.y) ?? 0;
    const lenOf = (o) => (horiz ? o.dm.longueur : o.dm.largeur);
    const epM = murDef.epaisseur; // deux modules accolés sont espacés de l'épaisseur du mur commun
    // côté commun = voisin accolé À LA MÊME PROFONDEUR qui touche ; un voisin en
    // retrait (profondeur différente, ex. L au nord) ne supprime pas le débord
    const memeProf = (o) => Math.abs((o.depth ?? 0) - (s.depth ?? 0)) < eps;
    // un voisin sans complexe de toiture (visibilité décochée) ne supprime pas le débord
    const toitOk = (o) => o.vis?.complexe_toiture ?? true;
    let debG = !segs.some((o) => o !== s && memeProf(o) && toitOk(o) && Math.abs(posOf(o) + lenOf(o) + epM - pos) < eps);
    let debD = !segs.some((o) => o !== s && memeProf(o) && toitOk(o) && Math.abs(pos + lenM + epM - posOf(o)) < eps);
    if (miroir) { const t = debG; debG = debD; debD = t; } // en nord/est, l'axe est inversé
    // En monopente, le nord est le haut du toit (le mur nord monte jusqu'au toit) :
    // on ne supprime JAMAIS le débord au nord, même sur un côté commun.
    // En vue est/ouest, l'extrémité nord de la pente est debG (ouest) / debD (est).
    if (toitType === "monopente" && !horiz) { if (faceKey === "ouest") debG = true; else debD = true; }
    return { ...s, x0s, Ls, hM, hF, yTop: yPlancher - hM, toit: toitOf(x0s, Ls, yPlancher - hM, hF, s.dm, debG, debD) };
  });
  placed.sort((a, c) => (c.depth ?? 0) - (a.depth ?? 0)); // dessin du fond vers l'avant
  // un seul toit visible par zone de chevauchement : le segment le plus proche de la face
  placed.forEach((s) => {
    const pos = horiz ? (s.inst?.x ?? 0) : (s.inst?.y ?? 0);
    const lenM = horiz ? s.dm.longueur : s.dm.largeur;
    const posO = (o) => (horiz ? o.inst?.x : o.inst?.y) ?? 0;
    const lenO = (o) => (horiz ? o.dm.longueur : o.dm.largeur);
    // un toit n'est masqué que par un segment plus proche QUI A un complexe de toiture
    // visible (un module "plancher seul" devant ne cache pas la toiture derrière)
    s.toitVisible = !s.traversant && !placed.some((o) => o !== s && !o.traversant && (o.depth ?? 0) < (s.depth ?? 0) && (o.vis?.complexe_toiture ?? true) &&
      pos < posO(o) + lenO(o) && posO(o) < pos + lenM);
  });
  // profondeur relative (0 = le plus proche de la face) pour griser les segments au fond
  // (les segments traversants — côté opposé — sont exclus : toujours au fond, t = 1)
  const maxDepth = Math.max(0, ...placed.filter((s) => !s.traversant).map((s) => s.depth ?? 0));
  const minDepth = Math.min(0, ...placed.filter((s) => !s.traversant).map((s) => s.depth ?? 0)); // premier plan
  const ox = (o, seg) => seg.x0s + (miroir ? seg.Ls - (o.position + o.largeur) * scale : o.position * scale);
  // En monopente, la façade nord est le pignon haut : le mur monte jusqu'au toit
  const murTopOf = (seg) => (toitType === "monopente" && faceKey === "nord" ? seg.yTop - seg.hF : seg.yTop);
  // poteaux charpente aux angles des segments sans mur : un seul poteau par x
  // (dédupliqué entre segments adjacents qui partagent le même angle)
  const charpPosts = [];
  const postByX = new Map(); // x arrondi -> poteau (on garde le plus proche du spectateur)
  placed.forEach((seg, si) => {
    if (seg.face?.actif || seg.vis?.murs === false) return;
    // poteaux aux intersections des axes de murs (± epPx/2) : angles partagés
    // entre segments coïncident -> un seul poteau, celui du segment le plus proche
    for (const x of [seg.x0s - epPx / 2, seg.x0s + seg.Ls + epPx / 2]) {
      const k = Math.round(x);
      const prev = postByX.get(k);
      if (prev && (prev.seg.depth ?? 0) <= (seg.depth ?? 0)) continue; // le plus proche gagne
      const post = {
        x, seg, si, outer: !seg.shared,
        cut: seg.toit.pignon && seg.toitVisible !== false ? `url(#toitCut-${si})` : undefined,
      };
      if (prev) {
        const idx = charpPosts.indexOf(prev);
        if (idx >= 0) charpPosts[idx] = post;
      } else {
        charpPosts.push(post);
      }
      postByX.set(k, post);
    }
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      <defs>
        {/* même quadrillage que le plan, en fond de façade */}
        {charpente?.image && (
          <pattern id="charpPatE" width="80" height="80" patternUnits="userSpaceOnUse">
            <image href={charpente.image} xlinkHref={charpente.image} x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {(() => {
          const chantImg = surfaces.find((f) => f.id === (d.revetementChantPlancher ?? plancherDef?.revetement_chants ?? murDef?.surface))?.image;
          return chantImg ? (
            <pattern id="chantPatE" width="80" height="80" patternUnits="userSpaceOnUse">
              <image href={chantImg} xlinkHref={chantImg} x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ) : null;
        })()}
        <pattern id="gridE" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 H0 V10" fill="none" stroke="#d9d3cb" strokeWidth="0.6" />
        </pattern>
        <pattern id="gridE100" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0 H0 V50" fill="none" stroke="#c8c0b4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#gridE)" />
      <rect x="0" y="0" width={W} height={H} fill="url(#gridE100)" />
      <line x1={20} y1={ySol} x2={W - 20} y2={ySol} stroke="#a8a29e" strokeWidth="2" />
      {/* plancher continu : ligne directrice en haut (bas des murs), épaisseur vers le bas,
          bords à 21,7 cm au-delà de la ligne directrice des murs */}
      <rect x={pa} y={yPlancher} width={L + 2 * depPx} height={epPxP}
        fill={surfaces.find((f) => f.id === (d.revetementChantPlancher ?? plancherDef?.revetement_chants ?? murDef?.surface))?.image ? "url(#chantPatE)" : "#e7e5e4"}
        stroke="#78716c" style={{ cursor: onSelectPlancher ? "pointer" : undefined }}
        onClick={onSelectPlancher} title="Choisir les revêtements du plancher" />
      <line x1={pa} y1={yPlancher} x2={pb} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
      <defs>
        {placed.map((seg, i) => {
          const sd = sdOf(seg);
          const toitImg = couvImgOfSeg(seg);
          return (
            <React.Fragment key={i}>
              {sd?.image && (
                <clipPath id={`murClip-${i}`}>
                  {seg.toit.pignon ? (
                    <path d={`M ${seg.x0s - epPx} ${yPlancher} L ${seg.x0s - epPx} ${seg.yTop} L ${seg.toit.apexX} ${seg.yTop - seg.hF} L ${seg.x0s + seg.Ls + epPx} ${seg.yTop} L ${seg.x0s + seg.Ls + epPx} ${yPlancher} Z`} />
                  ) : (
                    <rect x={seg.x0s - epPx} y={murTopOf(seg)} width={seg.Ls + 2 * epPx} height={yPlancher - murTopOf(seg)} />
                  )}
                </clipPath>
              )}
              {toitImg && seg.toit.fill !== "none" && (
                <clipPath id={`toitClip-${i}`}><path d={seg.toit.path} /></clipPath>
              )}
              {/* vue de pignon : zone SOUS le contour de toit — sert à couper les hauts
                  de charpente (sablières, poteaux) qui dépasseraient de la ligne de toit */}
              {seg.toit.pignon && (seg.vis?.complexe_toiture ?? true) && seg.toitVisible !== false && (
                <clipPath id={`toitCut-${i}`}>
                  <path d={`M ${seg.x0s - epPx} ${seg.yTop} L ${seg.toit.apexX} ${seg.yTop - seg.hF} L ${seg.x0s + seg.Ls + epPx} ${seg.yTop} L ${seg.x0s + seg.Ls + epPx} ${H} L ${seg.x0s - epPx} ${H} Z`} />
                </clipPath>
              )}
            </React.Fragment>
          );
        })}
      </defs>
      {/* murs traversants (côté opposé, vus derrière une charpente) : au fond, bien grisés,
          avec le revêtement intérieur — dessinés AVANT les poteaux charpente pour ne pas
          les masquer quand deux charpentes sont l'une derrière l'autre */}
      {placed.map((seg, i) => {
        if (!seg.traversant) return null;
        const sd = sdOf(seg);
        const fill = mixHex(rgbHex(murDef.rgb), "#ffffff", 0.85); // bien grisé (fond)
        return (
          <g key={"trav-" + (seg.inst?.id || i)}>
            {seg.toit.pignon ? (
              <path d={`M ${seg.x0s - epPx} ${yPlancher} L ${seg.x0s - epPx} ${seg.yTop} L ${seg.toit.apexX} ${seg.yTop - seg.hF} L ${seg.x0s + seg.Ls + epPx} ${seg.yTop} L ${seg.x0s + seg.Ls + epPx} ${yPlancher} Z`}
                fill={fill} stroke="#78716c" />
            ) : (
              <rect x={seg.x0s - epPx} y={murTopOf(seg)} width={seg.Ls + 2 * epPx} height={yPlancher - murTopOf(seg)}
                fill={fill} stroke="#78716c" />
            )}
            {sd?.image && (
              <image href={sd.image} xlinkHref={sd.image} x={seg.x0s - epPx}
                y={seg.toit.pignon ? seg.yTop - seg.hF : murTopOf(seg)}
                width={seg.Ls + 2 * epPx} height={yPlancher - (seg.toit.pignon ? seg.yTop - seg.hF : murTopOf(seg))}
                preserveAspectRatio="xMidYMid slice" clipPath={`url(#murClip-${i})`} opacity="0.55" />
            )}
          </g>
        );
      })}
      {/* poteaux charpente EN ARRIÈRE-PLAN (grisés) : derrière les murs, qu'ils ne traversent pas */}
      {charpPosts.filter((p) => (p.seg.depth ?? 0) > minDepth + 1e-6).map((p, i) => {
        const epC = Math.max(4, (charpente?.epaisseur ?? 0.20) * scale);
        const t = maxDepth ? (p.seg.depth ?? 0) / maxDepth : 0;
        return (
          <rect key={"bg-" + i} x={p.x - epC / 2} y={p.seg.yTop} width={epC} height={yPlancher - p.seg.yTop}
            fill={charpente?.image ? "url(#charpPatE)" : mixHex(rgbHex(charpente?.rgb || [140, 107, 89]), "#ffffff", 0.6 * t)} stroke="#57534e" strokeWidth="1" pointerEvents="none" clipPath={p.cut} />
        );
      })}
      {placed.map((seg, i) => {
        if (seg.traversant) return null; // déjà rendu au fond ci-dessus
        const sd = sdOf(seg);
        const t = maxDepth ? (seg.depth ?? 0) / maxDepth : 0; // 0 = devant, 1 = fond
        const vis = seg.vis || { murs: true, complexe_toiture: true, plancher: true, couverture: true };
        return (
          // clé unique : le segment traversant (côté opposé) partage l'id du module -> préfixe
          <g key={(seg.traversant ? "trav-" : "") + (seg.inst?.id || i)}>
            {/* mur du segment (ligne directrice intérieure, épaisseur vers l'extérieur), opaque :
                la grille de fond ne doit pas transparaître ; la profondeur se fait par un
                mélange vers le blanc (ou un voile blanc sur les murs texturés) */}
            {vis.murs && seg.face?.actif !== false && (seg.toit.pignon ? (
              /* vue de pignon : le mur monte jusqu'au faitage de la toiture
                  (pas de triangle plein si le côté est en charpente) */
              <path
                d={`M ${seg.x0s - epPx} ${yPlancher} L ${seg.x0s - epPx} ${seg.yTop} L ${seg.toit.apexX} ${seg.yTop - seg.hF} L ${seg.x0s + seg.Ls + epPx} ${seg.yTop} L ${seg.x0s + seg.Ls + epPx} ${yPlancher} Z`}
                fill={mixHex(rgbHex(murDef.rgb), "#ffffff", 0.6 * t)} stroke="#78716c" />
            ) : (
            <rect x={seg.x0s - epPx} y={murTopOf(seg)} width={seg.Ls + 2 * epPx} height={yPlancher - murTopOf(seg)}
              fill={mixHex(rgbHex(murDef.rgb), "#ffffff", 0.6 * t)} stroke="#78716c" />
            ))}
            {/* visuel du revêtement (catalogue « Extérieur ») par-dessus la couleur, y compris
                sur le triangle du pignon ; si l'image ne charge pas, la couleur reste visible */}
            {vis.murs && seg.face?.actif !== false && sd?.image && (
              <image href={sd.image} xlinkHref={sd.image} x={seg.x0s - epPx}
                y={seg.toit.pignon ? seg.yTop - seg.hF : murTopOf(seg)}
                width={seg.Ls + 2 * epPx} height={yPlancher - (seg.toit.pignon ? seg.yTop - seg.hF : murTopOf(seg))}
                preserveAspectRatio="xMidYMid slice" clipPath={`url(#murClip-${i})`} />
            )}
            {vis.murs && seg.face?.actif !== false && sd?.image && t > 0 && (seg.toit.pignon ? (
              <path d={`M ${seg.x0s - epPx} ${yPlancher} L ${seg.x0s - epPx} ${seg.yTop} L ${seg.toit.apexX} ${seg.yTop - seg.hF} L ${seg.x0s + seg.Ls + epPx} ${seg.yTop} L ${seg.x0s + seg.Ls + epPx} ${yPlancher} Z`}
                fill="#ffffff" opacity={0.6 * t} stroke="none" />
            ) : (
              <rect x={seg.x0s - epPx} y={murTopOf(seg)} width={seg.Ls + 2 * epPx} height={yPlancher - murTopOf(seg)}
                fill="#ffffff" opacity={0.6 * t} stroke="none" />
            ))}
            {vis.murs && (
              <>
            <line x1={seg.x0s} y1={seg.yTop} x2={seg.x0s} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
            <line x1={seg.x0s + seg.Ls} y1={seg.yTop} x2={seg.x0s + seg.Ls} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
            {seg.face?.actif && seg.face.ouvertures.map((o, j) => (
              <rect key={j} x={ox(o, seg)} y={yPlancher - o.hauteur * scale}
                width={o.largeur * scale} height={o.hauteur * scale}
                fill={o.type === "porte" ? "#7c2d12" : "#0284c7"} rx="2" />
            ))}
              </>
            )}
            {/* la toiture est rendue dans une seconde passe, au-dessus des charpentes */}
            {vis.murs && !seg.face?.actif && (() => {
              // charpente : sablière horizontale en sous-face de toiture (aussi en
              // vue est/ouest) ; en pignon elle est coupée par la ligne de toit
              const epC = Math.max(4, (charpente?.epaisseur ?? 0.20) * scale);
              const col = charpente?.image ? "url(#charpPatE)" : mixHex(rgbHex(charpente?.rgb || [140, 107, 89]), "#ffffff", 0.6 * t); // visuel charpente si renseigné, sinon couleur (grisée selon la profondeur)
              const cut = seg.toit.pignon && seg.toitVisible !== false ? `url(#toitCut-${i})` : undefined;
              return (
                <g clipPath={cut}>
                  <rect x={seg.x0s - epPx} y={seg.yTop - epC} width={seg.Ls + 2 * epPx} height={epC}
                    fill={col} stroke="#57534e" strokeWidth="1" />
                  <text x={seg.x0s + seg.Ls / 2} y={seg.yTop + seg.hM / 2} textAnchor="middle" fill="#a8a29e" fontSize="11">Charpente (pas de mur)</text>
                </g>
              );
            })()}

          </g>
        );
      })}
      {/* poteaux charpente AU PREMIER PLAN : non grisés, au-dessus des murs */}
      {charpPosts.filter((p) => (p.seg.depth ?? 0) <= minDepth + 1e-6).map((p, i) => {
        const epC = Math.max(4, (charpente?.epaisseur ?? 0.20) * scale);
        return (
          <rect key={"fg-" + i} x={p.x - epC / 2} y={p.seg.yTop} width={epC} height={yPlancher - p.seg.yTop}
            fill={charpente?.image ? "url(#charpPatE)" : rgbHex(charpente?.rgb || [140, 107, 89])} stroke="#57534e" strokeWidth="1" pointerEvents="none" clipPath={p.cut} />
        );
      })}
      {/* toitures rendues en DERNIER : le toit prend le dessus sur les charpentes
          (sablières/poteaux) et les murs des segments devant */}
      {placed.map((seg, i) => {
        const t = maxDepth ? (seg.depth ?? 0) / maxDepth : 0;
        const vis = seg.vis || { murs: true, complexe_toiture: true, plancher: true, couverture: true };
        if (!vis.complexe_toiture || seg.toitVisible === false) return null;
        return (
          <g key={(seg.traversant ? "trav-" : "") + (seg.inst?.id || i)}>
            <path d={seg.toit.path} stroke={mixHex(rgbHex(toitRgb), "#ffffff", 0.6 * t)} strokeWidth={toitStrokePx} fill={seg.toit.fill} strokeLinejoin="round" strokeLinecap="butt" />
            {vis.couverture && (() => {
              const im = couvImgOfSeg(seg);
              if (!im || seg.toit.fill === "none") return null;
              const iy = seg.yTop - seg.hF - epToitPx - 6;
              return (
                <image href={im} xlinkHref={im} x={seg.x0s - epPx - depPx} y={iy}
                  width={seg.Ls + 2 * epPx + 2 * depPx} height={seg.hF + epToitPx + 12}
                  preserveAspectRatio="xMidYMid slice" clipPath={`url(#toitClip-${i})`} />
              );
            })()}
            {(() => {
              const versant = { nord: "nord", sud: "sud", est: "est", ouest: "ouest" }[faceKey];
              if (!versant || toitType === "terrasse") return null;
              const fens = fenetresOfPent(d, seg.inst?.id ?? "m0", versant);
              if (!fens.length) return null;
              const p = penteOfPent(d, toitType, versant);
              const tanP = Math.tan((p * Math.PI) / 180);
              const sinP = Math.sin((p * Math.PI) / 180);
              const dWin = 0.20;
              return fens.map((f, j) => {
                const x = ox(f, seg);
                const wPx = f.largeur * scale;
                const hVert = Math.max(6, f.hauteur * sinP * scale);
                const yLow = seg.yTop - dWin * tanP * scale;
                return (
                  <rect key={j} x={x} y={yLow - hVert} width={wPx} height={hVert}
                    fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" rx="1"
                    title={`Fenêtre de toit — pent ${versant}`} />
                );
              });
            })()}
          </g>
        );
      })}
      <text x={x0 + L / 2} y={yPlancher - hMax * scale - hFmax * scale - 12} textAnchor="middle" fill="#78716c" fontSize="11">
        {toitType === "terrasse"
          ? `${nom} — terrasse plate (${segs.length} module${segs.length > 1 ? "s" : ""})`
          : `${nom} — ${placed.some((s) => s.toit.cote) ? "toiture vue de côté" : toitType === "deuxpentes" ? "pignon" : "croupe"}, faitage +${fmtCm(hFmax)} cm (${segs.length} module${segs.length > 1 ? "s" : ""})`}
      </text>
    </svg>
  );
}

/* =================================================================
   Petits composants UI
================================================================= */
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

/* Choix d'un revêtement : liste déroulante compacte (comme avant) + petit visuel
   du revêtement actuellement sélectionné à côté (bien plus petit que les grandes
   vignettes des listes de « Réglages généraux ») */
const RevetSelect = ({ label, value, onChange, options, defaultLabel }) => {
  const cur = options.find((o) => o.id === value);
  const img = cur?.image || "";
  return (
    <Field label={label}>
      <div className="revet-select-row">
        {img
          ? <img src={img} alt="" className="revet-thumb-sm" />
          : <span className="revet-thumb-sm revet-thumb-sm-empty" />}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          {defaultLabel && <option value="">{defaultLabel}</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>
    </Field>
  );
};

/* Rubrique dépliable (accordéon) de « Réglages généraux » : titre + flèche +
   texte explicatif, puis la liste des choix quand ouverte */
const Rubrique = ({ titre, hint, ouvert, onToggle, children }) => (
  <div className="rubrique">
    <p className="section-label carac-toggle" onClick={onToggle} title={ouvert ? "Replier" : "Ouvrir"}>
      <span className={"carac-arrow" + (ouvert ? " open" : "")}></span>
      {titre}
    </p>
    <p className="config-hint" style={{ marginTop: -4 }}>{hint}</p>
    {ouvert && children}
  </div>
);

/* Un choix de catalogue : case à cocher + vignette + nom + détail */
const Choix = ({ checked, onChange, image, nom, detail }) => (
  <label className={"choix-row" + (checked ? " checked" : "")} onClick={(e) => { e.preventDefault(); onChange(); }}>
    {image
      ? <img src={image} alt="" className="choix-thumb" />
      : <span className="choix-thumb choix-thumb-empty" />}
    <span className="choix-nom">{nom}</span>
    {detail && <span className="choix-detail">{detail}</span>}
  </label>
);

/* Rosace des points cardinaux (N/E/S/O) ; avec onPick, chaque quart est
   cliquable (sélection de la vue en élévation) */
const ROSACE_QUARTS = {
  nord: "M20 20 L7.3 7.3 A18 18 0 0 1 32.7 7.3 Z",
  est: "M20 20 L32.7 7.3 A18 18 0 0 1 32.7 32.7 Z",
  sud: "M20 20 L32.7 32.7 A18 18 0 0 1 7.3 32.7 Z",
  ouest: "M20 20 L7.3 32.7 A18 18 0 0 1 7.3 7.3 Z",
};
const ROSACE_LABELS = { nord: ["N", 20, 11], est: ["E", 30, 23], sud: ["S", 20, 34], ouest: ["O", 10, 23] };
const Rosace = ({ size = 40, onPick, active }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className="rosace" aria-label="Points cardinaux">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#a8a29e" strokeWidth="1" />
    {Object.entries(ROSACE_QUARTS).map(([key, d]) => (
      <path key={key} d={d}
        fill={active === key ? "#b45309" : "transparent"}
        stroke={onPick ? "#e7e5e4" : "none"}
        style={onPick ? { cursor: "pointer" } : undefined}
        onClick={onPick ? () => onPick(key) : undefined}
        title={onPick ? key : undefined}
      />
    ))}
    <circle cx="20" cy="20" r="1.6" fill="#78716c" />
    {Object.entries(ROSACE_LABELS).map(([k, [l, x, y]]) => (
      <text key={k} x={x} y={y} textAnchor="middle" fontSize="7.5" fontWeight="700"
        fill={active === k ? "#fff" : "#78716c"}>{l}</text>
    ))}
  </svg>
);

/* =================================================================
   App
================================================================= */
export default function App() {
  const [d, setD] = useState(DEFAULTS);
  const [selectedFace, setSelectedFace] = useState("sud");
  // Élément sélectionné sur le plan : une face ("nord"/"est"/"sud"/"ouest") ou "toiture"
  const [planSel, setPlanSel] = useState("sud");
  const selIsToiture = planSel === "toiture";
  const [selPent, setSelPent] = useState(null); // { instId, versant } : pent cliqué sur le plan
  // Onglet actif de la carte « Réglages généraux » (par défaut : Module)
  const [reglageOpen, setReglageOpen] = useState("formes"); // rubrique ouverte dans « Réglages généraux » (accordéon)
  const [addPick, setAddPick] = useState(null); // { instId, side } : choix du modèle à ajouter via le + du plan
  const [chiffrageCardOpen, setChiffrageCardOpen] = useState(false); // carte Chiffrage réduite par défaut (bande grise seule)
  const [sauvOpen, setSauvOpen] = useState(false); // pop-up « Sauvegardes » fermée par défaut
  const [reglagesOpen, setReglagesOpen] = useState(false); // conteneurs de la première ligne repliés au démarrage
  const [soumettreOpen, setSoumettreOpen] = useState(false); // pop-up « Soumettre » fermée par défaut
  const [murOpen, setMurOpen] = useState(false); // pop-up Mur/Toiture : ouverte uniquement au clic sur le plan
  const [plancherPopOpen, setPlancherPopOpen] = useState(false); // pop-up Plancher : ouverte au clic sur le plancher en façade
  const [flash, setFlash] = useState("");
  const [caracOpen, setCaracOpen] = useState(false); // zone « Caractéristiques techniques » fermée par défaut
  const [chiffrageOpen, setChiffrageOpen] = useState(false); // détail par mur du chiffrage, fermé par défaut
  const [plancherOpen, setPlancherOpen] = useState(false); // détail plancher par module, fermé par défaut
  const [charpenteOpen, setCharpenteOpen] = useState(false); // détail charpente par côté, fermé par défaut
  const [pentsOpen, setPentsOpen] = useState(false); // détail par pent couverture, fermé par défaut
  const [pentsBaseOpen, setPentsBaseOpen] = useState(false); // détail par pent complexe de toiture, fermé par défaut
  const [ouvrantsOpen, setOuvrantsOpen] = useState(false); // détail des ouvrants, fermé par défaut
  const [fenetresToitOpen, setFenetresToitOpen] = useState(false); // détail des fenêtres de toit, fermé par défaut
  const [autonomieOpen, setAutonomieOpen] = useState(false); // détail des systèmes autonomie, fermé par défaut
  const [addOpen, setAddOpen] = useState(false);     // zone d'ajout d'un ouvrant (sous le +)
  const [addMenuiserieId, setAddMenuiserieId] = useState("");
  const [addError, setAddError] = useState("");
  const [addFenOpen, setAddFenOpen] = useState(false); // zone d'ajout d'une fenêtre de toit (modale toiture)
  const [addFenId, setAddFenId] = useState("");
  const [addFenError, setAddFenError] = useState("");

  /* ----- Panneaux flottants de la zone principale (plan / élévation) -----
     Les panneaux sont posés directement sur le fond de page (pas de carte) ;
     on garde un conteneur par panneau pour pouvoir les déplacer (clic-glissé
     sur la barre de titre) et les redimensionner (poignée en coin bas-droit). */
  const stageRef = useRef(null);
  const panelRefs = useRef({});
  const dragMovedRef = useRef(false); // vrai si le dernier pointerdown était un déplacement
  // Seuls le plan et l'élévation sont des panneaux flottants (dans le stage) ;
  // les 4 conteneurs (réglages, chiffrage, sauvegardes, soumettre) sont fixés
  // dans la colonne de droite. Par défaut : plan à 10 px du coin haut-gauche,
  // élévation en dessous.
  // w très grand au départ : plan et élévation démarrent en pleine largeur
  // (clampés à stageW - 20 px dès que la largeur du stage est mesurée)
  const [panels, setPanels] = useState({
    plan: { x: 10, y: 0, w: 5000, h: 420 },
    elev: { x: 10, y: 580, w: 5000, h: 340 },
    vue3d: { x: 10, y: 1080, w: 5000, h: 380 },
  });
  const [zoom, setZoom] = useState(1); // zoom du plan (boutons + / −)
  const [stageH, setStageH] = useState(900);
  const [stageW, setStageW] = useState(0);
  // Hauteur du stage = panneau le plus bas ; stageW mesuré à chaque rendu + au resize
  useEffect(() => {
    const w = stageRef.current?.clientWidth ?? 0;
    if (w) setStageW(w);
    let max = 0;
    Object.values(panelRefs.current).forEach((el) => {
      if (el) max = Math.max(max, el.offsetTop + el.offsetHeight);
    });
    setStageH(Math.max(max + 8, 320));

    // Vue 3D toujours fixée sous le panneau Façades : on mesure le bas réel du
    // panneau (barre de titre + rosace = hauteur variable) pour éviter tout chevauchement
    const elevEl = panelRefs.current.elev;
    if (elevEl) {
      const wantY = elevEl.offsetTop + elevEl.offsetHeight + 20;
      setPanels((prev) => (Math.abs(prev.vue3d.y - wantY) > 2
        ? { ...prev, vue3d: { ...prev.vue3d, x: prev.elev.x, y: wantY, w: prev.elev.w } }
        : prev));
    }
    const onResize = () => {
      const w2 = stageRef.current?.clientWidth ?? 0;
      if (w2) setStageW(w2);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
  // largeur effective d'un panneau : clampée à stageW - 20 (pleine largeur possible)
  const effW = (key) => (stageW ? Math.min(panels[key].w, stageW - 20) : panels[key].w);
  const clampPanel = (p, stageW) => ({
    // 10 px de marge latérale (haut à 0 px) : un panneau peut aller de 10 px à stageW - 10
    x: Math.max(10, Math.min(p.x, Math.max(10, stageW - 10 - p.w))),
    y: Math.max(0, p.y),
    w: Math.max(260, Math.min(p.w, Math.max(260, stageW - 20))),
    h: Math.max(180, p.h ?? 180),
  });
  // Plan fixé en haut à gauche de la zone grise (10, 0) ; Façades collée juste
  // en dessous, à 20 px, même x et même largeur
  const resolveOverlap = (ps) => {
    const A = { ...ps.plan, x: 10, y: 0 };
    const hA = A.h + 140; // hauteur panneau ≈ canvas + barre de titre + rangée légende/rosace
    const stageW = stageRef.current?.clientWidth ?? 1100;
    const E = clampPanel({ ...ps.elev, x: A.x, y: A.y + hA + 20, w: A.w }, stageW);
    const hE = E.h + 140; // panneau Façades : canvas + barre de titre + rangée rosace
    return { ...ps, plan: A, elev: E, vue3d: clampPanel({ ...ps.vue3d, x: E.x, y: E.y + hE + 20, w: E.w }, stageW) };
  };
  // En dessous de 820 px, les panneaux sont empilés en pleine largeur : pas de drag/resize
  const isMobileLayout = () => window.innerWidth <= 820;
  // Déplacement d'un panneau par sa barre de titre (pointer events globaux)
  const startDrag = (e, key) => {
    if (e.button !== 0 || isMobileLayout()) return;
    if (key === "plan" || key === "elev" || key === "vue3d") return; // Plan, Façades et Vue 3D sont fixés
    e.preventDefault();
    const stageW = stageRef.current?.clientWidth ?? 1100;
    const start = { cx: e.clientX, cy: e.clientY, x: panels[key].x, y: panels[key].y };
    const move = (ev) => {
      if (!dragMovedRef.current && Math.hypot(ev.clientX - start.cx, ev.clientY - start.cy) > 5) dragMovedRef.current = true;
      setPanels((prev) => {
        const next = { ...prev, [key]: clampPanel({ ...prev[key], x: start.x + ev.clientX - start.cx, y: start.y + ev.clientY - start.cy }, stageW) };
        return (key === "plan" || key === "elev" || key === "vue3d") ? resolveOverlap(next) : next;
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.setTimeout(() => { dragMovedRef.current = false; }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Redimensionnement par la poignée en coin bas-droit ; withW = largeur aussi,
  // sinon hauteur seule (effet de zoom) — Plan/Façades : hauteur seule, largeur pleine fixe
  const startResize = (e, key, withH = true, withW = true) => {
    if (e.button !== 0 || isMobileLayout()) return;
    e.preventDefault();
    e.stopPropagation();
    const stageW = stageRef.current?.clientWidth ?? 1100;
    const start = { cx: e.clientX, cy: e.clientY, w: panels[key].w, h: panels[key].h };
    const move = (ev) => {
      setPanels((prev) => {
        const next = { ...prev, [key]: clampPanel(
          { ...prev[key], w: withW ? start.w + ev.clientX - start.cx : prev[key].w, ...(withH ? { h: start.h + ev.clientY - start.cy } : {}) },
          stageW
        ) };
        return (key === "plan" || key === "elev" || key === "vue3d") ? resolveOverlap(next) : next;
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ----- Catalogues du back-office (menuiseries, modules, enveloppe) ----- */
  const [catalogue, setCatalogue] = useState(null);

  /* ----- Espace client : session, configurations enregistrées ----- */
  const [session, setSession] = useState(null); // null = chargement en cours
  const [configs, setConfigs] = useState([]);
  const [saveName, setSaveName] = useState("");
  const [configMsg, setConfigMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));
  /* Bascule mur/charpente d'une arête — sur un côté commun, les deux côtés
     basculent ensemble (la pastille reste visible sur le mur commun) */
  /* Pose l'état mur/charpente d'une arête — sur un côté commun, les deux
     côtés suivent ensemble */
  const setEdgeActif = (instId, face, actif) => {
    setD((prev) => {
      const edges = eachEdge(prev, (i) => dimsOf(prev, env, i), epMurOf(prev, env));
      const e = edges.find((x) => x.inst.id === instId && x.face === face);
      if (!e || e.actif === actif) return prev;
      const patchInst = (inst, fk) => ({ ...inst, murs: { ...inst.murs, [fk]: { ...inst.murs[fk], actif } } });
      let instances = (prev.instances || []).map((i) => (i.id === e.inst.id ? patchInst(i, e.face) : i));
      if (e.nb) instances = instances.map((i) => (i.id === e.nb.id ? patchInst(i, e.nface) : i));
      return { ...prev, instances };
    });
  };
  const toggleEdge = (instId, face) => {
    const e = edgesAll.find((x) => x.inst.id === instId && x.face === face);
    if (e) setEdgeActif(instId, face, !e.actif);
  };

  const setFace = (key, patch) =>
    setD((prev) => ({
      ...prev,
      instances: (prev.instances || []).map((i) =>
        i.id === prev.selInst ? { ...i, murs: { ...i.murs, [key]: { ...i.murs[key], ...patch } } } : i
      ),
    }));

  /* Catalogues du back-office, avec repli sur les valeurs par défaut */
  const env = {
    murs: catalogue?.enveloppe?.murs?.length ? catalogue.enveloppe.murs : MURS,
    planchers: catalogue?.enveloppe?.planchers?.length ? catalogue.enveloppe.planchers : PLANCHERS,
    facades: catalogue?.enveloppe?.surfaces?.length ? catalogue.enveloppe.surfaces : FACADES, // revêtements Extérieur
    interieurs: catalogue?.enveloppe?.interieurs?.length ? catalogue.enveloppe.interieurs : INTERIEURS, // revêtements Intérieur
    couvertures: catalogue?.enveloppe?.couvertures?.length ? catalogue.enveloppe.couvertures : COUVERTURES, // revêtements Toiture
    menuiseries: catalogue?.menuiseries?.length ? catalogue.menuiseries : null,
    modules: catalogue?.modules?.length ? catalogue.modules : null,
    isolations: catalogue?.isolation?.length ? catalogue.isolation : ISOLATIONS,
    systemesAut: catalogue?.systemes_aut?.length ? catalogue.systemes_aut : SYSTEMES_AUT, // systèmes autonomes
    autonomies: catalogue?.autonomie?.length ? catalogue.autonomie : AUTONOMIES, // packs autonomie
    fenetresToit: catalogue?.fenetres_toit?.length ? catalogue.fenetres_toit : FENETRES_TOIT, // fenêtres de toit
    marges: catalogue?.marges || {}, // coefficients de marge par rubrique (zones Catalogue / Revêtements)
    promotions: catalogue?.promotions || [], // codes promotionnels (zone Structure)
    formes: catalogue?.formes?.length ? catalogue.formes : FORMES,
    charpentes: catalogue?.charpentes?.length ? catalogue.charpentes : CHARPENTES,
    toitures: catalogue?.toitures?.length ? catalogue.toitures : TOITURES,
  };

  const inst = instOf(d, d.selInst) || { id: "m0", x: 0, y: 0, moduleId: d.moduleId, murs: modelMurs() };
  const face = inst.murs[selectedFace] || inst.murs.sud;
  // arête sélectionnée (numérotée) pour les titres « Mur N »
  const edgesAll = eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env));
  const selEdge = edgesAll.find((e) => e.inst.id === d.selInst && e.face === selectedFace);
  const toitureDef = toitureDefOf(d, env);
  const toitType = toitTypeOf(d, env);
  const toitureNom = toitureDef.nom;
  const formeDef = formeDefOf(d, env);
  // débord de toiture effectif (m) : champ client > champ back-office de la forme > épaisseur
  const depToitM = Math.max(0, +(d.depassee ?? formeDef?.depassee ?? +(toitureDef.epaisseur ?? 0.30) * 100)) / 100;
  const [popPos, setPopPos] = useState(null); // position écran du dernier clic sur le plan (ancrage des pop-ups)
  // Pop-up déplaçable par sa barre de titre (elle peut masquer des éléments du plan)
  const startPopDrag = (e) => {
    if (e.button !== 0 || !popPos) return;
    if (e.target.closest("button")) return; // ne pas gêner le bouton « fermer »
    e.preventDefault();
    const start = { cx: e.clientX, cy: e.clientY, x: popPos.x, y: popPos.y };
    const move = (ev) => setPopPos({ x: start.x + ev.clientX - start.cx, y: start.y + ev.clientY - start.cy });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Pop-ups Soumettre / Sauvegardes : ouvertes en position fixe 20 px sous le bouton cliqué
  // (portal body -> toujours visibles en haut de la fenêtre), puis déplaçables par la barre
  // de titre (comme les pop-ups murs)
  const [soumPos, setSoumPos] = useState(null); // {x,y} position fixe de la pop-up
  const [sauvPos, setSauvPos] = useState(null);
  const startCenterDrag = (setPos) => (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    e.preventDefault();
    const card = e.currentTarget.closest(".card");
    const r = card.getBoundingClientRect();
    const start = { cx: e.clientX, cy: e.clientY, x: r.left, y: r.top, w: r.width };
    const move = (ev) => setPos({
      x: Math.max(8, Math.min(start.x + ev.clientX - start.cx, (window.innerWidth || 1200) - start.w)),
      y: Math.max(8, Math.min(start.y + ev.clientY - start.cy, (window.innerHeight || 800) - 80)),
    });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // pop-ups ancrées horizontalement sur l'élément cliqué du plan (centrées dessus)
  const popStyle = popPos
    ? { position: "fixed", margin: 0, left: Math.max(8, Math.min(popPos.x - 200, (window.innerWidth || 1200) - 416)), top: Math.max(8, Math.min(popPos.y - 24, (window.innerHeight || 800) - 120)) }
    : undefined;
  const murSel = env.murs.find((m) => m.id === d.murType);
  const moduleSel = env.modules?.find((m) => m.id === d.moduleId);
  const isoSel = env.isolations?.find((x) => x.id === d.isolation);
  const charpenteSel = env.charpentes?.find((x) => x.id === d.charpente);
  const surfaceSel = env.facades.find((f) => f.id === murSel?.surface) || env.facades[0];
  const surfaceNom = (id) => env.facades.find((f) => f.id === id)?.nom || "—";
  const couvNom = (id) => couvListOf(env).find((f) => f.id === id)?.nom || "—"; // revêtement de toiture (catalogue « Toiture »)
  const intNom = (id) => intListOf(env).find((f) => f.id === id)?.nom || "—"; // revêtement intérieur (catalogue « Intérieur »)
  const plancherSel = env.planchers.find((p) => p.id === d.plancher);
  const json = useMemo(() => JSON.stringify(buildExport(d, env), null, 2), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const tarifs = useMemo(() => tarifTotal(d, env), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const surfaces = useMemo(() => surfacesChiffrage(d, env), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const pentsAll = pentsOf(d, env); // pents numérotés de tous les modules
  // Indice de validité du code promotion saisi (bande grisée du chiffrage)
  const promo = promoActive(d, env);
  const promoCodeSaisi = String(d.promoCode || "").trim();
  const promoHint = !promoCodeSaisi
    ? "Saisissez le code reçu par e-mail pour bénéficier de la promotion."
    : promo
      ? `Promotion « ${promo.code} » active : −${promo.reduction} % sur les éléments des modules concernés (murs, toiture, ouvrants…).`
      : (env.promotions || []).some((p) => String(p.code || "").trim().toLowerCase() === promoCodeSaisi.toLowerCase())
        ? "Code connu, mais hors période ou non affecté au module choisi."
        : "Code inconnu.";
  // Modules affichés en élévation pour la face choisie : tous les modules,
  // avec leur profondeur par rapport à la face (pour l'occlusion) et la bbox
  // de l'ensemble (pour la projection horizontale de la façade)
  // module le plus proche d'une face donnée (pour la sélection via la rosace)
  const frontInstFor = (faceKey) => {
    const insts = d.instances?.length ? d.instances : [{ id: "m0", x: 0, y: 0, moduleId: d.moduleId }];
    const b = bboxOf(d, (i) => dimsOf(d, env, i));
    let best = null, bestDepth = Infinity;
    for (const inst of insts) {
      const dm = dimsOf(d, env, inst);
      let dep;
      if (faceKey === "sud") dep = b.maxY - (inst.y + dm.largeur);
      else if (faceKey === "nord") dep = inst.y - b.minY;
      else if (faceKey === "est") dep = b.maxX - (inst.x + dm.longueur);
      else dep = inst.x - b.minX;
      if (dep < bestDepth) { bestDepth = dep; best = inst; }
    }
    return best;
  };

  const elevInsts = useMemo(() => {
    const insts = d.instances?.length ? d.instances : [{ id: "m0", x: 0, y: 0, moduleId: d.moduleId, murs: modelMurs() }];
    const b = bboxOf(d, (i) => dimsOf(d, env, i));
    const depth = (inst) => {
      const dm = dimsOf(d, env, inst);
      if (selectedFace === "sud") return b.maxY - (inst.y + dm.largeur);
      if (selectedFace === "nord") return inst.y - b.minY;
      if (selectedFace === "est") return b.maxX - (inst.x + dm.longueur);
      return inst.x - b.minX;
    };
    const oppFace = { nord: "sud", sud: "nord", est: "ouest", ouest: "est" }[selectedFace];
    const list = insts.map((inst) => ({
      inst,
      dm: dimsOf(d, env, inst),
      vis: dimsOf(d, env, inst).visibilite || { murs: true, complexe_toiture: true, plancher: true, couverture: true },
      face: inst.murs?.[selectedFace] || { actif: true, ouvertures: [], surface: null },
      // côté commun avec un autre module ? (pour les poteaux charpente : cachés par les murs
      // seulement sur un côté partagé ; visibles sur un mur extérieur)
      shared: edgesAll.some((e) => e.inst.id === inst.id && e.face === selectedFace && !!e.edge),
      depth: depth(inst),
    }));
    // segment « traversant » : le mur du CÔTÉ OPPOSÉ, toujours au fond — visible en grisé
    // derrière une charpente (face avant sans mur), avec son revêtement INTÉRIEUR
    for (const inst of insts) {
      const of = inst.murs?.[oppFace];
      if (!of || !of.actif) continue; // pas de mur au côté opposé
      list.push({
        inst,
        dm: dimsOf(d, env, inst),
        vis: dimsOf(d, env, inst).visibilite || { murs: true, complexe_toiture: true, plancher: true, couverture: true },
        face: { ...of, surface: null, surfaceInt: of.surfaceInt ?? null, traversant: true },
        shared: false,
        depth: 1e9, // toujours derrière tout
        traversant: true,
      });
    }
    return { list, b };
  }, [d, selectedFace]); // eslint-disable-line react-hooks/exhaustive-deps
  // dernière sauvegarde affichée dans la bande grise de la carte « Sauvegardes »
  const lastConfig = configs.length
    ? [...configs].sort((a, b) => String(b.updated ?? "").localeCompare(String(a.updated ?? "")))[0]
    : null;

  /* Patch d'état appliqué au choix d'un modèle de module : géométrie
     prédéfinie uniquement (le client ne peut pas la modifier). L'isolation
     (mur/plancher/toiture) et la forme de toiture se choisissent à part. */
  const modulePatch = (m) => ({
    moduleId: m.id,
    nom: m.nom,
    longueur: +m.longueur,
    largeur: +m.largeur,
    hauteur: +m.hauteur,
    // chaque côté du module : mur (actif) ou charpente (pas de mur) — le
    // client peut ensuite rebasculer sur le plan ; on repart d'un seul module
    instances: [{ id: "m0", x: 0, y: 0, moduleId: m.id, murs: modelMurs(m.faces) }],
    selInst: "m0",
  });

  const dimsOfInst = (inst) => dimsOf(d, env, inst);
  const dmSel = dimsOf(d, env, inst); // dims du module sélectionné
  // surface du mur sélectionné (ligne directrice + 2 épaisseurs, moins les ouvrants)
  const murArea = Math.max(0, (murLongueurDm(dmSel, selectedFace) + 2 * +(murSel?.epaisseur ?? 0)) * dmSel.hauteur - surfaceMenuiserie(face));
  // Surface affichée dans la pop-up = CELLE DU CHIFFRAGE pour l'arête sélectionnée
  // (avec triangle de pignon + épaisseur de toiture, et surface intérieure à part)
  const selMurDetail = selEdge
    ? surfaces.mursDetail.find((m) => m.key === (selEdge.edge || `${selEdge.inst.id}-${selEdge.face}`))
    : null;

  /* Clic sur un + du plan : ouvre le choix du modèle à ajouter. Le côté commun
     doit avoir la même longueur -> on ne propose que les modèles compatibles. */
  const openAddPick = (instId, side, ev) => { setAddPick({ instId, side }); if (ev) setPopPos({ x: ev.clientX, y: ev.clientY }); };
  const addSharedLen = () => {
    if (!addPick) return 0;
    const dm = dimsOfInst(instOf(d, addPick.instId));
    return (addPick.side === "est" || addPick.side === "ouest") ? dm.largeur : dm.longueur;
  };
  const addCandidates = () => {
    const sharedLen = addSharedLen();
    return (env.modules || []).filter((m) =>
      Math.abs(((addPick.side === "est" || addPick.side === "ouest") ? +m.largeur : +m.longueur) - sharedLen) < 1e-6
    );
  };
  const doAdd = (moduleId) => {
    if (!addPick) return;
    const { instId, side } = addPick;
    setD((prev) => {
      const src = instOf(prev, instId);
      if (!src) return prev;
      const dmSrc = dimsOf(prev, env, src);
      const model = env.modules?.find((m) => m.id === moduleId);
      const dmNew = model ? { longueur: +model.longueur, largeur: +model.largeur, hauteur: +model.hauteur } : dmSrc;
      // position absolue : le nouveau module colle le côté de l'existant,
      // en laissant l'épaisseur du mur entre les deux lignes directrices
      // (le mur commun occupe cet espace, les murs restent alignés)
      const ep = epMurOf(prev, env);
      let nx = src.x, ny = src.y;
      if (side === "est") nx = src.x + dmSrc.longueur + ep;
      if (side === "ouest") nx = src.x - ep - dmNew.longueur;
      if (side === "sud") ny = src.y + dmSrc.largeur + ep;
      if (side === "nord") ny = src.y - ep - dmNew.largeur;
      // aucun chevauchement de rectangles autorisé
      const eps = 1e-6;
      const overlap = (prev.instances || []).some((j) => {
        const dmJ = dimsOf(prev, env, j);
        return nx < j.x + dmJ.longueur - eps && nx + dmNew.longueur > j.x + eps
            && ny < j.y + dmJ.largeur - eps && ny + dmNew.largeur > j.y + eps;
      });
      if (overlap) return prev;
      const opp = { nord: "sud", sud: "nord", est: "ouest", ouest: "est" }[side];
      const murs = modelMurs(model?.faces);
      // le module ajouté hérite isolation/forme/charpente des réglages généraux ;
      // un mur est prioritaire sur une charpente sur le côté commun
      murs[opp] = { ...murs[opp], actif: !!(src.murs[side]?.actif ?? murs[opp].actif) };
      const id = "m" + Math.random().toString(36).slice(2, 10);
      return { ...prev, instances: [...(prev.instances || []), { id, x: nx, y: ny, moduleId, murs }], selInst: id };
    });
    setAddPick(null);
  };

  const removeInstance = (id) => {
    setD((prev) => {
      const insts = prev.instances || [];
      if (insts.length <= 1) return prev;
      const rest = insts.filter((i) => i.id !== id);
      return { ...prev, instances: rest, selInst: prev.selInst === id ? rest[0].id : prev.selInst };
    });
  };

  /* Choix de l'isolation (onglet Isolation) : type de mur, plancher, toiture */
  const applyIsolation = (id) => {
    const iso = env.isolations?.find((x) => x.id === id);
    set(iso
      ? { isolation: iso.id, murType: iso.mur, plancher: iso.plancher, toiture: iso.toiture }
      : { isolation: null });
  };

  /* Choix de la charpente (onglet Charpente) */
  const applyCharpente = (id) => {
    set(env.charpentes?.some((x) => x.id === id) ? { charpente: id } : { charpente: null });
  };

  /* Choix du pack autonomie (rubrique « Autonomie » des réglages généraux) :
     liste de systèmes autonomes du catalogue « autonomie » */
  const applyAutonomie = (id) => {
    set(env.autonomies?.some((a) => a.id === id) ? { autonomie: id } : { autonomie: null });
  };
  // systèmes autonomes du pack choisi (pour affichage + chiffrage)
  const autoSel = env.autonomies?.find((a) => a.id === d.autonomie) || null;
  const systemesOf = (auto) => (auto?.systemes || [])
    .map((sid) => env.systemesAut?.find((s) => s.id === sid))
    .filter(Boolean);

  /* Choix de la forme de toiture (onglet Formes) : géométrie + pente(s) */
  const applyForme = (id) => {
    const f = env.formes?.find((x) => x.id === id);
    if (!f) {
      set({ forme: null });
      return;
    }
    const geometrie = f.geometrie || "monopente";
    const p1 = +(f.pente1 ?? f.pente ?? 15);
    const p2 = +(f.pente2 ?? f.pente1 ?? f.pente ?? 15);
    set({
      forme: f.id,
      geometrie,
      pente: p1,
      pente2: geometrie === "deuxpentes" ? p2 : p1,
      pignon: geometrie === "deuxpentes", // deux pentes = pignon, quatre pentes = croupe
    });
  };

  const ouvrirAjout = () => {
    setAddMenuiserieId(env.menuiseries?.[0]?.id || "");
    setAddError("");
    setAddOpen(true);
  };
  const validerAjout = () => {
    const def = env.menuiseries?.find((x) => x.id === addMenuiserieId);
    const largeur = def ? +def.largeur : 1.0;
    const hauteur = def ? +def.hauteur : 2.1;
    const L = murLongueurDm(dmSel, selectedFace);
    // Place occupée = fin de la dernière ouverture
    const occupe = face.ouvertures.reduce((mx, o) => Math.max(mx, o.position + o.largeur), 0);
    // Position calée sur la grille 7,8 cm + n × 60 cm, au moins après la dernière ouverture
    const k = Math.max(0, Math.ceil((occupe - POSITION_MIN) / POSITION_STEP - 1e-9));
    const position = Math.round((POSITION_MIN + k * POSITION_STEP) * 1000) / 1000;
    // Vérification préalable : la place restante sur le mur suffit-elle ?
    if (position + largeur > L + 1e-9) {
      setAddError(`Plus de place sur ce mur (${fmtCm(L)} cm) pour cet ouvrant (${fmtCm(largeur)} cm) à partir de ${fmtCm(position)} cm.`);
      return;
    }
    setFace(selectedFace, {
      ouvertures: [
        ...face.ouvertures,
        { menuiserieId: def?.id ?? null, type: def?.type || "baie", largeur, hauteur, position },
      ],
    });
    setAddOpen(false);
    setAddError("");
  };
  const updateOuverture = (i, patch) =>
    setFace(selectedFace, { ouvertures: face.ouvertures.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const pickMenuiserie = (i, menuiserieId) => {
    const m = env.menuiseries?.find((x) => x.id === menuiserieId);
    updateOuverture(i, m
      ? { menuiserieId: m.id, type: m.type, largeur: +m.largeur, hauteur: +m.hauteur }
      : { menuiserieId: null });
  };
  /* Position maximale : l'ouverture reste entièrement dans le mur */
  const positionMax = (o) => Math.max(POSITION_MIN, murLongueurDm(dmSel, selectedFace) - o.largeur);
  /* Avance/recule par pas de 60 cm, borné entre 7,8 cm et le maximum */
  const stepPosition = (i, dir) => {
    const o = face.ouvertures[i];
    const next = Math.round((o.position + dir * POSITION_STEP) * 1000) / 1000;
    updateOuverture(i, { position: Math.min(Math.max(next, POSITION_MIN), positionMax(o)) });
  };
  const removeOuverture = (i) =>
    setFace(selectedFace, { ouvertures: face.ouvertures.filter((_, j) => j !== i) });

  /* ----- Fenêtres de toit sur le pent sélectionné (modale « Toiture ») -----
     Même principe que les ouvrants sur les murs : catalogue + position le long
     du bas de pente (pas de 60 cm, min 7,8 cm) ; profondeur fixe à 20 px du
     bas de pente sur le plan. */
  const pentSel = selPent ? pentsAll.find((pp) => pp.instId === selPent.instId && pp.versant === selPent.versant) : null;
  const fenetresPent = pentSel ? fenetresOfPent(d, pentSel.instId, pentSel.versant) : [];
  const basPenteLen = pentSel ? basPenteLongueur(dimsOf(d, env, instOf(d, pentSel.instId)), toitType, pentSel.versant) : 0;
  const setFenetres = (list) => {
    if (!pentSel) return;
    setD((prev) => ({
      ...prev,
      fenetresToit: {
        ...(prev.fenetresToit || {}),
        [pentSel.instId]: { ...(prev.fenetresToit?.[pentSel.instId] || {}), [pentSel.versant]: list },
      },
    }));
  };
  const validerFenetre = (f) => f.position >= POSITION_MIN - 1e-9 && f.position + f.largeur <= basPenteLen + 1e-9;
  const ouvrirAjoutFen = () => {
    setAddFenId(env.fenetresToit?.[0]?.id || "");
    setAddFenError("");
    setAddFenOpen(true);
  };
  const validerAjoutFen = () => {
    const def = env.fenetresToit?.find((x) => x.id === addFenId);
    const largeur = def ? +def.largeur : 0.78;
    const hauteur = def ? +def.hauteur : 0.98;
    // Place occupée = fin de la dernière fenêtre de toit
    const occupe = fenetresPent.reduce((mx, f) => Math.max(mx, f.position + f.largeur), 0);
    // Position calée sur la grille 7,8 cm + n × 60 cm, au moins après la dernière fenêtre
    const k = Math.max(0, Math.ceil((occupe - POSITION_MIN) / POSITION_STEP - 1e-9));
    const position = Math.round((POSITION_MIN + k * POSITION_STEP) * 1000) / 1000;
    if (position + largeur > basPenteLen + 1e-9) {
      setAddFenError(`Plus de place sur ce pent (${fmtCm(basPenteLen)} cm) pour cette fenêtre (${fmtCm(largeur)} cm) à partir de ${fmtCm(position)} cm.`);
      return;
    }
    setFenetres([...fenetresPent, { fenetreId: def?.id ?? null, largeur, hauteur, position }]);
    setAddFenOpen(false);
    setAddFenError("");
  };
  const updateFen = (i, patch) => setFenetres(fenetresPent.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const pickFen = (i, fenetreId) => {
    const m = env.fenetresToit?.find((x) => x.id === fenetreId);
    updateFen(i, m
      ? { fenetreId: m.id, largeur: +m.largeur, hauteur: +m.hauteur }
      : { fenetreId: null });
  };
  /* Position maximale : la fenêtre reste entièrement sur le bas de pente */
  const fenPositionMax = (f) => Math.max(POSITION_MIN, basPenteLen - f.largeur);
  /* Avance/recule par pas de 60 cm le long du bas de pente */
  const stepFen = (i, dir) => {
    const f = fenetresPent[i];
    const next = Math.round((f.position + dir * POSITION_STEP) * 1000) / 1000;
    updateFen(i, { position: Math.min(Math.max(next, POSITION_MIN), fenPositionMax(f)) });
  };
  const removeFen = (i) => setFenetres(fenetresPent.filter((_, j) => j !== i));

  const nbErreurs = eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).reduce(
    (n, e) => n + (e.actif
      ? [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])].filter((o) => !validerOuverture(d, dimsOf(d, env, e.inst), e.face, o)).length
      : 0),
    0
  );

  const notifier = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 2000); };

  /* ----- Espace client : session, configurations enregistrées ----- */
  const postConfigs = async (payload) => {
    const r = await fetch(API_CONFIGS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  };

  const refreshConfigs = async () => {
    try {
      const l = await postConfigs({ action: "list" });
      if (l.ok) setConfigs(l.configurations);
    } catch { /* silencieux */ }
  };

  // Au chargement : état de la session, liste des configurations,
  // et chargement éventuel d'une configuration demandée (?config=<id>)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(API_SESSION);
        const s = await r.json();
        if (cancelled) return;
        setSession(s);
        if (!s.loggedIn) {
          // Enregistrement automatique local restauré (visiteur non connecté, pas de ?config=)
          try {
            const auto = localStorage.getItem("baracca_autosave");
            if (auto && !new URLSearchParams(window.location.search).get("config")) {
              const saved = JSON.parse(auto);
              if (saved && saved.config) {
                setD(mergeConfig(saved.config));
                notifier("Brouillon restauré ✓");
              }
            }
          } catch { /* silencieux */ }
          return;
        }
        const l = await postConfigs({ action: "list" });
        if (cancelled) return;
        if (l.ok) setConfigs(l.configurations);
        const wanted = new URLSearchParams(window.location.search).get("config");
        if (wanted) {
          const g = await postConfigs({ action: "get", id: wanted });
          if (!cancelled && g.ok && g.configuration) {
            setD(mergeConfig(g.configuration.config));
            notifier("Configuration chargée ✓");
          }
        }
      } catch {
        if (!cancelled) setSession({ loggedIn: false, user: null });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enregistrement automatique avant de quitter la page (changement de page / fermeture) :
  // compte client -> sauvegarde serveur ; sinon -> brouillon local (localStorage)
  useEffect(() => {
    const autosave = () => {
      try {
        const payload = { action: "save", nom: (d.nom || "module_baracca").trim(), config: d, json };
        if (session?.loggedIn) {
          fetch(API_CONFIGS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        } else {
          localStorage.setItem("baracca_autosave", JSON.stringify({ config: d, json, at: Date.now() }));
        }
      } catch { /* silencieux : le brouillon ne doit pas bloquer la navigation */ }
    };
    window.addEventListener("pagehide", autosave);
    window.addEventListener("beforeunload", autosave);
    return () => {
      window.removeEventListener("pagehide", autosave);
      window.removeEventListener("beforeunload", autosave);
    };
  }, [d, json, session]);

  // Chargement des catalogues (menuiseries, modèles de modules, enveloppe)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(API_CATALOGUE);
        const g = await r.json();
        if (!cancelled && g.ok && g.catalogue) setCatalogue(g.catalogue);
      } catch { /* repli sur les catalogues par défaut */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Réconcilie l'état courant si le catalogue back-office a évolué
  // (ex. : type de mur supprimé depuis le back-office)
  useEffect(() => {
    if (!catalogue) return;
    setD((prev) => {
      const e = catalogue.enveloppe || {};
      const patch = {};
      if (e.murs?.length && !e.murs.some((m) => m.id === prev.murType)) patch.murType = e.murs[0].id;
      if (e.planchers?.length && !e.planchers.some((p) => p.id === prev.plancher)) patch.plancher = e.planchers[0].id;
      if (e.surfaces?.length && !e.surfaces.some((f) => f.id === prev.facade)) patch.facade = e.surfaces[0].id;
      if (prev.moduleId && catalogue.modules?.length && !catalogue.modules.some((m) => m.id === prev.moduleId)) {
        patch.moduleId = null;
      }
      // Visite sans configuration demandée : le configurateur démarre sur les
      // éléments marqués « par défaut » dans le back-office (module, isolation,
      // forme, charpente), à défaut le premier de chaque catalogue
      const wantsConfig = new URLSearchParams(window.location.search).get("config");
      const defOf = (list) => (list?.length ? list.find((x) => x.defaut) || list[0] : null);
      if (!wantsConfig) {
        const modDef = defOf(catalogue.modules);
        if (modDef && !prev.moduleId) Object.assign(patch, modulePatch(modDef));
        const isoDef = defOf(catalogue.isolation);
        if (isoDef && !prev.isolation) {
          patch.isolation = isoDef.id; patch.murType = isoDef.mur; patch.plancher = isoDef.plancher; patch.toiture = isoDef.toiture;
        }
        const formeDef = defOf(catalogue.formes);
        if (formeDef && !prev.forme) {
          const g = formeDef.geometrie || "monopente";
          const p1 = +(formeDef.pente1 ?? formeDef.pente ?? 15), p2 = +(formeDef.pente2 ?? formeDef.pente1 ?? formeDef.pente ?? 15);
          patch.forme = formeDef.id; patch.geometrie = g; patch.pente = p1;
          patch.pente2 = g === "deuxpentes" ? p2 : p1; patch.pignon = g === "deuxpentes";
        }
        const chDef = defOf(catalogue.charpentes);
        if (chDef && !prev.charpente) patch.charpente = chDef.id;
        const auDef = defOf(catalogue.autonomie);
        if (auDef && !prev.autonomie) patch.autonomie = auDef.id;
      }
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue]);

  const enregistrer = async () => {
    const nom = (saveName || d.nom || "module_baracca").trim();
    try {
      const g = await postConfigs({ action: "save", nom, config: d, json });
      if (g.ok) {
        setConfigMsg("Configuration enregistrée ✓");
        setSaveName("");
        await refreshConfigs();
      } else {
        setConfigMsg(g.error || "Erreur lors de l'enregistrement.");
      }
    } catch {
      setConfigMsg("Erreur réseau lors de l'enregistrement.");
    }
    setTimeout(() => setConfigMsg(""), 2500);
  };

  const chargerConfig = async (id) => {
    try {
      const g = await postConfigs({ action: "get", id });
      if (g.ok && g.configuration) {
        setD(mergeConfig(g.configuration.config));
        setTabGen("module");
        notifier("Configuration chargée ✓");
      }
    } catch { notifier("Chargement impossible"); }
  };

  const supprimerConfig = async (id) => {
    try {
      const g = await postConfigs({ action: "delete", id });
      if (g.ok) {
        await refreshConfigs();
        notifier("Configuration supprimée ✓");
      }
    } catch { notifier("Suppression impossible"); }
  };

  // Bouton « Soumettre » : envoie la configuration à Baracca
  const soumettre = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(API_SOUMETTRE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
      const g = await r.json();
      if (g.ok) {
        notifier(g.mail === false
          ? "Dossier enregistré, mais la notification e-mail a échoué"
          : "Dossier soumis — l'architecte est averti ✓");
      } else {
        notifier(g.error || "Échec de la soumission");
      }
    } catch {
      notifier("Échec de la soumission");
    }
    setSubmitting(false);
  };

  // Carte « Réglages généraux » : accordéon Type de toiture / Performance
  // énergétique / Type de charpente (le module par défaut est appliqué au
  // chargement ; les modules suivants se rajoutent sur le plan)

  return (
    <div className="app">
      <div className="layout">
      <div className="left-col">
      {/* Ligne « hint + Sauvegardes » en tableau : texte à gauche, bouton à droite
          (aligné avec le bouton Soumettre en haut de la colonne de droite) */}
      <div className="submit-hint-row">
        <p className="submit-hint">Utilisez les boutons pour enregistrer ou soumettre votre projet — nous répondons dans les meilleurs délais</p>
        <button type="button" className="action-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const w = window.innerWidth || 1200; setSauvPos({ x: Math.max(8, Math.min((w - 400) / 2, w - 416)), y: r.bottom + 20 }); setSauvOpen(true); }} title="Ouvrir la fenêtre Sauvegardes">Sauvegardes</button>
      </div>
      {soumettreOpen && createPortal(
      <div className="modal-overlay center" onClick={() => setSoumettreOpen(false)}>
        <div className="card modal" style={{ position: "fixed", margin: 0, left: soumPos?.x ?? 8, top: soumPos?.y ?? 8 }} onClick={(e) => e.stopPropagation()}>
          <div className="card-title modal-title" onPointerDown={startCenterDrag(setSoumPos)} style={{ cursor: "grab", touchAction: "none" }}>
            <span>Soumettre</span>
            <button type="button" className="icon-btn danger" onClick={() => setSoumettreOpen(false)} title="Fermer" aria-label="Fermer">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
            </button>
          </div>
          <div className="card-body modal-body">
            <span className={"badge" + (nbErreurs ? " error" : "")}>
              {nbErreurs === 0 ? "Configuration valide" : `${nbErreurs} erreur(s)`}
            </span>
            <div className="mesinfos-actions">
              <button
                className="btn primary"
                onClick={soumettre}
                disabled={submitting || !session?.loggedIn}
                title={session?.loggedIn ? "Avertir l'architecte (dev@baracca.fr) que ce dossier est prêt à être examiné" : "Connectez-vous pour soumettre"}
              >
                {submitting ? "Envoi…" : "Soumettre"}
              </button>
            </div>
          </div>
        </div>
      </div>
      , document.body)}
      {sauvOpen && createPortal(
      <div className="modal-overlay center" onClick={() => setSauvOpen(false)}>
        <div className="card modal" style={{ position: "fixed", margin: 0, left: sauvPos?.x ?? 8, top: sauvPos?.y ?? 8 }} onClick={(e) => e.stopPropagation()}>
          <div className="card-title modal-title" onPointerDown={startCenterDrag(setSauvPos)} style={{ cursor: "grab", touchAction: "none" }}>
            <span>Sauvegardes</span>
            <button type="button" className="icon-btn danger" onClick={() => setSauvOpen(false)} title="Fermer" aria-label="Fermer">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
            </button>
          </div>
          <div className="card-body modal-body">
            {session && session.loggedIn ? (
              <div className="account-box">
                <div className="account-head">
                  <strong>Mes configurations</strong>
                  <span className="account-user" title="Login de connexion">
                    {session.user.email}
                  </span>
                </div>
                <div className="save-row">
                  <input
                    type="text"
                    placeholder={d.nom || "Nom de la configuration"}
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                  />
                  <button className="btn small" onClick={enregistrer}>Enregistrer cette configuration</button>
                </div>
                {configMsg && <div className="field-error" style={{ color: "#059669" }}>{configMsg}</div>}
                {configs.length > 0 ? (
                  <ul className="config-list">
                    {configs.map((c) => (
                      <li key={c.id} className="config-row">
                        <div>
                          <strong>{c.nom}</strong>
                          <span className="config-date">modifiée le {c.updated}</span>
                        </div>
                        <div className="config-actions">
                          <button className="btn small" onClick={() => chargerConfig(c.id)}>Charger</button>
                          <button className="btn ghost small" onClick={() => supprimerConfig(c.id)}>Supprimer</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="config-empty">Aucune configuration enregistrée pour le moment.</p>
                )}
                <p className="config-hint">
                  Retrouvez aussi vos configurations sur <a href="/compte.php" target="_blank">votre espace client</a>.
                </p>
              </div>
            ) : session ? (
              <div className="account-box">
                <strong>Enregistrement et soumission réservés aux comptes clients</strong>
                <p className="config-hint">
                  <a href="/inscription.php" target="_blank">Créer un compte</a> ou{" "}
                  <a href="/connexion.php" target="_blank">se connecter</a> pour enregistrer
                  vos configurations et les soumettre à Baracca.
                </p>
              </div>
            ) : null}
            {flash && <div className="field-error" style={{ marginBottom: 8, color: "#059669" }}>{flash}</div>}
            <div className="chiffrage-row" style={{ marginTop: 8 }}>
              <span className="k">Dernière sauvegarde</span>
              <span className="v">{lastConfig ? `${lastConfig.nom} — ${lastConfig.updated}` : "Aucune"}</span>
            </div>
          </div>
        </div>
      </div>
      , document.body)}
      <div className="stage" ref={stageRef} style={{ height: stageH }}>
        <div className="panel" ref={(el) => { panelRefs.current.plan = el; }} style={{ left: panels.plan.x, top: panels.plan.y }}>
          <div className="panel-handle panel-fixed" title="Plan (fixé en haut à gauche)">
            <span className="panel-title" style={{ position: "relative", top: "10px" }}>Plan</span>
            <span className="zoom-ctl" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="btn small" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Réduire le plan">−</button>
              <span className="zoom-val">{Math.round(zoom * 100)} %</span>
              <button type="button" className="btn small" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="Agrandir le plan">+</button>
            </span>
          </div>
          <div className="panel-sub">
            <div className="panel-sub-col">
              <span className="panel-hint big">cliquez un mur ou la toiture pour effectuer des modifications</span>
              <span className="legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: "#2563eb" }}>+</span> ajout de module</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: "#dc2626" }}>×</span> suppression de module</span>
              </span>
            </div>
            <Rosace size={72} />
          </div>
          <div className="panel-canvas" style={{ height: panels.plan.h }}>
            <Plan d={d} murs={env.murs} charpente={charpenteSel} toitType={toitType} selectedFace={selectedFace} planSel={planSel} selInst={d.selInst}
            w={effW("plan")} h={panels.plan.h} zoom={zoom}
            cumul={{ longueur: spanXm(d, env), largeur: spanYm(d, env), plancher: surfacePlancher(d, env) }}
            dimsOf={dimsOfInst}
            onSelectFace={(iid, f, ev) => { setSelectedFace(f); setPlanSel(f); setD((prev) => ({ ...prev, selInst: iid })); setMurOpen(true); if (ev) setPopPos({ x: ev.clientX, y: ev.clientY }); }}
            pents={pentsAll}
            selPent={selPent}
            onSelectPent={(iid, v, ev) => { setPlanSel("toiture"); setSelPent({ instId: iid, versant: v }); setMurOpen(true); if (ev) setPopPos({ x: ev.clientX, y: ev.clientY }); }}
            onAddSide={openAddPick}
            onRemoveInst={removeInstance} />
          </div>
            {addPick && (
            <div className="modal-overlay" onClick={() => setAddPick(null)}>
            <div className="card modal" style={popStyle} onClick={(e) => e.stopPropagation()}>
              <div className="card-title modal-title" onPointerDown={startPopDrag} style={{ cursor: popPos ? "grab" : undefined, touchAction: "none" }}>
                <span>Ajouter un module au côté « {addPick.side} »</span>
                <button type="button" className="icon-btn danger" onClick={() => setAddPick(null)} title="Annuler" aria-label="Annuler">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                </button>
              </div>
              <div className="card-body modal-body">
                <p className="config-hint" style={{ marginTop: 0 }}>
                  Le côté commun doit faire {fmtCm(addSharedLen())} cm — seuls les modèles compatibles sont proposés.
                  Le module ajouté hérite de l'isolation, de la forme et de la charpente des réglages généraux.
                </p>
                {addCandidates().length === 0 ? (
                  <p className="config-hint">Aucun modèle compatible avec ce côté commun.</p>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {addCandidates().map((m) => (
                      <button key={m.id} type="button" className="btn small" onClick={() => doAdd(m.id)}>
                        {m.nom} — {fmtCm(+m.longueur)} × {fmtCm(+m.largeur)} cm{m.defaut ? " (défaut)" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
            )}
          <div className="panel-resize" onPointerDown={(e) => startResize(e, "plan", true, false)} title="Agrandir/réduire en hauteur (zoom)" />
        </div>
        <div className="panel" ref={(el) => { panelRefs.current.elev = el; }} style={{ left: panels.elev.x, top: panels.elev.y }}>
          <div className="panel-handle panel-fixed" title="Façades (fixé sous le Plan)">
            <span className="panel-title">Façades</span>
          </div>
            <div className="panel-sub panel-sub-col" style={{ marginBottom: 10, alignItems: "flex-start" }}>
              <span className="panel-hint big">choisissez votre façade</span>
              <span className="panel-hint">cliquez une face sur le plan, ou un quart de la rosace</span>
              <Rosace size={88} active={selectedFace} onPick={(k) => {
                setSelectedFace(k); setPlanSel(k);
                const f = frontInstFor(k); // la rosace sélectionne le module le plus proche de la façade
                if (f) setD((prev) => ({ ...prev, selInst: f.id }));
              }} />
            </div>
          <div className="panel-canvas" style={{ height: panels.elev.h }}>
            <Elevation d={d} murs={env.murs} planchers={env.planchers} surfaces={env.facades} interieurs={env.interieurs} couvertures={couvListOf(env)} charpente={charpenteSel} toiture={toitureDef} toitType={toitType} faceKey={selectedFace} faceData={face} dims={dmSel} insts={elevInsts.list} bbox={elevInsts.b} depM={depToitM} w={effW("elev")} h={panels.elev.h} onSelectPlancher={(ev) => { setPlancherPopOpen(true); if (ev) setPopPos({ x: ev.clientX, y: ev.clientY }); }} />
          </div>
          <div className="panel-resize" onPointerDown={(e) => startResize(e, "elev", true, false)} title="Agrandir/réduire en hauteur (zoom)" />
        </div>
        <div className="panel" ref={(el) => { panelRefs.current.vue3d = el; }} style={{ left: panels.vue3d.x, top: panels.vue3d.y }}>
          <div className="panel-handle panel-fixed" title="Vue 3D (fixée sous les Façades)">
            <span className="panel-title">Vue 3D</span>
          </div>
          <div className="panel-sub panel-sub-col" style={{ marginBottom: 10, alignItems: "flex-start" }}>
            <span className="panel-hint big">lecture seule</span>
            <span className="panel-hint">glisser = orbite, molette = zoom, clic droit = panoramique</span>
          </div>
          <div className="panel-canvas" style={{ height: panels.vue3d.h }}>
            <Suspense fallback={<p className="panel-hint" style={{ padding: 12 }}>Chargement de la vue 3D…</p>}>
              <Vue3D d={d} env={env} w={effW("vue3d")} h={panels.vue3d.h} />
            </Suspense>
          </div>
          <div className="panel-resize" onPointerDown={(e) => startResize(e, "vue3d", true, false)} title="Agrandir/réduire en hauteur (zoom)" />
        </div>
      </div>
      </div>
      <div className="side-col">
      {/* Bouton Soumettre en haut de la colonne de droite (niveau du plan) : clic = pop-up centrée */}
      <button type="button" className="action-btn action-btn-block" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const w = window.innerWidth || 1200; setSoumPos({ x: Math.max(8, Math.min((w - 400) / 2, w - 416)), y: r.bottom + 20 }); setSoumettreOpen(true); }} title="Ouvrir la fenêtre Soumettre">Soumettre</button>
      <div className={"card panel-card" + (reglagesOpen ? " deplie" : "")}>
        <div className="card-title card-toggle" onClick={() => setReglagesOpen((o) => !o)} title={reglagesOpen ? "Replier les réglages généraux" : "Ouvrir les réglages généraux"}>
          <span className={"carac-arrow" + (reglagesOpen ? " open" : "")}></span>
          Réglages généraux
        </div>
        <div className="card-body" style={reglagesOpen ? undefined : { paddingTop: 0 }}>
          <div className={"reglages-wrap" + (reglagesOpen ? "" : " grise")}>
          {reglagesOpen && (
          <>
          <div className="reglage-main">
          <Rubrique
            titre="Forme de toiture"
            hint="Forme de la toiture du module : monopente, deux pentes (pignon), quatre pentes (croupe) ou terrasse plate. La pente et le faitage s'ajustent automatiquement."
            ouvert={reglageOpen === "formes"}
            onToggle={() => setReglageOpen(reglageOpen === "formes" ? null : "formes")}
          >
            <div className="choix-list">
              {(env.formes || []).map((f) => (
                <Choix key={f.id}
                  checked={d.forme === f.id}
                  onChange={() => applyForme(f.id)}
                  image={f.image}
                  nom={f.nom}
                  detail={`${GEO_LABELS[f.geometrie] || f.geometrie || ""}${f.geometrie === "deuxpentes" ? ` — ${f.pente1 ?? f.pente}° / ${f.pente2 ?? f.pente}°` : f.geometrie && f.geometrie !== "terrasse" ? ` — ${f.pente}°` : ""}`}
                />
              ))}
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label>Débord de toiture (cm)</label>
              <input type="number" step="0.5" min="0" max="200"
                value={d.depassee ?? formeDef?.depassee ?? 30}
                onChange={(e) => set({ depassee: e.target.value === "" ? null : Math.max(0, Math.min(200, parseFloat(e.target.value) || 0)) })} />
              <span className="config-hint" style={{ marginTop: 0 }}>Débord de la toiture au-delà des murs (surface, élévations). 0 = aucun.</span>
            </div>
          </Rubrique>
          <Rubrique
            titre="Performance énergétique"
            hint="Regroupe le mur porteur, le plancher et la toiture : elle fixe les performances thermiques du module et le tarif de l'enveloppe."
            ouvert={reglageOpen === "isolation"}
            onToggle={() => setReglageOpen(reglageOpen === "isolation" ? null : "isolation")}
          >
            <div className="choix-list">
              {(env.isolations || []).map((iso) => (
                <Choix key={iso.id}
                  checked={d.isolation === iso.id}
                  onChange={() => applyIsolation(iso.id)}
                  image={iso.image}
                  nom={iso.nom}
                  detail={`${env.murs.find((x) => x.id === iso.mur)?.nom || "—"} / ${env.planchers.find((p) => p.id === iso.plancher)?.nom || "—"} / ${env.toitures.find((t) => t.id === iso.toiture)?.nom || "—"}`}
                />
              ))}
            </div>
          </Rubrique>
          <Rubrique
            titre="Autonomie"
            hint="Pack de systèmes autonomes (panneaux solaires, batterie, poêle, récupération d'eau…) : le coût du pack est la somme des coûts unitaires de ses systèmes."
            ouvert={reglageOpen === "autonomie"}
            onToggle={() => setReglageOpen(reglageOpen === "autonomie" ? null : "autonomie")}
          >
            <div className="choix-list">
              {(env.autonomies || []).map((a) => (
                <Choix key={a.id}
                  checked={d.autonomie === a.id}
                  onChange={() => applyAutonomie(a.id)}
                  image={a.image}
                  nom={a.nom}
                  detail={systemesOf(a).map((s) => s.nom).join(", ") || "—"}
                />
              ))}
            </div>
          </Rubrique>
          <Rubrique
            titre="Type de charpente"
            hint="Structure porteuse des côtés sans mur (côtés en charpente) : choisissez son type et son épaisseur."
            ouvert={reglageOpen === "charpente"}
            onToggle={() => setReglageOpen(reglageOpen === "charpente" ? null : "charpente")}
          >
            <div className="choix-list">
              {(env.charpentes || []).map((c) => (
                <Choix key={c.id}
                  checked={d.charpente === c.id}
                  onChange={() => applyCharpente(c.id)}
                  image={c.image}
                  nom={c.nom}
                  detail={`ép. ${fmtCm(+(c.epaisseur ?? 0.20))} cm${+c.tarif > 0 ? ` — ${fmtEur(c.tarif)} HT` : ""}`}
                />
              ))}
            </div>
          </Rubrique>
          </div>

              <hr className="sep" />
              <p className="section-label carac-toggle" onClick={() => setCaracOpen((o) => !o)}>
                <span className={"carac-arrow" + (caracOpen ? " open" : "")}></span>
                Caractéristiques techniques
              </p>
              {caracOpen && (
              <div className="spec">
                <div className="spec-row"><span className="spec-k">Longueur × largeur (cumul)</span><span className="spec-v">{fmtCm(spanXm(d, env))} × {fmtCm(spanYm(d, env))} cm — {nbInst(d)} module{nbInst(d) > 1 ? "s" : ""}</span></div>
                <div className="spec-row"><span className="spec-k">Hauteur sous plafond</span><span className="spec-v">{fmtCm(d.hauteur)} cm</span></div>
                <div className="spec-row">
                  <span className="spec-k">Toiture</span>
                  <span className="spec-v">{toitureNom} — ép. {fmtCm(+(toitureDef.epaisseur ?? 0.30))} cm</span>
                </div>
                <div className="spec-row">
                  <span className="spec-k">Forme de toiture</span>
                  <span className="spec-v">
                    {formeDef ? formeDef.nom : "—"}
                    {toitType !== "terrasse" && ` — ${GEO_LABELS[toitType] || toitType}`}
                    {toitType === "deuxpentes" && ` — pentes ${d.pente}° / ${d.pente2 ?? d.pente}°`}
                    {toitType !== "deuxpentes" && toitType !== "terrasse" && ` — pente ${d.pente}°`}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-k">Murs</span>
                  <span className="spec-v">{murSel?.nom || "—"}{surfaceSel ? ` — surface extérieure : ${surfaceSel.nom}` : ""}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-k">Plancher</span>
                  <span className="spec-v">{plancherSel?.nom || "—"}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-k">Charpente</span>
                  <span className="spec-v">{charpenteSel?.nom || "—"}</span>
                </div>
              </div>
              )}
          </>
          )}
          {/* partie basse toujours apparente, grisée quand la carte est repliée */}
          <div className="metrics">
            <div className="metric"><div className="k">Surface plancher</div><div className="v">{surfacePlancher(d, env).toFixed(1)} m²</div></div>
            <div className="metric"><div className="k">Emprise au sol</div><div className="v">{empriseAuSol(d, env, murSel || env.murs[0]).toFixed(1)} m²</div></div>
            <div className="metric"><div className="k">Surface toiture (cumul)</div><div className="v">{surfaceToitureTotale(d, env, toitType).toFixed(1)} m²</div></div>
            <div className="metric"><div className="k">Volume brut</div><div className="v">{volumeBrutOf(d, env).toFixed(1)} m³</div></div>
            <div className="metric"><div className="k">Surface des menuiseries</div><div className="v">{eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).reduce((s, e) => s + surfaceMenuiserie(e.a || {}) + surfaceMenuiserie(e.b || {}), 0).toFixed(2)} m²</div></div>
          </div>
          </div>
        </div>
      </div>

      {plancherPopOpen && (
      <div className="modal-overlay" onClick={() => setPlancherPopOpen(false)}>
      <div className="card modal" style={popStyle} onClick={(e) => e.stopPropagation()}>
        <div className="card-title modal-title" onPointerDown={startPopDrag} style={{ cursor: popPos ? "grab" : undefined, touchAction: "none" }}>
          <span>Plancher</span>
          <button type="button" className="icon-btn danger" onClick={() => setPlancherPopOpen(false)} title="Fermer" aria-label="Fermer">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
        <div className="card-body modal-body">
          <p className="config-hint" style={{ marginTop: 0 }}>
            Revêtements du plancher (cliquez sur le plancher d'une façade pour ouvrir cette fenêtre) :
            le dessus reprend un revêtement du catalogue « Intérieur », les chants un revêtement du catalogue « Extérieur ».
          </p>
          <div className="fields-grid">
            <RevetSelect label="Revêtement supérieur (catalogue « Intérieur »)"
              value={intIdOf(env, d.revetementPlancher, plancherSel?.revetement_sup)}
              onChange={(v) => setD((prev) => ({ ...prev, revetementPlancher: v }))}
              options={intListOf(env)} />
            <RevetSelect label="Revêtement des chants (catalogue « Extérieur »)"
              value={d.revetementChantPlancher ?? plancherSel?.revetement_chants ?? murSel?.surface ?? ""}
              onChange={(v) => setD((prev) => ({ ...prev, revetementChantPlancher: v }))}
              options={env.facades}
              defaultLabel={`Par défaut — ${surfaceNom(d.revetementChantPlancher ?? plancherSel?.revetement_chants ?? murSel?.surface ?? "")}`} />
          </div>
        </div>
      </div>
      </div>
      )}
      {murOpen && (
      <div className="modal-overlay" onClick={() => setMurOpen(false)}>
      <div className="card modal" style={popStyle} onClick={(e) => e.stopPropagation()}>
        <div className="card-title modal-title" onPointerDown={startPopDrag} style={{ cursor: popPos ? "grab" : undefined, touchAction: "none" }}>
          <span>{selIsToiture ? "Toiture" : `Mur ${selEdge?.numero ?? "?"}` + (face.actif ? "" : " (charpente)")}</span>
          <button type="button" className="icon-btn danger" onClick={() => setMurOpen(false)} title="Fermer" aria-label="Fermer">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
        <div className="card-body modal-body">
          {!selIsToiture && (
            <div className="fields-grid" style={{ marginBottom: 12 }}>
              <Field label="Nature du côté">
                <select
                  value={face.actif ? "mur" : "charpente"}
                  onChange={(e) => setEdgeActif(d.selInst, selectedFace, e.target.value === "mur")}
                >
                  <option value="mur">Mur</option>
                  <option value="charpente">Charpente (pas de mur sur ce côté)</option>
                </select>
              </Field>
              <Field label="Surface du mur">
                <span className="spec-v" style={{ alignSelf: "center", fontWeight: 600 }}>
                  {selMurDetail ? fmtM2(selMurDetail.area) : fmtM2(murArea)}
                  {selMurDetail && selMurDetail.areaInt != null ? ` (int. ${fmtM2(selMurDetail.areaInt)})` : ""}
                </span>
              </Field>
            </div>
          )}
          {!selIsToiture && !face.actif ? (
            <p style={{ fontSize: "0.85rem", color: "#78716c" }}>
              Charpente sur ce côté — pas de revêtement (basculez mur/charpente avec la pastille sur le plan).
            </p>
          ) : (
          <>
          <p className="section-label" style={{ marginTop: 0 }}>Revêtement</p>
          <p className="config-hint" style={{ marginTop: 0 }}>
            {selIsToiture
              ? "Revêtements appliqués à la toiture (catalogues « Toiture » et « Intérieur » du back-office)."
              : "Revêtements appliqués à ce mur (catalogues « Extérieur » et « Intérieur » du back-office)."}
          </p>
          <div className="fields-grid">
            {!selIsToiture && (
            <>
            <RevetSelect label="Revêtement extérieur"
              value={face.surface ?? murSel?.surface ?? ""}
              onChange={(v) => setFace(planSel, { surface: v })}
              options={env.facades}
              defaultLabel={`Par défaut — ${surfaceNom(face.surface ?? murSel?.surface ?? "")}`} />
            <RevetSelect label="Revêtement intérieur"
              value={face.surfaceInt ?? ""}
              onChange={(v) => setFace(planSel, { surfaceInt: v })}
              options={intListOf(env)}
              defaultLabel={`Par défaut — ${intNom(intIdOf(env, face.surfaceInt, murSel?.interieur))}`} />
            </>
            )}
            {selIsToiture && (
              // le pent cliqué sur le plan : revêtement de toiture + revêtement intérieur
              (() => {
                const p = selPent ? pentsAll.find((pp) => pp.instId === selPent.instId && pp.versant === selPent.versant) : null;
                if (!p) return <p className="config-hint">Cliquez un pent de toiture sur le plan pour choisir ses revêtements.</p>;
                return (
                  <div className="fields-grid">
                    <RevetSelect label={`Revêtement toiture — pent ${p.numero} (module ${p.instIndex}, ${p.versant}) — ${fmtM2(p.area)}`}
                      value={d.surfacesToiture?.[p.instId]?.[p.versant] ?? ""}
                      onChange={(v) => setD((prev) => ({
                        ...prev,
                        surfacesToiture: {
                          ...(prev.surfacesToiture || {}),
                          [p.instId]: { ...(prev.surfacesToiture?.[p.instId] || {}), [p.versant]: v },
                        },
                      }))}
                      options={couvListOf(env)}
                      defaultLabel={`Par défaut — ${couvNom(couvIdOf(env, null, toitureDef.couverture ?? toitureDef.surface))}`} />
                    <RevetSelect label={`Revêtement intérieur (sous-face) — pent ${p.numero}`}
                      value={d.surfacesIntToiture?.[p.instId]?.[p.versant] ?? ""}
                      onChange={(v) => setD((prev) => ({
                        ...prev,
                        surfacesIntToiture: {
                          ...(prev.surfacesIntToiture || {}),
                          [p.instId]: { ...(prev.surfacesIntToiture?.[p.instId] || {}), [p.versant]: v },
                        },
                      }))}
                      options={intListOf(env)}
                      defaultLabel={`Par défaut — ${intNom(intIdOf(env, d.surfacesIntToiture?.[p.instId]?.[p.versant], toitureDef.interieur))}`} />
                  </div>
                );
              })()
            )}
          </div>
          </>
          )}
          {!selIsToiture && (
          <>
          <hr className="sep" />
          <p className="section-label">Ouvrants</p>

              {face.actif && (
                <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" className="btn-add" onClick={ouvrirAjout} title="Rajouter un ouvrant">+</button>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>rajouter un ouvrant</span>
                </div>
              )}
              {addOpen && face.actif && (
                <div className="ouverture add-zone">
                  <div className="ouverture-main">
                    <div className="menuiserie-row">
                      <div className="fields-grid" style={{ flex: 1 }}>
                        <Field label="Ouvrant (catalogue)">
                          <select value={addMenuiserieId} onChange={(e) => setAddMenuiserieId(e.target.value)}>
                            {env.menuiseries?.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.nom} — {fmtCm(x.largeur)} × {fmtCm(x.hauteur)} cm{+x.tarif > 0 ? ` — ${fmtEur(x.tarif)} HT` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
                    <button type="button" className="btn primary small" onClick={validerAjout}>Valider</button>
                    <button type="button" className="icon-btn danger" onClick={() => setAddOpen(false)} title="Annuler" aria-label="Annuler">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                    </button>
                  </div>
                  {addError && <div className="field-error">{addError}</div>}
                </div>
              )}
              <hr className="sep" />
              {env.menuiseries && face.actif && (
                <p className="config-hint" style={{ marginTop: 0 }}>
                  Choisissez une menuiserie dans le catalogue (type, dimensions et tarif définis dans le
                  back-office), puis sa position sur le mur.
                </p>
              )}
              {face.actif ? (
                <div>
                  {face.ouvertures.map((o, i) => {
                    const m = env.menuiseries?.find((x) => x.id === o.menuiserieId);
                    return (
                    <div key={i} className="ouverture">
                      <div className="ouverture-main">
                      <div className="menuiserie-row">
                        {m?.image && <img src={m.image} alt={m.nom} className="menuiserie-thumb" />}
                        <div className="fields-grid" style={{ flex: 1 }}>
                          {env.menuiseries ? (
                            <Field label="Menuiserie (catalogue)">
                              <select value={o.menuiserieId || ""} onChange={(e) => pickMenuiserie(i, e.target.value)}>
                                <option value="">Ouverture sur mesure…</option>
                                {env.menuiseries.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.nom} — {fmtCm(x.largeur)} × {fmtCm(x.hauteur)} cm{+x.tarif > 0 ? ` — ${fmtEur(x.tarif)} HT` : ""}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : (
                            <Field label="Type">
                              <select value={o.type} onChange={(e) => updateOuverture(i, { type: e.target.value })}>
                                <option value="baie">Baie vitrée</option>
                                <option value="fenetre">Fenêtre</option>
                                <option value="porte">Porte</option>
                              </select>
                            </Field>
                          )}
                          {(!env.menuiseries || !o.menuiserieId) && (
                            <>
                              <Field label="Largeur (cm)">
                                <input type="number" step="0.1" value={Math.round(o.largeur * 1000) / 10}
                                  onChange={(e) => updateOuverture(i, { largeur: Math.round((+e.target.value || 0) * 10) / 1000 })} />
                              </Field>
                              <Field label="Hauteur (cm)">
                                <input type="number" step="0.1" value={Math.round(o.hauteur * 1000) / 10}
                                  onChange={(e) => updateOuverture(i, { hauteur: Math.round((+e.target.value || 0) * 10) / 1000 })} />
                              </Field>
                            </>
                          )}
                          <Field label="position sur le mur">
                            <div className="stepper">
                              <button type="button" className="btn small step-arrow"
                                disabled={o.position - POSITION_STEP < POSITION_MIN - 1e-9}
                                onClick={() => stepPosition(i, -1)} title="Déplacer vers la gauche" aria-label="Déplacer vers la gauche">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m0 0l6-6m-6 6l6 6"/></svg>
                              </button>
                              <button type="button" className="btn small step-arrow"
                                disabled={o.position + POSITION_STEP > positionMax(o) + 1e-9}
                                onClick={() => stepPosition(i, 1)} title="Déplacer vers la droite" aria-label="Déplacer vers la droite">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>
                              </button>
                            </div>
                          </Field>
                        </div>
                      </div>
                      <button className="icon-btn danger" onClick={() => removeOuverture(i)} title="Supprimer l'ouverture" aria-label="Supprimer l'ouverture">
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                      </button>
                      </div>
                      {!validerOuverture(d, dmSel, selectedFace, o) && (
                        <div className="field-error">
                          Position autorisée : entre {fmtCm(POSITION_MIN)} cm et {fmtCm(Math.max(0, murLongueurDm(dmSel, selectedFace) - o.largeur))} cm
                          depuis l'origine — l'ouverture ne doit dépasser ni le mur ({fmtCm(murLongueurDm(dmSel, selectedFace))} cm)
                          ni la hauteur ({fmtCm(dmSel.hauteur)} cm).
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "#78716c" }}>
                  Charpente sur ce côté — aucun ouvrant (basculez mur/charpente avec la pastille sur le plan).
                </p>
              )}
          </>
          )}
          {selIsToiture && pentSel && (
          <>
          <hr className="sep" />
          <p className="section-label">Fenêtres de toit — pent {pentSel.numero} (module {pentSel.instIndex}, {pentSel.versant})</p>

          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn-add" onClick={ouvrirAjoutFen} title="Rajouter une fenêtre de toit">+</button>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>rajouter une fenêtre de toit</span>
          </div>
          {addFenOpen && (
            <div className="ouverture add-zone">
              <div className="ouverture-main">
                <div className="menuiserie-row">
                  <div className="fields-grid" style={{ flex: 1 }}>
                    <Field label="Fenêtre de toit (catalogue)">
                      <select value={addFenId} onChange={(e) => setAddFenId(e.target.value)}>
                        {env.fenetresToit?.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nom} — {fmtCm(x.largeur)} × {fmtCm(x.hauteur)} cm{+x.tarif > 0 ? ` — ${fmtEur(x.tarif)} HT` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <button type="button" className="btn primary small" onClick={validerAjoutFen}>Valider</button>
                <button type="button" className="icon-btn danger" onClick={() => setAddFenOpen(false)} title="Annuler" aria-label="Annuler">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                </button>
              </div>
              {addFenError && <div className="field-error">{addFenError}</div>}
            </div>
          )}
          <p className="config-hint" style={{ marginTop: 0 }}>
            Choisissez une fenêtre de toit dans le catalogue (type, dimensions et tarif définis dans le
            back-office), puis sa position le long du bas de pente (pas de 60 cm). Sur le plan, le cadre
            en pointillé est placé à {FENETRE_TOIT_DEP_PX} px de la ligne directrice du bas de pente, et sa
            profondeur projetée tient compte de la pente du versant ({penteOfPent(d, toitType, pentSel.versant)}°).
          </p>
          <div>
            {fenetresPent.map((f, i) => {
              const m = env.fenetresToit?.find((x) => x.id === f.fenetreId);
              return (
              <div key={i} className="ouverture">
                <div className="ouverture-main">
                <div className="menuiserie-row">
                  {m?.image && <img src={m.image} alt={m.nom} className="menuiserie-thumb" />}
                  <div className="fields-grid" style={{ flex: 1 }}>
                    <Field label="Fenêtre de toit (catalogue)">
                      <select value={f.fenetreId || ""} onChange={(e) => pickFen(i, e.target.value)}>
                        <option value="">Fenêtre sur mesure…</option>
                        {env.fenetresToit?.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nom} — {fmtCm(x.largeur)} × {fmtCm(x.hauteur)} cm{+x.tarif > 0 ? ` — ${fmtEur(x.tarif)} HT` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="position le long du bas de pente">
                      <div className="stepper">
                        <button type="button" className="btn small step-arrow"
                          disabled={f.position - POSITION_STEP < POSITION_MIN - 1e-9}
                          onClick={() => stepFen(i, -1)} title="Déplacer vers le début du bas de pente" aria-label="Déplacer vers le début du bas de pente">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m0 0l6-6m-6 6l6 6"/></svg>
                        </button>
                        <button type="button" className="btn small step-arrow"
                          disabled={f.position + POSITION_STEP > fenPositionMax(f) + 1e-9}
                          onClick={() => stepFen(i, 1)} title="Déplacer vers la fin du bas de pente" aria-label="Déplacer vers la fin du bas de pente">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
                <button className="icon-btn danger" onClick={() => removeFen(i)} title="Supprimer la fenêtre de toit" aria-label="Supprimer la fenêtre de toit">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                </button>
                </div>
                {!validerFenetre(f) && (
                  <div className="field-error">
                    Position autorisée : entre {fmtCm(POSITION_MIN)} cm et {fmtCm(Math.max(0, basPenteLen - f.largeur))} cm
                    depuis le début du bas de pente ({fmtCm(basPenteLen)} cm).
                  </div>
                )}
              </div>
              );
            })}
          </div>
          </>
          )}
          {selIsToiture && !pentSel && (
            <p className="config-hint">Cliquez un pent de toiture sur le plan pour y poser des fenêtres de toit.</p>
          )}

        </div>
      </div>
      </div>
      )}
      <div className={"card panel-card" + (chiffrageCardOpen ? " deplie" : "")}>
        <div className="card-title card-toggle" onClick={() => setChiffrageCardOpen((o) => !o)} title={chiffrageCardOpen ? "Replier le chiffrage" : "Ouvrir le détail du chiffrage"}>
          <span className={"carac-arrow" + (chiffrageCardOpen ? " open" : "")}></span>
          Chiffrage estimatif
        </div>
        <div className="card-body" style={chiffrageCardOpen ? undefined : { padding: 0 }}>
          {chiffrageCardOpen && (
          <div className="chiffrage-lines">
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Murs</span><span className="chiffrage-surf">{fmtM2(surfaces.murs)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.mur)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setChiffrageOpen((o) => !o)}>
              <span className={"carac-arrow" + (chiffrageOpen ? " open" : "")}></span>
              Détail par mur
            </p>
            {chiffrageOpen && surfaces.mursDetail.map((m) => (
              <div className="chiffrage-item" key={m.key}>
                <div className="chiffrage-line">
                  <span className="chiffrage-left"><span className="chiffrage-k">{m.label}</span><span className="chiffrage-surf">ext. {fmtM2(m.area)} · int. {fmtM2(m.areaInt)}</span></span>
                  <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(m.amount)} HT</span></span>
                </div>
                <div className="chiffrage-sub"><span>{murSel?.nom || "Mur"} (isolation) — {fmtM2(m.area)}</span><span>{fmtEur(m.amountMur)} HT</span></div>
                {m.surfaceId && (
                  <div className="chiffrage-sub"><span>{surfaceNom(m.surfaceId)} (ext.) — {fmtM2(m.area)}</span><span>{fmtEur(m.amountExt)} HT</span></div>
                )}
                {m.surfaceIntId && (
                  <div className="chiffrage-sub"><span>{intNom(m.surfaceIntId)} (int.) — {fmtM2(m.areaInt)}</span><span>{fmtEur(m.amountInt)} HT</span></div>
                )}
              </div>
            ))}
            <div className="chiffrage-item">
              <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Plancher</span><span className="chiffrage-surf">{fmtM2(surfaces.plancher)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.plancher)} HT</span></div>
            </div>
            <p className="section-label carac-toggle" onClick={() => setPlancherOpen((o) => !o)}>
              <span className={"carac-arrow" + (plancherOpen ? " open" : "")}></span>
              Détail par module
            </p>
            {plancherOpen && (tarifs.plancherDetail || []).map((p) => (
              <div className="chiffrage-item" key={p.key}>
                <div className="chiffrage-line">
                  <span className="chiffrage-left"><span className="chiffrage-k">{p.label}</span><span className="chiffrage-surf">{fmtM2(p.area)}</span></span>
                  <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(p.amount)} HT</span></span>
                </div>
                <div className="chiffrage-sub"><span>{plancherSel?.nom || "Plancher"} — {fmtM2(p.area)}</span><span>{fmtEur(p.amountBase)} HT</span></div>
                {tarifs.plancherHautId && (
                  <div className="chiffrage-sub"><span>{intNom(tarifs.plancherHautId)} (dessus) — {fmtM2(p.area)}</span><span>{fmtEur(p.amountHaut)} HT</span></div>
                )}
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Complexe de toiture</span><span className="chiffrage-surf">{fmtM2(surfaces.toitureBase)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.toiture)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setPentsBaseOpen((o) => !o)}>
              <span className={"carac-arrow" + (pentsBaseOpen ? " open" : "")}></span>
              Détail par pent
            </p>
            {pentsBaseOpen && (tarifs.pents || []).map((p) => (
              <div className="chiffrage-item" key={"b" + p.numero}>
                <div className="chiffrage-line">
                  <span className="chiffrage-left"><span className="chiffrage-k">Pent {p.numero} (module {p.instIndex})</span><span className="chiffrage-surf">int. {fmtM2(p.areaBaseInt ?? p.areaBase ?? p.area)}</span></span>
                  <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(p.amountBase)} HT</span></span>
                </div>
                <div className="chiffrage-sub"><span>{toitureDef.nom} (structure) — {fmtM2(p.areaBase ?? p.area)}</span><span>{fmtEur(p.amountBaseStruct)} HT</span></div>
                {p.surfaceIntId && (
                  <div className="chiffrage-sub"><span>{intNom(p.surfaceIntId)} (sous-face) — {fmtM2(p.areaBaseInt ?? p.areaBase ?? p.area)}</span><span>{fmtEur(p.amountBaseInt)} HT</span></div>
                )}
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Couverture</span><span className="chiffrage-surf">{fmtM2(surfaces.toiture)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.couverture)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setPentsOpen((o) => !o)}>
              <span className={"carac-arrow" + (pentsOpen ? " open" : "")}></span>
              Détail par pent
            </p>
            {pentsOpen && (tarifs.pents || []).map((p) => (
              <div className="chiffrage-item" key={"c" + p.numero}>
                <div className="chiffrage-line">
                  <span className="chiffrage-left"><span className="chiffrage-k">Pent {p.numero} (module {p.instIndex})</span><span className="chiffrage-surf">{p.surfaceId ? `${couvNom(p.surfaceId)} — ` : ""}{fmtM2(p.area)}</span></span>
                  <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(p.amount)} HT</span></span>
                </div>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Ouvrants ({surfaces.ouvrants})</span></span><span className="chiffrage-v">{fmtEur(tarifs.menuiseries)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setOuvrantsOpen((o) => !o)}>
              <span className={"carac-arrow" + (ouvrantsOpen ? " open" : "")}></span>
              Détail par ouvrant
            </p>
            {ouvrantsOpen && (tarifs.ouvrantsDetail || []).map((o) => (
              <div className="chiffrage-line" key={o.key}>
                <span className="chiffrage-left"><span className="chiffrage-k">{o.label}</span><span className="chiffrage-surf">{o.nom} — {fmtCm(o.largeur)} × {fmtCm(o.hauteur)} cm, pos. {fmtCm(o.position)} cm</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(o.amount)} HT</span></span>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Fenêtres de toit ({surfaces.fenetresToit})</span></span><span className="chiffrage-v">{fmtEur(tarifs.fenetresToit)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setFenetresToitOpen((o) => !o)}>
              <span className={"carac-arrow" + (fenetresToitOpen ? " open" : "")}></span>
              Détail par fenêtre de toit
            </p>
            {fenetresToitOpen && (tarifs.fenetresToitDetail || []).map((f) => (
              <div className="chiffrage-line" key={f.key}>
                <span className="chiffrage-left"><span className="chiffrage-k">{f.label}</span><span className="chiffrage-surf">{f.nom} — {fmtCm(f.largeur)} × {fmtCm(f.hauteur)} cm, pos. {fmtCm(f.position)} cm</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(f.amount)} HT</span></span>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Charpente ({surfaces.charpentes})</span></span><span className="chiffrage-v">{fmtEur(tarifs.charpente)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setCharpenteOpen((o) => !o)}>
              <span className={"carac-arrow" + (charpenteOpen ? " open" : "")}></span>
              Détail par côté
            </p>
            {charpenteOpen && (tarifs.charpenteDetail || []).map((c) => (
              <div className="chiffrage-line" key={c.key}>
                <span className="chiffrage-left"><span className="chiffrage-k">{c.label}</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(c.amount)} HT</span></span>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Autonomie ({tarifs.autonomieNb ?? 0} système{(tarifs.autonomieNb ?? 0) > 1 ? "s" : ""})</span><span className="chiffrage-surf">{autoSel?.nom || "—"}</span></span><span className="chiffrage-v">{fmtEur(tarifs.autonomie)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setAutonomieOpen((o) => !o)}>
              <span className={"carac-arrow" + (autonomieOpen ? " open" : "")}></span>
              Détail par système
            </p>
            {autonomieOpen && (tarifs.autonomieDetail || []).map((a) => (
              <div className="chiffrage-line" key={a.id}>
                <span className="chiffrage-left"><span className="chiffrage-k">{a.nom}</span><span className="chiffrage-surf">{fmtCm(a.largeur)} × {fmtCm(a.hauteur)} cm</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(a.amount)} HT</span></span>
              </div>
            ))}
          </div>
          )}
          <div className={"chiffrage-total" + (chiffrageCardOpen ? "" : " solo")}>
            {/* Partie grisée du chiffrage : prix HT avant promotion, puis code promotion
                et montant de la réduction, trait fin de séparation avant le coût estimatif */}
            <div className="promo-band">
              <div className="chiffrage-row"><span className="k">Prix HT avant promotion</span><span className="v">{fmtEur(tarifs.total - tarifs.promo)} HT</span></div>
              <label htmlFor="promo-code-input">Promotion</label>
              <input id="promo-code-input" type="text" value={d.promoCode || ""} placeholder="CODE"
                onChange={(e) => set({ promoCode: e.target.value })} />
              <span className="config-hint">{promoHint}</span>
              {tarifs.promoInfo && (
              <div className="chiffrage-row promo-reduction">
                <span className="k">Réduction « {tarifs.promoInfo.code} » (−{tarifs.promoInfo.reduction} %)</span>
                <span className="v">{fmtEur(tarifs.promo)} HT</span>
              </div>
              )}
            </div>
            <div className="chiffrage-row"><span className="k">Coût estimatif</span><span className="v">{fmtEur(tarifs.total)} HT</span></div>
            <div className="chiffrage-row"><span className="k">TVA (20 %)</span><span className="v">{fmtEur(tarifs.total * 0.20)}</span></div>
            <div className="chiffrage-row total"><span className="k">Coût TTC</span><span className="v">{fmtEur(tarifs.total * 1.20)}</span></div>
          </div>
        </div>
      </div>
      </div>
      </div>

      <footer className="foot">
        Baracca × Archicad — données structurées pour l'API JSON Graphisoft + add-on Tapir.
      </footer>
    </div>
  );
}
