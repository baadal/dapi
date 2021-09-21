const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = (env) => {
  const outDir = env.ESM ? 'dist/esm' : 'dist/cjs';
  const libraryType = env.ESM ? 'module' : 'commonjs2';
  const experiments = env.ESM ? { outputModule: true } : {};

  const plugins = [];

  if (env.ESM) {
    const banner = `
      import { createRequire } from 'module';
      let require = createRequire(import.meta.url);
    `;

    plugins.push(
      new webpack.BannerPlugin({
        banner,
        raw: true,
        entryOnly: true,
      })
    );
  }

  const stats = {
    // timings: false,
    hash: false,
    version: false,
    builtAt: false,
    assets: false,
    entrypoints: false,
    modules: false,
    chunks: false,
    children: false
  };

  return {
    mode: 'production',
    entry: {
      'index': './src/index.ts',
    },
    experiments,
    output: {
      filename: '[name].js',
      path: path.resolve(process.cwd(), outDir),
      library: {
        type: libraryType,
      },
    },
    target: 'node14', // node version is mentioned to declare support for ESM
    externals: [nodeExternals()], // ignore all modules in node_modules folder
    externalsPresets: {
      // Ref: https://stackoverflow.com/a/35820388
      node: true, // Target node environment (ignore built-in modules like path, fs, etc.)
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.(tsx?|jsx?)$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
      ],
    },
    devtool: 'source-map',
    plugins,
    stats,
  };
};
