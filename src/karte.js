import { esc, zahlAus, zahlText, leistungText, istSichtbar, bewerteGeraet, chipMerkmale, chipKlassen, istHaltbar, zeigtChip } from "./bewertung.js";
import { HALTEDAUER_MS, HALTERING_ABSTAND_PX, BEWEGUNGSSCHWELLE_PX } from "./konstanten.js";
import { GEMEINSAME_STILE, KARTENSTILE } from "./stile.js";

export class RoomQuickviewCard extends HTMLElement {
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
    this.shadowRoot.addEventListener("pointerdown", (e) => this._haltenBeginnen(e));
    this.shadowRoot.addEventListener("pointermove", (e) => this._haltenPruefen(e));
    ["pointerup", "pointercancel", "pointerleave"].forEach((typ) => {
      this.shadowRoot.addEventListener(typ, () => this._haltenAbbrechen(), true);
    });
    // Langes Druecken soll kein Kontextmenue und keine Textauswahl ausloesen
    this.shadowRoot.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".chip.haltbar")) e.preventDefault();
    });
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
    if (geraete.some((g) => g.cards !== undefined && !Array.isArray(g.cards))) {
      throw new Error("room-quickview-card: cards eines Geraets muss eine Liste sein");
    }
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
    // Waehrend gehalten wird, wuerde Neuzeichnen den Ring entfernen; es folgt nach dem Halten
    if (this._halten) return;
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
        return '<button type="button" class="' + chipKlassen(b) + (istHaltbar(b) ? " haltbar" : "") + '" data-index="' + i + '"' + chipMerkmale(b) +
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
    // Der Klick nach einem vollendeten Halten oeffnet nicht zusaetzlich das Raum-Pop-up
    if (this._gehaltenBeendet) {
      this._gehaltenBeendet = false;
      return;
    }
    if (!e.target.closest(".raum.klickbar")) return;
    const chip = e.target.closest(".chip");
    this._popupOeffnen(chip ? Number(chip.dataset.index) : null);
  }

  /* ------------------------------------------------- langes Halten */

  // Halten auf dem Symbol eines bedienbaren Geraets oeffnet nach HALTEDAUER_MS dessen Detailfenster.
  // Ein Ring zeigt den Fortschritt; Bewegung, Scrollen oder Loslassen brechen ab.
  _haltenBeginnen(e) {
    const chip = e.target.closest(".chip.haltbar");
    if (!chip || e.button > 0) return;
    this._haltenAbbrechen();
    this._gehaltenBeendet = false;
    this._halten = { chip, x: e.clientX, y: e.clientY, ring: this._halteringAnlegen(chip) };
    chip.classList.add("haelt");
    this._halten.zeitgeber = setTimeout(() => {
      const geraet = this._config.devices[Number(chip.dataset.index)];
      this._haltenAbbrechen();
      this._gehaltenBeendet = true;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: geraet.entity }, bubbles: true, composed: true
      }));
    }, HALTEDAUER_MS);
  }

  _haltenPruefen(e) {
    if (!this._halten) return;
    if (Math.hypot(e.clientX - this._halten.x, e.clientY - this._halten.y) > BEWEGUNGSSCHWELLE_PX) this._haltenAbbrechen();
  }

  _haltenAbbrechen() {
    if (!this._halten) return;
    clearTimeout(this._halten.zeitgeber);
    this._halten.chip.classList.remove("haelt");
    this._halten.ring.remove();
    this.shadowRoot.querySelector(".raum").classList.remove("haelt");
    this._halten = null;
    this._aktualisieren();
  }

  // Ring als eigene Ebene in der Karte, um das Symbol herum ausgerichtet
  _halteringAnlegen(chip) {
    const raum = this.shadowRoot.querySelector(".raum");
    const r = raum.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const ring = document.createElement("div");
    ring.className = "haltering";
    ring.style.left = (c.left - r.left - raum.clientLeft - HALTERING_ABSTAND_PX) + "px";
    ring.style.top = (c.top - r.top - raum.clientTop - HALTERING_ABSTAND_PX) + "px";
    ring.style.width = (c.width + 2 * HALTERING_ABSTAND_PX) + "px";
    ring.style.height = (c.height + 2 * HALTERING_ABSTAND_PX) + "px";
    raum.classList.add("haelt");
    raum.appendChild(ring);
    return ring;
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
