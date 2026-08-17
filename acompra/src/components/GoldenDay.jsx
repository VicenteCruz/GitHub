import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const GoldenDay = ({ receipts }) => {
  const { goldenDayData, chartData } = useMemo(() => {
    if (!receipts || receipts.length === 0) return { goldenDayData: null, chartData: [] };

    // Começar de Segunda (1) a Domingo (0), para visualização PT
    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Seg a Dom
    
    const stats = {};
    displayOrder.forEach(dayIdx => {
      stats[dayIdx] = {
        dayName: daysOfWeek[dayIdx],
        totalSpent: 0,
        totalSaved: 0,
        count: 0
      };
    });

    receipts.forEach(receipt => {
      const date = new Date(receipt.date);
      const dayIdx = date.getDay();

      stats[dayIdx].totalSpent += receipt.totalPaid;
      
      const trueValue = receipt.subtotal > 0 ? receipt.subtotal : receipt.totalPaid;
      const saved = trueValue - receipt.totalPaid;
      if (saved > 0) {
        stats[dayIdx].totalSaved += saved;
      }
      stats[dayIdx].count += 1;
    });

    const analyzedDays = displayOrder.map(dayIdx => {
      const day = stats[dayIdx];
      const totalValue = day.totalSpent + day.totalSaved;
      const percentSaved = totalValue > 0 ? (day.totalSaved / totalValue) * 100 : 0;
      return {
        ...day,
        percentSaved
      };
    });

    // Encontrar o dia vencedor (com maior percentagem média de poupança e pelo menos 1 compra)
    const validDays = [...analyzedDays].filter(d => d.count >= 1).sort((a, b) => b.percentSaved - a.percentSaved);
    const winner = validDays.length > 0 && validDays[0].percentSaved > 0 ? validDays[0] : null;

    return { goldenDayData: winner, chartData: analyzedDays };
  }, [receipts]);

  if (!goldenDayData) {
    return (
      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Dia de Ouro
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Sem dados suficientes sobre descontos para calcular o seu Dia de Ouro.
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: '#f8fafc' }}>{data.dayName}</p>
          <p style={{ margin: 0, color: '#f59e0b', fontWeight: 'bold' }}>{data.percentSaved.toFixed(1)}% Desconto</p>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{data.count} compra(s)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(217, 119, 6, 0.1) 100%)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(245, 158, 11, 0.3)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', fontSize: '1.1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        O seu Dia de Ouro
      </h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <p style={{ color: '#f8fafc', fontSize: '0.95rem', margin: 0 }}>
            Melhor dia: <strong style={{ color: '#fcd34d' }}>{goldenDayData.dayName}</strong>
          </p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.75rem', borderRadius: '0.5rem', textAlign: 'right' }}>
          <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {goldenDayData.percentSaved.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>Poupança</div>
        </div>
      </div>

      <div style={{ flexGrow: 1, minHeight: '120px', width: '100%', marginTop: '0.5rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <XAxis dataKey="dayName" stroke="var(--text-secondary)" fontSize={10} tickFormatter={(tick) => tick.substring(0,3)} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={10} tickFormatter={(tick) => `${tick}%`} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="percentSaved" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.dayName === goldenDayData.dayName ? '#fcd34d' : 'rgba(245, 158, 11, 0.4)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GoldenDay;
