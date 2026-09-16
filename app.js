const fallbackModels = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-35-turbo": { input: 0.5, output: 1.5 }
};
const resourceCatalog = {
  appService: { name: "Azure App Service", detail: "Basic B1 · 1 instance", icon: "⌁", unit: "instance/month", price: 13.14 },
  functions: { name: "Azure Functions", detail: "Consumption · 1M executions", icon: "ϟ", unit: "million executions", price: 0.20 },
  blob: { name: "Blob Storage", detail: "Hot LRS · 100 GB", icon: "◈", unit: "100 GB/month", price: 1.84 },
  sql: { name: "Azure SQL Database", detail: "Basic · 5 DTUs", icon: "▤", unit: "database/month", price: 4.90 },
  cosmos: { name: "Azure Cosmos DB", detail: "Serverless · 10K RU/s", icon: "◉", unit: "database/month", price: 5.84 },
  monitor: { name: "Azure Monitor", detail: "Log Analytics · 5 GB", icon: "⌗", unit: "workspace/month", price: 11.50 }
};
const regionMultipliers = { eastus: 1, westeurope: 1.08, southeastasia: 1.04, uksouth: 1.11 };
const currencyRates = { USD: 1, EUR: .92, GBP: .78, INR: 83.2 };
const symbols = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
let modelPrices = structuredClone(fallbackModels);
let livePrices = false;
let resources = [{ id: 1, type: "appService", quantity: 1 }, { id: 2, type: "blob", quantity: 1 }];
let nextId = 3;
const $ = (id) => document.getElementById(id);
const money = (amount) => `${symbols[$("currency").value]}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const modelPrice = () => modelPrices[$("model").value] || fallbackModels[$("model").value];
const currentRate = (usd) => usd * currencyRates[$("currency").value] * regionMultipliers[$("region").value];
const tokenCost = () => {
  const inputTokens = Math.max(0, Number($("input-tokens").value) || 0) * Math.max(0, Number($("requests").value) || 0);
  const outputTokens = Math.max(0, Number($("output-tokens").value) || 0) * Math.max(0, Number($("requests").value) || 0);
  const price = modelPrice();
  return { inputTokens, outputTokens, total: currentRate(inputTokens / 1000000 * price.input + outputTokens / 1000000 * price.output) };
};
function resourceCost(line) { return currentRate(resourceCatalog[line.type].price * line.quantity); }
function renderResources() {
  $("empty-state").hidden = resources.length > 0;
  $("resource-list").innerHTML = resources.map((line) => {
    const item = resourceCatalog[line.type];
    return `<div class="service-row" data-id="${line.id}"><div class="service-name"><span class="service-icon">${item.icon}</span><div><strong>${item.name}</strong><small>${item.detail}</small></div></div><label>Quantity<input class="quantity" type="number" min="0" step="1" value="${line.quantity}" aria-label="${item.name} quantity"></label><div class="row-cost"><strong>${money(currentRate(item.price))}</strong><small>/ ${item.unit}</small></div><div class="row-cost"><strong>${money(resourceCost(line))}</strong><small>/ month</small></div><button class="remove" type="button" aria-label="Remove ${item.name}">×</button></div>`;
  }).join("");
  $("resource-list").querySelectorAll(".quantity").forEach((input) => input.addEventListener("input", (event) => {
    const row = resources.find((resource) => resource.id === Number(event.target.closest(".service-row").dataset.id));
    row.quantity = Math.max(0, Number(event.target.value) || 0); update();
  }));
  $("resource-list").querySelectorAll(".remove").forEach((button) => button.addEventListener("click", (event) => {
    resources = resources.filter((resource) => resource.id !== Number(event.target.closest(".service-row").dataset.id)); update();
  }));
}
function update() {
  const tokens = tokenCost();
  const resourceTotal = resources.reduce((sum, line) => sum + resourceCost(line), 0);
  const total = tokens.total + resourceTotal;
  $("total-cost").textContent = money(total);
  $("annual-cost").textContent = `or ${money(total * 12)} annually`;
  $("token-total").textContent = money(tokens.total);
  $("resource-total").textContent = money(resourceTotal);
  $("token-volume").textContent = (tokens.inputTokens + tokens.outputTokens).toLocaleString();
  $("input-output").textContent = (Number($("input-tokens").value) || 0).toLocaleString();
  $("output-output").textContent = (Number($("output-tokens").value) || 0).toLocaleString();
  $("confidence-label").textContent = livePrices ? "Live price data" : "Fallback planning rates";
  renderResources();
}
function addResource() {
  const types = Object.keys(resourceCatalog);
  const used = new Set(resources.map((item) => item.type));
  resources.push({ id: nextId++, type: types.find((type) => !used.has(type)) || types[0], quantity: 1 }); update();
}
async function loadPrices() {
  const region = $("region").value;
  const filter = encodeURIComponent(`contains(meterName, 'GPT') and armRegionName eq '${region}'`);
  try {
    const response = await fetch(`https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&$filter=${filter}`);
    if (!response.ok) throw new Error(`Pricing API returned ${response.status}`);
    const items = (await response.json()).Items || [];
    const next = structuredClone(fallbackModels);
    items.forEach((item) => {
      const text = `${item.meterName || ""} ${item.productName || ""}`.toLowerCase();
      const model = Object.keys(next).find((key) => text.includes(key.replace("-", " "))) || Object.keys(next).find((key) => text.includes(key));
      const isOutput = /output|completion/.test(text);
      const isInput = /input|prompt/.test(text);
      const unitFactor = String(item.unitOfMeasure || "").toLowerCase() === "1k" ? 1000 : 1000000;
      if (model && (isInput || isOutput) && item.unitPrice > 0) next[model][isOutput ? "output" : "input"] = item.unitPrice * (1000000 / unitFactor);
    });
    modelPrices = next; livePrices = items.length > 0;
    $("api-status").innerHTML = `<span class="status-dot"></span>${livePrices ? "Live prices loaded" : "Fallback rates"}`;
  } catch (error) {
    livePrices = false;
    $("api-status").innerHTML = '<span class="status-dot warning"></span>Fallback rates';
  }
  update();
}
["region", "model", "currency", "requests", "input-tokens", "output-tokens"].forEach((id) => $(id).addEventListener("input", () => { update(); if (id === "region") loadPrices(); }));
$("add-resource").addEventListener("click", addResource);
$("reset").addEventListener("click", () => { resources = []; $("requests").value = 100000; $("input-tokens").value = 1000; $("output-tokens").value = 500; $("region").value = "eastus"; $("currency").value = "USD"; update(); loadPrices(); });
update();
loadPrices();
