const db = require('../models/db');
const QRCode = require('qrcode');
const crypto = require('crypto');

// 1. OBTENER ASIENTOS OCUPADOS (Para pintar el mapa)
const obtenerOcupadosLogic = async (req, res) => {
    try {
        const { peli_id } = req.query;
        const query = `
            SELECT a.fila, a.numero
            FROM detalle_tiquetes dt
            JOIN asientos a ON dt.asiento_id = a.id
            JOIN funciones f ON dt.funcion_id = f.id
            WHERE f.pelicula_id = $1
        `;
        const result = await db.query(query, [peli_id]);
        const ocupados = result.rows.map(row => `${row.fila}${row.numero}`);
        res.json(ocupados);
    } catch (error) {
        console.error("Error al obtener ocupados:", error);
        res.status(500).json({ error: error.message });
    }
};
// Exportamos con ambos nombres posibles por si en tus rutas usaste getOcupados u obtenerOcupados
exports.obtenerOcupados = obtenerOcupadosLogic;
exports.getOcupados = obtenerOcupadosLogic;


// 2. VALIDAR TIQUETE (Para el panel de Admin)
exports.validarTiquete = async (req, res) => {
    try {
        const { codigo } = req.body;
        const result = await db.query('SELECT * FROM tiquetes WHERE codigo_qr = $1', [codigo]);
        
        if (result.rows.length === 0) {
            return res.json({ status: 'Inválido', mensaje: 'El tiquete no existe en el sistema.' });
        }
        
        const tiquete = result.rows[0];
        
        if (tiquete.estado === 'usado') {
            return res.json({ status: 'Usado', mensaje: 'Este tiquete ya fue validado anteriormente.' });
        }
        
        // Si es válido, lo marcamos como usado
        await db.query('UPDATE tiquetes SET estado = $1 WHERE id = $2', ['usado', tiquete.id]);
        res.json({ status: 'Válido', mensaje: 'Ingreso autorizado. Tiquete marcado como usado.' });
        
    } catch (error) {
        console.error("Error al validar:", error);
        res.status(500).json({ error: error.message });
    }
};


// 3. COMPRAR TIQUETE (Rápido, sin correos, QR instantáneo)
exports.comprarTiquete = async (req, res) => {
    const { pelicula_id, asientos, usuario_id } = req.body; 
    const codigo_unico = crypto.randomUUID();

    try {
        await db.query('BEGIN');

        const userDb = await db.query('SELECT nombre, correo FROM usuarios WHERE id = $1', [usuario_id]);
        if (userDb.rows.length === 0) throw new Error("Usuario no encontrado.");

        const funcDb = await db.query(`
            SELECT f.id, f.precio, p.titulo 
            FROM funciones f 
            JOIN peliculas p ON f.pelicula_id = p.id 
            WHERE f.pelicula_id = $1 LIMIT 1
        `, [pelicula_id]);
        
        if (funcDb.rows.length === 0) throw new Error("No hay funciones para esta película.");
        const { id: funcion_id, precio: precioBase } = funcDb.rows[0];

        let totalReal = 0;
        let asientosIds = [];

        for (const asientoStr of asientos) {
            const fila = asientoStr.charAt(0);
            const numero = parseInt(asientoStr.substring(1));
            const asientoDb = await db.query('SELECT id, recargo FROM asientos WHERE fila = $1 AND numero = $2', [fila, numero]);
            if (asientoDb.rows.length === 0) throw new Error(`Asiento no válido`);
            
            const asiento = asientoDb.rows[0];
            asientosIds.push(asiento.id);
            totalReal += (parseFloat(precioBase) + parseFloat(asiento.recargo));
        }

        const insertTiquete = await db.query(
            'INSERT INTO tiquetes (codigo_qr, funcion_id, total, estado) VALUES ($1, $2, $3, $4) RETURNING id',
            [codigo_unico, funcion_id, totalReal, 'valido']
        );
        const tiquete_id = insertTiquete.rows[0].id;

        for (const asiento_id of asientosIds) {
            await db.query(
                'INSERT INTO detalle_tiquetes (tiquete_id, asiento_id, funcion_id, estado) VALUES ($1, $2, $3, $4)',
                [tiquete_id, asiento_id, funcion_id, 'comprado']
            );
        }

        await db.query('COMMIT');

        const qrImage = await QRCode.toDataURL(codigo_unico);

        return res.status(201).json({ 
            mensaje: "¡Compra exitosa!", 
            codigo: codigo_unico, 
            qr_image: qrImage,
            total: totalReal
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("❌ Error en la compra:", error.message);
        return res.status(400).json({ error: error.message });
    }
};