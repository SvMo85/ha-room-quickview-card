# Room Summary Card

Raumkarte für Home Assistant: zeigt einen Raum auf einen Blick, mit Temperatur, Luftfeuchte, Stromverbrauch und dem Zustand jedes Geräts als Symbol. Ein Tipp öffnet ein Pop-up mit allen Geräten, ihren Schaltern und den Verläufen für Leistung und Energie.

Entstanden, weil Schaltflächen auf einer Übersicht beim Scrollen am Telefon zu leicht getroffen werden. Die Raumkarte schaltet deshalb nie direkt: Jeder Tipp öffnet das Pop-up, geschaltet wird erst dort. Ein Tipp auf ein Gerätesymbol hebt das Gerät im Pop-up hervor.

## Installation

### Über HACS

1. HACS öffnen, oben rechts das Menü, **Custom repositories**
2. `https://github.com/SvMo85/ha-room-summary-card` eintragen, Kategorie **Dashboard**
3. Die Karte herunterladen
4. Browser mit Strg+Shift+F5 neu laden

### Von Hand

1. `dist/room-summary-card.js` nach `config/www/` kopieren
2. Unter Einstellungen > Dashboards > Ressourcen eintragen:
   `/local/room-summary-card.js` als **JavaScript-Modul**
3. Browser neu laden

## Verwendung

```yaml
type: custom:room-summary-card
name: Schlafzimmer
icon: mdi:bed
temperature: sensor.bedroom_temperature
humidity: sensor.bedroom_humidity
devices:
  - entity: cover.bedroom_shutter
    name: Rollladen
  - entity: switch.bedroom_desk
    name: Arbeitsplatz
    icon: mdi:desktop-classic
    power: sensor.bedroom_desk_power
    energy: sensor.bedroom_desk_energy
    color: '#f2b632'
```

Die vollständige Optionsübersicht folgt mit der ersten Version.
