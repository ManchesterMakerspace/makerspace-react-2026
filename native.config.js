const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const production = require('./prod.config');
module.exports = env => {
  const origin = process.env.NATIVE_API_ORIGIN;
  if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin) {
    throw new Error('Set NATIVE_API_ORIGIN to the HTTPS portal origin, with no path or trailing slash.');
  }
  const config = production(env);
  config.entry = ['./src/native/main.ts'];
  config.output = { ...config.output, path: path.resolve(__dirname, 'dist-native'), publicPath: '/', filename: '[name].[contenthash].js', chunkFilename: '[name].[contenthash].js' };
  config.plugins.push(new CopyPlugin({ patterns: [{ from: 'src/assets/FilledLaserableLogo.svg', to: 'assets/FilledLaserableLogo.svg' }] }));
  return config;
};
