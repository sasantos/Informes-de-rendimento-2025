export interface ExtratoRow {
  [key: string]: string | number;
}

export interface Adiantamento {
  mes: string;
  tons: string;
  total: string;
}

export interface Faturamento {
  cnpj: string;
  data: string;
  tons: string;
  faturamento: string;
  funrural: string;
}

export interface FaturamentoTotal {
  tons: string;
  faturamento: string;
  funrural: string;
}

export interface Recebedor {
  cpf: string;
  nome: string;
  tons: string;
  total: string;
}

export interface TotalRow {
  tons: string;
  total: string;
}

export interface Extrato {
  dataInicio?: string;
  dataFim?: string;
  dataGeracao?: string;
  empresa?: string;
  empresaCnpj?: string;
  ano?: string;
  idSap?: string;
  produtor?: string;
  produtorCnpj?: string;
  contratos: string[];
  adiantamentos: Adiantamento[];
  adiantamentosTotal?: TotalRow;
  faturamentos: Faturamento[];
  faturamentosTotal?: FaturamentoTotal;
  recebedores: Recebedor[];
  recebedoresTotal?: TotalRow;
}

export interface PageData {
  adiantamentos: Adiantamento[];
  showAdiantamentosTotal: boolean;
  faturamentos: Faturamento[];
  showFaturamentosTotal: boolean;
  recebedores: Recebedor[];
  showRecebedoresTotal: boolean;
  isLast: boolean;
}

export function formatExcelDate(val: string | number | undefined | null, isDateTime = false): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 90000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    if (isDateTime || num % 1 !== 0) {
      const frac = num - Math.floor(num);
      const totalSeconds = Math.round(86400 * frac);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }
    return `${day}/${month}/${year}`;
  }
  if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = val.split(" ")[0].split("-");
    const time = val.includes(" ") ? " " + val.split(" ")[1] : "";
    return `${parts[2]}/${parts[1]}/${parts[0]}${isDateTime && time ? time : ""}`;
  }
  return String(val);
}

export function formatMoney(val: string | number | undefined): string {
  if (!val || val === "-" || val === "") return "-";
  const num = parseFloat(String(val).replace(",", "."));
  return isNaN(num)
    ? String(val)
    : num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTons(val: string | number | undefined): string {
  if (!val || val === "-" || val === "") return "-";
  const num = parseFloat(String(val).replace(",", "."));
  return isNaN(num)
    ? String(val)
    : num.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function parseExtratos(rows: (string | number)[][]): Extrato[] {
  const extratos: Extrato[] = [];
  let rel: Extrato | null = null;
  let mode = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const cells = row
      .map((c) => (c !== undefined && c !== null ? String(c).trim() : ""))
      .filter((c) => c !== "");
    if (cells.length === 0) continue;

    const rowStr = cells.join(" ");

    if (rowStr.includes("Extrato de Pagamentos")) {
      if (rel) extratos.push(rel);
      rel = { adiantamentos: [], faturamentos: [], recebedores: [], contratos: [] };
      mode = "";
      continue;
    }

    if (!rel) continue;

    if (cells.includes("De") && cells.includes("a")) {
      rel.dataInicio = formatExcelDate(cells[cells.indexOf("De") + 1]);
      rel.dataFim = formatExcelDate(cells[cells.indexOf("a") + 1]);
      rel.dataGeracao = formatExcelDate(cells[cells.length - 1], true);
    } else if (rowStr.includes("Empresa Pagadora:")) {
      const idx1 = cells.indexOf("Empresa Pagadora:");
      const idx2 = cells.indexOf("CNPJ/MF Pagadora:");
      if (idx1 !== -1 && idx2 !== -1) {
        rel.empresa = cells.slice(idx1 + 1, idx2).join(" ").replace(/^,+|,+$/g, "");
        rel.empresaCnpj = cells.slice(idx2 + 1).join(" ").replace(/^,+|,+$/g, "");
      }
    } else if (rowStr.includes("Ano-base:")) {
      const idx1 = cells.indexOf("Ano-base:");
      const idx2 = cells.findIndex((c) => c.includes("ID SAP PJ") || c.includes("ID SAR PJ"));
      if (idx1 !== -1) rel.ano = cells[idx1 + 1];
      if (idx2 !== -1) rel.idSap = cells.slice(idx2 + 1).join(" ").replace(/^,+|,+$/g, "");
    } else if (rowStr.includes("Produtor Rural Títular:") || rowStr.includes("Produtor Rural Titular:")) {
      const idx1 = cells.findIndex((c) => c.includes("Produtor Rural"));
      const idx2 = cells.findIndex((c) => c.includes("CNPJ/MF Produtor") || c.includes("CPF/MF Produtor"));
      if (idx1 !== -1 && idx2 !== -1) {
        rel.produtor = cells.slice(idx1 + 1, idx2).join(" ").replace(/^,+|,+$/g, "");
        rel.produtorCnpj = cells.slice(idx2 + 1).join(" ").replace(/^,+|,+$/g, "");
      }
    } else if (cells[0] === "Contratos") {
      mode = "contratos";
    } else if (cells[0] === "Adiantamentos") {
      mode = "adiantamentos";
    } else if (cells[0] === "Faturamento") {
      mode = "faturamento";
    } else if (cells[0] === "Recebedores") {
      mode = "recebedores";
    } else if (mode === "contratos") {
      if (cells[0] && cells[0].startsWith("PARC-")) rel.contratos.push(cells[0]);
    } else if (mode === "adiantamentos") {
      if (cells.includes("Total:")) {
        rel.adiantamentosTotal = { tons: cells[cells.length - 2], total: cells[cells.length - 1] };
      } else if (cells[0] !== "Data" && cells.length >= 3) {
        rel.adiantamentos.push({ mes: formatExcelDate(cells[0]), tons: cells[cells.length - 2], total: cells[cells.length - 1] });
      }
    } else if (mode === "faturamento") {
      if (cells.includes("Total:")) {
        rel.faturamentosTotal = {
          tons: cells[cells.length - 3],
          faturamento: cells[cells.length - 2],
          funrural: cells[cells.length - 1],
        };
      } else if (!cells[0].includes("CNPJ") && cells[0] !== "Data" && cells.length >= 4) {
        rel.faturamentos.push({
          cnpj: cells[0],
          data: formatExcelDate(cells[1]),
          tons: cells[cells.length - 3],
          faturamento: cells[cells.length - 2],
          funrural: cells[cells.length - 1],
        });
      }
    } else if (mode === "recebedores") {
      if (cells.includes("Total:")) {
        rel.recebedoresTotal = { tons: cells[cells.length - 2] !== "Total:" ? cells[cells.length - 2] : "-", total: cells[cells.length - 1] };
      } else if (cells[0] !== "CPF" && cells.length >= 2) {
        const isCpfFormat = /\d/.test(cells[0]) && cells[0].length >= 10;
        rel.recebedores.push({
          cpf: isCpfFormat ? cells[0] : "-",
          nome: isCpfFormat ? cells.slice(1, cells.length - 2).join(" ") : cells.slice(0, cells.length - 2).join(" "),
          tons: cells[cells.length - 2],
          total: cells[cells.length - 1],
        });
      }
    }
  }
  if (rel) extratos.push(rel);
  return extratos;
}

export function paginateExtrato(r: Extrato): PageData[] {
  const pages: PageData[] = [];
  const adiantamentos = [...r.adiantamentos];
  const faturamentos = [...r.faturamentos];
  const recebedores = [...r.recebedores];
  const MAX_ROWS = 22;

  while (true) {
    const pageAdiantamentos: Adiantamento[] = [];
    const pageFaturamentos: Faturamento[] = [];
    const pageRecebedores: Recebedor[] = [];
    let currentRowCount = 0;

    if (adiantamentos.length > 0) {
      currentRowCount += 4;
      const take = Math.max(1, MAX_ROWS - currentRowCount);
      pageAdiantamentos.push(...adiantamentos.splice(0, take));
      currentRowCount += pageAdiantamentos.length;
    }

    if (faturamentos.length > 0 && currentRowCount < MAX_ROWS) {
      currentRowCount += 4;
      const take = Math.max(1, MAX_ROWS - currentRowCount);
      pageFaturamentos.push(...faturamentos.splice(0, take));
      currentRowCount += pageFaturamentos.length;
    }

    if (recebedores.length > 0 && currentRowCount < MAX_ROWS) {
      currentRowCount += 4;
      const take = Math.max(1, MAX_ROWS - currentRowCount);
      pageRecebedores.push(...recebedores.splice(0, take));
    }

    const isLast = adiantamentos.length === 0 && faturamentos.length === 0 && recebedores.length === 0;

    pages.push({
      adiantamentos: pageAdiantamentos,
      showAdiantamentosTotal: adiantamentos.length === 0 && pageAdiantamentos.length > 0,
      faturamentos: pageFaturamentos,
      showFaturamentosTotal: faturamentos.length === 0 && pageFaturamentos.length > 0,
      recebedores: pageRecebedores,
      showRecebedoresTotal: recebedores.length === 0 && pageRecebedores.length > 0,
      isLast,
    });

    if (isLast) break;
  }
  return pages;
}
