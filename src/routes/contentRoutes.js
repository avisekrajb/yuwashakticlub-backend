"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/contentController");

router.get("/bootstrap", auth.optionalAuth, controller.bootstrap);
router.get("/config", controller.config);
router.get("/stats", auth, requireAdmin, controller.stats);
router.put("/admin/collections/:name", auth, requireAdmin, controller.replaceCollection);
router.get("/collections/:name", auth.optionalAuth, controller.list);
router.post("/collections/:name", auth, requireAdmin, controller.create);
router.patch("/collections/:name/:id", auth, requireAdmin, controller.update);
router.delete("/collections/:name/:id", auth, requireAdmin, controller.remove);

module.exports = router;
