// =============================================================
// ui.js — small helpers for building the page safely.
//
// SAFETY RULE for the whole project: user text (nicknames, answers)
// is only ever put on the page with textContent, never innerHTML.
// textContent shows text as plain letters, so if someone types
// <script> as their name it just appears as the word "<script>".
// =============================================================

/**
 * Create an element in one line.
 *   el('button', { class: 'btn', onclick: go }, 'Start')
 * Strings in `children` become text nodes (safe for user input).
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Replace everything inside `container` with the given nodes. */
export function mount(container, ...nodes) {
  container.replaceChildren(...nodes.flat().filter(Boolean));
}

/** Show a short message at the bottom of the screen for a few seconds. */
export function toast(message, ms = 2500) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('show'), ms);
}
