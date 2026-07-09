import express from "express";
import { poolConnect } from "./DataBaseConnections/dbconnection.js";
import bodyParser from "body-parser";
import cors from "cors";
import { AdminRoute } from "./routes/AdminRoute.js";
import { ItemRoute } from "./routes/ItemsRoute.js";
import { SessionRoute } from "./routes/SessionRoute.js";
import { OrderRoute } from "./routes/OrderRoute.js";
import { TransactionRoute } from "./routes/TransactionRoute.js";
import { TableRoute } from "./routes/TableRoute.js";
const app = express();


app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.use(AdminRoute);
app.use(ItemRoute);
app.use(SessionRoute);
app.use(OrderRoute);
app.use(TransactionRoute);
app.use(TableRoute);




let server_port;

async function startServer(port) {
  return new Promise((resolve, reject) => {

    const server = app.listen(port);

    server.once("listening", () => {
      server_port = port;
      console.log(`Server running at http://localhost:${port}`);
      resolve(server);
    });

    server.once("error", (err) => {

      if (err.code === "EADDRINUSE") {

        console.log(`Port ${port} busy, trying ${port + 1}`);

        resolve(startServer(port + 1));

      } else {

        reject(err);

      }

    });

  });
}




async function initServer(port) {
  await poolConnect; 
  console.log("Connected to SQL Server");
  
  const server = await startServer(port);

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


export { initServer , server_port};



// "package-win": "electron-packager . electron-tutorial-app --overwrite --asar=true --platform=win32 --arch=x64 --icon=assets/icons/win/icon.ico --prune=true --out=release-builds --version-string.CompanyName=CE --version-string.FileDescription=CE --version-string.ProductName=\"Student Maneger Sysytem\"",
