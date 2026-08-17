/**
 * Normaliza o nome do produto para remover pesos, volumes e aromas específicos,
 * de forma a agrupar diferentes variantes (ex: Morango vs Lavanda) sob o mesmo histórico base.
 */
export const normalizeName = (name) => {
  if (!name) return "";
  
  let clean = name.replace(/\b(\d+(?:[.,]\d+)?\s*(?:KG|G|ML|CL|L|UN|DOSE|M|F|R|X|PACK|ROLOS)\b)/gi, '');
  clean = clean.replace(/\b(CNT|MP|CONTINENTE)\b/gi, '');
  clean = clean.replace(/\b(MOR|LAV|LIMAO|MACA|CANELA|MORANGO|LAVANDA|ORIGINAL|CLASSICO)\b/gi, '');
  const words = clean.trim().split(/\s+/).filter(w => w.length > 0);
  return words.join(' ').toUpperCase();
};

/**
 * Encontra o grupo mais semelhante com base na similaridade de Jaccard das palavras.
 * "Quando mais palavras são iguais, assumes que são os mesmos."
 */
export const findBestGroupMatch = (baseName, existingGroups) => {
  if (!existingGroups || existingGroups.length === 0) return baseName;
  
  const wordsA = baseName.split(' ');
  let bestMatch = null;
  let highestScore = 0;
  
  for (const group of existingGroups) {
    const wordsB = group.split(' ');
    
    const setB = new Set(wordsB);
    let intersection = 0;
    for (const w of wordsA) {
      if (setB.has(w)) intersection++;
    }
    
    const union = wordsA.length + wordsB.length - intersection;
    const score = intersection / union; // Similaridade de Jaccard
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = group;
    }
  }
  
  // Limiar de 0.75 agrupa coisas com alta sobreposição (ex: "VT PERA DOCE REG ALENT" e "VT PERA DOCE ALENT")
  // mas separa coisas distintas (ex: "VT PERA DOCE REG ALENT" e "VT PERA DOCE RES ALENT")
  if (highestScore >= 0.75) {
    return bestMatch;
  }
  
  return baseName;
};

/**
 * Extrai a capacidade e unidade de um nome original de produto.
 * Ex: "QUEIJO BRIE 200G" -> { value: 200, unit: 'G', raw: '200G' }
 */
export const extractCapacity = (name) => {
  if (!name) return null;
  const match = name.match(/\b(\d+(?:[.,]\d+)?)\s*(KG|G|ML|CL|L|UN|DOSE|M|F|R|X|PACK|ROLOS)\b/i);
  if (match) {
    let numericStr = match[1].replace(',', '.');
    return {
      value: parseFloat(numericStr),
      unit: match[2].toUpperCase(),
      raw: match[0].toUpperCase()
    };
  }
  return null;
};
