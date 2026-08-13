const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");

router.get("/scheduler/pdf", reportsController.schedulerPdf);
router.get("/scheduler/excel", reportsController.schedulerExcel);
router.get("/captions/pdf", reportsController.captionsPdf);
router.get("/captions/excel", reportsController.captionsExcel);

module.exports = router;
