import React, { useEffect, useMemo, useRef, useState } from "react";

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
  forme: null, // forme de toiture choisie (catalogue « formes » : géométrie, pentes)
  charpente: null, // charpente choisie (catalogue « charpentes »)
  geometrie: null, // géométrie de la forme : monopente / deuxpentes / quatrepentes
  longueur: 6.0,
  largeur: 3.0,
  hauteur: 2.8,
  murType: "clt140",
  toiture: "monopente",
  pente: 15, // pente du versant 1 (monopente / quatre pentes : pente unique)
  pente2: null, // pente du versant 2 (deux pentes asymétriques)
  pignon: true,
  plancher: "clt_dalle",
  facade: "bardage_bois",
  surfaceToiture: null, // (ancien schéma) surface de toiture unique — migré vers surfacesToiture
  surfacesToiture: {}, // { [instId]: { [versant]: surfaceId|null } } — un revêtement par pent de chaque module
  // Modules placés côte à côte : chaque instance a une position absolue
  // (x, y en mètres, coin haut-gauche) et son propre modèle ; le module initial
  // en (0,0). Chaque instance a ses propres murs (actif = mur, sinon charpente)
  instances: [
    {
      id: "m0", x: 0, y: 0, moduleId: null,
      murs: {
        nord: { actif: true, ouvertures: [], surface: null }, // surface du mur (null = celle du type de mur)
        est: { actif: true, ouvertures: [], surface: null },
        sud: { actif: true, ouvertures: [], surface: null },
        ouest: { actif: true, ouvertures: [], surface: null },
      },
    },
  ],
  selInst: "m0", // instance sélectionnée (carte du mur / élévation)
};

/* ----- Modules multiples (positions absolues x/y en mètres) ----- */
const instOf = (d, id) => (d.instances || []).find((i) => i.id === id) || (d.instances || [])[0];
const modelMurs = (faces) =>
  Object.fromEntries(FACES.map((f) => [f.key, { actif: (faces?.[f.key] ?? "mur") === "mur", ouvertures: [], surface: null }]));
const bboxOf = (d, dmOf) => {
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
const dimsOf = (d, env, inst) => {
  const m = env.modules?.find((x) => x.id === (inst?.moduleId || d.moduleId)) || env.modules?.[0];
  return m
    ? { longueur: +m.longueur, largeur: +m.largeur, hauteur: +m.hauteur, faces: m.faces, nom: m.nom, id: m.id }
    : { longueur: d.longueur, largeur: d.largeur, hauteur: d.hauteur, faces: null, nom: null, id: d.moduleId };
};
// épaisseur du mur porteur (isolation choisie) — sert de gap entre les lignes
// directrices de deux modules adjacents (le mur commun occupe cet espace)
const epMurOf = (d, env) => +((env.murs.find((m) => m.id === d.murType) || env.murs[0])?.epaisseur ?? 0.14);
const spanXm = (d, env) => { const b = bboxOf(d, (i) => dimsOf(d, env, i)); return b.maxX - b.minX; }; // longueur cumulée
const spanYm = (d, env) => { const b = bboxOf(d, (i) => dimsOf(d, env, i)); return b.maxY - b.minY; }; // largeur cumulée
const nbInst = (d) => Math.max(1, d.instances?.length || 1);

/* Versants (pents) d'un module selon la géométrie de toiture */
const versantsOf = (toitType) =>
  toitType === "deuxpentes" ? ["nord", "sud"]
  : toitType === "quatrepentes" ? ["nord", "est", "sud", "ouest"]
  : toitType === "terrasse" ? ["toit"]
  : ["sud"]; // monopente : 1 versant (gouttière au sud)

/* Liste numérotée des pents de tous les modules (pour le chiffrage et la carte toiture) */
function pentsOf(d, env) {
  const toitType = toitTypeOf(d, env);
  const toiture = toitureDefOf(d, env);
  const epToit = +(toiture?.epaisseur ?? 0.30);
  const c1 = Math.cos((pente1Of(d) * Math.PI) / 180);
  const c2 = Math.cos((pente2Of(d) * Math.PI) / 180);
  const keys = versantsOf(toitType);
  const out = [];
  let n = 0;
  const insts = d.instances?.length ? d.instances : [{ id: "m0", moduleId: d.moduleId }];
  insts.forEach((inst, idx) => {
    const dm = dimsOf(d, env, inst);
    for (const v of keys) {
      n++;
      let area;
      if (toitType === "terrasse") area = (dm.longueur * dm.largeur) / keys.length;
      else if (toitType === "deuxpentes") area = dm.longueur * (dm.largeur / 2) / (v === "nord" ? c1 : c2) + dm.longueur * 2 * epToit;
      else if (toitType === "quatrepentes") area = surfaceToitureDm(dm, pente1Of(d), pente2Of(d), toitType) / 4 + (2 * epToit * (2 * dm.longueur + 2 * dm.largeur)) / 4;
      else area = dm.longueur * (dm.largeur / c1) + dm.longueur * 2 * epToit; // monopente
      out.push({
        numero: n, instId: inst.id, instIndex: idx + 1, versant: v, area,
        surfaceId: d.surfacesToiture?.[inst.id]?.[v] ?? toiture?.surface ?? "",
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
  const eps = 1e-6;
  const seen = new Set();
  let num = 0;
  const out = [];
  for (const inst of insts) {
    const dm = dmOf(inst);
    for (const f of FACES) {
      let nb = null, nface = null, key = null;
      if (f.key === "est") {
        const x = inst.x + dm.longueur + ep;
        nb = insts.find((j) => Math.abs(j.x - x) < eps && Math.abs(j.y - inst.y) < eps);
        if (nb) { key = `V${x},${inst.y}`; nface = "ouest"; }
      } else if (f.key === "ouest") {
        nb = insts.find((j) => Math.abs(j.x + dmOf(j).longueur + ep - inst.x) < eps && Math.abs(j.y - inst.y) < eps);
        if (nb) { key = `V${inst.x},${inst.y}`; nface = "est"; }
      } else if (f.key === "sud") {
        const y = inst.y + dm.largeur + ep;
        nb = insts.find((j) => Math.abs(j.y - y) < eps && Math.abs(j.x - inst.x) < eps);
        if (nb) { key = `H${inst.x},${y}`; nface = "nord"; }
      } else {
        nb = insts.find((j) => Math.abs(j.y + dmOf(j).largeur + ep - inst.y) < eps && Math.abs(j.x - inst.x) < eps);
        if (nb) { key = `H${inst.x},${inst.y}`; nface = "sud"; }
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
const epaisseurPlancher = (d, planchers) =>
  +((planchers.find((p) => p.id === d.plancher) || planchers[0])?.epaisseur ?? 0.20);

/* Élément de la rubrique « Toitures » référencé par le module (repli sur la
   recherche par type géométrique pour les anciennes configurations) */
const toitureDefOf = (d, env) =>
  env.toitures.find((t) => t.id === d.toiture)
  || env.toitures.find((t) => t.type === d.toiture)
  || env.toitures[0]
  || { id: "monopente", nom: "Monopente", type: "monopente", favori: "", epaisseur: 0.30, rgb: [120, 113, 108], surface: "" };
/* Forme de toiture choisie côté client (onglet « Formes », catalogue « formes » :
   géométrie + pentes) ; repli sur la forme référencée par l'ancien modèle */
const formeDefOf = (d, env) => {
  const mod = env.modules?.find((m) => m.id === d.moduleId);
  const formeId = d.forme || mod?.forme || null;
  return formeId ? env.formes?.find((f) => f.id === formeId) || null : null;
};

/* Géométrie de toiture effective : la forme du module prioritairement,
   sinon le type de l'élément toiture (rétro-compatibilité terrasse) */
const toitTypeOf = (d, env) =>
  d.geometrie || formeDefOf(d, env)?.geometrie || toitureDefOf(d, env).type || "monopente";

/* Pente du versant 2 en degrés (deux pentes asymétriques ; = pente sinon) */
const pente2Of = (d) => +(d.pente2 ?? d.pente ?? 15);
const pente1Of = (d) => +(d.pente ?? 15);

/* Versions « dims » (chaque instance de module a son propre modèle, donc ses
   propres longueur/largeur/hauteur) — pentes globales (forme des réglages) */
function surfaceToitureDm(dm, p1, p2, tt) {
  if (tt === "terrasse") return dm.longueur * dm.largeur;
  const c1 = Math.cos((p1 * Math.PI) / 180);
  if (tt === "deuxpentes") {
    // 2 versants de largeur/2, chacun selon sa propre pente
    const c2 = Math.cos((p2 * Math.PI) / 180);
    return dm.longueur * (dm.largeur / 2) * (1 / c1 + 1 / c2);
  }
  // monopente : 1 versant sur toute la largeur ; quatre pentes : projection / cos
  return dm.longueur * (dm.largeur / c1);
}

function hauteurFaitageDm(dm, p1, p2, tt) {
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
const PLANCHER_DEPASSEMENT = 0.217; // 21,7 cm de chaque côté
const SOL_SOUS_PLANCHER = 0.20;     // 20 cm

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
const rgbHex = (rgb) =>
  "#" + (Array.isArray(rgb) ? rgb : [158, 158, 158])
    .map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0"))
    .join("");
// mélange deux couleurs hexa (t = 0 -> c1, t = 1 -> c2) — utilisé pour griser
// les segments profonds des élévations
const mixHex = (c1, c2, t) => {
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
    const dm = dimsOf(d, env, e.inst); // dims du modèle de ce module
    const hF = hauteurFaitageDm(dm, p1, p2, toitType);
    const longueurExt = murLongueurDm(dm, e.face) + 2 * epMur; // épaisseurs aux 2 extrémités
    let area = longueurExt * dm.hauteur;
    // deux pentes = pignon : triangle de toiture sur est/ouest
    if (toitType === "deuxpentes" && (e.face === "est" || e.face === "ouest")) {
      const base = dm.largeur + 2 * epMur;
      const v1 = (base / 2) / c1, v2 = (base / 2) / c2;  // longueur des 2 versants (pentes propres)
      area += (base * hF) / 2 + (v1 + v2) * epToit;     // triangle du pignon + ép. toiture sur les 2 versants
    }
    // les ouvrants remplacent de la surface de mur
    const ouv = [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])];
    area -= ouv.reduce((ss, o) => ss + o.largeur * o.hauteur, 0);
    const surfaceId = e.a?.surface ?? murDef?.surface ?? "";
    const sd = env.facades.find((f) => f.id === surfaceId);
    const amount = (eurM2(murDef) + eurM2(sd)) * area; // (coût mur + coût surface) × surface du mur
    total += area;
    detail.push({
      key: e.edge || `${e.inst.id}-${e.face}`,
      numero: e.numero,
      label: `Mur ${e.numero}` + (e.edge ? " (partagé)" : ""),
      surfaceId, area, amount,
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
  const plancher = surfacePlancher(d, env); // cumul des surfaces entre 4 murs
  // surface toiture : cumul de tous les pents de tous les modules
  const pents = pentsOf(d, env);
  const toitureS = pents.reduce((s, p) => s + p.area, 0);
  const edges = eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env));
  const ouvrants = edges.reduce(
    (n, e) => n + (e.actif ? (e.a?.ouvertures.length || 0) + (e.b?.ouvertures.length || 0) : 0),
    0
  );
  // côtés passés en charpente (pas de mur) : comptés à l'unité
  const charpentes = edges.reduce((n, e) => n + (e.actif ? 0 : 1), 0);
  return { murs: M.total, mursDetail: M.detail, plancher, toiture: toitureS, pents, ouvrants, charpentes };
}

function tarifTotal(d, env) {
  const module = env.modules?.find((m) => m.id === d.moduleId);
  const mur = env.murs.find((m) => m.id === d.murType);
  const plancher = env.planchers.find((p) => p.id === d.plancher);
  const facade = env.facades.find((f) => f.id === d.facade);
  const toiture = toitureDefOf(d, env);
  const S = surfacesChiffrage(d, env);
  // Ouvrants : coût à l'unité (une unité par ouverture, murs actifs seulement)
  const menuiseries = eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).reduce(
    (s, e) => s + (e.actif
      ? [...(e.a?.ouvertures || []), ...(e.b?.ouvertures || [])].reduce((ss, o) => ss + tarifOuverture(o, env.menuiseries), 0)
      : 0),
    0
  );
  // murs : somme des montants par mur (coût mur + coût de la surface choisie × surface)
  const murAmount = S.mursDetail.reduce((s, m) => s + m.amount, 0);
  // toiture : par pent — (coût toiture + coût de la surface du pent) × surface du pent
  const toitureAmount = (S.pents || []).reduce((s, p) => {
    const sd = env.facades.find((f) => f.id === p.surfaceId);
    return s + (eurM2(toiture) + eurM2(sd)) * p.area;
  }, 0);
  // Charpente : coût unitaire de la charpente choisie (Réglages généraux) × nb de côtés en charpente
  const charpenteDef = env.charpentes?.find((c) => c.id === d.charpente);
  const charpenteAmount = (charpenteDef ? +charpenteDef.tarif || 0 : 0) * (S.charpentes || 0);
  const t = {
    module: module ? +module.tarif || 0 : 0,
    mur: murAmount,
    plancher: eurM2(plancher) * S.plancher,
    facade: facade ? +facade.tarif || 0 : 0,
    toiture: toitureAmount,
    menuiseries,
    charpente: charpenteAmount,
  };
  t.total = t.module + t.mur + t.plancher + t.facade + t.toiture + t.menuiseries + t.charpente;
  // détail par pent (numéro, surface, montant)
  t.pents = (S.pents || []).map((p) => ({
    ...p,
    amount: (eurM2(toiture) + eurM2(env.facades.find((f) => f.id === p.surfaceId))) * p.area,
  }));
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
    surface: (env.facades.find((f) => f.id === (face.surface ?? murDef.surface)) || env.facades[0]).nom, // surface choisie pour ce mur
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
        surface: (env.facades.find((f) => f.id === (d.surfaceToiture ?? toitureDef.surface)) || env.facades[0]).nom, // surface par défaut (rétro-compat)
        pents: pentsOf(d, env).map((p) => ({
          numero: p.numero, module: p.instIndex, versant: p.versant,
          surface: (env.facades.find((f) => f.id === p.surfaceId) || env.facades[0]).nom,
          surface_m2: +p.area.toFixed(2),
        })), // un revêtement par pent de chaque module
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
      volumeBrut: +insts.reduce((s, i) => { const dm = dimsOf(d, env, i); return s + dm.longueur * dm.largeur * dm.hauteur; }, 0).toFixed(2),
      // Ajout rétro-compatible : détail des tarifs (catalogue back-office)
      tarif: Object.fromEntries(
        Object.entries(tarifTotal(d, env)).filter(([k]) => k !== "pents").map(([k, v]) => [k, +v.toFixed(2)])
      ),
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
function pentParts(d, inst, dimsOf, pents, toitType, x, y, L, l) {
  const dm = dimsOf(inst);
  const cx = x + L / 2, cy = y + l / 2;
  const num = (v) => pents.find((p) => p.instId === inst.id && p.versant === v)?.numero ?? "?";
  if (toitType === "deuxpentes") {
    const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
    const hF = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
    const run1 = t1 > 0 ? Math.min(Math.max(hF / t1, 0), dm.largeur) : dm.largeur / 2;
    const yr = y + (run1 / dm.largeur) * l; // faitage (peut être décalé si asymétrique)
    return [
      { versant: "nord", numero: num("nord"), points: `${x},${y} ${x + L},${y} ${x + L},${yr} ${x},${yr}` },
      { versant: "sud", numero: num("sud"), points: `${x},${yr} ${x + L},${yr} ${x + L},${y + l} ${x},${y + l}` },
    ];
  }
  if (toitType === "quatrepentes") {
    return [
      { versant: "nord", numero: num("nord"), points: `${x},${y} ${x + L},${y} ${cx},${cy}` },
      { versant: "sud", numero: num("sud"), points: `${x},${y + l} ${x + L},${y + l} ${cx},${cy}` },
      { versant: "ouest", numero: num("ouest"), points: `${x},${y} ${x},${y + l} ${cx},${cy}` },
      { versant: "est", numero: num("est"), points: `${x + L},${y} ${x + L},${y + l} ${cx},${cy}` },
    ];
  }
  // monopente / terrasse : un seul versant
  const v = toitType === "terrasse" ? "toit" : "sud";
  return [{ versant: v, numero: num(v), points: `${x},${y} ${x + L},${y} ${x + L},${y + l} ${x},${y + l}` }];
}

/* =================================================================
   Plan SVG (vue de dessus)
================================================================= */
function Plan({ d, murs, toitType, selectedFace, planSel, selInst, cumul, dimsOf, pents, selPent, onSelectFace, onSelectPent, onAddSide, onRemoveInst, w, h, zoom }) {
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
  const edges = eachEdge(d, dimsOf, murDef.epaisseur).map((e) => ({ ...e, shared: !!e.edge }));
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
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" stroke="#c8b8a5" strokeWidth="1" />
        </pattern>
      </defs>
      {/* lignes directrices (intérieures) de chaque module + zone toiture cliquable */}
      {insts.map((inst) => (
        <rect key={inst.id} x={X(inst.x)} y={Y(inst.y)} width={Lof(inst)} height={lof(inst)}
          fill="#faf7f2" stroke="#57534e" strokeWidth="1" strokeDasharray="6 4" />
      ))}
      {/* pents de toiture cliquables : un clic affiche le pent cliqué dans la carte */}
      {onSelectPent && insts.map((inst) => {
        const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
        return pentParts(d, inst, dimsOf, pents, toitType, x, y, L, l).map((pp) => (
          <polygon key={pp.versant}
            points={pp.points}
            fill={planSel === "toiture" && selPent?.instId === inst.id && selPent?.versant === pp.versant ? "rgba(180,83,9,0.14)" : "transparent"}
            stroke="none"
            style={{ cursor: "pointer" }}
            title={`Pent ${pp.numero} (${pp.versant})`}
            onClick={() => onSelectPent(inst.id, pp.versant)}
          />
        ));
      })}
      {/* faitage de chaque module */}
      {insts.map((inst) => {
        const dm = dimsOf(inst);
        if (toitType === "deuxpentes") {
          const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
          const hFm = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
          const run1 = t1 > 0 ? Math.min(Math.max(hFm / t1, 0), dm.largeur) : dm.largeur / 2;
          const yRidge = Y(inst.y) + run1 * scale;
          return (
            <line key={inst.id} x1={X(inst.x)} y1={yRidge} x2={X(inst.x) + Lof(inst)} y2={yRidge}
              stroke="#b45309" strokeWidth="2" strokeDasharray="7 5" />
          );
        }
        if (toitType === "quatrepentes") {
          const x = X(inst.x), y = Y(inst.y), L = Lof(inst), l = lof(inst);
          return (
            <g key={inst.id} stroke="#b45309" strokeWidth="1.5" strokeDasharray="4 4">
              <line x1={x + l / 2} y1={y + l / 2} x2={x + L - l / 2} y2={y + l / 2} strokeWidth="2" strokeDasharray="7 5" />
              <line x1={x} y1={y} x2={x + l / 2} y2={y + l / 2} />
              <line x1={x + L} y1={y} x2={x + L - l / 2} y2={y + l / 2} />
              <line x1={x} y1={y + l} x2={x + l / 2} y2={y + l / 2} />
              <line x1={x + L} y1={y + l} x2={x + L - l / 2} y2={y + l / 2} />
            </g>
          );
        }
        return null;
      })}
      {/* murs (arêtes, avec angles aux jonctions) */}
      {rects.map(({ e, ...p }, i) => {
        const isSel = selInst === e.inst.id && selectedFace === e.face && planSel !== "toiture";
        const f = FACES.find((x) => x.key === e.face);
        const lp = labelPos(e);
        return (
          <g key={i} onClick={() => onSelectFace(e.inst.id, e.face)} style={{ cursor: "pointer" }}>
            <rect
              x={p.x} y={p.y} width={p.w} height={p.h}
              fill={e.actif ? rgbHex(murDef.rgb) : "#e5e5e5"}
              stroke={isSel ? "#b45309" : "#78716c"}
              strokeWidth={isSel ? 3 : e.actif ? 1 : 2}
              strokeDasharray={e.actif ? undefined : "5 4"}
            />
            {!e.actif && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="url(#hatch)" />}
            {e.actif && (e.a?.ouvertures || []).map((o, j) => {
              const ow = o.largeur * scale;
              const oh = Math.max(ep + 8, 14);
              const ox = p.horiz ? X(e.inst.x) + o.position * scale : p.x + (p.w - oh) / 2;
              const oy = p.horiz ? p.y + (p.h - oh) / 2 : Y(e.inst.y) + o.position * scale;
              return (
                <rect key={j} x={ox} y={oy}
                  width={p.horiz ? ow : oh} height={p.horiz ? oh : ow}
                  fill={o.type === "porte" ? "#7c2d12" : "#0284c7"} opacity="0.85" rx="2" />
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
          <g key={`${b.inst.id}-${b.side}`} onClick={() => onAddSide(b.inst.id, b.side)}
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
function Elevation({ d, murs, planchers, surfaces, toiture, toitType, faceKey, faceData, dims, w, h, insts, bbox }) {
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
  const epToitPx = epToit * scale;                // épaisseur de la toiture en px
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
  // path de toiture d'un segment
  const toitOf = (x0s, Ls, yTop, hF, dm) => {
    const xaS = x0s - epPx, xbS = x0s + Ls + epPx;
    if (toitType === "terrasse") return { path: `M ${xaS} ${yTop} L ${xbS} ${yTop}`, fill: "none", dash: null, cote: false };
    if (toitType === "monopente") {
      if (horiz) return { path: `M ${xaS} ${yTop} L ${xbS} ${yTop} M ${xaS} ${yTop - hF} L ${xbS} ${yTop - hF}`, fill: "none", dash: "8 5", cote: true };
      return { path: faceKey === "ouest" ? `M ${xaS} ${yTop - hF} L ${xbS} ${yTop}` : `M ${xaS} ${yTop} L ${xbS} ${yTop - hF}`, fill: "none", dash: null, cote: false };
    }
    if (horiz && toitType === "quatrepentes") {
      const rx1 = x0s + (dm.largeur / 2) * scale, rx2 = x0s + Ls - (dm.largeur / 2) * scale;
      return { path: `M ${xaS} ${yTop} L ${rx1} ${yTop - hF} L ${rx2} ${yTop - hF} L ${xbS} ${yTop}`, fill: "rgba(180,83,9,0.15)", dash: null, cote: false };
    }
    if (horiz) return { path: `M ${xaS} ${yTop} L ${xbS} ${yTop} M ${xaS} ${yTop - hF} L ${xbS} ${yTop - hF}`, fill: "none", dash: "8 5", cote: true };
    // est/ouest : pan triangulaire (pignon deux pentes, ou pan de croupe)
    const t1 = Math.tan((pente1Of(d) * Math.PI) / 180);
    const hFm = hauteurFaitageDm(dm, pente1Of(d), pente2Of(d), toitType);
    const run1 = t1 > 0 ? Math.min(Math.max(hFm / t1, 0), dm.largeur) : dm.largeur / 2;
    const apexX = miroir ? x0s + Ls - run1 * scale : x0s + run1 * scale;
    return { path: `M ${xaS} ${yTop} L ${apexX} ${yTop - hF} L ${xbS} ${yTop} Z`, fill: "rgba(180,83,9,0.15)", dash: null, cote: false };
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
    return { ...s, x0s, Ls, hM, hF, yTop: yPlancher - hM, toit: toitOf(x0s, Ls, yPlancher - hM, hF, s.dm) };
  });
  placed.sort((a, c) => (c.depth ?? 0) - (a.depth ?? 0));
  // profondeur relative (0 = le plus proche de la face) pour griser les segments au fond
  const maxDepth = Math.max(0, ...placed.map((s) => s.depth ?? 0));
  const ox = (o, seg) => seg.x0s + (miroir ? seg.Ls - (o.position + o.largeur) * scale : o.position * scale);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      <line x1={20} y1={ySol} x2={W - 20} y2={ySol} stroke="#a8a29e" strokeWidth="2" />
      {/* plancher continu : ligne directrice en haut (bas des murs), épaisseur vers le bas,
          bords à 21,7 cm au-delà de la ligne directrice des murs */}
      <rect x={pa} y={yPlancher} width={L + 2 * depPx} height={epPxP}
        fill="#e7e5e4" stroke="#78716c" />
      <line x1={pa} y1={yPlancher} x2={pb} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
      <defs>
        {placed.map((seg, i) => {
          const sd = surfaceOf(seg.face);
          return sd?.image ? (
            <pattern key={i} id={`murSurf-${i}`} patternUnits="userSpaceOnUse" x={seg.x0s - epPx} y={seg.yTop} width={seg.Ls + 2 * epPx} height={seg.hM}>
              <image href={sd.image} x={seg.x0s - epPx} y={seg.yTop} width={seg.Ls + 2 * epPx} height={seg.hM} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ) : null;
        })}
      </defs>
      {placed.map((seg, i) => {
        const sd = surfaceOf(seg.face);
        const t = maxDepth ? (seg.depth ?? 0) / maxDepth : 0; // 0 = devant, 1 = fond
        return (
          <g key={seg.inst?.id || i} opacity={1 - 0.4 * t}>
            {/* mur du segment (ligne directrice intérieure, épaisseur vers l'extérieur) ;
                grisé selon la profondeur pour accentuer l'effet de profondeur */}
            <rect x={seg.x0s - epPx} y={seg.yTop} width={seg.Ls + 2 * epPx} height={seg.hM}
              fill={sd?.image ? `url(#murSurf-${i})` : mixHex(rgbHex(murDef.rgb), "#a8a29e", 0.7 * t)} opacity="0.85" stroke="#78716c" />
            <line x1={seg.x0s} y1={seg.yTop} x2={seg.x0s} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
            <line x1={seg.x0s + seg.Ls} y1={seg.yTop} x2={seg.x0s + seg.Ls} y2={yPlancher} stroke="#57534e" strokeWidth="1" strokeDasharray="5 4" />
            {seg.face?.actif && seg.face.ouvertures.map((o, j) => (
              <rect key={j} x={ox(o, seg)} y={yPlancher - o.hauteur * scale}
                width={o.largeur * scale} height={o.hauteur * scale}
                fill={o.type === "porte" ? "#7c2d12" : "#0284c7"} opacity="0.85" rx="2" />
            ))}
            {/* toiture du segment : bande d'épaisseur AU-DESSUS de sa ligne directrice (en bas) */}
            <g transform={`translate(0 ${-epToitPx / 2})`}>
              <path d={seg.toit.path} stroke={mixHex(rgbHex(toitRgb), "#a8a29e", 0.7 * t)} strokeWidth={Math.max(epToitPx, 3)} fill={seg.toit.fill} strokeDasharray={seg.toit.dash} strokeLinejoin="round" />
            </g>
            {!seg.face?.actif && (
              <text x={seg.x0s + seg.Ls / 2} y={seg.yTop + seg.hM / 2} textAnchor="middle" fill="#a8a29e" fontSize="11">Charpente (pas de mur)</text>
            )}
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
  const [tabGen, setTabGen] = useState("isolation");
  const [addPick, setAddPick] = useState(null); // { instId, side } : choix du modèle à ajouter via le + du plan
  const [chiffrageCardOpen, setChiffrageCardOpen] = useState(false); // carte Chiffrage réduite par défaut (bande grise seule)
  const [sauvOpen, setSauvOpen] = useState(false); // carte Sauvegardes fermée par défaut
  const [reglagesOpen, setReglagesOpen] = useState(false); // conteneurs de la première ligne repliés au démarrage
  const [soumettreOpen, setSoumettreOpen] = useState(false);
  const [murOpen, setMurOpen] = useState(false); // pop-up Mur/Toiture : ouverte uniquement au clic sur le plan
  const [flash, setFlash] = useState("");
  const [caracOpen, setCaracOpen] = useState(false); // zone « Caractéristiques techniques » fermée par défaut
  const [chiffrageOpen, setChiffrageOpen] = useState(false); // détail par mur du chiffrage, fermé par défaut
  const [pentsOpen, setPentsOpen] = useState(false); // détail par pent de toiture, fermé par défaut
  const [addOpen, setAddOpen] = useState(false);     // zone d'ajout d'un ouvrant (sous le +)
  const [addMenuiserieId, setAddMenuiserieId] = useState("");
  const [addError, setAddError] = useState("");

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
    plan: { x: 10, y: 10, w: 5000, h: 420 },
    elev: { x: 10, y: 490, w: 5000, h: 340 },
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
    setStageH(Math.max(max + 24, 320));
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
  // Quand le plan bouge (drag/resize) et chevauche l'élévation, on pousse
  // l'élévation juste en dessous du plan (10 px) : les deux restent « collés »
  const resolveOverlap = (ps) => {
    const A = ps.plan, B = ps.elev;
    if (!A || !B) return ps;
    const hA = A.h + 52, hB = B.h + 52; // hauteur panneau ≈ canvas + barre de titre + marge
    const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + hB && B.y < A.y + hA;
    if (!overlap) return ps;
    const stageW = stageRef.current?.clientWidth ?? 1100;
    return { ...ps, elev: clampPanel({ ...B, y: A.y + hA + 10 }, stageW) };
  };
  // En dessous de 820 px, les panneaux sont empilés en pleine largeur : pas de drag/resize
  const isMobileLayout = () => window.innerWidth <= 820;
  // Déplacement d'un panneau par sa barre de titre (pointer events globaux)
  const startDrag = (e, key) => {
    if (e.button !== 0 || isMobileLayout()) return;
    e.preventDefault();
    const stageW = stageRef.current?.clientWidth ?? 1100;
    const start = { cx: e.clientX, cy: e.clientY, x: panels[key].x, y: panels[key].y };
    const move = (ev) => {
      if (!dragMovedRef.current && Math.hypot(ev.clientX - start.cx, ev.clientY - start.cy) > 5) dragMovedRef.current = true;
      setPanels((prev) => {
        const next = { ...prev, [key]: clampPanel({ ...prev[key], x: start.x + ev.clientX - start.cx, y: start.y + ev.clientY - start.cy }, stageW) };
        return key === "plan" ? resolveOverlap(next) : next;
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
  // Redimensionnement par la poignée en coin bas-droit (withH = hauteur aussi, sinon largeur seule)
  const startResize = (e, key, withH = true) => {
    if (e.button !== 0 || isMobileLayout()) return;
    e.preventDefault();
    e.stopPropagation();
    const stageW = stageRef.current?.clientWidth ?? 1100;
    const start = { cx: e.clientX, cy: e.clientY, w: panels[key].w, h: panels[key].h };
    const move = (ev) => {
      setPanels((prev) => {
        const next = { ...prev, [key]: clampPanel(
          { ...prev[key], w: start.w + ev.clientX - start.cx, ...(withH ? { h: start.h + ev.clientY - start.cy } : {}) },
          stageW
        ) };
        return key === "plan" ? resolveOverlap(next) : next;
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
    facades: catalogue?.enveloppe?.surfaces?.length ? catalogue.enveloppe.surfaces : FACADES,
    menuiseries: catalogue?.menuiseries?.length ? catalogue.menuiseries : null,
    modules: catalogue?.modules?.length ? catalogue.modules : null,
    isolations: catalogue?.isolation?.length ? catalogue.isolation : ISOLATIONS,
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
  const murSel = env.murs.find((m) => m.id === d.murType);
  const moduleSel = env.modules?.find((m) => m.id === d.moduleId);
  const isoSel = env.isolations?.find((x) => x.id === d.isolation);
  const charpenteSel = env.charpentes?.find((x) => x.id === d.charpente);
  const surfaceSel = env.facades.find((f) => f.id === murSel?.surface) || env.facades[0];
  const surfaceNom = (id) => env.facades.find((f) => f.id === id)?.nom || "—";
  const plancherSel = env.planchers.find((p) => p.id === d.plancher);
  const json = useMemo(() => JSON.stringify(buildExport(d, env), null, 2), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const tarifs = useMemo(() => tarifTotal(d, env), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const surfaces = useMemo(() => surfacesChiffrage(d, env), [d, catalogue]); // eslint-disable-line react-hooks/exhaustive-deps
  const pentsAll = pentsOf(d, env); // pents numérotés de tous les modules
  // Modules affichés en élévation pour la face choisie : tous les modules,
  // avec leur profondeur par rapport à la face (pour l'occlusion) et la bbox
  // de l'ensemble (pour la projection horizontale de la façade)
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
    const list = insts.map((inst) => ({
      inst,
      dm: dimsOf(d, env, inst),
      face: inst.murs?.[selectedFace] || { actif: true, ouvertures: [], surface: null },
      depth: depth(inst),
    }));
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

  /* Clic sur un + du plan : ouvre le choix du modèle à ajouter. Le côté commun
     doit avoir la même longueur -> on ne propose que les modèles compatibles. */
  const openAddPick = (instId, side) => setAddPick({ instId, side });
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

  // Carte « Réglages généraux » : Module, Isolation, Formes, Charpente
  // (la carte du mur cliqué regroupe ensuite Revêtement + Ouvrants)
  // Carte « Réglages généraux » : Isolation, Formes, Charpente (le module par
  // défaut est appliqué au chargement ; les modules suivants se rajoutent sur le plan)
  const tabsGeneraux = [["isolation", "Isolation"], ["formes", "Formes"], ["charpente", "Charpente"]];

  return (
    <div className="app">
      <div className="layout">
      <div className="stage" ref={stageRef} style={{ height: stageH }}>
        <div className="panel" ref={(el) => { panelRefs.current.plan = el; }} style={{ left: panels.plan.x, top: panels.plan.y, width: effW("plan") }}>
          <div className="panel-handle" onPointerDown={(e) => startDrag(e, "plan")} title="Glissez ce titre pour déplacer le panneau">
            <span>Plan du module</span>
            <span className="panel-hint">cliquez un mur ou la toiture — pastille pour basculer mur/charpente</span>
            <span className="zoom-ctl" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="btn small" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Réduire le plan">−</button>
              <span className="zoom-val">{Math.round(zoom * 100)} %</span>
              <button type="button" className="btn small" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="Agrandir le plan">+</button>
            </span>
          </div>
          <div className="panel-canvas" style={{ height: panels.plan.h }}>
            <Plan d={d} murs={env.murs} toitType={toitType} selectedFace={selectedFace} planSel={planSel} selInst={d.selInst}
            w={effW("plan")} h={panels.plan.h} zoom={zoom}
            cumul={{ longueur: spanXm(d, env), largeur: spanYm(d, env), plancher: surfacePlancher(d, env) }}
            dimsOf={dimsOfInst}
            onSelectFace={(iid, f) => { setSelectedFace(f); setPlanSel(f); setD((prev) => ({ ...prev, selInst: iid })); setMurOpen(true); }}
            pents={pentsAll}
            selPent={selPent}
            onSelectPent={(iid, v) => { setPlanSel("toiture"); setSelPent({ instId: iid, versant: v }); setMurOpen(true); }}
            onAddSide={openAddPick}
            onRemoveInst={removeInstance} />
          </div>
            {addPick && (
            <div className="modal-overlay" onClick={() => setAddPick(null)}>
            <div className="card modal" onClick={(e) => e.stopPropagation()}>
              <div className="card-title modal-title">
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
          <div className="panel-resize" onPointerDown={(e) => startResize(e, "plan", true)} title="Redimensionner le panneau" />
        </div>
        <div className="panel" ref={(el) => { panelRefs.current.elev = el; }} style={{ left: panels.elev.x, top: panels.elev.y, width: effW("elev") }}>
          <div className="panel-handle" onPointerDown={(e) => startDrag(e, "elev")} title="Glissez ce titre pour déplacer le panneau">
            <span>Élévation — Mur {selEdge?.numero ?? "?"}</span>
            <span className="panel-hint">glissez le titre pour déplacer</span>
          </div>
            <p style={{ fontSize: 12, color: "#78716c", margin: "0 0 6px" }}>
              Cliquez une face sur le plan (ou ci-dessous) pour changer d'élévation.
            </p>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {FACES.map((f) => (
                <button key={f.key}
                  onClick={() => { setSelectedFace(f.key); setPlanSel(f.key); }}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                    border: "1px solid", fontWeight: 500,
                    background: selectedFace === f.key ? "#b45309" : "transparent",
                    color: selectedFace === f.key ? "#fff" : "#78716c",
                    borderColor: selectedFace === f.key ? "#b45309" : "#d6d3d1",
                  }}>
                  {f.label.replace("Mur ", "")}
                </button>
              ))}
            </div>
          <div className="panel-canvas" style={{ height: panels.elev.h }}>
            <Elevation d={d} murs={env.murs} planchers={env.planchers} surfaces={env.facades} toiture={toitureDef} toitType={toitType} faceKey={selectedFace} faceData={face} dims={dmSel} insts={elevInsts.list} bbox={elevInsts.b} w={effW("elev")} h={panels.elev.h} />
          </div>
          <div className="panel-resize" onPointerDown={(e) => startResize(e, "elev", true)} title="Redimensionner le panneau" />
        </div>
      </div>
      <div className="side-col">
      <div className={"card panel-card" + (soumettreOpen ? " deplie" : "")}>
        <div className="card-title card-toggle" onClick={() => setSoumettreOpen((o) => !o)} title={soumettreOpen ? "Replier" : "Ouvrir le conteneur Soumettre"}>
          <span className={"carac-arrow" + (soumettreOpen ? " open" : "")}></span>
          Soumettre
        </div>
        <div className="card-body" style={soumettreOpen ? undefined : { padding: 0 }}>
          {soumettreOpen && (
          <>
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
          </>
          )}
        </div>
      </div>
      <div className={"card panel-card" + (reglagesOpen ? " deplie" : "")}>
        <div className="card-title card-toggle" onClick={() => setReglagesOpen((o) => !o)} title={reglagesOpen ? "Replier les réglages généraux" : "Ouvrir les réglages généraux"}>
          <span className={"carac-arrow" + (reglagesOpen ? " open" : "")}></span>
          Réglages généraux
        </div>
        <div className="card-body" style={reglagesOpen ? undefined : { padding: 0 }}>
          {reglagesOpen && (
          <>
          <div className="tabs">
            {tabsGeneraux.map(([key, label]) => (
              <button key={key} className={"tab-btn" + (tabGen === key ? " active" : "")}
                onClick={() => setTabGen(key)}>{label}</button>
            ))}
          </div>
          <div className="field field-module-name">
            <input type="text" value={d.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Nom du module" />
          </div>
          <div className="reglage-grid">
          <div className="reglage-main">
          {tabGen === "isolation" && (
            <>
              <div className="field">
                <label>Type d'isolation (catalogue)</label>
                <select value={d.isolation || ""} onChange={(e) => applyIsolation(e.target.value)}>
                  {!d.isolation && <option value="">— Choisir une isolation —</option>}
                  {env.isolations?.map((iso) => {
                    const isoMur = env.murs.find((x) => x.id === iso.mur);
                    const isoPlancher = env.planchers.find((p) => p.id === iso.plancher);
                    const isoToit = env.toitures.find((t) => t.id === iso.toiture);
                    return (
                      <option key={iso.id} value={iso.id}>
                        {iso.nom} — {isoMur?.nom || "—"} / {isoPlancher?.nom || "—"} / {isoToit?.nom || "—"}
                      </option>
                    );
                  })}
                </select>
              </div>
              {isoSel && (
                <div className="spec" style={{ marginTop: 12 }}>
                  <div className="spec-row"><span className="spec-k">Mur porteur</span><span className="spec-v">{murSel?.nom || "—"}</span></div>
                  <div className="spec-row"><span className="spec-k">Plancher</span><span className="spec-v">{plancherSel?.nom || "—"}</span></div>
                  <div className="spec-row"><span className="spec-k">Toiture</span><span className="spec-v">{toitureNom} — ép. {fmtCm(+(toitureDef.epaisseur ?? 0.30))} cm</span></div>
                </div>
              )}
            </>
          )}

          {tabGen === "formes" && (
            <>
              <div className="field">
                <label>Forme de toiture (catalogue)</label>
                <select value={d.forme || ""} onChange={(e) => applyForme(e.target.value)}>
                  {!d.forme && <option value="">— Choisir une forme —</option>}
                  {env.formes?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom} — {GEO_LABELS[f.geometrie] || f.geometrie || "—"}
                      {f.geometrie === "deuxpentes" ? ` — ${f.pente1 ?? f.pente}° / ${f.pente2 ?? f.pente}°` : ` — ${f.pente}°`}
                    </option>
                  ))}
                </select>
              </div>
              {formeDef && (
                <div className="spec" style={{ marginTop: 12 }}>
                  <div className="spec-row"><span className="spec-k">Géométrie</span><span className="spec-v">{GEO_LABELS[toitType] || toitType}</span></div>
                  <div className="spec-row">
                    <span className="spec-k">{toitType === "deuxpentes" ? "Pentes des versants" : "Pente"}</span>
                    <span className="spec-v">
                      {toitType === "deuxpentes" ? `${d.pente}° / ${d.pente2 ?? d.pente}°` : `${d.pente}°`}
                    </span>
                  </div>
                  <div className="spec-row"><span className="spec-k">Faitage</span><span className="spec-v">+{fmtCm(hauteurFaitage(d, toitType))} cm</span></div>
                </div>
              )}
            </>
          )}
          {tabGen === "charpente" && (
            <>
              <div className="field">
                <label>Charpente (catalogue)</label>
                <select value={d.charpente || ""} onChange={(e) => applyCharpente(e.target.value)}>
                  {!d.charpente && <option value="">— Choisir une charpente —</option>}
                  {env.charpentes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} — ép. {fmtCm(+(c.epaisseur ?? 0.20))} cm{+c.tarif > 0 ? ` — ${fmtEur(c.tarif)} HT` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {charpenteSel && (
                <div className="spec" style={{ marginTop: 12 }}>
                  <div className="spec-row"><span className="spec-k">Épaisseur</span><span className="spec-v">{fmtCm(+(charpenteSel.epaisseur ?? 0.20))} cm</span></div>
                  <div className="spec-row"><span className="spec-k">Couleur</span><span className="spec-v">{rgbHex(charpenteSel.rgb)}</span></div>
                  <div className="spec-row"><span className="spec-k">Référence Archicad</span><span className="spec-v">{charpenteSel.favori || "—"}</span></div>
                </div>
              )}
            </>
          )}
          </div>
          <div className="reglage-side">
            {(() => {
              const img = tabGen === "isolation" ? isoSel?.image : tabGen === "formes" ? formeDef?.image : charpenteSel?.image;
              const alt = tabGen === "isolation" ? isoSel?.nom : tabGen === "formes" ? formeDef?.nom : charpenteSel?.nom;
              return img
                ? <img src={img} alt={alt || ""} className="reglage-visual-img" />
                : <div className="reglage-visual-empty">—</div>;
            })()}
          </div>
          </div>

          <>
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
              <div className="metrics">
                <div className="metric"><div className="k">Surface plancher</div><div className="v">{surfacePlancher(d, env).toFixed(1)} m²</div></div>
                <div className="metric"><div className="k">Emprise au sol</div><div className="v">{empriseAuSol(d, env, murSel || env.murs[0]).toFixed(1)} m²</div></div>
                <div className="metric"><div className="k">Surface toiture (cumul)</div><div className="v">{surfaceToitureTotale(d, env, toitType).toFixed(1)} m²</div></div>
                <div className="metric"><div className="k">Volume brut</div><div className="v">{(d.instances?.length ? d.instances : [{ moduleId: d.moduleId }]).reduce((s, i) => { const dm = dimsOf(d, env, i); return s + dm.longueur * dm.largeur * dm.hauteur; }, 0).toFixed(1)} m³</div></div>
                <div className="metric"><div className="k">Menuiseries</div><div className="v">{eachEdge(d, (i) => dimsOf(d, env, i), epMurOf(d, env)).reduce((s, e) => s + surfaceMenuiserie(e.a || {}) + surfaceMenuiserie(e.b || {}), 0).toFixed(2)} m²</div></div>
              </div>
          </>
          </>
          )}
        </div>
      </div>

      {murOpen && (
      <div className="modal-overlay" onClick={() => setMurOpen(false)}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-title modal-title">
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
                <span className="spec-v" style={{ alignSelf: "center", fontWeight: 600 }}>{fmtM2(murArea)}</span>
              </Field>
            </div>
          )}
          <p className="section-label" style={{ marginTop: 0 }}>Revêtement</p>
          <p className="config-hint" style={{ marginTop: 0 }}>
            {selIsToiture
              ? "Surface appliquée à la toiture (catalogue « Surfaces » du back-office)."
              : "Surface appliquée à ce mur (catalogue « Surfaces » du back-office)."}
          </p>
          <div className="fields-grid">
            {!selIsToiture && (
            <Field label="Surface du mur">
              <select
                value={face.surface ?? murSel?.surface ?? ""}
                onChange={(e) => setFace(planSel, { surface: e.target.value || null })}
              >
                <option value="">Par défaut — {surfaceNom(face.surface ?? murSel?.surface ?? "")}</option>
                {env.facades.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </Field>
            )}
            {selIsToiture && (
              // le pent cliqué sur le plan : un revêtement pour ce pent
              (() => {
                const p = selPent ? pentsAll.find((pp) => pp.instId === selPent.instId && pp.versant === selPent.versant) : null;
                if (!p) return <p className="config-hint">Cliquez un pent de toiture sur le plan pour choisir son revêtement.</p>;
                return (
                  <div className="fields-grid">
                    <Field label={`Pent ${p.numero} — module ${p.instIndex} (${p.versant}) — ${fmtM2(p.area)}`}>
                      <select
                        value={d.surfacesToiture?.[p.instId]?.[p.versant] ?? toitureDef.surface ?? ""}
                        onChange={(e) => setD((prev) => ({
                          ...prev,
                          surfacesToiture: {
                            ...(prev.surfacesToiture || {}),
                            [p.instId]: { ...(prev.surfacesToiture?.[p.instId] || {}), [p.versant]: e.target.value || null },
                          },
                        }))}
                      >
                        <option value="">Par défaut — {surfaceNom(toitureDef.surface ?? "")}</option>
                        {env.facades.map((s) => (
                          <option key={s.id} value={s.id}>{s.nom}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                );
              })()
            )}
          </div>
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
          {selIsToiture && (
            <p className="config-hint">Aucun ouvrant en toiture — cliquez un mur sur le plan pour gérer ses ouvrants.</p>
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
              <div className="chiffrage-line" key={m.key}>
                <span className="chiffrage-left"><span className="chiffrage-k">{m.label}</span><span className="chiffrage-surf">{surfaceNom(m.surfaceId)} - {fmtM2(m.area)}</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(m.amount)} HT</span></span>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Plancher</span><span className="chiffrage-surf">{fmtM2(surfaces.plancher)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.plancher)} HT</span></div>
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Toiture</span><span className="chiffrage-surf">{fmtM2(surfaces.toiture)}</span></span><span className="chiffrage-v">{fmtEur(tarifs.toiture)} HT</span></div>
            <p className="section-label carac-toggle" onClick={() => setPentsOpen((o) => !o)}>
              <span className={"carac-arrow" + (pentsOpen ? " open" : "")}></span>
              Détail par pent
            </p>
            {pentsOpen && (tarifs.pents || []).map((p) => (
              <div className="chiffrage-line" key={p.numero}>
                <span className="chiffrage-left"><span className="chiffrage-k">Pent {p.numero} (module {p.instIndex})</span><span className="chiffrage-surf">{surfaceNom(p.surfaceId)} - {fmtM2(p.area)}</span></span>
                <span className="chiffrage-right"><span className="chiffrage-v">{fmtEur(p.amount)} HT</span></span>
              </div>
            ))}
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Ouvrants ({surfaces.ouvrants})</span></span><span className="chiffrage-v">{fmtEur(tarifs.menuiseries)} HT</span></div>
            <div className="chiffrage-line"><span className="chiffrage-left"><span className="chiffrage-k">Charpente ({surfaces.charpentes})</span></span><span className="chiffrage-v">{fmtEur(tarifs.charpente)} HT</span></div>
          </div>
          )}
          <div className={"chiffrage-total" + (chiffrageCardOpen ? "" : " solo")}>
            <div className="chiffrage-row"><span className="k">Coût estimatif</span><span className="v">{fmtEur(tarifs.total)} HT</span></div>
            <div className="chiffrage-row"><span className="k">TVA (20 %)</span><span className="v">{fmtEur(tarifs.total * 0.20)}</span></div>
            <div className="chiffrage-row total"><span className="k">Coût TTC</span><span className="v">{fmtEur(tarifs.total * 1.20)}</span></div>
          </div>
        </div>
      </div>
      <div className={"card panel-card" + (sauvOpen ? " deplie" : "")}>
        <div className="card-title card-toggle" onClick={() => setSauvOpen((o) => !o)} title={sauvOpen ? "Replier les sauvegardes" : "Ouvrir les sauvegardes"}>
          <span className={"carac-arrow" + (sauvOpen ? " open" : "")}></span>
          Sauvegardes
        </div>
        <div className="card-body" style={sauvOpen ? undefined : { padding: 0 }}>
              {sauvOpen && (session && session.loggedIn ? (
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
              ) : null)}

              {sauvOpen && flash && <div className="field-error" style={{ marginBottom: 8, color: "#059669" }}>{flash}</div>}
          <div className={"chiffrage-total" + (sauvOpen ? "" : " solo")}>
            <div className="chiffrage-row">
              <span className="k">Dernière sauvegarde</span>
              <span className="v">{lastConfig ? `${lastConfig.nom} — ${lastConfig.updated}` : "Aucune"}</span>
            </div>
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
