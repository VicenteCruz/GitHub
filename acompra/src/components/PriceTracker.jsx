import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { normalizeName, findBestGroupMatch } from '../utils/helpers';

const PriceTracker = ({ receipts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const productHistory = useMemo(() => {
    const history = {};
    const sortedReceipts = [...receipts].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedReceipts.forEach(receipt => {
      // Usar a data amigável
      const dateObj = new Date(receipt.date);
      const day = dateObj.getDate().toString().padStart(2, '0');
      const monthStr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][dateObj.getMonth()];
      const year = dateObj.getFullYear();
      const displayDate = `${day} ${monthStr} ${year}`;
      const sortKey = receipt.date.split('T')[0];

      receipt.items.forEach(item => {
        if (item.name.includes('(Recuperação Automática)')) return;
        
        const rawBaseName = normalizeName(item.name);
        if (!rawBaseName) return;

        const baseName = findBestGroupMatch(rawBaseName, Object.keys(history));

        if (!history[baseName]) {
          history[baseName] = {
            baseName,
            originalNames: new Set(),
            dataPoints: []
          };
        }
        history[baseName].originalNames.add(item.name);
        
        // O preço lido no recibo é o total daquela linha. 
        // Para termos o preço unitário correto no histórico, dividimos pela quantidade.
        const unitPrice = item.price / (item.quantity || 1);
        
        history[baseName].dataPoints.push({
          date: displayDate,
          sortKey: sortKey,
          price: Number(unitPrice.toFixed(2)),
          originalName: item.name
        });
      });
    });

    return history;
  }, [receipts]);

  // Resultados da pesquisa
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return Object.values(productHistory)
      .filter(p => 
        p.baseName.toLowerCase().includes(term) || 
        Array.from(p.originalNames).some(n => n.toLowerCase().includes(term))
      )
      .sort((a, b) => b.dataPoints.length - a.dataPoints.length) // Mostrar os comprados mais frequentemente primeiro
      .slice(0, 5);
  }, [searchTerm, productHistory]);

  // Top Movers (Maiores Subidas e Descidas)
  const topMovers = useMemo(() => {
    const products = Object.values(productHistory).filter(p => p.dataPoints.length >= 2);
    const analyzed = products.map(p => {
      // Ordenar por data cronologicamente
      const sortedPoints = [...p.dataPoints].sort((a, b) => new Date(a.sortKey) - new Date(b.sortKey));
      const firstPrice = sortedPoints[0].price;
      const lastPrice = sortedPoints[sortedPoints.length - 1].price;
      const diff = lastPrice - firstPrice;
      const percentChange = (diff / firstPrice) * 100;

      return {
        ...p,
        firstPrice,
        lastPrice,
        diff,
        percentChange
      };
    });

    // Maior subida (inflação) -> percentChange mais alto positivo
    const biggestIncreases = [...analyzed]
      .filter(p => p.percentChange > 0)
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 3);

    // Maior descida (deflação/promoções) -> percentChange mais baixo negativo
    const biggestDecreases = [...analyzed]
      .filter(p => p.percentChange < 0)
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 3);

    return { biggestIncreases, biggestDecreases };
  }, [productHistory]);

  const handleSelect = (prod) => {
    setSelectedProduct(prod);
    setSearchTerm('');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#f8fafc' }}>{label}</p>
          <p style={{ margin: 0, color: '#f59e0b', fontSize: '1.2rem', fontWeight: 'bold' }}>
            €{data.price.toFixed(2)} <span style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>/ un</span>
          </p>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {data.originalName}
          </p>
        </div>
      );
    }
    return null;
  };

  // Se houver um produto selecionado, calcular estatísticas
  let stats = null;
  if (selectedProduct && selectedProduct.dataPoints.length > 0) {
    const prices = selectedProduct.dataPoints.map(d => d.price);
    stats = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      current: prices[prices.length - 1],
      historyCount: prices.length
    };
  }

  return (
    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: '0.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem', color: '#f59e0b'}}>
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Rastreador de Preços
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Pesquise por um produto e veja como o preço flutuou ao longo do tempo.
          </p>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Ex: Azeite Gallo, Salmão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              borderRadius: '2rem',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)',
              color: 'white',
              outline: 'none'
            }}
          />
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)'}}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#1e293b',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              marginTop: '0.5rem',
              overflow: 'hidden',
              zIndex: 10
            }}>
              {searchResults.map((prod, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSelect(prod)}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#f8fafc' }}>{prod.baseName}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{prod.dataPoints.length} compras</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedProduct && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              Maior Inflação (Subidas)
            </h4>
            {topMovers.biggestIncreases.length > 0 ? topMovers.biggestIncreases.map((p, idx) => (
              <div key={idx} onClick={() => handleSelect(p)} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <span style={{ color: '#f8fafc', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{p.baseName}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>+{p.percentChange.toFixed(0)}%</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>€{p.firstPrice.toFixed(2)} → €{p.lastPrice.toFixed(2)}</div>
                </div>
              </div>
            )) : <p style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Dados insuficientes.</p>}
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
              Maiores Descidas
            </h4>
            {topMovers.biggestDecreases.length > 0 ? topMovers.biggestDecreases.map((p, idx) => (
              <div key={idx} onClick={() => handleSelect(p)} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <span style={{ color: '#f8fafc', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{p.baseName}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>{p.percentChange.toFixed(0)}%</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>€{p.firstPrice.toFixed(2)} → €{p.lastPrice.toFixed(2)}</div>
                </div>
              </div>
            )) : <p style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Dados insuficientes.</p>}
          </div>
        </div>
      )}

      {selectedProduct ? (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem' }}>{selectedProduct.baseName}</h3>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mínimo</div>
                <div style={{ color: '#10b981', fontWeight: 'bold' }}>€{stats.min.toFixed(2)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Máximo</div>
                <div style={{ color: '#ef4444', fontWeight: 'bold' }}>€{stats.max.toFixed(2)}</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fcd34d' }}>Último Preço</div>
                <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '1.1rem' }}>€{stats.current.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedProduct.dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `€${value.toFixed(2)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  activeDot={{ r: 8, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {selectedProduct.dataPoints.length === 1 && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Este produto só tem 1 compra registada, pelo que não existe evolução histórica para traçar.
            </p>
          )}
        </div>
      ) : (
        <div style={{ 
          height: '200px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.01)',
          borderRadius: '0.5rem',
          border: '1px dashed rgba(255,255,255,0.1)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Use a barra de pesquisa acima para selecionar um produto e ver o seu histórico de preços.</p>
        </div>
      )}
    </div>
  );
};

export default PriceTracker;
