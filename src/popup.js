import { domaeneVon, esc, sprache, zahlText, leistungText, istSichtbar, bewerteGeraet, zustandHtml, chipMerkmale, chipKlassen } from "./bewertung.js";
import { STUNDEN_LEISTUNG, ABSCHNITTE_LEISTUNG, TAGE_ENERGIE, zeigtLeistungsverlauf, diagrammfarbe, abschnittsmaxima, tagesanfaenge, energieJeTag, abschnittssummen, flaechenSvg, tippHtml, stapelSvg } from "./diagramme.js";
import { WEITERZUREICHENDE_EREIGNISSE } from "./konstanten.js";
import { GEMEINSAME_STILE, POPUPSTILE } from "./stile.js";

export class RoomQuickviewCardPopup extends HTMLElement {
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
      if (!e.target.classList.contains("regler")) return;
      this._zieht = true;
      this._reglerwertZeigen(e.target);
    });
    this.shadowRoot.addEventListener("input", (e) => {
      if (this._zieht && e.target.classList.contains("regler")) this._reglerwertZeigen(e.target);
    });
    this._loslassenGebunden = () => {
      if (!this._zieht) return;
      this._zieht = false;
      this._reglerwerteVerbergen();
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

  // Das Geruest entsteht einmal; danach werden nur die Geraetezeilen und die Verlaeufe erneuert,
  // damit eingebettete Karten bestehen bleiben und ihre Daten nicht neu laden
  _zeichnen() {
    const hass = this._hass;
    const c = this._config;
    if (!hass || !c) return;
    if (!this.shadowRoot.querySelector(".popup")) this._geruestBauen();

    c.devices.forEach((g, i) => {
      const eintrag = this.shadowRoot.querySelector('.eintrag[data-index="' + i + '"]');
      const sichtbar = istSichtbar(hass, g);
      eintrag.hidden = !sichtbar;
      eintrag.querySelector(".zeile").innerHTML = sichtbar ? this._zeileHtml(g, bewerteGeraet(hass, g), i) : "";
    });
    this.shadowRoot.querySelector(".verlaeufe").innerHTML = this._verlaeufeHtml();
    this._diagrammeVerdrahten();
  }

  // Je Geraet ein Eintrag aus Zeile und den Karten des Geraets; nur die Zeile wird neu gezeichnet
  _geruestBauen() {
    const eintraege = this._config.devices
      .map((_, i) => '<div class="eintrag" data-index="' + i + '"><div class="zeile"></div><div class="geraetkarten"></div></div>')
      .join("");
    this.shadowRoot.innerHTML =
      "<style>" + GEMEINSAME_STILE + POPUPSTILE + "</style>" +
      '<div class="abdunklung">' +
        '<div class="popup" role="dialog" aria-modal="true" aria-labelledby="titel">' +
          '<div class="popupkopf">' +
            '<button type="button" class="schliessen" aria-label="Schließen" title="Schließen"><ha-icon icon="mdi:close"></ha-icon></button>' +
            '<h2 id="titel">' + esc(this._config.name) + "</h2>" +
            "</div>" +
          '<div class="liste">' + eintraege + "</div>" +
          '<div class="karten"></div>' +
          '<div class="verlaeufe"></div>' +
        "</div>" +
      "</div>";
    this._kartenEinsetzen();
  }

  // Zusatzkarten aus "cards:" des Raums und der Geraete erzeugt Home Assistant selbst,
  // damit jede bekannte Karte geht
  async _kartenEinsetzen() {
    const ablagen = [{ ablage: this.shadowRoot.querySelector(".karten"), konfigurationen: this._config.cards || [] }];
    this._config.devices.forEach((g, i) => {
      ablagen.push({
        ablage: this.shadowRoot.querySelector('.eintrag[data-index="' + i + '"] .geraetkarten'),
        konfigurationen: g.cards || []
      });
    });
    const gefuellt = ablagen.filter((a) => a.konfigurationen.length);
    if (!gefuellt.length) return;
    if (typeof window.loadCardHelpers !== "function") {
      gefuellt.forEach((a) => { a.ablage.innerHTML = '<div class="hinweis">Zusatzkarten nicht verfügbar</div>'; });
      return;
    }
    const helfer = await window.loadCardHelpers();
    this._karten = [];
    gefuellt.forEach((a) => {
      const karten = a.konfigurationen.map((k) => {
        const karte = helfer.createCardElement(k);
        karte.hass = this._hass;
        return karte;
      });
      this._karten.push(...karten);
      a.ablage.append(...karten);
    });
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
    if (b.art === "schalter") {
      rechts = '<button type="button" class="schalter" role="switch" data-index="' + index + '" aria-checked="' + b.an + '"' +
        ' aria-label="' + esc(b.name) + ' schalten"></button>';
    }
    if (b.art === "rollladen") {
      zusatz = '<div class="zusatz">' + this._rollladenknoepfeHtml(b, index) +
        (typeof b.position === "number"
          ? '<div class="reglerrahmen"><input type="range" class="regler" data-index="' + index + '" min="0" max="100" step="1"' +
            ' value="' + b.position + '" aria-label="Position ' + esc(b.name) + '">' +
            '<span class="reglerwert" aria-hidden="true" hidden></span></div>'
          : "") +
        "</div>";
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

  // Auf, Stopp, Zu; ganz offen sperrt Auf, ganz geschlossen sperrt Zu
  _rollladenknoepfeHtml(b, index) {
    const ganzOffen = b.position === 100 || (b.position === undefined && b.stateObj.state === "open");
    const ganzZu = b.stateObj.state === "closed";
    const knopf = (aktion, symbol, text, gesperrt) =>
      '<button type="button" data-index="' + index + '" data-rollladen="' + aktion + '" aria-label="' + text + " " + esc(b.name) + '"' +
        ' title="' + text + '"' + (gesperrt ? " disabled" : "") + '><ha-icon icon="' + symbol + '"></ha-icon></button>';
    return '<div class="rollladenknoepfe">' +
      knopf("open_cover", "mdi:arrow-up", "Auf", ganzOffen) +
      knopf("stop_cover", "mdi:stop", "Stopp", false) +
      knopf("close_cover", "mdi:arrow-down", "Zu", ganzZu) +
      "</div>";
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
    const rollladen = e.target.closest("[data-rollladen]");
    if (rollladen) {
      const geraet = this._config.devices[Number(rollladen.dataset.index)];
      this._hass.callService("cover", rollladen.dataset.rollladen, { entity_id: geraet.entity });
    }
  }

  _beiAenderung(e) {
    if (!e.target.classList.contains("regler")) return;
    this._zieht = false;
    this._reglerwerteVerbergen();
    const geraet = this._config.devices[Number(e.target.dataset.index)];
    this._hass.callService("cover", "set_cover_position", { entity_id: geraet.entity, position: Number(e.target.value) });
  }

  _reglerwertZeigen(regler) {
    const anzeige = regler.parentElement.querySelector(".reglerwert");
    anzeige.textContent = regler.value + " %";
    anzeige.style.setProperty("--wert", regler.value);
    anzeige.hidden = false;
  }

  _reglerwerteVerbergen() {
    this.shadowRoot.querySelectorAll(".reglerwert").forEach((anzeige) => { anzeige.hidden = true; });
  }

  _schalten(geraet) {
    const s = this._hass.states[geraet.entity];
    if (!s) return;
    const domaene = domaeneVon(geraet.entity);
    this._hass.callService(domaene, s.state === "on" ? "turn_off" : "turn_on", { entity_id: geraet.entity });
  }
}
