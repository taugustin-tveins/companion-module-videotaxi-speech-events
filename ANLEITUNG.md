# Anleitung: VIDEO.TAXI Speech in Bitfocus Companion

Vom Import des Moduls bis zum fertigen Button auf dem Stream Deck.

---

## 0. Voraussetzungen

- **Bitfocus Companion 5.x** (getestet mit 5.0.6).
- Die Chrome-Erweiterung **„VIDEO.TAXI - SPEECH EVENTS Controller"** ist
  installiert und ein **API-Key** ist in den Optionen hinterlegt.
- Companion und Chrome laufen auf **demselben Rechner** (Standard). Für einen
  anderen Rechner siehe Abschnitt „IP ändern" am Ende.
- Die Moduldatei **`videotaxi-speech-events-1.3.7.tgz`** liegt bereit.

---

## 1. Modul importieren

1. Companion öffnen und oben rechts auf die Weboberfläche gehen
   (`http://127.0.0.1:8000`).
2. Reiter **Connections** → oben auf **Manage Modules**.
3. **Import module package** wählen.
4. Die Datei **`videotaxi-speech-events-1.3.7.tgz`** auswählen.

Das Modul erscheint danach in der Modulliste. Ein `npm install` oder ein
Developer-Path ist nicht nötig.

---

## 2. Verbindung hinzufügen

1. Reiter **Connections** → **Add connection** (Plus).
2. Nach **„VIDEO.TAXI Speech"** suchen und auswählen.
3. Einen Namen vergeben oder den Vorschlag lassen.
   - **Wichtig:** Der Standard-Label lautet `VIDEO_TAXI_Speech`. Die fertigen
     Presets nutzen diesen Label in Button-Texten. Wenn du umbenennst, musst du
     in den Preset-Texten den Teil vor dem Doppelpunkt anpassen.
4. In den Einstellungen der Verbindung:
   - **WebSocket-IP (Bind-Adresse):** `127.0.0.1` lassen.
   - **WebSocket-Port:** `8465` lassen.
5. Speichern.

Der Status steht zunächst auf **gelb** („Warte auf Erweiterung …"). Das ist
normal, solange sich die Erweiterung noch nicht verbunden hat.

---

## 3. Erweiterung mit Companion verbinden

1. In Chrome die **Optionen** der Erweiterung öffnen
   (Rechtsklick auf das Symbol → Optionen, oder über `chrome://extensions`).
2. Karte **„Companion / Stream Deck"** suchen.
3. Die Verbindung **aktivieren** und als Adresse eintragen:
   `ws://127.0.0.1:8465` (gleicher Port wie im Modul).
4. Speichern.

In Companion wird der Verbindungsstatus jetzt **grün („OK")**. Damit steht die
Zwei-Wege-Verbindung: Companion schickt Befehle, die Erweiterung schickt
Status und Feedback zurück.

> Hinweis: Nicht gleichzeitig die alte `companion-bridge.js` laufen lassen, sonst
> ist der Port belegt.

---

## 4. Den ersten Button erstellen

Es gibt zwei Wege. Der schnellste ist ein **fertiges Preset**.

### Variante A: Fertiges Preset ziehen (empfohlen)

1. Reiter **Buttons** → eine Seite wählen.
2. Rechts den Reiter **Presets** öffnen.
3. Kategorie **„VIDEO.TAXI Speech"** aufklappen. Es gibt die Gruppen:
   - **Senden:** Start, Stopp, Start/Stopp-Umschalter, Vollbild öffnen,
     Vollbild schließen.
   - **Eingabesprachen:** DE / EN / ES / FR / IT, plus Nächste/Vorige Sprache.
   - **Zoom:** Zoom + / −.
   - **Vollbild-Schalter:** Audio-Übersetzung, Originalsprache, QR-Code,
     Event-Info-Link, Textrichtung (jeweils Umschalten).
4. Ein Preset mit der Maus auf ein freies Button-Feld **ziehen**.

Fertig. Der Button hat bereits Aktion, Beschriftung und (wo sinnvoll) ein
farbiges Feedback.

### Variante B: Button manuell aufbauen

1. Reiter **Buttons** → ein leeres Feld anklicken.
2. Unten bei **Add action** das Modul **„VIDEO.TAXI Speech"** wählen und eine
   Aktion aussuchen, z. B. **„Senden Start/Stopp"**.
3. Optional Beschriftung setzen: oben im Feld **Text**, z. B. `START`.
4. Optional ein **Feedback** hinzufügen (siehe nächster Abschnitt).

---

## 5. Feedback hinzufügen (Button färbt sich nach Zustand)

Beispiel: Button wird grün, solange gesendet wird.

1. Den Button im Reiter **Buttons** anklicken.
2. Bei **Add feedback** das Modul **„VIDEO.TAXI Speech"** wählen →
   **„Sendet gerade"**.
3. Die Farben stehen schon auf grün. Fertig.

Weitere Feedbacks gibt es für praktisch jede Einstellung: Fehler, Verbindung,
Eingabesprache, Session (Anlieferung), Anzeigesprache, Textrichtung, Zoom, die
vier Vollbild-Schalter und den Monitor. So kann ein Button immer den aktuellen
Zustand anzeigen.

---

## 6. Session wählen bei Vollbild-Aktionen

Die Vollbild-Aktionen (Anzeigesprache, Textrichtung, Zoom, die Schalter, Zoom
+/−, Vollbild öffnen) haben ein **Session-Dropdown** mit der Option
**„Aktive Anlieferungssession"**. Diese ist Standard: Der Button wirkt dann
automatisch auf die Session, die gerade zum Senden gewählt ist. Alternativ kann
eine feste Session hinterlegt werden.

---

## 7. Variablen im Button-Text nutzen (optional)

Im **Text**-Feld eines Buttons lassen sich Live-Werte einsetzen, z. B. die
aktuelle Eingabesprache:

```
SPRACHE
$(VIDEO_TAXI_Speech:language)
```

Der Teil vor dem Doppelpunkt ist der **Verbindungs-Label**. Den exakten Namen
findest du im Reiter **Variables** (Kopier-Symbol). Verfügbar sind u. a.
`sending`, `language`, `session`, `zoom`, `viewer_language`, `direction`,
`voiceover`, `original`, `qr`, `info`, `display`, `connected`.

---

## 8. IP ändern (Chrome auf anderem Rechner)

Standard ist `127.0.0.1` (nur lokal). Soll die Erweiterung von einem **anderen
Rechner** aus zugreifen:

1. In der Companion-Verbindung die **WebSocket-IP** auf eine im Netz
   erreichbare IP dieses Rechners setzen oder `0.0.0.0` für alle
   Schnittstellen. Der Server startet automatisch neu.
2. In der Erweiterung die Bridge-Adresse auf `ws://<diese-IP>:8465` ändern.
3. Die Ziel-IP muss in den `host_permissions` der Erweiterung erlaubt sein.

> Nur in vertrauenswürdigen Netzen nutzen; die Verbindung ist unverschlüsselt.

---

## Fehlersuche

| Problem | Ursache / Lösung |
|---|---|
| Status bleibt gelb | Erweiterung hat sich nicht verbunden. Adresse `ws://127.0.0.1:8465` und Aktivierung in den Optionen prüfen. |
| Status rot / Port belegt | Läuft noch die alte `companion-bridge.js`? Beenden. Nur ein Server pro Port. |
| Buttons reagieren nicht, obwohl grün | In Chrome einmal im Popup Start und Stopp drücken, damit der Hintergrunddienst aktiv ist. |
| Variable im Text bleibt leer | Verbindung wurde umbenannt. Im Text den Label-Teil vor dem Doppelpunkt an den echten Namen aus dem Reiter *Variables* anpassen. |
| Vollbild öffnet auf falschem Monitor | Aktion „Vollbild: Monitor wählen" nutzen oder in den Extension-Optionen den Monitor setzen. |

---

*Stand: Modul 1.3.7, Erweiterung 1.9.4.*
