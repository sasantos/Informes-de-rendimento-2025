# Guia de Implantação — Next.js + Firebase + Auth

> Gerado a partir do projeto **Informes de Rendimento 2025**.
> Use como template para novos projetos com a mesma stack.

---

## Stack Utilizada

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Linguagem | TypeScript 5 (strict mode) |
| Estilo | Tailwind CSS 3 |
| Autenticação | Firebase Auth (Email/Senha) |
| Banco de Dados | Firestore |
| SDK Admin | firebase-admin |
| Node | 20.x |

---

## 1. Pré-requisitos

- Node.js 20+
- Conta no [Firebase Console](https://console.firebase.google.com/)
- Conta na [Vercel](https://vercel.com/) (ou outro host Node)

---

## 2. Configuração do Firebase

### 2.1 Criar projeto no Firebase Console

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"**
3. Dê um nome ao projeto e conclua o wizard
4. Acesse **Configurações do projeto → Geral**

### 2.2 Registrar o app Web

1. Clique em **"Adicionar app" → Web (`</>`)**
2. Copie o objeto `firebaseConfig` gerado:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

### 2.3 Ativar autenticação Email/Senha

1. Vá em **Authentication → Sign-in method**
2. Ative **E-mail/senha**

### 2.4 Criar banco de dados Firestore

1. Vá em **Firestore Database → Criar banco de dados**
2. Escolha **Modo de produção** (mais seguro)
3. Selecione a região mais próxima

### 2.5 Gerar chave de conta de serviço (Admin SDK)

1. Vá em **Configurações do projeto → Contas de serviço**
2. Clique em **"Gerar nova chave privada"** e baixe o JSON
3. Extraia os campos `client_email` e `private_key`

---

## 3. Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
# ─── Firebase Client SDK (expostos ao navegador) ───────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_PROJETO.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=SEU_PROJETO
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_PROJETO.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# ─── Firebase Admin SDK (servidor apenas — nunca expor ao cliente) ──────────
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@SEU_PROJETO.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"

# ─── App ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_VERSION=1.0.0
```

> **Atenção:** O `FIREBASE_PRIVATE_KEY` deve ter as quebras de linha substituídas por `\n` (literal) quando inserido em variáveis de ambiente de plataformas como Vercel.

### Alternativa: JSON completo da conta de serviço

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

---

## 4. Estrutura de Arquivos Firebase

### `src/lib/firebase.ts` — Client SDK

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// App principal
const app = getApps().find(a => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);

// App secundário para operações admin no cliente (ex: criar usuário sem perder sessão)
const secondaryApp =
  getApps().find(a => a.name === "secondary") ??
  initializeApp(firebaseConfig, "secondary");

export const auth = getAuth(app);
export const db = getFirestore(app);
export const secondaryAuth = getAuth(secondaryApp);
```

> **Por que dois apps?**
> Ao criar um novo usuário com `createUserWithEmailAndPassword`, o Firebase faz login automático naquele usuário, derrubando a sessão do admin atual. O app secundário evita isso.

---

### `src/lib/firebase-admin.ts` — Admin SDK

```ts
import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  // Opção 1: JSON completo
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  // Opção 2: Variáveis individuais
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminApp = initAdmin();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
```

---

## 5. Autenticação

### Método: Email/Senha

O projeto usa somente **Email/Senha** via Firebase Auth. Não há OAuth social (Google, GitHub, etc.).

### Fluxo de Login

```
Usuário preenche email/senha
        ↓
signInWithEmailAndPassword()
        ↓
Busca perfil em Firestore: users/{uid}
        ↓
Valida: perfil existe? active === true?
        ↓
Armazena timestamp de sessão no localStorage
        ↓
Redireciona para página principal
```

### `src/contexts/AuthContext.tsx` — Estrutura base

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas
const SESSION_KEY = "auth_session_started_at";

interface UserProfile {
  email: string;
  role: "admin" | "usuario";
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = snap.data() as UserProfile;
        if (!data?.active) {
          await signOut(auth);
          setUser(null);
          setProfile(null);
        } else {
          setUser(firebaseUser);
          setProfile(data);
          // Inicia timer de sessão
          const sessionStart = localStorage.getItem(SESSION_KEY);
          if (!sessionStart) localStorage.setItem(SESSION_KEY, Date.now().toString());
        }
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem(SESSION_KEY);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

### `src/components/ProtectedRoute.tsx`

```tsx
"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;
  return <>{children}</>;
}
```

---

## 6. Estrutura do Firestore

### Collection: `users`

```ts
// Documento: users/{uid}
{
  email: string;          // email do usuário
  role: "admin" | "usuario"; // papel no sistema
  active: boolean;        // conta ativa ou bloqueada
  createdAt: Timestamp;   // serverTimestamp()
}
```

### Criar primeiro usuário admin manualmente

No Console do Firebase → Firestore → Coleção `users`:

```
Documento ID: (UID do usuário criado no Auth)
email: admin@seudominio.com
role: admin
active: true
createdAt: (timestamp atual)
```

---

## 7. Regras de Segurança do Firestore

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários autenticados podem ler seus próprios dados
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      // Somente admin pode escrever (via Admin SDK no servidor)
      allow write: if false;
    }

    // Admins podem listar todos os usuários
    match /users/{userId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

---

## 8. API Route — Deleção de Usuário (exemplo)

### `src/app/api/admin/delete-user/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    // Verifica se quem fez a requisição é admin
    const callerDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (callerDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: "UID obrigatório" }, { status: 400 });
    if (uid === decoded.uid) {
      return NextResponse.json({ error: "Não é possível deletar a si mesmo" }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

**Como chamar no cliente:**
```ts
const idToken = await auth.currentUser?.getIdToken();
await fetch("/api/admin/delete-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify({ uid: targetUid }),
});
```

---

## 9. Configuração do Next.js

### `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // Remove indicador de dev no canto da tela
};

export default nextConfig;
```

---

## 10. Layout Raiz com AuthProvider

### `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Nome do Sistema",
  description: "Descrição",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## 11. Deploy na Vercel

### Passos

1. Faça push do código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com/) e importe o repositório
3. Na etapa de configuração, adicione todas as variáveis de ambiente (seção 3)
4. Clique em **Deploy**

### Configurações de build (padrão — sem `vercel.json` necessário)

| Configuração | Valor |
|---|---|
| Framework | Next.js (detectado automaticamente) |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node Version | 20.x |

> Para definir a versão do Node na Vercel: **Settings → General → Node.js Version → 20.x**

---

## 12. Checklist de Deploy

### Firebase

- [ ] Projeto criado no Firebase Console
- [ ] App Web registrado e `firebaseConfig` copiado
- [ ] Authentication ativado com provedor **E-mail/senha**
- [ ] Firestore criado em **modo produção**
- [ ] Regras de segurança do Firestore configuradas
- [ ] Chave de conta de serviço gerada (Admin SDK)
- [ ] Usuário admin criado no Auth + documento em `users/{uid}`

### Ambiente

- [ ] Todas as variáveis `NEXT_PUBLIC_FIREBASE_*` preenchidas
- [ ] `FIREBASE_CLIENT_EMAIL` preenchido
- [ ] `FIREBASE_PRIVATE_KEY` preenchido (com `\n` escapado)
- [ ] `NEXT_PUBLIC_APP_VERSION` definido

### Build

- [ ] `npm install` executado sem erros
- [ ] `npm run build` executado sem erros
- [ ] Acesso à `/login` funcional
- [ ] Login com admin funcional
- [ ] Rotas protegidas redirecionam usuários não autenticados
- [ ] API route `/api/admin/delete-user` respondendo corretamente

---

## 13. Comandos Úteis

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar servidor de produção
npm run start

# Lint
npm run lint
```

---

## 14. Segurança — Boas Práticas

- Nunca exponha `FIREBASE_PRIVATE_KEY` ou `FIREBASE_CLIENT_EMAIL` ao cliente
- Sempre valide o `idToken` no servidor antes de executar operações Admin
- Verifique o `role` do usuário no Firestore (não apenas no token)
- Configure **App Check** no Firebase para ambientes de produção
- Defina regras Firestore restritivas — nunca use `allow read, write: if true`
- Adicione `.env` e `.env.local` ao `.gitignore`

---

*Documento gerado automaticamente a partir do projeto Informes de Rendimento 2025.*
