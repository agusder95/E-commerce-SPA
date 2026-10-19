import { Fragment } from 'react';
import { readRichText } from './model';
import './rich-text.css';

function renderNode(node, key) {
  if (node.type === 'text') {
    let text = node.text;
    if (node.format & 1) text = <strong>{text}</strong>;
    if (node.format & 2) text = <em>{text}</em>;
    if (node.format & 4) text = <s>{text}</s>;
    if (node.format & 8) text = <u>{text}</u>;
    return <Fragment key={key}>{text}</Fragment>;
  }
  if (node.type === 'linebreak') return <br key={key} />;
  const children = node.children.map((child, index) => renderNode(child, index));
  if (node.type === 'root') return <Fragment key={key}>{children}</Fragment>;
  const Tag = node.type === 'list' ? node.tag : node.type === 'listitem' ? 'li' :
    node.type === 'heading' ? node.tag : node.type === 'quote' ? 'blockquote' : 'p';
  const nested = node.type === 'listitem' && node.children.every(child => child.type === 'list');
  return <Tag key={key} className={nested ? 'rich-text-nested-item' : undefined}
    style={{ textAlign: node.format || undefined, marginInlineStart: node.indent ? `${node.indent * 2}em` : undefined }}
    start={Tag === 'ol' ? node.start : undefined} dir={node.direction || undefined}>
    {children.length ? children : <br />}
  </Tag>;
}

export default function RichTextContent({ value }) {
  const document = readRichText(value);
  return <div className="rich-text-content">{document ? renderNode(document.root, 0)
    : <div className="rich-text-plain">{value}</div>}</div>;
}
