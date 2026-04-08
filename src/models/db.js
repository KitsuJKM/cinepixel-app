const { Pool } = require('pg');
require('dotenv').config();

// Configuración con SSL forzado para Render
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false // Necesario para bases de datos gratuitas en Render/Heroku
    }
});

pool.on('connect', () => {
    console.log('🐘 Conectado exitosamente a la base de datos en Render');
});

pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};