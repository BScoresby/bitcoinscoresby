BitcoinScoresby local QR upgrade

Copy the contact/ directory over your existing contact/ directory.
Run: python3 zap-test-server.py
Open: http://localhost:8000/contact/
Enter a message, request a 21-sat invoice, then scan its QR or click Copy invoice.
No Node/npm, CDN, or external QR service is required.

This remains the LOCAL browser-side payment prototype. Do not deploy publicly until payment verification and one-use delivery are enforced server-side.
