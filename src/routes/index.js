"use strict";

const router = require("express").Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    service: "shree-yuwa-shakti-backend",
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

router.use("/", require("./contentRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/posts", require("./postRoutes"));
router.use("/stories", require("./storyRoutes"));
router.use("/live", require("./liveRoutes"));
router.use("/messages", require("./messageRoutes"));
router.use("/calls", require("./callRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/uploads", require("./uploadRoutes"));
router.use("/comments", require("./commentRoutes"));
router.use("/blogs", require("./blogRoutes"));
router.use("/about", require("./aboutRoutes"));
router.use("/banners", require("./bannerRoutes"));
router.use("/gallery", require("./galleryRoutes"));
router.use("/team", require("./teamRoutes"));
router.use("/groups", require("./groupRoutes"));

module.exports = router;
