const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const BundleTracker = require("webpack-bundle-tracker");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

  return {
    mode: isDev ? "development" : "production",
    devtool: "source-map",
    context: __dirname,
    entry: ["./frontend/js/index.tsx"],
    output: isDev
      ? {
          path: path.resolve("./frontend/webpack_bundles/"),
          publicPath: "http://localhost:3000/frontend/webpack_bundles/",
          filename: "[name].js",
        }
      : {
          path: path.resolve("./frontend/webpack_bundles/"),
          publicPath: "auto",
          filename: "[name]-[chunkhash].js",
          clean: true,
        },
    devServer: isDev
      ? {
          static: { directory: path.resolve(__dirname, "frontend/public") },
          hot: true,
          historyApiFallback: true,
          host: "0.0.0.0",
          port: 3000,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      : undefined,
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
            use: [{ loader: "ts-loader" }],
          exclude: /node_modules/,
        },
        {
          test: /\.(js|jsx)$/,
          type: "javascript/auto",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isDev ? "style-loader" : MiniCssExtractPlugin.loader,
            { loader: "css-loader", options: { importLoaders: 1 } },
            "postcss-loader",
          ],
        },
        { test: /\.(svg)(\?v=\d+\.\d+\.\d+)?$/, type: "asset" },
        { test: /\.(woff2?|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/, type: "asset" },
        { test: /\.(png|jpg|jpeg|gif|webp)?$/, type: "asset" },
      ],
    },
    plugins: [
      !isDev && new MiniCssExtractPlugin({ filename: "[name]-[chunkhash].css" }),
      isDev && new ReactRefreshWebpackPlugin(),
      new BundleTracker({ path: __dirname, filename: "webpack-stats.json" }),
    ].filter(Boolean),
    resolve: {
      modules: [
        path.resolve(__dirname, "node_modules"),
        path.resolve(__dirname, "frontend/js/"),
      ],
      extensions: [".ts", ".tsx", ".js"],
    },
    optimization: {
      minimize: !isDev,
      splitChunks: { chunks: "all" },
    },
  };
};

