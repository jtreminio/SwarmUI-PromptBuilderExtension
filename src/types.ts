// Type definitions for SwarmUI API and global functions

interface GenericRequestCallback {
    (result: {
        success: boolean;
        data?: any;
        error?: string;
    }): void;
}

interface GenericRequestErrorCallback {
    (error: Error): void;
}

// Declare global functions from SwarmUI
declare function genericRequest(
    endpoint: string,
    params: Record<string, any>,
    callback: GenericRequestCallback,
    depth: number,
    errorCallback: GenericRequestErrorCallback
): void;

declare function registerNewTool(id: string, name: string): HTMLElement;

declare function doPopover(id: string, event?: MouseEvent): void;

declare class AdvancedPopover {
    constructor(
        id: string,
        actions: Array<{ key: string; action: () => void }>,
        arg3: boolean,
        x: number,
        y: number,
        parent: HTMLElement,
        arg7: any
    );
}

interface Window {
    genericRequest?: typeof genericRequest;
    AdvancedPopover?: typeof AdvancedPopover;
    mouseX?: number;
    mouseY?: number;
    promptBuilderState?: PromptBuilderState;
    promptBuilderPopupInit?: (state: PromptBuilderState) => void;
}

declare const sessionReadyCallbacks: Array<() => void>;
declare const promptTabComplete: {
    registerPrefix(
        prefix: string,
        description: string,
        callback: (prefix: string) => string[],
        isHidden: boolean
    ): void;
};

// Data structures
interface ParsedItem {
    value: string;
    path: string[];
}

interface StructureNode {
    path: string[];
    hasChildren: boolean;
    children?: Record<string, StructureNode>;
}

interface ParsedGroupData {
    items: ParsedItem[];
    structure: Record<string, StructureNode> | null;
}

interface ParsedData {
    [groupName: string]: ParsedGroupData;
}

interface PathSelection {
    path: string[];
}

interface PromptBuilderState {
    selectedTags: string[];
    expandedGroups: string[];
    currentSelection: PathSelection | null;
}

interface PromptBuilderSettings {
    autoGenerate: boolean;
    autoGenerateThreshold: number;
    danbooruLinks: boolean;
    debugMode: boolean;
}

