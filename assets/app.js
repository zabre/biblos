const state = {
  books: [],
  filtered: [],
  currentEditId: null,
  currentCarouselIndex: 0,
  github: { owner: '', repo: '', path: 'books.json', branch: 'main', token: '' }
};

const els = {
  shelves: document.getElementById('shelves'),
  search: document.getElementById('searchInput'),
  sort: document.getElementById('sortSelect'),
  filter: document.getElementById('filterSelect'),
  count: document.getElementById('bookCount'),
  shelfCount: document.getElementById('shelfCount'),
  reading: document.getElementById('readingCount'),
  openAddModal: document.getElementById('openAddModal'),
  bookModal: document.getElementById('bookModal'),
  githubModal: document.getElementById('githubModal'),
  openGithubModal: document.getElementById('openGithubModal'),
  form: document.getElementById('bookForm'),
  deleteBookBtn: document.getElementById('deleteBookBtn'),
  exportJson: document.getElementById('exportJson'),
  lookupBtn: document.getElementById('lookupBtn'),
  carouselTrack: document.getElementById('carouselTrack'),
  carouselTitle: document.getElementById('carouselTitle'),
  carouselMeta: document.getElementById('carouselMeta'),
  carouselNote: document.getElementById('carouselNote'),
  prevCarousel: document.getElementById('prevCarousel'),
  nextCarousel: document.getElementById('nextCarousel'),
  githubForm: document.getElementById('githubForm'),
  pushGithub: document.getElementById('pushGithub')
};

const fields = ['isbnInput','titleInput','authorInput','genreInput','statusInput','shelfInput','coverInput','noteInput']
  .reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});
const ghFields = ['ghOwner','ghRepo','ghPath','ghBranch','ghToken']
  .reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});

function safeCover(url) {
  return url || 'https://placehold.co/400x600/f0e6d7/6f6252?text=Sans+couverture';
}

async function loadBooks() {
  try {
    const res = await fetch('./books.json', { cache: 'no-store' });
    state.books = await res.json();
  } catch(e) {
    state.books = [];
  }
  applyFilters();
}

function applyFilters() {
  const q = els.search.value.trim().toLowerCase();
  const filter = els.filter.value;
  const sort = els.sort.value;
  let books = [...state.books].filter(book => {
    const hay = [book.title, book.author, book.genre, book.note].join(' ').toLowerCase();
    const matchesSearch = !q || hay.includes(q);
    const matchesFilter = filter === 'all' || book.status === filter;
    return matchesSearch && matchesFilter;
  });
  books.sort((a, b) => {
    if (sort === 'title-asc') return a.title.localeCompare(b.title, 'fr');
    if (sort === 'author-asc') return a.author.localeCompare(b.author, 'fr');
    if (sort === 'shelf-asc') return Number(a.shelf) - Number(b.shelf);
    return new Date(b.added) - new Date(a.added);
  });
  state.filtered = books;
  render();
}

function render() {
  renderShelves();
  renderStats();
  renderCarousel();
}

function renderStats() {
  els.count.textContent = state.books.length;
  els.shelfCount.textContent = new Set(state.books.map(b => b.shelf)).size;
  els.reading.textContent = state.books.filter(b => b.status === 'reading').length;
}

function renderShelves() {
  els.shelves.innerHTML = '';
  if (!state.filtered.length) {
    els.shelves.innerHTML = '<div class="empty glass">Aucun livre ne correspond à votre recherche.</div>';
    return;
  }
  const groups = state.filtered.reduce((acc, book) => {
    const key = `Étagère ${book.shelf}`;
    acc[key] ||= [];
    acc[key].push(book);
    return acc;
  }, {});
  Object.entries(groups).forEach(([shelfName, books]) => {
    const section = document.createElement('section');
    section.className = 'shelf-block glass';
    section.innerHTML = `
      <div class="shelf-head">
        <div><p class="eyebrow">Collection</p><h3 class="shelf-title">${shelfName}</h3></div>
        <p class="muted">${books.length} livre${books.length > 1 ? 's' : ''}</p>
      </div>
      <div class="shelf-books"></div>
      <div class="shelf-line"></div>`;
    const holder = section.querySelector('.shelf-books');
    books.forEach(book => holder.appendChild(createBookCard(book)));
    els.shelves.appendChild(section);
  });
}

function createBookCard(book) {
  const tpl = document.getElementById('bookCardTemplate');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.book-cover').src = safeCover(book.cover);
  node.querySelector('.book-cover').alt = `Couverture de ${book.title}`;
  node.querySelector('.book-title').textContent = book.title;
  node.querySelector('.book-author').textContent = book.author;
  node.addEventListener('click', () => openBook(book.id));
  node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(book.id); } });
  return node;
}

function renderCarousel() {
  const books = state.filtered.length ? state.filtered : state.books;
  els.carouselTrack.innerHTML = '';
  if (!books.length) return;
  state.currentCarouselIndex = Math.min(state.currentCarouselIndex, books.length - 1);
  books.forEach((book, index) => {
    const card = document.createElement('article');
    card.className = 'carousel-item' + (index === state.currentCarouselIndex ? ' is-active' : '');
    card.innerHTML = `<img src="${safeCover(book.cover)}" alt="Couverture de ${book.title}"><p class="book-title">${book.title}</p><p class="book-author">${book.author}</p>`;
    card.style.transform = `perspective(1200px) rotateY(${(index - state.currentCarouselIndex) * 12}deg) translateY(${Math.abs(index - state.currentCarouselIndex) * 8}px)`;
    card.style.opacity = index === state.currentCarouselIndex ? '1' : '.76';
    card.addEventListener('click', () => { state.currentCarouselIndex = index; renderCarousel(); openBook(book.id, false); });
    els.carouselTrack.appendChild(card);
  });
  const active = books[state.currentCarouselIndex];
  els.carouselTitle.textContent = active.title;
  els.carouselMeta.textContent = `${active.author} · ${active.genre || 'Genre libre'} · ${labelStatus(active.status)}`;
  els.carouselNote.textContent = active.note || 'Aucune note personnelle pour ce livre.';
}

function labelStatus(s) {
  return ({ read: 'Lu', reading: 'En cours', 'to-read': 'À lire' }[s]) || s;
}

function openBook(id, alsoEdit = true) {
  const book = state.books.find(b => b.id === id);
  if (!book) return;
  let sheet = document.querySelector('.detail-sheet');
  if (!sheet) { sheet = document.createElement('aside'); sheet.className = 'detail-sheet glass'; document.body.appendChild(sheet); }
  sheet.innerHTML = `
    <img src="${safeCover(book.cover)}" alt="Couverture de ${book.title}">
    <p class="eyebrow">${labelStatus(book.status)}</p>
    <h3>${book.title}</h3>
    <p>${book.author}</p>
    <p class="muted">Étagère ${book.shelf} · ${book.genre || 'Genre libre'}</p>
    <p>${book.note || 'Aucune note.'}</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="editCurrentBook">Modifier</button>
      <button class="btn btn-ghost" id="closeDetailSheet">Fermer</button>
    </div>`;
  sheet.querySelector('#closeDetailSheet').onclick = () => sheet.remove();
  sheet.querySelector('#editCurrentBook').onclick = () => { populateForm(book); els.bookModal.showModal(); };
}

function resetForm() {
  state.currentEditId = null;
  els.deleteBookBtn.classList.add('hidden');
  Object.keys(fields).forEach(k => { fields[k].value = k === 'statusInput' ? 'to-read' : k === 'shelfInput' ? '1' : ''; });
}

function populateForm(book) {
  state.currentEditId = book.id;
  els.deleteBookBtn.classList.remove('hidden');
  fields.isbnInput.value = book.isbn || '';
  fields.titleInput.value = book.title || '';
  fields.authorInput.value = book.author || '';
  fields.genreInput.value = book.genre || '';
  fields.statusInput.value = book.status || 'to-read';
  fields.shelfInput.value = book.shelf || 1;
  fields.coverInput.value = book.cover || '';
  fields.noteInput.value = book.note || '';
}

function saveBookFromForm(e) {
  e.preventDefault();
  const payload = {
    id: state.currentEditId || crypto.randomUUID(),
    isbn: fields.isbnInput.value.trim(),
    title: fields.titleInput.value.trim(),
    author: fields.authorInput.value.trim(),
    genre: fields.genreInput.value.trim(),
    status: fields.statusInput.value,
    shelf: Number(fields.shelfInput.value) || 1,
    cover: fields.coverInput.value.trim(),
    note: fields.noteInput.value.trim(),
    added: state.currentEditId ? (state.books.find(b => b.id === state.currentEditId)?.added || today()) : today()
  };
  if (!payload.title || !payload.author) return;
  if (state.currentEditId) {
    state.books = state.books.map(b => b.id === state.currentEditId ? payload : b);
  } else {
    state.books.unshift(payload);
  }
  els.bookModal.close();
  resetForm();
  applyFilters();
}

function deleteCurrentBook() {
  if (!state.currentEditId) return;
  if (!confirm('Supprimer ce livre de votre bibliothèque ?')) return;
  state.books = state.books.filter(b => b.id !== state.currentEditId);
  els.bookModal.close();
  resetForm();
  document.querySelector('.detail-sheet')?.remove();
  applyFilters();
}

async function lookupBookByISBN() {
  const isbn = fields.isbnInput.value.replace(/[^0-9Xx]/g, '');
  if (!isbn) return;
  els.lookupBtn.textContent = '...';
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`);
    const data = await res.json();
    const details = data[`ISBN:${isbn}`]?.details;
    if (!details) { alert('Aucun résultat Open Library pour cet ISBN.'); return; }
    fields.titleInput.value = details.title || '';
    fields.authorInput.value = (details.authors || []).map(a => a.name).join(', ');
    fields.genreInput.value = (details.subjects || []).slice(0, 2).map(s => s.name || s).join(', ');
    fields.coverInput.value = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  } catch(e) {
    alert('Erreur lors de la recherche Open Library.');
  } finally {
    els.lookupBtn.textContent = 'Chercher';
  }
}

function exportBooks() {
  const blob = new Blob([JSON.stringify(state.books, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'books.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function pushToGithub() {
  state.github = {
    owner: ghFields.ghOwner.value.trim(),
    repo: ghFields.ghRepo.value.trim(),
    path: ghFields.ghPath.value.trim() || 'books.json',
    branch: ghFields.ghBranch.value.trim() || 'main',
    token: ghFields.ghToken.value.trim()
  };
  const { owner, repo, path, branch, token } = state.github;
  if (!owner || !repo || !token) { alert('Owner, repo et token sont requis.'); return; }
  els.pushGithub.textContent = 'Envoi...';
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let sha;
  try {
    const getRes = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getRes.ok) { const cur = await getRes.json(); sha = cur.sha; }
  } catch(e) {}
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(state.books, null, 2))));
  try {
    const putRes = await fetch(base, {
      method: 'PUT', headers,
      body: JSON.stringify({
        message: `Update books.json from Biblos (${new Date().toISOString()})`,
        content, sha, branch
      })
    });
    if (!putRes.ok) { const err = await putRes.text(); alert(`Erreur GitHub : ${err}`); return; }
    els.githubModal.close();
    alert('✓ books.json poussé avec succès sur GitHub.');
  } catch(e) {
    alert('Erreur réseau lors du push GitHub.');
  } finally {
    els.pushGithub.textContent = 'Pousser books.json';
  }
}

function today() { return new Date().toISOString().slice(0, 10); }

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${btn.dataset.view}View`).classList.add('active');
  });
});

els.search.addEventListener('input', applyFilters);
els.sort.addEventListener('change', applyFilters);
els.filter.addEventListener('change', applyFilters);
els.openAddModal.addEventListener('click', () => { resetForm(); els.bookModal.showModal(); });
els.form.addEventListener('submit', saveBookFromForm);
els.deleteBookBtn.addEventListener('click', deleteCurrentBook);
els.lookupBtn.addEventListener('click', lookupBookByISBN);
els.exportJson.addEventListener('click', exportBooks);
els.openGithubModal.addEventListener('click', () => els.githubModal.showModal());
els.pushGithub.addEventListener('click', pushToGithub);
els.prevCarousel.addEventListener('click', () => { state.currentCarouselIndex = Math.max(0, state.currentCarouselIndex - 1); renderCarousel(); });
els.nextCarousel.addEventListener('click', () => { const list = state.filtered.length ? state.filtered : state.books; state.currentCarouselIndex = Math.min(list.length - 1, state.currentCarouselIndex + 1); renderCarousel(); });

loadBooks();
