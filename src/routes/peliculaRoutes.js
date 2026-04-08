const express = require('express');
const router = express.Router();
const peliculaController = require('../controllers/peliculaController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../public/uploads/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'portada-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/', peliculaController.obtenerPeliculas);
router.post('/', upload.single('portada'), peliculaController.crearPelicula);
router.put('/:id', upload.single('portada'), peliculaController.editarPelicula); // NUEVA RUTA PARA EDITAR
router.delete('/:id', peliculaController.eliminarPelicula);

module.exports = router;