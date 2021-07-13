import { CompositeDisposable } from "atom"
import { statuses } from "./statuses"
import { getIcon } from "../utils"
import type { Disposable, Point, Range, TextEditor } from "atom"
import type { ProviderRegistry } from "atom-ide-base/commons-atom/ProviderRegistry"
import type { CallHierarchy, CallHierarchyProvider, CallHierarchyType } from "atom-ide-base"

type statusKey = keyof typeof statuses

// TODO: escape HTML

/** HTMLElement for the call-hierarchy tab */
export class CallHierarchyView extends HTMLElement {
  #subscriptions = new CompositeDisposable()
  #editorSubscriptions: Disposable | undefined
  #providerRegistry: ProviderRegistry<CallHierarchyProvider>
  #outputElement: HTMLDivElement
  #currentType!: CallHierarchyType
  #debounceWaitTime = 300
  #isActivated = false
  #status: statusKey | "valid" | undefined
  getTitle = () => "Call Hierarchy"
  getIconName = () => "link"
  static getStatus(data: CallHierarchy<CallHierarchyType> | statusKey | null | undefined): statusKey | "valid" {
    if (typeof data === "string") {
      return data
    }
    if (data == null || data.data.length === 0) {
      return "noResult"
    }
    return "valid"
  }
  /** Called when the package is activated */
  constructor(
    { providerRegistry }: { providerRegistry: ProviderRegistry<CallHierarchyProvider> }
  ) {
    super()
    this.#providerRegistry = providerRegistry
    const headerElement = this.appendChild(document.createElement("div"))
    headerElement.innerHTML = `
      <div class="icon icon-alignment-align">Incoming</div>
      <div class="icon icon-alignment-aligned-to">Outgoing</div>
    `
    headerElement.addEventListener("click", () => this.#toggleCurrentType())
    this.#outputElement = this.appendChild(document.createElement("div"))
    this.#currentType = "incoming"
    this.setAttribute("current-type", "incoming")
  }
  /** Called when the call-hierarchy tab is opened */
  activate() {
    this.#isActivated = true
    // show call hierarchy when cursor position changes
    this.#subscriptions.add(
      atom.workspace.observeActiveTextEditor((editor) => {
        this.#editorSubscriptions?.dispose()
        let debounceTimeout: number | undefined
        this.#editorSubscriptions = editor?.onDidChangeCursorPosition((event) => {
          // TODO: use loadash/debounse
          window.clearTimeout(debounceTimeout)
          debounceTimeout = window.setTimeout(() => {
            this.showCallHierarchy(editor, event.newBufferPosition)
          }, this.#debounceWaitTime)
        })
        this.showCallHierarchy(editor)
      })
    )
  }
  /** Toogle between incoming and outgoing displays */
  #toggleCurrentType = () => {
    this.#currentType = this.#currentType === "incoming" ? "outgoing" : "incoming"
    this.setAttribute("current-type", this.#currentType)
    this.showCallHierarchy()
  }
  /** Show call hierarchy for {editor} and {point} */
  async showCallHierarchy(editor?: TextEditor, point?: Point) {
    if (!this.#isActivated) {
      return
    }
    const targetEditor = editor || atom.workspace.getActiveTextEditor()
    if (!targetEditor) {
      this.#updateCallHierarchyView("noEditor")
      return
    }
    const targetPoint = point || targetEditor.getCursorBufferPosition()
    const provider = this.#providerRegistry.getProviderForEditor(targetEditor)
    if (!provider) {
      this.#updateCallHierarchyView("noProvider")
      return
    }
    await this.#updateCallHierarchyView(
      await (this.#currentType === "incoming"
        ? provider.getIncomingCallHierarchy(targetEditor, targetPoint)
        : provider.getOutgoingCallHierarchy(targetEditor, targetPoint))
    )
  }
  /** Show call hierarchy for {newData} */
  #updateCallHierarchyView = async (newData: CallHierarchy<CallHierarchyType> | statusKey | null | undefined) => {
    const prevStatus = this.#status
    const currentStatus = (this.#status = CallHierarchyView.getStatus(newData))
    if (currentStatus === "valid") {
      // update display
      this.#outputElement.innerHTML = ""
      // `callHierarchy` must be `CallHierarchy<T>` because status is valid
      const item = new CallHierarchyViewItem(newData as CallHierarchy<CallHierarchyType>)
      this.#outputElement.appendChild(item)
      // unfold the first hierarchy
      await item.toggleAllItem()
      return
    }
    if (prevStatus === currentStatus) {
      return
    }
    // update display
    this.#outputElement.innerHTML = ""
    const item = new CallHierarchyViewStatusItem(statuses[currentStatus])
    this.#outputElement.appendChild(item)
  }
  /** Called when the call-hierarchy tab is hidden */
  destroy() {
    this.#isActivated = false
    this.#editorSubscriptions?.dispose()
    this.#subscriptions.dispose()
  }
  /** Called when the package is activated */
  dispose() {
    this.innerHTML = ""
  }
}
customElements.define("atom-ide-call-hierarchy-view", CallHierarchyView)

/** HTMLElement for the call-hierarchy item */
class CallHierarchyViewItem<T extends CallHierarchyType> extends HTMLElement {
  #callHierarchy: CallHierarchy<T> | undefined
  #dblclickWaitTime = 300
  /** Whether {callHierarchy} data is empty */
  static isEmpty(callHierarchy: CallHierarchy<CallHierarchyType> | undefined): callHierarchy is undefined {
    return !callHierarchy || callHierarchy.data.length == 0
  }
  constructor(callHierarchy: CallHierarchy<T> | undefined) {
    super()
    this.#callHierarchy = callHierarchy
    if (CallHierarchyViewItem.isEmpty(this.#callHierarchy)) {
      this.innerHTML = `<div class="call-hierarchy-no-data">No result was found.</span>`
      return
    }
    this.append(
      ...this.#callHierarchy.data.map((item, i) => {
        const itemEl = document.createElement("div")
        itemEl.setAttribute("title", item.path)
        itemEl.innerHTML = `
        <div class="icon icon-chevron-right">
          <div>
            <span>${escapeHTML(item.name)}</span>
            <span class="detail">${escapeHTML(item.detail ? ` - ${item.detail}` : "")}</span>
            ${item.tags.map((str) => `<span class="tag-${escapeHTML(str)}">${escapeHTML(str)}</span>`).join("")}
          </div>
        </div>
        `
        itemEl
          .querySelector(":scope>div>div")
          ?.insertAdjacentElement("afterbegin", getIcon(item.icon ?? undefined, undefined))
        let isDblclick = false
        itemEl.querySelector(":scope>div")?.addEventListener(
          "click",
          async (e) => {
            e.stopPropagation()
            if (isDblclick && this.#callHierarchy) {
              // double-click to jump to the document
              this.#showDocument(this.#callHierarchy.data[i])
              return
            }
            // single-click to toggle the display of item
            this.toggleItemAt(i)
            // enable double click
            window.setTimeout(() => (isDblclick = false), this.#dblclickWaitTime)
            isDblclick = true
          },
          false
        )
        return itemEl
      })
    )
  }
  /** Toggle the display of the {i}-th item */
  async toggleItemAt(i: number) {
    const itemEl = this.querySelectorAll<HTMLLIElement>(":scope>div")[i]
    const titleEl = itemEl.querySelector<HTMLDivElement>(":scope>div")
    const childEl = itemEl.querySelector<CallHierarchyViewItem<T>>("atom-ide-call-hierarchy-item")
    if (childEl) {
      if (childEl.style.display !== "none") {
        // hide if visible
        childEl.style.display = "none"
        titleEl?.classList.replace("icon-chevron-down", "icon-chevron-right")
      } else {
        // show if hidden
        childEl.style.display = ""
        titleEl?.classList.replace("icon-chevron-right", "icon-chevron-down")
      }
    } else {
      // create element if there is no data
      itemEl.appendChild(new CallHierarchyViewItem(await this.#callHierarchy?.itemAt(i)))
      titleEl?.classList.replace("icon-chevron-right", "icon-chevron-down")
    }
  }
  /** Toggle the display of all item */
  async toggleAllItem() {
    const dataLen = this.#callHierarchy?.data.length ?? 0
    await Promise.all([...Array(dataLen).keys()].map((i) => this.toggleItemAt(i)))
  }
  /** Show document for {range} and {path}, and select {selectionRange} */
  #showDocument = ({
    path,
    range: {
      start: { row, column },
    },
    selectionRange,
  }: {
    path: string
    range: Range
    selectionRange: Range
  }) => {
    const editor = atom.workspace.getActiveTextEditor()
    if (editor?.getPath() === path) {
      editor.setCursorBufferPosition([row, column])
      editor.scrollToBufferPosition([row, column], { center: true })
      editor.setSelectedBufferRange(selectionRange)
    } else {
      atom.workspace
        .open(path, {
          initialLine: row,
          initialColumn: column,
          searchAllPanes: true,
          activatePane: true,
          activateItem: true,
        })
        .then((editor: any) => editor?.setSelectedBufferRange(selectionRange))
    }
  }
}
customElements.define("atom-ide-call-hierarchy-item", CallHierarchyViewItem)

/** Create a message when there is nothing to display. */
class CallHierarchyViewStatusItem extends HTMLElement {
  constructor({ title, description }: { title: string; description: string }) {
    super()
    this.innerHTML = `
      <h1>${escapeHTML(title)}</h1>
      <span>${escapeHTML(description)}</span>
    `
  }
}
customElements.define("atom-ide-call-hierarchy-status-item", CallHierarchyViewStatusItem)

function escapeHTML(str: string): string {
  return str.replace(/[&'`"<>]/g, (match) => ({
    '&': '&amp;',
    "'": '&#x27;',
    '`': '&#x60;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
  }[match] as string))
}
