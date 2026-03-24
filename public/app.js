// ===== State =====
let sessionId = localStorage.getItem('sessionId') || null;
let searchTimeout = null;

// ===== Navigation =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`.nav-link[data-page="${page}"]`).forEach(l => l.classList.add('active'));

  window.scrollTo(0, 0);

  if (page === 'admin' && sessionId) {
    verifySession();
  }
}

function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ===== Toast =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ===== Tab Switch (Warranty Check) =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.closest('.tab-btn').classList.add('active');

  if (tab === 'phone') {
    document.getElementById('phoneField').style.display = 'block';
    document.getElementById('invoiceField').style.display = 'none';
    document.getElementById('searchPhone').required = true;
    document.getElementById('searchInvoice').required = false;
  } else {
    document.getElementById('phoneField').style.display = 'none';
    document.getElementById('invoiceField').style.display = 'block';
    document.getElementById('searchPhone').required = false;
    document.getElementById('searchInvoice').required = true;
  }
}

// ===== Check Warranty (Public) =====
async function checkWarranty(e) {
  e.preventDefault();
  const phone = document.getElementById('searchPhone').value.trim();
  const invoice = document.getElementById('searchInvoice').value.trim();

  let url = '/api/warranty-check?';
  if (phone) url += 'phone=' + encodeURIComponent(phone);
  else if (invoice) url += 'invoice=' + encodeURIComponent(invoice);
  else return showToast('Please enter phone or invoice number', 'error');

  try {
    const res = await fetch(url);
    const data = await res.json();
    displayResults(data, phone || invoice);
  } catch {
    showToast('Error checking warranty. Please try again.', 'error');
  }
}

function displayResults(warranties, searchTerm) {
  const container = document.getElementById('warrantyResults');
  const title = document.getElementById('resultsTitle');
  const list = document.getElementById('resultsList');

  container.style.display = 'block';

  if (warranties.length === 0) {
    title.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--warning)"></i> No warranty records found';
    list.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px;">No warranty records found for "<strong>' + escapeHtml(searchTerm) + '</strong>". Please check the number and try again, or contact the shop.</p>';
    return;
  }

  title.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> Found ${warranties.length} warranty record(s) for ${escapeHtml(warranties[0].customer_name)}`;

  list.innerHTML = warranties.map(w => {
    const today = new Date();
    const purchaseDate = new Date(w.purchase_date);
    const endDate = new Date(w.warranty_end_date);
    const isActive = endDate >= today;
    const totalDays = Math.ceil((endDate - purchaseDate) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const daysUsed = totalDays - daysLeft;
    const usedPercent = isActive ? Math.min(100, Math.max(0, (daysUsed / totalDays) * 100)) : 100;
    const remainPercent = 100 - usedPercent;
    const barColor = !isActive ? 'var(--danger)' : remainPercent > 50 ? 'var(--success)' : remainPercent > 20 ? 'var(--warning)' : '#e85d04';

    return `
      <div class="warranty-result-card ${isActive ? '' : 'expired'}">
        <div class="card-top">
          <div class="product-info">
            <h4>${escapeHtml(w.product_name)}${w.product_brand ? ' - ' + escapeHtml(w.product_brand) : ''}</h4>
            <span>${w.product_model ? 'Model: ' + escapeHtml(w.product_model) : ''}</span>
          </div>
          <span class="status-badge ${isActive ? 'active' : 'expired'}">
            <i class="fas ${isActive ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${isActive ? 'Active' : 'Expired'}
          </span>
        </div>
        <div class="warranty-details">
          <div class="detail-item">
            <span class="detail-label">Invoice No.</span>
            <span class="detail-value">${escapeHtml(w.invoice_number)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Purchase Date</span>
            <span class="detail-value">${formatDate(w.purchase_date)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Warranty Period</span>
            <span class="detail-value">${w.warranty_months} months (${totalDays} days)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Valid Till</span>
            <span class="detail-value">${formatDate(w.warranty_end_date)}</span>
          </div>
          ${w.serial_number ? `
          <div class="detail-item">
            <span class="detail-label">Serial No.</span>
            <span class="detail-value">${escapeHtml(w.serial_number)}</span>
          </div>` : ''}
          ${w.product_category ? `
          <div class="detail-item">
            <span class="detail-label">Category</span>
            <span class="detail-value">${escapeHtml(w.product_category)}</span>
          </div>` : ''}
        </div>
        <div class="warranty-bar-section">
          <div class="warranty-bar-header">
            <span class="warranty-bar-label" style="color:${barColor}; font-weight:600;">
              <i class="fas ${isActive ? 'fa-clock' : 'fa-times-circle'}"></i>
              ${isActive ? daysLeft + ' days remaining' : 'Expired ' + Math.abs(daysLeft) + ' days ago'}
            </span>
            <span class="warranty-bar-percent" style="color:${barColor}">${isActive ? Math.round(remainPercent) + '% left' : '0% left'}</span>
          </div>
          <div class="warranty-bar-track">
            <div class="warranty-bar-fill" style="width:${usedPercent}%;background:${barColor}"></div>
          </div>
          <div class="warranty-bar-footer">
            <span>${formatDate(w.purchase_date)}</span>
            <span>${formatDate(w.warranty_end_date)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Admin Login =====
async function adminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      return;
    }

    sessionId = data.sessionId;
    localStorage.setItem('sessionId', sessionId);
    errorEl.style.display = 'none';
    showDashboard();
    showToast('Welcome back, Admin!');
  } catch {
    errorEl.textContent = 'Login failed. Please try again.';
    errorEl.style.display = 'block';
  }
}

async function verifySession() {
  try {
    const res = await fetch('/api/warranties', {
      headers: { 'X-Session-Id': sessionId }
    });
    if (res.ok) {
      showDashboard();
    } else {
      sessionId = null;
      localStorage.removeItem('sessionId');
    }
  } catch {
    sessionId = null;
    localStorage.removeItem('sessionId');
  }
}

function showDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  loadWarranties();
}

async function adminLogout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId }
    });
  } catch { /* ignore */ }

  sessionId = null;
  localStorage.removeItem('sessionId');
  document.getElementById('adminLogin').style.display = '';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  showToast('Logged out successfully');
}

// ===== Load Warranties (Admin) =====
async function loadWarranties() {
  const search = document.getElementById('adminSearch').value;
  const status = document.getElementById('statusFilter').value;

  let url = '/api/warranties?';
  if (search) url += 'search=' + encodeURIComponent(search) + '&';
  if (status) url += 'status=' + encodeURIComponent(status);

  try {
    const res = await fetch(url, {
      headers: { 'X-Session-Id': sessionId }
    });

    if (!res.ok) return;

    const warranties = await res.json();
    renderWarrantyTable(warranties);
    updateStats(warranties);
  } catch { /* ignore */ }
}

function renderWarrantyTable(warranties) {
  const tbody = document.getElementById('warrantyTableBody');
  const noData = document.getElementById('noWarranties');

  if (warranties.length === 0) {
    tbody.innerHTML = '';
    noData.style.display = 'block';
    return;
  }

  noData.style.display = 'none';
  const today = new Date();

  tbody.innerHTML = warranties.map((w, i) => {
    const endDate = new Date(w.warranty_end_date);
    const isActive = endDate >= today;

    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${escapeHtml(w.customer_name)}</strong><br>
          <small style="color:var(--text-light)">${escapeHtml(w.customer_phone)}</small>
          ${w.customer_address ? '<br><small style="color:var(--text-light)">' + escapeHtml(w.customer_address) + '</small>' : ''}
        </td>
        <td>
          ${escapeHtml(w.product_name)}
          ${w.product_brand ? '<br><small style="color:var(--text-light)">' + escapeHtml(w.product_brand) + '</small>' : ''}
        </td>
        <td>${w.product_category ? escapeHtml(w.product_category) : '-'}</td>
        <td>${escapeHtml(w.invoice_number)}</td>
        <td>${formatDate(w.purchase_date)}</td>
        <td>${formatDate(w.warranty_end_date)}</td>
        <td>
          <span class="status-badge ${isActive ? 'active' : 'expired'}">
            <i class="fas ${isActive ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${isActive ? 'Active' : 'Expired'}
          </span>
        </td>
        <td class="action-cell">
          <button class="btn-icon edit" onclick='editWarranty(${JSON.stringify(w)})' title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon whatsapp" onclick='sendWhatsappLink(${JSON.stringify(w)})' title="Send WhatsApp">
            <i class="fab fa-whatsapp"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteWarranty(${w.id})" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateStats(warranties) {
  const today = new Date();
  const active = warranties.filter(w => new Date(w.warranty_end_date) >= today).length;
  const expired = warranties.filter(w => new Date(w.warranty_end_date) < today).length;

  document.getElementById('totalWarranties').textContent = warranties.length;
  document.getElementById('activeWarranties').textContent = active;
  document.getElementById('expiredWarranties').textContent = expired;
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadWarranties, 300);
}

// ===== Quantity & Dynamic Serial Fields =====
function updateSerialFields() {
  const qty = Math.max(1, Math.min(50, parseInt(document.getElementById('w_quantity').value) || 1));
  const container = document.getElementById('serialFieldsList');
  const existing = container.querySelectorAll('input');
  const values = Array.from(existing).map(inp => inp.value);

  let html = '';
  for (let i = 1; i <= qty; i++) {
    html += `<input type="text" id="w_serial_number_${i}" placeholder="Serial/barcode number - Unit ${i}" value="${escapeHtml(values[i - 1] || '')}" style="${qty > 1 ? 'margin-bottom:8px;' : ''}">`;
  }
  container.innerHTML = html;
}

// ===== Add Warranty =====
async function addWarranty(e) {
  e.preventDefault();

  const qty = Math.max(1, parseInt(document.getElementById('w_quantity').value) || 1);
  const baseData = {
    customer_name: document.getElementById('w_customer_name').value.trim(),
    customer_phone: document.getElementById('w_customer_phone').value.trim(),
    customer_address: document.getElementById('w_customer_address').value.trim(),
    product_name: document.getElementById('w_product_name').value.trim(),
    product_category: document.getElementById('w_product_category').value,
    product_brand: document.getElementById('w_product_brand').value.trim(),
    product_model: document.getElementById('w_product_model').value.trim(),
    invoice_number: document.getElementById('w_invoice_number').value.trim(),
    purchase_date: document.getElementById('w_purchase_date').value,
    warranty_months: parseInt(document.getElementById('w_warranty_months').value),
    notes: document.getElementById('w_notes').value.trim()
  };

  // Collect serial numbers for each unit
  const serials = [];
  for (let i = 1; i <= qty; i++) {
    const el = document.getElementById('w_serial_number_' + i);
    serials.push(el ? el.value.trim() : '');
  }

  try {
    let successCount = 0;
    for (let i = 0; i < qty; i++) {
      const data = { ...baseData, serial_number: serials[i] };
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(`Error adding unit ${i + 1}: ${err.error}`, 'error');
        continue;
      }
      successCount++;
    }

    if (successCount > 0) {
      showToast(`${successCount} warranty record${successCount > 1 ? 's' : ''} added successfully!`);
      showWhatsappModal({ ...baseData, serial_number: serials.join(', '), quantity: qty });
      document.getElementById('addWarrantyForm').reset();
      document.getElementById('w_quantity').value = '1';
      updateSerialFields();
      document.getElementById('w_purchase_date').value = new Date().toISOString().split('T')[0];
      loadWarranties();
    }
  } catch {
    showToast('Error adding warranty', 'error');
  }
}

// ===== Edit Warranty =====
function editWarranty(w) {
  document.getElementById('edit_id').value = w.id;
  document.getElementById('edit_customer_name').value = w.customer_name;
  document.getElementById('edit_customer_phone').value = w.customer_phone;
  document.getElementById('edit_customer_address').value = w.customer_address || '';
  document.getElementById('edit_product_name').value = w.product_name;
  document.getElementById('edit_product_category').value = w.product_category || '';
  document.getElementById('edit_product_brand').value = w.product_brand || '';
  document.getElementById('edit_product_model').value = w.product_model || '';
  document.getElementById('edit_serial_number').value = w.serial_number || '';
  document.getElementById('edit_invoice_number').value = w.invoice_number;
  document.getElementById('edit_purchase_date').value = w.purchase_date;
  document.getElementById('edit_warranty_months').value = w.warranty_months;
  document.getElementById('edit_notes').value = w.notes || '';

  document.getElementById('editModal').style.display = 'flex';
}

async function updateWarranty(e) {
  e.preventDefault();

  const id = document.getElementById('edit_id').value;
  const data = {
    customer_name: document.getElementById('edit_customer_name').value.trim(),
    customer_phone: document.getElementById('edit_customer_phone').value.trim(),
    customer_address: document.getElementById('edit_customer_address').value.trim(),
    product_name: document.getElementById('edit_product_name').value.trim(),
    product_category: document.getElementById('edit_product_category').value,
    product_brand: document.getElementById('edit_product_brand').value.trim(),
    product_model: document.getElementById('edit_product_model').value.trim(),
    serial_number: document.getElementById('edit_serial_number').value.trim(),
    invoice_number: document.getElementById('edit_invoice_number').value.trim(),
    purchase_date: document.getElementById('edit_purchase_date').value,
    warranty_months: parseInt(document.getElementById('edit_warranty_months').value),
    notes: document.getElementById('edit_notes').value.trim()
  };

  try {
    const res = await fetch('/api/warranties/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(err.error, 'error');
    }

    showToast('Warranty updated successfully!');
    closeModal();
    loadWarranties();
  } catch {
    showToast('Error updating warranty', 'error');
  }
}

// ===== Delete Warranty =====
async function deleteWarranty(id) {
  if (!confirm('Are you sure you want to delete this warranty record?')) return;

  try {
    const res = await fetch('/api/warranties/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { 'X-Session-Id': sessionId }
    });

    if (res.ok) {
      showToast('Warranty deleted');
      loadWarranties();
    }
  } catch {
    showToast('Error deleting warranty', 'error');
  }
}

// ===== Modals =====
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ===== Change Password =====
function showChangePassword() {
  document.getElementById('passwordModal').style.display = 'flex';
}

function closePasswordModal() {
  document.getElementById('passwordModal').style.display = 'none';
}

async function changePassword(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('cp_current').value;
  const newPassword = document.getElementById('cp_new').value;
  const confirmPassword = document.getElementById('cp_confirm').value;

  if (newPassword !== confirmPassword) {
    return showToast('New passwords do not match', 'error');
  }

  try {
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();
    if (!res.ok) return showToast(data.error, 'error');

    showToast('Password changed successfully!');
    closePasswordModal();
  } catch {
    showToast('Error changing password', 'error');
  }
}

// ===== Helpers =====
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Set today's date as default for purchase date
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const purchaseDateEl = document.getElementById('w_purchase_date');
  if (purchaseDateEl) purchaseDateEl.value = today;

  // Check if URL has phone param for direct tracking
  const urlParams = new URLSearchParams(window.location.search);
  const trackPhone = urlParams.get('phone');
  if (trackPhone) {
    showPage('check');
    document.getElementById('searchPhone').value = trackPhone;
    // Auto-trigger warranty search
    autoCheckWarranty(trackPhone);
  }
});

// Auto-check warranty from URL parameter
async function autoCheckWarranty(phone) {
  try {
    const res = await fetch('/api/warranty-check?phone=' + encodeURIComponent(phone));
    const data = await res.json();
    displayResults(data, phone);
  } catch {
    showToast('Error checking warranty. Please try again.', 'error');
  }
}

// ===== WhatsApp Sharing =====
function getTrackingUrl(phone) {
  return window.location.origin + '/?phone=' + encodeURIComponent(phone);
}

function showWhatsappModal(data) {
  const trackUrl = getTrackingUrl(data.customer_phone);
  const qtyText = data.quantity && data.quantity > 1 ? `\nQuantity: *${data.quantity} units*` : '';
  const message = `Dear ${data.customer_name},\n\nThank you for your purchase from *Goyal Enterprises*!\n\nProduct: *${data.product_name}*${data.product_brand ? ' (' + data.product_brand + ')' : ''}${qtyText}\nWarranty: *${data.warranty_months} months*\nInvoice: ${data.invoice_number}\n\nTrack your warranty anytime:\n${trackUrl}\n\nFor any queries, contact us:\n94162 37982 / 97294 72373\n\n_Goyal Enterprises - Trusted Since 1999_`;

  const preview = document.getElementById('whatsappPreview');
  preview.innerHTML = `<div class="wa-msg">${escapeHtml(message).replace(/\n/g, '<br>')}</div>`;

  const whatsappUrl = 'https://wa.me/91' + data.customer_phone + '?text=' + encodeURIComponent(message);
  document.getElementById('whatsappSendBtn').href = whatsappUrl;

  document.getElementById('whatsappModal').style.display = 'flex';
}

function closeWhatsappModal() {
  document.getElementById('whatsappModal').style.display = 'none';
}

function sendWhatsappLink(w) {
  const trackUrl = getTrackingUrl(w.customer_phone);
  const endDate = new Date(w.warranty_end_date);
  const isActive = endDate >= new Date();

  const message = `Dear ${w.customer_name},\n\nYour warranty details from *Goyal Enterprises*:\n\nProduct: *${w.product_name}*${w.product_brand ? ' (' + w.product_brand + ')' : ''}\nSerial No: ${w.serial_number || 'N/A'}\nInvoice: ${w.invoice_number}\nWarranty: ${w.warranty_months} months\nValid Till: ${formatDate(w.warranty_end_date)}\nStatus: ${isActive ? 'Active \u2705' : 'Expired \u274c'}\n\nTrack your warranty online:\n${trackUrl}\n\nContact: 94162 37982 / 97294 72373\n_Goyal Enterprises - Trusted Since 1999_`;

  const whatsappUrl = 'https://wa.me/91' + w.customer_phone + '?text=' + encodeURIComponent(message);
  window.open(whatsappUrl, '_blank');
}
