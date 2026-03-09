"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Extrato,
  PageData,
  TotalRow,
  parseExtratos,
  paginateExtrato,
  formatMoney,
  formatTons,
} from "@/lib/extrato-utils";
import { useAuth } from "@/contexts/AuthContext";

type StatusState = "idle" | "loading" | "progress" | "error" | "success";

interface Status {
  state: StatusState;
  message: string;
  current: number;
  total: number;
}

const PREVIEW_PAGE_SIZE = 10;

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          const timeoutId = window.setTimeout(() => resolve(), 2000);
          const done = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };

          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

function sanitizeFilePart(value: string | undefined, fallback: string): string {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, "").trim();
}

function getExtratoFilename(extrato: Extrato): string {
  const safeId = sanitizeFilePart(extrato.idSap, "SEM_ID");
  const safeProdutor = sanitizeFilePart(extrato.produtor, "SEM_NOME");
  return `${safeId}_${safeProdutor}`;
}

function ExtratoTable({
  title,
  headers,
  rows,
  total,
}: {
  title: string;
  headers: string[];
  rows: Record<string, string>[];
  total: TotalRow | null;
}) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  return (
    <div className="mb-4">
      <h3 className="text-md font-bold text-green-700 mb-1 border-b border-gray-300 pb-1">
        {title}
      </h3>
      <div className="overflow-hidden">
        <table className="w-full text-xs text-left border-collapse border border-gray-300">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`border border-gray-300 p-2 font-semibold ${i > headers.length - 3 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 !== 0 ? "bg-gray-50" : ""}>
                {keys.map((key, cIdx) => {
                  const isNum = cIdx > keys.length - 3;
                  const val = isNum
                    ? cIdx === keys.length - 1
                      ? formatMoney(row[key])
                      : formatTons(row[key])
                    : row[key];
                  return (
                    <td
                      key={cIdx}
                      className={`border border-gray-300 p-2 ${isNum ? "text-right" : ""}`}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot className="bg-green-100 font-bold">
              <tr>
                <td
                  className="border border-gray-300 p-2 text-right"
                  colSpan={headers.length - 2}
                >
                  Total
                </td>
                <td className="border border-gray-300 p-2 text-right">
                  {formatTons(total.tons)}
                </td>
                <td className="border border-gray-300 p-2 text-right">
                  {formatMoney(total.total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function FaturamentoTable({
  rows,
  total,
  alwaysShow = false,
}: {
  rows: { cnpj: string; data: string; tons: string; faturamento: string; funrural: string }[];
  total: { tons: string; faturamento: string; funrural: string } | null;
  alwaysShow?: boolean;
}) {
  if (!rows || (rows.length === 0 && !alwaysShow)) return null;
  const headers = ["CNPJ da Filial", "Data", "Qt. Tons", "Faturamento Bruto", "Funrural Retido"];
  return (
    <div className="mb-4">
      <h3 className="text-md font-bold text-green-700 mb-1 border-b border-gray-300 pb-1">
        Faturamento
      </h3>
      <div className="overflow-hidden">
        <table className="w-full text-xs text-left border-collapse border border-gray-300">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`border border-gray-300 p-2 font-semibold ${i >= 2 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 !== 0 ? "bg-gray-50" : ""}>
                <td className="border border-gray-300 p-2">{row.cnpj}</td>
                <td className="border border-gray-300 p-2">{row.data}</td>
                <td className="border border-gray-300 p-2 text-right">{formatTons(row.tons)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatMoney(row.faturamento)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatMoney(row.funrural)}</td>
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot className="bg-green-100 font-bold">
              <tr>
                <td className="border border-gray-300 p-2 text-right" colSpan={2}>Total</td>
                <td className="border border-gray-300 p-2 text-right">{formatTons(total.tons)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatMoney(total.faturamento)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatMoney(total.funrural)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function ExtratoPage({
  extrato,
  page,
  pageIndex,
  totalPages,
}: {
  extrato: Extrato;
  page: PageData;
  pageIndex: number;
  totalPages: number;
}) {
  const r = extrato;
  return (
    <div className="a4-page">
      <div className="flex justify-between items-center border-b-2 border-green-600 pb-4 mb-6 shrink-0">
        <div>
          <img
            src="/assets/logo.png"
            alt="Tereos"
            className="h-10 object-contain"
          />
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase text-gray-700 flex items-center justify-end">
            Extrato de Pagamentos - Pág. {pageIndex + 1} de {totalPages}
          </h2>
          <p className="text-sm text-gray-500">
            De {r.dataInicio || ""} a {r.dataFim || ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm shrink-0">
        <div>
          <p>
            <span className="font-bold">Empresa Pagadora:</span>{" "}
            {r.empresa || "-"}
          </p>
          <p>
            <span className="font-bold">CNPJ/MF Pagadora:</span>{" "}
            {r.empresaCnpj || "-"}
          </p>
        </div>
        <div className="sm:text-right">
          <p>
            <span className="font-bold">Ano:</span> {r.ano || "-"}
          </p>
          <p>
            <span className="font-bold">ID SAP PJ:</span> {r.idSap || "-"}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-6 text-sm shrink-0">
        <p>
          <span className="font-bold">Produtor Rural Titular:</span>{" "}
          {r.produtor || "-"}
        </p>
        <p>
          <span className="font-bold">CNPJ/MF Produtor Rural:</span>{" "}
          {r.produtorCnpj || "-"}
        </p>
        <p>
          <span className="font-bold mt-1 inline-block">Contratos:</span>{" "}
          {r.contratos.join(", ") || "-"}
        </p>
      </div>

      <div className="flex-grow">
        <ExtratoTable
          title="Adiantamentos"
          headers={["Data/Mês", "Tons", "Total (R$)"]}
          rows={page.adiantamentos as unknown as Record<string, string>[]}
          total={page.showAdiantamentosTotal ? (r.adiantamentosTotal ?? null) : null}
        />
        <FaturamentoTable
          rows={page.faturamentos}
          total={page.showFaturamentosTotal ? (r.faturamentosTotal ?? null) : null}
          alwaysShow={r.faturamentos.length === 0}
        />
        <ExtratoTable
          title="Recebedores"
          headers={["CPF/CNPJ", "Nome", "Tons", "Valor (R$)"]}
          rows={page.recebedores as unknown as Record<string, string>[]}
          total={page.showRecebedoresTotal ? (r.recebedoresTotal ?? null) : null}
        />
      </div>

      <div className="mt-auto shrink-0 w-full">
        {pageIndex < totalPages - 1 && (
          <div className="w-full text-right text-xs font-bold text-gray-600 mb-2">
            Continua na próxima página...
          </div>
        )}
        <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200 w-full">
          Documento gerado eletronicamente em{" "}
          {r.dataGeracao || new Date().toLocaleString("pt-BR")} - Página{" "}
          {pageIndex + 1} de {totalPages}
        </div>
      </div>
    </div>
  );
}

function ExtratoDocument({ extrato }: { extrato: Extrato }) {
  const filename = getExtratoFilename(extrato);
  const pages = paginateExtrato(extrato);

  return (
    <div
      className="extrato-document flex flex-col mx-auto mb-10"
      style={{ width: 794 }}
      data-filename={filename}
    >
      {pages.map((page, pIdx) => (
        <div key={pIdx}>
          <ExtratoPage
            extrato={extrato}
            page={page}
            pageIndex={pIdx}
            totalPages={pages.length}
          />
          {pIdx < pages.length - 1 && (
            <div className="html2pdf__page-break" />
          )}
        </div>
      ))}
    </div>
  );
}

function StatusPanel({ status }: { status: Status }) {
  if (status.state === "idle") return null;

  const colors = {
    loading: "bg-blue-50 text-blue-700 border-blue-200",
    progress: "bg-blue-50 text-blue-700 border-blue-200",
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    idle: "",
  };

  const pct =
    status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;

  return (
    <div className={`mt-6 p-4 rounded-md border transition-all duration-300 ${colors[status.state]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          {(status.state === "loading" || status.state === "progress") && (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status.state === "error" && (
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {status.state === "success" && (
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm font-semibold">{status.message}</span>
        </div>
        {status.total > 0 && (
          <span className="text-sm font-bold">
            {status.current} / {status.total} ({pct}%)
          </span>
        )}
      </div>
      {(status.state === "progress" || status.state === "success") && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${status.state === "success" ? "bg-green-600" : "bg-blue-600"}`}
            style={{ width: `${status.state === "success" ? 100 : pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ExtratoGenerator() {
  const { user, logout } = useAuth();
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [status, setStatus] = useState<Status>({
    state: "idle",
    message: "",
    current: 0,
    total: 0,
  });
  const [showWarning, setShowWarning] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "filter">("all");
  const [filterIds, setFilterIds] = useState("");
  const [renderedExtratos, setRenderedExtratos] = useState<Extrato[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setExtratos([]);
      setRenderedExtratos([]);
      setPreviewPage(1);
      setFilterMode("all");
      setFilterIds("");
      setShowWarning(false);

      if (!file) {
        setStatus({ state: "idle", message: "", current: 0, total: 0 });
        return;
      }

      setStatus({ state: "progress", message: "Carregando arquivo na memória...", current: 5, total: 100 });

      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = new Uint8Array(ev.target!.result as ArrayBuffer);
          setStatus({ state: "progress", message: "Analisando o Excel...", current: 25, total: 100 });
          await new Promise((r) => setTimeout(r, 50));

          let workbook;
          try {
            workbook = XLSX.read(data, { type: "array" });
          } catch {
            throw new Error("Formato de arquivo não suportado ou arquivo corrompido.");
          }

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("O arquivo não possui abas válidas.");
          }

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!worksheet) throw new Error("Aba principal vazia.");

          setStatus({ state: "progress", message: "Extraindo dados...", current: 50, total: 100 });
          await new Promise((r) => setTimeout(r, 50));

          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];
          const parsed = parseExtratos(rows);

          if (parsed.length === 0) {
            setStatus({
              state: "error",
              message: 'Nenhum "Extrato de Pagamentos" encontrado no arquivo.',
              current: 0,
              total: 0,
            });
            return;
          }

          setExtratos(parsed);
          setStatus({
            state: "success",
            message: `${parsed.length} extratos lidos e validados! Escolha uma opção de exportação.`,
            current: parsed.length,
            total: parsed.length,
          });
        } catch (error) {
          setStatus({
            state: "error",
            message: `Erro: ${(error as Error).message}`,
            current: 0,
            total: 0,
          });
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPDFs = useCallback(async () => {
    if (renderedExtratos.length === 0) return;

    setShowWarning(true);
    document.body.classList.add("exporting");
    try {

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const { createRoot } = await import("react-dom/client");

      const SCALE = 1.5;
      const CONCURRENCY = 1;
      let completed = 0;

      setStatus({
        state: "progress",
        message: "Preparando exportacao dos PDFs...",
        current: 0,
        total: renderedExtratos.length,
      });

    const processExtrato = async (extrato: Extrato) => {
      const mountNode = document.createElement("div");
      mountNode.style.position = "fixed";
      mountNode.style.left = "-100000px";
      mountNode.style.top = "0";
      mountNode.style.width = "794px";
      mountNode.style.opacity = "0";
      mountNode.style.pointerEvents = "none";
      mountNode.style.zIndex = "-1";
      document.body.appendChild(mountNode);

      const root = createRoot(mountNode);
      try {
        root.render(<ExtratoDocument extrato={extrato} />);
        await waitForNextFrame();
        await waitForNextFrame();
        await waitForImages(mountNode);

        const a4Pages = Array.from(
          mountNode.querySelectorAll(".a4-page"),
        ) as HTMLElement[];

        if (a4Pages.length === 0) {
          throw new Error("Nao foi possivel preparar o layout para exportacao.");
        }

        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        for (let i = 0; i < a4Pages.length; i++) {
          const page = a4Pages[i];
          const canvas = await html2canvas(page, {
            scale: SCALE,
            useCORS: true,
            logging: false,
            width: page.offsetWidth,
            height: page.offsetHeight,
            windowWidth: page.offsetWidth,
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }

        pdf.save(`${getExtratoFilename(extrato)}.pdf`);
      } finally {
        root.unmount();
        mountNode.remove();
      }

      completed++;
      setStatus({
        state: "progress",
        message: `Transferindo PDFs... (${completed}/${renderedExtratos.length})`,
        current: completed,
        total: renderedExtratos.length,
      });
    };

    for (let i = 0; i < renderedExtratos.length; i += CONCURRENCY) {
      const batch = renderedExtratos.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processExtrato));
      await new Promise((r) => setTimeout(r, 0));
    }

      setStatus({
        state: "success",
        message: `Transferencia concluida! ${renderedExtratos.length} PDFs baixados.`,
        current: renderedExtratos.length,
        total: renderedExtratos.length,
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: `Erro na geracao dos PDFs: ${(error as Error).message}`,
        current: 0,
        total: 0,
      });
    } finally {
      document.body.classList.remove("exporting");
      setTimeout(() => setShowWarning(false), 5000);
    }
  }, [renderedExtratos]);

  const hasExtratos = extratos.length > 0;

  const filteredExtratos = filterMode === "all" || !filterIds.trim()
    ? extratos
    : (() => {
        const ids = filterIds.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        return extratos.filter((e) =>
          ids.some((id) => id === String(e.idSap ?? "").trim())
        );
      })();

  const totalPreviewPages = Math.max(
    1,
    Math.ceil(renderedExtratos.length / PREVIEW_PAGE_SIZE),
  );
  const currentPreviewPage = Math.min(previewPage, totalPreviewPages);
  const previewStartIndex = (currentPreviewPage - 1) * PREVIEW_PAGE_SIZE;
  const previewEndIndex = Math.min(
    previewStartIndex + PREVIEW_PAGE_SIZE,
    renderedExtratos.length,
  );
  const visibleExtratos = renderedExtratos.slice(
    previewStartIndex,
    previewEndIndex,
  );

  return (
    <>
      <div className="max-w-5xl mx-auto mb-6 bg-white rounded-xl shadow-lg overflow-hidden no-print">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 via-green-700 to-green-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img
                  src="/assets/logo.png"
                  alt="Logo"
                  className="h-9 object-contain"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Extratos de Pagamentos
                </h2>
                <p className="text-green-200 text-sm mt-1">
                  Gerador em lote &middot; Formato A4
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-green-300 text-xs uppercase tracking-wider font-medium">Conectado como</p>
                <p className="text-white text-sm font-semibold truncate max-w-[220px]">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-all border border-white/20 hover:border-white/30"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-8">
          {/* Steps */}
          <div className="flex flex-col gap-5">
            {/* Step 1 - Upload */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-green-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">1</span>
                <span className="text-sm font-semibold text-gray-700">Selecione a Planilha (.xlsx, .csv)</span>
              </div>
              <input
                type="file"
                id="uploadExcel"
                accept=".xlsx,.xlsm,.xls,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              />
            </div>

            {/* Passo 2 - Filtro por ID SAP PJ */}
            {hasExtratos && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-green-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">2</span>
                  <span className="text-sm font-semibold text-gray-700">Selecionar Extratos</span>
                </div>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="radio"
                      name="filterMode"
                      checked={filterMode === "all"}
                      onChange={() => { setFilterMode("all"); setRenderedExtratos([]); setPreviewPage(1); }}
                      className="accent-green-600"
                    />
                    Todos ({extratos.length})
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="radio"
                      name="filterMode"
                      checked={filterMode === "filter"}
                      onChange={() => { setFilterMode("filter"); setRenderedExtratos([]); setPreviewPage(1); }}
                      className="accent-green-600"
                    />
                    Filtrar por ID SAP PJ
                  </label>
                </div>
                {filterMode === "filter" && (
                  <div>
                    <textarea
                      value={filterIds}
                      onChange={(e) => { setFilterIds(e.target.value); setRenderedExtratos([]); setPreviewPage(1); }}
                      placeholder={"Digite os IDs SAP PJ, um por linha ou separados por vírgula:\n12345\n67890\nou: 12345, 67890"}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {filteredExtratos.length} de {extratos.length} extrato(s) selecionado(s)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Passo 3 - Gerar em Tela */}
            {hasExtratos && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-green-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">3</span>
                  <span className="text-sm font-semibold text-gray-700">Gerar Layouts</span>
                </div>
                {renderedExtratos.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-green-700 font-semibold bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {renderedExtratos.length} extrato(s) prontos. Mostrando {previewStartIndex + 1}-{previewEndIndex} em tela.
                    </div>
                    <button
                      onClick={() => { setRenderedExtratos([]); setGenerating(false); setPreviewPage(1); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Limpar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setGenerating(true);
                      await new Promise((r) => setTimeout(r, 50));
                      setPreviewPage(1);
                      setRenderedExtratos(filteredExtratos);
                      setTimeout(() => setGenerating(false), 100);
                    }}
                    disabled={filteredExtratos.length === 0 || generating}
                    className="bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2.5 px-6 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {generating ? (
                      <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Gerando layouts...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Gerar {filteredExtratos.length} extrato(s) em tela
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Passo 4 - Ações */}
            {renderedExtratos.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-lg inline-flex items-center justify-center transition-all shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  <span>Imprimir em Tela ({visibleExtratos.length})</span>
                </button>

                <button
                  onClick={handleDownloadPDFs}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-5 rounded-lg inline-flex items-center justify-center transition-all shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Baixar PDFs Individuais ({renderedExtratos.length})</span>
                </button>
              </div>
            )}
          </div>

        {showWarning && (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-yellow-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-semibold">
                  Atenção: O sistema iniciará a transferência de vários arquivos em sequência.
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  Se o navegador bloquear o download de <strong>múltiplos arquivos</strong>, clique em <strong>Permitir</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <StatusPanel status={status} />
        </div>
      </div>

      {renderedExtratos.length > PREVIEW_PAGE_SIZE && (
        <div className="max-w-5xl mx-auto mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 no-print flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando {previewStartIndex + 1}-{previewEndIndex} de {renderedExtratos.length} extratos.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              disabled={currentPreviewPage <= 1}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Pagina {currentPreviewPage} de {totalPreviewPages}
            </span>
            <button
              onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
              disabled={currentPreviewPage >= totalPreviewPages}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Proxima
            </button>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-10">
        {renderedExtratos.length === 0 ? (
          <div className="max-w-4xl mx-auto bg-white p-12 shadow-md rounded border border-gray-200 text-center text-gray-500 no-print">
            {extratos.length === 0
              ? "Nenhum dado carregado. Faça o upload do arquivo acima."
              : "Selecione os extratos e clique em \"Gerar em tela\" para visualizar."}
          </div>
        ) : (
          visibleExtratos.map((ext, i) => (
            <ExtratoDocument key={`${previewStartIndex}-${i}`} extrato={ext} />
          ))
        )}
      </div>
    </>
  );
}
