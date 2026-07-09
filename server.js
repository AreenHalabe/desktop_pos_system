import express from "express";
import { poolConnect } from "./DataBaseConnections/dbconnection.js";
import bodyParser from "body-parser";
import cors from "cors";
import { config } from './env.js';
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






function startServer(port) {
  config.DEFAULT_PORT = port;
  let server = app.listen(port)
    .on('listening', () => {
      console.log(`Server running at http://localhost:${port}`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} busy, trying ${port + 1}`);
        startServer(port + 1);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  return server;
}




async function initServer(port) {
  await poolConnect; 
  console.log("Connected to SQL Server");
  
  const server = startServer(port);
  return server;

}




function shutdown() {
  if (server) {
    server.close(() => {
      console.log('Server closed');
    });
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown); 

export { initServer};





// "package-win": "electron-packager . electron-tutorial-app --overwrite --asar=true --platform=win32 --arch=x64 --icon=assets/icons/win/icon.ico --prune=true --out=release-builds --version-string.CompanyName=CE --version-string.FileDescription=CE --version-string.ProductName=\"Student Maneger Sysytem\"",
