# Room Quickview Card

Raumkarte für Home Assistant: zeigt einen Raum auf einen Blick, mit Temperatur, Luftfeuchte, Stromverbrauch und dem Zustand jedes Geräts als Symbol. Ein Tipp öffnet ein Pop-up mit allen Geräten, ihren Schaltern und den Verläufen für Leistung und Energie.

Entstanden, weil Schaltflächen auf einer Übersicht beim Scrollen am Telefon zu leicht getroffen werden. Die Raumkarte schaltet deshalb nie direkt: Jeder Tipp öffnet das Pop-up, geschaltet wird erst dort. Ein Tipp auf ein Gerätesymbol hebt das Gerät im Pop-up hervor.

![Raumkarten mit Klima, Leistung und Gerätesymbolen](https://raw.githubusercontent.com/SvMo85/ha-room-quickview-card/main/images/karten.png)

## Bedienung

- **Tipp auf die Karte** öffnet das Pop-up, **Tipp auf ein Gerätesymbol** öffnet es mit diesem Gerät hervorgehoben.
- **1 Sekunde halten** auf dem Symbol eines Schalters oder Rollladens öffnet das Detailfenster von Home Assistant für dieses Gerät. Ein leuchtender Ring um das Symbol zeigt den Fortschritt, auch wenn der Finger das Symbol verdeckt; Bewegen oder Loslassen bricht ab.
- Passen nicht alle Symbole in die Zeile, lässt sie sich **seitlich wischen**; ein weicher Rand zeigt, auf welcher Seite noch Symbole liegen.
- Im Pop-up werden Geräte **geschaltet**, Rollläden über die Knöpfe **Auf, Stopp, Zu** und einen **Positionsregler** gestellt.
- Schließen über das **X**, Escape oder einen Tipp daneben.
- In den Diagrammen zeigt **Mauszeiger oder Finger** die Werte des Zeitpunkts bzw. Tages je Gerät samt Summe. Senkrechtes Wischen scrollt dabei weiter das Pop-up.

![Pop-up mit Geräten, Leistung der letzten 24 Stunden und Energie je Tag](https://raw.githubusercontent.com/SvMo85/ha-room-quickview-card/main/images/popup.png)

## Farben

Die Gerätesymbole kennen nur wenige Farben, damit eine Übersicht voller Karten ruhig bleibt:

| Farbe | Bedeutung |
|---|---|
| Gelb | Gerät ist an oder läuft |
| Grau | Gerät ist aus |
| Grün | Melder (Rauch, Gas, Wasser …) meldet keine Gefahr |
| Rot, pulsierend | Melder schlägt Alarm; die Karte bekommt einen roten Rand |

Rollläden sind nie „an“: ihr Symbol bleibt grau und füllt sich von oben so weit, wie der Rollladen geschlossen ist. Eigene Farben je Zustand legt `states` fest.

Die Option `color` eines Geräts gilt nur in den Diagrammen.

## Installation

### Über HACS

1. HACS öffnen, oben rechts das Menü, **Custom repositories**
2. `https://github.com/SvMo85/ha-room-quickview-card` eintragen, Kategorie **Dashboard**
3. Die Karte herunterladen
4. Browser mit Strg+Shift+F5 neu laden

### Von Hand

1. `dist/room-quickview-card.js` nach `config/www/` kopieren
2. Unter Einstellungen > Dashboards > Ressourcen eintragen:
   `/local/room-quickview-card.js` als **JavaScript-Modul**
3. Browser neu laden

## Verwendung

```yaml
type: custom:room-quickview-card
name: Wohnzimmer
icon: mdi:sofa
temperature: sensor.living_room_temperature
humidity: sensor.living_room_humidity
devices:
  - entity: binary_sensor.living_room_smoke
    name: Rauchmelder
  - entity: cover.living_room_shutter
    name: Rollladen
  - entity: switch.living_room_projector
    name: Beamer
    icon: mdi:projector
    power: sensor.living_room_projector_power
    energy: sensor.living_room_projector_energy
    color: '#5aa9e6'
  - name: Server
    icon: mdi:server
    power: sensor.server_power
    energy: sensor.server_energy
```

### Optionen der Karte

| Option | Pflicht | Bedeutung |
|---|---|---|
| `name` | ja | Raumname |
| `icon` | | Raumsymbol, Standard `mdi:home` |
| `temperature` | | Sensor für die Temperatur, oder ein Thermostat (`climate.…`), dann gilt dessen `current_temperature` |
| `humidity` | | Sensor für die Luftfeuchte, oder ein Thermostat, dann gilt dessen `current_humidity` |
| `devices` | | Liste der Geräte, siehe unten |
| `cards` | | Liste beliebiger Home-Assistant-Karten, die im Pop-up zwischen Geräten und Verläufen erscheinen |

Die Leistung im Kartenkopf ist die Summe aller `power`-Sensoren der Geräte.

### Optionen eines Geräts

| Option | Bedeutung |
|---|---|
| `entity` | Entität des Geräts. Schalter, Lichter, Lüfter und `input_boolean` erhalten einen Schalter, Rollläden Schalter und Positionsregler. Ohne `entity` ist das Gerät ein reiner Verbraucher, der nur über `power` erscheint |
| `name` | Anzeigename, sonst der Name der Entität |
| `icon` | Symbol, sonst passend zu Domäne und Geräteklasse |
| `power` | Sensor für die aktuelle Leistung in W |
| `energy` | Sensor für die Energie in kWh; speist das Diagramm „Energie je Tag“ aus der Langzeitstatistik |
| `color` | Farbe des Geräts in den Diagrammen; ohne Angabe reihum eine Ersatzfarbe |
| `chip` | `false` blendet das Symbol auf der Karte aus; Standard: sichtbar, wenn `entity` gesetzt ist |
| `graph` | `false` nimmt das Gerät aus dem Diagramm „Leistung“ heraus |
| `show_when` | Gerät nur zeigen, wenn eine andere Entität aktiv ist: als Entitäts-ID oder als `{ entity, state }` mit einem Zustand oder einer Liste |
| `states` | Farbe, Symbol und angezeigter Text je Zustand (`color`, `icon`, `text`), zum Beispiel für Textsensoren oder einen umgekehrt arbeitenden Schalter; Farben `green`, `red`, `yellow`, `grey` oder ein Farbwert. `grey` gilt als „aus“. Rot ist hier nur eine Farbe und löst keinen Alarm aus |
| `attribute` | Attribut der Entität, das im Pop-up unter dem Zustand steht |
| `cards` | Liste beliebiger Home-Assistant-Karten, die im Pop-up eingerückt direkt unter diesem Gerät stehen, etwa ein Verlauf oder Schwellwerte, die zu ihm gehören |
| `alarm` | `true` behandelt das Gerät als Melder: grün ohne Gefahr, rot pulsierend bei `on`. Binärsensoren mit Geräteklasse wie `smoke` oder `moisture` sind das von selbst |

Beispiel für einen Textsensor mit eigenen Zuständen:

```yaml
- entity: sensor.basement_ventilation
  name: Kellerlüftung
  attribute: reason
  states:
    Lüften: { color: green, icon: mdi:curtains }
    Nicht Lüften: { color: red, icon: mdi:curtains-closed }
```

## Verläufe

Das Pop-up lädt beim Öffnen einmal:

- **Leistung**: die letzten 24 Stunden aus dem Verlauf, als gestapelte Fläche je Gerät. Je 15 Minuten zählt der höchste Wert, damit kurze Lastspitzen sichtbar bleiben.
- **Energie je Tag**: die letzten 30 Tage aus der Langzeitstatistik, als gestapelte Balken je Gerät mit Anteil in Prozent.

## Entwicklung

`test/index.html` zeigt die Karte mit simulierten Home-Assistant-Daten. Weil ES-Module nicht über `file://` laden, braucht die Seite einen lokalen Webserver, zum Beispiel:

```
python -m http.server 8765 --bind 127.0.0.1
```

Dann `http://127.0.0.1:8765/test/index.html` öffnen.
