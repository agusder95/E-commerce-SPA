import { useEffect, useRef } from "react";
import {
    defineExtension,
    $getRoot,
    $createParagraphNode,
    $createTextNode,
} from "lexical";
import { RichTextExtension, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListExtension } from "@lexical/list";
import { HistoryExtension } from "@lexical/history";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import EditorToolbar from "./EditorToolbar";
import { readRichText } from "./model";
import "./rich-text.css";

const extension = defineExtension({
    name: "ProductDescription",
    namespace: "ProductDescription",
    dependencies: [RichTextExtension, ListExtension, HistoryExtension],
    nodes: () => [HeadingNode, QuoteNode],
    theme: {
        text: {
            bold: "rich-text-bold",
            italic: "rich-text-italic",
            underline: "rich-text-underline",
        },
        list: { nested: { listitem: "rich-text-nested-item" } },
    },
});

function EditorStateSync({ value, onChange, disabled }) {
    const [editor] = useLexicalComposerContext();
    const lastValue = useRef(null);
    const change = useRef(onChange);
    useEffect(() => {
        change.current = onChange;
    }, [onChange]);
    useEffect(() => {
        editor.setEditable(!disabled);
    }, [editor, disabled]);
    useEffect(() => {
        if (value === lastValue.current) return;
        lastValue.current = value;
        const document = readRichText(value);
        if (document?.root.children.length)
            editor.setEditorState(
                editor.parseEditorState(JSON.stringify(document)),
            );
        else
            editor.update(() => {
                const root = $getRoot();
                root.clear();
                for (const line of (document ? "" : value || "").split("\n"))
                    root.append(
                        $createParagraphNode().append($createTextNode(line)),
                    );
            });
    }, [editor, value]);
    useEffect(
        () =>
            editor.registerUpdateListener(
                ({ editorState, dirtyElements, dirtyLeaves }) => {
                    if (!dirtyElements.size && !dirtyLeaves.size) return;
                    const next = JSON.stringify(editorState.toJSON());
                    if (next === lastValue.current) return;
                    lastValue.current = next;
                    change.current(next);
                },
            ),
        [editor],
    );
    return null;
}

export default function RichTextEditor({
    id,
    value,
    onChange,
    disabled = false,
}) {
    return (
        <div className="rich-text-editor">
            <LexicalExtensionComposer
                extension={extension}
                contentEditable={null}
            >
                <EditorToolbar disabled={disabled} />
                <ContentEditable
                    id={id}
                    className="rich-text-content rich-text-editable"
                    aria-label="Descripción del producto"
                    aria-multiline="true"
                    spellCheck
                />
                <EditorStateSync
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                />
            </LexicalExtensionComposer>
        </div>
    );
}
