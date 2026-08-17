import React, { useMemo } from 'react';
import { normalizeName, extractCapacity, findBestGroupMatch } from '../utils/helpers';

const ShrinkflationAlert = ({ receipts }) => {
  const shrinkflationItems = useMemo(() => {
    if (!receipts || receipts.length === 0) return [];

    const productHistory = {};
    const sortedReceipts = [...receipts].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedReceipts.forEach(receipt => {
      receipt.items.forEach(item => {
        if (item.name.includes('(Recuperação Automática)')) return;
        
        const rawBaseName = normalizeName(item.name);
        const capacity = extractCapacity(item.name);
        
        if (!rawBaseName || !capacity) return;

        const baseName = findBestGroupMatch(rawBaseName, Object.keys(productHistory));

        if (!productHistory[baseName]) {
          productHistory[baseName] = {
            baseName,
            firstCapacity: capacity,
            lastCapacity: capacity,
            firstName: item.name,
            lastName: item.name
          };
        } else {
          // Atualiza a última capacidade conhecida
          productHistory[baseName].lastCapacity = capacity;
          productHistory[baseName].lastName = item.name;
        }
      });
    });

    const detected = [];

    Object.values(productHistory).forEach(prod => {
      // Se tiver a mesma unidade de medida mas o valor for menor, é reduflação!
      if (
        prod.firstCapacity.unit === prod.lastCapacity.unit &&
        prod.lastCapacity.value < prod.firstCapacity.value
      ) {
        // Reduflação confirmada
        const diff = prod.firstCapacity.value - prod.lastCapacity.value;
        const percentLoss = (diff / prod.firstCapacity.value) * 100;
        
        // Evitar falsos positivos muito pequenos (ex: 200g para 195g) a menos que seja drástico.
        // Assumimos alerta se for mais de 5% de corte
        if (percentLoss >= 5) {
          detected.push({
            ...prod,
            percentLoss
          });
        }
      }
    });

    return detected.sort((a, b) => b.percentLoss - a.percentLoss);
  }, [receipts]);

  if (shrinkflationItems.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', height: '100%' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Radar de Reduflação
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Sem alarmes! Não detetámos diminuição de quantidades disfarçadas nos produtos que costuma comprar.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', height: '100%' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        Alerta de Reduflação (Shrinkflation)
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Detetámos marcas que reduziram o peso da embalagem, cobrando o mesmo ou mais.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {shrinkflationItems.map((item, idx) => (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontWeight: '600', color: '#f8fafc', marginBottom: '0.25rem', fontSize: '0.95rem' }}>{item.baseName}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ textDecoration: 'line-through', marginRight: '0.5rem' }}>{item.firstCapacity.raw}</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.lastCapacity.raw}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>
                -{item.percentLoss.toFixed(0)}% Produto
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShrinkflationAlert;
