const express = require('express');
const cors = require('cors');
require('dotenv').config();

const peliculaRoutes = require('./routes/peliculaRoutes');
const tiqueteRoutes = require('./routes/tiqueteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

const PORT = process.env.PORT || 3000;

app.use('/peliculas', peliculaRoutes);
app.use('/tiquetes', tiqueteRoutes);
app.use('/usuarios', usuarioRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor CinePixel corriendo en http://localhost:${PORT}`);
});