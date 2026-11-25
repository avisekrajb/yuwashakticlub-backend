"use strict";

const bcrypt = require("bcryptjs");
const env = require("../config/env");

const hashPassword = (plain) => bcrypt.hash(String(plain), env.bcryptRounds);
const comparePassword = (plain, hash) => bcrypt.compare(String(plain), String(hash || ""));

module.exports = { hashPassword, comparePassword };
