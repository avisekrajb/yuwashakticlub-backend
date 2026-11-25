"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/groupController");

router.get("/", auth, controller.list);
router.post("/", auth, requireAdmin, controller.create);
router.patch("/:id", auth, requireAdmin, controller.update);
router.delete("/:id", auth, requireAdmin, controller.remove);
router.post("/:id/members/:userId", auth, requireAdmin, controller.addMember);
router.delete("/:id/members/:userId", auth, requireAdmin, controller.removeMember);

module.exports = router;
