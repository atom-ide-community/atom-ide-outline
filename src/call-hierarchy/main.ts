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
    atom.commands.add("atom-workspace", "call-hierarchy:toggle", toggleCallHierarchyTab),
    atom.commands.add("atom-workspace", "call-hierarchy:show", showCallHierarchyTab)
  )
  if (atom.config.get("atom-ide-outline.initialCallHierarchyDisplay")) {
    toggleCallHierarchyTab()
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

/** Show the call-hierarchy tab */
function showCallHierarchyTab() {
  showOrHideCallHierarchyTab({shouldHide: false, shouldShow: true})
}

/** Show or hide the call-hierarchy tab */
function toggleCallHierarchyTab() {
  showOrHideCallHierarchyTab({shouldHide: true, shouldShow: true})
}

/** Show or hide the call-hierarchy tab with using option */
function showOrHideCallHierarchyTab({shouldHide, shouldShow}: {shouldHide: boolean, shouldShow: boolean}) {
  let pane = atom.workspace.paneForItem(item)
  if (shouldHide) {
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
  }
  if (shouldShow) {
    const rightDock = atom.workspace.getRightDock()
    if (!pane) {
      // add item if it does not exist
      pane = rightDock.getActivePane()
      pane.addItem(item)
    }
    item.activate()
    pane.activateItem(item)
    // What if it's not rightDock?
    // TODO: This is not necessary except for rightDock
    rightDock.show()
  }
}

export const config = {
  initialCallHierarchyDisplay: {
    title: "Initial Call Hierarchy Display",
    description: "Show call hierarchy initially aftern atom loads",
    type: "boolean",
    default: true,
  },
}
