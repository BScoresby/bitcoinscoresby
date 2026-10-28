
export async function onRequestGet({ env }) {
  try {
    if (!env.CONTACT_DB) {
      throw new Error("CONTACT_DB binding is missing");
    }

    const result = await env.CONTACT_DB
      .prepare(
        "SELECT message FROM test_connection WHERE id = ?"
      )
      .bind(1)
      .first();

    if (!result) {
      throw new Error("Test record not found");
    }

    return Response.json({
      ok: true,
      service: "BitcoinScoresby Contact",
      database: "connected",
      message: result.message
    });

  } catch (error) {
    console.error("Contact health check failed:", error);

    return Response.json({
      ok: false,
      error: "Contact database is unavailable"
    }, {
      status: 503
    });
  }
}
