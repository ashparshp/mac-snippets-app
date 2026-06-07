import { app, BrowserWindow, globalShortcut, Menu, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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

app.whenReady().then(() => {
  app.dock.hide();

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

  ipcMain.on('hide-window', () => {
    if (mainWindow) mainWindow.hide();
  });

  // Register a global shortcut 'CommandOrControl+K'
  globalShortcut.register('CommandOrControl+K', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Unregister all shortcuts when quitting
  globalShortcut.unregisterAll();
});
