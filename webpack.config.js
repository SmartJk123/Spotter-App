const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const BundleTracker = require("webpack-bundle-tracker");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv && argv.mode === "development";

  return {
    mode: isDev ? "development" : "production",
    context: __dirname,
    entry: ["./frontend/js/index.tsx"],
    devtool: isDev ? "eval-source-map" : "source-map",
    output: {
      path: path.resolve(__dirname, "build"),
      publicPath: "/",
      filename: isDev ? "[name].js" : "[name]-[contenthash].js",
      clean: true
    },
    resolve: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          loader: "ts-loader",
          options: { transpileOnly: true },
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            isDev ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
            "postcss-loader"
          ]
        },
        { test: /\.(png|jpe?g|gif|webp|svg)$/i, type: "asset" },
        { test: /\.(woff2?|eot|ttf|otf)$/i, type: "asset" }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "frontend/public/index.html",
        minify: !isDev
      }),
      !isDev && new MiniCssExtractPlugin({ filename: "[name]-[contenthash].css" }),
      isDev && new ReactRefreshWebpackPlugin(),
      new BundleTracker({ path: __dirname, filename: "webpack-stats.json" }),
      new ForkTsCheckerWebpackPlugin()
    ].filter(Boolean),
    optimization: {
      splitChunks: { chunks: "all" },
      runtimeChunk: "single"
    },
    performance: { hints: false },
    devServer: isDev
      ? {
          static: { directory: path.resolve(__dirname, "build") },
          hot: true,
          host: "0.0.0.0",
          port: 3000,
          historyApiFallback: true
        }
      : undefined
  };
};

