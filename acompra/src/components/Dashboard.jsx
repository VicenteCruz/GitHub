import React, { useState, useEffect, useRef, useMemo } from 'react';
import CategoryBreakdown from './CategoryBreakdown';
import ReceiptCard from './ReceiptCard';
import SpendingTimeline from './charts/SpendingTimeline';
import TopProducts from './TopProducts';
import ShoppingPrediction from './ShoppingPrediction';
import PriceTracker from './PriceTracker';
import ShrinkflationAlert from './ShrinkflationAlert';
import GoldenDay from './GoldenDay';

const Dashboard = () => {
  const [receiptsData, setReceiptsData] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [rawText, setRawText] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('overview'); // overview, intelligence, receipts

  const filteredReceiptsData = useMemo(() => {
    if (!dateRange) return receiptsData;
    return receiptsData.filter(r => {
      const receiptDate = r.date.split('T')[0];
      return receiptDate >= dateRange.startDate && receiptDate <= dateRange.endDate;
    });
  }, [receiptsData, dateRange]);

  // Fetch receipts from backend
  const fetchReceipts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/receipts');
      const data = await response.json();
      setReceiptsData(data);
    } catch (err) {
      console.error('Failed to fetch receipts:', err);
      setError('Failed to connect to backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleTextUpload = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!rawText.trim()) {
      setError('Please paste the receipt text.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload receipt text');
      }

      setSuccess('Receipt parsed and saved successfully!');
      setRawText('');
      fetchReceipts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!files || files.length === 0) {
      setError('Por favor, selecione pelo menos um ficheiro PDF.');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('receiptPdfs', files[i]);
    }

    try {
      const response = await fetch('http://localhost:3001/api/receipts/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar PDFs');
      }

      let successMsg = `Processados: ${data.successful} recibo(s). `;
      if (data.duplicates > 0) successMsg += `(${data.duplicates} duplicado(s) ignorado(s)). `;
      if (data.failed > 0) successMsg += `Falhas: ${data.failed}.`;

      setSuccess(successMsg);
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchReceipts();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading Dashboard...</div>;
  }

  const totalSpend = filteredReceiptsData.reduce((acc, receipt) => acc + receipt.totalPaid, 0);
  
  // O valor poupado é a diferença entre o verdadeiro valor (subtotal) e o que foi pago
  const totalSaved = filteredReceiptsData.reduce((acc, receipt) => {
    const trueValue = receipt.subtotal > 0 ? receipt.subtotal : receipt.totalPaid;
    return acc + (trueValue - receipt.totalPaid);
  }, 0);

  return (
    <div>
      <header className="dashboard-header">
        <h1>Dashboard ACompra</h1>
        <p>Acompanhe as suas despesas do Continente de forma inteligente.</p>
      </header>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          Visão Geral
        </button>
        <button className={`tab-btn ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Inteligência & Preços
        </button>
        <button className={`tab-btn ${activeTab === 'receipts' ? 'active' : ''}`} onClick={() => setActiveTab('receipts')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Gestão de Faturas
        </button>
      </div>

      {/* Visão Geral Tab */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-title">Total Gasto</div>
              <div className="stat-value">€{totalSpend.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Total Poupado</div>
              <div className="stat-value success">€{totalSaved.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Nº de Compras</div>
              <div className="stat-value">{filteredReceiptsData.length}</div>
            </div>
          </div>

          {receiptsData.length > 0 ? (
            <>
              <SpendingTimeline receipts={receiptsData} onBrushChange={setDateRange} />
              
              <div style={{ marginTop: '2rem' }}>
                <h2 className="section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                  Despesas por Categoria
                </h2>
                {filteredReceiptsData.length > 0 ? (
                  <CategoryBreakdown receipts={filteredReceiptsData} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>Sem dados suficientes para este período.</p>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '3rem' }}>Comece por adicionar algumas faturas na aba "Gestão de Faturas".</p>
          )}
        </div>
      )}

      {/* Inteligência Tab */}
      {activeTab === 'intelligence' && (
        <div className="tab-content">
          {receiptsData.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                <GoldenDay receipts={receiptsData} />
                <ShrinkflationAlert receipts={receiptsData} />
              </div>
              <ShoppingPrediction receipts={receiptsData} />
              <PriceTracker receipts={receiptsData} />
              <TopProducts receipts={filteredReceiptsData} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Precisa de inserir faturas para treinar a Inteligência Artificial.</p>
              <button onClick={() => setActiveTab('receipts')} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', marginTop: '1rem' }}>
                Ir para Upload
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recibos Tab */}
      {activeTab === 'receipts' && (
        <div className="tab-content">
          <section className="upload-section" style={{ marginBottom: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* PDF Upload */}
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                Upload de PDF
              </h2>
              <form onSubmit={handleFileUpload}>
                <div style={{ marginBottom: '1rem' }}>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    multiple
                    onChange={(e) => setFiles(e.target.files)}
                    ref={fileInputRef}
                    style={{ width: '100%', padding: '0.5rem', color: 'white' }}
                  />
                </div>
                <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                  Processar PDF
                </button>
              </form>
            </div>

            {/* Text Upload */}
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Colar Texto ou Código JSON (Outras Lojas)
              </h2>
              <form onSubmit={handleTextUpload}>
                <textarea 
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Cole aqui o texto do recibo do Continente ou o código JSON gerado por uma IA (para recibos de outras lojas)..."
                  style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '1rem', fontFamily: 'inherit' }}
                ></textarea>
                <button type="submit" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                  Processar Dados
                </button>
              </form>
            </div>

            {/* Notifications */}
            <div style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              {error && <div style={{ color: 'var(--danger-color)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>{error}</div>}
              {success && <div style={{ color: 'var(--success-color)', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem' }}>{success}</div>}
            </div>
          </section>

          <section>
            <h2 className="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Últimos Recibos
            </h2>
            {receiptsData.length > 0 ? (
              <div className="receipt-list">
                {receiptsData.sort((a, b) => new Date(b.date) - new Date(a.date)).map((receipt) => (
                  <ReceiptCard key={receipt.id} receipt={receipt} />
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Sem dados disponíveis.</p>
            )}
          </section>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
