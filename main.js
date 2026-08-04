import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import { fileURLToPath } from "url";
import { sql, pool, poolConnect } from "./DataBaseConnections/dbconnection.js";
import fs from "fs";
import path from "path";
import url from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let serverProcess = null;
let initServer = null;
let mainWindow = null;
let listenOnPort;



// يمسك أي Exception غير متوقع
process.on("uncaughtException", (err) => {

  console.error("Uncaught Exception:", err);

  shutdownAndExit(
    `Unexpected Error:\n\n${err.message}`
  );

});


// يمسك Promise بدون catch
process.on("unhandledRejection", (reason) => {

  console.error("Unhandled Rejection:", reason);

  shutdownAndExit(
    `Unhandled Error:\n\n${reason}`
  );

});



function fatalError(title, message) {
  shutdownAndExit(`${title}\n\n${message}`);
}



app.whenReady().then(async () => {
  try {
    const serverModule = await import("./server.js");

    initServer = serverModule.initServer;
    serverProcess = await initServer(3000);
    listenOnPort = serverModule.server_port;

    ipcMain.handle("get-port", () => listenOnPort);

    Menu.setApplicationMenu(null);


    mainWindow = new BrowserWindow({
      webPreferences: {

        preload: path.join(__dirname, "preload.js"),

        contextIsolation: true,

        nodeIntegration: false,

        webSecurity: true

      }
    });



    await mainWindow.loadURL(
      url.format({

        pathname: path.join(
          __dirname,
          "./views/mainWindow.html"
        ),

        protocol: "file:",

        slashes: true

      })
    );



    mainWindow.webContents.openDevTools(); // for dev tools

    ipcMain.handle("print-invoice", async (event, html) => {
      try {
        const win = new BrowserWindow({
          show: false
        });
        await win.loadURL(
          "data:text/html;charset=utf-8," +
          encodeURIComponent(html)

        );

        // زائد
        // await win.webContents.executeJavaScript(`
        //   document.body.innerHTML = \`${html.replace(/`/g, "\\`")}\`;
        // `);

        await win.webContents.executeJavaScript(`
          new Promise(resolve => {

            if (document.readyState === "complete") {
              resolve();
            } else {
              window.addEventListener("load", resolve);
            }

          });
        `);

        //بديل الي فوق
        // await win.webContents.executeJavaScript(`
        //     new Promise(resolve => setTimeout(resolve,200));
        //   `);

        return await new Promise((resolve, reject) => {
          win.webContents.print(
            {
              silent: true,

              printBackground: true,

              margins: {

                marginType: "default"

              },

              pageSize: {

                width: 72000,

                height: 200000

              }
            },

            (success, failureReason) => {
              try {

                win.close();
                if (!success) {

                  reject(
                    new Error(failureReason)
                  );

                  return;

                }


                resolve(true);


              } catch (err) {

                reject(err);

              }


            }

          );


        });

      } catch (err) {
        dialog.showErrorBox(
          "Print Error",
          err.message
        );


        return false;

      }


    }

    );



    ipcMain.handle("backup-database", async () => {

      const now = new Date();

      const date = now.toLocaleDateString("en-CA");
      const defaultFileName = `POS_Backup_${date}.bak`;
      
      // 1. المستخدم يختار مكان حفظ النسخة
      const result = await dialog.showSaveDialog({
        title: "حفظ نسخة احتياطية",
        defaultPath: defaultFileName,
        filters: [
          {
            name: "SQL Server Backup",
            extensions: ["bak"]
          }
        ]
      });

      if (result.canceled) {
        return {
          success: false,
          canceled: true
        };
      }

      const destinationPath = result.filePath;

      // 2. مجلد مؤقت للـ backup
      const tempDir = "C:\\POSBackups";
      const tempPath = path.join(tempDir, "pos_backup.bak");

      try {

        // إنشاء المجلد إذا لم يكن موجودًا
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // 3. انتظار اتصال SQL Server
        await poolConnect;

        // 4. SQL Server يعمل Backup
        await pool.request().query(`
            BACKUP DATABASE [restorant]
            TO DISK = N'${tempPath.replace(/\\/g, "\\\\")}'
            WITH INIT;
        `);

        // 5. نقل ملف الـ bak للمكان الذي اختاره المستخدم
        fs.copyFileSync(
          tempPath,
          destinationPath
        );

        // 6. حذف الملف المؤقت
        fs.unlinkSync(tempPath);

        return {
          success: true,
          path: destinationPath
        };

      } catch (error) {

        console.error("Backup error:", error);

        return {
          success: false,
          error: error.message
        };
      }
    });



    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }

    }

    );



  } catch (err) {
    fatalError("Startup Error", err.message);
  }


});





app.on("will-quit",
  () => {
    try {
      if (serverProcess?.close) {
        serverProcess.close(() => {

          console.log(
            "Server stopped gracefully."
          );

        });
      }
    } catch (err) {
      console.error(
        "Shutdown Error:",
        err
      );
    }
  }

);





function shutdownAndExit(message) {
  try {
    dialog.showErrorBox("Fatal Error", message);
    if (serverProcess?.close) {
      console.log("Closing server process before quitting app.");
      serverProcess.close(() => {
        app.quit();
      });

    } else {
      console.log("no server process to close, quitting app.");
      app.quit();
    }
  } catch (err) {
    console.error(
      "Fatal shutdown error:"
    );
    app.quit();
  }
}


