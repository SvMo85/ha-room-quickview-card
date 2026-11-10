import { FARBEN, HALTEDAUER_MS } from "./konstanten.js";

export const GEMEINSAME_STILE = `
  :host {
    --rsc-text: var(--primary-text-color, #e6eaee);
    --rsc-gedaempft: var(--secondary-text-color, #8d97a1);
    --rsc-karte: var(--ha-card-background, var(--card-background-color, #1b1f23));
    --rsc-linie: var(--divider-color, #2a3036);
    --rsc-flaeche: color-mix(in srgb, var(--rsc-text) 5%, transparent);
    --rsc-leistung: ${FARBEN.leistung};
    --rsc-alarm: ${FARBEN.alarm};
    --rsc-halten: ${FARBEN.an};
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

export const KARTENSTILE = `
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
    /* Raum fuer das beim Halten vergroesserte Symbol, ohne die Zeile hoeher zu machen */
    padding-block: 4px; margin-block: -4px;
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

  /* Langes Halten: ein leuchtender Ring laeuft gross um das Symbol herum voll. Er liegt als
     eigene Ebene ueber der Karte, weil die Chip-Leiste alles abschneidet, was ueber sie hinausragt. */
  .chip.haltbar { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
  .chip.haelt { transform: scale(1.15); transition: transform ${HALTEDAUER_MS}ms ease-out; }
  .raum { position: relative; }
  .raum.haelt { overflow: visible; }
  .haltering {
    position: absolute; z-index: 2; pointer-events: none; box-sizing: border-box;
    border-radius: 18px; padding: 4px;
    background:
      conic-gradient(var(--rsc-halten) var(--rqc-halten), color-mix(in srgb, var(--rsc-halten) 18%, transparent) 0);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    filter: drop-shadow(0 0 6px var(--rsc-halten)) drop-shadow(0 0 12px var(--rsc-halten));
    animation: halten ${HALTEDAUER_MS}ms linear forwards;
  }
  @keyframes halten { from { --rqc-halten: 0deg; } to { --rqc-halten: 360deg; } }
  @media (prefers-reduced-motion: reduce) { .raum { transition: none; } }
`;

export const POPUPSTILE = `
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
  /* Kopf wie in den Dialogen von Home Assistant: runder Schliessen-Knopf links vom Titel */
  .popupkopf { display: flex; align-items: center; gap: 8px; margin: -4px 0 0 -6px; }
  .popupkopf h2 { margin: 0; font-size: 1.25rem; font-weight: 400; line-height: 1.4; }
  .schliessen {
    flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; padding: 0;
    display: grid; place-items: center; border: none; background: transparent;
    color: var(--rsc-text); cursor: pointer; --mdc-icon-size: 24px;
  }
  .schliessen:hover { background: color-mix(in srgb, var(--rsc-text) 8%, transparent); }
  .schliessen:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }

  /* Rollladen: getrennte Knoepfe wie die Rollladen-Kachel von Home Assistant */
  .rollladenknoepfe { display: flex; gap: 8px; margin-bottom: 8px; }
  .rollladenknoepfe button {
    flex: 1; height: 42px; border-radius: 12px; border: none; padding: 0;
    display: grid; place-items: center; cursor: pointer; --mdc-icon-size: 22px;
    background: color-mix(in srgb, var(--rsc-text) 8%, transparent); color: var(--rsc-text);
    transition: background-color 120ms ease, transform 80ms ease;
  }
  .rollladenknoepfe button:hover { background: color-mix(in srgb, var(--rsc-text) 14%, transparent); }
  .rollladenknoepfe button:active { transform: scale(0.96); }
  .rollladenknoepfe button:focus-visible { outline: 2px solid var(--rsc-text); outline-offset: 2px; }
  .rollladenknoepfe button:disabled { opacity: 0.4; cursor: default; }
  .liste { display: flex; flex-direction: column; gap: 8px; }
  .karten, .verlaeufe { display: flex; flex-direction: column; gap: 10px; }
  .karten:empty, .verlaeufe:empty { display: none; }
  .eintrag { display: flex; flex-direction: column; gap: 8px; }
  .eintrag[hidden] { display: none; }
  /* Karten eines Geraets stehen eingerueckt unter seiner Zeile */
  .geraetkarten { display: flex; flex-direction: column; gap: 8px; margin-left: 22px; }
  .geraetkarten:empty { display: none; }

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
  .reglerrahmen { position: relative; }
  /* Folgt dem Knopf des Reglers und bleibt an den Enden innerhalb der Zeile */
  .reglerwert {
    position: absolute; z-index: 2; pointer-events: none; box-sizing: border-box;
    bottom: calc(100% + 8px); min-width: 48px; padding: 3px 8px; border-radius: 8px;
    left: clamp(24px, calc(8px + (100% - 16px) * var(--wert) / 100), calc(100% - 24px));
    transform: translateX(-50%);
    background: var(--rsc-karte); border: 1px solid color-mix(in srgb, var(--rsc-text) 18%, transparent);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    font-size: 0.9rem; font-weight: 600; text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums;
  }

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
