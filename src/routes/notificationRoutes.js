"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/notificationController");

router.get("/", auth, controller.list);
router.get("/unread-count", auth, controller.unreadCount);
router.post("/read-all", auth, controller.readAll);
router.post("/broadcast", auth, requireAdmin, controller.broadcast);
router.post("/:id/read", auth, controller.readOne);
router.delete("/:id", auth, controller.remove);
router.delete("/", auth, controller.clear);

module.exports = router;
