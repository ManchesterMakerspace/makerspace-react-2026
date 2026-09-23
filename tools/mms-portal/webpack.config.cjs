const path = require('node:path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { settings, root } = require('./config.cjs');
module.exports = () => {
  const { origin, debug } = settings();
  const config = require('../../prod.config.js')({ BASE_URL: origin });
  config.entry = [path.join(__dirname, 'src/main.tsx')];
  config.output = { ...config.output, path: path.join(__dirname, 'www'), publicPath: '/' };
  config.cache = { type: 'filesystem', cacheDirectory: path.join(__dirname, '.cache/webpack') };
  config.resolve.modules = [path.join(root, 'src'), path.join(__dirname, 'node_modules'), path.join(root, 'node_modules')];
  config.resolveLoader = { modules: [path.join(root, 'node_modules')] };
  config.resolve.alias = { ...config.resolve.alias, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') };
  const babelRule = config.module.rules.find(rule => rule.use?.[0]?.loader === 'babel-loader');
  babelRule.use[0].options = { configFile: path.join(root, '.babelrc') };
  config.plugins = config.plugins.map(plugin => {
    if (plugin instanceof HtmlWebpackPlugin) return new HtmlWebpackPlugin({ template: path.join(__dirname, 'index.html') });
    if (plugin instanceof webpack.EnvironmentPlugin) {
      const definitions = Object.fromEntries(Object.entries(plugin.defaultValues).map(([key, fallback]) =>
        ['process.env.' + key, JSON.stringify(key === 'BASE_URL' ? origin : process.env[key] ?? fallback)]));
      return new webpack.DefinePlugin(definitions);
    }
    return plugin;
  });
  config.plugins.push(new webpack.DefinePlugin({ 'process.env.MMS_PORTAL_API_URL': JSON.stringify(origin), 'process.env.MMS_PORTAL_DEBUG': JSON.stringify(debug) }));
  config.plugins.push(new CopyWebpackPlugin({ patterns: [{ from: path.join(root, 'src/assets/FilledLaserableLogo.svg'), to: 'assets/FilledLaserableLogo.svg' }] }));
  return config;
};
