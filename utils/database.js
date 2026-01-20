const mysql = require("mysql2");
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL database successfully');
  connection.release();
});

function query(queryString, params, callback) {

  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error establishing database connection:", err);
      callback(err, null);
      return;
    }

    connection.query(queryString, params, (err, results) => {
      connection.release();
      if (err) {
        console.error("Error executing database query:", err);
        callback(err, null);
        return;
      }
      callback(null, results);
    });
  });
}

module.exports = {
  query,
};
