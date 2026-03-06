"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import ExtratoGenerator from "@/components/ExtratoGenerator";

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="p-4 sm:p-8">
        <ExtratoGenerator />
      </div>
    </ProtectedRoute>
  );
}