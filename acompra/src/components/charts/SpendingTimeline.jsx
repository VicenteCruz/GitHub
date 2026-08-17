import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush
} from 'recharts';

const SpendingTimeline = ({ receipts, onBrushChange }) => {
  const [viewMode, setViewMode] = useState('daily');

  const data = useMemo(() => {
    const grouped = {};

    receipts.forEach(receipt => {
      const dateObj = new Date(receipt.date);
      const year = dateObj.getFullYear();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthStr = monthNames[dateObj.getMonth()];
      const day = dateObj.getDate().toString().padStart(2, '0');
      
      const isDaily = viewMode === 'daily';
      
      const sortKey = isDaily 
        ? receipt.date.split('T')[0] 
        : `${year}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
        
      const displayDate = isDaily ? `${day} ${monthStr}` : `${monthStr} ${year}`;

      if (!grouped[sortKey]) {
        grouped[sortKey] = {
          sortKey,
          date: displayDate,
          gasto: 0,
          pago: 0,
          poupanca: 0
        };
      }

      const realValue = receipt.subtotal > 0 ? receipt.subtotal : receipt.totalPaid;
      grouped[sortKey].gasto += realValue;
      grouped[sortKey].pago += receipt.totalPaid;
      grouped[sortKey].poupanca += receipt.totalDiscounts;
    });

    // Sort chronologically and return array
    return Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [receipts, viewMode]);

  const handleBrushChange = (brushData) => {
    if (onBrushChange && brushData) {
      const { startIndex, endIndex } = brushData;
      if (data[startIndex] && data[endIndex]) {
        onBrushChange({
          startDate: data[startIndex].sortKey,
          endDate: data[endIndex].sortKey
        });
      }
    }
  };

  if (data.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#f8fafc' }}>{label}</p>
          <p style={{ margin: 0, color: '#60a5fa', fontSize: '0.9rem' }}>
            Valor Produtos: €{payload[0].value.toFixed(2)}
          </p>
          {payload[1] && (
            <p style={{ margin: '0.25rem 0 0 0', color: '#10b981', fontSize: '0.9rem' }}>
              Total Pago: €{payload[1].value.toFixed(2)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container" style={{ width: '100%', height: 350, marginBottom: '2rem' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6', marginRight: '0.5rem' }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Evolução de Gastos
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setViewMode('daily')}
            style={{ padding: '0.4rem 1rem', background: viewMode === 'daily' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'daily' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: viewMode === 'daily' ? 'bold' : 'normal' }}
          >
            Diário
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            style={{ padding: '0.4rem 1rem', background: viewMode === 'monthly' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'monthly' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: viewMode === 'monthly' ? 'bold' : 'normal' }}
          >
            Mensal
          </button>
        </div>
      </div>
      
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'daily' ? (
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
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
                stroke="#94a3b8" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Area 
                type="monotone" 
                dataKey="gasto" 
                name="Valor Produtos"
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorGasto)" 
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="pago" 
                name="Total Pago"
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPago)" 
              />
              <Brush 
                dataKey="date" 
                height={30} 
                stroke="#3b82f6" 
                fill="rgba(30, 41, 59, 0.7)" 
                tickFormatter={() => ''}
                onChange={handleBrushChange}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
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
                stroke="#94a3b8" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gasto" name="Valor Produtos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pago" name="Total Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Brush 
                dataKey="date" 
                height={30} 
                stroke="#3b82f6" 
                fill="rgba(30, 41, 59, 0.7)" 
                tickFormatter={() => ''}
                onChange={handleBrushChange}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendingTimeline;
