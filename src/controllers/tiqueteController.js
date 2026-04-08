const db = require('../models/db');
const QRCode = require('qrcode');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configuración del servicio de correos
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.comprarTiquete = async (req, res) => {
    // AHORA RECIBIMOS EL ID DEL USUARIO QUE ESTÁ COMPRANDO
    const { pelicula_id, asientos, usuario_id } = req.body; 
    const codigo_unico = crypto.randomUUID();

    try {
        await db.query('BEGIN');

        // 1. Obtener datos del usuario para el correo
        const userDb = await db.query('SELECT nombre, correo FROM usuarios WHERE id = $1', [usuario_id]);
        if (userDb.rows.length === 0) throw new Error("Usuario no encontrado.");
        const usuario = userDb.rows[0];

        // 2. Encontrar la función asignada a esta película
        const funcDb = await db.query(`
            SELECT f.id, f.precio, p.titulo, f.hora 
            FROM funciones f 
            JOIN peliculas p ON f.pelicula_id = p.id 
            WHERE f.pelicula_id = $1 LIMIT 1
        `, [pelicula_id]);
        
        if (funcDb.rows.length === 0) throw new Error("No hay funciones programadas para esta película.");
        
        const funcion_id = funcDb.rows[0].id;
        const precioBase = parseFloat(funcDb.rows[0].precio);
        const tituloPelicula = funcDb.rows[0].titulo;
        const horaFuncion = funcDb.rows[0].hora;

        let totalReal = 0;
        let asientosIds = [];

        // 3. Validar y separar asientos
        for (const asientoStr of asientos) {
            const fila = asientoStr.charAt(0);
            const numero = parseInt(asientoStr.substring(1));

            const asientoDb = await db.query('SELECT id, recargo FROM asientos WHERE fila = $1 AND numero = $2', [fila, numero]);
            if (asientoDb.rows.length === 0) throw new Error(`Asiento ${asientoStr} no válido`);
            
            const asiento = asientoDb.rows[0];
            asientosIds.push(asiento.id);
            
            totalReal += (precioBase + parseFloat(asiento.recargo));

            const checkOcupado = await db.query(`
                SELECT id FROM detalle_tiquetes 
                WHERE asiento_id = $1 AND funcion_id = $2 
                AND (estado = 'comprado' OR (estado = 'bloqueado' AND fecha_bloqueo > NOW() - INTERVAL '5 minutes'))
            `, [asiento.id, funcion_id]);

            if (checkOcupado.rows.length > 0) {
                throw new Error(`El asiento ${asientoStr} acaba de ser reservado por alguien más.`);
            }
        }

        // 4. Registrar la compra
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
        
        // 5. Generar el QR
        const qrImage = await QRCode.toDataURL(codigo_unico);

        // --- NUEVO: ENVIAR EL CORREO ELECTRÓNICO ---
        try {
            await transporter.sendMail({
                from: `"CinePixel" <${process.env.EMAIL_USER}>`,
                to: usuario.correo,
                subject: `🎟️ Tu tiquete para ${tituloPelicula} - CinePixel`,
                html: `
                    <div style="font-family: Arial, sans-serif; background-color: #0a0a0f; color: #ffffff; padding: 30px; text-align: center; border-radius: 10px; max-width: 500px; margin: auto; border: 1px solid #e5c07b;">
                        <h1 style="color: #e5c07b;">¡Reserva Exitosa, ${usuario.nombre}!</h1>
                        <p style="font-size: 16px;">Has comprado entradas para:</p>
                        <h2 style="margin: 5px 0;">${tituloPelicula}</h2>
                        <p style="color: #a0a0b0;">Hora: ${horaFuncion} | Asientos: ${asientos.join(', ')}</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
                            <img src="cid:qr-code" alt="Código QR" style="width: 200px; height: 200px;">
                        </div>
                        
                        <p style="font-size: 12px; color: #a0a0b0;">Código de reserva: ${codigo_unico}</p>
                        <p>Presenta este código QR en la entrada de la sala.</p>
                        <p style="color: #e5c07b; font-weight: bold; margin-top: 30px;">¡Disfruta la función!</p>
                    </div>
                `,
                attachments: [
                    {
                        filename: 'qrcode.png',
                        content: qrImage.split("base64,")[1], // Extraemos solo los datos base64
                        encoding: 'base64',
                        cid: 'qr-code' // Mismo ID que usamos en el src del HTML
                    }
                ]
            });
            console.log("Correo enviado a:", usuario.correo);
        } catch (emailError) {
            // Si el correo falla, no cancelamos la compra (ya se guardó en BD), solo avisamos en consola
            console.error("La compra fue exitosa, pero falló el envío del correo:", emailError);
        }

        // 6. Responder al Frontend
        res.status(201).json({ mensaje: "¡Compra exitosa!", codigo: codigo_unico, qr_image: qrImage, total_pagado: totalReal });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Error Transaccional:", error.message);
        res.status(400).json({ error: error.message });
    }
};

exports.obtenerDatosSala = async (req, res) => {
    const { pelicula_id } = req.params;
    try {
        const funcDb = await db.query('SELECT id FROM funciones WHERE pelicula_id = $1 LIMIT 1', [pelicula_id]);
        if (funcDb.rows.length === 0) {
            const vipDb = await db.query(`SELECT fila, numero FROM asientos WHERE tipo = 'VIP'`);
            return res.json({ ocupados: [], vip: vipDb.rows.map(r => `${r.fila}${r.numero}`) });
        }
        const funcion_id = funcDb.rows[0].id;
        const ocupadosDb = await db.query(`
            SELECT a.fila, a.numero 
            FROM detalle_tiquetes dt
            JOIN asientos a ON dt.asiento_id = a.id
            WHERE dt.funcion_id = $1 
            AND (dt.estado = 'comprado' OR (dt.estado = 'bloqueado' AND dt.fecha_bloqueo > NOW() - INTERVAL '5 minutes'))
        `, [funcion_id]);
        const vipDb = await db.query(`SELECT fila, numero FROM asientos WHERE tipo = 'VIP'`);
        res.json({ ocupados: ocupadosDb.rows.map(r => `${r.fila}${r.numero}`), vip: vipDb.rows.map(r => `${r.fila}${r.numero}`) });
    } catch (error) { res.status(500).json({ error: "Error al obtener datos de la sala" }); }
};

exports.validarTiquete = async (req, res) => {
    const { codigo } = req.body;
    try {
        const ticketDb = await db.query('SELECT id, estado FROM tiquetes WHERE codigo_qr = $1', [codigo]);
        if (ticketDb.rows.length === 0) return res.json({ status: 'Inválido', mensaje: 'El código no existe en el sistema.' });
        const tiquete = ticketDb.rows[0];
        if (tiquete.estado === 'usado') return res.json({ status: 'Usado', mensaje: 'Este tiquete ya fue usado.' });
        await db.query('UPDATE tiquetes SET estado = $1 WHERE id = $2', ['usado', tiquete.id]);
        res.json({ status: 'Válido', mensaje: 'Acceso concedido a la sala.' });
    } catch (error) { res.status(500).json({ error: "Error interno al validar." }); }
};