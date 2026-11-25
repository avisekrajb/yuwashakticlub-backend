"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const authService = require("../services/authService");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.created(res, result, "Account created. Welcome to the club!");
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.ok(res, result, "Welcome back!");
});

const me = asyncHandler(async (req, res) => ApiResponse.ok(res, await authService.me(req.user._id)));

const logout = asyncHandler(async (_req, res) => ApiResponse.ok(res, { loggedOut: true }, "Logged out"));

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  return ApiResponse.ok(res, { changed: true }, "Password changed. Use it next time you log in.");
});

const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount(req.user._id, req.body.password);
  return ApiResponse.ok(res, { deleted: true }, "Your account and personal content were deleted.");
});

module.exports = { register, login, me, logout, changePassword, deleteAccount };
