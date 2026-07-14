// utils/asyncHandler.js
// Express doesn't automatically catch rejected promises thrown inside
// `async (req, res) => {...}` route handlers. Without this, a MongoDB
// hiccup (e.g. a dropped connection) would either crash the process or
// leave the request hanging forever with no response.
//
// Wrap every async route handler with this: asyncHandler(async (req, res) => {...})
// Any rejection is passed to next(err), which hits the error-handling
// middleware registered in server.js.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
