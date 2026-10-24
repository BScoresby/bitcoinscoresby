// The site's only JavaScript: a tiny terminal-style URL navigator.
const form = document.getElementById('command-form');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.getElementById('command').value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!value) return;
  if (value === 'stacker news') {
    window.location.assign('https://stacker.news');
    return;
  }
  // Only allow a single local path segment; no arbitrary external URLs.
  window.location.assign('/' + encodeURIComponent(value));
});


// Keep the solid cursor in sync with the input's actual insertion point.
(() => {
  const input = document.getElementById('command');
  const cursor = document.querySelector('.block-cursor');
  const measure = document.querySelector('.cursor-measure');
  if (!input || !cursor || !measure) return;

  function updateCursor() {
    const position = input.selectionStart ?? input.value.length;
    measure.textContent = input.value.slice(0, position);
    const width = measure.getBoundingClientRect().width;
    const pad = parseFloat(getComputedStyle(input).paddingLeft) || 0;
    cursor.style.left = (pad + width - input.scrollLeft) + 'px';
  }

  ['input', 'click', 'keyup', 'scroll', 'select', 'focus'].forEach(name => {
    input.addEventListener(name, updateCursor);
  });
  document.fonts?.ready.then(updateCursor);
  window.addEventListener('resize', updateCursor);
  updateCursor();
})();
