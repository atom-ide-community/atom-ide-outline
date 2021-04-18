import { CompositeDisposable, TextEditor } from "atom"
import { OutlineView } from "./outlineView"
import { OutlineProvider } from "atom-ide-base"
import { ProviderRegistry } from "atom-ide-base/commons-atom/ProviderRegistry"
import { notifyError, largeness as editorLargeness } from "atom-ide-base/commons-atom"
import { isItemVisible } from "atom-ide-base/commons-ui"

export { statuses } from "./statuses" // for spec
import debounce from "lodash/debounce"

const subscriptions = new CompositeDisposable()

let view: OutlineView | undefined
export const outlineProviderRegistry = new ProviderRegistry<OutlineProvider>()

// export let busySignalProvider: BusySignalProvider | undefined // service might be consumed late

export function activate() {
  addCommands()
  addObservers()
  if (atom.config.get("atom-ide-outline.initialDisplay")) {
    // initially show outline pane
    try {
      toggleOutlineView()
    } catch (e) {
      notifyError(e)
    }
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

export async function consumeOutlineProvider(provider: OutlineProvider) {
  subscriptions.add(/*  providerRegistryEntry */ outlineProviderRegistry.addProvider(provider))

  // NOTE Generate (try) an outline after obtaining a provider for the current active editor
  // this initial outline is always rendered no matter if it is visible or not,
  // this is because we can't track if the outline tab becomes visible suddenly later,
  // or if the editor changes later once outline is visible
  // so we need to have an outline for the current editor
  // the following updates rely on the visibility
  await getOutline()
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
      view?.setStatus("noEditor")
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

export function toggleOutlineView() {
  if (view === undefined) {
    view = new OutlineView() // create outline pane
  }
  const outlinePane = atom.workspace.paneForItem(view)
  if (outlinePane) {
    outlinePane.destroyItem(view)
    return
  }

  const rightDock = atom.workspace.getRightDock()
  const [pane] = rightDock.getPanes()

  pane.addItem(view)
  pane.activateItem(view)

  rightDock.show()

  // Trigger an editor change whenever an outline is toggeled.
  try {
    editorChanged(atom.workspace.getActiveTextEditor())
  } catch (e) {
    notifyError(e)
  }
}

function getOutlintIfVisible(editor = atom.workspace.getActiveTextEditor()) {
  // if outline is not visible return
  if (!isItemVisible(view)) {
    return
  }
  return getOutline(editor)
}

export function getOutline(editor = atom.workspace.getActiveTextEditor()) {
  if (view === undefined) {
    view = new OutlineView() // create outline pane
  }
  return view.setOutline(editor)
}

export { default as config } from "./config.json"
