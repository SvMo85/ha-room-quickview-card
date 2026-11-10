// Chips kennen nur vier Farben: an, aus, Melder in Ordnung und Alarm.
// Geraetefarben aus der Konfiguration gelten nur in den Diagrammen.
export const FARBEN = {
  an: "#f2b632",
  aus: "#9fb3c4",
  ok: "#4caf50",
  alarm: "#e0524a",
  leistung: "#f2b632"
};

// Geraeteklassen, bei denen "an" eine Gefahr meldet; "aus" ist dort der gute Zustand
export const ALARMKLASSEN = ["smoke", "gas", "carbon_monoxide", "moisture", "heat", "safety", "problem", "tamper"];
export const SCHALTBARE_DOMAENEN = ["switch", "light", "fan", "input_boolean", "siren"];
export const OHNE_WERT = ["unavailable", "unknown"];
// Ereignisse, mit denen Karten Home Assistant um Detailfenster, Dialoge oder Hinweise bitten
export const WEITERZUREICHENDE_EREIGNISSE = ["hass-more-info", "show-dialog", "hass-notification"];
export const HALTEDAUER_MS = 1000;
// Abstand des Halterings um das Symbol; er liegt ueber der Karte, damit ihn der Finger nicht verdeckt
export const HALTERING_ABSTAND_PX = 10;
export const BEWEGUNGSSCHWELLE_PX = 8;
export const AKTIVE_ZUSTAENDE = ["on", "open", "opening", "closing", "playing", "paused", "home", "recording", "streaming"];

export const DOMAENENSYMBOLE = {
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

export const KLASSENSYMBOLE = {
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

export const KLASSENSYMBOLE_OFFEN = {
  door: "mdi:door-open",
  garage_door: "mdi:garage-open",
  window: "mdi:window-open",
  opening: "mdi:door-open"
};
