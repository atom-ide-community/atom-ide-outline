import { CompositeDisposable, TextEditor } from "atom"
import type { Disposable } from "atom"
import { OutlineView } from "./outlineView"
import type { OutlineProvider } from "atom-ide-base"
import { ProviderRegistry } from "atom-ide-base/commons-atom/ProviderRegistry"
import { notifyError, largeness as editorLargeness } from "atom-ide-base/commons-atom"
import { isItemVisible } from "atom-ide-base/commons-ui/items"

export { statuses } from "./statuses" // for spec
import { statuses } from "./statuses"
import debounce from "lodash/debounce"

const subscriptions = new CompositeDisposable()

let view: OutlineView | undefined
export const outlineProviderRegistry = new ProviderRegistry<OutlineProvider>()

// let busySignalProvider: BusySignalProvider | undefined // service might be consumed late

export function activate() {
  addCommands()
  addObservers()
  if (atom.config.get("atom-ide-outline.initialDisplay") as boolean) {
    // initially show outline pane
    toggleOutlineView().catch((e: Error) => {
      notifyError(e)
    })
  }
}

function addCommands() {
  subscriptions.add(
    /* outlineToggle */ atom.commands.add("atom-workspace", "outline:toggle", toggleOutlineView),
    /* revealCursor */ atom.commands.add("atom-workspace", "outline:reveal-cursor", revealCursor)
  )
}

function addObservers() {
  // if the active text editor changed (switched to another editor), then call editorChanged function
  subscriptions.add(atom.workspace.onDidChangeActiveTextEditor(editorChanged))
}

export function deactivate() {
  onEditorChangedDisposable?.dispose()
  subscriptions.dispose()
  view?.destroy()
  view = undefined
}

// export function consumeSignal(registry: BusySignalRegistry) {
//   busySignalProvider = registry.create()
//   subscriptions.add(busySignalProvider)
// }

export function consumeOutlineProvider(provider: OutlineProvider): Disposable {
  const prividerDisposable = outlineProviderRegistry.addProvider(provider)
  subscriptions.add(/*  providerRegistryEntry */ prividerDisposable)

  // NOTE Generate (try) an outline after obtaining a provider for the current active editor
  // this initial outline is always rendered no matter if it is visible or not,
  // this is because we can't track if the outline tab becomes visible suddenly later,
  // or if the editor changes later once outline is visible
  // so we need to have an outline for the current editor
  // the following updates rely on the visibility
  getOutline()
  return prividerDisposable
}

// disposables returned inside onEditorChangedDisposable
let onEditorChangedDisposable: CompositeDisposable | undefined = undefined

async function editorChanged(editor?: TextEditor) {
  if (editor === undefined) {
    return
  }
  // dispose the old subscriptions
  onEditorChangedDisposable?.dispose()
  onEditorChangedDisposable = new CompositeDisposable() // we can't reuse the CompositeDisposable!

  // NOTE initial outline is always rendered no matter if it is visible or not,
  // this is because we can't track if the outline tab becomes visible suddenly,
  // so we always need to show the outline for the correct file
  // the following updates rely on the visibility
  await getOutline(editor)

  const largeness = editorLargeness(editor as TextEditor)
  // How long to wait for the new changes before updating the outline.
  // A high number will increase the responsiveness of the text editor in large files.
  const updateDebounceTime = Math.max(largeness / 4, 300) // 1/4 of the line count

  const doubouncedGetOutline = debounce(
    getOutlintIfVisible as (textEditor: TextEditor) => Promise<void>,
    updateDebounceTime
  )

  onEditorChangedDisposable.add(
    // update the outline if editor stops changing
    editor.onDidStopChanging(async () => {
      await doubouncedGetOutline(editor)
    }),

    // clean up if the editor editor is closed
    editor.onDidDestroy(() => {
      setStatus("noEditor")
    })
  )
}

export function revealCursor() {
  const editor = atom.workspace.getActiveTextEditor()
  if (editor === undefined) {
    return
  }

  // following cursor disposable
  if (view !== undefined) {
    view.selectAtCursorLine(editor)
  }
}

export async function toggleOutlineView() {
  if (view === undefined) {
    view = new OutlineView() // create outline pane
  }
  const outlinePane = atom.workspace.paneForItem(view)
  if (outlinePane) {
    await outlinePane.destroyItem(view)
    return
  }

  const rightDock = atom.workspace.getRightDock()
  const [pane] = rightDock.getPanes()

  pane.addItem(view)
  pane.activateItem(view)

  rightDock.show()

  // Trigger an editor change whenever an outline is toggeled.
  try {
    await editorChanged(atom.workspace.getActiveTextEditor())
  } catch (e) {
    notifyError(e as Error)
  }
}

function getOutlintIfVisible(editor = atom.workspace.getActiveTextEditor()) {
  // if outline is not visible return
  if (!isItemVisible(view)) {
    return
  }
  return getOutline(editor)
}

export async function getOutline(editor = atom.workspace.getActiveTextEditor()) {
  if (view === undefined) {
    view = new OutlineView() // create outline pane
  } else {
    view.reset()
  }
  // editor
  if (editor === undefined) {
    return setStatus("noEditor")
  }

  // provider
  const provider = outlineProviderRegistry.getProviderForEditor(editor)

  if (!provider) {
    return setStatus("noProvider")
  }

  // const busySignalID = `Outline: ${editor.getPath()}`
  // busySignalProvider?.add(busySignalID)

  const outline = await provider.getOutline(editor)
  view.setOutline(outline?.outlineTrees ?? [], editor, Boolean(editorLargeness(editor as TextEditor)))

  // busySignalProvider?.remove(busySignalID)
}

export function setStatus(id: "noEditor" | "noProvider" | "noResult") {
  view?.presentStatus(statuses[id])
}

export { default as config } from "./config.json"
