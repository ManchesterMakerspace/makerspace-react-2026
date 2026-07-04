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
    clean: true,
    filename: pathData => pathData.chunk && pathData.chunk.name === "main" ? "makerspace-react.js" : "makerspace-react.[name].js",
    chunkFilename: "makerspace-react.[name].js",
    sourceMapFilename: "[file].map",
    publicPath: "/assets/"
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|svg)$/,
        exclude: /FilledLaserableLogo\.svg$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext]"
        }
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
      },
      {
        // MUI's internal Collapse/Transition wrapper (an .mjs file) imports
        // 'react-transition-group/TransitionGroupContext' without an
        // extension. Webpack 5's strict ESM resolution requires fully
        // specified import paths from .mjs files, and react-transition-group
        // ships only .js (CJS), so the import can't resolve. The relaxation
        // must target the IMPORTING module (@mui/material), not the
        // imported one — fullySpecified is a property of the resolving
        // file's module type, not the target's.
        test: /\.m?js$/,
        include: /node_modules[\\/]@mui/,
        resolve: {
          fullySpecified: false
        }
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
  optimization: {
    splitChunks: {
      // Rails currently includes only the main makerspace-react.js asset.
      // Keep initial dependencies in that file so the Rails-mounted app can
      // boot, while still splitting lazy route dependencies into async chunks.
      chunks: "async"
    }
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: `makerspace-react.css`,
      chunkFilename: `makerspace-react.[name].css`
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
