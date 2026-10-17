const alignment = new Set(['left', 'center', 'right', 'justify', 'start', 'end', '']);

// Accept only the nodes and attributes supported by our editor/viewer. Never render HTML.
export function readRichText(value) {
  try {
    const document = JSON.parse(value);
    if (document?.root?.type !== 'root') return null;
    let count = 0;
    function clean(node, depth = 0, parent = null) {
      if (!node || depth > 32 || ++count > 10000) throw new Error('Invalid document');
      const allowed = parent === 'root' ? ['paragraph', 'heading', 'quote', 'list'] : parent === 'list' ? ['listitem'] :
        parent === 'listitem' ? ['text', 'linebreak', 'paragraph', 'list'] : ['text', 'linebreak'];
      if (parent && !allowed.includes(node.type)) throw new Error('Invalid hierarchy');
      if (node.type === 'text') return { type: 'text', version: 1, text: String(node.text ?? ''),
        format: Number(node.format) & 15, detail: 0, mode: 'normal', style: '' };
      if (node.type === 'linebreak') return { type: 'linebreak', version: 1 };
      if (!['root', 'paragraph', 'list', 'listitem', 'heading', 'quote'].includes(node.type) || !Array.isArray(node.children))
        throw new Error('Unsupported node');
      const result = { type: node.type, version: 1, children: node.children.map(child => clean(child, depth + 1, node.type)),
        direction: node.direction === 'rtl' ? 'rtl' : null,
        format: alignment.has(node.format) ? node.format : '', indent: Math.max(0, Math.min(8, Number(node.indent) || 0)) };
      if (node.type === 'list') Object.assign(result, { listType: node.listType === 'number' ? 'number' : 'bullet',
        tag: node.listType === 'number' ? 'ol' : 'ul', start: Math.max(1, Math.min(9999, Number(node.start) || 1)) });
      if (node.type === 'listitem') result.value = Math.max(1, Number(node.value) || 1);
      if (node.type === 'heading') result.tag = ['h2', 'h3', 'h4'].includes(node.tag) ? node.tag : 'h2';
      return result;
    }
    return { root: clean(document.root) };
  } catch { return null; }
}
