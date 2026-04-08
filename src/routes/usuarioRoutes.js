const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Definimos los endpoints
router.post('/login', usuarioController.login);
router.post('/registro', usuarioController.registrar);

module.exports = router;