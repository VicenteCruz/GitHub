/**
 * Parses Continente OCR and PDF text into structured JSON format.
 */
export function parseReceiptText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  const receipt = {
    id: `RECEIPT_${Date.now()}`,
    date: new Date().toISOString(),
    store: 'Continente',
    totalPaid: 0,
    totalDiscounts: 0,
    subtotal: 0,
    items: []
  };

  let currentCategory = 'Outros';
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract ID and Date (Handles "Nro:FS ARU..." or "Nro: FS...")
    const idMatch = line.match(/Nro:\s*(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
    if (idMatch) {
      receipt.id = idMatch[1].replace(/[\s/]+/g, '_');
      const [day, month, year] = idMatch[2].split('/');
      receipt.date = `${year}-${month}-${day}T${idMatch[3]}:00`;
      continue;
    }

    // Extract Store Name
    if (line.includes('MODELO CONTINENTE') || line.includes('CONTINENTE HIPERMERCADOS')) {
      if (receipt.store === 'Continente') {
        const potentialStore = lines[Math.max(0, i - 1)];
        if (potentialStore && !potentialStore.includes('CONTINENTE')) {
          receipt.store = `Continente ${potentialStore}`;
        }
      }
    }

    // Extract Totals
    const totalMatch = line.match(/TOTAL A PAGAR\s*([\d]+,[\d]{2})/i);
    if (totalMatch) {
      receipt.totalPaid = parseFloat(totalMatch[1].replace(',', '.'));
      continue;
    }

    const subtotalMatch = line.match(/SUBTOTAL\s*([\d]+,[\d]{2})/i);
    if (subtotalMatch) {
      receipt.subtotal = parseFloat(subtotalMatch[1].replace(',', '.'));
      continue;
    }

    const discountMatch = line.match(/Total de descontos e poupancas\s*([\d]+,[\d]{2})/i);
    if (discountMatch) {
      receipt.totalDiscounts = parseFloat(discountMatch[1].replace(',', '.'));
      continue;
    }

    // Detect Category
    if (line.endsWith(':') && !line.includes('IVA') && !line.includes('NIF')) {
      currentCategory = line.replace(':', '').trim();
      continue;
    }

    // Detect Items
    // Example: (A)PENSO DIARIO CAREFREE ALOE 56UN 4,89
    // Example: (A)BIFE BEIJINHO ANGUS SKP 
    const itemStartMatch = line.match(/^\(([A-Z]{1,2})\)\s*(.+?)\s+([\d]+,[\d]{2})$/);
    const itemStartNoPriceMatch = line.match(/^\(([A-Z]{1,2})\)\s*(.+)$/);
    
    if (itemStartMatch) {
      const name = itemStartMatch[2];
      // Ignore VAT lines matching exactly like 6,00%...
      if (name.match(/^\d+,\d{2}%/)) continue;

      if (currentItem) receipt.items.push(currentItem);
      
      currentItem = {
        name: name,
        category: currentCategory,
        price: parseFloat(itemStartMatch[3].replace(',', '.')),
        discount: 0,
        quantity: 1
      };
      continue;
    } else if (itemStartNoPriceMatch && !itemStartNoPriceMatch[2].match(/\s+[\d]+,[\d]{2}$/)) {
      const name = itemStartNoPriceMatch[2];
      // Ignore VAT lines
      if (name.match(/^\d+,\d{2}%/)) continue;

      if (currentItem) receipt.items.push(currentItem);
      
      currentItem = {
        name: name,
        category: currentCategory,
        price: 0,
        discount: 0,
        quantity: 1
      };
      
      // Look ahead for price (e.g. "2 X 4,498,98" or "0,534 KG 1,991,06" or just "2 X 4,49")
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        
        const qtyMatch = nextLine.match(/^(\d+)\s*[xX]\s+/i);
        if (qtyMatch) {
          currentItem.quantity = parseInt(qtyMatch[1], 10);
        }

        // Try to match double merged price like "4,498,98" -> $1="4,49" $2="8,98"
        const doublePriceMatch = nextLine.match(/(\d+,\d{2})(\d+,\d{2})$/);
        if (doublePriceMatch) {
          currentItem.price = parseFloat(doublePriceMatch[2].replace(',', '.'));
          if (nextLine.match(/x|X|kg|KG/i)) i++;
        } else {
          const singlePriceMatch = nextLine.match(/([\d]+,[\d]{2})$/);
          if (singlePriceMatch) {
            currentItem.price = parseFloat(singlePriceMatch[1].replace(',', '.'));
            if (nextLine.match(/x|X|kg|KG/i)) i++;
          }
        }
      }
      continue;
    }

    // Detect Discounts on current item
    if (currentItem && (line.includes('POUPANCA') || line.includes('DESCONTO') || line.includes('ACUMULA EM CARTAO'))) {
      const discMatch = line.match(/([\d]+,[\d]{2})$/);
      if (discMatch) {
        currentItem.discount += parseFloat(discMatch[1].replace(',', '.'));
      }
      continue;
    }
  }

  if (currentItem) {
    receipt.items.push(currentItem);
  }

  // Fallback to calculate subtotal and discounts if missing
  if (receipt.totalPaid === 0 && receipt.items.length > 0) {
    receipt.totalPaid = receipt.items.reduce((acc, item) => acc + item.price, 0);
  }
  if (receipt.totalDiscounts === 0 && receipt.items.length > 0) {
    receipt.totalDiscounts = receipt.items.reduce((acc, item) => acc + item.discount, 0);
  }
  if (receipt.subtotal === 0 && receipt.items.length > 0) {
    receipt.subtotal = receipt.items.reduce((acc, item) => acc + item.price, 0);
  }

  // Validation Check
  const calculatedSum = receipt.items.reduce((acc, item) => acc + item.price, 0);
  const targetTotal = receipt.subtotal > 0 ? receipt.subtotal : receipt.totalPaid;
  const diff = targetTotal - calculatedSum;
  
  if (Math.abs(diff) > 0.05) {
    // Se faltarem cêntimos (até 1 euro), normalmente são sacos ou taras que não têm o prefixo (A)
    if (diff > 0 && diff <= 1.00) {
      receipt.items.push({
        name: "Saco/Tara (Recuperação Automática)",
        category: "Outros",
        price: Number(diff.toFixed(2)),
        discount: 0
      });
      receipt.validationError = false;
    } else {
      receipt.validationError = true;
    }
  } else {
    receipt.validationError = false;
  }

  return receipt;
}
