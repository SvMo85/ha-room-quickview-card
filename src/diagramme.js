import { esc } from "./bewertung.js";

export const STUNDEN_LEISTUNG = 24;
export const ABSCHNITTE_LEISTUNG = 96;
export const TAGE_ENERGIE = 30;
const ERSATZFARBEN = ["#5aa9e6", "#e8663d", "#4caf50", "#a07ad8", "#f2b632", "#9fb3c4", "#d35d8f"];

export function zeigtLeistungsverlauf(geraet) {
  return Boolean(geraet.power) && geraet.graph !== false;
}

// Farbe eines Geraets im Diagramm: eigene Farbe, sonst reihum aus den Ersatzfarben
export function diagrammfarbe(geraet, reihe) {
  return geraet.color || ERSATZFARBEN[reihe % ERSATZFARBEN.length];
}

// Zeitpunkt eines Verlaufseintrags in ms; Home Assistant liefert Sekunden
function verlaufszeit(eintrag) {
  const sekunden = eintrag.lu !== undefined ? eintrag.lu : eintrag.lc;
  return sekunden * 1000;
}

/**
 * Teilt den Zeitraum in gleich lange Abschnitte und nimmt je Abschnitt den
 * hoechsten Wert, damit kurze Lastspitzen sichtbar bleiben. Ein Abschnitt ohne
 * eigenen Eintrag erbt den zuletzt gueltigen Wert.
 */
export function abschnittsmaxima(eintraege, start, ende, anzahl) {
  const dauer = (ende - start) / anzahl;
  const punkte = eintraege
    .map((e) => ({ zeit: verlaufszeit(e), wert: parseFloat(e.s) }))
    .sort((a, b) => a.zeit - b.zeit);
  const werte = [];
  let index = 0;
  let zuletzt = null;
  while (index < punkte.length && punkte[index].zeit <= start) {
    zuletzt = Number.isFinite(punkte[index].wert) ? punkte[index].wert : null;
    index++;
  }
  for (let i = 0; i < anzahl; i++) {
    const abschnittsende = start + (i + 1) * dauer;
    let maximum = zuletzt;
    while (index < punkte.length && punkte[index].zeit < abschnittsende) {
      zuletzt = Number.isFinite(punkte[index].wert) ? punkte[index].wert : null;
      if (zuletzt !== null && (maximum === null || zuletzt > maximum)) maximum = zuletzt;
      index++;
    }
    werte.push(maximum === null ? 0 : maximum);
  }
  return werte;
}

// Beginn der letzten n Tage in Ortszeit, aeltester zuerst, heute zuletzt
export function tagesanfaenge(jetzt, tage) {
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  const anfaenge = [];
  for (let i = tage - 1; i >= 0; i--) {
    const tag = new Date(heute);
    tag.setDate(heute.getDate() - i);
    anfaenge.push(tag.getTime());
  }
  return anfaenge;
}

// Statistikbeginn in ms; je nach Home-Assistant-Version Zahl oder ISO-Text
function statistikzeit(eintrag) {
  return typeof eintrag.start === "number" ? eintrag.start : Date.parse(eintrag.start);
}

// Ordnet die Tagesaenderungen der Statistik den Tagen zu; negative Werte (Zaehlerwechsel) zaehlen nicht
export function energieJeTag(eintraege, anfaenge) {
  const jeTag = new Map();
  (eintraege || []).forEach((e) => {
    const tag = new Date(statistikzeit(e));
    tag.setHours(0, 0, 0, 0);
    jeTag.set(tag.getTime(), Math.max(0, e.change || 0));
  });
  return anfaenge.map((anfang) => jeTag.get(anfang) || 0);
}

// Summe aller Reihen je Abschnitt
export function abschnittssummen(reihen) {
  return reihen[0].werte.map((_, i) => reihen.reduce((s, r) => s + r.werte[i], 0));
}

// Gestapelte Flaechen: je Geraet eine Schicht, die Oberkante ist die Raumleistung
export function flaechenSvg(reihen) {
  const anzahl = reihen[0].werte.length;
  const maximum = Math.max.apply(null, abschnittssummen(reihen).concat([1]));
  const x = (i) => ((i / (anzahl - 1)) * 100).toFixed(2);
  const y = (w) => (56 - (w / maximum) * 52).toFixed(2);
  let unten = new Array(anzahl).fill(0);
  const schichten = reihen.map((r) => {
    const oben = unten.map((u, i) => u + r.werte[i]);
    const oberkante = oben.map((w, i) => x(i) + "," + y(w));
    const unterkante = unten.map((w, i) => x(i) + "," + y(w)).reverse();
    unten = oben;
    return '<polygon points="' + oberkante.concat(unterkante).join(" ") + '" fill="' + esc(r.farbe) + '" fill-opacity="0.85"/>';
  });
  return '<svg viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true">' + schichten.join("") + "</svg>";
}

// Inhalt des Tooltips: Ueberschrift, je Geraet mit Verbrauch eine Zeile, bei mehreren die Summe
export function tippHtml(titel, eintraege, format) {
  const mitWert = eintraege.filter((e) => e.wert > 0);
  const zeilen = mitWert.map((e) =>
    '<div class="z"><span><i style="background:' + esc(e.farbe) + '"></i>' + esc(e.name) + "</span><span>" + format(e.wert) + "</span></div>"
  );
  const summe = mitWert.reduce((s, e) => s + e.wert, 0);
  return '<div class="titel">' + esc(titel) + "</div>" +
    (zeilen.length ? zeilen.join("") : '<div class="z"><span>Kein Verbrauch</span></div>') +
    (zeilen.length > 1 ? '<div class="z summe"><span>Summe</span><span>' + format(summe) + "</span></div>" : "");
}

// Gestapelte Tagesbalken: je Tag die Geraete des Raums uebereinander
export function stapelSvg(reihen) {
  const tage = reihen[0].werte.length;
  const summen = [];
  for (let t = 0; t < tage; t++) summen.push(reihen.reduce((s, r) => s + r.werte[t], 0));
  const maximum = Math.max.apply(null, summen.concat([0.001]));
  const breite = 100 / tage;
  let rechtecke = "";
  for (let t = 0; t < tage; t++) {
    let unten = 56;
    reihen.forEach((r) => {
      const hoehe = (r.werte[t] / maximum) * 52;
      if (hoehe <= 0) return;
      unten -= hoehe;
      rechtecke += '<rect x="' + (t * breite + 0.4).toFixed(2) + '" y="' + unten.toFixed(2) + '" width="' +
        (breite - 0.8).toFixed(2) + '" height="' + hoehe.toFixed(2) + '" fill="' + esc(r.farbe) + '"/>';
    });
  }
  return '<svg viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true">' + rechtecke + "</svg>";
}
