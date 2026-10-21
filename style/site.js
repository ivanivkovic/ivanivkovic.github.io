(() => {
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
