import React, { useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { normalizeName, findBestGroupMatch } from '../utils/helpers';

const CategoryBreakdown = ({ receipts }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedProducts, setExpandedProducts] = useState({});
  const [selectedChartDate, setSelectedChartDate] = useState(null);

  const toggleProduct = (productName, e) => {
    e.stopPropagation();
    setExpandedProducts(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  // Calculate total spend and group items per category
  const categoriesData = {};
  let totalSpend = 0;

  receipts.forEach(receipt => {
    receipt.items.forEach(item => {
      const cat = item.category || 'Other';
      const price = item.price; // The printed price is the final price
      
      const rawBaseName = normalizeName(item.name);
      if (!rawBaseName) return;

      if (!categoriesData[cat]) {
        categoriesData[cat] = { amount: 0, products: {} };
      }
      
      const baseName = findBestGroupMatch(rawBaseName, Object.keys(categoriesData[cat].products));
      
      categoriesData[cat].amount += price;
      
      if (!categoriesData[cat].products[baseName]) {
        categoriesData[cat].products[baseName] = {
          name: baseName,
          totalAmount: 0,
          occurrences: []
        };
      }
      
      categoriesData[cat].products[baseName].totalAmount += price;
      categoriesData[cat].products[baseName].occurrences.push({
        price: price,
        date: receipt.date
      });
      
      totalSpend += price;
    });
  });

  // Sort categories by spend (descending)
  const sortedCategories = Object.entries(categoriesData)
    .map(([name, data]) => {
       // Sort products inside category by totalAmount descending
       const sortedProducts = Object.values(data.products).sort((a, b) => b.totalAmount - a.totalAmount);
       return { name, amount: data.amount, products: sortedProducts };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="category-list">
      {sortedCategories.map((cat, index) => {
        const percentage = totalSpend > 0 ? (cat.amount / totalSpend) * 100 : 0;
        const isExpanded = expandedCategory === cat.name;

        // Gerar dados para o gráfico desta categoria se estiver expandida
        let catChartData = [];
        if (isExpanded) {
          const dateMap = {};
          cat.products.forEach(p => {
            p.occurrences.forEach(occ => {
              const d = occ.date.split('T')[0];
              dateMap[d] = (dateMap[d] || 0) + occ.price;
            });
          });
          catChartData = Object.entries(dateMap)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([date, amount]) => ({ date, amount }));
        }

        const CustomTooltip = ({ active, payload, label }) => {
          if (active && payload && payload.length) {
            return (
              <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>{new Date(label).toLocaleDateString('pt-PT')}</div>
                <div style={{ color: '#60a5fa', fontWeight: 'bold' }}>€{payload[0].value.toFixed(2)}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '0.25rem' }}>Clique para filtrar</div>
              </div>
            );
          }
          return null;
        };

        const handleChartClick = (state) => {
          if (state && state.activeLabel) {
            setSelectedChartDate(state.activeLabel);
          }
        };

        // Filtro de produtos com base no clique do gráfico
        const displayProducts = isExpanded ? cat.products.map(p => {
          const filteredOccs = selectedChartDate 
            ? p.occurrences.filter(occ => occ.date.split('T')[0] === selectedChartDate)
            : p.occurrences;
          
          if (filteredOccs.length === 0) return null;
          
          const newTotal = filteredOccs.reduce((sum, occ) => sum + occ.price, 0);
          return { ...p, occurrences: filteredOccs, displayAmount: newTotal };
        }).filter(Boolean).sort((a, b) => b.displayAmount - a.displayAmount) : [];

        return (
          <div key={index} className="category-item">
            <div 
              className="category-info" 
              onClick={() => {
                const opening = !isExpanded;
                setExpandedCategory(opening ? cat.name : null);
                if (opening) {
                  setExpandedProducts({});
                  setSelectedChartDate(null);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className="category-name">{cat.name} {isExpanded ? '▼' : '▶'}</span>
              <span className="category-amount">€{cat.amount.toFixed(2)}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.max(percentage, 1)}%`, animationDelay: `${index * 0.1}s` }}
              ></div>
            </div>
            
            {isExpanded && (
              <div className="category-details">
                {catChartData.length > 1 && (
                  <div style={{ height: '100px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Evolução de despesas ({cat.name})</div>
                      {selectedChartDate && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedChartDate(null); }}
                          style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                        >
                          Limpar Filtro ({new Date(selectedChartDate).toLocaleDateString('pt-PT')})
                        </button>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={catChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                        <defs>
                          <linearGradient id={`colorAmount-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="amount" stroke="#3b82f6" fillOpacity={1} fill={`url(#colorAmount-${index})`} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                
                {displayProducts.length > 0 ? displayProducts.map((product, idx) => {
                  const isMultiple = product.occurrences.length > 1;
                  const isProductExpanded = expandedProducts[product.name];
                  
                  return (
                    <div key={idx} className="product-group">
                      <div 
                        className="category-detail-row" 
                        onClick={(e) => isMultiple ? toggleProduct(product.name, e) : null}
                        style={{ 
                          cursor: isMultiple ? 'pointer' : 'default', 
                          backgroundColor: isProductExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                          borderRadius: isProductExpanded ? '0.5rem 0.5rem 0 0' : '0'
                        }}
                      >
                        <div className="cat-detail-info">
                          <div className="cat-detail-name">
                            {product.name} {isMultiple && <span style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>{isProductExpanded ? '▼' : '▶'}</span>}
                          </div>
                          <div className="cat-detail-date">
                            {isMultiple 
                              ? `${product.occurrences.length} unidades` 
                              : new Date(product.occurrences[0].date).toLocaleDateString('pt-PT')}
                          </div>
                        </div>
                        <div className="cat-detail-price">€{product.displayAmount.toFixed(2)}</div>
                      </div>
                      
                      {isMultiple && isProductExpanded && (
                        <div className="product-occurrences" style={{ 
                          paddingLeft: '1.5rem', 
                          borderLeft: '2px solid rgba(59, 130, 246, 0.5)', 
                          marginLeft: '0.5rem', 
                          marginBottom: '0.5rem',
                          paddingBottom: '0.5rem',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          borderBottomRightRadius: '0.5rem'
                        }}>
                          {product.occurrences.map((occ, occIdx) => (
                            <div key={occIdx} className="category-detail-row" style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)', padding: '0.35rem 0.5rem' }}>
                              <div className="cat-detail-info">
                                <div className="cat-detail-date" style={{ color: 'var(--text-primary)' }}>{new Date(occ.date).toLocaleDateString('pt-PT')}</div>
                              </div>
                              <div className="cat-detail-price" style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>€{occ.price.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>
                    Nenhuma despesa para a data selecionada.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CategoryBreakdown;
