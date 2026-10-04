const path = require('path');
const webpack = require('webpack');
const config = require('../tool-groups/webpack.cjs');
module.exports = { ...config, entry: path.join(__dirname, 'entry.tsx'),
  output: { path: path.resolve(__dirname, '../../../tmp/shop-filter-browser'), filename: 'fixture.js' },
  plugins: [...config.plugins, new webpack.DefinePlugin({ 'process.env': '{}' }), new webpack.NormalModuleReplacementPlugin(/^(api\/toolCheckouts|api\/locations|ui\/hooks\/useReadTransaction|ui\/hooks\/useWriteTransaction|\.\/CheckoutCatalog)$/, resource => {
    const file = resource.request.endsWith('useReadTransaction') ? 'read' : resource.request.endsWith('useWriteTransaction') ? 'write' : 'mocks';
    resource.request = path.join(__dirname, `${file}.ts`);
  })]
};
