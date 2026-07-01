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
import { Style } from './tools/tunes/style';
import { AttachesTool, ImageTool } from './plugins';
import HTMLBlock from './tools/block-tools/html-block';
import FlexBlock from './tools/block-tools/flex-block';
import GridBlock from './tools/block-tools/grid-block';
import ButtonBlock from './tools/block-tools/button-block';
import ReferenceBlock from './tools/block-tools/reference-block';
import CollectionBlock from './tools/block-tools/collection-block';
import DelimiterBlock from './tools/block-tools/delimiter-block';
import ComponentBlock from './tools/block-tools/component-block';
import AccordionBlock from './tools/block-tools/accordion-block';
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
    api?: any;
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
            tunes: ['alignment', 'spacing', 'style'],
        },
        paragraph: {
            class: ParagraphTool,
            inlineToolbar: inlineTools,
            // Keep empty paragraphs (e.g. pressing Enter twice) on save.
            config: {
                preserveBlank: true,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        list: {
            class: NestedListTool,
            inlineToolbar: false,
            tunes: ['alignment', 'spacing', 'style'],
        },
        image: {
            class: ImageTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        attaches: {
            class: AttachesTool,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        alignment: {
            class: Alignment,
        },
        spacing: {
            class: Spacing,
        },
        style: {
            class: Style,
        },
        nestedlist: {
            class: NestedListTool,
            inlineToolbar: inlineTools,
            tunes: ['alignment', 'spacing', 'style'],
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
            tunes: ['flex', 'spacing', 'style'],
        },
        gridblock: {
            class: GridBlock,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['grid', 'spacing', 'style'],
        },
        flex: {
            class: Flex,
        },
        grid: {
            class: Grid,
        },
        htmlblock: {
            class: HTMLBlock,
            tunes: ['spacing', 'style'],
        },
        button: {
            class: ButtonBlock,
            // Inline tools for the button label, minus `link` (the button is
            // already an <a>; nesting anchors would be invalid).
            inlineToolbar: ['ColorPicker', 'WeightPicker', 'FontFamilyPicker', 'FontSizePicker', 'underline', 'italic'],
            config: {
                colors: EDITOR_COLORS,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        reference: {
            class: ReferenceBlock,
            config: {
                api: uploaderConfig.api,
                baseURL: uploaderConfig.baseURL,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        collectionblock: {
            class: CollectionBlock,
            config: {
                api: uploaderConfig.api,
                baseURL: uploaderConfig.baseURL,
            },
            tunes: ['alignment', 'spacing', 'style'],
        },
        delimiterblock: {
            class: DelimiterBlock,
            tunes: ['spacing'],
        },
        componentblock: {
            class: ComponentBlock,
            tunes: ['spacing', 'style'],
        },
        accordionblock: {
            class: AccordionBlock,
            config: {
                uploader: uploaderConfig,
            },
            tunes: ['spacing', 'style'],
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

    if (!tools.style && 'style' in defaults) {
        tools.style = defaults.style;
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