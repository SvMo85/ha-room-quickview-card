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

import { RoomQuickviewCard } from "./karte.js";
import { RoomQuickviewCardPopup } from "./popup.js";

const CARD_VERSION = "0.4.2";

console.info(
  `%c ROOM-QUICKVIEW-CARD %c ${CARD_VERSION} `,
  "color: #16181a; background: #f2b632; font-weight: 700;",
  "color: #f2b632; background: #16181a;"
);

// Der Haltering dreht einen Winkel; animierbar ist er nur als registrierte Eigenschaft,
// und @property wirkt im Shadow DOM nicht, deshalb die Registrierung hier
try {
  CSS.registerProperty({ name: "--rqc-halten", syntax: "<angle>", inherits: false, initialValue: "0deg" });
} catch (fehler) {
  // bereits registriert, etwa nach erneutem Laden der Datei
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
