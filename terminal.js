
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

  '/memeology': [
    'memes',
    'memeology',
    'meme',
    'history',
    'culture',
    'Bitcoin history',
    'Bitcoin culture'
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
    'reviews'
  ],

  '/cryptoeconomics': [
    'cryptoeconomics',
    'libbitcoin',
    'voskuil',
    'eric voskuil',
    'libbitcoin system'
  ],

  '/contact': [
    'contact',
    'message',
    'get in touch',
    'email',
    'phone',
    'DM',
    'direct message',
    'how do I contact you',
    'how do I reach you',
    'mail'
  ],
  
  '/tether': [
    'tether',
    'bitfinex',
    'usdt',
    'stablecoin',
    'fun',
    'fun unbelievable details',
    'stables',
    'stable'
    ],

  // Generated destinations for reviews, articles, posters
  ...window.reviewDestinations,
  ...window.articleDestinations,
  ...window.posterDestinations
};


// ==================================================
// COMMAND NAVIGATION
// ==================================================

// Normalize user input:
// - Ignore capitalization
// - Remove leading/trailing spaces
// - Collapse repeated spaces
// - Ignore apostrophes and punctuation (straight or curly)

function normalizeCommand(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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


// ==================================================
// FORM SUBMISSION
// ==================================================

const form = document.getElementById('command-form');
const commandInput = document.getElementById('command');

// Escalating responses for consecutive unknown commands.
let failedCommands = 0;

const errorMessages = [
  'Command not found.',
  'Close, but no banana.',
  'Still no banana.',
  'No cigar',
  'No nothing.',
  'ERROR: User persistence exceeds system expectations.',
  'Consulting the whale...',
  'The whale has declined to comment.',
  'You need --help',
  '404: Meaning not found.'
];

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const rawCommand = commandInput.value.trim();
  if (!rawCommand) return;

  const command = normalizeCommand(rawCommand);
  const output = document.getElementById('terminal-error');
  function clearInput() {
    commandInput.value = '';
    commandInput.focus();
    commandInput.dispatchEvent(new Event('input'));
  }

  // Check help before normalization removes '?' and '--'.
  const helpCommands = [
    'help',
    '?',
    'man',
    'man scoresby',
    '--help'
  ];

  if (helpCommands.includes(rawCommand.toLowerCase())) {
    failedCommands = 0;
    output.textContent =
      'Enter a topic, article title, book title, or author name. ' +
      'You can also try movie titles, famous quotes, or "random poster". ' +
      'Examples: memeology, cryptoeconomics, cyberpunk, neuromancer, terminator.';

    clearInput();
    return;
  }

  // Let visitors explore the poster collection
  // without knowing its aliases.
  if (command === 'random poster' || command === 'surprise me' || command === 'random') {
    failedCommands = 0;
    const posters = Object.keys(window.posterDestinations || {});

    if (posters.length) {
      const randomIndex = Math.floor(Math.random() * posters.length);
      window.location.assign(posters[randomIndex]);
    } else {
      output.textContent = 'No posters available yet.';
      clearInput();
    }

    return;
  }

  // Look up commands and generated aliases
  // using the same normalization.
  const destination = findDestination(command);

  if (destination) {
    failedCommands = 0;
    window.location.assign(destination);
    return;
  }

// Escalate consecutive unrecognized commands.
const messageIndex = Math.min(
  failedCommands,
  errorMessages.length - 1
);

output.textContent = errorMessages[messageIndex];

failedCommands++;
clearInput();
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
