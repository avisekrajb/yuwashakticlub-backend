"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/bannerController");

router.get("/", controller.list);
router.post("/", auth, requireAdmin, controller.create);
router.patch("/:id", auth, requireAdmin, controller.update);
router.delete("/:id", auth, requireAdmin, controller.remove);

module.exports = router;
