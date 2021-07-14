import { TextEditor } from "atom";
import { OutlineProvider } from "atom-ide-base";
import { ProviderRegistry } from "atom-ide-base/commons-atom/ProviderRegistry";
export { statuses } from "./statuses";
export { consumeCallHierarchyProvider } from "./call-hierarchy/main";
export declare const outlineProviderRegistry: ProviderRegistry<OutlineProvider>;
export declare function activate(): void;
export declare function deactivate(): void;
export declare function consumeOutlineProvider(provider: OutlineProvider): Promise<void>;
export declare function revealCursor(): void;
export declare function toggleOutlineView(): Promise<void>;
export declare function getOutline(editor?: TextEditor | undefined): Promise<void>;
export declare function setStatus(id: "noEditor" | "noProvider"): void;
export declare const config: {
    initialCallHierarchyDisplay: {
        title: string;
        description: string;
        type: string;
        default: boolean;
    };
    initialDisplay: {
        title: string;
        description: string;
        type: string;
        default: boolean;
    };
    sortEntries: {
        title: string;
        description: string;
        type: string;
        default: boolean;
    };
    foldInitially: {
        title: string;
        description: string;
        type: string;
        default: boolean;
    };
};
