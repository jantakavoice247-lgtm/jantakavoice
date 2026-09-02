const express = require('express');
const router = express.Router();
const {
  createReport,
  getMyReports,
} = require('../controllers/reportController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createReport);
router.get('/my', getMyReports);

module.exports = router;