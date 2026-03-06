function formatExcelDate(val, isDateTime = false) {
  if (!val) return "";
  let num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 90000) {
    let date = new Date(Math.round((num - 25569) * 86400 * 1000));
    let day = String(date.getUTCDate()).padStart(2, "0");
    let month = String(date.getUTCMonth() + 1).padStart(2, "0");
    let year = date.getUTCFullYear();
    if (isDateTime || num % 1 !== 0) {
      let frac = num - Math.floor(num);
      let totalSeconds = Math.round(86400 * frac);
      let hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      let minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
        2,
        "0",
      );
      let seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }
    return `${day}/${month}/${year}`;
  }
  if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    let parts = val.split(" ")[0].split("-");
    let time = val.includes(" ") ? " " + val.split(" ")[1] : "";
    return `${parts[2]}/${parts[1]}/${parts[0]}${isDateTime && time ? time : ""}`;
  }
  return val;
}

function formatMoney(val) {
  if (!val || val === "-" || val === "") return "-";
  let num = parseFloat(String(val).replace(",", "."));
  return isNaN(num)
    ? val
    : num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

function formatTons(val) {
  if (!val || val === "-" || val === "") return "-";
  let num = parseFloat(String(val).replace(",", "."));
  return isNaN(num)
    ? val
    : num.toLocaleString("pt-BR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
}

function setStatus(state, message, current = 0, total = 0) {
  const panel = document.getElementById("statusPanel");
  const text = document.getElementById("statusText");
  const count = document.getElementById("statusCount");
  const wrapper = document.getElementById("progressWrapper");
  const bar = document.getElementById("progressBar");
  const iconSpinner = document.getElementById("statusIconSpinner");
  const iconAlert = document.getElementById("statusIconAlert");
  const iconSuccess = document.getElementById("statusIconSuccess");

  panel.classList.remove(
    "hidden",
    "bg-blue-50",
    "text-blue-700",
    "border-blue-200",
    "bg-red-50",
    "text-red-700",
    "border-red-200",
    "bg-green-50",
    "text-green-700",
    "border-green-200",
  );
  iconSpinner.classList.add("hidden");
  iconAlert.classList.add("hidden");
  iconSuccess.classList.add("hidden");
  wrapper.classList.add("hidden");

  text.innerText = message;

  if (total > 0) {
    const pct = Math.round((current / total) * 100);
    count.innerText = `${current} / ${total} (${pct}%)`;
  } else {
    count.innerText = "";
  }

  if (state === "loading") {
    panel.classList.add("bg-blue-50", "text-blue-700", "border-blue-200");
    iconSpinner.classList.remove("hidden");
    iconSpinner.classList.add("text-blue-600");
  } else if (state === "progress") {
    panel.classList.add("bg-blue-50", "text-blue-700", "border-blue-200");
    iconSpinner.classList.remove("hidden");
    iconSpinner.classList.add("text-blue-600");
    wrapper.classList.remove("hidden");
    bar.style.width = `${total > 0 ? Math.round((current / total) * 100) : 0}%`;
    bar.classList.replace("bg-green-600", "bg-blue-600");
  } else if (state === "error") {
    panel.classList.add("bg-red-50", "text-red-700", "border-red-200");
    iconAlert.classList.remove("hidden");
  } else if (state === "success") {
    panel.classList.add(
      "bg-green-50",
      "text-green-700",
      "border-green-200",
    );
    iconSuccess.classList.remove("hidden");
    wrapper.classList.remove("hidden");
    bar.style.width = "100%";
    bar.className =
      "bg-green-600 h-2.5 rounded-full transition-all duration-300";
  }
}

document
  .getElementById("uploadExcel")
  .addEventListener("change", async function (e) {
    const file = e.target.files[0];
    const btnPrint = document.getElementById("btnPrint");
    const btnDownload = document.getElementById("btnDownloadInd");
    const container = document.getElementById("documentos-container");

    btnPrint.disabled = true;
    btnDownload.disabled = true;
    document.getElementById("downloadWarning").classList.add("hidden");
    container.innerHTML = "";

    if (!file) {
      document.getElementById("statusPanel").classList.add("hidden");
      return;
    }

    setStatus("progress", "Carregando arquivo na memória...", 5, 100);

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        await new Promise((r) => setTimeout(r, 50));
        const data = new Uint8Array(e.target.result);
        setStatus(
          "progress",
          "Analisando o Excel (pode levar alguns segundos)...",
          25,
          100,
        );

        await new Promise((r) => setTimeout(r, 50));

        let workbook;
        try {
          workbook = XLSX.read(data, { type: "array" });
        } catch (readErr) {
          throw new Error(
            "Formato de arquivo não suportado ou arquivo corrompido.",
          );
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("O arquivo não possui abas válidas.");
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
          throw new Error("Aba principal vazia.");
        }

        setStatus("progress", "Extraindo dados brutos...", 50, 100);
        await new Promise((r) => setTimeout(r, 50));
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let extratos = [];
        let rel = null;
        let mode = "";
        const chunkSize = 1000;

        for (let i = 0; i < rows.length; i++) {
          if (i % chunkSize === 0) {
            setStatus(
              "progress",
              "Lendo e agrupando dados...",
              i,
              rows.length,
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          let row = rows[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          let cells = row
            .map((c) =>
              c !== undefined && c !== null ? String(c).trim() : "",
            )
            .filter((c) => c !== "");
          if (cells.length === 0) continue;

          let rowStr = cells.join(" ");

          if (rowStr.includes("Extrato de Pagamentos")) {
            if (rel) extratos.push(rel);
            rel = {
              adiantamentos: [],
              faturamentos: [],
              recebedores: [],
              contratos: [],
            };
            mode = "";
            continue;
          }

          if (!rel) continue;

          if (cells.includes("De") && cells.includes("a")) {
            rel.dataInicio = formatExcelDate(
              cells[cells.indexOf("De") + 1],
            );
            rel.dataFim = formatExcelDate(cells[cells.indexOf("a") + 1]);
            rel.dataGeracao = formatExcelDate(
              cells[cells.length - 1],
              true,
            );
          } else if (rowStr.includes("Empresa Pagadora:")) {
            let idx1 = cells.indexOf("Empresa Pagadora:");
            let idx2 = cells.indexOf("CNPJ/MF Pagadora:");
            if (idx1 !== -1 && idx2 !== -1) {
              rel.empresa = cells
                .slice(idx1 + 1, idx2)
                .join(" ")
                .replace(/^,+|,+$/g, "");
              rel.empresaCnpj = cells
                .slice(idx2 + 1)
                .join(" ")
                .replace(/^,+|,+$/g, "");
            }
          } else if (rowStr.includes("Ano-base:")) {
            let idx1 = cells.indexOf("Ano-base:");
            let idx2 = cells.findIndex(
              (c) => c.includes("ID SAP PJ") || c.includes("ID SAR PJ"),
            );
            if (idx1 !== -1) rel.ano = cells[idx1 + 1];
            if (idx2 !== -1)
              rel.idSap = cells
                .slice(idx2 + 1)
                .join(" ")
                .replace(/^,+|,+$/g, "");
          } else if (
            rowStr.includes("Produtor Rural Títular:") ||
            rowStr.includes("Produtor Rural Titular:")
          ) {
            let idx1 = cells.findIndex((c) =>
              c.includes("Produtor Rural"),
            );
            let idx2 = cells.findIndex(
              (c) =>
                c.includes("CNPJ/MF Produtor") ||
                c.includes("CPF/MF Produtor"),
            );
            if (idx1 !== -1 && idx2 !== -1) {
              rel.produtor = cells
                .slice(idx1 + 1, idx2)
                .join(" ")
                .replace(/^,+|,+$/g, "");
              rel.produtorCnpj = cells
                .slice(idx2 + 1)
                .join(" ")
                .replace(/^,+|,+$/g, "");
            }
          } else if (cells[0] === "Contratos") {
            mode = "contratos";
            continue;
          } else if (cells[0] === "Adiantamentos") {
            mode = "adiantamentos";
            continue;
          } else if (cells[0] === "Faturamento") {
            mode = "faturamento";
            continue;
          } else if (cells[0] === "Recebedores") {
            mode = "recebedores";
            continue;
          } else if (mode === "contratos") {
            if (cells[0] && cells[0].startsWith("PARC-"))
              rel.contratos.push(cells[0]);
          } else if (mode === "adiantamentos") {
            if (cells.includes("Total:")) {
              rel.adiantamentosTotal = {
                tons: cells[cells.length - 2],
                total: cells[cells.length - 1],
              };
            } else if (cells[0] !== "Data" && cells.length >= 3) {
              rel.adiantamentos.push({
                mes: formatExcelDate(cells[0]),
                tons: cells[cells.length - 2],
                total: cells[cells.length - 1],
              });
            }
          } else if (mode === "faturamento") {
            if (cells.includes("Total:")) {
              rel.faturamentosTotal = {
                tons: cells[cells.length - 2],
                total: cells[cells.length - 1],
              };
            } else if (cells[0] !== "Data" && cells.length >= 4) {
              rel.faturamentos.push({
                data: formatExcelDate(cells[0]),
                cnpj: cells[1],
                tons: cells[cells.length - 2],
                total: cells[cells.length - 1],
              });
            }
          } else if (mode === "recebedores") {
            if (cells.includes("Total:")) {
              rel.recebedoresTotal = {
                tons:
                  cells[cells.length - 2] !== "Total:"
                    ? cells[cells.length - 2]
                    : "-",
                total: cells[cells.length - 1],
              };
            } else if (cells[0] !== "CPF" && cells.length >= 2) {
              let isCpfFormat =
                /\d/.test(cells[0]) && cells[0].length >= 10;
              rel.recebedores.push({
                cpf: isCpfFormat ? cells[0] : "-",
                nome: isCpfFormat
                  ? cells.slice(1, cells.length - 2).join(" ")
                  : cells.slice(0, cells.length - 2).join(" "),
                tons: cells[cells.length - 2],
                total: cells[cells.length - 1],
              });
            }
          }
        }
        if (rel) extratos.push(rel);

        if (extratos.length === 0) {
          setStatus(
            "error",
            'Ops! O arquivo parece estar vazio ou fora do padrão. Não encontramos nenhum "Extrato de Pagamentos".',
          );
          return;
        }

        await renderHTML(extratos);

        setStatus(
          "success",
          `${extratos.length} extratos lidos e validados! Escolha uma opção de exportação.`,
        );
        btnPrint.disabled = false;
        btnDownload.disabled = false;
      } catch (error) {
        console.error("Erro ao ler dados:", error);
        setStatus(
          "error",
          `Erro na leitura: ${error.message}. Dica: Tente salvar o arquivo como .xlsx e envie novamente.`,
        );
      }
    };
    reader.readAsArrayBuffer(file);
  });

function paginateExtrato(r) {
  let pages = [];
  let adiantamentos = r.adiantamentos ? [...r.adiantamentos] : [];
  let faturamentos = r.faturamentos ? [...r.faturamentos] : [];
  let recebedores = r.recebedores ? [...r.recebedores] : [];

  const MAX_ROWS = 22;

  while (true) {
    let pageAdiantamentos = [];
    let pageFaturamentos = [];
    let pageRecebedores = [];
    let currentRowCount = 0;

    if (adiantamentos.length > 0) {
      currentRowCount += 4;
      let take = Math.max(1, MAX_ROWS - currentRowCount);
      let chunk = adiantamentos.splice(0, take);
      pageAdiantamentos.push(...chunk);
      currentRowCount += chunk.length;
    }

    if (faturamentos.length > 0 && currentRowCount < MAX_ROWS) {
      currentRowCount += 4;
      let take = Math.max(1, MAX_ROWS - currentRowCount);
      let chunk = faturamentos.splice(0, take);
      pageFaturamentos.push(...chunk);
      currentRowCount += chunk.length;
    }

    if (recebedores.length > 0 && currentRowCount < MAX_ROWS) {
      currentRowCount += 4;
      let take = Math.max(1, MAX_ROWS - currentRowCount);
      let chunk = recebedores.splice(0, take);
      pageRecebedores.push(...chunk);
      currentRowCount += chunk.length;
    }

    let isLast =
      adiantamentos.length === 0 &&
      faturamentos.length === 0 &&
      recebedores.length === 0;

    pages.push({
      adiantamentos: pageAdiantamentos,
      showAdiantamentosTotal:
        adiantamentos.length === 0 && pageAdiantamentos.length > 0,
      faturamentos: pageFaturamentos,
      showFaturamentosTotal:
        faturamentos.length === 0 && pageFaturamentos.length > 0,
      recebedores: pageRecebedores,
      showRecebedoresTotal:
        recebedores.length === 0 && pageRecebedores.length > 0,
      isLast: isLast,
    });

    if (isLast) break;
  }
  return pages;
}

async function renderHTML(extratos) {
  const container = document.getElementById("documentos-container");
  container.innerHTML = "";

  const renderChunkSize = 20;

  for (let i = 0; i < extratos.length; i += renderChunkSize) {
    setStatus(
      "progress",
      "Construindo pré-visualização na tela...",
      i,
      extratos.length,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    let allHtml = "";
    const end = Math.min(i + renderChunkSize, extratos.length);

    for (let j = i; j < end; j++) {
      const r = extratos[j];
      const safeId = String(r.idSap || "SEM_ID")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();
      const safeProdutor = String(r.produtor || "SEM_NOME")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();
      const nomeArquivo = `${safeId}_${safeProdutor}`;

      const pages = paginateExtrato(r);

      allHtml += `<div class="extrato-document flex flex-col mx-auto mb-10" style="width: 794px;" data-filename="${nomeArquivo}">`;

      pages.forEach((page, pIdx) => {
        let msgContinua =
          pIdx < pages.length - 1
            ? `<div class="w-full text-right text-xs font-bold text-gray-600 mb-2">Continua na próxima página...</div>`
            : "";

        allHtml += `
                  <div class="a4-page">
                      <!-- Cabeçalho -->
                      <div class="flex justify-between items-center border-b-2 border-green-600 pb-4 mb-6 shrink-0">
                          <div>
                              <img src="./assets/logo.png" alt="Tereos" class="h-10 object-contain">
                          </div>
                          <div class="text-right">
                              <h2 class="text-xl font-bold uppercase text-gray-700 flex items-center justify-end">
                                  Extrato de Pagamentos - Pág. ${pIdx + 1} de ${pages.length}
                              </h2>
                              <p class="text-sm text-gray-500">De ${r.dataInicio || ""} a ${r.dataFim || ""}</p>
                          </div>
                      </div>

                      <!-- Informações Gerais -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm shrink-0">
                          <div>
                              <p><span class="font-bold">Empresa Pagadora:</span> ${r.empresa || "-"}</p>
                              <p><span class="font-bold">CNPJ/MF Pagadora:</span> ${r.empresaCnpj || "-"}</p>
                          </div>
                          <div class="sm:text-right">
                              <p><span class="font-bold">Ano:</span> ${r.ano || "-"}</p>
                              <p><span class="font-bold">ID SAP PJ:</span> ${r.idSap || "-"}</p>
                          </div>
                      </div>

                      <div class="bg-gray-50 p-3 rounded border border-gray-200 mb-6 text-sm shrink-0">
                          <p><span class="font-bold">Produtor Rural Titular:</span> ${r.produtor || "-"}</p>
                          <p><span class="font-bold">CNPJ/MF Produtor Rural:</span> ${r.produtorCnpj || "-"}</p>
                          <p><span class="font-bold mt-1 inline-block">Contratos:</span> ${r.contratos.join(", ") || "-"}</p>
                      </div>

                      <div class="flex-grow">
                          ${renderTable("Adiantamentos", ["Data/Mês", "Tons", "Total (R$)"], page.adiantamentos, page.showAdiantamentosTotal ? r.adiantamentosTotal : null)}
                          ${renderTable("Faturamento", ["Data", "CNPJ Filial", "Qt. Tons", "Faturamento Bruto"], page.faturamentos, page.showFaturamentosTotal ? r.faturamentosTotal : null)}
                          ${renderTable("Recebedores", ["CPF/CNPJ", "Nome", "Tons", "Valor (R$)"], page.recebedores, page.showRecebedoresTotal ? r.recebedoresTotal : null)}
                      </div>

                      <div class="mt-auto shrink-0 w-full">
                          ${msgContinua}
                          <div class="text-xs text-gray-400 text-center pt-4 border-t border-gray-200 w-full">
                              Documento gerado eletronicamente em ${r.dataGeracao || new Date().toLocaleString("pt-BR")} - Página ${pIdx + 1} de ${pages.length}
                          </div>
                      </div>
                  </div>
                  `;

        if (pIdx < pages.length - 1) {
          allHtml += `<div class="html2pdf__page-break"></div>`;
        }
      });

      allHtml += `</div>`;
    }
    container.insertAdjacentHTML("beforeend", allHtml);
  }
}

function renderTable(title, headers, rows, total) {
  if (!rows || rows.length === 0) return "";
  let thead = headers
    .map(
      (h, i) =>
        `<th class="border border-gray-300 p-2 font-semibold ${i > headers.length - 3 ? "text-right" : ""}">${h}</th>`,
    )
    .join("");
  let tbody = rows
    .map((row, index) => {
      let cells = Object.values(row)
        .map((val, i) => {
          let isNumberStr = i > Object.keys(row).length - 3;
          let formattedVal = isNumberStr
            ? i === Object.keys(row).length - 1
              ? formatMoney(val)
              : formatTons(val)
            : val;
          return `<td class="border border-gray-300 p-2 ${isNumberStr ? "text-right" : ""}">${formattedVal}</td>`;
        })
        .join("");
      return `<tr class="${index % 2 !== 0 ? "bg-gray-50" : ""}">${cells}</tr>`;
    })
    .join("");
  let tfoot = "";
  if (total) {
    let colspan = headers.length - 2;
    tfoot = `<tfoot class="bg-green-100 font-bold"><tr><td class="border border-gray-300 p-2 text-right" colspan="${colspan}">Total</td><td class="border border-gray-300 p-2 text-right">${formatTons(total.tons)}</td><td class="border border-gray-300 p-2 text-right">${formatMoney(total.total)}</td></tr></tfoot>`;
  }
  return `<div class="mb-4"><h3 class="text-md font-bold text-green-700 mb-1 border-b border-gray-300 pb-1">${title}</h3><div class="overflow-hidden"><table class="w-full text-xs text-left border-collapse border border-gray-300"><thead class="bg-gray-200 text-gray-700"><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table></div></div>`;
}

async function downloadIndividualPDFs() {
  const cards = document.querySelectorAll(".extrato-document");
  if (cards.length === 0) return;
  const btnPrint = document.getElementById("btnPrint");
  const btnDownload = document.getElementById("btnDownloadInd");
  btnPrint.disabled = true;
  btnDownload.disabled = true;
  document.getElementById("downloadWarning").classList.remove("hidden");
  document.body.classList.add("exporting");
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const filename = card.getAttribute("data-filename") + ".pdf";
    setStatus(
      "progress",
      `Transferindo PDF (${filename})...`,
      i + 1,
      cards.length,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: "jpeg", quality: 1.0 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    await html2pdf().set(opt).from(card).save();
  }
  document.body.classList.remove("exporting");
  setStatus(
    "success",
    `Transferência concluída! Foram baixados ${cards.length} PDFs.`,
  );
  setTimeout(() => {
    document.getElementById("downloadWarning").classList.add("hidden");
  }, 5000);
  btnPrint.disabled = false;
  btnDownload.disabled = false;
}
