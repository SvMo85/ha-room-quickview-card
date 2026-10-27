/**
 * Room Quickview Card
 *
 * Raumkarte fuer Home Assistant: Raumsymbol, Name, Temperatur, Luftfeuchte und
 * Stromverbrauch, darunter je Geraet ein Symbol, das seinen Zustand zeigt.
 *
 * Die Karte schaltet nie direkt. Beim Scrollen am Telefon wuerde sonst leicht
 * ein Geraet ausgehen. Jeder Tipp oeffnet ein Pop-up; ein Tipp auf ein Symbol
 * hebt dort das zugehoerige Geraet hervor. Geschaltet wird erst im Pop-up.
 *
 * Das Pop-up haengt sich beim Oeffnen in den Shadow Root von home-assistant,
 * wie die Dialoge von Home Assistant selbst: Dashboard-Container wuerden eine
 * fest positionierte Ebene sonst abschneiden, und nur dort erreichen
 * eingebettete Karten Theme und Kontext der Oberflaeche.
 */

const CARD_VERSION = "0.2.0";

console.info(
  `%c ROOM-QUICKVIEW-CARD %c ${CARD_VERSION} `,
  "color: #16181a; background: #f2b632; font-weight: 700;",
  "color: #f2b632; background: #16181a;"
);

// Chips kennen nur vier Farben: an, aus, Melder in Ordnung und Alarm.
// Geraetefarben aus der Konfiguration gelten nur in den Diagrammen.
const FARBEN = {
  an: "#f2b632",
  aus: "#9fb3c4",
  ok: "#4caf50",
  alarm: "#e0524a",
  leistung: "#f2b632"
};

// Geraeteklassen, bei denen "an" eine Gefahr meldet; "aus" ist dort der gute Zustand
const ALARMKLASSEN = ["smoke", "gas", "carbon_monoxide", "moisture", "heat", "safety", "problem", "tamper"];
const SCHALTBARE_DOMAENEN = ["switch", "light", "fan", "input_boolean", "siren"];
const OHNE_WERT = ["unavailable", "unknown"];
// Ereignisse, mit denen Karten Home Assistant um Detailfenster, Dialoge oder Hinweise bitten
const WEITERZUREICHENDE_EREIGNISSE = ["hass-more-info", "show-dialog", "hass-notification"];
const AKTIVE_ZUSTAENDE = ["on", "open", "opening", "closing", "playing", "paused", "home", "recording", "streaming"];

const DOMAENENSYMBOLE = {
  switch: "mdi:power-socket-de",
  light: "mdi:lightbulb",
  fan: "mdi:fan",
  input_boolean: "mdi:toggle-switch-outline",
  siren: "mdi:bullhorn",
  cover: "mdi:window-shutter",
  media_player: "mdi:cast",
  camera: "mdi:cctv",
  lock: "mdi:lock",
  sensor: "mdi:flash",
  binary_sensor: "mdi:radiobox-blank"
};

const KLASSENSYMBOLE = {
  smoke: "mdi:smoke-detector-variant",
  gas: "mdi:gas-cylinder",
  carbon_monoxide: "mdi:molecule-co",
  moisture: "mdi:water-alert",
  heat: "mdi:fire-alert",
  door: "mdi:door-closed",
  garage_door: "mdi:garage",
  window: "mdi:window-closed",
  opening: "mdi:door-closed",
  motion: "mdi:motion-sensor",
  running: "mdi:play-circle-outline"
};

const KLASSENSYMBOLE_OFFEN = {
  door: "mdi:door-open",
  garage_door: "mdi:garage-open",
  window: "mdi:window-open",
  opening: "mdi:door-open"
};

/* ------------------------------------------------------------ Bewertung */

function domaeneVon(entityId) {
  return entityId.split(".")[0];
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Zahl aus dem Zustand; bei einem Thermostat aus dem genannten Attribut, etwa current_temperature
function zahlAus(hass, entityId, klimaAttribut) {
  const s = entityId ? hass.states[entityId] : undefined;
  if (!s || OHNE_WERT.includes(s.state)) return null;
  const roh = klimaAttribut && domaeneVon(entityId) === "climate" ? s.attributes[klimaAttribut] : s.state;
  const n = parseFloat(roh);
  return Number.isFinite(n) ? n : null;
}

function sprache(hass) {
  return (hass.locale && hass.locale.language) || hass.language || "de";
}

function zahlText(hass, wert, nachkomma) {
  return new Intl.NumberFormat(sprache(hass), {
    minimumFractionDigits: nachkomma,
    maximumFractionDigits: nachkomma
  }).format(wert);
}

// Unter 10 W eine Nachkommastelle, darueber und bei null ganze Watt
function leistungText(hass, watt) {
  return zahlText(hass, watt, watt !== 0 && Math.abs(watt) < 10 ? 1 : 0) + " W";
}

function zustandText(hass, s) {
  if (typeof hass.formatEntityState === "function") return hass.formatEntityState(s);
  const einheit = s.attributes.unit_of_measurement;
  return s.state + (einheit ? " " + einheit : "");
}

function standardsymbol(s) {
  const domaene = domaeneVon(s.entity_id);
  const klasse = s.attributes.device_class;
  if (s.attributes.icon) return s.attributes.icon;
  if (domaene === "cover") return s.state === "closed" ? "mdi:window-shutter" : "mdi:window-shutter-open";
  if (domaene === "binary_sensor" && klasse) {
    if (s.state === "on" && KLASSENSYMBOLE_OFFEN[klasse]) return KLASSENSYMBOLE_OFFEN[klasse];
    if (KLASSENSYMBOLE[klasse]) return KLASSENSYMBOLE[klasse];
  }
  return DOMAENENSYMBOLE[domaene] || "mdi:circle-outline";
}

function istSichtbar(hass, geraet) {
  const bedingung = geraet.show_when;
  if (!bedingung) return true;
  const entityId = typeof bedingung === "string" ? bedingung : bedingung.entity;
  const s = hass.states[entityId];
  if (!s) return false;
  if (typeof bedingung === "string" || bedingung.state === undefined) return AKTIVE_ZUSTAENDE.includes(s.state);
  const erlaubt = Array.isArray(bedingung.state) ? bedingung.state : [bedingung.state];
  return erlaubt.includes(s.state);
}

/**
 * Ermittelt aus Konfiguration und Zustand, wie ein Geraet erscheint:
 * art (schalter, rollladen, status, messung), an, ton (aktiv, aus, alarm),
 * farbe, symbol, text und leistung.
 */
function bewerteGeraet(hass, geraet) {
  const s = geraet.entity ? hass.states[geraet.entity] : undefined;
  const leistung = zahlAus(hass, geraet.power);
  const basis = {
    name: geraet.name || (s && s.attributes.friendly_name) || geraet.entity || "Gerät",
    entity: geraet.entity,
    stateObj: s,
    leistung
  };

  if (!geraet.entity) {
    const laeuft = leistung !== null && leistung > 0.5;
    return Object.assign(basis, mitZustand(laeuft), {
      art: "messung",
      symbol: geraet.icon || "mdi:flash",
      text: leistung === null ? "Nicht verfügbar" : laeuft ? "Läuft" : "Aus"
    });
  }

  if (!s) {
    return Object.assign(basis, mitZustand(false), {
      art: "status", symbol: geraet.icon || "mdi:help-circle-outline", text: "Entität nicht gefunden"
    });
  }

  const domaene = domaeneVon(s.entity_id);
  const symbol = geraet.icon || standardsymbol(s);
  const text = zustandText(hass, s);

  if (OHNE_WERT.includes(s.state)) {
    return Object.assign(basis, mitZustand(false), { art: "status", symbol, text });
  }

  const regel = geraet.states && geraet.states[s.state];

  // Ein offener Rollladen ist nicht "an": er bleibt grau und zeigt seine Stellung als Fuellstand.
  // Eine Regel aus "states:" ersetzt hier nur Symbol und Text, damit Schalter und Regler bleiben.
  if (domaene === "cover") {
    const position = s.attributes.current_position;
    const offen = s.state !== "closed";
    const zustand = (regel && regel.text) || text;
    const mitPosition = offen && typeof position === "number" ? zustand + " · " + position + " %" : zustand;
    return Object.assign(basis, {
      art: "rollladen", an: offen, ton: "aus", farbe: FARBEN.aus,
      symbol: (regel && regel.icon) || symbol, text: mitPosition, position,
      geschlossen: typeof position === "number" ? 100 - position : offen ? 0 : 100
    });
  }

  // Eigene Regel je Zustand aus "states:" geht der Erkennung nach Domaene vor
  if (regel) {
    const farbe = regelfarbe(regel.color);
    return Object.assign(basis, {
      art: SCHALTBARE_DOMAENEN.includes(domaene) ? "schalter" : "status",
      an: farbe !== null,
      ton: farbe !== null ? "aktiv" : "aus",
      farbe: farbe || FARBEN.aus,
      symbol: regel.icon || symbol,
      text: regel.text || text
    });
  }

  if (SCHALTBARE_DOMAENEN.includes(domaene)) {
    return Object.assign(basis, mitZustand(s.state === "on"), { art: "schalter", symbol, text });
  }

  // Ein Melder ist gruen, solange alles in Ordnung ist, und rot bei Alarm
  if (geraet.alarm === true || (domaene === "binary_sensor" && ALARMKLASSEN.includes(s.attributes.device_class))) {
    const alarm = s.state === "on";
    return Object.assign(basis, {
      art: "status", an: true, ton: alarm ? "alarm" : "gut", farbe: alarm ? FARBEN.alarm : FARBEN.ok, symbol, text
    });
  }

  return Object.assign(basis, mitZustand(AKTIVE_ZUSTAENDE.includes(s.state)), { art: "status", symbol, text });
}

function mitZustand(an) {
  return { an, ton: an ? "aktiv" : "aus", farbe: an ? FARBEN.an : FARBEN.aus };
}

// Farbwort aus "states:" in eine Farbe; grey und off bedeuten "aus" und ergeben null.
// Rot ist hier nur eine Farbe, kein Alarm: es pulsiert nicht und faerbt die Karte nicht.
const REGELFARBEN = { yellow: FARBEN.an, on: FARBEN.an, green: FARBEN.ok, red: FARBEN.alarm };

function regelfarbe(wort) {
  if (!wort || wort === "grey" || wort === "off") return null;
  return REGELFARBEN[wort] || wort;
}

// Ein ausgeschalteter Schalter zeigt nur "Aus", seine Restleistung ist ohne Aussage
function zustandHtml(hass, b) {
  const mitLeistung = b.leistung !== null && b.leistung !== undefined && !(b.art === "schalter" && !b.an);
  const leistung = mitLeistung ? ' · <span class="leistung">' + leistungText(hass, b.leistung) + "</span>" : "";
  return esc(b.text) + leistung;
}

// Gemeinsame Merkmale eines Chips auf der Karte und im Pop-up
function chipMerkmale(b) {
  const rollladen = b.art === "rollladen";
  return ' data-an="' + (rollladen ? false : b.an) + '" data-ton="' + b.ton + '"' +
    ' style="--farbe:' + esc(b.farbe) + (rollladen ? ";--zu:" + b.geschlossen + "%" : "") + '"';
}

function chipKlassen(b) {
  return "chip" + (b.art === "rollladen" ? " rollladen" : "");
}

function zeigtChip(geraet) {
  return geraet.chip !== undefined ? geraet.chip !== false : Boolean(geraet.entity);
}

/* ----------------------------------------------------------- Diagramme */

const STUNDEN_LEISTUNG = 24;
const ABSCHNITTE_LEISTUNG = 96;
const TAGE_ENERGIE = 30;
const ERSATZFARBEN = ["#5aa9e6", "#e8663d", "#4caf50", "#a07ad8", "#f2b632", "#9fb3c4", "#d35d8f"];

function zeigtLeistungsverlauf(geraet) {
  return Boolean(geraet.power) && geraet.graph !== false;
}

// Farbe eines Geraets im Diagramm: eigene Farbe, sonst reihum aus den Ersatzfarben
function diagrammfarbe(geraet, reihe) {
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
function abschnittsmaxima(eintraege, start, ende, anzahl) {
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
function tagesanfaenge(jetzt, tage) {
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
function energieJeTag(eintraege, anfaenge) {
  const jeTag = new Map();
  (eintraege || []).forEach((e) => {
    const tag = new Date(statistikzeit(e));
    tag.setHours(0, 0, 0, 0);
    jeTag.set(tag.getTime(), Math.max(0, e.change || 0));
  });
  return anfaenge.map((anfang) => jeTag.get(anfang) || 0);
}

// Summe aller Reihen je Abschnitt
function abschnittssummen(reihen) {
  return reihen[0].werte.map((_, i) => reihen.reduce((s, r) => s + r.werte[i], 0));
}

// Gestapelte Flaechen: je Geraet eine Schicht, die Oberkante ist die Raumleistung
function flaechenSvg(reihen) {
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
function tippHtml(titel, eintraege, format) {
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
function stapelSvg(reihen) {
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

/* --------------------------------------------------------------- Stile */

const GEMEINSAME_STILE = `
  :host {
    --rsc-text: var(--primary-text-color, #e6eaee);
    --rsc-gedaempft: var(--secondary-text-color, #8d97a1);
    --rsc-karte: var(--ha-card-background, var(--card-background-color, #1b1f23));
    --rsc-linie: var(--divider-color, #2a3036);
    --rsc-flaeche: color-mix(in srgb, var(--rsc-text) 5%, transparent);
    --rsc-leistung: ${FARBEN.leistung};
    --rsc-alarm: ${FARBEN.alarm};
  }
  ha-icon { display: inline-flex; }
  .chip {
    width: 42px; height: 42px; border-radius: 10px; padding: 0; box-sizing: border-box;
    display: grid; place-items: center; border: 1px solid transparent;
    background: var(--rsc-flaeche); color: var(--rsc-gedaempft); cursor: pointer;
    --mdc-icon-size: 22px;
    transition: background-color 120ms ease, color 120ms ease, transform 80ms ease;
  }
  .chip[data-an="true"] { color: var(--farbe); background: color-mix(in srgb, var(--farbe) 22%, transparent); }
  /* Rollladen: Fuellstand von oben, so weit er geschlossen ist */
  .chip.rollladen { position: relative; overflow: hidden; }
  .chip.rollladen::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: var(--zu, 0%);
    background: color-mix(in srgb, var(--rsc-gedaempft) 38%, transparent);
    border-bottom: 2px solid color-mix(in srgb, var(--rsc-gedaempft) 70%, transparent);
    box-sizing: border-box; transition: height 200ms ease;
  }
  .chip.rollladen[style*="--zu:0%"]::before { border-bottom: none; }
  .chip.rollladen ha-icon { position: relative; }
  .chip[data-ton="alarm"] { animation: alarmpuls 1.1s ease-in-out infinite; }
  @keyframes alarmpuls {
    0%, 100% { box-shadow: 0 0 0 0 rgba(224, 82, 74, 0); }
    50% { box-shadow: 0 0 0 4px rgba(224, 82, 74, 0.45); }
  }
  .leistung { color: var(--rsc-leistung); }
  @media (prefers-reduced-motion: reduce) {
    .chip { transition: none; }
    .chip[data-ton="alarm"] { animation: none; }
  }
`;

const KARTENSTILE = `
  :host { display: block; }
  .raum {
    box-sizing: border-box; height: 100%; padding: 12px; overflow: hidden;
    background: var(--rsc-karte); color: var(--rsc-text);
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--rsc-linie));
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  .raum.klickbar { cursor: pointer; }
  .raum.klickbar:hover { background: color-mix(in srgb, var(--rsc-text) 3%, var(--rsc-karte)); }
  .raum:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }
  .raum.alarm { border-color: var(--rsc-alarm); box-shadow: 0 0 0 1px var(--rsc-alarm); }

  /* Symbol links ueber die ganze Hoehe, rechts oben Name und Werte, darunter die Chips.
     Die Chip-Zeile ist immer da, damit jede Karte gleich hoch ist. */
  .raumkopf {
    display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto minmax(42px, auto);
    gap: 10px 12px;
  }
  .raumsymbol {
    grid-row: 1 / 3; align-self: center;
    width: 88px; height: 88px; border-radius: 16px;
    display: grid; place-items: center; background: color-mix(in srgb, var(--rsc-text) 6%, transparent);
    --mdc-icon-size: 48px;
  }
  .raumtext { min-width: 0; }
  .raumname {
    font-weight: 600; font-size: 1.08rem; line-height: 1.5;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .raumwerte {
    display: flex; flex-wrap: wrap; gap: 2px 10px; min-height: 1.5em; line-height: 1.5;
    font-size: 0.86rem; color: var(--rsc-gedaempft); font-variant-numeric: tabular-nums;
  }
  .raumwerte span { display: inline-flex; align-items: center; gap: 4px; --mdc-icon-size: 14px; }

  /* Chips brechen nie um: was nicht passt, wird seitlich gewischt. Rechtsbuendig ueber den
     Aussenabstand des ersten Chips, weil flex-end ueberstehende Chips unerreichbar abschneidet.
     Die Leiste laeuft bis an den Kartenrand, damit der angeschnittene Chip sichtbar hineinragt. */
  .chips {
    display: flex; flex-wrap: nowrap; align-items: flex-end; gap: 6px;
    overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain;
    margin-right: -12px; padding-right: 12px;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chips > .chip { flex: 0 0 auto; }
  .chips > .chip:first-child { margin-left: auto; }
  .chips.links { mask-image: linear-gradient(to right, transparent 0, #000 12px); }
  .chips.rechts { mask-image: linear-gradient(to left, transparent 0, #000 12px); }
  .chips.links.rechts { mask-image: linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%); }
  .chip:hover { background: color-mix(in srgb, var(--rsc-text) 10%, transparent); }
  .chip[data-an="true"]:hover { background: color-mix(in srgb, var(--farbe) 30%, transparent); }
  .chip:active { transform: scale(0.94); }
  .chip:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .raum { transition: none; } }
`;

const POPUPSTILE = `
  .abdunklung {
    position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.55);
    display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    font-family: var(--paper-font-body1_-_font-family, inherit); font-size: 15px; line-height: 1.5;
  }
  .popup {
    box-sizing: border-box; width: 100%; max-width: 440px; max-height: calc(100vh - 32px); overflow: auto;
    background: var(--rsc-karte); color: var(--rsc-text);
    border: 1px solid var(--rsc-linie); border-radius: 14px;
    padding: 14px; display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6);
  }
  .popupkopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .popupkopf h2 { margin: 0; font-size: 1.15rem; font-weight: 600; }
  .schliessen {
    min-height: 36px; padding: 0 14px; border-radius: 8px;
    border: 1px solid var(--rsc-linie); background: transparent; color: var(--rsc-text);
    font: inherit; font-size: 0.88rem; cursor: pointer;
  }
  .schliessen:hover { background: color-mix(in srgb, var(--rsc-text) 7%, transparent); }
  .schliessen:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }
  .liste { display: flex; flex-direction: column; gap: 8px; }
  .karten, .verlaeufe { display: flex; flex-direction: column; gap: 10px; }
  .karten:empty, .verlaeufe:empty { display: none; }

  .geraet {
    display: grid; grid-template-columns: 42px 1fr auto; align-items: center; gap: 8px 12px;
    padding: 10px; border-radius: 10px; background: color-mix(in srgb, var(--rsc-text) 3%, transparent);
  }
  .geraet .chip { cursor: default; }
  .geraet.hervorgehoben { outline: 2px solid var(--farbe); outline-offset: -2px; }
  .geraet.unter { margin-left: 22px; }
  .gtext { min-width: 0; }
  .gname { font-weight: 600; }
  .gwert { font-size: 0.86rem; color: var(--rsc-gedaempft); font-variant-numeric: tabular-nums; }
  .ghinweis { font-size: 0.78rem; color: var(--rsc-gedaempft); }
  .zusatz { grid-column: 1 / 4; }
  .regler { width: 100%; margin: 0; accent-color: var(--farbe); }

  .zwischentitel {
    margin: 6px 0 0; font-size: 0.8rem; color: var(--rsc-gedaempft);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .diagramm { padding: 10px; border-radius: 10px; background: color-mix(in srgb, var(--rsc-text) 3%, transparent); }
  .dkopf { display: flex; justify-content: space-between; gap: 8px; font-size: 0.86rem; }
  .dkopf span:last-child { color: var(--rsc-gedaempft); font-variant-numeric: tabular-nums; }
  .legende { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 0.78rem; color: var(--rsc-gedaempft); }
  .legende i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
  /* pan-y: senkrechtes Wischen scrollt das Pop-up, waagerechtes fuehrt die Markierung */
  .flaeche { position: relative; height: 56px; margin-top: 6px; touch-action: pan-y; cursor: crosshair; }
  .flaeche svg { width: 100%; height: 100%; display: block; }
  .marke { position: absolute; top: 0; bottom: 0; pointer-events: none; }
  .marke.linie { width: 1px; margin-left: -0.5px; background: var(--rsc-text); opacity: 0.75; }
  .marke.band { border-radius: 2px; background: color-mix(in srgb, var(--rsc-text) 20%, transparent); }
  .tipp {
    position: absolute; z-index: 2; pointer-events: none; box-sizing: border-box;
    min-width: 150px; padding: 7px 10px; border-radius: 8px;
    background: var(--rsc-karte); border: 1px solid color-mix(in srgb, var(--rsc-text) 18%, transparent);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    font-size: 0.78rem; line-height: 1.45; white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .tipp .titel { font-weight: 600; margin-bottom: 2px; }
  .tipp .z { display: flex; justify-content: space-between; gap: 14px; color: var(--rsc-gedaempft); }
  .tipp .z span:last-child { color: var(--rsc-text); }
  .tipp .z i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }
  .tipp .summe { margin-top: 3px; padding-top: 3px; border-top: 1px solid var(--rsc-linie); font-weight: 600; }
  .hinweis { font-size: 0.78rem; color: var(--rsc-gedaempft); }

  .schalter {
    position: relative; width: 50px; height: 28px; border-radius: 14px;
    border: none; background: color-mix(in srgb, var(--rsc-text) 20%, transparent); cursor: pointer; padding: 0;
    transition: background-color 150ms ease;
  }
  .schalter::after {
    content: ""; position: absolute; top: 3px; left: 3px;
    width: 22px; height: 22px; border-radius: 50%; background: #e6eaee;
    transition: transform 150ms ease;
  }
  .schalter[aria-checked="true"] { background: var(--farbe); }
  .schalter[aria-checked="true"]::after { transform: translateX(22px); }
  .schalter:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .schalter, .schalter::after { transition: none; }
  }
`;

/* ---------------------------------------------------------------- Karte */

class RoomQuickviewCard extends HTMLElement {
  static getStubConfig() {
    return { name: "Raum", icon: "mdi:sofa", devices: [] };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._signatur = "";
    this._popup = null;
    this.shadowRoot.addEventListener("click", (e) => this._beiKlick(e));
    this.shadowRoot.addEventListener("keydown", (e) => this._beiTaste(e));
    // scroll steigt nicht auf, deshalb in der Einfangphase
    this.shadowRoot.addEventListener("scroll", (e) => {
      if (e.target.classList && e.target.classList.contains("chips")) this._ueberlaufMarkieren();
    }, true);
    this._groesse = new ResizeObserver(() => this._ueberlaufMarkieren());
  }

  setConfig(config) {
    if (!config || !config.name) throw new Error("room-quickview-card: name fehlt");
    if (config.devices !== undefined && !Array.isArray(config.devices)) {
      throw new Error("room-quickview-card: devices muss eine Liste sein");
    }
    if (config.cards !== undefined && !Array.isArray(config.cards)) {
      throw new Error("room-quickview-card: cards muss eine Liste sein");
    }
    const geraete = (config.devices || []).map((g) => (typeof g === "string" ? { entity: g } : g));
    this._config = Object.assign({}, config, { devices: geraete });
    this._signatur = "";
    if (this._hass) this._aktualisieren();
  }

  set hass(hass) {
    this._hass = hass;
    this._aktualisieren();
    if (this._popup) this._popup.hass = hass;
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback() {
    this._groesse.observe(this);
  }

  disconnectedCallback() {
    this._groesse.disconnect();
    this._popupSchliessen();
  }

  // Neu gezeichnet wird nur, wenn sich eine beteiligte Entitaet geaendert hat
  _aktualisieren() {
    if (!this._config || !this._hass) return;
    const signatur = this._beteiligteEntitaeten()
      .map((id) => {
        const s = this._hass.states[id];
        return id + "=" + (s ? s.state + "@" + s.last_updated : "-");
      })
      .join("|");
    if (signatur === this._signatur) return;
    this._signatur = signatur;
    this._zeichnen();
  }

  _beteiligteEntitaeten() {
    const c = this._config;
    const ids = [c.temperature, c.humidity];
    c.devices.forEach((g) => {
      ids.push(g.entity, g.power);
      if (g.show_when) ids.push(typeof g.show_when === "string" ? g.show_when : g.show_when.entity);
    });
    return ids.filter(Boolean);
  }

  _zeichnen() {
    const hass = this._hass;
    const c = this._config;
    const alteChips = this.shadowRoot.querySelector(".chips");
    const scrollStand = alteChips ? alteChips.scrollLeft : 0;

    const bewertungen = c.devices.map((g) => bewerteGeraet(hass, g));
    const werte = [];
    const temperatur = zahlAus(hass, c.temperature, "current_temperature");
    const feuchte = zahlAus(hass, c.humidity, "current_humidity");
    const leistungen = bewertungen.map((b) => b.leistung).filter((w) => w !== null);
    if (temperatur !== null) {
      werte.push('<span><ha-icon icon="mdi:thermometer"></ha-icon>' + zahlText(hass, temperatur, 1) + " °C</span>");
    }
    if (feuchte !== null) {
      werte.push('<span><ha-icon icon="mdi:water-percent"></ha-icon>' + zahlText(hass, feuchte, 0) + " %</span>");
    }
    if (leistungen.length) {
      const summe = leistungen.reduce((a, b) => a + b, 0);
      werte.push('<span class="leistung"><ha-icon icon="mdi:flash"></ha-icon>' + leistungText(hass, summe) + "</span>");
    }

    const chips = c.devices
      .map((g, i) => {
        if (!zeigtChip(g) || !istSichtbar(hass, g)) return "";
        const b = bewertungen[i];
        return '<button type="button" class="' + chipKlassen(b) + '" data-index="' + i + '"' + chipMerkmale(b) +
          ' title="' + esc(b.name) + '"' +
          ' aria-label="' + esc(b.name) + ", " + esc(b.text) + ', Details öffnen">' +
          '<ha-icon icon="' + esc(b.symbol) + '"></ha-icon></button>';
      })
      .join("");

    const klickbar = c.devices.length > 0 || (c.cards && c.cards.length > 0);
    const alarm = bewertungen.some((b) => b.ton === "alarm");

    this.shadowRoot.innerHTML =
      "<style>" + GEMEINSAME_STILE + KARTENSTILE + "</style>" +
      '<div class="raum' + (klickbar ? " klickbar" : "") + (alarm ? " alarm" : "") + '"' +
        (klickbar ? ' role="button" tabindex="0" aria-label="' + esc(c.name) + ', Details öffnen"' : "") + ">" +
        '<div class="raumkopf">' +
          '<div class="raumsymbol"><ha-icon icon="' + esc(c.icon || "mdi:home") + '"></ha-icon></div>' +
          '<div class="raumtext"><div class="raumname">' + esc(c.name) + '</div><div class="raumwerte">' + werte.join("") + "</div></div>" +
          '<div class="chips">' + chips + "</div>" +
        "</div>" +
      "</div>";

    const neueChips = this.shadowRoot.querySelector(".chips");
    neueChips.scrollLeft = scrollStand;
    this._ueberlaufMarkieren();
  }

  // Blendet die Chip-Zeile an der Seite aus, hinter der noch Chips liegen
  _ueberlaufMarkieren() {
    const chips = this.shadowRoot.querySelector(".chips");
    if (!chips) return;
    const rest = chips.scrollWidth - chips.clientWidth - chips.scrollLeft;
    chips.classList.toggle("links", chips.scrollLeft > 1);
    chips.classList.toggle("rechts", rest > 1);
  }

  _beiKlick(e) {
    if (!e.target.closest(".raum.klickbar")) return;
    const chip = e.target.closest(".chip");
    this._popupOeffnen(chip ? Number(chip.dataset.index) : null);
  }

  _beiTaste(e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("raum") && e.target.classList.contains("klickbar")) {
      e.preventDefault();
      this._popupOeffnen(null);
    }
  }

  _popupOeffnen(index) {
    this._popupSchliessen();
    const popup = document.createElement("room-quickview-card-popup");
    popup.konfigurieren(this._config, index, () => {
      this._popup = null;
      const raum = this.shadowRoot.querySelector(".raum");
      if (raum) raum.focus();
    }, this);
    popup.hass = this._hass;
    // Im Shadow Root von home-assistant oeffnet Home Assistant auch seine eigenen Dialoge.
    // Nur dort erreichen eingebettete Karten Theme und Kontext der Oberflaeche; ohne Home
    // Assistant, etwa auf der Testseite, bleibt document.body.
    const wirt = document.querySelector("home-assistant");
    (wirt && wirt.shadowRoot ? wirt.shadowRoot : document.body).appendChild(popup);
    this._popup = popup;
  }

  _popupSchliessen() {
    if (this._popup) this._popup.schliessen();
  }
}

/* --------------------------------------------------------------- Pop-up */

class RoomQuickviewCardPopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._zieht = false;
    this._signatur = "";
    this._beiTasteGebunden = (e) => {
      if (e.key === "Escape") this.schliessen();
    };
    this.shadowRoot.addEventListener("click", (e) => this._beiKlick(e));
    this.shadowRoot.addEventListener("change", (e) => this._beiAenderung(e));
    WEITERZUREICHENDE_EREIGNISSE.forEach((typ) => {
      this.shadowRoot.addEventListener(typ, (e) => this._weiterreichen(e));
    });
    // Waehrend der Regler gezogen wird, darf ein Neuzeichnen ihn nicht zuruecksetzen
    this.shadowRoot.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("regler")) this._zieht = true;
    });
    this._loslassenGebunden = () => {
      if (!this._zieht) return;
      this._zieht = false;
      if (this._hass) this._aktualisieren();
    };
  }

  konfigurieren(config, markiert, beimSchliessen, quelle) {
    this._config = config;
    this._markiert = markiert;
    this._beimSchliessen = beimSchliessen;
    this._quelle = quelle;
  }

  // Ereignisse wie hass-more-info gehen ueber die Raumkarte weiter, damit Home Assistant sie
  // auch dann erreicht, wenn das Pop-up ausnahmsweise an document.body haengt.
  // Oeffnet sich ein Detailfenster, schliesst das Pop-up, sonst laege es darueber.
  _weiterreichen(e) {
    const anDerSeite = this.getRootNode() === document;
    if (anDerSeite && this._quelle && this._quelle.isConnected) {
      e.stopPropagation();
      this._quelle.dispatchEvent(new CustomEvent(e.type, { detail: e.detail, bubbles: true, composed: true }));
    }
    if (e.type === "hass-more-info" || e.type === "show-dialog") this.schliessen();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._karten) this._karten.forEach((k) => { k.hass = hass; });
    if (this.isConnected) this._aktualisieren();
  }

  connectedCallback() {
    document.addEventListener("keydown", this._beiTasteGebunden);
    document.addEventListener("pointerup", this._loslassenGebunden);
    document.addEventListener("pointercancel", this._loslassenGebunden);
    this._datenLaden();
    this._zeichnen();
    const schliessen = this.shadowRoot.querySelector(".schliessen");
    if (schliessen) schliessen.focus();
    if (this._markiert !== null && this._markiert !== undefined) {
      const zeile = this.shadowRoot.querySelector('.geraet[data-index="' + this._markiert + '"]');
      if (zeile) zeile.scrollIntoView({ block: "nearest" });
    }
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._beiTasteGebunden);
    document.removeEventListener("pointerup", this._loslassenGebunden);
    document.removeEventListener("pointercancel", this._loslassenGebunden);
  }

  schliessen() {
    if (!this.isConnected) return;
    this.remove();
    if (this._beimSchliessen) this._beimSchliessen();
  }

  // Neu gezeichnet wird nur, wenn sich eine beteiligte Entitaet geaendert hat
  _aktualisieren() {
    if (this._zieht) return;
    const signatur = this._config.devices
      .map((g) => [g.entity, g.power, g.show_when && (g.show_when.entity || g.show_when)]
        .filter(Boolean)
        .map((id) => {
          const s = this._hass.states[id];
          return s ? s.state + "@" + s.last_updated : "-";
        })
        .join(","))
      .join("|");
    if (signatur === this._signatur) return;
    this._signatur = signatur;
    this._zeichnen();
  }

  // Das Geruest entsteht einmal; danach werden nur Geraeteliste und Verlaeufe erneuert,
  // damit eingebettete Karten bestehen bleiben und ihre Daten nicht neu laden
  _zeichnen() {
    const hass = this._hass;
    const c = this._config;
    if (!hass || !c) return;
    if (!this.shadowRoot.querySelector(".popup")) this._geruestBauen();

    this.shadowRoot.querySelector(".liste").innerHTML = c.devices
      .map((g, i) => (istSichtbar(hass, g) ? this._zeileHtml(g, bewerteGeraet(hass, g), i) : ""))
      .join("");
    this.shadowRoot.querySelector(".verlaeufe").innerHTML = this._verlaeufeHtml();
    this._diagrammeVerdrahten();
  }

  _geruestBauen() {
    this.shadowRoot.innerHTML =
      "<style>" + GEMEINSAME_STILE + POPUPSTILE + "</style>" +
      '<div class="abdunklung">' +
        '<div class="popup" role="dialog" aria-modal="true" aria-labelledby="titel">' +
          '<div class="popupkopf"><h2 id="titel">' + esc(this._config.name) + '</h2>' +
            '<button type="button" class="schliessen">Schließen</button></div>' +
          '<div class="liste"></div>' +
          '<div class="karten"></div>' +
          '<div class="verlaeufe"></div>' +
        "</div>" +
      "</div>";
    this._kartenEinsetzen();
  }

  // Zusatzkarten aus "cards:" erzeugt Home Assistant selbst, damit jede bekannte Karte geht
  async _kartenEinsetzen() {
    const konfigurationen = this._config.cards || [];
    if (!konfigurationen.length) return;
    const ablage = this.shadowRoot.querySelector(".karten");
    if (typeof window.loadCardHelpers !== "function") {
      ablage.innerHTML = '<div class="hinweis">Zusatzkarten nicht verfügbar</div>';
      return;
    }
    const helfer = await window.loadCardHelpers();
    this._karten = konfigurationen.map((k) => {
      const karte = helfer.createCardElement(k);
      karte.hass = this._hass;
      return karte;
    });
    ablage.append(...this._karten);
  }

  /* ------------------------------------------------------- Tooltips */

  // Maus: folgt dem Zeiger, verschwindet beim Verlassen. Finger: bleibt nach dem Antippen stehen.
  _diagrammeVerdrahten() {
    this.shadowRoot.querySelectorAll(".flaeche[data-diagramm]").forEach((flaeche) => {
      const zeigen = (e) => this._tippZeigen(flaeche, e.clientX);
      flaeche.addEventListener("pointerdown", zeigen);
      flaeche.addEventListener("pointermove", zeigen);
      flaeche.addEventListener("pointerleave", (e) => {
        if (e.pointerType === "mouse") this._tippVerbergen(flaeche);
      });
    });
  }

  _tippZeigen(flaeche, clientX) {
    const art = flaeche.dataset.diagramm;
    const d = this._diagramme && this._diagramme[art];
    if (!d) return;
    const hass = this._hass;
    const rahmen = flaeche.getBoundingClientRect();
    const anteil = Math.min(1, Math.max(0, (clientX - rahmen.left) / rahmen.width));
    const anzahl = d.reihen[0].werte.length;
    let index;
    let markeLinks;
    let markeBreite;
    let titel;
    let format;
    if (art === "leistung") {
      index = Math.round(anteil * (anzahl - 1));
      markeLinks = (index / (anzahl - 1)) * 100;
      markeBreite = 0;
      const uhr = new Intl.DateTimeFormat(sprache(hass), { hour: "2-digit", minute: "2-digit" });
      titel = uhr.format(new Date(d.start + index * d.dauer)) + "–" + uhr.format(new Date(d.start + (index + 1) * d.dauer));
      format = (w) => leistungText(hass, w);
    } else {
      index = Math.min(anzahl - 1, Math.floor(anteil * anzahl));
      markeBreite = 100 / anzahl;
      markeLinks = index * markeBreite;
      titel = new Intl.DateTimeFormat(sprache(hass), { weekday: "short", day: "2-digit", month: "2-digit" })
        .format(new Date(d.anfaenge[index]));
      format = (w) => zahlText(hass, w, 2) + " kWh";
    }
    const eintraege = d.reihen.map((r) => ({ name: r.name, farbe: r.farbe, wert: r.werte[index] }));

    let marke = flaeche.querySelector(".marke");
    let tipp = flaeche.querySelector(".tipp");
    if (!marke) {
      marke = document.createElement("div");
      tipp = document.createElement("div");
      tipp.className = "tipp";
      flaeche.append(marke, tipp);
    }
    marke.className = "marke " + (art === "leistung" ? "linie" : "band");
    marke.style.left = markeLinks + "%";
    marke.style.width = art === "leistung" ? "" : markeBreite + "%";
    tipp.innerHTML = tippHtml(titel, eintraege, format);

    // Waagerecht mittig zur Markierung, aber nie ueber den Diagrammrand hinaus
    tipp.style.left = "0px";
    const breite = tipp.offsetWidth;
    const mitte = ((markeLinks + markeBreite / 2) / 100) * rahmen.width;
    tipp.style.left = Math.min(rahmen.width - breite, Math.max(0, mitte - breite / 2)) + "px";
    // Oberhalb, wenn im Pop-up genug Platz ist, sonst unterhalb
    const popupOben = this.shadowRoot.querySelector(".popup").getBoundingClientRect().top;
    const obenFrei = rahmen.top - popupOben > tipp.offsetHeight + 8;
    tipp.style.bottom = obenFrei ? "calc(100% + 6px)" : "";
    tipp.style.top = obenFrei ? "" : "calc(100% + 6px)";
  }

  _tippVerbergen(flaeche) {
    flaeche.querySelectorAll(".marke, .tipp").forEach((el) => el.remove());
  }

  _zeileHtml(geraet, b, index) {
    let rechts = "";
    let zusatz = "";
    if (b.art === "schalter" || b.art === "rollladen") {
      rechts = '<button type="button" class="schalter" role="switch" data-index="' + index + '" aria-checked="' + b.an + '"' +
        ' aria-label="' + esc(b.name) + ' schalten"></button>';
    }
    if (b.art === "rollladen" && typeof b.position === "number") {
      zusatz = '<div class="zusatz"><input type="range" class="regler" data-index="' + index + '" min="0" max="100" step="5"' +
        ' value="' + b.position + '" aria-label="Position ' + esc(b.name) + '"></div>';
    }
    const klassen = "geraet" +
      (geraet.show_when ? " unter" : "") +
      (index === this._markiert ? " hervorgehoben" : "");
    return '<div class="' + klassen + '" data-index="' + index + '" style="--farbe:' + esc(b.farbe) + '">' +
      '<span class="' + chipKlassen(b) + '" aria-hidden="true"' + chipMerkmale(b) + '><ha-icon icon="' + esc(b.symbol) + '"></ha-icon></span>' +
      '<div class="gtext"><div class="gname">' + esc(b.name) + '</div><div class="gwert">' + zustandHtml(this._hass, b) + "</div>" +
        this._attributHtml(geraet, b) + "</div>" +
      rechts + zusatz +
    "</div>";
  }

  // Laedt einmal beim Oeffnen den Leistungsverlauf der letzten 24 h und die Tagesenergie der letzten 30 Tage
  _datenLaden() {
    const hass = this._hass;
    const geraete = this._config.devices;
    const jetzt = Date.now();
    const leistungsIds = geraete.filter(zeigtLeistungsverlauf).map((g) => g.power);
    const energieIds = geraete.filter((g) => g.energy).map((g) => g.energy);
    this._leistung = leistungsIds.length ? "laedt" : null;
    this._energie = energieIds.length ? "laedt" : null;

    if (leistungsIds.length) {
      const start = jetzt - STUNDEN_LEISTUNG * 3600 * 1000;
      hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(jetzt).toISOString(),
        entity_ids: leistungsIds,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false
      }).then((antwort) => {
        this._leistung = { start, ende: jetzt, daten: antwort || {} };
        this._zeichnen();
      }).catch((fehler) => {
        console.warn("room-quickview-card: Leistungsverlauf nicht geladen", fehler);
        this._leistung = "fehler";
        this._zeichnen();
      });
    }

    if (energieIds.length) {
      const anfaenge = tagesanfaenge(jetzt, TAGE_ENERGIE);
      hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(anfaenge[0]).toISOString(),
        end_time: new Date(jetzt).toISOString(),
        statistic_ids: energieIds,
        period: "day",
        types: ["change"],
        units: { energy: "kWh" }
      }).then((antwort) => {
        this._energie = { anfaenge, daten: antwort || {} };
        this._zeichnen();
      }).catch((fehler) => {
        console.warn("room-quickview-card: Energiestatistik nicht geladen", fehler);
        this._energie = "fehler";
        this._zeichnen();
      });
    }
  }

  _verlaeufeHtml() {
    this._diagramme = {};
    const leistung = this._leistungHtml();
    const energie = this._energieHtml();
    if (!leistung && !energie) return "";
    return '<p class="zwischentitel">Verläufe</p>' + leistung + energie;
  }

  _leistungHtml() {
    const hass = this._hass;
    const geraete = this._config.devices.filter(zeigtLeistungsverlauf);
    if (!geraete.length) return "";
    const l = this._leistung;
    let kopfRechts = "";
    let inhalt;
    if (l === "fehler") {
      inhalt = '<div class="hinweis">Verlauf nicht verfügbar</div>';
    } else if (!l || l === "laedt") {
      inhalt = '<div class="hinweis">Lade Verlauf …</div>';
    } else {
      const reihen = geraete.map((g, i) => ({
        bewertung: bewerteGeraet(hass, g),
        farbe: diagrammfarbe(g, i),
        werte: abschnittsmaxima(l.daten[g.power] || [], l.start, l.ende, ABSCHNITTE_LEISTUNG)
      }));
      const spitze = Math.max.apply(null, abschnittssummen(reihen));
      kopfRechts = STUNDEN_LEISTUNG + " h · Spitze " + leistungText(hass, spitze);
      this._diagramme.leistung = {
        reihen: reihen.map((r) => ({ name: r.bewertung.name, farbe: r.farbe, werte: r.werte })),
        start: l.start,
        dauer: (l.ende - l.start) / ABSCHNITTE_LEISTUNG
      };
      inhalt = '<div class="flaeche" data-diagramm="leistung">' + flaechenSvg(reihen) + "</div>" +
        '<div class="legende">' + reihen.map((r) => {
          const jetzt = r.bewertung.leistung;
          return '<span><i style="background:' + esc(r.farbe) + '"></i>' + esc(r.bewertung.name) +
            (jetzt !== null ? " " + leistungText(hass, jetzt) : "") + "</span>";
        }).join("") + "</div>";
    }
    return '<div class="diagramm"><div class="dkopf"><span>Leistung</span><span>' + kopfRechts + "</span></div>" + inhalt + "</div>";
  }

  _energieHtml() {
    const hass = this._hass;
    const geraete = this._config.devices.filter((g) => g.energy);
    if (!geraete.length) return "";
    const e = this._energie;
    let kopfRechts = "";
    let inhalt;
    if (e === "fehler") {
      inhalt = '<div class="hinweis">Statistik nicht verfügbar</div>';
    } else if (!e || e === "laedt") {
      inhalt = '<div class="hinweis">Lade Statistik …</div>';
    } else {
      const reihen = geraete.map((g, i) => ({
        name: bewerteGeraet(hass, g).name,
        farbe: diagrammfarbe(g, i),
        werte: energieJeTag(e.daten[g.energy], e.anfaenge)
      }));
      const summen = reihen.map((r) => r.werte.reduce((a, b) => a + b, 0));
      const gesamt = summen.reduce((a, b) => a + b, 0);
      kopfRechts = TAGE_ENERGIE + " Tage · " + zahlText(hass, gesamt, 1) + " kWh";
      this._diagramme.energie = { reihen, anfaenge: e.anfaenge };
      inhalt = '<div class="flaeche" data-diagramm="energie">' + stapelSvg(reihen) + "</div>" +
        '<div class="legende">' + reihen.map((r, j) =>
          '<span><i style="background:' + esc(r.farbe) + '"></i>' + esc(r.name) + " " + zahlText(hass, summen[j], 1) + " kWh · " +
          (gesamt > 0 ? Math.round((summen[j] / gesamt) * 100) : 0) + " %</span>"
        ).join("") + "</div>";
    }
    return '<div class="diagramm"><div class="dkopf"><span>Energie je Tag</span><span>' + kopfRechts + "</span></div>" + inhalt + "</div>";
  }

  // Zusatzzeile aus einem Attribut der Entitaet, etwa der Grund einer Lueftungsempfehlung
  _attributHtml(geraet, b) {
    const wert = geraet.attribute && b.stateObj && b.stateObj.attributes[geraet.attribute];
    if (wert === undefined || wert === null || wert === "") return "";
    return '<div class="ghinweis">' + esc(wert) + "</div>";
  }

  _beiKlick(e) {
    if (!e.target.closest(".flaeche")) {
      this.shadowRoot.querySelectorAll(".flaeche").forEach((f) => this._tippVerbergen(f));
    }
    if (e.target.classList.contains("abdunklung") || e.target.closest(".schliessen")) {
      this.schliessen();
      return;
    }
    const schalter = e.target.closest(".schalter");
    if (schalter) this._schalten(this._config.devices[Number(schalter.dataset.index)]);
  }

  _beiAenderung(e) {
    if (!e.target.classList.contains("regler")) return;
    this._zieht = false;
    const geraet = this._config.devices[Number(e.target.dataset.index)];
    this._hass.callService("cover", "set_cover_position", { entity_id: geraet.entity, position: Number(e.target.value) });
  }

  _schalten(geraet) {
    const s = this._hass.states[geraet.entity];
    if (!s) return;
    const domaene = domaeneVon(geraet.entity);
    if (domaene === "cover") {
      this._hass.callService("cover", s.state === "closed" ? "open_cover" : "close_cover", { entity_id: geraet.entity });
      return;
    }
    this._hass.callService(domaene, s.state === "on" ? "turn_off" : "turn_on", { entity_id: geraet.entity });
  }
}

customElements.define("room-quickview-card", RoomQuickviewCard);
customElements.define("room-quickview-card-popup", RoomQuickviewCardPopup);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "room-quickview-card",
  name: "Room Quickview Card",
  description: "Raum auf einen Blick: Klima, Strom und Gerätezustand, Bedienung im Pop-up",
  preview: false
});
