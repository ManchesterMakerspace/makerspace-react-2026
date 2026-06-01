const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = env => ({
  mode: "development",
  entry: ["./src/app/main.tsx"],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "makerspace-react.js",
    chunkFilename: "[name].js",
    publicPath: "/"
  },
  optimization: {
    runtimeChunk: "single",
    splitChunks: {
      chunks: "all"
    }
  },
  module: {
    rules: [
      {
        test: /\.(png|jpg)$/,
        type: "asset",
        parser: {
          dataUrlCondition: {
            maxSize: 4096
          }
        }
      },
      {
        test: /\.svg$/,
        type: "asset/resource"
      },
      {
        test: /\.(html)$/,
        use: {
          loader: "html-loader",
          options: { minimize: true }
        }
      },
      {
        test: /\.(js|jsx|tsx|ts)$/,
        exclude: /(node_modules)/,
        use: [{ loader: "babel-loader" }]
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                silenceDeprecations: ["import", "legacy-js-api"]
              }
            }
          }
        ]
      }
    ]
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    alias: {
      "moment-timezone$": "moment-timezone/moment-timezone"
    },
    extensions: [
      ".ts", ".tsx", ".js", ".jsx",
      ".scss", ".sass", ".less",
      ".png", ".woff", ".woff2", ".eot", ".ttf", ".svg", ".ico"
    ],
    modules: ["src", "node_modules"]
  },
  cache: {
    type: "filesystem"
  },
  performance: {
    maxAssetSize: 3000000,
    maxEntrypointSize: 3000000
  },
  devtool: false,
  context: __dirname,
  target: "web",
  devServer: {
    hot: true,
    allowedHosts: "all",
    historyApiFallback: true,
    proxy: [{
      context: ["/api"],
      target: "http://localhost:3002"
    }],
    https: false,
    port: 3035,
    headers: { "Access-Control-Allow-Origin": "*" }
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/
    }),
    new webpack.SourceMapDevToolPlugin({
      filename: 'assets/[file].map',
      publicPath: '/'
    }),
    new MiniCssExtractPlugin({
      filename: `makerspace-react.css`
    }),
    new HtmlWebPackPlugin({
      template: "./src/assets/index.html",
      filename: "./index.html"
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: "src/assets/favicon.png", to: "favicon.png" }]
    }),
    new webpack.EnvironmentPlugin({
      BILLING_ENABLED: true,
      BASE_URL: (env && env.BASE_URL) || "",
      FIREBASE_API_KEY: "",
      FIREBASE_AUTH_DOMAIN: "",
      FIREBASE_PROJECT_ID: "",
      FIREBASE_APP_ID: "",
    }),
    ...process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []
  ]
});
