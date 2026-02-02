const STORAGE_KEY = 'cal-trip-spend-v1';

const tripForm = document.querySelector('#tripForm');
const expenseForm = document.querySelector('#expenseForm');
const overview = document.querySelector('#overview');
const expenseTable = document.querySelector('#expenseTable');
const exportCsvBtn = document.querySelector('#exportCsv');
const clearAllBtn = document.querySelector('#clearAll');

const statDays = document.querySelector('#statDays');
const statEntries = document.querySelector('#statEntries');
const statTotal = document.querySelector('#statTotal');

const defaultState = {
  trip: {
    traveler: '',
    name: '比利時教育旅行',
    start: '2026-03-01',
    end: '2026-03-16',
    budget: '',
    currency: 'EUR'
  },
  expenses: []
};

const state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultState);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const safe = String(value ?? '').replace(/"/g, '""');
    return `"${safe}"`;
  }).join(',')).join('\n');
}

function calcStats() {
  const dates = new Set(state.expenses.map((item) => item.date));
  const totalsByCurrency = {};

  state.expenses.forEach((item) => {
    totalsByCurrency[item.currency] = (totalsByCurrency[item.currency] || 0) + item.amount;
  });

  return { dates, totalsByCurrency };
}

function renderTripForm() {
  tripForm.travelerName.value = state.trip.traveler;
  tripForm.tripName.value = state.trip.name;
  tripForm.tripStart.value = state.trip.start;
  tripForm.tripEnd.value = state.trip.end;
  tripForm.tripBudget.value = state.trip.budget;
  tripForm.tripCurrency.value = state.trip.currency;
}

function renderOverview() {
  overview.innerHTML = '';
  const totalsByCurrency = {};
  const totalsByCategory = {};

  state.expenses.forEach((item) => {
    totalsByCurrency[item.currency] = (totalsByCurrency[item.currency] || 0) + item.amount;

    if (!totalsByCategory[item.currency]) {
      totalsByCategory[item.currency] = {};
    }
    totalsByCategory[item.currency][item.category] =
      (totalsByCategory[item.currency][item.category] || 0) + item.amount;
  });

  const container = document.createElement('div');
  container.className = 'overview__grid';

  if (Object.keys(totalsByCurrency).length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '目前沒有支出。新增第一筆記錄即可查看總計。';
    overview.appendChild(empty);
    return;
  }

  Object.entries(totalsByCurrency).forEach(([currency, total]) => {
    const tile = document.createElement('div');
    tile.className = 'overview__tile';
    const budgetMatch = currency === state.trip.currency && state.trip.budget;
    const title = budgetMatch ? `總計（${currency}）` : `總計 ${currency}`;

    tile.innerHTML = `
      <h3>${title}</h3>
      <p>${formatCurrency(total, currency)}</p>
    `;

    if (budgetMatch) {
      const remaining = Math.max(0, Number(state.trip.budget) - total);
      const remainingEl = document.createElement('p');
      remainingEl.className = 'table__muted';
      remainingEl.textContent = `剩餘：${formatCurrency(remaining, currency)}`;
      tile.appendChild(remainingEl);
    }

    const categoryList = document.createElement('div');
    const categoryTotals = totalsByCategory[currency];
    const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const snippet = entries.slice(0, 3)
      .map(([name, value]) => `${name}：${formatCurrency(value, currency)}`)
      .join(' · ');
    if (snippet) {
      const note = document.createElement('p');
      note.className = 'table__muted';
      note.textContent = snippet;
      categoryList.appendChild(note);
    }
    tile.appendChild(categoryList);
    container.appendChild(tile);
  });

  overview.appendChild(container);
}

function renderTable() {
  expenseTable.innerHTML = '';

  if (state.expenses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '目前沒有任何明細。新增支出來建立旅程帳本。';
    expenseTable.appendChild(empty);
    return;
  }

  const header = document.createElement('div');
  header.className = 'table__row table__row--header';
  header.innerHTML = `
    <span>日期</span>
    <span>金額</span>
    <span>幣別</span>
    <span>分類</span>
    <span>備註</span>
    <span></span>
  `;
  expenseTable.appendChild(header);

  const sorted = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'table__row';
    row.innerHTML = `
      <span>${item.date}</span>
      <span>${formatCurrency(item.amount, item.currency)}</span>
      <span class="table__pill">${item.currency}</span>
      <span>${item.category}</span>
      <span class="table__muted">${item.note || '—'} • ${item.payment}</span>
    `;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.setAttribute('type', 'button');
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => {
      state.expenses = state.expenses.filter((expense) => expense.id !== item.id);
      saveState();
      renderAll();
    });

    row.appendChild(deleteBtn);
    expenseTable.appendChild(row);
  });
}

function renderStats() {
  const { dates, totalsByCurrency } = calcStats();
  statDays.textContent = String(dates.size);
  statEntries.textContent = String(state.expenses.length);

  const entries = Object.entries(totalsByCurrency);
  if (entries.length === 0) {
    statTotal.textContent = '—';
    return;
  }

  const summary = entries.map(([currency, total]) =>
    formatCurrency(total, currency)).join(' · ');
  statTotal.textContent = summary;
}

function renderAll() {
  renderTripForm();
  renderOverview();
  renderTable();
  renderStats();
}

tripForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.trip = {
    traveler: tripForm.travelerName.value.trim(),
    name: tripForm.tripName.value.trim(),
    start: tripForm.tripStart.value,
    end: tripForm.tripEnd.value,
    budget: tripForm.tripBudget.value,
    currency: tripForm.tripCurrency.value
  };
  saveState();
  renderAll();
});

expenseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(expenseForm);
  const amount = Number(formData.get('amount'));

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  state.expenses.push({
    id: crypto.randomUUID(),
    date: formData.get('date'),
    amount,
    currency: formData.get('currency'),
    category: formData.get('category'),
    payment: formData.get('payment'),
    note: formData.get('note').trim()
  });

  saveState();
  expenseForm.reset();
  expenseForm.date.value = new Date().toISOString().slice(0, 10);
  renderAll();
});

exportCsvBtn.addEventListener('click', () => {
  if (state.expenses.length === 0) {
    return;
  }
  const rows = [
    ['日期', '金額', '幣別', '分類', '付款方式', '備註']
  ];
  state.expenses.forEach((item) => {
    rows.push([
      item.date,
      item.amount,
      item.currency,
      item.category,
      item.payment,
      item.note
    ]);
  });

  const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trip-expenses.csv';
  link.click();
  URL.revokeObjectURL(url);
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('確定要清除所有旅程資料與支出嗎？')) {
    return;
  }
  state.trip = structuredClone(defaultState.trip);
  state.expenses = [];
  saveState();
  renderAll();
});

function seedDefaults() {
  if (!expenseForm.date.value) {
    expenseForm.date.value = new Date().toISOString().slice(0, 10);
  }
  if (!expenseForm.payment.value) {
    expenseForm.payment.value = '現金';
  }
}

seedDefaults();
renderAll();
