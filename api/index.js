// Vercel Serverless Function — entry point
// Wraps the Express app for serverless execution
const app = require('../apps/api/src/server');

module.exports = app;
