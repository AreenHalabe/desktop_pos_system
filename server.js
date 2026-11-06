import express from "express";
import { poolConnect } from "./DataBaseConnections/dbconnection.js";
import bodyParser from "body-parser";
import cors from "cors";
import { AdminRoute } from "./routes/AdminRoute.js";
import { OrderRoute } from "./routes/OrderRoute.js";


const app = express();


app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.use(AdminRoute);

app.use(OrderRoute);


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

export { initServer, server_port };





