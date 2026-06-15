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
import { Flex } from './tools/tunes/flex';
import ColorPicker from 'editorjs-color-picker';
import WeightPicker from './tools/inline-tools/weights';
import FontFamilyPicker from './tools/inline-tools/fontfamily';
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

    const inlineTools = ['link', 'ColorPicker', 'WeightPicker', 'FontFamilyPicker', 'underline', 'italic'];

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
                colors: [
                    '#2e3c74',
                    '#0055cc',
                    '#1f6a83',
                    '#206e4e',
                    '#e56910',
                    '#ae2e24',
                    '#5e4db2',
                    '#758195',
                    '#1e7afd',
                    '#2998bd',
                    '#23a06b',
                    '#fea363',
                    '#c9372c',
                    '#8270db',
                ]
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
            tunes: ['spacing'],
        },
        flex: {
            class: Flex,
        },
        htmlblock: {
            class: HTMLBlock,
            tunes: ['spacing'],
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