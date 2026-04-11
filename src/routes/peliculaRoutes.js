const express = require('express');
const router = express.Router();
const peliculaController = require('../controllers/peliculaController');

router.get('/', peliculaController.obtenerPeliculas);
router.get('/:id', peliculaController.obtenerPeliculaPorId);
router.post('/', peliculaController.crearPelicula);
router.put('/:id', peliculaController.actualizarPelicula);
router.delete('/:id', peliculaController.eliminarPelicula);

module.exports = router;