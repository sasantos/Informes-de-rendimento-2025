"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type Mode = "login" | "register" | "reset";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch {
      setError("Email ou senha inválidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("Este email já está cadastrado.");
      } else if (code === "auth/invalid-email") {
        setError("Email inválido.");
      } else if (code === "auth/weak-password") {
        setError("Senha muito fraca. Use no mínimo 6 caracteres.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(
        "Se este email estiver cadastrado, você receberá um link de redefinição. " +
        "Verifique também a pasta de spam/lixo eletrônico."
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      console.error("Reset password error:", code, err);
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("Nenhuma conta encontrada com este email.");
      } else if (code === "auth/invalid-email") {
        setError("Email inválido.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Erro ao enviar email. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    login: { title: "Extrato de Pagamentos", subtitle: "Faça login para acessar o sistema" },
    register: { title: "Criar Conta", subtitle: "Preencha os dados para se cadastrar" },
    reset: { title: "Redefinir Senha", subtitle: "Informe seu email para receber o link" },
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <img
            src="/assets/logo.png"
            alt="Logo"
            className="h-12 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-extrabold text-gray-800">
            {titles[mode].title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {titles[mode].subtitle}
          </p>
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleReset}
          className="space-y-5"
        >
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded text-sm text-green-700">
              {success}
            </div>
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

          {mode !== "reset" && (
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === "register" && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1">
                Confirmar Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-md transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Criar Conta"
                  : "Enviar Link"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 space-y-2">
          {mode === "login" && (
            <>
              <button
                onClick={() => switchMode("reset")}
                className="text-green-600 hover:text-green-700 font-semibold transition-colors"
              >
                Esqueci minha senha
              </button>
              <div>
                Não tem conta?{" "}
                <button
                  onClick={() => switchMode("register")}
                  className="text-green-600 hover:text-green-700 font-semibold transition-colors"
                >
                  Criar conta
                </button>
              </div>
            </>
          )}

          {mode === "register" && (
            <div>
              Já tem conta?{" "}
              <button
                onClick={() => switchMode("login")}
                className="text-green-600 hover:text-green-700 font-semibold transition-colors"
              >
                Fazer login
              </button>
            </div>
          )}

          {mode === "reset" && (
            <button
              onClick={() => switchMode("login")}
              className="text-green-600 hover:text-green-700 font-semibold transition-colors"
            >
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}