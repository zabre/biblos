import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  books: [],
  filtered: [],
  currentEditId: null,
  carouselIndex: 0,
  hoveredBook: null,
  selectedBookId: null,
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {
  searchInput: $('searchInput'),
  sortSelect: $('sortSelect'),
  filterSelect: $('filterSelect'),
  bookCount: $('bookCount'),
  shelfCount: $('shelfCount'),
  readingCount: $('readingCount'),
  openAddModal: $('openAddModal'),
  bookModal: $('bookModal'),
  bookForm: $('bookForm'),
  deleteBookBtn: $('deleteBookBtn'),
  modalFormTitle: $('modalFormTitle'),
  lookupBtn: $('lookupBtn'),
  exportJson: $('exportJson'),
  openGithubModal: $('openGithubModal'),
  githubModal: $('githubModal'),
  pushGithub: $('pushGithub'),
  carouselTrack: $('carouselTrack'),
  carouselTitle: $('carouselTitle'),
  carouselMeta: $('carouselMeta'),
  carouselNote: $('carouselNote'),
  prevCarousel: $('prevCarousel'),
  nextCarousel: $('nextCarousel'),
  detailSheet: $('detailSheet'),
  closeDetail: $('closeDetail'),
  dsCover: $('dsCover'),
  dsStatus: $('dsStatus'),
  dsTitle: $('dsTitle'),
  dsMeta: $('dsMeta'),
  dsNote: $('dsNote'),
  dsEdit: $('dsEdit'),
  shelfLabels: $('shelfLabels'),
  viewTitle: $('viewTitle'),
  libraryToolbar: $('libraryToolbar'),
};
const fields = {};
['isbnInput','titleInput','authorInput','genreInput','statusInput','shelfInput','coverInput','noteInput']
  .forEach(id => fields[id] = $(id));
const ghf = {};
['ghOwner','ghRepo','ghPath','ghBranch','ghToken'].forEach(id => ghf[id] = $(id));

// ─── THREE.JS SETUP ───────────────────────────────────────────────────────────
const wrap = $('threeWrap');
const canvas = $('threeCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 60);
camera.position.set(0, 0, 5.5);

const ambient = new THREE.AmbientLight(0xfff5e6, 0.55);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xfff8f0, 1.3);
sunLight.position.set(-3, 6, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 30;
sunLight.shadow.camera.left = -6;
sunLight.shadow.camera.right = 6;
sunLight.shadow.camera.top = 4;
sunLight.shadow.camera.bottom = -4;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xe8d8c0, 0.3);
fillLight.position.set(4, 2, 3);
scene.add(fillLight);

const texLoader = new THREE.TextureLoader();
const coverCache = {};

function loadCoverTexture(url) {
  if (!url) return null;
  if (coverCache[url]) return coverCache[url];
  const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&output=jpg`;
  const tex = texLoader.load(proxy, () => { needsRender = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  coverCache[url] = tex;
  return tex;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#b8895a');
  grad.addColorStop(0.18, '#c9a06b');
  grad.addColorStop(0.35, '#b8895a');
  grad.addColorStop(0.52, '#d4b07a');
  grad.addColorStop(0.7, '#b8895a');
  grad.addColorStop(0.88, '#c9a06b');
  grad.addColorStop(1, '#b8895a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 64);
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512;
    ctx.strokeStyle = i % 3 === 0 ? '#6b3e1a' : '#f5d8a0';
    ctx.lineWidth = Math.random() * 0.8 + 0.2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 20, 64); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}
const woodTex = makeWoodTexture();
const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.82, metalness: 0 });

const shelfGroups = [];
const bookMeshMap = {};
let needsRender = true;

const SHELF_W = 5.2;
const SHELF_GAP = 1.55;
const BOOK_H = 0.9;
const PLANK_H = 0.045;
const PLANK_D = 0.22;
const BOOK_SPACING = 0.145;

function buildPlank(y) {
  const geo = new THREE.BoxGeometry(SHELF_W, PLANK_H, PLANK_D);
  const mesh = new THREE.Mesh(geo, woodMat);
  mesh.position.set(0, y, 0);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function spineMaterialFromCover(coverUrl) {
  let hash = 0;
  for (let i = 0; i < (coverUrl || '').length; i++) hash = (hash * 31 + coverUrl.charCodeAt(i)) | 0;
  const h = Math.abs(hash) % 360;
  const s = 20 + (Math.abs(hash >> 4) % 30);
  const l = 55 + (Math.abs(hash >> 8) % 20);
  const color = new THREE.Color(`hsl(${h},${s}%,${l}%)`);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
}

function buildBook(book, xPos, shelfY) {
  const w = 0.105 + (book.title.length % 5) * 0.003;
  const thickness = 0.03 + (book.isbn?.length || 5) % 8 * 0.004;
  const group = new THREE.Group();
  group.userData = { bookId: book.id, baseX: xPos, baseY: shelfY + PLANK_H / 2 + BOOK_H / 2 + 0.002 };
  group.position.set(xPos, shelfY + PLANK_H / 2 + BOOK_H / 2 + 0.002, 0.01);
  const spineMat = spineMaterialFromCover(book.cover);
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 });
  const backMat = new THREE.MeshStandardMaterial({ color: spineMat.color.clone().multiplyScalar(0.9), roughness: 0.8 });
  const coverTex = loadCoverTexture(book.cover);
  const frontMat = coverTex
    ? new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.55 })
    : new THREE.MeshStandardMaterial({ color: spineMat.color, roughness: 0.6 });
  const geo = new THREE.BoxGeometry(w, BOOK_H, thickness);
  const mesh = new THREE.Mesh(geo, [spineMat, spineMat, pagesMat, pagesMat, frontMat, backMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.rotation.z = (Math.random() - 0.5) * 0.04;
  scene.add(group);
  bookMeshMap[book.id] = group;
  return group;
}

function clearScene() {
  shelfGroups.forEach(g => scene.remove(g));
  shelfGroups.length = 0;
  Object.keys(bookMeshMap).forEach(id => { scene.remove(bookMeshMap[id]); delete bookMeshMap[id]; });
  els.shelfLabels.innerHTML = '';
}

function buildScene(books) {
  clearScene();
  if (!books.length) return;
  const groups = {};
  books.forEach(book => { const k = Number(book.shelf) || 1; groups[k] ||= []; groups[k].push(book); });
  const shelfNums = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const totalShelves = shelfNums.length;
  const totalH = (totalShelves - 1) * SHELF_GAP;
  const startY = totalH / 2;
  shelfNums.forEach((num, si) => {
    const shelfY = startY - si * SHELF_GAP;
    const plank = buildPlank(shelfY);
    scene.add(plank);
    shelfGroups.push(plank);
    const booksOnShelf = groups[num];
    const totalW = booksOnShelf.length * BOOK_SPACING;
    const startX = -totalW / 2 + BOOK_SPACING / 2;
    booksOnShelf.forEach((book, bi) => buildBook(book, startX + bi * BOOK_SPACING, shelfY));
    updateShelfLabel(num, shelfY, booksOnShelf.length);
  });
  const fovRad = camera.fov * Math.PI / 180;
  const neededH = totalH + SHELF_GAP;
  const dist = (neededH / 2) / Math.tan(fovRad / 2) + 1.2;
  camera.position.set(0, startY - totalH / 2, Math.min(dist, 7.5));
  camera.lookAt(0, startY - totalH / 2, 0);
  needsRender = true;
}

function updateShelfLabel(num, worldY, count) {
  const label = document.createElement('div');
  label.className = 'shelf-label';
  label.setAttribute('data-shelf', num);
  label.textContent = `Étagère ${num} · ${count} livre${count > 1 ? 's' : ''}`;
  els.shelfLabels.appendChild(label);
  positionLabel(label, worldY);
}

function positionLabel(label, worldY) {
  const vec = new THREE.Vector3(-SHELF_W / 2 + 0.4, worldY + PLANK_H / 2 + BOOK_H + 0.12, 0);
  vec.project(camera);
  const x = (vec.x * 0.5 + 0.5) * wrap.clientWidth;
  const y = (-vec.y * 0.5 + 0.5) * wrap.clientHeight;
  label.style.left = x + 'px';
  label.style.top = y + 'px';
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let animFrames = {};

function getBookGroupFromIntersect(obj) {
  let o = obj;
  while (o) { if (o.userData?.bookId) return o; o = o.parent; }
  return null;
}

function animateBook(group, targetZ, targetY) {
  const id = group.userData.bookId;
  if (animFrames[id]) cancelAnimationFrame(animFrames[id]);
  const startZ = group.position.z;
  const startY = group.position.y;
  const t0 = performance.now();
  const dur = 320;
  function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    group.position.z = startZ + (targetZ - startZ) * ease;
    group.position.y = startY + (targetY - startY) * ease;
    needsRender = true;
    if (p < 1) animFrames[id] = requestAnimationFrame(tick);
    else delete animFrames[id];
  }
  animFrames[id] = requestAnimationFrame(tick);
}

canvas.addEventListener('mousemove', e => {
  const rect = wrap.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const allMeshes = Object.values(bookMeshMap).map(g => g.children[0]).filter(Boolean);
  const hits = raycaster.intersectObjects(allMeshes);
  const newHover = hits.length ? getBookGroupFromIntersect(hits[0].object) : null;
  if (newHover !== state.hoveredBook) {
    if (state.hoveredBook) { animateBook(state.hoveredBook, 0.01, state.hoveredBook.userData.baseY); canvas.style.cursor = 'default'; }
    if (newHover) { animateBook(newHover, 0.22, newHover.userData.baseY + 0.06); canvas.style.cursor = 'pointer'; }
    state.hoveredBook = newHover;
  }
});

canvas.addEventListener('mouseleave', () => {
  if (state.hoveredBook) { animateBook(state.hoveredBook, 0.01, state.hoveredBook.userData.baseY); state.hoveredBook = null; canvas.style.cursor = 'default'; }
});

canvas.addEventListener('click', e => {
  const rect = wrap.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const allMeshes = Object.values(bookMeshMap).map(g => g.children[0]).filter(Boolean);
  const hits = raycaster.intersectObjects(allMeshes);
  if (hits.length) { const group = getBookGroupFromIntersect(hits[0].object); if (group) showDetailSheet(group.userData.bookId); }
});

canvas.addEventListener('touchend', e => {
  if (e.changedTouches.length === 0) return;
  const t = e.changedTouches[0];
  const rect = wrap.getBoundingClientRect();
  mouse.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const allMeshes = Object.values(bookMeshMap).map(g => g.children[0]).filter(Boolean);
  const hits = raycaster.intersectObjects(allMeshes);
  if (hits.length) { const group = getBookGroupFromIntersect(hits[0].object); if (group) showDetailSheet(group.userData.bookId); }
});

function showDetailSheet(id) {
  const book = state.books.find(b => b.id === id);
  if (!book) return;
  state.selectedBookId = id;
  els.dsCover.src = safeCover(book.cover);
  els.dsCover.alt = book.title;
  els.dsStatus.textContent = labelStatus(book.status);
  els.dsTitle.textContent = book.title;
  els.dsMeta.textContent = `${book.author} · Étagère ${book.shelf} · ${book.genre || ''}`;
  els.dsNote.textContent = book.note || '';
  els.detailSheet.classList.remove('hidden');
}

els.closeDetail.addEventListener('click', () => { els.detailSheet.classList.add('hidden'); state.selectedBookId = null; });
els.dsEdit.addEventListener('click', () => { const book = state.books.find(b => b.id === state.selectedBookId); if (book) { populateForm(book); els.bookModal.showModal(); } });

let rafId;
function renderLoop() {
  rafId = requestAnimationFrame(renderLoop);
  if (!needsRender) return;
  renderer.render(scene, camera);
  needsRender = false;
}

function resizeRenderer() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  needsRender = true;
}

const ro = new ResizeObserver(resizeRenderer);
ro.observe(wrap);
resizeRenderer();
renderLoop();

async function loadBooks() {
  try {
    const r = await fetch('./books.json', { cache: 'no-store' });
    state.books = await r.json();
  } catch { state.books = []; }
  applyFilters();
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const filter = els.filterSelect.value;
  const sort = els.sortSelect.value;
  let list = state.books.filter(b => {
    const hay = [b.title, b.author, b.genre, b.note].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (filter === 'all' || b.status === filter);
  });
  list.sort((a, b) => {
    if (sort === 'title-asc') return a.title.localeCompare(b.title, 'fr');
    if (sort === 'author-asc') return a.author.localeCompare(b.author, 'fr');
    if (sort === 'shelf-asc') return Number(a.shelf) - Number(b.shelf);
    return new Date(b.added) - new Date(a.added);
  });
  state.filtered = list;
  renderStats();
  buildScene(state.filtered);
  renderCarousel();
}

function renderStats() {
  els.bookCount.textContent = state.books.length;
  els.shelfCount.textContent = new Set(state.books.map(b => b.shelf)).size;
  els.readingCount.textContent = state.books.filter(b => b.status === 'reading').length;
}

function renderCarousel() {
  const books = state.filtered.length ? state.filtered : state.books;
  els.carouselTrack.innerHTML = '';
  if (!books.length) return;
  state.carouselIndex = Math.min(state.carouselIndex, books.length - 1);
  books.forEach((book, i) => {
    const diff = i - state.carouselIndex;
    const card = document.createElement('article');
    card.className = 'carousel-item' + (i === state.carouselIndex ? ' is-active' : '');
    card.style.setProperty('--ry', `${diff * 10}deg`);
    card.innerHTML = `<img src="${safeCover(book.cover)}" alt="${book.title}" loading="lazy"><p class="book-title" style="margin-top:10px;font-size:14px;">${book.title}</p>`;
    card.addEventListener('click', () => { state.carouselIndex = i; renderCarousel(); });
    els.carouselTrack.appendChild(card);
  });
  const active = books[state.carouselIndex];
  els.carouselTitle.textContent = active.title;
  els.carouselMeta.textContent = `${active.author} · ${active.genre || 'Genre libre'} · ${labelStatus(active.status)}`;
  els.carouselNote.textContent = active.note || 'Aucune note personnelle.';
  const activeEl = els.carouselTrack.children[state.carouselIndex];
  if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

els.prevCarousel.addEventListener('click', () => { state.carouselIndex = Math.max(0, state.carouselIndex - 1); renderCarousel(); });
els.nextCarousel.addEventListener('click', () => { const l = (state.filtered.length || state.books.length); state.carouselIndex = Math.min(l - 1, state.carouselIndex + 1); renderCarousel(); });

function resetForm() {
  state.currentEditId = null;
  els.deleteBookBtn.classList.add('hidden');
  els.modalFormTitle.textContent = 'Nouveau volume';
  Object.entries(fields).forEach(([k, el]) => { el.value = k === 'statusInput' ? 'to-read' : k === 'shelfInput' ? '1' : ''; });
}

function populateForm(book) {
  state.currentEditId = book.id;
  els.deleteBookBtn.classList.remove('hidden');
  els.modalFormTitle.textContent = 'Modifier le livre';
  fields.isbnInput.value = book.isbn || '';
  fields.titleInput.value = book.title || '';
  fields.authorInput.value = book.author || '';
  fields.genreInput.value = book.genre || '';
  fields.statusInput.value = book.status || 'to-read';
  fields.shelfInput.value = book.shelf || 1;
  fields.coverInput.value = book.cover || '';
  fields.noteInput.value = book.note || '';
}

els.bookForm.addEventListener('submit', e => {
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
    added: state.currentEditId ? (state.books.find(b => b.id === state.currentEditId)?.added || today()) : today(),
  };
  if (!payload.title || !payload.author) return;
  if (state.currentEditId) { state.books = state.books.map(b => b.id === state.currentEditId ? payload : b); }
  else { state.books.unshift(payload); }
  els.bookModal.close();
  resetForm();
  applyFilters();
});

els.deleteBookBtn.addEventListener('click', () => {
  if (!state.currentEditId) return;
  if (!confirm('Supprimer ce livre ?')) return;
  state.books = state.books.filter(b => b.id !== state.currentEditId);
  els.bookModal.close();
  els.detailSheet.classList.add('hidden');
  resetForm();
  applyFilters();
});

els.lookupBtn.addEventListener('click', async () => {
  const isbn = fields.isbnInput.value.replace(/[^0-9Xx]/g, '');
  if (!isbn) return;
  els.lookupBtn.textContent = '…';
  try {
    const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`);
    const data = await r.json();
    const d = data[`ISBN:${isbn}`]?.details;
    if (!d) { alert('Aucun résultat pour cet ISBN.'); return; }
    fields.titleInput.value = d.title || '';
    fields.authorInput.value = (d.authors || []).map(a => a.name).join(', ');
    fields.genreInput.value = (d.subjects || []).slice(0, 2).map(s => s.name || s).join(', ');
    fields.coverInput.value = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  } catch { alert('Erreur réseau.'); }
  finally { els.lookupBtn.textContent = 'Chercher'; }
});

els.pushGithub.addEventListener('click', async () => {
  const owner = ghf.ghOwner.value.trim();
  const repo = ghf.ghRepo.value.trim();
  const path = ghf.ghPath.value.trim() || 'books.json';
  const branch = ghf.ghBranch.value.trim() || 'main';
  const token = ghf.ghToken.value.trim();
  if (!owner || !repo || !token) { alert('Owner, repo et token requis.'); return; }
  els.pushGithub.textContent = 'Envoi…';
  const headers = { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let sha;
  try { const r = await fetch(`${base}?ref=${branch}`, { headers }); if (r.ok) sha = (await r.json()).sha; } catch {}
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(state.books, null, 2))));
  try {
    const r = await fetch(base, { method: 'PUT', headers, body: JSON.stringify({ message: `Update books.json (${new Date().toISOString()})`, content, sha, branch }) });
    if (!r.ok) { alert('Erreur GitHub : ' + await r.text()); return; }
    els.githubModal.close();
    alert('✓ books.json poussé sur GitHub.');
  } catch { alert('Erreur réseau.'); }
  finally { els.pushGithub.textContent = 'Pousser books.json'; }
});

els.exportJson.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state.books, null, 2)], { type: 'application/json' }));
  a.download = 'books.json';
  a.click();
});

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(`${btn.dataset.view}View`).classList.add('active');
    const titles = { library: 'Mes étagères', carousel: 'Coverflow', settings: 'Paramètres' };
    els.viewTitle.textContent = titles[btn.dataset.view] || '';
    els.libraryToolbar.style.display = btn.dataset.view === 'library' ? '' : 'none';
    if (btn.dataset.view === 'library') { resizeRenderer(); needsRender = true; }
  });
});

els.openAddModal.addEventListener('click', () => { resetForm(); els.bookModal.showModal(); });
els.openGithubModal.addEventListener('click', () => els.githubModal.showModal());
els.searchInput.addEventListener('input', applyFilters);
els.sortSelect.addEventListener('change', applyFilters);
els.filterSelect.addEventListener('change', applyFilters);

function safeCover(url) { return url || 'https://placehold.co/300x450/ede5d6/7c7268?text=—'; }
function labelStatus(s) { return { read: 'Lu', reading: 'En cours', 'to-read': 'À lire' }[s] || s; }
function today() { return new Date().toISOString().slice(0, 10); }

loadBooks();