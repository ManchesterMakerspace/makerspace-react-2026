const fs = require("fs");
const path = require("path");

const dist = path.resolve(__dirname, "..", "dist");

const linkedExtensions = new Set([
  ".css",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".png",
  ".svg",
  ".webp",
  ".woff",
  ".woff2",
  ".eot",
  ".ttf",
  ".otf"
]);

const baseline = [
  "//= link_tree ../images",
  "//= link_directory ../javascript .js",
  "//= link_directory ../stylesheets .css"
];

const excludedAssets = new Set([
  // FilledLaserableLogo.svg is provided by the host Rails app as
  // /assets/FilledLaserableLogo.svg. Do not link a stale webpack-emitted
  // copy from dist/assets, which would make Rails serve a duplicate
  // nested asset URL.
  "assets/FilledLaserableLogo.svg"
]);

function walk(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(prefix, entry.name);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath, relativePath);
    }

    return relativePath.replace(/\\/g, "/");
  });
}

const emittedAssets = walk(dist)
  .filter(name => name !== "manifest.js")
  .filter(name => name !== "favicon.png")
  .filter(name => !excludedAssets.has(name))
  .filter(name => linkedExtensions.has(path.extname(name).toLowerCase()))
  .sort();

const manifest = [
  ...emittedAssets.map(name => `//= link ${name}`),
  ...baseline
].join("\n") + "\n";

fs.writeFileSync(path.join(dist, "manifest.js"), manifest);
