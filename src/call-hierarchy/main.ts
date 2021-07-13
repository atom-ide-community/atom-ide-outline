import { CompositeDisposable } from "atom"
import type { Disposable } from "atom"
import { ProviderRegistry } from "atom-ide-base/commons-atom/ProviderRegistry"
import type { CallHierarchyProvider } from "atom-ide-base"

import { CallHierarchyView } from "./call-hierarchy-view"

const callHierarchyProviderRegistry = new ProviderRegistry<CallHierarchyProvider>()
const subscriptions = new CompositeDisposable()
let item: CallHierarchyView

export function activate() {
  subscriptions.add(
    (item = new CallHierarchyView({
      providerRegistry: callHierarchyProviderRegistry,
    })),
    atom.commands.add("atom-workspace", "call-hierarchy:toggle", toggleCallHierarchy)
  )
  if (atom.config.get("atom-ide-outline.initialCallHierarchyDisplay")) {
    toggleCallHierarchy()
  }
}

export function deactivate() {
  subscriptions.dispose()
  atom.workspace.paneForItem(item)?.destroyItem(item)
}

export function consumeCallHierarchyProvider(provider: CallHierarchyProvider): Disposable {
  const providerDisposer = callHierarchyProviderRegistry.addProvider(provider)
  subscriptions.add(providerDisposer)
  item.showCallHierarchy()
  return providerDisposer
}

/** Show and hide the call-hierarchy tab */
export function toggleCallHierarchy() {
  let pane = atom.workspace.paneForItem(item)
  if (
    pane &&
    pane.getActiveItem() === item &&
    // @ts-ignore (getVisiblePanes is not includes typedef)
    atom.workspace.getVisiblePanes().includes(pane)
  ) {
    // destroy if item is visible
    pane.destroyItem(item)
    return
  }
  const rightDock = atom.workspace.getRightDock()
  if (!pane) {
    // add item if it does not exist
    pane = rightDock.getActivePane()
    pane.addItem(item)
  }
  item.activate()
  pane.activateItem(item)
  rightDock.show()
}

export const config = {
  initialCallHierarchyDisplay: {
    title: "Initial Call Hierarchy Display",
    description: "Show call hierarchy initially aftern atom loads",
    type: "boolean",
    default: true,
  },
}
