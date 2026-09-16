# Azure AI Cost Compass

Azure AI Cost Compass is a static browser calculator for estimating Azure OpenAI-style model inference plus the Azure resources around the application. It accepts **input and output tokens per request**, request volume, model, region, currency, and supporting Azure resources.

## Run locally

Open `index.html` in a modern browser. No package install or build step is required. A local web server is recommended because browsers may restrict cross-origin API requests from `file://` pages:

```powershell
python -m http.server 8080
```

Then browse to `http://localhost:8080`.

## Use the calculator

1. Select an **Azure region** and **model**.
2. Enter monthly **requests**, average **input tokens/request**, and average **output tokens/request**. Input tokens include prompts, system messages, and retrieved context. Output tokens are generated completions.
3. Choose a display currency.
4. Add supporting resources such as App Service, Functions, Blob Storage, SQL Database, Cosmos DB, or Azure Monitor. Set quantities for each resource.
5. Review the monthly model-token cost, Azure-resource cost, total, annualized estimate, and token volume.

## Microsoft REST API integration

The app calls Microsoft's public [Azure Retail Prices API](https://prices.azure.com/) from `app.js`:

`https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&$filter=serviceName eq 'Azure OpenAI Service' and armRegionName eq '<region>'`

The response is mapped to model input/prompt and output/completion meters. The calculator uses rates per one million tokens. If no matching meter is returned, or the API is unavailable, it uses the visible fallback planning rates in `fallbackModels`. The status badge identifies whether live data or fallback values are active.

Azure Retail Prices is a public catalog, not a billing quote. Meter names and availability can change by model, deployment type, region, and API revision. Validate production estimates against the Azure Pricing Calculator and your Azure subscription pricing.

## Calculation

```text
input_tokens_month = requests_per_month × input_tokens_per_request
output_tokens_month = requests_per_month × output_tokens_per_request
model_cost = (input_tokens_month / 1,000,000 × input_price)
           + (output_tokens_month / 1,000,000 × output_price)
resource_cost = sum(resource_quantity × monthly_unit_price)
total = model_cost + resource_cost
```

Regional multipliers and display-currency conversion are applied to prices returned in USD. Resource prices are planning defaults and should be replaced with exact SKU meters for a production quote.

## GitHub Pages hosting

This is a static site and can be hosted with GitHub Pages:

1. Create a GitHub repository and copy these four files to its root.
2. Push the files to the default branch.
3. In **Settings → Pages**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
4. Open the generated Pages URL. Keep `USAGE.md` in the repository so users can understand the live-price fallback behavior.

The repository does not contain credentials. Do not add Azure keys, subscription secrets, or GitHub tokens to this client-side app.
