const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.DB_HOST !== 'localhost';

const pool = new Pool({
    connectionString: isProduction 
        ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
        : undefined, // En local usará las variables normales
    user: isProduction ? undefined : process.env.DB_USER,
    host: isProduction ? undefined : process.env.DB_HOST,
    database: isProduction ? undefined : process.env.DB_NAME,
    password: isProduction ? undefined : process.env.DB_PASSWORD,
    port: isProduction ? undefined : (process.env.DB_PORT || 5432),
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};