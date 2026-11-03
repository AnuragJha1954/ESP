const COMPLIANCE_KEY = 'tradopad_compliance';

export function getRiskDisclosureStatus() {
  const saved = JSON.parse(localStorage.getItem(COMPLIANCE_KEY) || 'null');
  return saved || {
    riskDisclosureAccepted: false,
    acceptedAt: null,
    version: '1.0'
  };
}

export function acceptRiskDisclosure(version = '1.0') {
  const status = {
    riskDisclosureAccepted: true,
    acceptedAt: new Date().toISOString(),
    version
  };
  localStorage.setItem(COMPLIANCE_KEY, JSON.stringify(status));
  return status;
}

export function requestDataExport(user) {
  const payload = {
    user: user || {},
    preferences: localStorage.getItem('esp_user') || {},
    exportedAt: new Date().toISOString(),
    retentionNotice: 'Generated under SEBI & DPDP Customer Data Accessibility Framework.'
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `tradopad_dpdp_export_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
