// Decides whether a keydown should step a guide tour. Arrow keys belong to
// text fields, selects, sliders, tabs and anything that already handled the
// event, so the tour only reacts on plain, unclaimed presses.
export type TourKeyEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  target: { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null;
};

const OWN_ARROWS_ROLES = new Set(["slider", "spinbutton", "textbox", "combobox", "listbox", "tab", "radio", "menuitem", "scrollbar", "searchbox"]);

export function tourKeyDelta(e: TourKeyEvent): 1 | -1 | 0 {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return 0;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.defaultPrevented) return 0;
  const t = e.target;
  if (t) {
    const tag = (t.tagName ?? "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return 0;
    const role = t.getAttribute?.("role");
    if (role && OWN_ARROWS_ROLES.has(role)) return 0;
  }
  return e.key === "ArrowRight" ? 1 : -1;
}
