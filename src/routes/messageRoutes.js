"use strict";

const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const messageValidator = require("../validators/messageValidator");
const controller = require("../controllers/messageController");

router.get("/conversations", auth, controller.conversations);
router.post("/conversations/direct", auth, controller.createDirect);
router.get("/unread", auth, controller.unreadTotal);
router.get("/conversations/:id", auth, controller.messages);
router.post("/conversations/:id/messages", auth, validate(messageValidator.send), controller.send);
router.post("/conversations/:id/read", auth, controller.read);
router.post("/conversations/:id/delivered", auth, controller.delivered);
router.delete("/conversations/:id", auth, controller.removeConversation);
router.patch("/:id", auth, validate(messageValidator.edit), controller.edit);
router.delete("/:id", auth, controller.remove);
router.post("/:id/react", auth, controller.react);

module.exports = router;
