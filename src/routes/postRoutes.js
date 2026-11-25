"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rateLimiter");
const commentValidator = require("../validators/commentValidator");
const controller = require("../controllers/postController");
const commentController = require("../controllers/commentController");

router.get("/", auth.optionalAuth, controller.list);
router.post("/", auth, writeLimiter, controller.create);
router.get("/:id", auth.optionalAuth, controller.get);
router.patch("/:id", auth, writeLimiter, controller.update);
router.delete("/:id", auth, writeLimiter, controller.remove);
router.post("/:id/react", auth, controller.react);
router.post("/:id/share", auth, controller.share);
router.post("/:id/view", auth.optionalAuth, controller.view);
router.get("/:id/comments", auth.optionalAuth, controller.listComments);
router.post("/:id/comments", auth, validate(commentValidator.create), controller.addComment);
router.delete("/:id/comments/:commentId", auth, controller.deleteComment);

module.exports = router;
