const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
process.env.NODE_ENV = 'production';
const { settings } = require('../config.cjs');
const config = require('../webpack.config.cjs')();
webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
    return;
  }
  const assets = stats.toJson({ all: false, assets: true }).assets.map(asset => asset.name);
  if (!assets.includes('index.html') || !assets.includes('makerspace-react.js')) throw new Error('Incomplete mobile bundle.');
  const html = fs.readFileSync(path.join(config.output.path, 'index.html'), 'utf8');
  if (!html.includes('viewport') || html.includes('/assets/makerspace-react')) throw new Error('Invalid mobile HTML.');
  fs.writeFileSync(path.join(config.output.path, 'build-settings.json'), JSON.stringify(settings()));
  console.log(stats.toString({ colors: false, all: false, errors: true, warnings: true, timings: true }));
  console.log('Built bundled MMS Portal assets.');
});
