
import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import { fileURLToPath } from "url";
import path from 'path';
import { server } from "./server.js"
import url from 'url';
import { writeFileSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;



let mainWindow;

app.on('ready', function () {
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

    const pdf = await win.webContents.printToPDF({});
    writeFileSync('test.pdf', pdf);



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

ipcMain.on("show-alert", (event, message) => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "تنبيه",
      message: message,
      buttons: ["موافق"],
    });
  }
});

ipcMain.handle("show-confirm", async (event, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "تأكيد",
    message: message,
    buttons: ["إلغاء", "موافق"],
    defaultId: 1,
    cancelId: 0,
  });
  return result.response === 1; // Return true if "موافق" is clicked
});



app.on('will-quit', () => {
  if (serverProcess && serverProcess.close) {
    serverProcess.close(() => {
      console.log('Server stopped gracefully.');
    });
  }
});

