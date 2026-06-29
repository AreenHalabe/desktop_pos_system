// import mongoose from "mongoose";

// export const connectToDB = async() => {
//     await mongoose.connect("mongodb://127.0.0.1:27017");
// };


// const sql = require("mssql");

import sql from "mssql";

const config = {
    user: "BLACK",
    password: "20012001",
    server: "DESKTOP-63T0OB5//SQLEXPRESS",     
    database: "restorant",    
    options: {
        trustServerCertificate: true
    }
};

// export const connectToDB = async() => {
//     try {
//         await sql.connect(config);
//         console.log("Connected to SQL Server");
//     } catch (err) {
//         console.log(err);
//     }
// }


const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on("error", err => {
    console.log("SQL Pool Error:", err);
});

export { sql, pool, poolConnect };

