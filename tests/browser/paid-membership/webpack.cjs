const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
module.exports = {
  mode: 'development', entry: path.join(__dirname, 'entry.tsx'),
  output: { path: path.resolve(__dirname, '../../../tmp/paid-membership-browser'), filename: 'fixture.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], plugins: [new TsconfigPathsPlugin()] },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: 'babel-loader' },
    { test: /\.m?js$/, include: /node_modules[\\/]@mui/, resolve: { fullySpecified: false } },
  ] },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^api\/continuousPaidMembership$/, resource => { resource.request = path.join(__dirname, 'api.ts'); }),
    new webpack.NormalModuleReplacementPlugin(/^ui\/reducer\/hooks$/, resource => { resource.request = path.join(__dirname, 'auth.ts'); }),
    new HtmlWebpackPlugin({ templateContent: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paid membership check</title></head><body><div id="root"></div></body></html>' }),
  ],
};
