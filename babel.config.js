module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic", importSource: "react" }],
    ["@babel/preset-typescript", { allowNamespaces: true }],
  ],
};