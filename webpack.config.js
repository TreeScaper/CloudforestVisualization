const path = require('path');
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

var package_json  = require('./package.json');

module.exports = {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
        contentBase: "./dist",
    },
    entry: "./src/index.js",
    plugins: [
        new CleanWebpackPlugin(),
        new webpack.DefinePlugin({
            __VERSION__: JSON.stringify(package_json.version)
        })
    ],
    output: {
        filename: "bundle-" + package_json.version + ".js",
        path: path.resolve(__dirname, "dist"),
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
        ],
    },
};
