const db = require('../models/db');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query(
            'SELECT id, nombre, rol FROM usuarios WHERE correo = $1 AND password_hash = $2',
            [email, password]
        );

        if (result.rows.length > 0) {
            res.json({ success: true, mensaje: 'Inicio de sesión exitoso', usuario: result.rows[0] });
        } else {
            res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
};

exports.registrar = async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        // Por defecto, todo el que se registra en la web tiene rol 'cliente'
        const result = await db.query(
            'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, rol',
            [nombre, email, password, 'cliente']
        );
        res.status(201).json({ success: true, mensaje: 'Registro exitoso', usuario: result.rows[0] });
    } catch (error) {
        // Error 23505 en PostgreSQL significa "Violación de llave única" (El correo ya existe)
        if (error.code === '23505') { 
            res.status(400).json({ success: false, error: 'Este correo ya está registrado.' });
        } else {
            console.error("Error al registrar:", error);
            res.status(500).json({ success: false, error: 'Error al crear el usuario en la base de datos.' });
        }
    }
};