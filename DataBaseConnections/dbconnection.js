
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

// const config = {
//     user: "Halabi_services",
//     password: "20012001",
//     server: "BLACK",     
//     database: "restorant",    
//     options: {
//         trustServerCertificate: true
//     }
// };



const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on("error", err => {
    console.log("SQL Pool Error:", err);
});

export { sql, pool, poolConnect };

