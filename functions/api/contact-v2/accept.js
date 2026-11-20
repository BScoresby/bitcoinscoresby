// Public Contact v2 acceptance endpoint. Disabled unless explicitly enabled.
// Reuses the server-side NIP-17 validator already in the website repository.
import { validateGiftWrap } from '../contact/send-validation.js';
import { acceptRequest } from '../../../lib/contact-v2/accept-core.js';

export function onRequestPost(context) {
  return acceptRequest(context, validateGiftWrap);
}
