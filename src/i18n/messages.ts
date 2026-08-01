import type { Locale } from "./locales";

export type MessageKey =
  | "panelTitle"
  | "urlLabel"
  | "languageLabel"
  | "openBrowser"
  | "selectMode"
  | "selectModeOn"
  | "closeBrowser"
  | "attachLast"
  | "copyPaths"
  | "revealFolder"
  | "statusReady"
  | "statusSelectOn"
  | "statusBrowserOpen"
  | "statusLastPick"
  | "statusBrowserOpenUrl"
  | "statusSelectOnHover"
  | "statusSelectOff"
  | "statusBrowserClosed"
  | "statusCapturing"
  | "statusSavedAttached"
  | "statusSaved"
  | "statusPickFailed"
  | "statusPathsTerminal"
  | "statusPathsClipboard"
  | "statusError"
  | "msgBrowserOpened"
  | "msgSavedAttached"
  | "msgSavedManual"
  | "msgCopied"
  | "msgOpening"
  | "msgLanguageChanged"
  | "promptUrl"
  | "urlPlaceholder"
  | "errUrlEmpty"
  | "errBrowserNotOpen"
  | "errNoPick"
  | "errPrefix"
  | "cdpNeedLocalChrome"
  | "cdpActionStartChrome"
  | "cdpActionRetry"
  | "cdpActionCopyCmd"
  | "cdpReadyRetry"
  | "cdpReversePortHint"
  | "statusBarIdle"
  | "statusBarOn"
  | "statusBarBrowser"
  | "statusBarTooltip"
  | "badgeSelectOn"
  | "badgeBrowserOpen"
  | "lastLabel"
  | "hint"
  | "terminalName"
  | "defaultTerminalPrompt"
  | "cmdSelectLanguage"
  | "languagePickPlaceholder"
  | "browserChannelFallback"
  | "msgCdpConnected"
  | "msgLocalChromeStarted"
  | "actionMenu"
  | "actionMenuTooltip"
  | "actionMenuPlaceholder"
  | "openEditorUi"
  | "openEditorUiTooltip"
  | "reloadWebview"
  | "reloadWebviewTooltip"
  | "msgWebviewReloaded"
  | "controlsViewTitle"
  | "statusBarMenuTooltip";

type Dict = Record<MessageKey, string>;

const en: Dict = {
  panelTitle: "DaVinchi Element Picker",
  urlLabel: "URL",
  languageLabel: "Language",
  openBrowser: "Open browser",
  selectMode: "Select mode",
  selectModeOn: "Select mode ON",
  closeBrowser: "Close browser",
  attachLast: "Attach last → terminal",
  copyPaths: "Copy paths",
  revealFolder: "Reveal folder",
  statusReady: "Ready — open a browser URL",
  statusSelectOn: "Select mode ON — hover and click an element",
  statusBrowserOpen: "Browser open — enable Select mode",
  statusLastPick: "Last pick: {0}",
  statusBrowserOpenUrl: "Browser open: {0}",
  statusSelectOnHover:
    "Select mode ON — hover and click an element in the browser window",
  statusSelectOff: "Select mode OFF",
  statusBrowserClosed: "Browser closed",
  statusCapturing: "Capturing {0}…",
  statusSavedAttached: "Saved {0} → terminal + clipboard ({1})",
  statusSaved: "Saved {0} ({1})",
  statusPickFailed: "Pick failed: {0}",
  statusPathsTerminal: "Paths inserted into terminal",
  statusPathsClipboard: "Paths copied to clipboard",
  statusError: "Error: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: browser opened. Enable Select mode, then click an element.",
  msgSavedAttached:
    "DaVinchi Element Picker: saved {0} and attached paths to terminal + clipboard.",
  msgSavedManual:
    "DaVinchi Element Picker: saved {0}. Use Attach / Copy to send paths.",
  msgCopied: "DaVinchi Element Picker: paths copied to clipboard.",
  msgOpening: "DaVinchi Element Picker: opening {0}",
  msgLanguageChanged: "DaVinchi Element Picker language: {0}",
  promptUrl: "URL to open (any local or external link)",
  urlPlaceholder: "https://… or http://localhost:…",
  errUrlEmpty: "URL is empty — paste any address you want to inspect.",
  errBrowserNotOpen: "Browser is not connected. Open a URL first.",
  errNoPick:
    "No pick yet. Open browser, enable Select mode, click an element.",
  errPrefix: "DaVinchi Element Picker: {0}",
  cdpNeedLocalChrome:
    "Remote SSH: start Chrome on your Windows PC, reverse-forward port 9222, then retry.",
  cdpActionStartChrome: "Copy Chrome start script",
  cdpActionRetry: "Retry connect",
  cdpActionCopyCmd: "Copy script only",
  cdpReadyRetry:
    "When Chrome is running with --remote-debugging-port=9222 and port 9222 is reverse-forwarded, press Retry.",
  cdpReversePortHint:
    "Remote SSH: Ports panel → reverse forward 9222 → 9222 (or SSH RemoteForward 9222 localhost:9222).",
  statusBarIdle: "$(inspect) Element Pick",
  statusBarOn: "$(target) Pick: ON",
  statusBarBrowser: "$(inspect) Pick: browser",
  statusBarTooltip: "DaVinchi Element Picker: toggle select mode (Ctrl+Shift+E)",
  badgeSelectOn: "SELECT ON",
  badgeBrowserOpen: "browser open",
  lastLabel: "Last:",
  hint: "1. Paste <b>any URL</b> → Open browser (Remote SSH: Local Chrome CDP first).<br/>2. <b>Select mode</b> / <code>Ctrl+Shift+E</code> → click.<br/>3. Files in <code>.element-picks/</code>; paths → terminal + clipboard.",
  terminalName: "DaVinchi Element Picker",
  defaultTerminalPrompt:
    "UI context attached (screenshot + element HTML/CSS). Question: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Select Language",
  languagePickPlaceholder: "Select UI language (saved in user settings)",
  browserChannelFallback:
    'DaVinchi Element Picker: opened with browser channel "{0}" (preferred "{1}" unavailable).',
  msgCdpConnected:
    "DaVinchi: connected to local Chrome via CDP ({0}). Picks still save into this workspace.",
  msgLocalChromeStarted:
    "DaVinchi: PowerShell command copied. Run it on your Windows PC, reverse-forward port 9222 if Remote SSH, then Open browser.",
  actionMenu: "All actions…",
  actionMenuTooltip: "Native menu (works even if the webview fails)",
  actionMenuPlaceholder: "Choose a DaVinchi action",
  openEditorUi: "Open rich UI (editor)",
  openEditorUiTooltip:
    "Open DaVinchi controls as an editor tab — separate from the sidebar webview",
  reloadWebview: "Reload webview UI",
  reloadWebviewTooltip:
    "Remount sidebar/editor HTML if the webview Service Worker got stuck",
  msgWebviewReloaded: "DaVinchi: webview remounted. If still blank, use Controls tree or All actions…",
  controlsViewTitle: "Controls",
  statusBarMenuTooltip:
    "DaVinchi Element Picker — click for menu (Ctrl+Shift+E toggles select)",
};

const ru: Dict = {
  ...en,
  panelTitle: "DaVinchi Element Picker",
  urlLabel: "URL",
  languageLabel: "Язык",
  openBrowser: "Открыть браузер",
  selectMode: "Режим выбора",
  selectModeOn: "Режим выбора ВКЛ",
  closeBrowser: "Закрыть браузер",
  attachLast: "Вставить в terminal",
  copyPaths: "Копировать пути",
  revealFolder: "Открыть папку",
  statusReady: "Готово — откройте URL в браузере",
  statusSelectOn: "Режим выбора ВКЛ — наведите и кликните элемент",
  statusBrowserOpen: "Браузер открыт — включите режим выбора",
  statusLastPick: "Последний выбор: {0}",
  statusBrowserOpenUrl: "Браузер открыт: {0}",
  statusSelectOnHover:
    "Режим выбора ВКЛ — наведите и кликните элемент в окне браузера",
  statusSelectOff: "Режим выбора ВЫКЛ",
  statusBrowserClosed: "Браузер закрыт",
  statusCapturing: "Захват {0}…",
  statusSavedAttached: "Сохранено {0} → terminal + буфер ({1})",
  statusSaved: "Сохранено {0} ({1})",
  statusPickFailed: "Ошибка выбора: {0}",
  statusPathsTerminal: "Пути вставлены в terminal",
  statusPathsClipboard: "Пути скопированы в буфер",
  statusError: "Ошибка: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: браузер открыт. Включите режим выбора и кликните элемент.",
  msgSavedAttached:
    "DaVinchi Element Picker: сохранено {0}, пути в terminal и буфере.",
  msgSavedManual:
    "DaVinchi Element Picker: сохранено {0}. Используйте Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: пути скопированы в буфер.",
  msgOpening: "DaVinchi Element Picker: открытие {0}",
  msgLanguageChanged: "Язык DaVinchi Element Picker: {0}",
  promptUrl: "URL (любая локальная или внешняя ссылка)",
  urlPlaceholder: "https://… или http://localhost:…",
  errUrlEmpty: "URL пуст — вставьте любой адрес, который нужно разобрать.",
  errBrowserNotOpen: "Браузер не подключён. Сначала откройте URL.",
  errNoPick:
    "Ещё нет выбора. Откройте браузер, включите режим выбора, кликните элемент.",
  errPrefix: "DaVinchi Element Picker: {0}",
  cdpNeedLocalChrome:
    "Remote SSH: запустите Chrome на Windows PC, reverse-forward порт 9222, затем Retry.",
  cdpActionStartChrome: "Скопировать скрипт Chrome",
  cdpActionRetry: "Повторить подключение",
  cdpActionCopyCmd: "Только скопировать скрипт",
  cdpReadyRetry:
    "Когда Chrome с --remote-debugging-port=9222 запущен и порт 9222 reverse-forward — нажмите Retry.",
  cdpReversePortHint:
    "Remote SSH: Ports → reverse forward 9222 → 9222 (или SSH RemoteForward 9222 localhost:9222).",
  statusBarIdle: "$(inspect) Element Pick",
  statusBarOn: "$(target) Выбор: ВКЛ",
  statusBarBrowser: "$(inspect) Выбор: браузер",
  statusBarTooltip: "DaVinchi Element Picker: режим выбора (Ctrl+Shift+E)",
  badgeSelectOn: "ВЫБОР ВКЛ",
  badgeBrowserOpen: "браузер",
  lastLabel: "Последний:",
  hint: "1. Вставьте любой URL → <b>Open browser</b> (Remote SSH: сначала Local Chrome CDP).<br/>2. <b>Select mode</b> / <code>Ctrl+Shift+E</code> → клик.<br/>3. Файлы в <code>.element-picks/</code>; пути — в terminal и буфер.",
  terminalName: "DaVinchi Element Picker",
  defaultTerminalPrompt:
    "Контекст UI прикреплён (скриншот + HTML/CSS). Вопрос: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Выбрать язык",
  languagePickPlaceholder: "Язык интерфейса (сохраняется в настройках пользователя)",
  browserChannelFallback:
    'DaVinchi Element Picker: открыто через "{0}" (предпочтительный "{1}" недоступен).',
  msgCdpConnected:
    "DaVinchi: подключён к локальному Chrome через CDP ({0}). Пики сохраняются в этот workspace (SSH).",
  msgLocalChromeStarted:
    "DaVinchi: команда PowerShell скопирована. Запустите на Windows PC, reverse-forward 9222 при Remote SSH, затем Open browser.",
  actionMenu: "Все действия…",
  actionMenuTooltip: "Нативное меню (работает даже если webview сломан)",
  actionMenuPlaceholder: "Выберите действие DaVinchi",
  openEditorUi: "Открыть UI в редакторе",
  openEditorUiTooltip:
    "Панель DaVinchi во вкладке редактора — отдельно от sidebar webview",
  reloadWebview: "Перезагрузить webview",
  reloadWebviewTooltip:
    "Пересоздать HTML панели, если Service Worker webview «залип»",
  msgWebviewReloaded:
    "DaVinchi: webview пересоздан. Если пусто — используйте Controls или «Все действия…»",
  controlsViewTitle: "Управление",
  statusBarMenuTooltip:
    "DaVinchi Element Picker — клик: меню (Ctrl+Shift+E — режим выбора)",
};

const de: Dict = {
  ...en,
  urlLabel: "URL",
  languageLabel: "Sprache",
  openBrowser: "Browser öffnen",
  selectMode: "Auswahlmodus",
  selectModeOn: "Auswahlmodus AN",
  closeBrowser: "Browser schließen",
  attachLast: "In Terminal einfügen",
  copyPaths: "Pfade kopieren",
  revealFolder: "Ordner zeigen",
  statusReady: "Bereit — Browser-URL öffnen",
  statusSelectOn: "Auswahlmodus AN — Element markieren und klicken",
  statusBrowserOpen: "Browser offen — Auswahlmodus aktivieren",
  statusLastPick: "Letzte Auswahl: {0}",
  statusBrowserOpenUrl: "Browser offen: {0}",
  statusSelectOnHover:
    "Auswahlmodus AN — im Browserfenster markieren und klicken",
  statusSelectOff: "Auswahlmodus AUS",
  statusBrowserClosed: "Browser geschlossen",
  statusCapturing: "Erfasse {0}…",
  statusSavedAttached: "Gespeichert {0} → Terminal + Zwischenablage ({1})",
  statusSaved: "Gespeichert {0} ({1})",
  statusPickFailed: "Auswahl fehlgeschlagen: {0}",
  statusPathsTerminal: "Pfade ins Terminal eingefügt",
  statusPathsClipboard: "Pfade in die Zwischenablage kopiert",
  statusError: "Fehler: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: Browser geöffnet. Auswahlmodus aktivieren, dann Element klicken.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} gespeichert und Pfade an Terminal + Zwischenablage angehängt.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} gespeichert. Mit Attach / Copy senden.",
  msgCopied: "DaVinchi Element Picker: Pfade in die Zwischenablage kopiert.",
  msgOpening: "DaVinchi Element Picker: öffne {0}",
  msgLanguageChanged: "DaVinchi Element Picker Sprache: {0}",
  promptUrl: "Zu öffnende URL",
  errUrlEmpty: "URL ist leer.",
  errNoPick:
    "Noch keine Auswahl. Browser öffnen, Auswahlmodus aktivieren, Element klicken.",
  statusBarOn: "$(target) Pick: AN",
  statusBarTooltip: "DaVinchi Element Picker: Auswahlmodus (Ctrl+Shift+E)",
  badgeSelectOn: "AUSWAHL AN",
  badgeBrowserOpen: "Browser offen",
  lastLabel: "Zuletzt:",
  hint: "1. Browser öffnen → <b>Auswahlmodus</b> (oder <code>Ctrl+Shift+E</code>).<br/>2. Hover = Markierung, Klick = Element.<br/>3. Dateien in <code>.element-picks/</code>; Pfade in Terminal und Zwischenablage.",
  defaultTerminalPrompt:
    "UI-Kontext angehängt (Screenshot + HTML/CSS). Frage: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Sprache wählen",
  languagePickPlaceholder: "UI-Sprache wählen (wird in Benutzereinstellungen gespeichert)",
  browserChannelFallback:
    'DaVinchi Element Picker: mit Kanal "{0}" geöffnet (bevorzugt "{1}" nicht verfügbar).',
};

const es: Dict = {
  ...en,
  languageLabel: "Idioma",
  openBrowser: "Abrir navegador",
  selectMode: "Modo selección",
  selectModeOn: "Modo selección ON",
  closeBrowser: "Cerrar navegador",
  attachLast: "Pegar en terminal",
  copyPaths: "Copiar rutas",
  revealFolder: "Mostrar carpeta",
  statusReady: "Listo — abra una URL en el navegador",
  statusSelectOn: "Modo selección ON — pase el cursor y haga clic",
  statusBrowserOpen: "Navegador abierto — active el modo selección",
  statusLastPick: "Última selección: {0}",
  statusBrowserOpenUrl: "Navegador abierto: {0}",
  statusSelectOnHover:
    "Modo selección ON — pase el cursor y haga clic en el navegador",
  statusSelectOff: "Modo selección OFF",
  statusBrowserClosed: "Navegador cerrado",
  statusCapturing: "Capturando {0}…",
  statusSavedAttached: "Guardado {0} → terminal + portapapeles ({1})",
  statusSaved: "Guardado {0} ({1})",
  statusPickFailed: "Error de selección: {0}",
  statusPathsTerminal: "Rutas insertadas en el terminal",
  statusPathsClipboard: "Rutas copiadas al portapapeles",
  statusError: "Error: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: navegador abierto. Active el modo selección y haga clic en un elemento.",
  msgSavedAttached:
    "DaVinchi Element Picker: se guardó {0} y se adjuntaron las rutas al terminal y portapapeles.",
  msgSavedManual:
    "DaVinchi Element Picker: se guardó {0}. Use Attach / Copy para enviar rutas.",
  msgCopied: "DaVinchi Element Picker: rutas copiadas al portapapeles.",
  msgOpening: "DaVinchi Element Picker: abriendo {0}",
  msgLanguageChanged: "Idioma de DaVinchi Element Picker: {0}",
  promptUrl: "URL a abrir",
  errUrlEmpty: "La URL está vacía.",
  errNoPick:
    "Aún no hay selección. Abra el navegador, active el modo selección y haga clic.",
  statusBarOn: "$(target) Pick: ON",
  statusBarTooltip: "DaVinchi Element Picker: modo selección (Ctrl+Shift+E)",
  badgeSelectOn: "SELECCIÓN ON",
  badgeBrowserOpen: "navegador",
  lastLabel: "Último:",
  hint: "1. Abra el navegador → <b>Modo selección</b> (o <code>Ctrl+Shift+E</code>).<br/>2. Pase el cursor y haga clic en un elemento.<br/>3. Archivos en <code>.element-picks/</code>; rutas en terminal y portapapeles.",
  defaultTerminalPrompt:
    "Contexto de UI adjunto (captura + HTML/CSS). Pregunta: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Seleccionar idioma",
  languagePickPlaceholder: "Idioma de la UI (se guarda en ajustes de usuario)",
  browserChannelFallback:
    'DaVinchi Element Picker: abierto con canal "{0}" (preferido "{1}" no disponible).',
};

const fr: Dict = {
  ...en,
  languageLabel: "Langue",
  openBrowser: "Ouvrir le navigateur",
  selectMode: "Mode sélection",
  selectModeOn: "Mode sélection ON",
  closeBrowser: "Fermer le navigateur",
  attachLast: "Coller dans le terminal",
  copyPaths: "Copier les chemins",
  revealFolder: "Afficher le dossier",
  statusReady: "Prêt — ouvrez une URL dans le navigateur",
  statusSelectOn: "Mode sélection ON — survolez et cliquez un élément",
  statusBrowserOpen: "Navigateur ouvert — activez le mode sélection",
  statusLastPick: "Dernière sélection : {0}",
  statusBrowserOpenUrl: "Navigateur ouvert : {0}",
  statusSelectOnHover:
    "Mode sélection ON — survolez et cliquez dans la fenêtre du navigateur",
  statusSelectOff: "Mode sélection OFF",
  statusBrowserClosed: "Navigateur fermé",
  statusCapturing: "Capture de {0}…",
  statusSavedAttached: "Enregistré {0} → terminal + presse-papiers ({1})",
  statusSaved: "Enregistré {0} ({1})",
  statusPickFailed: "Échec de la sélection : {0}",
  statusPathsTerminal: "Chemins insérés dans le terminal",
  statusPathsClipboard: "Chemins copiés dans le presse-papiers",
  statusError: "Erreur : {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker : navigateur ouvert. Activez le mode sélection, puis cliquez un élément.",
  msgSavedAttached:
    "DaVinchi Element Picker : {0} enregistré, chemins joints au terminal et presse-papiers.",
  msgSavedManual:
    "DaVinchi Element Picker : {0} enregistré. Utilisez Attach / Copy.",
  msgCopied: "DaVinchi Element Picker : chemins copiés dans le presse-papiers.",
  msgOpening: "DaVinchi Element Picker : ouverture de {0}",
  msgLanguageChanged: "Langue DaVinchi Element Picker : {0}",
  promptUrl: "URL à ouvrir",
  errUrlEmpty: "L'URL est vide.",
  errNoPick:
    "Aucune sélection. Ouvrez le navigateur, activez le mode sélection, cliquez un élément.",
  statusBarTooltip: "DaVinchi Element Picker : mode sélection (Ctrl+Shift+E)",
  badgeSelectOn: "SÉLECTION ON",
  badgeBrowserOpen: "navigateur",
  lastLabel: "Dernier :",
  hint: "1. Ouvrez le navigateur → <b>Mode sélection</b> (ou <code>Ctrl+Shift+E</code>).<br/>2. Survolez pour surligner, cliquez un élément.<br/>3. Fichiers dans <code>.element-picks/</code> ; chemins dans le terminal et le presse-papiers.",
  defaultTerminalPrompt:
    "Contexte UI joint (capture + HTML/CSS). Question : ",
  cmdSelectLanguage: "DaVinchi Element Picker : Choisir la langue",
  languagePickPlaceholder: "Langue de l'interface (enregistrée dans les paramètres utilisateur)",
  browserChannelFallback:
    'DaVinchi Element Picker : ouvert avec le canal "{0}" (préféré "{1}" indisponible).',
};

const it: Dict = {
  ...en,
  languageLabel: "Lingua",
  openBrowser: "Apri browser",
  selectMode: "Modalità selezione",
  selectModeOn: "Modalità selezione ON",
  closeBrowser: "Chiudi browser",
  attachLast: "Incolla nel terminal",
  copyPaths: "Copia percorsi",
  revealFolder: "Mostra cartella",
  statusReady: "Pronto — apri un URL nel browser",
  statusSelectOn: "Selezione ON — passa il mouse e clicca un elemento",
  statusBrowserOpen: "Browser aperto — attiva la modalità selezione",
  statusLastPick: "Ultima selezione: {0}",
  statusBrowserOpenUrl: "Browser aperto: {0}",
  statusSelectOnHover:
    "Selezione ON — passa il mouse e clicca nella finestra del browser",
  statusSelectOff: "Selezione OFF",
  statusBrowserClosed: "Browser chiuso",
  statusCapturing: "Acquisizione di {0}…",
  statusSavedAttached: "Salvato {0} → terminal + appunti ({1})",
  statusSaved: "Salvato {0} ({1})",
  statusPickFailed: "Selezione non riuscita: {0}",
  statusPathsTerminal: "Percorsi inseriti nel terminal",
  statusPathsClipboard: "Percorsi copiati negli appunti",
  statusError: "Errore: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: browser aperto. Attiva la selezione e clicca un elemento.",
  msgSavedAttached:
    "DaVinchi Element Picker: salvato {0}, percorsi in terminal e appunti.",
  msgSavedManual:
    "DaVinchi Element Picker: salvato {0}. Usa Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: percorsi copiati negli appunti.",
  msgOpening: "DaVinchi Element Picker: apertura di {0}",
  msgLanguageChanged: "Lingua DaVinchi Element Picker: {0}",
  promptUrl: "URL da aprire",
  errUrlEmpty: "URL vuoto.",
  errNoPick:
    "Nessuna selezione. Apri il browser, attiva la selezione, clicca un elemento.",
  statusBarTooltip: "DaVinchi Element Picker: modalità selezione (Ctrl+Shift+E)",
  badgeSelectOn: "SELEZIONE ON",
  badgeBrowserOpen: "browser",
  lastLabel: "Ultimo:",
  hint: "1. Apri il browser → <b>Modalità selezione</b> (o <code>Ctrl+Shift+E</code>).<br/>2. Passa il mouse e clicca un elemento.<br/>3. File in <code>.element-picks/</code>; percorsi in terminal e appunti.",
  defaultTerminalPrompt:
    "Contesto UI allegato (screenshot + HTML/CSS). Domanda: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Seleziona lingua",
  languagePickPlaceholder: "Lingua UI (salvata nelle impostazioni utente)",
  browserChannelFallback:
    'DaVinchi Element Picker: aperto con canale "{0}" (preferito "{1}" non disponibile).',
};

const ptBR: Dict = {
  ...en,
  languageLabel: "Idioma",
  openBrowser: "Abrir navegador",
  selectMode: "Modo de seleção",
  selectModeOn: "Modo de seleção ON",
  closeBrowser: "Fechar navegador",
  attachLast: "Colar no terminal",
  copyPaths: "Copiar caminhos",
  revealFolder: "Mostrar pasta",
  statusReady: "Pronto — abra uma URL no navegador",
  statusSelectOn: "Seleção ON — passe o mouse e clique em um elemento",
  statusBrowserOpen: "Navegador aberto — ative o modo de seleção",
  statusLastPick: "Última seleção: {0}",
  statusBrowserOpenUrl: "Navegador aberto: {0}",
  statusSelectOnHover:
    "Seleção ON — passe o mouse e clique na janela do navegador",
  statusSelectOff: "Seleção OFF",
  statusBrowserClosed: "Navegador fechado",
  statusCapturing: "Capturando {0}…",
  statusSavedAttached: "Salvo {0} → terminal + área de transferência ({1})",
  statusSaved: "Salvo {0} ({1})",
  statusPickFailed: "Falha na seleção: {0}",
  statusPathsTerminal: "Caminhos inseridos no terminal",
  statusPathsClipboard: "Caminhos copiados para a área de transferência",
  statusError: "Erro: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: navegador aberto. Ative a seleção e clique em um elemento.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} salvo e caminhos anexados ao terminal e área de transferência.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} salvo. Use Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: caminhos copiados para a área de transferência.",
  msgOpening: "DaVinchi Element Picker: abrindo {0}",
  msgLanguageChanged: "Idioma do DaVinchi Element Picker: {0}",
  promptUrl: "URL para abrir",
  errUrlEmpty: "URL vazia.",
  errNoPick:
    "Ainda sem seleção. Abra o navegador, ative a seleção e clique em um elemento.",
  statusBarTooltip: "DaVinchi Element Picker: modo de seleção (Ctrl+Shift+E)",
  badgeSelectOn: "SELEÇÃO ON",
  badgeBrowserOpen: "navegador",
  lastLabel: "Último:",
  hint: "1. Abra o navegador → <b>Modo de seleção</b> (ou <code>Ctrl+Shift+E</code>).<br/>2. Passe o mouse e clique em um elemento.<br/>3. Arquivos em <code>.element-picks/</code>; caminhos no terminal e área de transferência.",
  defaultTerminalPrompt:
    "Contexto de UI anexado (screenshot + HTML/CSS). Pergunta: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Selecionar idioma",
  languagePickPlaceholder: "Idioma da UI (salvo nas configurações do usuário)",
  browserChannelFallback:
    'DaVinchi Element Picker: aberto com canal "{0}" (preferido "{1}" indisponível).',
};

const nl: Dict = {
  ...en,
  languageLabel: "Taal",
  openBrowser: "Browser openen",
  selectMode: "Selectiemodus",
  selectModeOn: "Selectiemodus AAN",
  closeBrowser: "Browser sluiten",
  attachLast: "Plakken in terminal",
  copyPaths: "Paden kopiëren",
  revealFolder: "Map tonen",
  statusReady: "Klaar — open een browser-URL",
  statusSelectOn: "Selectie AAN — hover en klik op een element",
  statusBrowserOpen: "Browser open — schakel selectiemodus in",
  statusLastPick: "Laatste selectie: {0}",
  statusBrowserOpenUrl: "Browser open: {0}",
  statusSelectOnHover:
    "Selectie AAN — hover en klik in het browservenster",
  statusSelectOff: "Selectie UIT",
  statusBrowserClosed: "Browser gesloten",
  statusCapturing: "{0} vastleggen…",
  statusSavedAttached: "Opgeslagen {0} → terminal + klembord ({1})",
  statusSaved: "Opgeslagen {0} ({1})",
  statusPickFailed: "Selectie mislukt: {0}",
  statusPathsTerminal: "Paden in terminal geplaatst",
  statusPathsClipboard: "Paden naar klembord gekopieerd",
  statusError: "Fout: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: browser geopend. Zet selectiemodus aan en klik op een element.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} opgeslagen, paden naar terminal + klembord.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} opgeslagen. Gebruik Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: paden naar klembord gekopieerd.",
  msgOpening: "DaVinchi Element Picker: openen {0}",
  msgLanguageChanged: "DaVinchi Element Picker-taal: {0}",
  promptUrl: "Te openen URL",
  errUrlEmpty: "URL is leeg.",
  errNoPick:
    "Nog geen selectie. Open browser, zet selectie aan, klik op een element.",
  statusBarOn: "$(target) Pick: AAN",
  statusBarTooltip: "DaVinchi Element Picker: selectiemodus (Ctrl+Shift+E)",
  badgeSelectOn: "SELECTIE AAN",
  badgeBrowserOpen: "browser open",
  lastLabel: "Laatste:",
  hint: "1. Open browser → <b>Selectiemodus</b> (of <code>Ctrl+Shift+E</code>).<br/>2. Hover om te markeren, klik op een element.<br/>3. Bestanden in <code>.element-picks/</code>; paden in terminal en klembord.",
  defaultTerminalPrompt:
    "UI-context bijgevoegd (screenshot + HTML/CSS). Vraag: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Taal selecteren",
  languagePickPlaceholder: "UI-taal (opgeslagen in gebruikersinstellingen)",
  browserChannelFallback:
    'DaVinchi Element Picker: geopend met kanaal "{0}" (voorkeur "{1}" niet beschikbaar).',
};

const pl: Dict = {
  ...en,
  languageLabel: "Język",
  openBrowser: "Otwórz przeglądarkę",
  selectMode: "Tryb wyboru",
  selectModeOn: "Tryb wyboru WŁ",
  closeBrowser: "Zamknij przeglądarkę",
  attachLast: "Wklej do terminala",
  copyPaths: "Kopiuj ścieżki",
  revealFolder: "Pokaż folder",
  statusReady: "Gotowe — otwórz URL w przeglądarce",
  statusSelectOn: "Wybór WŁ — najedź i kliknij element",
  statusBrowserOpen: "Przeglądarka otwarta — włącz tryb wyboru",
  statusLastPick: "Ostatni wybór: {0}",
  statusBrowserOpenUrl: "Przeglądarka otwarta: {0}",
  statusSelectOnHover:
    "Wybór WŁ — najedź i kliknij w oknie przeglądarki",
  statusSelectOff: "Wybór WYŁ",
  statusBrowserClosed: "Przeglądarka zamknięta",
  statusCapturing: "Przechwytywanie {0}…",
  statusSavedAttached: "Zapisano {0} → terminal + schowek ({1})",
  statusSaved: "Zapisano {0} ({1})",
  statusPickFailed: "Błąd wyboru: {0}",
  statusPathsTerminal: "Ścieżki wstawione do terminala",
  statusPathsClipboard: "Ścieżki skopiowane do schowka",
  statusError: "Błąd: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: przeglądarka otwarta. Włącz tryb wyboru i kliknij element.",
  msgSavedAttached:
    "DaVinchi Element Picker: zapisano {0}, ścieżki w terminalu i schowku.",
  msgSavedManual:
    "DaVinchi Element Picker: zapisano {0}. Użyj Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: ścieżki skopiowane do schowka.",
  msgOpening: "DaVinchi Element Picker: otwieranie {0}",
  msgLanguageChanged: "Język DaVinchi Element Picker: {0}",
  promptUrl: "URL do otwarcia",
  errUrlEmpty: "URL jest pusty.",
  errNoPick:
    "Brak wyboru. Otwórz przeglądarkę, włącz tryb wyboru, kliknij element.",
  statusBarOn: "$(target) Pick: WŁ",
  statusBarTooltip: "DaVinchi Element Picker: tryb wyboru (Ctrl+Shift+E)",
  badgeSelectOn: "WYBÓR WŁ",
  badgeBrowserOpen: "przeglądarka",
  lastLabel: "Ostatni:",
  hint: "1. Otwórz przeglądarkę → <b>Tryb wyboru</b> (lub <code>Ctrl+Shift+E</code>).<br/>2. Najedź — podświetlenie, kliknij element.<br/>3. Pliki w <code>.element-picks/</code>; ścieżki w terminalu i schowku.",
  defaultTerminalPrompt:
    "Kontekst UI dołączony (zrzut + HTML/CSS). Pytanie: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Wybierz język",
  languagePickPlaceholder: "Język UI (zapis w ustawieniach użytkownika)",
  browserChannelFallback:
    'DaVinchi Element Picker: otwarto kanałem "{0}" (preferowany "{1}" niedostępny).',
};

const tr: Dict = {
  ...en,
  languageLabel: "Dil",
  openBrowser: "Tarayıcıyı aç",
  selectMode: "Seçim modu",
  selectModeOn: "Seçim modu AÇIK",
  closeBrowser: "Tarayıcıyı kapat",
  attachLast: "Terminale yapıştır",
  copyPaths: "Yolları kopyala",
  revealFolder: "Klasörü göster",
  statusReady: "Hazır — tarayıcıda bir URL açın",
  statusSelectOn: "Seçim AÇIK — üzerine gelin ve öğeye tıklayın",
  statusBrowserOpen: "Tarayıcı açık — seçim modunu açın",
  statusLastPick: "Son seçim: {0}",
  statusBrowserOpenUrl: "Tarayıcı açık: {0}",
  statusSelectOnHover:
    "Seçim AÇIK — tarayıcı penceresinde üzerine gelin ve tıklayın",
  statusSelectOff: "Seçim KAPALI",
  statusBrowserClosed: "Tarayıcı kapatıldı",
  statusCapturing: "{0} yakalanıyor…",
  statusSavedAttached: "Kaydedildi {0} → terminal + pano ({1})",
  statusSaved: "Kaydedildi {0} ({1})",
  statusPickFailed: "Seçim başarısız: {0}",
  statusPathsTerminal: "Yollar terminale eklendi",
  statusPathsClipboard: "Yollar panoya kopyalandı",
  statusError: "Hata: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: tarayıcı açıldı. Seçim modunu açın ve bir öğeye tıklayın.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} kaydedildi, yollar terminal ve panoya eklendi.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} kaydedildi. Attach / Copy kullanın.",
  msgCopied: "DaVinchi Element Picker: yollar panoya kopyalandı.",
  msgOpening: "DaVinchi Element Picker: açılıyor {0}",
  msgLanguageChanged: "DaVinchi Element Picker dili: {0}",
  promptUrl: "Açılacak URL",
  errUrlEmpty: "URL boş.",
  errNoPick:
    "Henüz seçim yok. Tarayıcıyı açın, seçim modunu açın, öğeye tıklayın.",
  statusBarOn: "$(target) Pick: AÇIK",
  statusBarTooltip: "DaVinchi Element Picker: seçim modu (Ctrl+Shift+E)",
  badgeSelectOn: "SEÇİM AÇIK",
  badgeBrowserOpen: "tarayıcı",
  lastLabel: "Son:",
  hint: "1. Tarayıcıyı açın → <b>Seçim modu</b> (veya <code>Ctrl+Shift+E</code>).<br/>2. Vurgulamak için üzerine gelin, öğeye tıklayın.<br/>3. Dosyalar <code>.element-picks/</code>; yollar terminal ve panoda.",
  defaultTerminalPrompt:
    "UI bağlamı eklendi (ekran görüntüsü + HTML/CSS). Soru: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Dil seç",
  languagePickPlaceholder: "UI dili (kullanıcı ayarlarına kaydedilir)",
  browserChannelFallback:
    'DaVinchi Element Picker: "{0}" kanalıyla açıldı (tercih "{1}" yok).',
};

const vi: Dict = {
  ...en,
  languageLabel: "Ngôn ngữ",
  openBrowser: "Mở trình duyệt",
  selectMode: "Chế độ chọn",
  selectModeOn: "Chế độ chọn BẬT",
  closeBrowser: "Đóng trình duyệt",
  attachLast: "Dán vào terminal",
  copyPaths: "Sao chép đường dẫn",
  revealFolder: "Hiện thư mục",
  statusReady: "Sẵn sàng — mở URL trong trình duyệt",
  statusSelectOn: "Chọn BẬT — di chuột và nhấp phần tử",
  statusBrowserOpen: "Trình duyệt đã mở — bật chế độ chọn",
  statusLastPick: "Lần chọn cuối: {0}",
  statusBrowserOpenUrl: "Trình duyệt: {0}",
  statusSelectOnHover:
    "Chọn BẬT — di chuột và nhấp trong cửa sổ trình duyệt",
  statusSelectOff: "Chọn TẮT",
  statusBrowserClosed: "Đã đóng trình duyệt",
  statusCapturing: "Đang chụp {0}…",
  statusSavedAttached: "Đã lưu {0} → terminal + clipboard ({1})",
  statusSaved: "Đã lưu {0} ({1})",
  statusPickFailed: "Chọn thất bại: {0}",
  statusPathsTerminal: "Đã chèn đường dẫn vào terminal",
  statusPathsClipboard: "Đã sao chép đường dẫn vào clipboard",
  statusError: "Lỗi: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: đã mở trình duyệt. Bật chế độ chọn rồi nhấp phần tử.",
  msgSavedAttached:
    "DaVinchi Element Picker: đã lưu {0}, đường dẫn vào terminal + clipboard.",
  msgSavedManual:
    "DaVinchi Element Picker: đã lưu {0}. Dùng Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: đã sao chép đường dẫn vào clipboard.",
  msgOpening: "DaVinchi Element Picker: đang mở {0}",
  msgLanguageChanged: "Ngôn ngữ DaVinchi Element Picker: {0}",
  promptUrl: "URL cần mở",
  errUrlEmpty: "URL trống.",
  errNoPick:
    "Chưa có lựa chọn. Mở trình duyệt, bật chế độ chọn, nhấp phần tử.",
  statusBarOn: "$(target) Pick: BẬT",
  statusBarTooltip: "DaVinchi Element Picker: chế độ chọn (Ctrl+Shift+E)",
  badgeSelectOn: "CHỌN BẬT",
  badgeBrowserOpen: "trình duyệt",
  lastLabel: "Cuối:",
  hint: "1. Mở trình duyệt → <b>Chế độ chọn</b> (hoặc <code>Ctrl+Shift+E</code>).<br/>2. Di chuột để tô sáng, nhấp phần tử.<br/>3. Tệp trong <code>.element-picks/</code>; đường dẫn vào terminal và clipboard.",
  defaultTerminalPrompt:
    "Đã đính kèm ngữ cảnh UI (ảnh + HTML/CSS). Câu hỏi: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Chọn ngôn ngữ",
  languagePickPlaceholder: "Ngôn ngữ UI (lưu trong cài đặt người dùng)",
  browserChannelFallback:
    'DaVinchi Element Picker: mở bằng kênh "{0}" (ưu tiên "{1}" không khả dụng).',
};

const id: Dict = {
  ...en,
  languageLabel: "Bahasa",
  openBrowser: "Buka browser",
  selectMode: "Mode pilih",
  selectModeOn: "Mode pilih ON",
  closeBrowser: "Tutup browser",
  attachLast: "Tempel ke terminal",
  copyPaths: "Salin path",
  revealFolder: "Tampilkan folder",
  statusReady: "Siap — buka URL di browser",
  statusSelectOn: "Pilih ON — arahkan kursor dan klik elemen",
  statusBrowserOpen: "Browser terbuka — aktifkan mode pilih",
  statusLastPick: "Pilihan terakhir: {0}",
  statusBrowserOpenUrl: "Browser terbuka: {0}",
  statusSelectOnHover:
    "Pilih ON — arahkan kursor dan klik di jendela browser",
  statusSelectOff: "Pilih OFF",
  statusBrowserClosed: "Browser ditutup",
  statusCapturing: "Mengambil {0}…",
  statusSavedAttached: "Disimpan {0} → terminal + clipboard ({1})",
  statusSaved: "Disimpan {0} ({1})",
  statusPickFailed: "Gagal memilih: {0}",
  statusPathsTerminal: "Path dimasukkan ke terminal",
  statusPathsClipboard: "Path disalin ke clipboard",
  statusError: "Error: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: browser dibuka. Aktifkan mode pilih, lalu klik elemen.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} disimpan, path ke terminal + clipboard.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} disimpan. Gunakan Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: path disalin ke clipboard.",
  msgOpening: "DaVinchi Element Picker: membuka {0}",
  msgLanguageChanged: "Bahasa DaVinchi Element Picker: {0}",
  promptUrl: "URL untuk dibuka",
  errUrlEmpty: "URL kosong.",
  errNoPick:
    "Belum ada pilihan. Buka browser, aktifkan mode pilih, klik elemen.",
  statusBarTooltip: "DaVinchi Element Picker: mode pilih (Ctrl+Shift+E)",
  badgeSelectOn: "PILIH ON",
  badgeBrowserOpen: "browser",
  lastLabel: "Terakhir:",
  hint: "1. Buka browser → <b>Mode pilih</b> (atau <code>Ctrl+Shift+E</code>).<br/>2. Hover untuk sorot, klik elemen.<br/>3. File di <code>.element-picks/</code>; path ke terminal dan clipboard.",
  defaultTerminalPrompt:
    "Konteks UI dilampirkan (screenshot + HTML/CSS). Pertanyaan: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Pilih bahasa",
  languagePickPlaceholder: "Bahasa UI (disimpan di pengaturan pengguna)",
  browserChannelFallback:
    'DaVinchi Element Picker: dibuka dengan saluran "{0}" (preferensi "{1}" tidak tersedia).',
};

const ca: Dict = {
  ...en,
  languageLabel: "Idioma",
  openBrowser: "Obre el navegador",
  selectMode: "Mode de selecció",
  selectModeOn: "Mode de selecció ON",
  closeBrowser: "Tanca el navegador",
  attachLast: "Enganxa al terminal",
  copyPaths: "Copia els camins",
  revealFolder: "Mostra la carpeta",
  statusReady: "Llest — obriu un URL al navegador",
  statusSelectOn: "Selecció ON — passeu el cursor i feu clic",
  statusBrowserOpen: "Navegador obert — activeu el mode de selecció",
  statusLastPick: "Darrera selecció: {0}",
  statusBrowserOpenUrl: "Navegador obert: {0}",
  statusSelectOnHover:
    "Selecció ON — passeu el cursor i feu clic a la finestra del navegador",
  statusSelectOff: "Selecció OFF",
  statusBrowserClosed: "Navegador tancat",
  statusCapturing: "Capturant {0}…",
  statusSavedAttached: "Desat {0} → terminal + porta-retalls ({1})",
  statusSaved: "Desat {0} ({1})",
  statusPickFailed: "Error de selecció: {0}",
  statusPathsTerminal: "Camins inserits al terminal",
  statusPathsClipboard: "Camins copiats al porta-retalls",
  statusError: "Error: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: navegador obert. Activeu el mode de selecció i feu clic a un element.",
  msgSavedAttached:
    "DaVinchi Element Picker: s'ha desat {0} i s'han adjuntat els camins al terminal i al porta-retalls.",
  msgSavedManual:
    "DaVinchi Element Picker: s'ha desat {0}. Useu Attach / Copy.",
  msgCopied: "DaVinchi Element Picker: camins copiats al porta-retalls.",
  msgOpening: "DaVinchi Element Picker: s'està obrint {0}",
  msgLanguageChanged: "Idioma d'DaVinchi Element Picker: {0}",
  promptUrl: "URL a obrir",
  errUrlEmpty: "L'URL és buit.",
  errNoPick:
    "Encara no hi ha selecció. Obriu el navegador, activeu la selecció i feu clic.",
  statusBarTooltip: "DaVinchi Element Picker: mode de selecció (Ctrl+Shift+E)",
  badgeSelectOn: "SELECCIÓ ON",
  badgeBrowserOpen: "navegador",
  lastLabel: "Darrer:",
  hint: "1. Obriu el navegador → <b>Mode de selecció</b> (o <code>Ctrl+Shift+E</code>).<br/>2. Passeu el cursor i feu clic a un element.<br/>3. Fitxers a <code>.element-picks/</code>; camins al terminal i porta-retalls.",
  defaultTerminalPrompt:
    "Context d'UI adjunt (captura + HTML/CSS). Pregunta: ",
  cmdSelectLanguage: "DaVinchi Element Picker: Selecciona l'idioma",
  languagePickPlaceholder: "Idioma de la UI (es desa a la configuració d'usuari)",
  browserChannelFallback:
    'DaVinchi Element Picker: obert amb el canal "{0}" (preferit "{1}" no disponible).',
};

const hi: Dict = {
  ...en,
  languageLabel: "भाषा",
  openBrowser: "ब्राउज़र खोलें",
  selectMode: "चयन मोड",
  selectModeOn: "चयन मोड चालू",
  closeBrowser: "ब्राउज़र बंद करें",
  attachLast: "टर्मिनल में पेस्ट करें",
  copyPaths: "पथ कॉपी करें",
  revealFolder: "फ़ोल्डर दिखाएँ",
  statusReady: "तैयार — ब्राउज़र में URL खोलें",
  statusSelectOn: "चयन चालू — होवर करें और एलिमेंट पर क्लिक करें",
  statusBrowserOpen: "ब्राउज़र खुला — चयन मोड चालू करें",
  statusLastPick: "अंतिम चयन: {0}",
  statusBrowserOpenUrl: "ब्राउज़र खुला: {0}",
  statusSelectOnHover:
    "चयन चालू — ब्राउज़र विंडो में होवर करें और क्लिक करें",
  statusSelectOff: "चयन बंद",
  statusBrowserClosed: "ब्राउज़र बंद",
  statusCapturing: "{0} कैप्चर हो रहा है…",
  statusSavedAttached: "सहेजा गया {0} → टर्मिनल + क्लिपबोर्ड ({1})",
  statusSaved: "सहेजा गया {0} ({1})",
  statusPickFailed: "चयन विफल: {0}",
  statusPathsTerminal: "पथ टर्मिनल में डाले गए",
  statusPathsClipboard: "पथ क्लिपबोर्ड पर कॉपी हुए",
  statusError: "त्रुटि: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: ब्राउज़र खुला। चयन मोड चालू करें, फिर एलिमेंट पर क्लिक करें।",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} सहेजा गया, पथ टर्मिनल और क्लिपबोर्ड पर।",
  msgSavedManual:
    "DaVinchi Element Picker: {0} सहेजा गया। Attach / Copy उपयोग करें।",
  msgCopied: "DaVinchi Element Picker: पथ क्लिपबोर्ड पर कॉपी हुए।",
  msgOpening: "DaVinchi Element Picker: खोल रहा है {0}",
  msgLanguageChanged: "DaVinchi Element Picker भाषा: {0}",
  promptUrl: "खोलने के लिए URL",
  errUrlEmpty: "URL खाली है।",
  errNoPick:
    "अभी कोई चयन नहीं। ब्राउज़र खोलें, चयन चालू करें, एलिमेंट पर क्लिक करें।",
  statusBarOn: "$(target) Pick: चालू",
  statusBarTooltip: "DaVinchi Element Picker: चयन मोड (Ctrl+Shift+E)",
  badgeSelectOn: "चयन चालू",
  badgeBrowserOpen: "ब्राउज़र",
  lastLabel: "अंतिम:",
  hint: "1. ब्राउज़र खोलें → <b>चयन मोड</b> (या <code>Ctrl+Shift+E</code>)।<br/>2. होवर से हाइलाइट, क्लिक से चुनें।<br/>3. फ़ाइलें <code>.element-picks/</code>; पथ टर्मिनल और क्लिपबोर्ड में।",
  defaultTerminalPrompt:
    "UI संदर्भ संलग्न (स्क्रीनशॉट + HTML/CSS)। प्रश्न: ",
  cmdSelectLanguage: "DaVinchi Element Picker: भाषा चुनें",
  languagePickPlaceholder: "UI भाषा (उपयोगकर्ता सेटिंग्स में सहेजी जाती है)",
  browserChannelFallback:
    'DaVinchi Element Picker: चैनल "{0}" से खोला गया (पसंदीदा "{1}" उपलब्ध नहीं)।',
};

const ja: Dict = {
  ...en,
  languageLabel: "言語",
  openBrowser: "ブラウザを開く",
  selectMode: "選択モード",
  selectModeOn: "選択モード ON",
  closeBrowser: "ブラウザを閉じる",
  attachLast: "ターミナルに貼り付け",
  copyPaths: "パスをコピー",
  revealFolder: "フォルダーを表示",
  statusReady: "準備完了 — ブラウザで URL を開いてください",
  statusSelectOn: "選択 ON — 要素にホバーしてクリック",
  statusBrowserOpen: "ブラウザ起動中 — 選択モードを有効にしてください",
  statusLastPick: "最後の選択: {0}",
  statusBrowserOpenUrl: "ブラウザ: {0}",
  statusSelectOnHover:
    "選択 ON — ブラウザウィンドウでホバーしてクリック",
  statusSelectOff: "選択 OFF",
  statusBrowserClosed: "ブラウザを閉じました",
  statusCapturing: "{0} をキャプチャ中…",
  statusSavedAttached: "保存しました {0} → ターミナル + クリップボード ({1})",
  statusSaved: "保存しました {0} ({1})",
  statusPickFailed: "選択に失敗: {0}",
  statusPathsTerminal: "パスをターミナルに挿入しました",
  statusPathsClipboard: "パスをクリップボードにコピーしました",
  statusError: "エラー: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: ブラウザを開きました。選択モードを有効にし、要素をクリックしてください。",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} を保存し、パスをターミナルとクリップボードに添付しました。",
  msgSavedManual:
    "DaVinchi Element Picker: {0} を保存しました。Attach / Copy を使ってください。",
  msgCopied: "DaVinchi Element Picker: パスをクリップボードにコピーしました。",
  msgOpening: "DaVinchi Element Picker: {0} を開いています",
  msgLanguageChanged: "DaVinchi Element Picker の言語: {0}",
  promptUrl: "開く URL",
  errUrlEmpty: "URL が空です。",
  errNoPick:
    "まだ選択がありません。ブラウザを開き、選択モードを有効にして要素をクリックしてください。",
  statusBarOn: "$(target) Pick: ON",
  statusBarTooltip: "DaVinchi Element Picker: 選択モード (Ctrl+Shift+E)",
  badgeSelectOn: "選択 ON",
  badgeBrowserOpen: "ブラウザ",
  lastLabel: "前回:",
  hint: "1. ブラウザを開く → <b>選択モード</b>（または <code>Ctrl+Shift+E</code>）。<br/>2. ホバーでハイライト、クリックで選択。<br/>3. ファイルは <code>.element-picks/</code>、パスはターミナルとクリップボードへ。",
  defaultTerminalPrompt:
    "UI コンテキストを添付しました（スクリーンショット + HTML/CSS）。質問: ",
  cmdSelectLanguage: "DaVinchi Element Picker: 言語を選択",
  languagePickPlaceholder: "UI 言語（ユーザー設定に保存）",
  browserChannelFallback:
    'DaVinchi Element Picker: チャネル "{0}" で起動（優先 "{1}" は利用不可）。',
};

const ko: Dict = {
  ...en,
  languageLabel: "언어",
  openBrowser: "브라우저 열기",
  selectMode: "선택 모드",
  selectModeOn: "선택 모드 켜짐",
  closeBrowser: "브라우저 닫기",
  attachLast: "터미널에 붙여넣기",
  copyPaths: "경로 복사",
  revealFolder: "폴더 표시",
  statusReady: "준비됨 — 브라우저에서 URL 열기",
  statusSelectOn: "선택 켜짐 — 요소에 마우스를 올리고 클릭",
  statusBrowserOpen: "브라우저 열림 — 선택 모드를 켜세요",
  statusLastPick: "마지막 선택: {0}",
  statusBrowserOpenUrl: "브라우저: {0}",
  statusSelectOnHover:
    "선택 켜짐 — 브라우저 창에서 마우스를 올리고 클릭",
  statusSelectOff: "선택 꺼짐",
  statusBrowserClosed: "브라우저 닫힘",
  statusCapturing: "{0} 캡처 중…",
  statusSavedAttached: "저장됨 {0} → 터미널 + 클립보드 ({1})",
  statusSaved: "저장됨 {0} ({1})",
  statusPickFailed: "선택 실패: {0}",
  statusPathsTerminal: "경로가 터미널에 삽입됨",
  statusPathsClipboard: "경로가 클립보드에 복사됨",
  statusError: "오류: {0}",
  msgBrowserOpened:
    "DaVinchi Element Picker: 브라우저가 열렸습니다. 선택 모드를 켠 뒤 요소를 클릭하세요.",
  msgSavedAttached:
    "DaVinchi Element Picker: {0} 저장, 경로를 터미널과 클립보드에 첨부했습니다.",
  msgSavedManual:
    "DaVinchi Element Picker: {0} 저장됨. Attach / Copy를 사용하세요.",
  msgCopied: "DaVinchi Element Picker: 경로가 클립보드에 복사되었습니다.",
  msgOpening: "DaVinchi Element Picker: {0} 여는 중",
  msgLanguageChanged: "DaVinchi Element Picker 언어: {0}",
  promptUrl: "열 URL",
  errUrlEmpty: "URL이 비어 있습니다.",
  errNoPick:
    "아직 선택이 없습니다. 브라우저를 열고 선택 모드를 켠 뒤 요소를 클릭하세요.",
  statusBarOn: "$(target) Pick: 켜짐",
  statusBarTooltip: "DaVinchi Element Picker: 선택 모드 (Ctrl+Shift+E)",
  badgeSelectOn: "선택 켜짐",
  badgeBrowserOpen: "브라우저",
  lastLabel: "마지막:",
  hint: "1. 브라우저 열기 → <b>선택 모드</b> (또는 <code>Ctrl+Shift+E</code>).<br/>2. 마우스로 강조 후 요소 클릭.<br/>3. 파일은 <code>.element-picks/</code>, 경로는 터미널과 클립보드.",
  defaultTerminalPrompt:
    "UI 컨텍스트가 첨부됨(스크린샷 + HTML/CSS). 질문: ",
  cmdSelectLanguage: "DaVinchi Element Picker: 언어 선택",
  languagePickPlaceholder: "UI 언어(사용자 설정에 저장)",
  browserChannelFallback:
    'DaVinchi Element Picker: "{0}" 채널로 열림(선호 "{1}" 사용 불가).',
};

const zhCN: Dict = {
  ...en,
  languageLabel: "语言",
  openBrowser: "打开浏览器",
  selectMode: "选择模式",
  selectModeOn: "选择模式 开",
  closeBrowser: "关闭浏览器",
  attachLast: "粘贴到终端",
  copyPaths: "复制路径",
  revealFolder: "显示文件夹",
  statusReady: "就绪 — 在浏览器中打开 URL",
  statusSelectOn: "选择已开 — 悬停并点击元素",
  statusBrowserOpen: "浏览器已打开 — 请启用选择模式",
  statusLastPick: "上次选择：{0}",
  statusBrowserOpenUrl: "浏览器已打开：{0}",
  statusSelectOnHover: "选择已开 — 在浏览器窗口中悬停并点击",
  statusSelectOff: "选择已关",
  statusBrowserClosed: "浏览器已关闭",
  statusCapturing: "正在捕获 {0}…",
  statusSavedAttached: "已保存 {0} → 终端 + 剪贴板（{1}）",
  statusSaved: "已保存 {0}（{1}）",
  statusPickFailed: "选择失败：{0}",
  statusPathsTerminal: "路径已插入终端",
  statusPathsClipboard: "路径已复制到剪贴板",
  statusError: "错误：{0}",
  msgBrowserOpened:
    "DaVinchi Element Picker：浏览器已打开。启用选择模式，然后点击元素。",
  msgSavedAttached:
    "DaVinchi Element Picker：已保存 {0}，路径已附加到终端和剪贴板。",
  msgSavedManual: "DaVinchi Element Picker：已保存 {0}。请使用 Attach / Copy。",
  msgCopied: "DaVinchi Element Picker：路径已复制到剪贴板。",
  msgOpening: "DaVinchi Element Picker：正在打开 {0}",
  msgLanguageChanged: "DaVinchi Element Picker 语言：{0}",
  promptUrl: "要打开的 URL",
  errUrlEmpty: "URL 为空。",
  errNoPick: "尚无选择。打开浏览器，启用选择模式，然后点击元素。",
  statusBarOn: "$(target) Pick: 开",
  statusBarTooltip: "DaVinchi Element Picker：选择模式 (Ctrl+Shift+E)",
  badgeSelectOn: "选择 开",
  badgeBrowserOpen: "浏览器",
  lastLabel: "上次：",
  hint: "1. 打开浏览器 → <b>选择模式</b>（或 <code>Ctrl+Shift+E</code>）。<br/>2. 悬停高亮，点击元素。<br/>3. 文件在 <code>.element-picks/</code>；路径到终端和剪贴板。",
  defaultTerminalPrompt: "已附加 UI 上下文（截图 + HTML/CSS）。问题：",
  cmdSelectLanguage: "DaVinchi Element Picker：选择语言",
  languagePickPlaceholder: "界面语言（保存在用户设置中）",
  browserChannelFallback:
    'DaVinchi Element Picker：使用通道 "{0}" 打开（首选 "{1}" 不可用）。',
};

const zhTW: Dict = {
  ...en,
  languageLabel: "語言",
  openBrowser: "開啟瀏覽器",
  selectMode: "選取模式",
  selectModeOn: "選取模式 開",
  closeBrowser: "關閉瀏覽器",
  attachLast: "貼到終端機",
  copyPaths: "複製路徑",
  revealFolder: "顯示資料夾",
  statusReady: "就緒 — 在瀏覽器開啟 URL",
  statusSelectOn: "選取已開 — 懸停並點擊元素",
  statusBrowserOpen: "瀏覽器已開啟 — 請啟用選取模式",
  statusLastPick: "上次選取：{0}",
  statusBrowserOpenUrl: "瀏覽器已開啟：{0}",
  statusSelectOnHover: "選取已開 — 在瀏覽器視窗懸停並點擊",
  statusSelectOff: "選取已關",
  statusBrowserClosed: "瀏覽器已關閉",
  statusCapturing: "正在擷取 {0}…",
  statusSavedAttached: "已儲存 {0} → 終端機 + 剪貼簿（{1}）",
  statusSaved: "已儲存 {0}（{1}）",
  statusPickFailed: "選取失敗：{0}",
  statusPathsTerminal: "路徑已插入終端機",
  statusPathsClipboard: "路徑已複製到剪貼簿",
  statusError: "錯誤：{0}",
  msgBrowserOpened:
    "DaVinchi Element Picker：瀏覽器已開啟。啟用選取模式，然後點擊元素。",
  msgSavedAttached:
    "DaVinchi Element Picker：已儲存 {0}，路徑已附加到終端機與剪貼簿。",
  msgSavedManual: "DaVinchi Element Picker：已儲存 {0}。請使用 Attach / Copy。",
  msgCopied: "DaVinchi Element Picker：路徑已複製到剪貼簿。",
  msgOpening: "DaVinchi Element Picker：正在開啟 {0}",
  msgLanguageChanged: "DaVinchi Element Picker 語言：{0}",
  promptUrl: "要開啟的 URL",
  errUrlEmpty: "URL 為空。",
  errNoPick: "尚無選取。開啟瀏覽器，啟用選取模式，然後點擊元素。",
  statusBarOn: "$(target) Pick: 開",
  statusBarTooltip: "DaVinchi Element Picker：選取模式 (Ctrl+Shift+E)",
  badgeSelectOn: "選取 開",
  badgeBrowserOpen: "瀏覽器",
  lastLabel: "上次：",
  hint: "1. 開啟瀏覽器 → <b>選取模式</b>（或 <code>Ctrl+Shift+E</code>）。<br/>2. 懸停反白，點擊元素。<br/>3. 檔案在 <code>.element-picks/</code>；路徑到終端機與剪貼簿。",
  defaultTerminalPrompt: "已附加 UI 內容（螢幕截圖 + HTML/CSS）。問題：",
  cmdSelectLanguage: "DaVinchi Element Picker：選擇語言",
  languagePickPlaceholder: "介面語言（儲存在使用者設定）",
  browserChannelFallback:
    'DaVinchi Element Picker：使用通道 "{0}" 開啟（偏好 "{1}" 不可用）。',
};

export const MESSAGES: Record<Locale, Dict> = {
  ca,
  de,
  en,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  pl,
  "pt-BR": ptBR,
  ru,
  tr,
  vi,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

export function formatMessage(
  template: string,
  ...args: Array<string | number>
): string {
  return template.replace(/\{(\d+)\}/g, (_, i) => {
    const v = args[Number(i)];
    return v === undefined || v === null ? "" : String(v);
  });
}
