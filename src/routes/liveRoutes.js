"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimiter");
const controller = require("../controllers/liveController");

router.get("/", auth.optionalAuth, controller.list);
router.get("/history", auth.optionalAuth, controller.history);
router.post("/", auth, writeLimiter, controller.start);
router.get("/:id", auth.optionalAuth, controller.get);
router.get("/:id/token", auth.optionalAuth, controller.token);
router.post("/:id/end", auth, controller.end);
router.post("/:id/comment", auth, controller.comment);
router.post("/:id/reaction", auth, controller.reaction);
router.post("/:id/leave", auth, controller.leave);

module.exports = router;
