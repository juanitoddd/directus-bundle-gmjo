import ChecklistTool from '@editorjs/checklist';
import CodeTool from '@editorjs/code';
import DelimiterTool from '@editorjs/delimiter';
import EmbedTool from '@editorjs/embed';
import HeaderTool from '@editorjs/header';
import InlineCodeTool from '@editorjs/inline-code';
import NestedListTool from '@editorjs/nested-list';
import ParagraphTool from '@editorjs/paragraph';
import QuoteTool from '@editorjs/quote';
import RawToolTool from '@editorjs/raw';
import TableTool from '@editorjs/table';
import UnderlineTool from '@editorjs/underline';
import ToggleBlock from 'editorjs-toggle-block';
import { Alignment } from './tools/tunes/alignment';
import { Spacing } from './tools/tunes/spacing';
import { AttachesTool, ImageTool } from './plugins';
import HTMLBlock from './tools/block-tools/html-block';
import FlexBlock from './tools/block-tools/flex-block';
import GridBlock from './tools/block-tools/grid-block';
import ButtonBlock from './tools/block-tools/button-block';
import { EDITOR_COLORS } from './tools/utils/colors';
import { Flex } from './tools/tunes/flex';
import { Grid } from './tools/tunes/grid';
import ColorPicker from 'editorjs-color-picker';
import WeightPicker from './tools/inline-tools/weights';
import FontFamilyPicker from './tools/inline-tools/fontfamily';
import FontSizePicker from './tools/inline-tools/fontsize';
// EXAMPLE (Part 3/4): add marker tool
// import Marker from "@editorjs/marker";

export interface UploaderConfig {
    baseURL: string | undefined;
    setFileHandler: (handler: any) => void;
    setCurrentPreview?: (url: string) => void;
    getUploadFieldElement: () => any;
    openFlexEditor?: (params: { data?: any; callback: (item: any) => void }) => void;
}

export default function getTools(
    uploaderConfig: UploaderConfig,
    selection: Array<string>,
    haveFilesAccess: boolean,
): Record<string, object> {
    const tools: Record<string, any> = {};
    const fileRequiresTools = new Set(['attaches', 'image']);

    const inlineTools = ['link', 'ColorPicker', 'WeightPicker', 'FontFamilyPicker', 'FontSizePicker', 'underline', 'italic'];

    const defaults: Record<string, any> = {
        header: {
            class: HeaderTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment', 'spacing'],
        },
        paragraph: {
            class: ParagraphTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment', 'spacing'],
        },
        list: {
            class: NestedListTool,
            inlineToolbar: false,
            tunes: ['alignment', 'spacing'],
        },
        image: {
            class: ImageTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment', 'spacing'],
        },
        attaches: {
            class: AttachesTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment', 'spacing'],
        },
        alignment: {
            class: Alignment,
        },
        spacing: {
            class: Spacing,
        },
        nestedlist: {
            class: NestedListTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment', 'spacing'],
        },
        delimiter: {
            class: DelimiterTool,
        },
        underline: {
            class: UnderlineTool,
        },
        /*
        code: {
            class: CodeTool,
        },        
        embed: {
            class: EmbedTool,
            inlineToolbar: true,
        },
        raw: {
            class: RawToolTool,
        },
        table: {
            class: TableTool,
            inlineToolbar: true,
        },
        quote: {
            class: QuoteTool,
            inlineToolbar: true,
            tunes: ['alignment', 'format'],
        },
        inlinecode: {
            class: InlineCodeTool,
        },                
        */
        /*
        checklist: {
            class: ChecklistTool,
            inlineToolbar: true,
        },                
        toggle: {
            class: ToggleBlock,
            inlineToolbar: true,
        },        
        /*
        format: {
            class: BlockFormat,
        },
        */
        ColorPicker: {
            class: ColorPicker,
            inlineToolbar: true,
            config: {
                colors: EDITOR_COLORS,
            }
        },
        WeightPicker: {
            class: WeightPicker,
            inlineToolbar: true,
        },        
        FontFamilyPicker: {
            class: FontFamilyPicker,
            inlineToolbar: true,
        },
        FontSizePicker: {
            class: FontSizePicker,
            inlineToolbar: true,
        },
        flexblock: {
            class: FlexBlock,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['flex', 'spacing'],
        },
        gridblock: {
            class: GridBlock,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['grid', 'spacing'],
        },
        flex: {
            class: Flex,
        },
        grid: {
            class: Grid,
        },
        htmlblock: {
            class: HTMLBlock,
            tunes: ['spacing'],
        },
        button: {
            class: ButtonBlock,
            // Inline tools for the button label, minus `link` (the button is
            // already an <a>; nesting anchors would be invalid).
            inlineToolbar: ['ColorPicker', 'WeightPicker', 'FontFamilyPicker', 'FontSizePicker', 'underline', 'italic'],
            config: {
                colors: EDITOR_COLORS,
            },
            tunes: ['alignment', 'spacing'],
        },
        // EXAMPLE (Part 4/4): add marker tool
        //     class: Marker,
        //     shortcut: "CMD+SHIFT+M",
        // },
    };

    for (const toolName of selection) {
        if (!haveFilesAccess && fileRequiresTools.has(toolName))
            continue;

        if (toolName in defaults) {
            tools[toolName] = defaults[toolName];
        }
    }

    // Ensure tune-only tools are declared so block tunes are available.
    if (!tools.alignment && 'alignment' in defaults) {
        tools.alignment = defaults.alignment;
    }

    if (!tools.spacing && 'spacing' in defaults) {
        tools.spacing = defaults.spacing;
    }

    if (!tools.format && 'format' in defaults) {
        tools.format = defaults.format;
    }

    if (!tools.flex && 'flex' in defaults) {
        tools.flex = defaults.flex;
    }

    if (!tools.grid && 'grid' in defaults) {
        tools.grid = defaults.grid;
    }

    // Add alignment and format to all tools that support them.
    if ('alignment' in tools && 'format' in tools) {
        if ('paragraph' in tools) {
            tools.paragraph.tunes = ['alignment', 'spacing', 'format'];
        }

        if ('header' in tools) {
            tools.header.tunes = ['alignment', 'spacing', 'format'];
        }

        if ('quote' in tools) {
            tools.quote.tunes = ['alignment', 'spacing', 'format'];
        }
    }

    // Add our custom block tunes to paragraph/header/quote if they're present
    const customTunes = [] as string[];
    if ('classWrapBlock' in tools) customTunes.push('classWrapBlock');    

    if (customTunes.length > 0) {
        if ('paragraph' in tools) {
            tools.paragraph.tunes = Array.from(new Set([...(tools.paragraph.tunes || []), ...customTunes]));
        }
        if ('header' in tools) {
            tools.header.tunes = Array.from(new Set([...(tools.header.tunes || []), ...customTunes]));
        }
        if ('quote' in tools) {
            tools.quote.tunes = Array.from(new Set([...(tools.quote.tunes || []), ...customTunes]));
        }
    }

    return tools;
}