(() => {
  const root = document.documentElement;
  const motionAllowed = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = 0;

  function animateDepth() {
    currentX += (pointerX - currentX) * 0.075;
    currentY += (pointerY - currentY) * 0.075;
    root.style.setProperty('--bg-x', `${(-currentX * 7).toFixed(2)}px`);
    root.style.setProperty('--bg-y', `${(-currentY * 7).toFixed(2)}px`);
    root.style.setProperty('--orbit-x', `${(currentX * 3).toFixed(2)}px`);
    root.style.setProperty('--orbit-y', `${(currentY * 3).toFixed(2)}px`);
    root.style.setProperty('--portrait-x', `${(currentX * 2).toFixed(2)}px`);
    root.style.setProperty('--portrait-y', `${(currentY * 2).toFixed(2)}px`);
    frame = Math.abs(pointerX - currentX) + Math.abs(pointerY - currentY) > 0.002
      ? window.requestAnimationFrame(animateDepth) : 0;
  }

  function resetDepth() {
    pointerX = 0;
    pointerY = 0;
    if (!frame && motionAllowed.matches) frame = window.requestAnimationFrame(animateDepth);
  }

  window.addEventListener('pointermove', (event) => {
    if (!motionAllowed.matches || event.pointerType !== 'mouse') return;
    pointerX = event.clientX / window.innerWidth * 2 - 1;
    pointerY = event.clientY / window.innerHeight * 2 - 1;
    if (!frame) frame = window.requestAnimationFrame(animateDepth);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetDepth);
  window.addEventListener('blur', resetDepth);
  motionAllowed.addEventListener('change', () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    pointerX = pointerY = currentX = currentY = 0;
    for (const variable of ['--bg-x', '--bg-y', '--orbit-x', '--orbit-y', '--portrait-x', '--portrait-y']) {
      root.style.removeProperty(variable);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      resetDepth();
    }
  });

  const copyButton = document.querySelector('[data-copy]');
  const notice = document.querySelector('.copy-notice');
  let noticeTimer;

  copyButton.addEventListener('click', async () => {
    window.clearTimeout(noticeTimer);
    let copied = false;
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      copied = true;
    } catch {
      // Keep the username selectable when clipboard permission is unavailable.
    }
    notice.textContent = copied ? 'Copied Discord username: dragularob' : 'Discord username: dragularob';
    notice.classList.add('is-visible');
    if (copied) noticeTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 4500);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') notice.classList.remove('is-visible');
  });
  document.addEventListener('pointerdown', (event) => {
    if (!notice.contains(event.target) && !copyButton.contains(event.target)) notice.classList.remove('is-visible');
  });
})();
