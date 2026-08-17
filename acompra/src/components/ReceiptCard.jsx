import React, { useState } from 'react';

const ReceiptCard = ({ receipt }) => {
  const [expanded, setExpanded] = useState(false);

  // Format date
  const dateObj = new Date(receipt.date);
  const formattedDate = new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);

  return (
    <div className={`receipt-card ${receipt.validationError ? 'error-card' : ''}`}>
      <div 
        className="receipt-header" 
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="receipt-store">
            {receipt.store}
            {receipt.validationError && <span className="error-badge"> Erro de Leitura</span>}
          </div>
          <div className="receipt-date">{formattedDate}</div>
        </div>
        <div className="receipt-totals">
          <div className="receipt-total">
            €{(receipt.subtotal > 0 ? receipt.subtotal : receipt.totalPaid).toFixed(2)}
          </div>
          {receipt.subtotal > 0 && Math.abs(receipt.subtotal - receipt.totalPaid) > 0.01 && (
            <div className="receipt-paid" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Pago: €{receipt.totalPaid.toFixed(2)}
            </div>
          )}
          {receipt.subtotal > 0 && (receipt.subtotal - receipt.totalPaid) > 0.01 && (
            <div className="receipt-saved">Poupou €{(receipt.subtotal - receipt.totalPaid).toFixed(2)}</div>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="receipt-details">
          {receipt.items.map((item, index) => {
            return (
              <div key={index} className="item-row">
                <div className="item-info">
                  <div className="item-name">
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginRight: '0.5rem' }}>
                      {item.quantity || 1}x
                    </span>
                    {item.name}
                  </div>
                  <div className="item-category">{item.category}</div>
                </div>
                <div className="item-price-container">
                  <div className="item-price">€{item.price.toFixed(2)}</div>
                  {item.discount > 0 && (
                    <div className="item-discount">Poupou €{item.discount.toFixed(2)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReceiptCard;
