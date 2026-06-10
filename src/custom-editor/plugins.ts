import BaseAttachesTool from '@editorjs/attaches';
import BaseImageTool from '@editorjs/image';
// CORE-CHANGE end
import { useBus } from './bus';
// CORE-CHANGE start
import { unexpectedError } from './error';

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

        return wrapper;
    }

    renderSettings() {
        const tunes: Tune[] = [
            {
                icon: 'open_in_new',
                title: 'Open Image',
                toggle: false,
                onActivate: () => {
                    const bus = useBus();

                    bus.emit({
                        type: 'open-url',
                        payload: (this as any).data.file.fileURL,
                    });
                },
            },
            ...ImageTool.tunes,
        ];

        // Add custom max-width and max-height settings
        const maxWidthTune: Tune = {
            title: 'Max Width',
            icon: '↔',
            toggle: false,
            onActivate: () => {
                const currentFile = (this as any).data.file || {};
                const input = prompt('Enter max-width (e.g., 500px, 100%, auto):', currentFile.maxWidth || '');
                if (input !== null) {
                    currentFile.maxWidth = input.trim();
                    (this as any).data.file = currentFile;
                    this.applyImageSettings();
                }
            },
        };

        const maxHeightTune: Tune = {
            title: 'Max Height',
            icon: '↕',
            toggle: false,
            onActivate: () => {
                const currentFile = (this as any).data.file || {};
                const input = prompt('Enter max-height (e.g., 400px, 100%, auto):', currentFile.maxHeight || '');
                if (input !== null) {
                    currentFile.maxHeight = input.trim();
                    (this as any).data.file = currentFile;
                    this.applyImageSettings();
                }
            },
        };

        const linkTune: Tune = {
            title: 'Link Image',
            icon: '🔗',
            toggle: false,
            onActivate: () => {
                const currentFile = (this as any).data.file || {};
                const input = prompt('Enter link URL for this image:', currentFile.link || '');
                if (input !== null) {
                    currentFile.link = input.trim();
                    (this as any).data.file = currentFile;
                    this.applyImageSettings();
                }
            },
        };

        tunes.push(maxWidthTune, maxHeightTune, linkTune);

        const wrapperElement = document.createElement('div');
        wrapperElement.classList.add('ce-popover__items');

        for (const tune of tunes) {
            const tuneElement = document.createElement('div');
            tuneElement.classList.add('ce-popover-item');

            const iconElement = document.createElement('div');
            iconElement.classList.add('ce-popover-item__icon');
            const iElement = document.createElement('i');
            iElement.innerHTML = tune.icon;
            iconElement.append(iElement);
            tuneElement.append(iconElement);

            const titleElement = document.createElement('div');
            titleElement.classList.add('ce-popover-item__title');
            titleElement.innerHTML = tune.title;
            tuneElement.append(titleElement);

            if (tune.onActivate) {
                tuneElement.addEventListener('click', tune.onActivate);
            }
            else if (tune.toggle) {
                tuneElement.addEventListener('click', () => {
                    (this as any).tuneToggled(tune.name);
                    tuneElement.classList.toggle('ce-popover-item--active');
                });
            }

            wrapperElement.append(tuneElement);
        }

        return wrapperElement;
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