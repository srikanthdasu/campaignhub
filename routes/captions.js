const express = require("express");
const router = express.Router();
const captionController = require("../controllers/captionController");

router.get("/history/:userId", captionController.getCaptionHistory);
router.delete("/:id", captionController.deleteCaption);

module.exports = router;
