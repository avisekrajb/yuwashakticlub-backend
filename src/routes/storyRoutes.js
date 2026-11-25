"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimiter");
const controller = require("../controllers/storyController");

router.get("/", auth.optionalAuth, controller.list);
router.post("/", auth, writeLimiter, controller.create);
router.post("/:id/view", auth, controller.view);
router.delete("/:id", auth, writeLimiter, controller.remove);

module.exports = router;
