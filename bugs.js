const express = require('express');
const router = express.Router();
const bugController = require('../controllers/bugController');
const { authMiddleware } = require('../middleware/auth');
const { uploadBugDoc } = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', bugController.getBugs);
router.post('/', uploadBugDoc.single('document'), bugController.createBug);
router.put('/:id', bugController.toggleBugStatus);
router.delete('/:id', bugController.deleteBug);
router.get('/:id/download', bugController.downloadBugDoc);

module.exports = router;
