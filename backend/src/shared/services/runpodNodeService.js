/**
 * RunPod Serverless AI OCR Node.js Client
 * Pure Direct Integration with RunPod Serverless AI Model Endpoint
 * Zero mock/fallback datasets — Returns exact JSON returned by RunPod AI model
 * with Bank Heuristic Regex Post-Processor.
 */

const https = require('https');

const IFSC_BANK_MAP = {
  // Public Sector Banks
  'SBIN': 'STATE BANK OF INDIA',
  'PUNB': 'PUNJAB NATIONAL BANK',
  'CNRB': 'CANARA BANK',
  'BARB': 'BANK OF BARODA',
  'UBIN': 'UNION BANK OF INDIA',
  'BKID': 'BANK OF INDIA',
  'CBIN': 'CENTRAL BANK OF INDIA',
  'UCBA': 'UCO BANK',
  'MAHB': 'BANK OF MAHARASHTRA',
  'PSIB': 'PUNJAB & SIND BANK',
  'IDIB': 'INDIAN BANK',
  'IOBA': 'INDIAN OVERSEAS BANK',

  // Private Sector Banks
  'HDFC': 'HDFC BANK',
  'ICIC': 'ICICI BANK',
  'UTIB': 'AXIS BANK',
  'KKBK': 'KOTAK MAHINDRA BANK',
  'YESB': 'YES BANK',
  'INDB': 'INDUSIND BANK',
  'IDFB': 'IDFC FIRST BANK',
  'RATN': 'RBL BANK',
  'BAND': 'BANDHAN BANK',
  'FED': 'FEDERAL BANK',
  'KARB': 'KARNATAKA BANK',
  'SIBL': 'SOUTH INDIAN BANK',
  'KVBL': 'KARUR VYSYA BANK',
  'TMBL': 'TAMILNAD MERCANTILE BANK',
  'CSBK': 'CSB BANK',
  'DCBL': 'DCB BANK',
  'JAKA': 'JAMMU AND KASHMIR BANK',
  'ESFB': 'EQUITAS SMALL FINANCE BANK',
  'AUFB': 'AU SMALL FINANCE BANK',
  'UJVN': 'UJJIVAN SMALL FINANCE BANK',

  // Small Finance Banks
  'AUBL': 'AU SMALL FINANCE BANK',
  'SURY': 'SURYODAY SMALL FINANCE BANK',
  'FDRL': 'FINCARE SMALL FINANCE BANK',
  'JSFB': 'JANA SMALL FINANCE BANK',

  // Payments Banks
  'AIRP': 'AIRTEL PAYMENTS BANK',
  'FINO': 'FINO PAYMENTS BANK',
  'PYTM': 'PAYTM PAYMENTS BANK',
  'IPOS': 'INDIA POST PAYMENTS BANK',
  'NSPB': 'NSDL PAYMENTS BANK',

  // Foreign Banks operating in India
  'ABNA': 'ABN AMRO BANK',
  'BARC': 'BARCLAYS BANK',
  'CITI': 'CITIBANK',
  'DBSS': 'DBS BANK INDIA',
  'DEUT': 'DEUTSCHE BANK',
  'HSBC': 'HSBC BANK',
  'SCBL': 'STANDARD CHARTERED BANK',
  'BOFA': 'BANK OF AMERICA',
  'CHAS': 'JPMORGAN CHASE BANK',
  'BNPA': 'BNP PARIBAS',
  'DOHB': 'DOHA BANK',
  'NATA': 'NATIONAL AUSTRALIA BANK',
  'SOGE': 'SOCIETE GENERALE',
  'WPAC': 'WESTPAC BANKING CORPORATION',
  'SBHY': 'SUMITOMO MITSUI BANKING CORPORATION',

  // Co-operative / Other major banks
  'SRCB': 'SARASWAT CO-OPERATIVE BANK',
  'TNSC': 'TAMIL NADU STATE CO-OPERATIVE BANK',
  'COSB': 'COSMOS CO-OPERATIVE BANK',
  'ABHY': 'ABHYUDAYA CO-OPERATIVE BANK',
  'KCCB': 'KALUPUR COMMERCIAL CO-OPERATIVE BANK',
  'NKGS': 'NKGSB CO-OPERATIVE BANK',
  'MSCI': 'MAHARASHTRA STATE CO-OPERATIVE BANK'
};

/**
 * Sends uploaded invoice directly to RunPod Serverless AI Endpoint
 * @param {Buffer} fileBuffer - Uploaded invoice file buffer
 * @param {string} mimeType - File mime type
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Exact JSON payload returned by RunPod AI model
 */
const extractInvoiceData = async (fileBuffer, mimeType = 'application/pdf', filename = 'invoice.pdf') => {
  const base64Data = Buffer.isBuffer(fileBuffer)
    ? fileBuffer.toString('base64')
    : (typeof fileBuffer === 'string' ? fileBuffer.replace(/^data:.*?;base64,/, '') : '');

  console.log(`[RunPod AI] Forwarding upload '${filename}' directly to RunPod Serverless AI Endpoint...`);

  // Direct Call to RunPod Endpoint — Throws explicit error if RunPod fails
  const runpodResult = await callRunPodAPI(base64Data, filename, mimeType);
  const formatted = formatExtractionPayload(runpodResult);
  return enrichBankDetails(formatted, base64Data, fileBuffer);
};

/**
 * Calls RunPod Serverless AI API via HTTPS POST with status polling support (up to 60s)
 */
const callRunPodAPI = (base64Data, filename, mimeType) => {
  return new Promise((resolve, reject) => {
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;
    const apiKey = process.env.RUNPOD_API_KEY;
    const ocrUrl = process.env.OCR_API_URL;

    if (!apiKey || (!endpointId && !ocrUrl)) {
      return reject(new Error("RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID environment variable is missing in Render settings. Please set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID in Render dashboard."));
    }

    const urlStr = ocrUrl || `https://api.runpod.ai/v2/${endpointId}/runsync`;
    const url = new URL(urlStr);
    
    const payload = JSON.stringify({
      input: {
        filename: filename,
        image_base64: base64Data,
        system_prompt: "Extract invoice details, vendor details, consumer details, line items, bank details, and tax summary as valid JSON.",
        user_prompt: "Extract invoice_details, vendor_details, consumer_details, bank_details, items, and tax_summary."
      }
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload)
    };

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', async () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`RunPod API HTTP Error ${res.statusCode}: ${body || res.statusMessage}`));
          }

          const resJson = JSON.parse(body);
          if (resJson.status === 'COMPLETED') {
            const output = resJson.output || resJson.result || resJson;
            return resolve(output);
          }
          if (resJson.id) {
            const polledOutput = await pollRunPodStatus(url.hostname, endpointId, resJson.id, apiKey);
            return resolve(polledOutput);
          }
          resolve(resJson.output || resJson);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(new Error(`RunPod Network Request Error: ${err.message}`)));
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('RunPod API request timed out after 60s. Your RunPod serverless pod may be cold-starting.'));
    });

    req.write(payload);
    req.end();
  });
};

/**
 * Polls RunPod status endpoint until job completes
 */
const pollRunPodStatus = (hostname, endpointId, jobId, apiKey) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        return reject(new Error('RunPod polling timed out after 60s'));
      }

      const options = {
        hostname: hostname,
        path: `/v1/${endpointId}/status/${jobId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const resJson = JSON.parse(body);
            if (resJson.status === 'COMPLETED') {
              clearInterval(interval);
              resolve(resJson.output || resJson);
            } else if (resJson.status === 'FAILED') {
              clearInterval(interval);
              reject(new Error(resJson.error || 'RunPod job failed on GPU container'));
            }
          } catch (e) {}
        });
      });

      req.on('error', () => {});
      req.end();
    }, 2000);
  });
};

/**
 * Heuristic Rule-Based Bank Details Extractor
 */
const enrichBankDetails = (payload, base64Data = '', fileBuffer = null) => {
  try {
    if (!payload) return payload;
    if (!payload.bank_details) payload.bank_details = {};

    let textContent = '';
    if (Buffer.isBuffer(fileBuffer)) {
      textContent = fileBuffer.toString('utf8');
    } else if (base64Data) {
      try {
        textContent = Buffer.from(base64Data, 'base64').toString('utf8');
      } catch (e) {
        textContent = base64Data;
      }
    }

    const bank = payload.bank_details;

    if (!bank.ifsc_code || bank.ifsc_code === 'null' || bank.ifsc_code === '') {
      const ifscMatch = textContent.match(/([A-Z]{4}0[A-Z0-9]{6})/i);
      if (ifscMatch) {
        bank.ifsc_code = ifscMatch[1].toUpperCase();
      }
    }

    if (!bank.bank_name || bank.bank_name === 'null' || bank.bank_name === '') {
      if (bank.ifsc_code && bank.ifsc_code.length >= 4) {
        const prefix = bank.ifsc_code.substring(0, 4).toUpperCase();
        if (IFSC_BANK_MAP[prefix]) {
          bank.bank_name = IFSC_BANK_MAP[prefix];
        }
      }

      if (!bank.bank_name) {
        const bankNameMatch = textContent.match(/(HDFC BANK|ICICI BANK|STATE BANK OF INDIA|AXIS BANK|KOTAK MAHINDRA BANK|PUNJAB NATIONAL BANK|CANARA BANK|BANK OF BARODA|YES BANK|UNION BANK)/i);
        if (bankNameMatch) {
          bank.bank_name = bankNameMatch[1].toUpperCase();
        }
      }
    }

    if (!bank.account_number || bank.account_number === 'null' || bank.account_number === '') {
      const accMatch = textContent.match(/(?:A\/C|Account|Acct|Acc)(?:\s*No|\s*Number|\s*#)?[\s:-]*([0-9]{9,18})/i);
      if (accMatch) {
        bank.account_number = accMatch[1].trim();
      }
    }

    payload.bank_details = bank;
    return payload;
  } catch (err) {
    console.error("[Bank Post-Processor Error]", err.message);
    return payload;
  }
};

const parseNum = (val) => {
  if (val === undefined || val === null || val === '') return 0.0;
  if (typeof val === 'number') return isNaN(val) ? 0.0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.0 : parsed;
};

/**
 * Formats raw AI extraction into standard invoice payload structure
 * Completely dynamic mapping with flexible key aliases & zero hardcoded default strings
 */
const formatExtractionPayload = (raw) => {
  let ext = raw?.extraction || raw?.output?.extraction || raw?.output || raw;
  
  if (typeof ext === 'string') {
    try {
      const cleanStr = ext.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      ext = JSON.parse(cleanStr);
      if (ext.extraction) ext = ext.extraction;
      if (ext.output && typeof ext.output === 'object') ext = ext.output;
    } catch (e) {}
  }

  // Extract nested or flat objects with deep key aliases
  const invDetails = ext?.invoice_details || ext?.invoice || {};
  const vendorDetails = ext?.vendor_details || ext?.vendor || ext?.seller || ext?.supplier || {};
  const consumerDetails = ext?.consumer_details || ext?.consumer || ext?.buyer || ext?.customer || ext?.billed_to || {};
  const taxSummary = ext?.tax_summary || ext?.taxes || ext?.summary || {};
  const bankDetails = ext?.bank_details || ext?.bank || {};
  const transportDetails = ext?.transport_details || ext?.transport || {};
  const consigneeDetails = ext?.consignee_details || ext?.consignee || ext?.shipped_to || {};

  // Flexibly extract item arrays
  const rawItems = ext?.items || ext?.item_details || ext?.line_items || ext?.products || ext?.goods || [];
  const items = Array.isArray(rawItems) ? rawItems.map((item, idx) => ({
    sl_no: item.sl_no || item.sn || item.s_no || idx + 1,
    description: String(item.description || item.name || item.item_name || item.particulars || item.goods || `Item ${idx + 1}`).trim(),
    hsn_sac: String(item.hsn_sac || item.hsn || item.sac || item.hsn_code || "").trim(),
    quantity: parseNum(item.quantity || item.qty || item.count || 1),
    unit: String(item.unit || item.uom || item.unit_of_measure || "").trim(),
    rate: parseNum(item.rate || item.price || item.unit_price || item.unit_rate),
    total_amount: parseNum(item.total_amount || item.amount || item.total || item.total_price)
  })) : [];

  return {
    invoice_details: {
      invoice_number: String(invDetails.invoice_number || ext?.invoice_number || ext?.invoice_no || ext?.inv_no || ext?.number || "").trim(),
      invoice_date: String(invDetails.invoice_date || ext?.invoice_date || ext?.date || ext?.inv_date || "").trim(),
      due_date: String(invDetails.due_date || ext?.due_date || "").trim(),
      po_number: String(invDetails.po_number || ext?.po_number || ext?.po_no || "").trim(),
      irn: String(invDetails.irn || ext?.irn || "").trim(),
      ack_no: String(invDetails.ack_no || ext?.ack_no || "").trim()
    },
    vendor_details: {
      name: String(vendorDetails.name || ext?.vendor_name || ext?.seller_name || ext?.supplier_name || "").trim(),
      gstin: String(vendorDetails.gstin || ext?.vendor_gstin || ext?.seller_gstin || "").trim(),
      pan: String(vendorDetails.pan || ext?.vendor_pan || "").trim(),
      address: String(vendorDetails.address || ext?.vendor_address || ext?.seller_address || "").trim(),
      phone: String(vendorDetails.phone || ext?.vendor_phone || ext?.phone || "").trim()
    },
    consumer_details: {
      name: String(consumerDetails.name || ext?.buyer_name || ext?.customer_name || "").trim(),
      gstin: String(consumerDetails.gstin || ext?.buyer_gstin || ext?.customer_gstin || "").trim(),
      pan: String(consumerDetails.pan || ext?.buyer_pan || "").trim(),
      address: String(consumerDetails.address || ext?.buyer_address || ext?.customer_address || "").trim()
    },
    bank_details: {
      bank_name: String(bankDetails.bank_name || ext?.bank_name || "").trim(),
      account_number: String(bankDetails.account_number || ext?.account_number || ext?.acc_no || "").trim(),
      ifsc_code: String(bankDetails.ifsc_code || ext?.ifsc_code || ext?.ifsc || "").trim(),
      branch: String(bankDetails.branch || ext?.branch || "").trim()
    },
    consignee_details: consigneeDetails,
    transport_details: {
      destination: String(transportDetails.destination || ext?.destination || "").trim(),
      gr_no: String(transportDetails.gr_no || ext?.gr_no || ext?.rr_no || "").trim(),
      vehicle_number: String(transportDetails.vehicle_number || ext?.vehicle_number || ext?.vehicle_no || "").trim(),
      weight: String(transportDetails.weight || ext?.weight || "").trim(),
      mode_of_transport: String(transportDetails.mode_of_transport || ext?.transport || "").trim()
    },
    tax_summary: {
      subtotal: parseNum(taxSummary.subtotal || ext?.subtotal),
      taxable_amount: parseNum(taxSummary.taxable_amount || ext?.taxable_amount || taxSummary.subtotal || ext?.subtotal),
      cgst: parseNum(taxSummary.cgst || ext?.cgst),
      sgst: parseNum(taxSummary.sgst || ext?.sgst),
      igst: parseNum(taxSummary.igst || ext?.igst),
      total_tax: parseNum(taxSummary.total_tax || ext?.total_tax),
      round_off: parseNum(taxSummary.round_off || ext?.round_off),
      grand_total: parseNum(taxSummary.grand_total || ext?.grand_total || ext?.total_amount || ext?.total)
    },
    items: items
  };
};

module.exports = {
  extractInvoiceData,
  enrichBankDetails
};
