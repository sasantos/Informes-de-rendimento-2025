"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ExtratoGenerator from "@/components/ExtratoGenerator";
import AdminPanel from "@/components/AdminPanel";
import { useAuth } from "@/contexts/AuthContext";

function HomeContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [activeTab, setActiveTab] = useState<"extrato" | "admin">("extrato");

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8">
        <ExtratoGenerator />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Abas */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex border-b border-gray-300">
          <button
            onClick={() => setActiveTab("extrato")}
            className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === "extrato"
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Extrato de Pagamentos
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === "admin"
                ? "border-gray-700 text-gray-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Painel Administrativo
          </button>
        </div>
      </div>

      {activeTab === "extrato" ? <ExtratoGenerator /> : <AdminPanel />}
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
