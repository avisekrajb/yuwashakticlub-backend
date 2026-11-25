"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/callController");

router.get("/history", auth, controller.history);
router.post("/", auth, controller.start);
router.get("/:id", auth, controller.get);
router.get("/:id/token", auth, controller.token);
router.post("/:id/accept", auth, controller.accept);
router.post("/:id/join", auth, controller.join);
router.post("/:id/reject", auth, controller.reject);
router.post("/:id/end", auth, controller.end);
router.post("/:id/control", auth, controller.control);

module.exports = router;
