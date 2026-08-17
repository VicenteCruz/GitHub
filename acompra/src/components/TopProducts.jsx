import React, { useMemo } from 'react';
import { normalizeName, findBestGroupMatch } from '../utils/helpers';

const TopProducts = ({ receipts }) => {
  const { topByCost, topByQuantity } = useMemo(() => {
    const productsData = {};

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        // Ignorar recuperações automáticas do sistema
        if (item.name.includes('(Recuperação Automática)')) return;

        const rawBaseName = normalizeName(item.name);
        if (!rawBaseName) return;

        const baseName = findBestGroupMatch(rawBaseName, Object.keys(productsData));

        if (!productsData[baseName]) {
          productsData[baseName] = {
            name: baseName,
            totalCost: 0,
            quantity: 0,
            category: item.category || 'Outros'
          };
        }

        productsData[baseName].totalCost += item.price;
        productsData[baseName].quantity += 1;
      });
    });

    const productsArray = Object.values(productsData);

    const byCost = [...productsArray].sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);
    const byQuantity = [...productsArray].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    return { topByCost: byCost, topByQuantity: byQuantity };
  }, [receipts]);

  if (topByCost.length === 0) return null;

  return (
    <div className="top-products-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
      
      {/* Top por Custo */}
      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>💸</span> Os Maiores Gastos
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {topByCost.map((prod, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>{prod.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prod.quantity} unidades compradas</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>€{prod.totalCost.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top por Frequência */}
      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔁</span> Os Mais Comprados
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {topByQuantity.map((prod, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>{prod.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>€{prod.totalCost.toFixed(2)} no total</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>{prod.quantity} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)'}}>unid.</span></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default TopProducts;
