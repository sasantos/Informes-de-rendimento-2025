"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { db, secondaryAuth } from "@/lib/firebase";
import { UserRole } from "@/contexts/AuthContext";

interface UserRecord {
  uid: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: { seconds: number };
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  usuario: "Usuário",
};

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Formulário de criação
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("usuario");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const snap = await getDocs(collection(db, "users"));
    const list: UserRecord[] = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserRecord));
    list.sort((a, b) => a.email.localeCompare(b.email));
    setUsers(list);
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setCreating(true);

    if (newPassword.length < 6) {
      setFormError("A senha deve ter no mínimo 6 caracteres.");
      setCreating(false);
      return;
    }

    try {
      // Cria o usuário no Firebase Auth usando o app secundário
      // (não afeta a sessão do admin)
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmail,
        newPassword
      );
      const uid = credential.user.uid;

      // Faz logout do app secundário imediatamente
      await firebaseSignOut(secondaryAuth);

      // Salva o perfil no Firestore
      await setDoc(doc(db, "users", uid), {
        email: newEmail,
        role: newRole,
        active: true,
        createdAt: serverTimestamp(),
      });

      setFormSuccess(`Usuário "${newEmail}" criado com sucesso!`);
      setNewEmail("");
      setNewPassword("");
      setNewRole("usuario");
      await fetchUsers();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setFormError("Este email já está cadastrado.");
      } else if (code === "auth/invalid-email") {
        setFormError("Email inválido.");
      } else if (code === "auth/weak-password") {
        setFormError("Senha muito fraca.");
      } else {
        setFormError("Erro ao criar usuário. Tente novamente.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    await updateDoc(doc(db, "users", user.uid), { active: !user.active });
    setUsers((prev) =>
      prev.map((u) => (u.uid === user.uid ? { ...u, active: !u.active } : u))
    );
  };

  const handleDelete = async (uid: string) => {
    await deleteDoc(doc(db, "users", uid));
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    setConfirmDelete(null);
  };

  return (
    <div className="max-w-5xl mx-auto mb-8">
      {/* Header do painel */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 px-8 py-5 flex items-center gap-3">
          <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Painel do Administrador</h2>
        </div>

        <div className="p-8 space-y-8">

          {/* Formulário de criação */}
          <div>
            <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="bg-green-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">+</span>
              Criar Novo Usuário
            </h3>

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Perfil</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="usuario">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                {formError && (
                  <div className="mb-2 bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-700">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-2 bg-green-50 border-l-4 border-green-400 p-3 rounded text-sm text-green-700">
                    {formSuccess}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-md text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Criando..." : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de usuários */}
          <div>
            <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Usuários Cadastrados
            </h3>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-3"></div>
                Carregando usuários...
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Perfil</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.uid} className={`transition-colors ${!u.active ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}`}>
                        <td className="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {u.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleActive(u)}
                              title={u.active ? "Desativar" : "Ativar"}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                                u.active
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {u.active ? "Desativar" : "Ativar"}
                            </button>

                            {confirmDelete === u.uid ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Confirmar?</span>
                                <button
                                  onClick={() => handleDelete(u.uid)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(u.uid)}
                                title="Excluir usuário"
                                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-all"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
