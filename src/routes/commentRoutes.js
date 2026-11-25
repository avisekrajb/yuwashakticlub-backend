"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const commentValidator = require("../validators/commentValidator");
const controller = require("../controllers/commentController");

router.get("/", auth.optionalAuth, controller.list);
router.post("/", auth, validate(commentValidator.create), controller.create);
router.delete("/:id", auth, controller.remove);

module.exports = router;
