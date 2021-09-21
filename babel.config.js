module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        // Do not specify `targets` here, rather use browserlist (currently in package.json)
        // since targets mentioned here informs it only to babel-loader, and not to webpack
        useBuiltIns: "usage",
        corejs: { version: "3.18", proposals: true },
        shippedProposals: true,
        // Ref: https://www.jonathancreamer.com/webpack-tree-shaking-in-3-easy-steps/
        // modules: false, // preserve ES modules [default `auto`]
      }
    ],
    "@babel/preset-react",
    "@babel/preset-typescript"
  ],
  plugins: [
    // "@babel/plugin-transform-runtime", // https://github.com/babel/babel/issues/6629#issuecomment-416986687
    // "@babel/plugin-proposal-class-properties", // https://babeljs.io/docs/en/babel-preset-env#shippedproposals
  ]
};
