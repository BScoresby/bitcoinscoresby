// BitcoinScoresby — terminal navigation
// Add destinations and alternative phrases below.

// ==================================================
// DESTINATIONS
// ==================================================

const destinations = {
  '/whitepaper': [
    'whitepaper',
    'bitcoin whitepaper',
    "satoshi's whitepaper",
    'bitcoin'
  ],


  '/history': [
    'history'
  ],

  'https://stacker.news': [
    'stacker news',
    'stacker'
  ],
  
  '/cyberpunk': [
  // General phrases
  'cyberpunk',
  'cyberpunk books',
  'cyberpunk book reviews',
  'book reviews',
  'book review',
  'review',
  'reviews',
],

  '/cryptoeconomics': [
  'cryptoeconomics',
  'libbitcoin',
  'voskuil',
  'eric voskuil',
  'libbitcoin system',
 ],

...window.reviewDestinations,
...window.articleDestinations
};


// ==================================================
// COMMAND NAVIGATION
// ==================================================

// Normalize user input:
// - Ignore capitalization
// - Remove leading/trailing spaces
// - Collapse repeated spaces
// - Treat curly apostrophes like straight apostrophes

function normalizeCommand(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ');
}


// Find the destination matching a command.

function findDestination(command) {
  for (const [destination, aliases] of Object.entries(destinations)) {
    if (aliases.some(alias => normalizeCommand(alias) === command)) {
      return destination;
    }
  }

  return null;
}


// Handle terminal submission.

const form = document.getElementById('command-form');
const commandInput = document.getElementById('command');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const command = normalizeCommand(commandInput.value);

  if (!command) return;

  // Check whether the command matches a known destination.
  const destination = findDestination(command);

  if (destination) {
    window.location.assign(destination);
    return;
  }
  
  function normalizeCommand(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[.!?,:;']/g, '')
    .replace(/\s+/g, ' ');
}

// Terminal help commands
const helpCommands = [
  'help',
  '?',
  'man',
  'man scoresby',
  '--help'
];

if (helpCommands.includes(command.toLowerCase().trim())) {
  const error = document.getElementById('terminal-error');

  error.textContent =
    'Enter a topic, article title, book title, or author name. ' +
    'Try: archive, bitcoin history, cryptoeconomics, ' +
    'cyberpunk, or neuromancer.';

  commandInput.value = '';
  commandInput.focus();
  commandInput.dispatchEvent(new Event('input'));
  return;
}

  // Fallback: treat unknown commands as local page names.
  // Example: "contact" becomes /contact
  // Only one path segment is allowed.

const error = document.getElementById('terminal-error');
error.textContent = `Command not found: ${command}`;
commandInput.value = '';
commandInput.focus();
commandInput.dispatchEvent(new Event('input'));
});


// ==================================================
// CUSTOM BLINKING BLOCK CURSOR
// ==================================================

// Keep the solid cursor aligned with the actual
// insertion point, including when users type,
// click, or move through the input with arrow keys.

(() => {
  const input = document.getElementById('command');
  const cursor = document.querySelector('.block-cursor');
  const measure = document.querySelector('.cursor-measure');

  if (!input || !cursor || !measure) return;

  function updateCursor() {
    const position = input.selectionStart ?? input.value.length;

    // Measure the text before the insertion point.
    measure.textContent = input.value.slice(0, position);

    const width = measure.getBoundingClientRect().width;

    const pad =
      parseFloat(getComputedStyle(input).paddingLeft) || 0;

    // Position the block cursor.
    cursor.style.left =
      (pad + width - input.scrollLeft) + 'px';
  }

  // Keep the cursor synchronized with user actions.
  [
    'input',
    'click',
    'keyup',
    'scroll',
    'select',
    'focus'
  ].forEach(eventName => {
    input.addEventListener(eventName, updateCursor);
  });

  // Recalculate after the web font finishes loading.
  document.fonts?.ready.then(updateCursor);

  // Recalculate when the window changes size.
  window.addEventListener('resize', updateCursor);

  // Initial position.
  updateCursor();
})();
