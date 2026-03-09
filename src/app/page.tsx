"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ExtratoGenerator from "@/components/ExtratoGenerator";
import AdminPanel from "@/components/AdminPanel";
import ExtratoLogsDashboard from "@/components/ExtratoLogsDashboard";
import { useAuth } from "@/contexts/AuthContext";

type MainTab = "extrato" | "admin" | "logs";

function HomeContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [activeTab, setActiveTab] = useState<MainTab>("extrato");

  if (!isAdmin) {
    return (
      <div className="px-4 sm:px-8 pb-4 sm:pb-8">
        <ExtratoGenerator />
      </div>
    );
  }

  if (activeTab === "admin") {
    return (
      <div className="p-4 sm:p-8">
        <AdminPanel onBackToExtrato={() => setActiveTab("extrato")} />
      </div>
    );
  }

  if (activeTab === "logs") {
    return <ExtratoLogsDashboard onBack={() => setActiveTab("extrato")} />;
  }

  return (
    <div className="px-4 sm:px-8 pb-4 sm:pb-8">
      <ExtratoGenerator
        showAdminTabSwitch
        activeTab={activeTab}
        onActiveTabChange={(tab) => setActiveTab(tab as MainTab)}
      />
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
