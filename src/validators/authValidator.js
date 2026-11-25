"use strict";

const EMAIL = /^\S+@\S+\.\S+$/;

const clean = (v) => String(v ?? "").trim();

function register(body) {
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const password = String(body.password ?? "");
  if (name.length < 2 || name.length > 80) return { error: "Enter your full name (2-80 characters)." };
  if (!EMAIL.test(email) || email.length > 160) return { error: "Enter a valid email address." };
  if (password.length < 6 || password.length > 128) return { error: "Password must be 6-128 characters." };
  return { value: { name, email, password } };
}

function login(body) {
  const email = clean(body.email).toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your password." };
  return { value: { email, password } };
}

function changePassword(body) {
  const currentPassword = String(body.currentPassword ?? body.oldPassword ?? "");
  const newPassword = String(body.newPassword ?? body.password ?? "");
  if (!currentPassword) return { error: "Enter your current password." };
  if (newPassword.length < 6 || newPassword.length > 128) return { error: "New password must be 6-128 characters." };
  if (newPassword === currentPassword) return { error: "New password must be different from the current one." };
  return { value: { currentPassword, newPassword } };
}

function deleteAccount(body) {
  const password = String(body.password ?? "");
  const confirm = clean(body.confirm).toUpperCase();
  if (!password) return { error: "Enter your password to confirm." };
  if (confirm !== "DELETE") return { error: 'Type DELETE to confirm account deletion.' };
  return { value: { password, confirm } };
}

module.exports = { register, login, changePassword, deleteAccount };
