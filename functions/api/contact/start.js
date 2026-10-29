
const LIFETIME_SECONDS = 15 * 60;

export async function onRequestPost({ env }) {
  if (!env.CONTACT_DB) {
    return Response.json(
      { ok: false, error: "Database unavailable" },
      { status: 503 }
    );
  }

  const id = crypto.randomUUID();

  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const nonce = Array.from(randomBytes, byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + LIFETIME_SECONDS;

  try {
    await env.CONTACT_DB.prepare(`
      INSERT INTO contact_attempts
        (id, nonce, state, created_at, expires_at)
      VALUES (?, ?, 'created', ?, ?)
    `).bind(id, nonce, now, expiresAt).run();

    return Response.json({
      ok: true,
      attempt_id: id,
      nonce,
      amount_msats: 21000,
      expires_at: expiresAt
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch (error) {
    console.error("Could not create contact attempt:", error);

    return Response.json(
      { ok: false, error: "Could not create attempt" },
      { status: 503 }
    );
  }
}
