import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Extrato de Pagamentos em Lote",
  description: "Gerador em lote de extratos de pagamentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-200 font-sans text-gray-800">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
