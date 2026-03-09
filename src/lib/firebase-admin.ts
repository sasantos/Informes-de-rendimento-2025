import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

interface AdminClients {
  app: App;
  auth: Auth;
  db: Firestore;
}

interface ServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function readServiceAccountFromEnv(): ServiceAccountConfig | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountConfig>;
    if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY invalida.");
    }
    return {
      projectId: parsed.projectId,
      clientEmail: parsed.clientEmail,
      privateKey: parsed.privateKey.replace(/\\n/g, "\n"),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdmin(): AdminClients {
  const existing = getApps().find((app) => app.name === "admin");
  if (existing) {
    return {
      app: existing,
      auth: getAuth(existing),
      db: getFirestore(existing),
    };
  }

  const serviceAccount = readServiceAccountFromEnv();
  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin nao configurado. Defina FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  const app = initializeApp(
    {
      credential: cert(serviceAccount),
    },
    "admin",
  );

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
