import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    INDENT_CONTENT_COMMAND,
    OUTDENT_CONTENT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
} from "lexical";
import {
    INSERT_UNORDERED_LIST_COMMAND,
    INSERT_ORDERED_LIST_COMMAND,
    REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
    IconBold,
    IconItalic,
    IconUnderline,
    IconList,
    IconListNumbers,
    IconClearFormatting,
    IconIndentIncrease,
    IconIndentDecrease,
    IconAlignLeft,
    IconAlignCenter,
    IconAlignRight,
    IconAlignJustified,
    IconArrowBackUp,
    IconArrowForwardUp,
} from "@tabler/icons-react";

export default function EditorToolbar({ disabled }) {
    const [editor] = useLexicalComposerContext();
    const [formats, setFormats] = useState({});
    useEffect(
        () =>
            editor.registerUpdateListener(({ editorState }) =>
                editorState.read(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection))
                        setFormats({
                            bold: selection.hasFormat("bold"),
                            italic: selection.hasFormat("italic"),
                            underline: selection.hasFormat("underline"),
                        });
                }),
            ),
        [editor],
    );
    const buttons = [
        ["Negrita", IconBold, FORMAT_TEXT_COMMAND, "bold", formats.bold],
        ["Cursiva", IconItalic, FORMAT_TEXT_COMMAND, "italic", formats.italic],
        [
            "Subrayado",
            IconUnderline,
            FORMAT_TEXT_COMMAND,
            "underline",
            formats.underline,
        ],
        ["Lista con viñetas", IconList, INSERT_UNORDERED_LIST_COMMAND],
        ["Lista numerada", IconListNumbers, INSERT_ORDERED_LIST_COMMAND],
        /* ["Quitar lista", IconClearFormatting, REMOVE_LIST_COMMAND], */
        /* ["Aumentar sangría", IconIndentIncrease, INDENT_CONTENT_COMMAND],
        ["Reducir sangría", IconIndentDecrease, OUTDENT_CONTENT_COMMAND], */
        ["Alinear izquierda", IconAlignLeft, FORMAT_ELEMENT_COMMAND, "left"],
        ["Centrar texto", IconAlignCenter, FORMAT_ELEMENT_COMMAND, "center"],
        ["Alinear derecha", IconAlignRight, FORMAT_ELEMENT_COMMAND, "right"],
        /* [
            "Justificar texto",
            IconAlignJustified,
            FORMAT_ELEMENT_COMMAND,
            "justify",
        ], */
        /* ["Deshacer", IconArrowBackUp, UNDO_COMMAND],
        ["Rehacer", IconArrowForwardUp, REDO_COMMAND], */
    ];
    return (
        <div
            className="rich-text-toolbar"
            role="toolbar"
            aria-label="Formato de descripción"
        >
            {buttons.map(([label, Icon, command, payload, pressed]) => (
                <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    title={label}
                    aria-pressed={pressed}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.dispatchCommand(command, payload)}
                >
                    <Icon size={20} stroke={1.8} aria-hidden="true" />
                </button>
            ))}
        </div>
    );
}
