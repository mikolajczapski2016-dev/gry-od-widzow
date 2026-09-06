(() => {
  const style = document.createElement('style');
  style.textContent = `
    #rotate-phone {position:fixed;inset:0;z-index:2147483647;background:#11111b;color:#f4f3ff;display:flex;align-items:center;justify-content:center;padding:28px;text-align:center;font:18px/1.6 Arial,sans-serif;overflow:auto;}
    #rotate-phone[hidden]{display:none}
    #rotate-phone h2{font-size:32px;color:#bc9bff;margin:16px 0}
    #rotate-phone a{display:inline-block;color:#bc9bff;margin-top:20px}
  `;
  document.head.append(style);
  const overlay = document.createElement('div');
  overlay.id = 'rotate-phone';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rotate-title');
  overlay.tabIndex = -1;
  overlay.innerHTML = '<div><div aria-hidden="true" style="font-size:64px">↻</div><h2 id="rotate-title">Obróć telefon</h2><p>W tę grę gramy poziomo!<br>Obróć telefon, aby grać dalej.</p><a href="../index.html">← Wróć do listy gier</a></div>';
  document.body.append(overlay);
  const portrait = matchMedia('(orientation: portrait)');
  const touch = matchMedia('(any-pointer: coarse)');
  const saved = new Map();
  let blocked = false;
  let previousFocus;
  function update() {
    const next = portrait.matches && (touch.matches || navigator.maxTouchPoints > 0);
    if (next === blocked) return;
    blocked = next;
    overlay.hidden = !blocked;
    if (blocked) {
      previousFocus = document.activeElement;
      for (const child of document.body.children) {
        if (child === overlay || !(child instanceof HTMLElement)) continue;
        saved.set(child, child.inert);
        child.inert = true;
      }
      overlay.focus();
    } else {
      for (const [child, inert] of saved) child.inert = inert;
      saved.clear();
      if (previousFocus?.isConnected) previousFocus.focus();
    }
    window.dispatchEvent(new CustomEvent('game-orientation-change', {detail: {blocked}}));
  }
  window.addEventListener('keydown', event => {
    if (blocked && event.key !== 'Tab') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  portrait.addEventListener('change', update);
  touch.addEventListener('change', update);
  window.addEventListener('resize', update);
  update();
})();
