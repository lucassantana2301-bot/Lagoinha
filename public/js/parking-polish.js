(function () {
  'use strict';
  function showToast(message, type = 'info') {
    const view = document.getElementById('viewParking');
    if (!view) return;
    document.getElementById('parkingFeedbackToast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'parkingFeedbackToast';
    toast.className = 'feedback-toast';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.textContent = message;
    view.appendChild(toast);
    if (type !== 'sync') setTimeout(() => toast.remove(), type === 'error' ? 8000 : 5000);
  }
  window.LagoinhaParkingPolish = { showToast, version: '1.1.0' };
})();
