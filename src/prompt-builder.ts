/// <reference path="types.ts" />
/// <reference path="generated-assets.ts" />

class PromptBuilderApp {
    private container: HTMLElement;
    private settings: PromptBuilderSettings;
    private data: ParsedData = {};
    private selectedTags: string[] = [];
    private currentSelection: PathSelection | null = null;
    private searchFilter: string = '';
    private draggedTagIndex: number | null = null;
    private isDragging: boolean = false;
    private expandedGroups: Set<string> = new Set();
    private editingTagIndex: number | null = null;
    private hoveredTagIndex: number | null = null;
    private keyboardListenerAttached: boolean = false;
    private DEFAULT_SETTINGS: PromptBuilderSettings = {
        autoGenerate: false,
        autoGenerateThreshold: 3,
        danbooruLinks: false,
        debugMode: false
    };

    constructor(container: HTMLElement) {
        this.container = container;
        this.settings = this.getSettings();
    }

    async init(): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                genericRequest('GetPromptBuilderData', {}, (result) => {
                    if (!result.success) {
                        reject(new Error(result.error || 'Failed to load data'));
                        return;
                    }

                    this.parseData(result.data);
                    resolve();
                }, 0, (error) => {
                    reject(error);
                });
            });

            this.render();
        } catch (error) {
            this.container.innerHTML = Templates.error
                .replaceAll('{{errorMessage}}', (error as Error).message);
            console.error(error);
        }
    }

    private getSettings(): PromptBuilderSettings {
        const stored = localStorage.getItem('promptBuilderSettings');
        if (stored) {
            try {
                return { ...this.DEFAULT_SETTINGS, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
        return { ...this.DEFAULT_SETTINGS };
    }

    private parseData(data: any): void {
        for (const [rootKey, rootValue] of Object.entries(data)) {
            this.data[rootKey] = {
                items: [],
                structure: null
            };

            if (Array.isArray(rootValue)) {
                rootValue.forEach((item: string) => {
                    this.data[rootKey].items.push({
                        value: item,
                        path: [rootKey]
                    });
                });
            } else if (typeof rootValue === 'object' && rootValue !== null) {
                this.data[rootKey].structure = this.buildStructure(rootValue, [rootKey]);
                this.extractItems(rootValue, this.data[rootKey].items, [rootKey]);
            }
        }
    }

    private buildStructure(obj: any, parentPath: string[] = []): Record<string, StructureNode> {
        const structure: Record<string, StructureNode> = {};

        for (const [key, value] of Object.entries(obj)) {
            if (key === '_data') {
                continue;
            }

            const currentPath = [...parentPath, key];

            if (Array.isArray(value)) {
                structure[key] = { path: currentPath, hasChildren: false };
            } else if (typeof value === 'object' && value !== null) {
                structure[key] = {
                    path: currentPath,
                    hasChildren: true,
                    children: this.buildStructure(value, currentPath)
                };
            }
        }

        return structure;
    }

    private extractItems(obj: any, items: ParsedItem[], currentPath: string[]): void {
        for (const [key, value] of Object.entries(obj)) {
            if (key === '_data' && Array.isArray(value)) {
                value.forEach((item: string) => {
                    items.push({ value: item, path: currentPath });
                });
            } else if (Array.isArray(value)) {
                const itemPath = [...currentPath, key];
                value.forEach((item: string) => {
                    items.push({ value: item, path: itemPath });
                });
            } else if (typeof value === 'object' && value !== null) {
                this.extractItems(value, items, [...currentPath, key]);
            }
        }
    }

    private render(): void {
        const isInPopup = window.opener !== null;
        const popoutButton = !isInPopup ? Templates.popoutButton : '';

        this.container.innerHTML = Templates.mainContainer
            .replace('{{searchFilter}}', this.escapeHtml(this.searchFilter))
            .replace('{{popoutButton}}', popoutButton);

        this.container.insertAdjacentHTML('beforeend', Templates.settingsModal);

        injectStyles();
        this.renderNavigation();
        this.renderSelectedTags();
        this.renderItems();
        this.initializeResize();
        this.attachSearchListener();
        this.attachKeyboardListener();

        if (!isInPopup) {
            this.attachSettingsListeners();
        } else {
            // Hide settings button in popup
            const settingsWrapper = document.querySelector('.pb-settings-gear-wrapper') as HTMLElement;
            if (settingsWrapper) {
                settingsWrapper.style.display = 'none';
            }
        }

        this.getButton('pb-copy-button').addEventListener('click', () => {
            this.copyTagsToClipboard();
        });

        this.getButton('pb-clear-button').addEventListener('click', () => {
            this.clearAllTags();
        });

        this.getButton('pb-retry-button').addEventListener('click', () => {
            this.triggerGeneration();
        });

        if (!isInPopup) {
            this.getButton('pb-popout-button').addEventListener('click', () => {
                this.popOutToWindow();
            });
        }
    }

    private attachKeyboardListener(): void {
        if (this.keyboardListenerAttached) {
            return;
        }

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Only respond if hovering over a tag and not currently editing
            if (this.hoveredTagIndex === null || this.editingTagIndex !== null) {
                return;
            }

            const target = e.target as HTMLElement;

            // Ignore if user is typing in an input field
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key.toLowerCase();

            if (key === 'e') {
                // Edit tag
                e.preventDefault();
                this.editingTagIndex = this.hoveredTagIndex;
                this.renderSelectedTags();
            } else if (key === 'd') {
                // Delete tag
                e.preventDefault();
                this.deleteTagAtIndex(this.hoveredTagIndex);
                this.hoveredTagIndex = null;
            }
        });

        this.keyboardListenerAttached = true;
    }

    private attachSettingsListeners(): void {
        const settingsButton = this.getButton('pb-settings-button');
        const popover = document.getElementById('popover_pb_settings');

        if (!settingsButton || !popover) {
            return;
        }

        // Open settings popover using SwarmUI's doPopover
        settingsButton.addEventListener('click', (e) => {
            // Use SwarmUI's built-in popover system if available
            if (typeof doPopover !== 'undefined') {
                doPopover('pb_settings', e);
            }
            this.populateSettingsPopover();
        });

        // Populate initial values
        this.populateSettingsPopover();

        // Auto-save when any setting changes
        const autoGenerateCheckbox = this.getInput('pb-setting-autogenerate');
        const thresholdInput = this.getInput('pb-setting-autogenerate-threshold');
        const danbooruCheckbox = this.getInput('pb-setting-danbooru-links');
        const debugCheckbox = this.getInput('pb-setting-debug-mode');

        autoGenerateCheckbox?.addEventListener('change', () => this.saveSettingsFromPopover());
        thresholdInput?.addEventListener('change', () => this.saveSettingsFromPopover());
        danbooruCheckbox?.addEventListener('change', () => this.saveSettingsFromPopover());
        debugCheckbox?.addEventListener('change', () => this.saveSettingsFromPopover());
    }

    private populateSettingsPopover(): void {
        const autoGenerateCheckbox = this.getInput('pb-setting-autogenerate');
        const thresholdInput = this.getInput('pb-setting-autogenerate-threshold');
        const danbooruCheckbox = this.getInput('pb-setting-danbooru-links');
        const debugCheckbox = this.getInput('pb-setting-debug-mode');

        if (autoGenerateCheckbox) {
            autoGenerateCheckbox.checked = this.settings.autoGenerate;
        }

        if (thresholdInput) {
            thresholdInput.value = String(this.settings.autoGenerateThreshold);
        }

        if (danbooruCheckbox) {
            danbooruCheckbox.checked = this.settings.danbooruLinks;
        }

        if (debugCheckbox) {
            debugCheckbox.checked = this.settings.debugMode;
        }
    }

    private saveSettingsFromPopover(): void {
        const autoGenerateCheckbox = this.getInput('pb-setting-autogenerate');
        const thresholdInput = this.getInput('pb-setting-autogenerate-threshold');
        const danbooruCheckbox = this.getInput('pb-setting-danbooru-links');
        const debugCheckbox = this.getInput('pb-setting-debug-mode');

        const previousDanbooruLinks = this.settings.danbooruLinks;

        this.settings = {
            autoGenerate: autoGenerateCheckbox?.checked ?? this.DEFAULT_SETTINGS.autoGenerate,
            autoGenerateThreshold: Number(thresholdInput?.value ?? this.DEFAULT_SETTINGS.autoGenerateThreshold),
            danbooruLinks: danbooruCheckbox?.checked ?? this.DEFAULT_SETTINGS.danbooruLinks,
            debugMode: debugCheckbox?.checked ?? this.DEFAULT_SETTINGS.debugMode,
        };

        localStorage.setItem('promptBuilderSettings', JSON.stringify(this.settings));
        if (previousDanbooruLinks !== this.settings.danbooruLinks) {
            this.renderItems();
        }

        this.log('Settings saved');
    }

    private attachSearchListener(): void {
        const searchInput = this.getInput('pb-nav-search-input');
        searchInput.addEventListener('input', (e: Event) => {
            this.searchFilter = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderItems();
        });
    }

    private initializeResize(): void {
        const resizeHandle = document.getElementById('pb-resize-handle');
        const navPanel = document.getElementById('pb-nav-panel') as HTMLElement;
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = navPanel.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isResizing) {
                return;
            }

            const delta = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(600, startWidth + delta));
            navPanel.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) {
                return;
            }

            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    }

    private renderNavigation(): void {
        const navPanel = document.getElementById('pb-nav-panel') as HTMLElement;
        const navList = document.getElementById('pb-nav-list') as HTMLUListElement;
        const searchBox = navPanel.querySelector('.pb-nav-search-box') as HTMLElement;
        const searchInput = searchBox.querySelector('.pb-nav-search-input') as HTMLInputElement;
        const previousScrollTop = navList.scrollTop;
        const shouldPreserveFocus = document.activeElement === searchInput;
        const cursorPosition = searchInput.selectionStart;
        let html = '';

        if (!this.data) {
            return;
        }

        for (const [groupName, groupData] of Object.entries(this.data)) {
            const groupPath = groupName;
            const isExpanded = this.expandedGroups.has(groupPath);
            const isActive = this.currentSelection &&
                this.currentSelection.path[0] === groupName &&
                this.currentSelection.path.length === 1;

            let subgroupsHtml = '';
            if (groupData.structure && isExpanded) {
                subgroupsHtml = this.renderSubgroups(groupData.structure, groupName, groupPath);
            }

            html += Templates.group
                .replaceAll('{{active}}', isActive ? 'active' : '')
                .replaceAll('{{groupName}}', groupName)
                .replaceAll('{{groupPath}}', groupPath)
                .replaceAll('{{subgroups}}', subgroupsHtml);
        }

        navList.innerHTML = html;
        const newSearchInput = searchBox.querySelector('.pb-nav-search-input') as HTMLInputElement;

        if (this.currentSelection) {
            const breadcrumb = this.currentSelection.path.join(' > ');
            newSearchInput.placeholder = `Search in ${breadcrumb}...`;
        } else {
            newSearchInput.placeholder = 'Select a category first...';
        }

        if (shouldPreserveFocus) {
            newSearchInput.focus({ preventScroll: true });
            newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
        }

        navList.scrollTop = previousScrollTop;
        requestAnimationFrame(() => {
            navList!.scrollTop = previousScrollTop;
        });

        // Attach click listeners for expansion/collapse and selection
        navPanel.querySelectorAll('[data-group-path]').forEach(el => {
            el.addEventListener('click', (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                const element = el as HTMLElement;
                const groupPath = element.dataset.groupPath!;
                const parentPath = element.dataset.parentPath!;
                const path = element.dataset.path!.split('>');

                // Not expanded - expand it and collapse siblings
                if (!this.expandedGroups.has(groupPath)) {
                    const siblings = Array.from(this.expandedGroups).filter(p => {
                        // If same parent, it's a sibling
                        if (parentPath === '') {
                            // Root level - siblings are other root groups
                            return !p.includes('>');
                        } else {
                            // Sub level - siblings start with same parent
                            return p.startsWith(parentPath + '>') &&
                                p.split('>').length === groupPath.split('>').length;
                        }
                    });

                    siblings.forEach(s => this.expandedGroups.delete(s));
                    this.expandedGroups.add(groupPath);
                }

                // If this node has only subgroups (no direct items), auto-select the first subgroup
                if (this.nodeHasChildren(path) && !this.nodeHasDirectItems(path)) {
                    const firstChild = this.getFirstChildPath(path);

                    if (firstChild) {
                        this.selectPath(firstChild);
                        return;
                    }
                }

                this.selectPath(path);
            });
        });

        navPanel.querySelectorAll('[data-path]:not([data-group-path])').forEach(el => {
            el.addEventListener('click', (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                const element = el as HTMLElement;
                const path = element.dataset.path!.split('>');
                this.selectPath(path);
            });
        });
    }

    private nodeHasChildren(path: string[]): boolean {
        if (!path || path.length === 0) {
            return false;
        }

        const root = this.data?.[path[0]];

        if (!root) {
            return false;
        }

        if (path.length === 1) {
            const structure = root.structure;
            return !!structure && Object.keys(structure).length > 0;
        }

        let node: StructureNode | undefined;
        let children = root.structure;

        for (let i = 1; i < path.length; i++) {
            if (!children) {
                return false;
            }

            node = children[path[i]];

            if (!node) {
                return false;
            }

            children = node.children;
        }

        return !!node?.hasChildren;
    }

    private nodeHasDirectItems(path: string[]): boolean {
        if (!path || path.length === 0) {
            return false;
        }

        const groupName = path[0];
        const groupData = this.data?.[groupName];

        if (!groupData) {
            return false;
        }

        for (const item of groupData.items) {
            if (item.path.length !== path.length) {
                continue;
            }

            let matches = true;

            for (let i = 0; i < path.length; i++) {
                if (item.path[i] !== path[i]) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                return true;
            }
        }

        return false;
    }

    private getFirstChildPath(path: string[]): string[] | null {
        const root = this.data?.[path[0]];

        if (!root) {
            return null;
        }

        let children = root.structure;

        if (path.length > 1) {
            for (let i = 1; i < path.length; i++) {
                if (!children) return null;
                const node = children[path[i]];
                if (!node) return null;
                children = node.children;
            }
        }
        if (!children) {
            return null;
        }

        const keys = Object.keys(children);

        if (keys.length === 0) {
            return null;
        }

        return [...path, keys[0]];
    }

    private renderSubgroups(
        structure: Record<string, StructureNode>,
        groupName: string,
        parentPath: string,
        depth: number = 0
    ): string {
        let html = '';
        const depthClass = depth === 0
            ? ''
            : depth === 1
                ? 'pb-nav-subgroup-nested'
                : 'pb-nav-subgroup-nested-2';

        for (const [subgroupName, subgroupData] of Object.entries(structure)) {
            const fullPath = subgroupData.path.join('>');
            const isExpanded = this.expandedGroups.has(fullPath);
            const isActive = this.currentSelection &&
                this.currentSelection.path.join('>') === fullPath;
            const hasChildren = subgroupData.hasChildren;

            html += Templates.subgroup
                .replaceAll('{{depthClass}}', depthClass)
                .replaceAll('{{active}}', isActive ? 'active' : '')
                .replaceAll('{{fullPath}}', fullPath)
                .replaceAll('{{parentPath}}', parentPath)
                .replaceAll('{{groupPath}}', hasChildren ? fullPath : '')
                .replaceAll('{{spacer}}', '')
                .replaceAll('{{subgroupName}}', subgroupName);

            if (subgroupData.hasChildren && isExpanded) {
                html += this.renderSubgroups(subgroupData.children!, groupName, fullPath, depth + 1);
            }
        }

        return html;
    }

    private selectPath(path: string[]): void {
        this.currentSelection = { path };
        this.searchFilter = '';
        this.renderNavigation();
        this.renderItems();
    }

    private renderItems(): void {
        const container = document.getElementById('pb-items-container').querySelector('.pb-items-grid');
        if (!this.currentSelection) {
            container.innerHTML = Templates.noSelection;
            return;
        }

        const items = this.getItemsForPath(this.currentSelection.path);
        const filtered = this.searchFilter
            ? items.filter(item => item.value.toLowerCase().includes(this.searchFilter))
            : items;

        let html = '';

        filtered.forEach(item => {
            let link = '';

            if (this.settings.danbooruLinks) {
                link = Templates.danbooruLink
                    .replaceAll('{{encodedTag}}', encodeURIComponent(item.value));
            }

            html += Templates.itemCard
                .replaceAll('{{value}}', this.escapeHtml(item.value))
                .replaceAll('{{selected}}', this.selectedTags.includes(item.value) ? 'selected' : '')
                .replaceAll('{{link}}', link);
        });

        container.innerHTML = html;

        container.querySelectorAll('.pb-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const value = (card as HTMLElement).dataset.value;
                this.toggleTag(value);
            });
        });
    }

    private getItemsForPath(path: string[]): ParsedItem[] {
        const groupName = path[0];
        const groupData = this.data?.[groupName];

        if (!groupData) {
            return [];
        };

        return groupData.items.filter(item => {
            if (item.path.length !== path.length) return false;

            for (let i = 0; i < path.length; i++) {
                if (item.path[i] !== path[i]) return false;
            }

            return true;
        });
    }

    private toggleTag(value: string): void {
        this.selectedTags.push(value);
        this.renderSelectedTags();
        this.renderItems();
        this.updatePBPromptField();

        if (this.settings.autoGenerate && this.selectedTags.length >= this.settings.autoGenerateThreshold) {
            this.triggerGeneration();
        }
    }

    private deleteTagAtIndex(index: number): void {
        this.selectedTags.splice(index, 1);
        this.renderSelectedTags();
        this.renderItems();
        this.updatePBPromptField();
    }

    private editTagAtIndex(index: number, newValue: string): void {
        this.selectedTags[index] = newValue;
        this.renderSelectedTags();
        this.renderItems();
        this.updatePBPromptField();
    }

    // Find or create the hidden input field for pbprompt in the main window
    private updatePBPromptField(): void {
        const targetDocument = this.getWindow().document;
        let pbPromptInput = this.getInput('input_pbprompt');

        if (!pbPromptInput) {
            const newInput = targetDocument.createElement('input');
            newInput.type = 'text';
            newInput.id = 'input_pbprompt';
            newInput.style.display = 'none';
            targetDocument.body.appendChild(newInput);
            pbPromptInput = newInput;
        }

        // Set the value to comma-separated tags with escaped parentheses
        const tagsString = this.selectedTags
            .map(tag => tag.replace(/\(/g, '\\(').replace(/\)/g, '\\)'))
            .join(', ');

        pbPromptInput.value = tagsString;
        pbPromptInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.log(`Updated input_pbprompt to: ${tagsString}`);

        // Sync state back to the parent window if we're in a popup
        if (window.opener) {
            try {
                window.opener.postMessage({
                    type: 'PB_SYNC_STATE',
                    payload: {
                        selectedTags: [...this.selectedTags],
                        expandedGroups: Array.from(this.expandedGroups),
                        currentSelection: this.currentSelection
                    }
                }, '*');
            } catch (e) {
                console.error('PromptBuilder: Failed to postMessage to parent', e);
            }
        }
    }

    private renderSelectedTags(): void {
        const container = document.getElementById('pb-selected-tags')!;

        if (this.selectedTags.length === 0) {
            container.innerHTML = Templates.noTagsSelected;
            return;
        }

        container.innerHTML = this.selectedTags.map((tag, index) => {
            if (this.editingTagIndex === index) {
                return Templates.tagChipEditing
                    .replaceAll('{{index}}', String(index))
                    .replaceAll('{{tag}}', this.escapeHtml(tag));
            }

            return Templates.tagChip
                .replaceAll('{{index}}', String(index))
                .replaceAll('{{tag}}', this.escapeHtml(tag));
        }).join('');

        // Handle editing inputs
        container.querySelectorAll('.pb-tag-chip-input').forEach(input => {
            const inputElement = input as HTMLInputElement;
            const index = parseInt(inputElement.dataset.index!);
            setTimeout(() => inputElement.focus(), 0);

            inputElement.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newValue = inputElement.value.trim();
                    if (newValue) {
                        this.editTagAtIndex(index, newValue);
                    }
                    this.editingTagIndex = null;
                    this.renderSelectedTags();
                }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.editingTagIndex = null;
                    this.renderSelectedTags();
                }
            });

            inputElement.addEventListener('blur', () => {
                setTimeout(() => {
                    const newValue = inputElement.value.trim();
                    if (newValue && this.editingTagIndex === index) {
                        this.editTagAtIndex(index, newValue);
                    }
                    this.editingTagIndex = null;
                    this.renderSelectedTags();
                }, 100);
            });
        });

        // Attach drag and right-click event listeners to normal chips
        container.querySelectorAll('.pb-tag-chip:not(.pb-tag-chip-editing)').forEach((chip, index) => {
            const chipElement = chip as HTMLElement;

            chipElement.addEventListener('mouseenter', () => {
                this.hoveredTagIndex = index;
            });

            chipElement.addEventListener('mouseleave', () => {
                this.hoveredTagIndex = null;
            });

            chipElement.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

                const targetWindow = this.getWindow();
                let contextX = e.clientX;
                let contextY = e.clientY;

                if (typeof targetWindow.mouseX !== 'undefined') {
                    contextX = targetWindow.mouseX;
                    contextY = targetWindow.mouseY;
                }

                const PopoverClass = AdvancedPopover ?? targetWindow.AdvancedPopover ?? window.AdvancedPopover;
                if (!PopoverClass) {
                    console.error('PromptBuilder: Could not find AdvancedPopover');
                    return false;
                }

                const popoverActions = [
                    {
                        key: 'Edit',
                        action: () => {
                            this.editingTagIndex = index;
                            this.renderSelectedTags();
                        }
                    },
                    {
                        key: 'Delete',
                        action: () => {
                            this.deleteTagAtIndex(index);
                        }
                    }
                ];

                return new PopoverClass(
                    'tag_context_menu',
                    popoverActions,
                    false,
                    contextX,
                    contextY,
                    document.body,
                    null,
                );
            });

            chipElement.addEventListener('mousedown', (e: MouseEvent) => {
                if (e.button === 2) {
                    return;
                };

                this.isDragging = false;
            });

            chipElement.addEventListener('click', (e: MouseEvent) => {
                if (e.button === 2) {
                    return;
                };

                if (!this.isDragging) {
                    this.deleteTagAtIndex(index);
                }
            });

            chipElement.addEventListener('dragstart', (e: DragEvent) => {
                this.isDragging = true;
                this.draggedTagIndex = index;
                chipElement.classList.add('dragging');
                e.dataTransfer!.effectAllowed = 'move';
            });

            chipElement.addEventListener('dragend', () => {
                chipElement.classList.remove('dragging');
                this.draggedTagIndex = null;
                container.querySelectorAll('.pb-tag-chip').forEach(c => {
                    c.classList.remove('drag-over-left', 'drag-over-right');
                });
                setTimeout(() => {
                    this.isDragging = false;
                }, 100);
            });

            chipElement.addEventListener('dragover', (e: DragEvent) => {
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'move';

                if (this.draggedTagIndex !== null && this.draggedTagIndex !== index) {
                    // Determine if mouse is on left or right half of the chip
                    const rect = chipElement.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    const isLeftSide = e.clientX < midpoint;
                    chipElement.classList.remove('drag-over-left', 'drag-over-right');

                    if (isLeftSide) {
                        chipElement.classList.add('drag-over-left');
                    } else {
                        chipElement.classList.add('drag-over-right');
                    }
                }
            });

            chipElement.addEventListener('dragleave', () => {
                chipElement.classList.remove('drag-over-left', 'drag-over-right');
            });

            chipElement.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();

                if (this.draggedTagIndex !== null && this.draggedTagIndex !== index) {
                    // Determine if drop was on left or right side
                    const rect = chipElement.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    const isLeftSide = e.clientX < midpoint;
                    const draggedTag = this.selectedTags[this.draggedTagIndex];
                    this.selectedTags.splice(this.draggedTagIndex, 1);
                    let newIndex = index;

                    if (this.draggedTagIndex < index) {
                        newIndex--;
                    }

                    if (isLeftSide) {
                        this.selectedTags.splice(newIndex, 0, draggedTag);
                    } else {
                        this.selectedTags.splice(newIndex + 1, 0, draggedTag);
                    }

                    this.renderSelectedTags();
                }

                chipElement.classList.remove('drag-over-left', 'drag-over-right');
            });
        });
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private async copyTagsToClipboard(): Promise<void> {
        if (this.selectedTags.length === 0) {
            return;
        }

        try {
            await navigator.clipboard.writeText(this.selectedTags.join(', '));
            const button = this.getButton('pb-copy-button');
            const originalText = button.innerHTML;
            button.innerHTML = '✓';
            button.disabled = true;

            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    private clearAllTags(): void {
        this.selectedTags = [];
        this.renderSelectedTags();
        this.renderItems();
        this.updatePBPromptField();

        this.log('Cleared all tags');
    }

    private triggerGeneration(): void {
        if (this.selectedTags.length === 0) {
            return;
        }

        const generateButton = this.getButton('alt_generate_button');

        if (generateButton) {
            const tagsString = this.selectedTags.join(', ');
            this.log(`Triggering generation with tags: ${tagsString}`);
            generateButton.click();
        } else {
            console.error('PromptBuilder: Could not find generate button');
        }
    }

    private popOutToWindow(): void {
        const currentState: PromptBuilderState = {
            selectedTags: [...this.selectedTags],
            expandedGroups: Array.from(this.expandedGroups),
            currentSelection: this.currentSelection ? { ...this.currentSelection } : null
        };

        const popupWindow = window.open(
            '',
            'PromptBuilder',
            'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no',
        );

        if (!popupWindow) {
            alert('Please allow popups for this site to use the pop-out feature');
            return;
        }

        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(link => link.outerHTML)
            .join('\n');

        const popupHtml = Templates.popupWindow
            .replace('{{timestamp}}', String(Date.now()))
            .replace('{{stylesheets}}', stylesheets)
            .replace('{{state}}', JSON.stringify(currentState));

        popupWindow.document.write(popupHtml);
        popupWindow.document.close();

        this.log('Opened in popup window');
    }

    private getWindow(): Window {
        return window.opener || window;
    }

    private getButton(buttonId: string): HTMLButtonElement {
        return this.getWindow().document.getElementById(buttonId) as HTMLButtonElement;
    }

    private getInput(inputId: string): HTMLInputElement {
        return this.getWindow().document.getElementById(inputId) as HTMLInputElement;
    }

    private log(message: string): void {
        if (this.settings.debugMode) {
            console.log('PromptBuilder:', message);
        }
    }
}

class PromptBuilderTool {
    private app: PromptBuilderApp | null = null;
    private mainDiv: HTMLElement | null = null;

    register(): void {
        this.mainDiv = registerNewTool('prompt_builder', 'Prompt Builder');
        this.mainDiv.addEventListener('tool-opened', () => {
            if (!this.app) {
                this.app = new PromptBuilderApp(this.mainDiv);
                (window as any)['promptBuilderApp'] = this.app;
                this.app.init();
            }
        });
    }
}

// Check if we're in a popup window and need to initialize
if (window.opener !== null) {
    // We're in a popup window - set up the popup initialization function
    window.promptBuilderPopupInit = function (savedState: PromptBuilderState) {
        const container = document.getElementById('pb-popup-app')!;
        const app = new PromptBuilderApp(container);

        if (savedState) {
            app['selectedTags'] = savedState.selectedTags || [];
            app['expandedGroups'] = new Set(savedState.expandedGroups || []);
            app['currentSelection'] = savedState.currentSelection || null;
        }

        (window as any)['promptBuilderApp'] = app;
        app.init();
        console.log('PromptBuilder: Initialized in popup window');
    };
} else if (typeof sessionReadyCallbacks !== 'undefined') {
    // We're in the main SwarmUI context - register as a tool
    sessionReadyCallbacks.push(() => {
        new PromptBuilderTool().register();
    });

    // Register the tab completion
    if (typeof promptTabComplete !== 'undefined') {
        promptTabComplete.registerPrefix('pbprompt', 'Placeholder for the prompt builder', (_prefix) => {
            return [];
        }, true);
    }

    // Listen for popup state sync messages
    window.addEventListener('message', (event: MessageEvent) => {
        const data: any = (event && (event as any).data) || null;
        if (!data || data.type !== 'PB_SYNC_STATE') {
            return;
        }

        const app: any = (window as any)['promptBuilderApp'];
        if (!app) {
            return;
        }

        const payload = data.payload || {};
        app['selectedTags'] = Array.isArray(payload.selectedTags) ? [...payload.selectedTags] : [];
        app['expandedGroups'] = new Set(payload.expandedGroups || []);
        app['currentSelection'] = payload.currentSelection || null;

        // Re-render UI and update hidden field
        app['renderSelectedTags']();
        app['renderItems']();
        app['updatePBPromptField']();
    });
}


