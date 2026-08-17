import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { parseReceiptText } from './src/utils/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Setup multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

const DATA_FILE = path.join(__dirname, 'src', 'data', 'receipts.json');

// Read receipts from JSON file
function readReceipts() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading receipts data:', error);
    return [];
  }
}

// Write receipts to JSON file
function writeReceipts(receipts) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(receipts, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing receipts data:', error);
  }
}

// GET all receipts
app.get('/api/receipts', (req, res) => {
  const receipts = readReceipts();
  res.json(receipts);
});

// POST new receipt from raw text
app.post('/api/receipts', (req, res) => {
  const { rawText } = req.body;
  
  if (!rawText) {
    return res.status(400).json({ error: 'Raw text is required' });
  }

  // Tentar interpretar como JSON (caso seja vindo de um Agente IA noutra loja)
  try {
    let jsonStr = rawText.trim();
    // Remover blocos de código markdown se existirem (```json ... ```)
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const aiParsed = JSON.parse(jsonStr);
    if (aiParsed.items && Array.isArray(aiParsed.items)) {
      // É um recibo em formato JSON
      if (!aiParsed.id) aiParsed.id = `RECEIPT_AI_${Date.now()}`;
      if (!aiParsed.date) aiParsed.date = new Date().toISOString();
      if (!aiParsed.store) aiParsed.store = 'Loja Desconhecida';
      
      const receipts = readReceipts();
      
      // Check duplicate
      const exists = receipts.find(r => r.id === aiParsed.id);
      if (exists) {
        return res.status(409).json({ error: 'Receipt already exists', receipt: exists });
      }

      receipts.push(aiParsed);
      writeReceipts(receipts);
      
      return res.status(201).json(aiParsed);
    }
  } catch (e) {
    // Não é um JSON válido, continuar com o parser normal de texto do Continente
  }

  processReceiptText(rawText, res);
});

// POST new receipt from PDF upload(s)
app.post('/api/receipts/upload', upload.array('receiptPdfs'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No PDF files uploaded' });
  }

  const receipts = readReceipts();
  const results = {
    successful: 0,
    failed: 0,
    duplicates: 0,
    errors: []
  };

  for (const file of req.files) {
    try {
      // Parse PDF buffer to text
      const data = await pdfParse(file.buffer);
      const rawText = data.text;
      
      // DEBUG: save the first parsed PDF text to a file so I can analyze the exact structure
      if (results.successful === 0 && results.failed === 0) {
        fs.writeFileSync(path.join(__dirname, 'last_pdf_text.txt'), rawText);
      }
      
      const parsedReceipt = parseReceiptText(rawText);
      
      if (!parsedReceipt.items || parsedReceipt.items.length === 0) {
        throw new Error('Sem artigos - ignorado (provavelmente carregamento de saldo)');
      }
      
      // Check if receipt already exists
      const exists = receipts.find(r => r.id === parsedReceipt.id);
      if (exists) {
        results.duplicates++;
        continue;
      }

      receipts.push(parsedReceipt);
      results.successful++;
    } catch (error) {
      console.error(`Error parsing PDF ${file.originalname}:`, error);
      results.failed++;
      results.errors.push(`Failed to read ${file.originalname}`);
    }
  }

  if (results.successful > 0) {
    writeReceipts(receipts);
  }

  res.status(200).json(results);
});

// Helper function to process the text and send response
function processReceiptText(rawText, res) {
  try {
    const parsedReceipt = parseReceiptText(rawText);
    
    if (!parsedReceipt.items || parsedReceipt.items.length === 0) {
      return res.status(400).json({ error: 'Fatura sem artigos - ignorado (carregamento de saldo)' });
    }

    const receipts = readReceipts();
    
    // Check if receipt already exists
    const exists = receipts.find(r => r.id === parsedReceipt.id);
    if (exists) {
      return res.status(409).json({ error: 'Receipt already exists', receipt: exists });
    }

    receipts.push(parsedReceipt);
    writeReceipts(receipts);

    res.status(201).json(parsedReceipt);
  } catch (error) {
    console.error('Error parsing receipt text:', error);
    res.status(500).json({ error: 'Failed to parse receipt. Ensure it is a valid Continente OCR/PDF.' });
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
