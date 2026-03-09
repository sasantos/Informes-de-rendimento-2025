import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { uid?: string } | null;
    const uid = body?.uid?.trim();
    if (!uid) {
      return NextResponse.json({ error: "UID invalido." }, { status: 400 });
    }

    const { auth, db } = getFirebaseAdmin();

    const decoded = await auth.verifyIdToken(token);
    const actorUid = decoded.uid;

    const actorDoc = await db.collection("users").doc(actorUid).get();
    const actor = actorDoc.data() as { role?: string; active?: boolean } | undefined;
    if (!actorDoc.exists || actor?.role !== "admin" || actor?.active === false) {
      return NextResponse.json({ error: "Permissao negada." }, { status: 403 });
    }

    if (uid === actorUid) {
      return NextResponse.json(
        { error: "Nao e permitido excluir a propria conta pelo painel." },
        { status: 400 },
      );
    }

    try {
      await auth.deleteUser(uid);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "auth/user-not-found") {
        throw err;
      }
    }

    await db.collection("users").doc(uid).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message || "Erro interno.";
    if (message.includes("Firebase Admin nao configurado")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Falha ao excluir usuario." }, { status: 500 });
  }
}
