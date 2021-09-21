const path = require('path');

module.exports = (env) => {
  const outDir = env.ESM ? 'dist/esm' : 'dist/cjs';
  const libraryType = env.ESM ? 'module' : 'commonjs';
  const experiments = env.ESM ? { outputModule: true } : {};

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
    externalsPresets: {
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
    stats,
  };
};
