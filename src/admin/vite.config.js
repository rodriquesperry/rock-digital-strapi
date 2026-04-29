const fs = require("node:fs/promises");
const path = require("node:path");
const { mergeConfig } = require("vite");

const prismCorePattern = /[\\/]prismjs[\\/]prism\.js$/;
const prismComponentPattern = /[\\/]prismjs[\\/]components[\\/]prism-[^/\\]+\.js$/;
const richTextBlocksInputPattern =
  /[\\/]strapi-plugin-rich-text-blocks-extended[\\/]dist[\\/]_chunks[\\/]Input-[^/\\]+\.(mjs|js)$/;
const prismCompatEsbuildFilter =
  /(?:[\\/]prismjs[\\/].*\.js$|[\\/]strapi-plugin-rich-text-blocks-extended[\\/]dist[\\/]_chunks[\\/]Input-[^/\\]+\.(?:mjs|js)$)/;

const transformRichTextBlocksInput = (code) =>
  code
    .replace(/^import "prismjs\/components\/prism-[^"]+";\n/gm, "")
    .replace(
      'const selectedLanguage = Prism.languages[decorateKey || "plaintext"];',
      'const selectedLanguage = Prism.languages?.[decorateKey || "plaintext"] || Prism.languages?.plaintext || {};',
    );

const createPrismCompatEsbuildPlugin = () => ({
  name: "prism-compat-esbuild",
  setup(build) {
    build.onLoad(
      { filter: prismCompatEsbuildFilter },
      async ({ path: filePath }) => {
        if (!prismCorePattern.test(filePath) && !prismComponentPattern.test(filePath)) {
          if (!richTextBlocksInputPattern.test(filePath)) {
            return null;
          }
        }

        let contents = await fs.readFile(filePath, "utf8");

        if (richTextBlocksInputPattern.test(filePath)) {
          contents = transformRichTextBlocksInput(contents);
        } else if (prismCorePattern.test(filePath)) {
          contents +=
            '\nif (typeof globalThis !== "undefined") { globalThis.Prism = Prism; }\n';
        } else {
          contents =
            'var Prism = globalThis.Prism || (typeof require_prism === "function" ? (globalThis.Prism = require_prism()) : (typeof window !== "undefined" ? window.Prism : undefined));\n' +
            contents;
        }

        return {
          contents,
          loader: "js",
          resolveDir: path.dirname(filePath),
        };
      },
    );
  },
});

const prismCompatVitePlugin = () => ({
  name: "prism-compat-vite",
  enforce: "pre",
  transform(code, id) {
    if (richTextBlocksInputPattern.test(id)) {
      return transformRichTextBlocksInput(code);
    }

    if (prismCorePattern.test(id)) {
      return `${code}\nif (typeof globalThis !== "undefined") { globalThis.Prism = Prism; }\n`;
    }

    if (prismComponentPattern.test(id)) {
      return (
        'var Prism = globalThis.Prism || (typeof require_prism === "function" ? (globalThis.Prism = require_prism()) : (typeof window !== "undefined" ? window.Prism : undefined));\n' +
        code
      );
    }

    return null;
  },
});

module.exports = (config) =>
  mergeConfig(config, {
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        plugins: [createPrismCompatEsbuildPlugin()],
      },
    },
    plugins: [prismCompatVitePlugin()],
  });

  // config