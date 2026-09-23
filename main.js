const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "VisuAlg+ — Ambiente de Portugol",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Atalhos de execução quando a janela estiver ativa
  mainWindow.on('focus', () => {
    globalShortcut.register('F5', () => {
      mainWindow.webContents.send('executar-algoritmo');
    });
    globalShortcut.register('F9', () => {
      mainWindow.webContents.send('executar-algoritmo');
    });
  });

  mainWindow.on('blur', () => {
    globalShortcut.unregister('F5');
    globalShortcut.unregister('F9');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});