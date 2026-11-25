"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validate = require("../middleware/validate");
const blogValidator = require("../validators/blogValidator");
const commentValidator = require("../validators/commentValidator");
const controller = require("../controllers/blogController");

router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", auth, requireAdmin, validate(blogValidator.create), controller.create);
router.patch("/:id", auth, requireAdmin, controller.update);
router.delete("/:id", auth, requireAdmin, controller.remove);
router.get("/:id/comments", controller.comments);
router.post("/:id/comments", auth, validate(commentValidator.create), controller.addComment);

module.exports = router;
