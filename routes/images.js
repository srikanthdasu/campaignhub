const express = require("express");
const router = express.Router();
const imagesController = require("../controllers/imagesController");

router.post("/", imagesController.generateImage);
router.get("/:userId", imagesController.getHistory);
router.delete("/:id", imagesController.deleteImage);

module.exports = router;
