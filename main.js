
import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import { fileURLToPath } from "url";
import path from 'path';
import { server , initServer} from "./server.js"
import url from 'url';

function fatalError(title, message) {
  shutdownAndExit(`${title}\n\n${message}`);
}



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;



let mainWindow;

app.on('ready', async () => {
  try {
    await initServer(3000);
  } catch (err) {
    fatalError("Startup Error", err.message);
  }
  serverProcess = server;


  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, './views/mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }));
  mainWindow.webContents.openDevTools();// for develper tools => open console 


  ipcMain.handle('print-invoice', async (event, html) => {

    const win = new BrowserWindow({
      show: false
    });

    await win.loadURL(
      'data:text/html;charset=utf-8,' +
      encodeURIComponent(html)
    );

    await win.webContents.executeJavaScript(`
      document.body.innerHTML = \`${html.replace(/`/g, '\\`')}\`;
    `);

    await win.webContents.executeJavaScript(`new Promise(r => setTimeout(r, 200));`);


    return new Promise((resolve) => {
      win.webContents.print({
        silent: true,
        printBackground: true,
        margins: {
          marginType: 'default'
        },
        pageSize: {
          width: 72000,
          height: 200000
        }
      }, () => {
        win.close();
        resolve(true);
      });
    });

  });


  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});




app.on('will-quit', () => {
  if (serverProcess && serverProcess.close) {
    serverProcess.close(() => {
      console.log('Server stopped gracefully.');
    });
  }
});



function shutdownAndExit(message) {

  dialog.showErrorBox("Fatal Error", message);

  if (serverProcess && serverProcess.close) {
    serverProcess.close(() => {
      console.log("Server stopped gracefully");
      app.quit(); 
    });
  } else {
     console.log("Server not found to close it");
    app.quit();
  }
}
