// Contact v2 encrypted inbox: authenticated, read-only, cursor-paginated GET.
// Only contact_v2_messages rows are exposed. Payment attempts and receipts
// are never returned.
import { inboxRequest } from '../../../lib/contact-v2/inbox-core.js';

export function onRequest(context) {
  return inboxRequest(context);
}
