import express from "express";
import {poolConnect } from "./DataBaseConnections/dbconnection.js";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

import { AdminRoute } from "./routes/AdminRoute.js";
import { MainCategoryRoute } from "./routes/MainCategoryRoute.js";
import { CategoryRoute } from "./routes/CategoryRoute.js";
import { ItemRoute } from "./routes/ItemsRoute.js";
import { SessionRoute } from "./routes/SessionRoute.js";
import { OrderRoute } from "./routes/OrderRoute.js";
import { TransactionRoute } from "./routes/TransactionRoute.js";
import { ReportRoute } from "./routes/ReportRoute.js";
import { TableRoute } from "./routes/TableRoute.js";
const app = express();
const port  = 3000;
dotenv.config();

let server;

app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.use(AdminRoute);
app.use(MainCategoryRoute);
app.use(CategoryRoute);
app.use(ItemRoute);
app.use(SessionRoute);
app.use(OrderRoute);
app.use(TransactionRoute);
app.use(ReportRoute);
app.use(TableRoute);



try {
    // ⬅️ ننتظر الاتصال بالداتا بيس
    await poolConnect;

    console.log("Connected to SQL Server");

    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

} catch (err) {
    console.log("DB Connection Failed:");
    console.log(err);

    process.exit(1);
}


process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
  });
});


export {server};

// "package-win": "electron-packager . electron-tutorial-app --overwrite --asar=true --platform=win32 --arch=x64 --icon=assets/icons/win/icon.ico --prune=true --out=release-builds --version-string.CompanyName=CE --version-string.FileDescription=CE --version-string.ProductName=\"Student Maneger Sysytem\"",
