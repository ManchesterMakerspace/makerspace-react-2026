const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => ({
  mode: "production",
  entry: ["./src/app/main.tsx"],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "makerspace-react.js",
    publicPath: "/"
  },
  module: {
    rules: [
      {
        test: /\.(png|jpg)$/,
        type: "asset/inline"
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
  context: __dirname,
  target: "web",
  plugins: [
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
    })
  ]
});
