const SOLID_TAGS = new Set([
  "IMG",
  "SVG",
  "VIDEO",
  "CANVAS",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "IFRAME",
]);

const inside = (r: DOMRect, x: number, y: number) =>
  r.width > 0 &&
  r.height > 0 &&
  x >= r.left &&
  x <= r.right &&
  y >= r.top &&
  y <= r.bottom;

const clear = (c: string) =>
  c === "transparent" || /,\s*0\)$|\/\s*0\)$/.test(c);

function painted(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.visibility === "hidden" || s.opacity === "0") return false;
  if (SOLID_TAGS.has(el.tagName.toUpperCase())) return true;
  if (el.matches(".cp-shape, .cp-click")) return true;
  if (
    !clear(s.backgroundColor) ||
    s.backgroundImage !== "none" ||
    s.boxShadow !== "none"
  ) {
    return true;
  }
  return (["Top", "Right", "Bottom", "Left"] as const).some(
    (side) =>
      parseFloat(s[`border${side}Width`]) > 0 &&
      !clear(s[`border${side}Color`]),
  );
}

export function paintsAt(root: Element, x: number, y: number): boolean {
  if (getComputedStyle(root).opacity === "0") return false;
  if (!inside(root.getBoundingClientRect(), x, y)) return false;
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (inside(el.getBoundingClientRect(), x, y) && painted(el)) return true;
  }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue;
    if (
      n.parentElement &&
      getComputedStyle(n.parentElement).visibility === "hidden"
    )
      continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (inside(r, x, y)) return true;
  }
  return false;
}

export function objectsAt(x: number, y: number, selector: string): Element[] {
  const found = document
    .elementsFromPoint(x, y)
    .map((el) => el.closest(selector));
  return [...new Set(found.filter((el): el is Element => !!el))];
}

export function hitObject(
  x: number,
  y: number,
  selector: string,
): Element | null {
  const objs = objectsAt(x, y, selector);
  return objs.find((o) => paintsAt(o, x, y)) ?? objs[0] ?? null;
}

export function passThrough(e: PointerEvent, selector: string): boolean {
  const top = (e.target as Element).closest(selector);
  const objs = objectsAt(e.clientX, e.clientY, selector);
  const hit = objs.find((o) => paintsAt(o, e.clientX, e.clientY));
  if (!top || !hit || hit === top) return false;
  const above = objs.slice(0, objs.indexOf(hit)) as HTMLElement[];
  above.forEach((el) => (el.style.pointerEvents = "none"));
  const restore = () =>
    window.setTimeout(() =>
      above.forEach((el) => (el.style.pointerEvents = "")),
    );
  window.addEventListener("pointerup", restore, { once: true, capture: true });
  window.addEventListener("pointercancel", restore, {
    once: true,
    capture: true,
  });
  const under = document.elementFromPoint(e.clientX, e.clientY);
  under?.dispatchEvent(new PointerEvent("pointerdown", e));
  return true;
}
