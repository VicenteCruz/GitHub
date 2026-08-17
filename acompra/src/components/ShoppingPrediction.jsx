import React, { useState, useMemo } from 'react';
import { normalizeName, findBestGroupMatch } from '../utils/helpers';

const ShoppingPrediction = ({ receipts }) => {
  const predictionDays = 30; // Previsão para os próximos 30 dias
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { predictedItems } = useMemo(() => {
    if (!receipts || receipts.length === 0) return { predictedItems: [] };

    const allDates = receipts.map(r => new Date(r.date).getTime());
    const anchorDate = new Date(Math.max(...allDates));
    
    const targetDate = new Date(anchorDate);
    targetDate.setDate(targetDate.getDate() + predictionDays);

    const productStats = {};

    const sortedReceipts = [...receipts].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedReceipts.forEach(receipt => {
      const rDate = new Date(receipt.date).getTime();
      receipt.items.forEach(item => {
        if (item.name.includes('(Recuperação Automática)')) return;

        const rawBaseName = normalizeName(item.name);
        if (!rawBaseName) return;

        const baseName = findBestGroupMatch(rawBaseName, Object.keys(productStats));

        if (!productStats[baseName]) {
          productStats[baseName] = {
            name: baseName, // Mostra o nome limpo no UI (ex: "SACOS LIXO")
            originalNames: new Set(),
            purchases: [],
            category: item.category
          };
        }
        productStats[baseName].originalNames.add(item.name);
        productStats[baseName].purchases.push({
          time: rDate,
          qty: item.quantity || 1
        });
      });
    });

    const predicted = [];

    Object.values(productStats).forEach(prod => {
      if (prod.purchases.length >= 2) {
        // Agrupar compras do mesmo dia
        const daysMap = {};
        prod.purchases.forEach(p => {
          const dayStr = new Date(p.time).toISOString().split('T')[0];
          if (!daysMap[dayStr]) {
            daysMap[dayStr] = { time: new Date(dayStr).getTime(), qty: 0 };
          }
          daysMap[dayStr].qty += p.qty;
        });

        const uniqueDays = Object.values(daysMap).sort((a, b) => a.time - b.time);

        if (uniqueDays.length >= 2) {
          const firstPurchase = uniqueDays[0];
          const lastPurchase = uniqueDays[uniqueDays.length - 1];
          const totalSpanDays = (lastPurchase.time - firstPurchase.time) / (1000 * 60 * 60 * 24);
          
          // Unidades consumidas = Todas menos as da última compra (que estão a uso)
          let unitsConsumed = 0;
          for (let i = 0; i < uniqueDays.length - 1; i++) {
            unitsConsumed += uniqueDays[i].qty;
          }

          if (unitsConsumed > 0 && totalSpanDays > 0) {
            const avgDaysPerUnit = totalSpanDays / unitsConsumed;
            
            // Quando acaba o stock da última compra?
            const nextPurchaseTime = lastPurchase.time + (lastPurchase.qty * avgDaysPerUnit * 1000 * 60 * 60 * 24);
            const nextPurchase = new Date(nextPurchaseTime);

            if (nextPurchase <= targetDate) {
              const daysRemaining = Math.ceil((nextPurchase.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
              
              let urgencyLabel = "";
              let urgencyColor = "";
              if (daysRemaining <= 0) {
                urgencyLabel = "Em Atraso / Esgotado";
                urgencyColor = "#ef4444";
              } else if (daysRemaining <= 7) {
                urgencyLabel = `Nos próximos ${daysRemaining} dias`;
                urgencyColor = "#f59e0b";
              } else {
                urgencyLabel = `Daqui a ~${daysRemaining} dias`;
                urgencyColor = "#10b981";
              }

              predicted.push({
                ...prod,
                avgInterval: Math.round(avgDaysPerUnit),
                nextPurchase,
                daysRemaining,
                urgencyLabel,
                urgencyColor
              });
            }
          }
        }
      }
    });

    predicted.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return { predictedItems: predicted };
  }, [receipts, predictionDays]);

  if (predictedItems.length === 0) return null;

  // Agrupar itens previstos por categoria
  const groupedByCategory = predictedItems.reduce((acc, item) => {
    const cat = item.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Ordenar categorias (opcional, alfabeticamente)
  const allCategories = Object.keys(groupedByCategory).sort();
  const displayCategories = selectedCategory === 'All' 
    ? allCategories 
    : allCategories.filter(c => c === selectedCategory);

  return (
    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section-title" style={{ marginBottom: '0' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem', color: '#8b5cf6'}}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Lista de Compras (Próximos {predictionDays} dias)
        </h2>
        
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-secondary)', 
            padding: '0.5rem 1rem', 
            borderRadius: '0.5rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="All">Todas as Categorias</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {displayCategories.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum produto previsto para esta categoria.</p>
        )}
        {displayCategories.map((category) => (
          <div key={category}>
            <h3 style={{ fontSize: '1.1rem', color: '#cbd5e1', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              {category}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {groupedByCategory[category].map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '0.5rem', 
                  padding: '0.75rem 1rem',
                  borderLeft: `4px solid ${item.urgencyColor}`
                }}>
                  <div style={{ fontWeight: '500', fontSize: '1rem', color: '#f8fafc' }}>
                    {item.name}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Comprado a cada <strong style={{ color: '#cbd5e1' }}>~{item.avgInterval} dias</strong>
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: item.urgencyColor, 
                      fontWeight: 'bold',
                      background: `${item.urgencyColor}20`,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      minWidth: '150px',
                      textAlign: 'center'
                    }}>
                      {item.urgencyLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShoppingPrediction;
