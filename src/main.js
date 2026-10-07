import { InstanceBase, InstanceStatus, Regex, combineRgb } from '@companion-module/base'
import { WebSocketServer } from 'ws'

// Farben
const C_WHITE = combineRgb(255, 255, 255)
const C_BLACK = combineRgb(20, 18, 14)
const C_GREEN = combineRgb(40, 140, 70)
const C_RED = combineRgb(176, 72, 58)
const C_GOLD = combineRgb(196, 132, 42)
const C_DARK = combineRgb(24, 22, 18)

const DEFAULT_PORT = 8465
const DEFAULT_HOST = '127.0.0.1'
const HEARTBEAT_MS = 20000
// Wird im Preset-Variablen-Text verwendet (Verbindungs-Label). Entspricht dem
// Standard-Label, das Companion aus dem Shortname „VIDEO.TAXI Speech" ableitet.
// Falls die Verbindung umbenannt wurde, im Button-Text anpassen.
const LABEL = 'VIDEO_TAXI_Speech'

class VideoTaxiSpeechInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.wss = null
		this.clients = new Set()
		this.heartbeat = null
		this.languages = [] // [{ code, name }] — Eingabesprachen (von der Erweiterung)
		this.viewerLanguages = [] // [{ code, name }] — Anzeigesprachen (Vollbild, Union)
		this.sessions = [] // [{ id, name }]
		this.displays = [] // [{ id, name }] — Monitore
		this.state = {
			sending: false,
			status: 'idle',
			error: '',
			language: '',
			session: '',
			level: 0,
			zoom: 1,
			viewerLanguage: '',
			direction: 'btt',
			voiceover: true,
			showOriginal: true,
			showQrCode: false,
			showInfoButton: true,
			display: '',
			connected: false,
		}
	}

	async init(config) {
		this.config = config
		this.initVariables()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
		this.startServer()
	}

	async destroy() {
		this.stopServer()
	}

	async configUpdated(config) {
		const portChanged = (config?.port || '') !== (this.config?.port || '')
		const hostChanged = (config?.host || '') !== (this.config?.host || '')
		this.config = config
		if (portChanged || hostChanged) {
			this.stopServer()
			this.startServer()
		}
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'So funktioniert es',
				value:
					'Dieses Modul öffnet einen WebSocket-Server. Trage in der Chrome-Erweiterung ' +
					'(Optionen → „Companion / Stream Deck") als Bridge-Adresse <b>ws://IP:PORT</b> ein ' +
					'(gleiche IP und Port wie unten). Eine separate Bridge ist dann nicht mehr nötig. ' +
					'Standard ist <b>127.0.0.1</b> (nur lokal). Für Zugriff von einem anderen Rechner eine ' +
					'erreichbare IP dieses Rechners eintragen oder <b>0.0.0.0</b> für alle Schnittstellen.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'WebSocket-IP (Bind-Adresse)',
				width: 8,
				default: DEFAULT_HOST,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'WebSocket-Port',
				width: 4,
				default: String(DEFAULT_PORT),
				regex: Regex.PORT,
			},
		]
	}

	getHost() {
		const h = String(this.config?.host || '').trim()
		return h || DEFAULT_HOST
	}

	getPort() {
		const p = parseInt(this.config?.port, 10)
		return Number.isFinite(p) && p > 0 ? p : DEFAULT_PORT
	}

	// --- WebSocket-Server -----------------------------------------------------
	startServer() {
		const port = this.getPort()
		const host = this.getHost()
		this.updateStatus(InstanceStatus.Connecting, 'Warte auf Erweiterung …')
		try {
			this.wss = new WebSocketServer({ host, port })
		} catch (err) {
			this.updateStatus(InstanceStatus.ConnectionFailure, String(err?.message || err))
			return
		}

		this.wss.on('listening', () => this.log('info', `WebSocket-Server läuft auf ws://${host}:${port}`))
		this.wss.on('error', (err) => {
			this.log('error', `Server-Fehler: ${err?.message || err}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, String(err?.message || err))
		})
		this.wss.on('connection', (ws) => {
			this.clients.add(ws)
			this.setConnected(true)
			ws.on('message', (data) => this.onMessage(String(data)))
			ws.on('close', () => {
				this.clients.delete(ws)
				if (this.clients.size === 0) this.setConnected(false)
			})
			ws.on('error', () => {
				this.clients.delete(ws)
				if (this.clients.size === 0) this.setConnected(false)
			})
		})

		// Text-Heartbeat hält den Service-Worker der Erweiterung wach.
		this.heartbeat = setInterval(() => {
			const hb = JSON.stringify({ type: 'hb', t: Date.now() })
			for (const ws of this.clients) {
				if (ws.readyState === ws.OPEN) {
					try {
						ws.send(hb)
					} catch {
						/* ignorieren */
					}
				}
			}
		}, HEARTBEAT_MS)
	}

	stopServer() {
		if (this.heartbeat) {
			clearInterval(this.heartbeat)
			this.heartbeat = null
		}
		for (const ws of this.clients) {
			try {
				ws.close()
			} catch {
				/* ignorieren */
			}
		}
		this.clients.clear()
		if (this.wss) {
			try {
				this.wss.close()
			} catch {
				/* ignorieren */
			}
			this.wss = null
		}
	}

	setConnected(connected) {
		this.state.connected = connected
		if (connected) {
			this.updateStatus(InstanceStatus.Ok)
		} else {
			this.state.level = 0
			this.updateStatus(InstanceStatus.Connecting, 'Warte auf Erweiterung …')
		}
		this.publish()
	}

	onMessage(text) {
		let msg
		try {
			msg = JSON.parse(text)
		} catch {
			return
		}
		if (!msg) return

		if (msg.type === 'state') {
			if ('sending' in msg) this.state.sending = !!msg.sending
			if ('status' in msg) this.state.status = String(msg.status ?? '')
			if ('error' in msg) this.state.error = String(msg.error ?? '')
			if ('language' in msg) this.state.language = String(msg.language ?? '')
			if ('session' in msg) this.state.session = String(msg.session ?? '')
			if ('level' in msg) this.state.level = Number(msg.level) || 0
			if ('zoom' in msg) this.state.zoom = Number(msg.zoom) || 1
			if ('viewerLanguage' in msg) this.state.viewerLanguage = String(msg.viewerLanguage ?? '')
			if ('direction' in msg) this.state.direction = msg.direction === 'ttb' ? 'ttb' : 'btt'
			if ('voiceover' in msg) this.state.voiceover = !!msg.voiceover
			if ('showOriginal' in msg) this.state.showOriginal = !!msg.showOriginal
			if ('showQrCode' in msg) this.state.showQrCode = !!msg.showQrCode
			if ('showInfoButton' in msg) this.state.showInfoButton = !!msg.showInfoButton
			if ('display' in msg) this.state.display = String(msg.display ?? '')
			this.publish()
		} else if (msg.type === 'languages') {
			this.languages = Array.isArray(msg.list) ? msg.list : []
			// Dropdowns neu aufbauen.
			this.initActions()
			this.initFeedbacks()
			this.initPresets()
		} else if (msg.type === 'sessions') {
			this.sessions = Array.isArray(msg.list) ? msg.list : []
			this.initActions()
		} else if (msg.type === 'viewerLanguages') {
			this.viewerLanguages = Array.isArray(msg.list) ? msg.list : []
			this.initActions()
			this.initFeedbacks()
		} else if (msg.type === 'displays') {
			this.displays = Array.isArray(msg.list) ? msg.list : []
			this.initActions()
			this.initFeedbacks()
		}
	}

	publish() {
		this.setVariableValues({
			sending: this.state.sending,
			status: this.state.status,
			error: this.state.error,
			language: this.state.language,
			session: this.state.session,
			level: this.state.level,
			zoom: this.state.zoom,
			viewer_language: this.state.viewerLanguage,
			direction: this.state.direction,
			voiceover: this.state.voiceover,
			original: this.state.showOriginal,
			qr: this.state.showQrCode,
			info: this.state.showInfoButton,
			display: this.state.display,
			connected: this.state.connected,
		})
		this.checkFeedbacks(
			'sending',
			'is_error',
			'ext_connected',
			'language_is',
			'session_is',
			'viewer_language_is',
			'direction_is',
			'zoom_is',
			'voiceover_on',
			'original_on',
			'qr_on',
			'info_on',
			'display_is'
		)
	}

	sendCmd(action, value) {
		this.sendCmdFields(action, value !== undefined ? { value } : {})
	}

	sendCmdFields(action, fields) {
		const text = JSON.stringify(Object.assign({ type: 'cmd', action }, fields || {}))
		let sent = 0
		for (const ws of this.clients) {
			if (ws.readyState === ws.OPEN) {
				try {
					ws.send(text)
					sent++
				} catch {
					/* ignorieren */
				}
			}
		}
		if (sent === 0) this.log('warn', `Befehl "${action}" nicht gesendet — keine Erweiterung verbunden.`)
	}

	languageMatches(value) {
		const cur = (this.state.language || '').toLowerCase()
		const t = (value || '').toLowerCase()
		return !!t && (cur === t || cur.startsWith(t))
	}

	langChoices() {
		return this.languages.length
			? this.languages.map((l) => ({ id: l.code, label: `${l.name} (${l.code})` }))
			: [{ id: 'de-DE', label: 'de-DE (Liste noch nicht geladen)' }]
	}

	sessionChoices() {
		return this.sessions.length
			? this.sessions.map((s) => ({ id: s.id, label: s.name }))
			: [{ id: '', label: '(Sessions noch nicht geladen)' }]
	}

	// Für Vollbild-Aktionen: zusätzlich die aktive Anlieferungssession (leere ID →
	// die Erweiterung nutzt die gerade gewählte Session, folgt also der Auswahl).
	viewerSessionChoices() {
		return [{ id: '', label: 'Aktive Anlieferungssession' }].concat(
			this.sessions.map((s) => ({ id: s.id, label: s.name }))
		)
	}

	viewerLangChoices() {
		return [{ id: '', label: 'Standard (Quellsprache)' }].concat(
			this.viewerLanguages.map((l) => ({ id: l.code, label: `${l.name} (${l.code})` }))
		)
	}

	displayChoices() {
		return [{ id: '', label: 'Standard (aktueller Bildschirm)' }].concat(
			this.displays.map((d) => ({ id: d.id, label: d.name }))
		)
	}

	// --- Definitionen ---------------------------------------------------------
	initVariables() {
		this.setVariableDefinitions({
			sending: { name: 'Sendet gerade (true/false)' },
			status: { name: 'Status (idle/connecting/sending/error/disconnected)' },
			error: { name: 'Fehlertext' },
			language: { name: 'Eingabesprache (Code)' },
			session: { name: 'Session-ID' },
			level: { name: 'Audiopegel (0–100)' },
			zoom: { name: 'Browser-Zoom (Faktor)' },
			connected: { name: 'Erweiterung verbunden (true/false)' },
			viewer_language: { name: 'Vollbild-Anzeigesprache (Code, "" = Quellsprache)' },
			direction: { name: 'Vollbild-Textrichtung (btt/ttb)' },
			voiceover: { name: 'Vollbild: Audio-Übersetzung (true/false)' },
			original: { name: 'Vollbild: Originalsprache (true/false)' },
			qr: { name: 'Vollbild: QR-Code (true/false)' },
			info: { name: 'Vollbild: Event-Info-Link (true/false)' },
			display: { name: 'Vollbild-Monitor (ID)' },
		})
		this.publish()
	}

	initActions() {
		const cmd = (action) => ({ options: [], callback: () => this.sendCmd(action) })
		const langDefault = this.languages[0]?.code || 'de-DE'
		const sessionDefault = this.sessions[0]?.id || ''
		const sess = () => ({
			type: 'dropdown',
			id: 'session',
			label: 'Session',
			default: '',
			choices: this.viewerSessionChoices(),
			allowCustom: true,
		})
		const ONOFF = [
			{ id: 'true', label: 'An' },
			{ id: 'false', label: 'Aus' },
			{ id: 'toggle', label: 'Umschalten' },
		]
		// Setz-Aktion für einen Vollbild-Schalter (Session + An/Aus).
		const viewerToggle = (name, action) => ({
			name,
			options: [sess(), { type: 'dropdown', id: 'value', label: 'Zustand', default: 'true', choices: ONOFF }],
			callback: (ev) => this.sendCmdFields(action, { session: ev.options.session, value: ev.options.value }),
		})

		this.setActionDefinitions({
			toggle_send: { name: 'Senden Start/Stopp', ...cmd('toggleSend') },
			send_start: { name: 'Senden starten', ...cmd('sendStart') },
			send_stop: { name: 'Senden stoppen', ...cmd('sendStop') },
			lang_next: { name: 'Nächste Eingabesprache', ...cmd('langNext') },
			lang_prev: { name: 'Vorige Eingabesprache', ...cmd('langPrev') },
			set_input_language: {
				name: 'Eingabesprache wählen',
				options: [
					{
						type: 'dropdown',
						id: 'lang',
						label: 'Sprache',
						default: langDefault,
						choices: this.langChoices(),
						allowCustom: true,
					},
				],
				callback: (ev) => this.sendCmd('setLanguage', ev.options.lang),
			},
			set_session: {
				name: 'Session wählen (Anlieferung)',
				options: [
					{
						type: 'dropdown',
						id: 'session',
						label: 'Session',
						default: sessionDefault,
						choices: this.sessionChoices(),
						allowCustom: true,
					},
				],
				callback: (ev) => this.sendCmd('setSession', ev.options.session),
			},
			zoom_next: {
				name: 'Browser-Zoom + (Session)',
				options: [sess()],
				callback: (ev) => this.sendCmdFields('zoomNext', { session: ev.options.session }),
			},
			zoom_prev: {
				name: 'Browser-Zoom − (Session)',
				options: [sess()],
				callback: (ev) => this.sendCmdFields('zoomPrev', { session: ev.options.session }),
			},

			// --- Vollbild-Einstellungen pro Session ---
			set_viewer_language: {
				name: 'Vollbild: Anzeigesprache setzen',
				options: [
					sess(),
					{ type: 'dropdown', id: 'lang', label: 'Anzeigesprache', default: '', choices: this.viewerLangChoices(), allowCustom: true },
				],
				callback: (ev) => this.sendCmdFields('setViewerLanguage', { session: ev.options.session, value: ev.options.lang }),
			},
			set_viewer_direction: {
				name: 'Vollbild: Textrichtung setzen',
				options: [
					sess(),
					{
						type: 'dropdown',
						id: 'dir',
						label: 'Textrichtung',
						default: 'btt',
						choices: [
							{ id: 'btt', label: 'Von unten nach oben' },
							{ id: 'ttb', label: 'Von oben nach unten' },
							{ id: 'toggle', label: 'Umschalten' },
						],
					},
				],
				callback: (ev) => this.sendCmdFields('setViewerDirection', { session: ev.options.session, value: ev.options.dir }),
			},
			set_viewer_zoom: {
				name: 'Vollbild: Browser-Zoom setzen',
				options: [
					sess(),
					{
						type: 'dropdown',
						id: 'zoom',
						label: 'Zoom',
						default: '1',
						choices: [
							{ id: '1', label: '100 %' },
							{ id: '1.25', label: '125 %' },
							{ id: '1.5', label: '150 %' },
							{ id: '1.75', label: '175 %' },
							{ id: '2', label: '200 %' },
							{ id: '2.5', label: '250 %' },
							{ id: '3', label: '300 %' },
						],
					},
				],
				callback: (ev) => this.sendCmdFields('setViewerZoom', { session: ev.options.session, value: ev.options.zoom }),
			},
			set_viewer_voiceover: viewerToggle('Vollbild: Audio-Übersetzung abspielen', 'setViewerVoiceover'),
			set_viewer_original: viewerToggle('Vollbild: Transkript der Originalsprache anzeigen', 'setViewerOriginal'),
			set_viewer_qr: viewerToggle('Vollbild: QR-Code anzeigen', 'setViewerQr'),
			set_viewer_info: viewerToggle('Vollbild: Event-Info-Link anzeigen', 'setViewerInfo'),

			// --- Vollbild-Monitor ---
			set_display: {
				name: 'Vollbild: Monitor wählen',
				options: [{ type: 'dropdown', id: 'display', label: 'Monitor', default: '', choices: this.displayChoices(), allowCustom: true }],
				callback: (ev) => this.sendCmdFields('setDisplay', { value: ev.options.display }),
			},

			open_fullscreen: {
				name: 'Transkript-Vollbild öffnen',
				options: [sess()],
				callback: (ev) => this.sendCmdFields('openFullscreen', { session: ev.options.session }),
			},
			close_fullscreen: { name: 'Transkript-Vollbild schließen', ...cmd('closeFullscreen') },
		})
	}

	initFeedbacks() {
		const langDefault = this.languages[0]?.code || 'de-DE'
		this.setFeedbackDefinitions({
			sending: {
				type: 'boolean',
				name: 'Sendet gerade',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [],
				callback: () => this.state.sending === true,
			},
			is_error: {
				type: 'boolean',
				name: 'Fehler',
				defaultStyle: { bgcolor: C_RED, color: C_WHITE },
				options: [],
				callback: () => this.state.status === 'error',
			},
			ext_connected: {
				type: 'boolean',
				name: 'Erweiterung verbunden',
				defaultStyle: { bgcolor: C_DARK, color: C_WHITE },
				options: [],
				callback: () => this.state.connected === true,
			},
			language_is: {
				type: 'boolean',
				name: 'Eingabesprache ist …',
				description: 'Grün, wenn die aktuelle Eingabesprache passt (Code exakt oder Präfix wie "de").',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [
					{
						type: 'dropdown',
						id: 'lang',
						label: 'Sprache',
						default: langDefault,
						choices: this.langChoices(),
						allowCustom: true,
					},
				],
				callback: (fb) => this.languageMatches(fb.options.lang),
			},
			session_is: {
				type: 'boolean',
				name: 'Session ist … (Anlieferung)',
				description: 'Grün, wenn die aktive Anlieferungs-Session passt.',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [{ type: 'dropdown', id: 'session', label: 'Session', default: this.sessions[0]?.id || '', choices: this.sessionChoices(), allowCustom: true }],
				callback: (fb) => String(this.state.session || '') === String(fb.options.session || ''),
			},
			viewer_language_is: {
				type: 'boolean',
				name: 'Vollbild-Anzeigesprache ist …',
				description: 'Grün, wenn die Anzeigesprache der aktiven Session passt ("" = Quellsprache).',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [{ type: 'dropdown', id: 'lang', label: 'Anzeigesprache', default: '', choices: this.viewerLangChoices(), allowCustom: true }],
				callback: (fb) => String(this.state.viewerLanguage || '') === String(fb.options.lang || ''),
			},
			direction_is: {
				type: 'boolean',
				name: 'Vollbild-Textrichtung ist …',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [
					{
						type: 'dropdown',
						id: 'dir',
						label: 'Textrichtung',
						default: 'btt',
						choices: [
							{ id: 'btt', label: 'Von unten nach oben' },
							{ id: 'ttb', label: 'Von oben nach unten' },
						],
					},
				],
				callback: (fb) => String(this.state.direction || '') === String(fb.options.dir),
			},
			zoom_is: {
				type: 'boolean',
				name: 'Vollbild-Zoom ist …',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [
					{
						type: 'dropdown',
						id: 'zoom',
						label: 'Zoom',
						default: '1',
						choices: [
							{ id: '1', label: '100 %' },
							{ id: '1.25', label: '125 %' },
							{ id: '1.5', label: '150 %' },
							{ id: '1.75', label: '175 %' },
							{ id: '2', label: '200 %' },
							{ id: '2.5', label: '250 %' },
							{ id: '3', label: '300 %' },
						],
					},
				],
				callback: (fb) => String(this.state.zoom) === String(fb.options.zoom),
			},
			voiceover_on: {
				type: 'boolean',
				name: 'Vollbild: Audio-Übersetzung an',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [],
				callback: () => this.state.voiceover === true,
			},
			original_on: {
				type: 'boolean',
				name: 'Vollbild: Originalsprache an',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [],
				callback: () => this.state.showOriginal === true,
			},
			qr_on: {
				type: 'boolean',
				name: 'Vollbild: QR-Code an',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [],
				callback: () => this.state.showQrCode === true,
			},
			info_on: {
				type: 'boolean',
				name: 'Vollbild: Event-Info-Link an',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [],
				callback: () => this.state.showInfoButton === true,
			},
			display_is: {
				type: 'boolean',
				name: 'Vollbild-Monitor ist …',
				defaultStyle: { bgcolor: C_GREEN, color: C_WHITE },
				options: [{ type: 'dropdown', id: 'display', label: 'Monitor', default: '', choices: this.displayChoices(), allowCustom: true }],
				callback: (fb) => String(this.state.display || '') === String(fb.options.display || ''),
			},
		})
	}

	initPresets() {
		const preset = (name, text, actionId, options, feedbacks, size) => ({
			type: 'simple',
			name,
			style: { text, size: size || '18', color: C_WHITE, bgcolor: C_DARK },
			steps: [{ down: [{ actionId, options: options || {} }], up: [] }],
			feedbacks: feedbacks || [],
		})

		const langPreset = (label, code) =>
			preset(
				`Eingabesprache ${label} (grün wenn aktiv)`,
				label,
				'set_input_language',
				{ lang: code },
				[{ feedbackId: 'language_is', options: { lang: code }, style: { bgcolor: C_GREEN, color: C_WHITE } }],
				'24'
			)

		// Umschalt-Preset für einen Vollbild-Schalter der aktiven Session (grün = An).
		const viewerTogglePreset = (name, text, actionId, feedbackId) =>
			preset(
				name,
				text,
				actionId,
				{ session: '', value: 'toggle' },
				[{ feedbackId, options: {}, style: { bgcolor: C_GREEN, color: C_WHITE } }],
				'14'
			)

		const presets = {
			start_green: preset('Start (grün wenn aktiv)', 'START', 'send_start', {}, [
				{ feedbackId: 'sending', options: {}, style: { bgcolor: C_GREEN, color: C_WHITE } },
			]),
			// Stop-Feedback invertiert: rot im gestoppten Zustand, damit Start und
			// Stopp nicht beide im gestarteten Zustand reagieren.
			stop_red: preset('Stopp (rot wenn gestoppt)', 'STOP', 'send_stop', {}, [
				{ feedbackId: 'sending', options: {}, isInverted: true, style: { bgcolor: C_RED, color: C_WHITE } },
			]),
			// Toggle: Feedback setzt auch den Button-Text (Sendet → „Stop", sonst → „Start").
			toggle_send: preset('Start/Stopp (grün „Stop" / rot „Start")', 'Start', 'toggle_send', {}, [
				{ feedbackId: 'sending', options: {}, style: { bgcolor: C_GREEN, color: C_WHITE, text: 'Stop' } },
				{ feedbackId: 'sending', options: {}, isInverted: true, style: { bgcolor: C_RED, color: C_WHITE, text: 'Start' } },
			]),
			open_fullscreen: preset('Transkript-Vollbild öffnen', 'VOLLBILD', 'open_fullscreen'),
			close_fullscreen: preset('Transkript-Vollbild schließen', 'VOLLBILD\nSCHLIESSEN', 'close_fullscreen', {}, [], '14'),

			lang_de: langPreset('DE', 'de-DE'),
			lang_en: langPreset('EN', 'en-GB'),
			lang_es: langPreset('ES', 'es-ES'),
			lang_fr: langPreset('FR', 'fr-FR'),
			lang_it: langPreset('IT', 'it-IT'),

			// ▲ zeigt nur das Label „Sprache", ▼ zeigt die aktuelle Sprache.
			lang_next_preset: preset('Nächste Sprache (▲ „Sprache")', '▲\nSprache', 'lang_next', {}, [], '14'),
			lang_prev_preset: preset('Vorige Sprache (▼ zeigt aktuelle)', `▼\n$(${LABEL}:language)`, 'lang_prev', {}, [], '14'),

			// ▲ zeigt nur das Label „Zoom", ▼ zeigt den aktuellen Zoom-Faktor.
			zoom_next_preset: preset('Zoom + (▲ „Zoom")', '▲\nZoom', 'zoom_next', {}, [], '14'),
			zoom_prev_preset: preset('Zoom − (▼ zeigt aktuellen)', `▼\n$(${LABEL}:zoom)`, 'zoom_prev', {}, [], '14'),

			// Toggle-Presets für die Vollbild-Schalter (aktive Session). Grün = An.
			voiceover_toggle: viewerTogglePreset('Audio-Übersetzung umschalten', 'AUDIO', 'set_viewer_voiceover', 'voiceover_on'),
			original_toggle: viewerTogglePreset('Originalsprache umschalten', 'ORIGINAL', 'set_viewer_original', 'original_on'),
			qr_toggle: viewerTogglePreset('QR-Code umschalten', 'QR', 'set_viewer_qr', 'qr_on'),
			info_toggle: viewerTogglePreset('Event-Info-Link umschalten', 'INFO', 'set_viewer_info', 'info_on'),

			// Textrichtung umschalten; Button zeigt die aktuelle Richtung (▲ unten→oben / ▼ oben→unten).
			direction_toggle: preset(
				'Textrichtung umschalten (zeigt aktuelle)',
				'RICHTUNG',
				'set_viewer_direction',
				{ session: '', dir: 'toggle' },
				[
					{ feedbackId: 'direction_is', options: { dir: 'btt' }, style: { bgcolor: C_GREEN, color: C_WHITE, text: '▲\nunten→oben' } },
					{ feedbackId: 'direction_is', options: { dir: 'ttb' }, style: { bgcolor: C_GREEN, color: C_WHITE, text: '▼\noben→unten' } },
				],
				'14'
			),
		}

		const structure = [
			{
				id: 'senden',
				name: 'Senden',
				definitions: ['start_green', 'stop_red', 'toggle_send', 'open_fullscreen', 'close_fullscreen'],
			},
			{
				id: 'sprachen',
				name: 'Eingabesprachen',
				definitions: ['lang_de', 'lang_en', 'lang_es', 'lang_fr', 'lang_it', 'lang_next_preset', 'lang_prev_preset'],
			},
			{ id: 'zoom', name: 'Zoom', definitions: ['zoom_next_preset', 'zoom_prev_preset'] },
			{
				id: 'vollbild',
				name: 'Vollbild-Schalter',
				definitions: ['voiceover_toggle', 'original_toggle', 'qr_toggle', 'info_toggle', 'direction_toggle'],
			},
		]

		this.setPresetDefinitions(structure, presets)
	}
}

export default VideoTaxiSpeechInstance
export const UpgradeScripts = []
