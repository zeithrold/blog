// Fixed code runs before the Mermaid IIFE, including DOMPurify's captured DOM APIs.
// Nonces are hidden during SVG serialization. Bless only the renderer's own CSS
// prefix before parsing; authored HTML, entities and configuration are rejected.
export const diagramPrelude = String.raw`
(() => {
  const nonce = 'CMS_NONCE_PLACEHOLDER';
  const create = document.createElement.bind(document);
  document.createElement = function(name, options) {
    const node = create(name, options);
    if (name === 'style') node.setAttribute('nonce', nonce);
    return node;
  };
  class NoncedParser extends DOMParser {
    parseFromString(input, type) {
      return super.parseFromString(String(input).replace(
        /<style(?: nonce="")?>(#cms-generated-diagram[\s\S]*?)<\/style>/g,
        '<style nonce="' + nonce + '">$1</style>'
      ), type);
    }
  }
  window.DOMParser = NoncedParser;
})();`
