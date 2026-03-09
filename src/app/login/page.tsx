"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AUTH_SESSION_STARTED_AT_KEY } from "@/lib/auth-session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", credential.user.uid));

      if (!snap.exists()) {
        await auth.signOut();
        setError("Acesso nao autorizado. Contate o administrador.");
        setLoading(false);
        return;
      }

      const profile = snap.data();
      if (profile.active === false) {
        await auth.signOut();
        setError("Sua conta esta desativada. Contate o administrador.");
        setLoading(false);
        return;
      }

      localStorage.setItem(AUTH_SESSION_STARTED_AT_KEY, String(Date.now()));
      router.push("/");
    } catch {
      setError("Email ou senha invalidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <img src="/assets/logo.png" alt="Logo" className="h-12 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-extrabold text-gray-800">Extrato de Pagamentos</h1>
          <p className="text-sm text-gray-500 mt-1">Faca login para acessar o sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-700">{error}</div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-700 hover:text-green-800 px-2 py-1 rounded"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-md transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Aguarde..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
          Esqueceu sua senha? Envie um email para{" "}
          <a
            href="mailto:sidney.santos@tereos.com"
            className="font-semibold text-green-700 hover:text-green-800 underline"
          >
            sidney.santos@tereos.com
          </a>
          .
        </div>
      </div>
    </div>
  );
}
