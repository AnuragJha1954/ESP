import { apiRequest } from './apiClient';

export async function fetchLedgerTrades() {
  const res = await apiRequest('/api/user/trade-history');
  if (res.ok && res.data?.status === 'success') {
    return (res.data.data || []).map(trade => {
      let status = 'FILLED';
      const msg = trade.message || '';
      if (msg.includes('Pending') || msg.includes('Sent')) {
        status = 'PENDING';
      } else if (msg.includes('Failed') || msg.includes('REJECTED') || msg.includes('Error')) {
        status = 'REJECTED';
      } else if (msg.includes('Reconciling') || msg.includes('Unknown')) {
        status = 'UNKNOWN';
      } else if (msg.includes('Blocked') || msg.includes('Kill Switch')) {
        status = 'BLOCKED ON DEVICE';
      } else if (trade.status === 'SUCCESS' || msg === 'Success') {
        status = 'FILLED';
      }

      return {
        ...trade,
        ledgerStatus: status,
        formattedTime: new Date(trade.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        orderRef: `TP-${trade.id?.toString().padStart(5, '0')}`,
        brokerOrderId: trade.broker_order_id || `ORD-${trade.id || 'LIVE'}`
      };
    });
  }
  return [];
}

export function exportTradesCSV(trades = []) {
  if (!trades.length) return;
  const headers = ['Order Ref', 'Time (IST)', 'Broker', 'Symbol', 'Side', 'Lots/Qty', 'Status', 'Message'];
  const rows = trades.map(t => [
    t.orderRef || t.id,
    t.created_at,
    t.broker,
    `"${t.symbol || ''}"`,
    t.side === 1 || t.side === 'BUY' ? 'BUY' : 'SELL',
    t.quantity,
    t.ledgerStatus || t.status,
    `"${(t.message || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `tradopad_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
