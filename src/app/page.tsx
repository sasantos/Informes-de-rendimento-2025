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
      <div className="px-4 sm:px-8 pb-4 sm:pb-8">
        <ExtratoGenerator />
      </div>
    );
  }

  return (
    <div className={activeTab === "extrato" ? "px-4 sm:px-8 pb-4 sm:pb-8" : "p-4 sm:p-8"}>
      {activeTab === "extrato" ? (
        <ExtratoGenerator
          showAdminTabSwitch
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
        />
      ) : (
        <AdminPanel onBackToExtrato={() => setActiveTab("extrato")} />
      )}
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
