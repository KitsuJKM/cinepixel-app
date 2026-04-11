const db = require('../models/db');

exports.obtenerPeliculas = async (req, res) => {
    try {
        const admin = req.query.admin === 'true';
        const query = admin ? 'SELECT * FROM peliculas ORDER BY id DESC' : 'SELECT * FROM peliculas WHERE estado = true ORDER BY id DESC';
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerPeliculaPorId = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM peliculas WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Película no encontrada' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearPelicula = async (req, res) => {
    try {
        const { titulo, descripcion, duracion, genero, fecha_estreno, fecha_fin, imagen_url } = req.body;
        const result = await db.query(
            'INSERT INTO peliculas (titulo, descripcion, duracion, genero, fecha_estreno, fecha_fin, imagen_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [titulo, descripcion, duracion, genero, fecha_estreno || null, fecha_fin || null, imagen_url]
        );
        res.status(201).json({ mensaje: "Película creada", pelicula: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.actualizarPelicula = async (req, res) => {
    try {
        const { titulo, descripcion, duracion, genero, fecha_estreno, fecha_fin, estado, imagen_url } = req.body;
        const result = await db.query(
            'UPDATE peliculas SET titulo=$1, descripcion=$2, duracion=$3, genero=$4, fecha_estreno=$5, fecha_fin=$6, estado=$7, imagen_url=$8 WHERE id=$9 RETURNING *',
            [titulo, descripcion, duracion, genero, fecha_estreno || null, fecha_fin || null, estado, imagen_url, req.params.id]
        );
        res.json({ mensaje: "Película actualizada", pelicula: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.eliminarPelicula = async (req, res) => {
    try {
        await db.query('DELETE FROM peliculas WHERE id = $1', [req.params.id]);
        res.json({ message: 'Película eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};