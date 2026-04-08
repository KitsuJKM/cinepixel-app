const express = require('express');
const router = express.Router();
const tiqueteController = require('../controllers/tiqueteController');

// Rutas exactas sincronizadas con el controlador
router.post('/', tiqueteController.comprarTiquete);
router.get('/ocupados', tiqueteController.obtenerOcupados);
router.post('/validar', tiqueteController.validarTiquete);

module.exports = router;