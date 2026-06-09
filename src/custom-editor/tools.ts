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
import { Alignment } from './alignment';
import { AttachesTool, ImageTool } from './plugins';
import { BlockFormat } from './block-format';
import { FontWeightBlock, FontWeightInline } from './font-weight';
import { ClassWrapBlock, ClassWrapInline } from './class-wrap';
import HTMLBlock from './html-block';
import FlexBlock from './flex-block';
import ColorPicker from 'editorjs-color-picker';
import WeightPicker from './weights';
// EXAMPLE (Part 3/4): add marker tool
// import Marker from "@editorjs/marker";

export interface UploaderConfig {
    baseURL: string | undefined;
    setFileHandler: (handler: any) => void;
    setCurrentPreview?: (url: string) => void;
    getUploadFieldElement: () => any;
}

export default function getTools(
    uploaderConfig: UploaderConfig,
    selection: Array<string>,
    haveFilesAccess: boolean,
): Record<string, object> {
    const tools: Record<string, any> = {};
    const fileRequiresTools = new Set(['attaches', 'image']);

    const inlineTools = ['link', 'ColorPicker', 'WeightPicker', 'underline', 'italic'];

    const defaults: Record<string, any> = {
        header: {
            class: HeaderTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment'],
        },
        paragraph: {
            class: ParagraphTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment'],
        },
        list: {
            class: NestedListTool,
            inlineToolbar: false,
            tunes: ['alignment'],
        },
        image: {
            class: ImageTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment'],
        },
        attaches: {
            class: AttachesTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment'],
        },
        alignment: {
            class: Alignment,
        },
        nestedlist: {
            class: NestedListTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment'],
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
        },
        WeightPicker: {
            class: WeightPicker,
            inlineToolbar: true,
        },
        flexblock: {
            class: FlexBlock,
            config: {
                uploader: uploaderConfig,
            },
        },
        htmlblock: {
            class: HTMLBlock,
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

    if (!tools.format && 'format' in defaults) {
        tools.format = defaults.format;
    }

    // Add alignment and format to all tools that support them.
    if ('alignment' in tools && 'format' in tools) {
        if ('paragraph' in tools) {
            tools.paragraph.tunes = ['alignment', 'format'];
        }

        if ('header' in tools) {
            tools.header.tunes = ['alignment', 'format'];
        }

        if ('quote' in tools) {
            tools.quote.tunes = ['alignment', 'format'];
        }
    }

    // Add our custom block tunes to paragraph/header/quote if they're present
    const customTunes = [] as string[];
    if ('classWrapBlock' in tools) customTunes.push('classWrapBlock');
    if ('fontWeightBlock' in tools) customTunes.push('fontWeightBlock');

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