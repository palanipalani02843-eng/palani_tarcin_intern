/**
 * Vercel Serverless Function Entrypoint
 * Forwards all incoming API requests to the Express app or Native Node Server in server/server.js
 */
const serverOrApp = require('../server/server.js');

module.exports = (req, res) => {
  if (typeof serverOrApp === 'function') {
    return serverOrApp(req, res);
  }
  if (serverOrApp && typeof serverOrApp.emit === 'function') {
    return serverOrApp.emit('request', req, res);
  }
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, message: 'Server handler unavailable' }));
};
