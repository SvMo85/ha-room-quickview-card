import { FARBEN, ALARMKLASSEN, SCHALTBARE_DOMAENEN, OHNE_WERT, AKTIVE_ZUSTAENDE, DOMAENENSYMBOLE, KLASSENSYMBOLE, KLASSENSYMBOLE_OFFEN } from "./konstanten.js";

export function domaeneVon(entityId) {
  return entityId.split(".")[0];
}

export function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Zahl aus dem Zustand; bei einem Thermostat aus dem genannten Attribut, etwa current_temperature
export function zahlAus(hass, entityId, klimaAttribut) {
  const s = entityId ? hass.states[entityId] : undefined;
  if (!s || OHNE_WERT.includes(s.state)) return null;
  const roh = klimaAttribut && domaeneVon(entityId) === "climate" ? s.attributes[klimaAttribut] : s.state;
  const n = parseFloat(roh);
  return Number.isFinite(n) ? n : null;
}

export function sprache(hass) {
  return (hass.locale && hass.locale.language) || hass.language || "de";
}

export function zahlText(hass, wert, nachkomma) {
  return new Intl.NumberFormat(sprache(hass), {
    minimumFractionDigits: nachkomma,
    maximumFractionDigits: nachkomma
  }).format(wert);
}

// Unter 10 W eine Nachkommastelle, darueber und bei null ganze Watt
export function leistungText(hass, watt) {
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

export function istSichtbar(hass, geraet) {
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
export function bewerteGeraet(hass, geraet) {
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
export function zustandHtml(hass, b) {
  const mitLeistung = b.leistung !== null && b.leistung !== undefined && !(b.art === "schalter" && !b.an);
  const leistung = mitLeistung ? ' · <span class="leistung">' + leistungText(hass, b.leistung) + "</span>" : "";
  return esc(b.text) + leistung;
}

// Gemeinsame Merkmale eines Chips auf der Karte und im Pop-up
export function chipMerkmale(b) {
  const rollladen = b.art === "rollladen";
  return ' data-an="' + (rollladen ? false : b.an) + '" data-ton="' + b.ton + '"' +
    ' style="--farbe:' + esc(b.farbe) + (rollladen ? ";--zu:" + b.geschlossen + "%" : "") + '"';
}

export function chipKlassen(b) {
  return "chip" + (b.art === "rollladen" ? " rollladen" : "");
}

// Langes Halten oeffnet das Detailfenster nur bei Geraeten, die sich bedienen lassen
export function istHaltbar(b) {
  return Boolean(b.entity) && b.stateObj !== undefined && (b.art === "schalter" || b.art === "rollladen");
}

export function zeigtChip(geraet) {
  return geraet.chip !== undefined ? geraet.chip !== false : Boolean(geraet.entity);
}
