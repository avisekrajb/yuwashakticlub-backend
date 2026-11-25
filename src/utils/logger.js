"use strict";

const stamp = () => new Date().toISOString();

const write = (level, args) => {
  const line = `[${stamp()}] ${level}`;
  if (level === "ERROR") console.error(line, ...args);
  else if (level === "WARN") console.warn(line, ...args);
  else console.log(line, ...args);
};

module.exports = {
  info: (...args) => write("INFO ", args),
  warn: (...args) => write("WARN ", args),
  error: (...args) => write("ERROR", args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== "production") write("DEBUG", args);
  },
};
