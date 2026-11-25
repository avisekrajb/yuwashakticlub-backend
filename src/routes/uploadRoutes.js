"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/upload");
const controller = require("../controllers/uploadController");

router.use(auth, uploadLimiter, upload.single("file"));

router.post("/image", controller.image);
router.post("/video", controller.video);
router.post("/audio", controller.audio);
router.post("/avatar", controller.avatar);
router.post("/media", controller.media);

module.exports = router;
