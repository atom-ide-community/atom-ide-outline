export const statuses = {
  noEditor: {
    title: "Call Hierarchy is unavailable.",
    description: "Open a text editor.",
  },
  noProvider: {
    title: "Provider is unavailable.",
    description:
      "Looks like a provider for this type of file is not available. Check if a relevant IDE language package is installed and has call hierarchy support, or try adding one from Atom's package registry (e.g.: atom-ide-javascript, atom-typescript, ide-python, ide-rust, ide-css, ide-json).",
  },
  noResult: {
    title: "No result was found.",
    description: "The Call Hierarchy could not found the text you entered in the filter bar.",
  },
}
