import BaseAttachesTool from '@editorjs/attaches';
import BaseImageTool from '@editorjs/image';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
// CORE-CHANGE end
import { useBus } from './bus';
// CORE-CHANGE start
import { unexpectedError } from './error';

const OPEN_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';
const DIMENSIONS_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/></svg>';
const LINK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
const FIT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>';

/**
 * This file is a modified version of the attaches and image tool from editorjs to work with the Directus file manager.
 *
 * We include an uploader to directly use Directus file manager, along with a modified version of the attaches and image tools.
 */

interface Tune {
    name?: string;
    title: string;
    icon: string;
    onActivate?: () => void;
    toggle: boolean;
}

class Uploader {
    getCurrentFile: any;
    config: any;
    onUpload: any;
    onError: any;
    constructor({
        config,
        getCurrentFile,
        onUpload,
        onError,
    }: {
        config: any;
        getCurrentFile?: any;
        onUpload: any;
        onError: any;
    }) {
        this.getCurrentFile = getCurrentFile;
        this.config = config;
        this.onUpload = onUpload;
        this.onError = onError;
    }

    async uploadByFile(file: any, { onPreview }: any) {
        try {
            await Promise.all([
                this.uploadSelectedFile({ onPreview }),
                onPreview(),
            ]);

            if (!this.config.uploader.getUploadFieldElement)
                return;

            this.config.uploader.getUploadFieldElement().onBrowseSelect({
                target: {
                    files: [file],
                },
            });
        }
        catch (error) {
            unexpectedError(error);
        }
    }

    uploadByUrl(url: string) {
        this.onUpload({
            success: 1,
            file: {
                url,
            },
        });
    }

    uploadSelectedFile({ onPreview }: { onPreview: any }) {
        if (this.getCurrentFile) {
            const currentPreview = this.getCurrentFile();

            if (currentPreview) {
                const separator = currentPreview.includes('?') ? '&' : '?';

                this.config.uploader.setCurrentPreview(
                    `${currentPreview}${separator}key=system-large-contain`,
                );
            }
        }

        this.config.uploader.setFileHandler(
            (file: {
                width: any;
                height: any;
                filesize: any;
                filename_download: string;
                title: any;
                id: string;
                focal_point_x?: any;
                focal_point_y?: any;
                image_credits?: any;
            }) => {
                if (!file) {
                    this.onError({
                        success: 0,
                        message: this.config.t.no_file_selected,
                    });

                    return;
                }

                const response = {
                    success: 1,
                    file: {
                        width: file.width,
                        height: file.height,
                        size: file.filesize,
                        name: file.filename_download,
                        title: file.title,
                        extension: file.filename_download.split('.').pop(),
                        fileId: file.id,
                        // Native Directus focal point (from directus_files).
                        focal_point_x: file.focal_point_x ?? null,
                        focal_point_y: file.focal_point_y ?? null,
                        // Custom directus_files field.
                        image_credits: file.image_credits ?? null,
                        fileURL:
                            `${this.config.uploader.baseURL}files/${file.id}`,
                        url: `${this.config.uploader.baseURL}assets/${file.id}`,
                    },
                };

                onPreview(response.file.fileURL);
                this.onUpload(response);
            },
        );
    }
}

export class AttachesTool extends BaseAttachesTool {
    constructor(params: {
        config: { uploader: any };
        block: { save: () => Promise<any> };
        api: { blocks: { update: (arg0: any, arg1: any) => void } };
    }) {
        super(params);

        this.config.uploader = params.config.uploader;

        this.uploader = new Uploader({
            config: this.config,
            onUpload: (response: any) => this.onUpload(response),
            onError: (error: any) => this.uploadingFailed(error),
        });

        this.onUpload = (response: any) => {
            super.onUpload(response);

            params.block.save().then((state) => {
                params.api.blocks.update(state.id, state.data);
            });
        };
    }

    showFileData() {
        super.showFileData();

        if (this.data.file && this.data.file.url) {
            const downloadButton = this.nodes.wrapper.querySelector(
                'a.cdx-attaches__download-button',
            );

            if (downloadButton) {
                const separator = this.data.file.url.includes('?') ? '&' : '?';
                downloadButton.href = `${this.data.file.url}${separator}download`;
            }
        }
    }
}

export class ImageTool extends BaseImageTool {
    constructor(params: any) {
        super(params);        
        this.uploader = new Uploader({
            config: this.config,
            getCurrentFile: () => this.data?.file?.url,
            onUpload: (response: any) => this.onUpload(response),
            onError: (error: any) => this.uploadingFailed(error),
        });        
    }

    // eslint-disable-next-line accessor-sets
    set image(file: { url?: any }) {
        console.log("Setting image with file", file);
        this._data.file = file || {};

        if (file && file.url) {
            const separator = file.url.includes('?') ? '&' : '?';
            const imageUrl = `${file.url}${separator}key=system-large-contain`;
            console.log("imageUrl", imageUrl);
            this.ui.fillImage(imageUrl);
        }
    }

    render() {
        const wrapper = super.render();

        // The base tool only paints the raw image; our custom tune metadata
        // (maxWidth/maxHeight/link) saved on data.file is never re-applied on
        // load. Re-apply it once editor.js has mounted the block content into
        // block.holder (which happens after render() returns).
        requestAnimationFrame(() => this.applyImageSettings());
        this.ensureFileMeta();

        return wrapper;
    }

    /**
     * Backfill directus_files metadata (native focal point focal_point_x/y and
     * the custom image_credits field) onto data.file for images saved before
     * those values were captured.
     */
    private async ensureFileMeta() {
        const file = (this as any).data.file || {};
        if (!file.fileId) return;
        // All values already captured (present even if null) → nothing to fetch.
        if ('focal_point_x' in file && 'focal_point_y' in file && 'image_credits' in file) return;

        const api = (this as any).config?.uploader?.api;
        if (!api) return;

        try {
            const res = await api.get(`/files/${file.fileId}`, {
                params: { fields: ['focal_point_x', 'focal_point_y', 'image_credits'] },
            });
            const record = res?.data?.data;
            if (!record) return;

            file.focal_point_x = record.focal_point_x ?? null;
            file.focal_point_y = record.focal_point_y ?? null;
            file.image_credits = record.image_credits ?? null;
            (this as any).data.file = file;
            (this as any).block?.dispatchChange?.();
        } catch (e) {
            // ignore — metadata stays unset
        }
    }

    renderSettings(): MenuConfig {
        const base = (super.renderSettings() as any) || [];
        const baseItems = Array.isArray(base) ? base : (base ? [base] : []);

        const openImage = {
            icon: OPEN_ICON,
            title: 'Open Image',
            onActivate: () => {
                const bus = useBus();
                bus.emit({ type: 'open-url', payload: (this as any).data.file?.fileURL });
            },
        };

        const dimensions = {
            icon: DIMENSIONS_ICON,
            title: 'Dimensions',
            children: { searchable: false, items: [{ type: 'html', element: this.dimensionsPanel() }] },
        };

        const link = {
            icon: LINK_ICON,
            title: 'Link',
            children: { searchable: false, items: [{ type: 'html', element: this.linkPanel() }] },
        };

        const objectFit = {
            icon: FIT_ICON,
            title: 'Object Fit',
            children: { searchable: false, items: this.objectFitItems() },
        };

        return [openImage, ...baseItems, dimensions, link, objectFit] as MenuConfig;
    }

    private setFileAttr(key: string, value: string) {
        const file = (this as any).data.file || {};
        file[key] = value;
        (this as any).data.file = file;
        this.applyImageSettings();
    }

    /** Dimensions inputs, grouped into Desktop and Mobile sections (nested popover). */
    private dimensionsPanel(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.classList.add('ce-image-dimensions');

        const sections: { label: string; fields: [string, string][] }[] = [
            {
                label: 'Desktop',
                fields: [['widthDesktop', 'Width'], ['heightDesktop', 'Height'], ['maxWidth', 'Max width'], ['maxHeight', 'Max height']],
            },
            {
                label: 'Mobile (≤ 640px)',
                fields: [['widthMobile', 'Width'], ['heightMobile', 'Height'], ['maxWidthMobile', 'Max width'], ['maxHeightMobile', 'Max height']],
            },
        ];

        for (const section of sections) {
            const heading = document.createElement('div');
            heading.classList.add('ce-image-dimensions__section');
            heading.textContent = section.label;
            wrap.appendChild(heading);

            for (const [key, label] of section.fields) {
                const field = document.createElement('label');
                field.classList.add('ce-image-dimensions__field');

                const span = document.createElement('span');
                span.classList.add('ce-image-dimensions__label');
                span.textContent = label;
                field.appendChild(span);

                const input = document.createElement('input');
                input.type = 'text';
                input.classList.add('ce-tune__input');
                input.placeholder = '200px / 50% / auto';
                input.value = (this as any).data.file?.[key] || '';
                input.addEventListener('keydown', (e) => e.stopPropagation());
                input.addEventListener('input', () => this.setFileAttr(key, input.value.trim()));
                input.addEventListener('change', () => (this as any).block?.dispatchChange?.());
                field.appendChild(input);

                wrap.appendChild(field);
            }
        }

        return wrap;
    }

    private linkPanel(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.classList.add('ce-image-dimensions');

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('ce-tune__input');
        input.placeholder = 'https://…';
        input.value = (this as any).data.file?.link || '';
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('input', () => this.setFileAttr('link', input.value.trim()));
        input.addEventListener('change', () => (this as any).block?.dispatchChange?.());
        wrap.appendChild(input);

        return wrap;
    }

    private objectFitItems(): any[] {
        const options = [
            { value: '', label: 'Default' },
            { value: 'fill', label: 'Fill' },
            { value: 'contain', label: 'Contain' },
            { value: 'cover', label: 'Cover' },
            { value: 'none', label: 'None' },
            { value: 'scale-down', label: 'Scale down' },
        ];
        const current = (this as any).data.file?.objectFit || '';
        return options.map((option) => ({
            title: option.label,
            isActive: current === option.value,
            closeOnActivate: true,
            onActivate: () => {
                this.setFileAttr('objectFit', option.value);
                (this as any).block?.dispatchChange?.();
            },
        }));
    }

    private applyImageSettings() {
        // Find the img element in the block and apply the max-width/max-height styles and optional link wrapper
        const blockHolder = (this as any).block?.holder as HTMLElement | null;
        console.log("blockHolder", blockHolder);
        if (!blockHolder) return;

        const imgElement = blockHolder.querySelector('img') as HTMLElement | null;
        console.log("imgElement", imgElement);
        if (!imgElement) return;

        const fileData = (this as any).data.file || {};

        if (fileData.maxWidth) {
            imgElement.style.maxWidth = fileData.maxWidth;
        } else {
            imgElement.style.maxWidth = '';
        }

        if (fileData.maxHeight) {
            imgElement.style.maxHeight = fileData.maxHeight;
        } else {
            imgElement.style.maxHeight = '';
        }

        imgElement.style.width = fileData.widthDesktop || '';
        imgElement.style.height = fileData.heightDesktop || '';

        if (fileData.objectFit) {
            imgElement.style.objectFit = fileData.objectFit;
        } else {
            imgElement.style.objectFit = '';
        }

        const linkUrl = fileData.link?.trim();
        const currentLink = imgElement.closest('a') as HTMLAnchorElement | null;

        if (linkUrl) {
            if (currentLink) {
                currentLink.href = linkUrl;
            } else {
                const anchor = document.createElement('a');
                anchor.href = linkUrl;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                imgElement.parentNode?.insertBefore(anchor, imgElement);
                anchor.appendChild(imgElement);
            }
        } else if (currentLink) {
            currentLink.parentNode?.insertBefore(imgElement, currentLink);
            currentLink.remove();
        }
    }
}