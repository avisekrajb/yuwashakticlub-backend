"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validate = require("../middleware/validate");
const userValidator = require("../validators/userValidator");
const authValidator = require("../validators/authValidator");
const controller = require("../controllers/userController");
const authController = require("../controllers/authController");

router.get("/", auth.optionalAuth, controller.list);
router.get("/directory", auth, controller.directory);
router.patch("/me", auth, validate(userValidator.updateProfile), controller.updateMe);
router.patch("/me/settings", auth, validate(userValidator.updateSettings), controller.updateSettings);
router.delete("/me", auth, validate(authValidator.deleteAccount), authController.deleteAccount);
router.get("/:id", controller.get);
router.patch("/:id", auth, requireAdmin, controller.adminUpdate);
router.delete("/:id", auth, requireAdmin, controller.adminRemove);

module.exports = router;
