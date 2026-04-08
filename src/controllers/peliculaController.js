const db = require('../models/db');
const fs = require('fs');
const path = require('path');

exports.obtenerPeliculas = async (req, res) => {
    const esAdmin = req.query.admin === 'true';
    try {
        let query = 'SELECT * FROM peliculas WHERE estado = true ORDER BY id DESC';
        if (esAdmin) query = 'SELECT * FROM peliculas ORDER BY id DESC'; 
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener películas" });
    }
};

exports.crearPelicula = async (req, res) => {
    const { titulo, descripcion, duracion, genero, clasificacion, fecha_estreno, fecha_fin } = req.body;
    const imagen_url = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        await db.query('BEGIN'); // Transacción iniciada

        // 1. Guardar la Película
        const queryPeli = 'INSERT INTO peliculas (titulo, descripcion, duracion, genero, clasificacion, imagen_url, fecha_estreno, fecha_fin, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *';
        const valuesPeli = [titulo, descripcion, duracion, genero, clasificacion, imagen_url, fecha_estreno || null, fecha_fin || null];
        const resultPeli = await db.query(queryPeli, valuesPeli);
        const nuevaPelicula = resultPeli.rows[0];

        // 2. CREACIÓN AUTOMÁTICA DE LA FUNCIÓN (Sala 1, 6:10 PM, Base $20.000)
        await db.query(
            `INSERT INTO funciones (pelicula_id, fecha, hora, precio, estado, sala_id) VALUES ($1, CURRENT_DATE, '18:10:00', 20000, 'disponible', 1)`,
            [nuevaPelicula.id]
        );

        await db.query('COMMIT'); // Todo guardado con éxito
        res.status(201).json(nuevaPelicula);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Error al guardar la película:", err);
        res.status(500).json({ error: "Error al registrar la película y su función" });
    }
};

exports.editarPelicula = async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, duracion, genero, clasificacion, fecha_estreno, fecha_fin, estado } = req.body;
    const estadoBool = estado === 'true' || estado === true;

    try {
        const peliDb = await db.query('SELECT imagen_url FROM peliculas WHERE id = $1', [id]);
        if (peliDb.rows.length === 0) return res.status(404).json({ error: "Película no encontrada" });
        
        let imagen_url = peliDb.rows[0].imagen_url;

        if (req.file) {
            if (imagen_url.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '../../public', imagen_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            imagen_url = `/uploads/${req.file.filename}`;
        }

        const query = `
            UPDATE peliculas 
            SET titulo = $1, descripcion = $2, duracion = $3, genero = $4, 
                fecha_estreno = $5, fecha_fin = $6, estado = $7, imagen_url = $8
            WHERE id = $9 RETURNING *`;
        const values = [titulo, descripcion, duracion, genero, fecha_estreno || null, fecha_fin || null, estadoBool, imagen_url, id];
        
        const result = await db.query(query, values);
        res.json({ success: true, pelicula: result.rows[0] });

    } catch (err) {
        console.error("Error al editar:", err);
        res.status(500).json({ error: "Error interno al actualizar la película" });
    }
};

exports.eliminarPelicula = async (req, res) => {
    const { id } = req.params;
    try {
        // Primero borramos sus funciones asignadas (para que no de error de llave foránea)
        await db.query('DELETE FROM funciones WHERE pelicula_id = $1', [id]);

        const peliDb = await db.query('SELECT imagen_url FROM peliculas WHERE id = $1', [id]);
        await db.query('DELETE FROM peliculas WHERE id = $1', [id]);

        if (peliDb.rows.length > 0 && peliDb.rows[0].imagen_url.startsWith('/uploads/')) {
            const imagePath = path.join(__dirname, '../../public', peliDb.rows[0].imagen_url);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }
        res.json({ success: true, mensaje: "Película eliminada" });
    } catch (error) {
        if (error.code === '23503') {
            res.status(400).json({ success: false, error: "No puedes eliminar esta película porque ya tiene tiquetes vendidos. Mejor márcala como FINALIZADA." });
        } else {
            res.status(500).json({ success: false, error: "Error interno al eliminar." });
        }
    }
};