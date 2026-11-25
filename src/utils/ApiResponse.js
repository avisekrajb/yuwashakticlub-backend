"use strict";

class ApiResponse {
  constructor(statusCode, data, message = "OK") {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }

  static ok(res, data, message = "OK") {
    return res.status(200).json(new ApiResponse(200, data, message));
  }

  static created(res, data, message = "Created") {
    return res.status(201).json(new ApiResponse(201, data, message));
  }

  static send(res, statusCode, data, message = "OK") {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
  }
}

module.exports = ApiResponse;
