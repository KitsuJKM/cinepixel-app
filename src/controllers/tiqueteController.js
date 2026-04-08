const db = require('../models/db');
const QRCode = require('qrcode');
const crypto = require('crypto');

exports.comprarTiquete = async (req, res) => {
    const { pelicula_id, asientos, usuario_id } = req.body; 
    const codigo_unico = crypto.randomUUID();

    try {
        await db.query('BEGIN');

        // 1. Obtener datos del usuario
        const userDb = await db.query('SELECT nombre, correo FROM usuarios WHERE id = $1', [usuario_id]);
        if (userDb.rows.length === 0) throw new Error("Usuario no encontrado.");

        // 2. Obtener datos de la función
        const funcDb = await db.query(`
            SELECT f.id, f.precio, p.titulo 
            FROM funciones f 
            JOIN peliculas p ON f.pelicula_id = p.id 
            WHERE f.pelicula_id = $1 LIMIT 1
        `, [pelicula_id]);
        
        if (funcDb.rows.length === 0) throw new Error("No hay funciones para esta película.");
        const { id: funcion_id, precio: precioBase } = funcDb.rows[0];

        // 3. Calcular total e insertar tiquete
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

        // 4. Insertar detalles de la compra
        for (const asiento_id of asientosIds) {
            await db.query(
                'INSERT INTO detalle_tiquetes (tiquete_id, asiento_id, funcion_id, estado) VALUES ($1, $2, $3, $4)',
                [tiquete_id, asiento_id, funcion_id, 'comprado']
            );
        }

        await db.query('COMMIT');

        // 5. Generar QR exclusivamente para mostrar en pantalla
        const qrImage = await QRCode.toDataURL(codigo_unico);

        // RESPUESTA INMEDIATA AL FRONTEND
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