import ReactQuillBase from "react-quill";

const ReactQuillAny = ReactQuillBase as any;

if (!ReactQuillAny.__patchedForReact19) {
  ReactQuillAny.prototype.getEditingArea = function patchedGetEditingArea() {
    const area = this.editingArea as Node | null | undefined;
    if (!area) {
      throw new Error("ReactQuill: editing area ref not available");
    }

    if (typeof area.nodeType === "number") {
      if (area.nodeType === Node.TEXT_NODE) {
        throw new Error("Editing area cannot be a text node");
      }
      return area;
    }

    const maybeRoot = (area as any).root;
    if (maybeRoot && typeof maybeRoot.nodeType === "number") {
      return maybeRoot;
    }

    throw new Error(
      "ReactQuill: custom editing areas require ReactDOM.findDOMNode, which was removed in React 19. " +
        "Render a DOM element (e.g. <div>) or update react-quill when support is available."
    );
  };

  ReactQuillAny.__patchedForReact19 = true;
}

export default ReactQuillBase;
export * from "react-quill";
