const { Pool } = require('pg');
require('dotenv').config();

// Configuración inteligente: detecta si está en Render o en Local
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    // ESTA LÍNEA ES CLAVE PARA RENDER:
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('🐘 Conexión exitosa con PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de la base de datos:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};