const express = require('express');
const router = express.Router();
const tiqueteController = require('../controllers/tiqueteController');

router.post('/', tiqueteController.comprarTiquete);
router.get('/sala/:pelicula_id', tiqueteController.obtenerDatosSala);
router.post('/validar', tiqueteController.validarTiquete); // NUEVA RUTA DE VALIDACIÓN

module.exports = router;