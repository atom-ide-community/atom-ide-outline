export function getIcon(iconType: string | undefined, kindType: string | undefined) {
    // LSP specification: https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_documentSymbol
    // atom-languageclient mapping: https://github.com/atom/atom-languageclient/blob/485bb9d706b422456640c9070eee456ef2cf09c0/lib/adapters/outline-view-adapter.ts#L270
  
    const iconElement = document.createElement("span")
    iconElement.classList.add("outline-icon")
  
    // if iconType given instead
    if (kindType === undefined && iconType !== undefined) {
      kindType = iconType
    }
  
    let type: string = "🞇"
    if (typeof kindType === "string" && kindType.length > 0) {
      let kindClass: string
      // hasKind
      if (kindType.indexOf("type-") === 0) {
        // supplied with type-...
        kindClass = `${kindType}`
        type = kindType.replace("type-", "")
      } else {
        // supplied without type-
        kindClass = `type-${kindType}`
        type = kindType
      }
      iconElement.classList.add(kindClass)
    }
  
    iconElement.innerHTML = `<span>${type.substring(0, 3)}</span>`
  
    return iconElement
  }
