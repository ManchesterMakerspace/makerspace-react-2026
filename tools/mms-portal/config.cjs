const path = require('node:path');
const DEFAULT_ORIGIN = 'https://members.manchestermakerspace.org';
function settings(env = process.env) {
  const api = new URL(env.MMS_PORTAL_API_URL || DEFAULT_ORIGIN);
  const debug = env.MMS_PORTAL_DEBUG === 'true';
  if (api.username || api.password || api.search || api.hash || api.pathname !== '/' ||
      !['https:', 'http:'].includes(api.protocol)) throw new Error('MMS_PORTAL_API_URL must be an HTTP(S) origin.');
  if (api.protocol !== 'https:' && !debug) throw new Error('HTTP is permitted only with MMS_PORTAL_DEBUG=true.');
  return { origin: api.origin, debug };
}
module.exports = { settings, DEFAULT_ORIGIN, root: path.resolve(__dirname, '../..') };
