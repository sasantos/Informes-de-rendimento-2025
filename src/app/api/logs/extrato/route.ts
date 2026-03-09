import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function getCallerUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const { auth: adminAuth } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

async function getCallerEmail(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const { auth: adminAuth } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(auth.slice(7));
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

async function isAdmin(uid: string): Promise<boolean> {
  try {
    const { app } = getFirebaseAdmin();
    const db = getFirestore(app);
    const snap = await db.collection("users").doc(uid).get();
    return snap.data()?.role === "admin";
  } catch {
    return false;
  }
}

interface LogEntry {
  codeSap: string;
  cnpj: string;
  produtor: string;
  dataGeracao?: string;
}

// POST /api/logs/extrato — registra um lote de PDFs gerados
export async function POST(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const entries: LogEntry[] = Array.isArray(body) ? body : [body];

  if (entries.length === 0) {
    return NextResponse.json({ count: 0 }, { status: 201 });
  }

  const { count } = await prisma.extratoLog.createMany({
    data: entries.map((e) => ({
      codeSap: e.codeSap ?? "",
      cnpj: e.cnpj ?? "",
      produtor: e.produtor ?? "",
      dataGeracao: e.dataGeracao ?? null,
      usuarioEmail: email,
    })),
  });

  return NextResponse.json({ count }, { status: 201 });
}

// GET /api/logs/extrato — lista logs (apenas admin)
export async function GET(req: NextRequest) {
  const uid = await getCallerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!(await isAdmin(uid))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const search = url.searchParams.get("search") ?? "";

  const where = search
    ? {
        OR: [
          { codeSap: { contains: search, mode: "insensitive" as const } },
          { cnpj: { contains: search, mode: "insensitive" as const } },
          { produtor: { contains: search, mode: "insensitive" as const } },
          { usuarioEmail: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, logs] = await Promise.all([
    prisma.extratoLog.count({ where }),
    prisma.extratoLog.findMany({
      where,
      orderBy: { geradoEm: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ total, page, limit, data: logs });
}
