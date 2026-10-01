# Companion-Modul: VIDEO.TAXI SPEECH EVENTS

Eigenes Bitfocus-Companion-Modul zur Steuerung der Chrome-Erweiterung
**VIDEO.TAXI - SPEECH EVENTS Controller** — mit fertigen **Aktionen,
Feedbacks, Variablen und Presets**. Das Modul **öffnet selbst** einen lokalen
WebSocket-Server; die separate `companion-bridge.js` wird dadurch **überflüssig**.

> Für **Companion 5.x**. SDK `@companion-module/base ~2.0.4`, gegen den
> offiziellen `companion-module-check` validiert und als Paket gebaut.
> Lokales Modul — nicht in der offiziellen Registry.

## Einrichten (empfohlen: fertiges Paket importieren)

Companion 5.x kann das gebaute Paket direkt laden — **kein `npm install`,
kein Developer-Path** nötig:

1. **Paket importieren:** Companion → **Manage Modules → Import module package**
   → die Datei **`videotaxi-speech-events-1.0.0.tgz`** wählen.
2. **Verbindung hinzufügen:** *Connections* → Add → **„VIDEO.TAXI Speech"** →
   hinzufügen. **Port** lassen (Standard `8465`).
3. **Erweiterung verbinden:** in den Optionen der Chrome-Erweiterung
   (*Companion / Stream Deck*) **aktivieren**, Adresse `ws://127.0.0.1:8465`
   (gleicher Port wie im Modul).
   → Die alte `companion-bridge.js` wird **nicht** mehr gebraucht (nicht
   gleichzeitig laufen lassen — sonst ist der Port belegt).

Der Verbindungsstatus in Companion wird **grün („OK")**, sobald sich die
Erweiterung verbunden hat.

### Paket selbst neu bauen (nur bei Änderungen)

```bash
cd videotaxi-speech-events
npm install
npm run build      # erzeugt videotaxi-speech-events-<version>.tgz
```

### Alternative: als Developer module laden

Statt Import: in Companion unter *Settings* den „Developer modules path" auf den
Ordner **`companion-module`** setzen (den Ordner **über** diesem Modul), vorher
einmal `npm install` im Modulordner. Companion neu laden.

Der Verbindungsstatus in Companion wird **grün („OK")**, sobald sich die
Erweiterung verbunden hat (vorher „Warte auf Erweiterung …").

## Was das Modul mitbringt

**Aktionen** (Buttons → *Add action* → „VIDEO.TAXI Speech"):
- Senden Start/Stopp, Senden starten, Senden stoppen
- Nächste / Vorige Eingabesprache
- Transkript-Vollbild öffnen

**Feedbacks** (Button einfärben):
- „Sendet gerade" (Standard: grün)
- „Fehler" (Standard: rot)
- „Erweiterung verbunden"
- „Eingabesprache ist …" (mit Sprachcode)

**Variablen** (in Button-Text nutzbar, z. B. `$(VIDEO.TAXI Speech:language)`):
- `sending`, `status`, `error`, `language`, `session`, `level`, `connected`

**Presets** (fertige Buttons, *Presets*-Tab → Kategorien „Senden"/„Sprache"):
- „Senden Start/Stopp (grün wenn aktiv)", „Nächste/Vorige Eingabesprache",
  „Transkript-Vollbild öffnen" — einfach auf eine Seite ziehen.

## Neu in 1.1.0 (direkte Auswahl, Zoom, Presets)

- **Aktionen:** „Eingabesprache wählen" und „Session wählen (Anlieferung)" mit
  **Dropdown** (Liste kommt live aus der Erweiterung; vor dem Laden kann man per
  „allowCustom" auch einen Code tippen). Dazu „Browser-Zoom + / −".
- **Feedback** „Eingabesprache ist …" jetzt mit Sprach-Dropdown (grün bei Treffer;
  Code exakt oder Präfix wie `de`).
- **Variable** `zoom` (aktueller Zoom-Faktor).
- **Presets** (Tab *Presets*): Start (grün wenn aktiv), Stopp (rot wenn aktiv),
  Start/Stopp (grün=aktiv / rot=gestoppt), Eingabesprachen **DE/EN/ES/FR/IT** mit
  grünem Feedback bei aktiver Sprache, „Nächste/Vorige Sprache" mit aktueller
  Sprache als Text, „Zoom +/−" mit aktuellem Zoom als Text.

> **Wichtig zu den Variablen-Presets** (Sprache/Zoom als Button-Text): Der Text
> nutzt `$(VIDEO_TAXI_Speech:language)` bzw. `:zoom`. `VIDEO_TAXI_Speech` ist der
> **Standard-Verbindungs-Label** (von Companion aus „VIDEO.TAXI Speech" abgeleitet).
> Wenn du die Verbindung **umbenannt** hast und der Wert nicht erscheint, ersetze
> im Button-Text diesen Teil durch deinen Label (siehe *Variables*-Tab, Kopier-Symbol).

## Neu in 1.2.0 (Vollbild-Einstellungen pro Session)

Drei Aktionen setzen die Vollbild-Voreinstellungen **einer wählbaren Session**:
- **Vollbild: Anzeigesprache setzen** — Session-Dropdown + Anzeigesprache
  („Standard (Quellsprache)" oder eine Übersetzungssprache; die Liste ist die
  Union aller Räume — BC kann Dropdowns nicht nach der gewählten Session filtern,
  wähle also eine Sprache, die es in der Session gibt).
- **Vollbild: Textrichtung setzen** — Session + „Von unten nach oben" / „Von oben nach unten".
- **Vollbild: Browser-Zoom setzen** — Session + 100…300 %.

Die Werte gelten beim nächsten Öffnen des Vollbilds dieser Session (gleiche
Speicherung wie in den Extension-Optionen).

## Neu in 1.3.0 (mehr Vollbild-Schalter, Monitor, Feedbacks)

- **Zoom pro Session:** „Browser-Zoom + / −" haben jetzt ein Session-Dropdown.
- **Weitere Vollbild-Schalter** (je Session, An/Aus): „Audio-Übersetzung
  abspielen", „Transkript der Originalsprache anzeigen", „QR-Code anzeigen",
  „Event-Info-Link anzeigen".
- **Vollbild-Monitor wählen:** Aktion „Vollbild: Monitor wählen" (Liste kommt
  live aus der Erweiterung).
- **Vollbild öffnen pro Session:** „Transkript-Vollbild öffnen" hat jetzt ein
  Session-Dropdown (leer = aktive Session).
- **Feedbacks für alle Optionen** der aktiven Session: Anzeigesprache,
  Textrichtung, Zoom, Audio-Übersetzung, Originalsprache, QR-Code,
  Event-Info-Link und Monitor.
- **Variablen** dazu: `viewer_language`, `direction`, `voiceover`, `original`,
  `qr`, `info`, `display`.

## Aktuelle Sprache am Button anzeigen

Beim Sprach-Button im **Style**-Textfeld z. B. eintragen:
```
SPRACHE
$(VIDEO.TAXI Speech:language)
```
(Der Teil vor dem Doppelpunkt ist der **Verbindungs-Label** — nimm exakt den
aus der Variablenliste; per Kopier-Symbol in *Variables*.)

## Hinweise / Grenzen

- Alles läuft **lokal** (127.0.0.1). Der Server ist nicht von außen erreichbar.
- Nur **ein** Server pro Port: entweder dieses Modul **oder** die alte Bridge.
- Das Modul hält den Service-Worker der Erweiterung über einen Text-Heartbeat
  wach.
- Update des Moduls: Dateien ersetzen, ggf. erneut `npm install`, Companion
  neu laden.
