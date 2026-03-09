"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ExtratoLog {
  id: number;
  codeSap: string;
  cnpj: string;
  produtor: string;
  dataGeracao: string | null;
  usuarioEmail: string;
  geradoEm: string;
}

interface LogsResponse {
  total: number;
  page: number;
  limit: number;
  data: ExtratoLog[];
}

interface ExtratoLogsDashboardProps {
  onBack?: () => void;
}

function formatDateBR(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExtratoLogsDashboard({ onBack }: ExtratoLogsDashboardProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ExtratoLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/logs/extrato?${params}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar logs");
      const json: LogsResponse = await res.json();
      setLogs(json.data);
      setTotal(json.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, page, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleClear() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Voltar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Histórico de Extratos Gerados</h1>
            <p className="text-xs text-gray-500">{total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Atualizar
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Busca */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por SAP, CNPJ, produtor ou usuário..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Limpar
            </button>
          )}
        </form>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Código SAP</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">CNPJ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Produtor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Data do Extrato</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Gerado em</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Carregando...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {!loading && logs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {log.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">
                      {log.codeSap || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                      {log.cnpj || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[220px] truncate" title={log.produtor}>
                      {log.produtor || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {log.dataGeracao || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[180px] truncate" title={log.usuarioEmail}>
                      {log.usuarioEmail}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDateBR(log.geradoEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>
                Página {page} de {totalPages} — {total} registro{total !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
