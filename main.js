import { app, BrowserWindow, globalShortcut, Menu, ipcMain, Tray, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
let currentShortcut = 'CommandOrControl+K';

function getConfigPath() {
  return path.join(app.getPath('userData'), 'mac-snippets-config.json');
}

function loadConfig() {
  try {
    if (fs.existsSync(getConfigPath())) {
      const data = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
      if (data.shortcut) currentShortcut = data.shortcut;
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify({ shortcut: currentShortcut }));
  } catch (e) {
    console.error('Failed to save config', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    transparent: true,
    vibrancy: 'hud', // macOS native blur
    alwaysOnTop: true,
    show: false, // hide initially until ready or triggered
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Hide the window when the user clicks away
  mainWindow.on('blur', () => {
    mainWindow.hide();
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (mainWindow) mainWindow.focus();
  });
}

function toggleWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

app.whenReady().then(() => {
  app.dock.hide();
  loadConfig();

  // Create a minimal menu to enable copy/paste shortcuts on macOS
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  createWindow();

  // Create Tray
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
    trayIcon.resize({width: 16, height: 16});
  }

  tray = new Tray(trayIcon);
  
  const updateTrayMenu = () => {
    const loginSettings = app.getLoginItemSettings();
    const contextMenu = Menu.buildFromTemplate([
      { label: `Open Snippets (${currentShortcut})`, click: toggleWindow },
      { type: 'separator' },
      { 
        label: 'Launch at Login', 
        type: 'checkbox', 
        checked: loginSettings.openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            openAsHidden: true
          });
        }
      },
      { type: 'separator' },
      { label: 'Quit MacSnippets', click: () => {
        app.quit();
      }}
    ]);
    tray.setToolTip('MacSnippets');
    tray.setContextMenu(contextMenu);
  };
  
  updateTrayMenu();

  ipcMain.on('hide-window', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.handle('get-shortcut', () => currentShortcut);

  ipcMain.handle('set-shortcut', (event, newShortcut) => {
    globalShortcut.unregister(currentShortcut);
    currentShortcut = newShortcut;
    saveConfig();
    updateTrayMenu();
    
    // Attempt to register the new shortcut. If it fails (e.g. invalid syntax), we log it.
    try {
      globalShortcut.register(currentShortcut, toggleWindow);
      return true;
    } catch (e) {
      console.error('Failed to register shortcut', e);
      return false;
    }
  });

  // Register initial global shortcut
  try {
    globalShortcut.register(currentShortcut, toggleWindow);
  } catch(e) {
    console.error('Failed to register initial shortcut', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
