"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const authValidator = require("../validators/authValidator");
const controller = require("../controllers/authController");

router.post("/register", authLimiter, validate(authValidator.register), controller.register);
router.post("/login", authLimiter, validate(authValidator.login), controller.login);
router.get("/me", auth, controller.me);
router.post("/logout", controller.logout);
router.patch("/password", auth, validate(authValidator.changePassword), controller.changePassword);
router.delete("/account", auth, validate(authValidator.deleteAccount), controller.deleteAccount);

module.exports = router;
