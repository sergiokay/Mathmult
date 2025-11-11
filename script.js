/* Blackink — precios en vivo + políticas por modelo + PDF con texto envuelto */

const textoEl = document.getElementById('texto');
const themeToggle = document.getElementById('theme-toggle');
const tabs = document.querySelectorAll('.tab');

const contFuentes = document.getElementById('fuentes');
const contModelos = document.getElementById('modelos');
const contFavoritos = document.getElementById('favoritos');
const contCompras = document.getElementById('comprar');
const contPedidos = document.getElementById('pedidos');

const templateFuente = document.getElementById('template-fuente');
const templateModelo = document.getElementById('template-modelo');

/* Modal (compat) */
const modal = document.getElementById('pedido-modal');
const closeModalBtn = document.getElementById('close-pedido');
const pedidoTamanoSel = document.getElementById('pedido-tamano');
const pedidoPrecioEl  = document.getElementById('pedido-precio');
const pedidoTotalEl   = document.getElementById('pedido-total');
const pedidoCantEl    = document.getElementById('pedido-cantidad');

let fuentes = [];
let modelos = [];
let favoritas = JSON.parse(localStorage.getItem('favoritas')) || [];
let comprasFuentes = JSON.parse(localStorage.getItem('comprasFuentes')) || [];
let comprasModelos = JSON.parse(localStorage.getItem('comprasModelos')) || [];
let seleccionModelPorFuente = JSON.parse(localStorage.getItem('selModelPorFuente')) || {};
let pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

/* === Datos remotos / locales === */
let precios = null;
let politicasModelos = JSON.parse(localStorage.getItem('politicasModelos')) || {}; // { "modelo.svg": {soloPaquete:true/false} }
let preciosHash = ''; // para detectar cambios
let politicasHash = '';

/* === Tema === */
let tema = localStorage.getItem('theme') || 'dark';
document.body.setAttribute('data-theme', tema === 'dark' ? 'dark' : 'light');
themeToggle.textContent = tema === 'dark' ? '☀️' : '🌙';
themeToggle.addEventListener('click', () => {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
});

/* === Tabs === */
tabs.forEach(t => t.addEventListener('click', () => {
  document.querySelector('.tab.active').classList.remove('active');
  t.classList.add('active');
  mostrarSeccion(t.dataset.tab);
}));
function mostrarSeccion(tab) {
  [contFuentes, contModelos, contFavoritos, contCompras, contPedidos].forEach(el => el.classList.add('hidden'));
  if (tab === 'fuentes') contFuentes.classList.remove('hidden');
  if (tab === 'modelos') contModelos.classList.remove('hidden');
  if (tab === 'favoritos') contFavoritos.classList.remove('hidden');
  if (tab === 'comprar') contCompras.classList.remove('hidden');
  if (tab === 'pedidos') contPedidos.classList.remove('hidden');
  render(tab);
}

/* ============================================================
   === SOPORTE GITHUB PAGES: cargar desde index.json (fallback)
   ============================================================ */
async function cargarDesdeIndexJSON(){
  try{
    const r = await fetch('./index.json', { cache:'no-store' });
    if(!r.ok) return false;
    const data = await r.json();

    // Normalizar FUENTES: aceptar "nombre.ttf" o "ruta/nombre.ttf"
    const arrFuentes = Array.isArray(data.fuentes) ? data.fuentes : [];
    for (const entry of arrFuentes){
      // Si viene como ruta, úsala para FontFace; el "nombre" será el filename sin extensión
      const isPath = /[\\/]/.test(entry);
      const filename = isPath ? entry.split('/').pop() : entry;
      const family = filename.replace(/\.[^/.]+$/,'');
      try{
        const url = isPath ? entry : `fuentes/${entry}`;
        const ff = new FontFace(family, `url(${url})`);
        await ff.load(); document.fonts.add(ff);
      }catch{}
      if(!fuentes.includes(family)) fuentes.push(family);
    }

    // Normalizar MODELOS: aceptar "ala.svg" o "vectores/ala.svg"
    const arrModelos = Array.isArray(data.modelos) ? data.modelos : [];
    for (const entry of arrModelos){
      const nameOnly = entry.split('/').pop(); // el resto del código hace img.src = `vectores/${nombre}`
      if(!modelos.includes(nameOnly)) modelos.push(nameOnly);
    }
    return true;
  }catch{
    return false;
  }
}

/* === Carga de recursos === */
async function cargarFuentes() {
  // 1) Intento listar carpeta (funciona en local con servidor)
  try {
    const r = await fetch('./fuentes/');
    if (!r.ok) throw 0;
    const html = await r.text();
    const re = /href="([^"]+\.(ttf|otf|woff2?|woff))"/gi;
    const arr = [...html.matchAll(re)].map(m => m[1]);
    fuentes = arr.map(a => a.split('/').pop().replace(/\.[^/.]+$/,''));
    for (const path of arr){
      try {
        const filename = path.split('/').pop();
        const family = filename.replace(/\.[^/.]+$/,'');
        const ff = new FontFace(family, `url(fuentes/${filename})`);
        await ff.load(); document.fonts.add(ff);
      } catch(e){}
    }
    // Si se logró, salimos
    if (fuentes.length) return;
  } catch(e){
    // Ignoramos, haremos fallback
  }

  // 2) Fallback a index.json (GitHub Pages u otros entornos)
  const ok = await cargarDesdeIndexJSON();
  if (!ok && contFuentes){
    contFuentes.innerHTML = `<p style="color:#ffb4b4">No se pudieron listar las fuentes. Verifica /fuentes/ o index.json</p>`;
  }
}

async function cargarModelos() {
  // 1) Intento listar carpeta (funciona en local con servidor)
  try {
    const r = await fetch('./vectores/');
    if (!r.ok) throw 0;
    const html = await r.text();
    const re = /href="([^"]+\.(svg|png|jpg|jpeg|webp))"/gi;
    const arr = [...html.matchAll(re)].map(m => m[1]);
    modelos = arr.map(a => a.split('/').pop());
    if (modelos.length) return;
  } catch(e){
    // Ignoramos, haremos fallback
  }

  // 2) Fallback a index.json (GitHub Pages u otros entornos)
  const ok = await cargarDesdeIndexJSON();
  if (!ok && contModelos){
    contModelos.innerHTML = `<p style="color:#ffb4b4">No se pudieron listar los modelos. Verifica /vectores/ o index.json</p>`;
  }
}

async function cargarPreciosDesdeArchivo(){
  try{
    const r = await fetch('./data/precios.json', { cache:'no-store' });
    if (!r.ok) throw 0;
    const json = await r.json();
    precios = json;
    localStorage.setItem('precios', JSON.stringify(precios));
    preciosHash = JSON.stringify(precios);
  }catch{
    const stored = localStorage.getItem('precios');
    precios = stored ? JSON.parse(stored) : [
      {"tamaño":"Pequeño","precio":120,"paquete":false},
      {"tamaño":"Mediano","precio":180,"paquete":false},
      {"tamaño":"Grande","precio":250,"paquete":true}
    ];
    preciosHash = JSON.stringify(precios);
    localStorage.setItem('precios', JSON.stringify(precios));
  }
}
async function cargarPoliticasDesdeArchivo(){
  try{
    const r = await fetch('./data/politicas_modelos.json', { cache:'no-store' });
    if (!r.ok) throw 0;
    const json = await r.json();
    politicasModelos = json || {};
    localStorage.setItem('politicasModelos', JSON.stringify(politicasModelos));
    politicasHash = JSON.stringify(politicasModelos);
  }catch{
    const stored = localStorage.getItem('politicasModelos');
    politicasModelos = stored ? JSON.parse(stored) : {};
    politicasHash = JSON.stringify(politicasModelos);
  }
}

/* === Watchers: actualiza si el JSON cambia === */
async function checkPreciosUpdate(){
  try{
    const r = await fetch('./data/precios.json', { cache:'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    const h = JSON.stringify(j);
    if (h !== preciosHash){
      precios = j;
      preciosHash = h;
      localStorage.setItem('precios', JSON.stringify(precios));
      if (!contCompras.classList.contains('hidden')) render('comprar');
    }
  }catch{}
}
async function checkPoliticasUpdate(){
  try{
    const r = await fetch('./data/politicas_modelos.json', { cache:'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    const h = JSON.stringify(j||{});
    if (h !== politicasHash){
      politicasModelos = j || {};
      politicasHash = h;
      localStorage.setItem('politicasModelos', JSON.stringify(politicasModelos));
      if (!contCompras.classList.contains('hidden')) render('comprar');
    }
  }catch{}
}
function watchJSON(){
  // polling cada 5s
  setInterval(()=>{ checkPreciosUpdate(); checkPoliticasUpdate(); }, 5000);
  // al volver foco / visibilidad
  window.addEventListener('focus', ()=>{ checkPreciosUpdate(); checkPoliticasUpdate(); });
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden){ checkPreciosUpdate(); checkPoliticasUpdate(); } });
  // sincronizar por storage (cuando Admin guarda)
  window.addEventListener('storage', (ev)=>{
    if (ev.key === 'precios' && ev.newValue){
      try{
        const j = JSON.parse(ev.newValue); const h = JSON.stringify(j);
        if (h !== preciosHash){ precios = j; preciosHash = h; if (!contCompras.classList.contains('hidden')) render('comprar'); }
      }catch{}
    }
    if (ev.key === 'politicasModelos' && ev.newValue){
      try{
        const j = JSON.parse(ev.newValue); const h = JSON.stringify(j);
        if (h !== politicasHash){ politicasModelos = j; politicasHash = h; if (!contCompras.classList.contains('hidden')) render('comprar'); }
      }catch{}
    }
  });
}

/* === Helpers storage === */
const saveFavoritas = ()=> localStorage.setItem('favoritas', JSON.stringify(favoritas));
const saveCompras   = ()=> { localStorage.setItem('comprasFuentes', JSON.stringify(comprasFuentes)); localStorage.setItem('comprasModelos', JSON.stringify(comprasModelos)); };
const saveSel       = ()=> localStorage.setItem('selModelPorFuente', JSON.stringify(seleccionModelPorFuente));
const savePedidos   = ()=> localStorage.setItem('pedidos', JSON.stringify(pedidos));
const saveCarrito   = ()=> localStorage.setItem('carrito', JSON.stringify(carrito));

/* === Render switch === */
function render(tab='fuentes'){
  if (tab === 'fuentes') renderFuentes();
  if (tab === 'modelos') renderModelos();
  if (tab === 'favoritos') renderFavoritos();
  if (tab === 'comprar') renderCompras();
  if (tab === 'pedidos') renderPedidos();
}

/* === Reglas por modelo === */
function modeloSoloPaquete(modeloNombre){
  if (!modeloNombre || modeloNombre==='solo-letras' || modeloNombre==='sin-vector') return false;
  const pol = politicasModelos[modeloNombre];
  return !!(pol && pol.soloPaquete);
}

/* === FUENTES (badge=carrito por fuente) === */
function crearCardFuente(nombre){
  const node = templateFuente.content.cloneNode(true);
  const root = node.querySelector('.fuente-item');
  const preview = node.querySelector('.preview-text');
  const nombreEl = node.querySelector('.meta .nombre');
  const favBtn = node.querySelector('.btn-fav');
  const buyBtn = node.querySelector('.btn-buy');
  const badge = node.querySelector('.badge');

  preview.textContent = textoEl.value || nombre;
  preview.style.fontFamily = `'${nombre}', system-ui, sans-serif`;
  nombreEl.textContent = nombre;

  const count = carrito.filter(li => li.fuente === nombre).length;
  if (count>0){ badge.textContent = count; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); }

  if (favoritas.includes(nombre)) { root.classList.add('fav'); favBtn.classList.add('active'); favBtn.textContent = '★ Favorito' } 
  else { favBtn.textContent = '☆ Favorito' }

  if (comprasFuentes.includes(nombre)) { root.classList.add('buy'); buyBtn.classList.add('active'); buyBtn.textContent = '🛒 En compras' } 
  else { buyBtn.textContent = '➕ Comprar' }

  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favoritas.includes(nombre)) { favoritas = favoritas.filter(f=>f!==nombre); favBtn.classList.remove('active'); favBtn.textContent='☆ Favorito'; root.classList.remove('fav'); }
    else { favoritas.push(nombre); favBtn.classList.add('active'); favBtn.textContent='★ Favorito'; root.classList.add('fav'); }
    saveFavoritas(); render(document.querySelector('.tab.active').dataset.tab);
  });

  buyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (comprasFuentes.includes(nombre)) { 
      comprasFuentes = comprasFuentes.filter(f=>f!==nombre);
      carrito = carrito.filter(li=> li.fuente !== nombre);
      saveCarrito();
      delete seleccionModelPorFuente[nombre];
      saveSel();
      buyBtn.classList.remove('active'); buyBtn.textContent='➕ Comprar'; root.classList.remove('buy'); 
    } else { 
      comprasFuentes.push(nombre); 
      buyBtn.classList.add('active'); buyBtn.textContent='🛒 En compras'; root.classList.add('buy'); 
    }
    saveCompras(); render(document.querySelector('.tab.active').dataset.tab);
  });

  return node;
}
function renderFuentes(){
  contFuentes.innerHTML = '';
  if (!fuentes.length) { contFuentes.innerHTML = '<p class="hint">No se encontraron fuentes</p>'; return; }
  fuentes.forEach(name => contFuentes.appendChild(crearCardFuente(name)));
}

/* === MODELOS === */
function crearCardModelo(nombreArchivo){
  const node = templateModelo.content.cloneNode(true);
  const root = node.querySelector('.modelo-item');
  const img = node.querySelector('img');
  const nombreEl = node.querySelector('.meta .nombre');
  const favBtn = node.querySelector('.btn-fav');
  const buyBtn = node.querySelector('.btn-buy');

  img.src = `vectores/${nombreArchivo}`;
  if (nombreArchivo.endsWith('.svg')) img.classList.add('svg-thumb');
  nombreEl.textContent = nombreArchivo;

  if (favoritas.includes(nombreArchivo)) { root.classList.add('fav'); favBtn.classList.add('active'); favBtn.textContent = '★ Favorito'} else favBtn.textContent='☆ Favorito';
  if (comprasModelos.includes(nombreArchivo)) { root.classList.add('buy'); buyBtn.classList.add('active'); buyBtn.textContent='🛒 En compras'} else buyBtn.textContent='➕ Comprar';

  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favoritas.includes(nombreArchivo)) { favoritas = favoritas.filter(x=>x!==nombreArchivo); favBtn.classList.remove('active'); favBtn.textContent='☆ Favorito'; root.classList.remove('fav'); }
    else { favoritas.push(nombreArchivo); favBtn.classList.add('active'); favBtn.textContent='★ Favorito'; root.classList.add('fav'); }
    saveFavoritas(); render(document.querySelector('.tab.active').dataset.tab);
  });

  buyBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (comprasModelos.includes(nombreArchivo)) {
      comprasModelos = comprasModelos.filter(x=>x!==nombreArchivo);
      for (let f in seleccionModelPorFuente) if (seleccionModelPorFuente[f] === nombreArchivo) seleccionModelPorFuente[f] = 'solo-letras';
      saveSel();
      buyBtn.classList.remove('active'); buyBtn.textContent='➕ Comprar'; root.classList.remove('buy');
    } else {
      comprasModelos.push(nombreArchivo);
      buyBtn.classList.add('active'); buyBtn.textContent='🛒 En compras'; root.classList.add('buy');
    }
    saveCompras(); render(document.querySelector('.tab.active').dataset.tab);
  });

  return node;
}
function renderModelos(){
  contModelos.innerHTML = '';
  if (!modelos.length) { contModelos.innerHTML = '<p class="hint">No se encontraron modelos</p>'; return; }
  modelos.forEach(m => contModelos.appendChild(crearCardModelo(m)));
}

/* === FAVORITOS === */
function renderFavoritos(){
  contFavoritos.innerHTML = '';
  if (!favoritas.length){ contFavoritos.innerHTML = '<p class="hint">(No hay favoritos)</p>'; return; }

  const favFuentes = favoritas.filter(n => fuentes.includes(n));
  const favModelos = favoritas.filter(n => modelos.includes(n));

  if (favFuentes.length){
    const bloqF = document.createElement('div'); bloqF.className = 'favoritos-bloque';
    bloqF.innerHTML = '<h3>Fuentes favoritas</h3>';
    favFuentes.forEach(name => bloqF.appendChild(crearCardFuente(name)));
    contFavoritos.appendChild(bloqF);
  }
  if (favModelos.length){
    const bloqM = document.createElement('div'); bloqM.className = 'favoritos-bloque';
    bloqM.innerHTML = '<h3>Modelos favoritos</h3>';
    const wrap = document.createElement('div'); wrap.className = 'modelos-lista';
    favModelos.forEach(m => wrap.appendChild(crearCardModelo(m)));
    bloqM.appendChild(wrap);
    contFavoritos.appendChild(bloqM);
  }
}

/* === COMPRAS === */
function renderCompras(){
  contCompras.innerHTML = '';

  const secF = document.createElement('div'); secF.className='seccion';
  secF.innerHTML = '<h3>Fuentes compradas</h3>';
  if (!comprasFuentes.length){
    secF.innerHTML += '<p class="hint">(No hay fuentes en compras)</p>';
  } else {
    comprasFuentes.forEach(f=>{
      const item = document.createElement('div'); item.className='fuente-item';

      // preview
      const preview = document.createElement('div'); preview.className='preview-text';
      preview.style.fontFamily = `'${f}', system-ui, sans-serif`; preview.textContent = textoEl.value || f;
      item.appendChild(preview);

      // selector de modelo
      item.appendChild(crearSelectorGraficoCompras(f));

      // mock + caption
      const mock = document.createElement('div'); mock.className='mockup';
      const mockText = document.createElement('div'); mockText.className='mock-text';
      mockText.style.fontFamily = `'${f}', system-ui, sans-serif`; mockText.textContent = textoEl.value || f;
      const mockImg = document.createElement('div'); mockImg.className='mock-img';
      const sel = seleccionModelPorFuente[f] || 'solo-letras';
      if (sel !== 'solo-letras' && sel !== 'sin-vector' && comprasModelos.includes(sel)) {
        const img2 = document.createElement('img'); img2.src = `vectores/${sel}`;
        if (sel.endsWith('.svg')) img2.classList.add('svg-thumb');
        mockImg.appendChild(img2);
      } else {
        mockImg.textContent = (sel === 'solo-letras') ? 'Solo las letras' : 'Sin vector';
      }
      mock.appendChild(mockText); mock.appendChild(mockImg);
      item.appendChild(mock);

      const caption = document.createElement('div'); caption.className='mock-caption';
      caption.textContent = `Texto: "${textoEl.value || f}"  •  Fuente: ${f}`;
      item.appendChild(caption);

      // controles: tamaño (filtrado), tipo (respeta política), cantidad, agregar
      const ctrls = document.createElement('div'); ctrls.className='controls-line';
      const selTam = document.createElement('select'); selTam.className = 'select';

      const tipoWrap = document.createElement('div'); tipoWrap.className='qty-row';
      const rUnidad = document.createElement('input'); rUnidad.type='radio'; rUnidad.name=`tipo-${f}-${Math.random()}`; rUnidad.value='unidad'; rUnidad.checked=true;
      const lUnidad = document.createElement('label'); lUnidad.appendChild(rUnidad); lUnidad.appendChild(document.createTextNode(' Unidad'));
      const rPaquete = document.createElement('input'); rPaquete.type='radio'; rPaquete.name=rUnidad.name; rPaquete.value='paquete';
      const lPaquete = document.createElement('label'); lPaquete.appendChild(rPaquete); lPaquete.appendChild(document.createTextNode(' Paquete'));
      tipoWrap.appendChild(lUnidad); tipoWrap.appendChild(lPaquete);

      const qty = document.createElement('input'); qty.type='number'; qty.min='1'; qty.step='1'; qty.value='1'; qty.className='input-qty';

      const aplicarPolitica = ()=>{
        const selModelo = seleccionModelPorFuente[f] || 'solo-letras';
        const mustPack = modeloSoloPaquete(selModelo);
        rUnidad.disabled = mustPack;
        if (mustPack){ rPaquete.checked = true; }
        // llenar precios en base al tipo activo (y política)
        fillPrices();
      };

      const fillPrices = ()=>{
        const wantPack = rPaquete.checked || rUnidad.disabled; // si política exige paquete, fuerza paquete
        const lista = (precios||[]).filter(p => !!p.paquete === wantPack);
        selTam.innerHTML = '';
        if (!lista.length){
          const opt = document.createElement('option'); opt.value='-1'; opt.textContent='(Sin tamaños para este tipo)';
          selTam.appendChild(opt);
        } else {
          lista.forEach(p=>{
            const opt = document.createElement('option');
            opt.value = String(precios.indexOf(p));
            opt.textContent = `${p.tamaño} — $${p.precio}${p.paquete?' (Paquete)':''}`;
            selTam.appendChild(opt);
          });
        }
      };

      rUnidad.addEventListener('change', fillPrices);
      rPaquete.addEventListener('change', fillPrices);

      aplicarPolitica(); // set disabled/checked + cargar precios

      const btnAdd = document.createElement('button'); btnAdd.className='btn btn-buy'; btnAdd.textContent='Agregar al carrito';
      btnAdd.addEventListener('click', ()=>{
        const idx = Number(selTam.value);
        if (idx<0){ alert('No hay tamaños disponibles para este tipo.'); return; }
        const precioSel = precios[idx] || {tamaño:'N/A', precio:0, paquete:false};
        const tipoBool = rPaquete.checked || rUnidad.disabled; // respeta política
        const linea = {
          id: Date.now() + Math.random().toString(16).slice(2),
          fuente: f,
          modelo: (seleccionModelPorFuente[f]||'solo-letras'),
          texto: textoEl.value || f,
          tamano: precioSel.tamaño,
          precio: precioSel.precio,
          paquete: tipoBool,
          cantidad: Math.max(1, Number(qty.value)||1),
        };
        carrito.push(linea);
        saveCarrito();
        render('comprar');
      });

      ctrls.appendChild(selTam);
      ctrls.appendChild(tipoWrap);
      ctrls.appendChild(qty);
      ctrls.appendChild(btnAdd);
      item.appendChild(ctrls);

      secF.appendChild(item);
    });
  }
  contCompras.appendChild(secF);

  // Carrito
  contCompras.appendChild(renderCarrito());

  // Modelos comprados (informativo)
  const secM = document.createElement('div'); secM.className='seccion';
  secM.innerHTML = '<h3>Modelos comprados</h3>';
  if (!comprasModelos.length) {
    secM.innerHTML += '<p class="hint">(No hay modelos en compras)</p>';
  } else {
    const contMini = document.createElement('div'); contMini.className='modelo-miniatura';
    comprasModelos.forEach(m=>{
      const mini = document.createElement('div'); mini.className='mini';
      const img = document.createElement('img'); img.src=`vectores/${m}`; img.alt=m;
      if (m.endsWith('.svg')) img.classList.add('svg-thumb');
      mini.appendChild(img);
      contMini.appendChild(mini);
    });
    secM.appendChild(contMini);
  }
  contCompras.appendChild(secM);
}

/* Selector gráfico en Compras */
function crearSelectorGraficoCompras(fuenteNombre){
  const wrap = document.createElement('div'); wrap.className = 'selector-modelo';

  const principal = document.createElement('div'); principal.className = 'selector-principal';
  const pThumb = document.createElement('div'); pThumb.className = 'thumb';
  const pImg = document.createElement('img');
  const pInfo = document.createElement('div'); pInfo.className='info';
  const pName = document.createElement('strong');
  const pHint = document.createElement('small'); pHint.className='hint'; pHint.textContent='Haz clic para seleccionar un modelo';
  pInfo.appendChild(pName); pInfo.appendChild(pHint);
  const pToggle = document.createElement('button'); pToggle.className='btn'; pToggle.textContent='Ver lista';
  principal.appendChild(pThumb); principal.appendChild(pInfo); principal.appendChild(pToggle);
  setPrincipal();

  const drop = document.createElement('div'); drop.className = 'selector-desplegable hidden';
  const grid = document.createElement('div'); grid.className = 'selector-grid-modelos';
  grid.style.maxHeight = '220px';

  grid.appendChild(crearMiniCardEspecial('Solo las letras', 'solo-letras'));
  grid.appendChild(crearMiniCardEspecial('Sin vector', 'sin-vector'));
  comprasModelos.forEach(m=>{ grid.appendChild(crearMiniCardModelo(m)); });

  const actions = document.createElement('div'); actions.className='selector-actions';
  const btnExpand = document.createElement('button'); btnExpand.className='btn'; btnExpand.textContent='Ver más';
  btnExpand.addEventListener('click', ()=>{
    if (grid.style.maxHeight === '420px') { grid.style.maxHeight = '220px'; btnExpand.textContent='Ver más'; }
    else { grid.style.maxHeight = '420px'; btnExpand.textContent='Ver menos'; }
  });

  pToggle.addEventListener('click', (e)=>{ e.stopPropagation(); drop.classList.toggle('hidden'); });
  principal.addEventListener('click', ()=> drop.classList.toggle('hidden'));

  drop.appendChild(grid);
  drop.appendChild(actions);
  wrap.appendChild(principal);
  wrap.appendChild(drop);
  return wrap;

  function setPrincipal(){
    const sel = seleccionModelPorFuente[fuenteNombre] || 'solo-letras';
    pName.textContent = (sel === 'solo-letras') ? 'Solo las letras' : (sel === 'sin-vector') ? 'Sin vector' : sel;
    pImg.removeAttribute('src'); pImg.classList.remove('svg-thumb');
    if (sel !== 'solo-letras' && sel !== 'sin-vector'){
      pImg.src = `vectores/${sel}`;
      if (sel.endsWith('.svg')) pImg.classList.add('svg-thumb');
    }
    pThumb.innerHTML = ''; pThumb.appendChild(pImg);
  }
  function crearMiniCardEspecial(label, key){
    const card = document.createElement('div'); card.className = 'modelo-item';
    const box = document.createElement('div');
    box.style.width='100%'; box.style.height='120px';
    box.style.display='flex'; box.style.alignItems='center'; box.style.justifyContent='center';
    box.style.background='rgba(255,255,255,0.02)';
    box.style.borderRadius='6px';
    box.style.fontWeight='700'; box.style.color='var(--text)';
    box.textContent = label;

    const meta = document.createElement('div'); meta.className='meta';
    const nombre = document.createElement('div'); nombre.className='nombre'; nombre.textContent = label;
    const btns = document.createElement('div'); btns.className='botones';
    const elegir = document.createElement('button'); elegir.className='btn btn-buy'; elegir.textContent='Elegir';
    elegir.addEventListener('click', ()=>{ seleccionModelPorFuente[fuenteNombre] = key; saveSel(); setPrincipal(); render('comprar'); });
    btns.appendChild(elegir); meta.appendChild(nombre); meta.appendChild(btns);
    card.appendChild(box); card.appendChild(meta);
    return card;
  }
  function crearMiniCardModelo(m){
    const card = document.createElement('div'); card.className = 'modelo-item';
    const img = document.createElement('img'); img.src = `vectores/${m}`; img.alt=m;
    if (m.endsWith('.svg')) img.classList.add('svg-thumb');
    const meta = document.createElement('div'); meta.className='meta';
    const nombre = document.createElement('div'); nombre.className='nombre'; nombre.textContent = m;
    const btns = document.createElement('div'); btns.className='botones';
    const elegir = document.createElement('button'); elegir.className='btn btn-buy'; elegir.textContent='Elegir';
    elegir.addEventListener('click', ()=>{ seleccionModelPorFuente[fuenteNombre] = m; saveSel(); setPrincipal(); render('comprar'); });
    btns.appendChild(elegir); meta.appendChild(nombre); meta.appendChild(btns);
    card.appendChild(img); card.appendChild(meta);
    return card;
  }
}

/* === Carrito === */
function renderCarrito(){
  const sec = document.createElement('div'); sec.className='seccion carrito';
  sec.innerHTML = '<h3>Carrito</h3>';

  if (!carrito.length){
    sec.innerHTML += '<p class="hint">(Vacío: agrega líneas desde la sección de fuentes)</p>';
    return sec;
  }

  const header = document.createElement('div'); header.className='cart-row cart-header';
  header.innerHTML = '<div>Vista previa</div><div>Fuente / Texto / Modelo</div><div>Tamaño</div><div>Tipo/Cant</div><div>Total</div>';
  sec.appendChild(header);

  let totalGeneral = 0;
  carrito.forEach((li, idx)=>{
    const row = document.createElement('div'); row.className='cart-row';

    const col0 = document.createElement('div'); const th = document.createElement('div'); th.className='thumb';
    if (li.modelo && li.modelo !== 'solo-letras' && li.modelo !== 'sin-vector'){
      const im = document.createElement('img'); im.src=`vectores/${li.modelo}`; if (li.modelo.endsWith('.svg')) im.classList.add('svg-thumb'); th.appendChild(im);
    } else {
      th.textContent = (li.modelo === 'solo-letras' || !li.modelo) ? 'Solo letras' : 'Sin vector';
    }
    col0.appendChild(th);

    const col1 = document.createElement('div');
    col1.innerHTML = `<div><strong>${li.fuente}</strong></div><div class="hint">“${li.texto}”</div><div class="hint">${li.modelo || 'Solo las letras'}</div>`;

    const col2 = document.createElement('div'); col2.textContent = li.tamano;
    const col3 = document.createElement('div'); col3.textContent = `${li.paquete?'Paquete':'Unidad'} × ${li.cantidad}`;
    const lineTotal = (li.precio * li.cantidad);
    totalGeneral += lineTotal;
    const col4 = document.createElement('div'); 
    col4.innerHTML = `$${lineTotal.toFixed(2)} <span class="cart-actions"><button class="btn">Eliminar</button></span>`;
    col4.querySelector('button').addEventListener('click', ()=>{
      carrito.splice(idx,1);
      saveCarrito();
      render('comprar');
    });

    row.appendChild(col0); row.appendChild(col1); row.appendChild(col2); row.appendChild(col3); row.appendChild(col4);
    sec.appendChild(row);
  });

  const bar = document.createElement('div'); bar.className='cart-total-bar';
  const totalEl = document.createElement('div'); totalEl.innerHTML = `<strong>Total general:</strong> $${totalGeneral.toFixed(2)}`;
  const gen = document.createElement('button'); gen.className='btn btn-buy'; gen.textContent='Generar pedido (Carrito)';
  gen.addEventListener('click', async ()=>{
    const pedido = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      marca: 'Blackink',
      items: carrito.map(li=>({
        fuente: li.fuente,
        modelo: (li.modelo==='solo-letras'||li.modelo==='sin-vector')?null:li.modelo,
        texto: li.texto,
        tamano: li.tamano,
        precio: li.precio,
        cantidad: li.cantidad,
        paquete: !!li.paquete
      })),
      total: Number(totalGeneral.toFixed(2))
    };
    pedidos.push(pedido);
    savePedidos();
    await generarPDFPedidoMultiple(pedido);
  });

  bar.appendChild(totalEl); bar.appendChild(gen);
  sec.appendChild(bar);
  return sec;
}

/* === PEDIDOS (igual que antes) === */
function renderPedidos(){
  contPedidos.innerHTML = '<h3>Pedidos guardados</h3>';
  if (!pedidos.length){ contPedidos.innerHTML += '<p class="hint">(No hay pedidos aún)</p>'; return; }

  pedidos.forEach((p, i)=>{
    const item = document.createElement('div'); item.className = 'pedido-item';
    const left = document.createElement('div'); left.className = 'left';

    const img = document.createElement('img');
    const first = (p.items && p.items[0]) ? p.items[0] : null;
    if (first && first.modelo){ img.src = `vectores/${first.modelo}`; if (first.modelo.endsWith('.svg')) img.classList.add('svg-thumb'); }
    const info = document.createElement('div');
    info.innerHTML = `<div><strong>Pedido #${p.id}</strong> — ${p.items.length} líneas — Total: $${p.total}</div>
                      <div class="hint">Fecha: ${new Date(p.fecha).toLocaleString()}</div>`;
    left.appendChild(img); left.appendChild(info);

    const actions = document.createElement('div');
    const dl = document.createElement('button'); dl.className='btn'; dl.textContent='Descargar PDF';
    dl.addEventListener('click', async ()=> { await generarPDFPedidoMultiple(p); });
    const del = document.createElement('button'); del.className='btn'; del.textContent='Eliminar';
    del.addEventListener('click', ()=> { if(confirm('Eliminar pedido?')){ pedidos.splice(i,1); savePedidos(); renderPedidos(); } });
    actions.appendChild(dl); actions.appendChild(del);

    item.appendChild(left); item.appendChild(actions);
    contPedidos.appendChild(item);
  });
}

/* ====== Utilidades de imagen y PDF (idénticas a la versión previa con wrap) ====== */
function wrapText(ctx, text, maxWidth){
  const words = (text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (let i=0;i<words.length;i++){
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth){
      line = test;
    } else {
      if (line) lines.push(line);
      if (ctx.measureText(words[i]).width > maxWidth){
        let tmp = '';
        for (const ch of words[i]){
          const test2 = tmp + ch;
          if (ctx.measureText(test2).width <= maxWidth) tmp = test2;
          else { lines.push(tmp); tmp = ch; }
        }
        line = tmp;
      } else line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines;
}
function loadImage(src){
  return new Promise((resolve)=>{
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=> resolve(img);
    img.onerror = ()=> resolve(null);
    img.src = src;
  });
}
async function renderMockupDataURL({ texto, fuente, modelo }){
  const W = 520, H = 220, PAD = 16;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);

  const textArea = { x: PAD, y: PAD, w: Math.floor(W*0.64) - PAD*2, h: H - PAD*2 };
  const vecArea  = { x: Math.floor(W*0.68), y: PAD, w: Math.floor(W*0.30), h: H - PAD*2 };

  let fontSize = 40;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.font = `${fontSize}px '${fuente}', system-ui, sans-serif`;
  let lines = wrapText(ctx, texto || '', textArea.w);
  let lineHeight = Math.ceil(fontSize * 1.2);
  while ((lines.length * lineHeight) > textArea.h && fontSize > 12){
    fontSize -= 2; ctx.font = `${fontSize}px '${fuente}', system-ui, sans-serif`;
    lineHeight = Math.ceil(fontSize * 1.2);
    lines = wrapText(ctx, texto || '', textArea.w);
  }
  let y = textArea.y + Math.max(0, (textArea.h - lines.length*lineHeight)/2);
  for (const ln of lines){ ctx.fillText(ln, textArea.x, y); y += lineHeight; }

  if (modelo){
    const img = await loadImage(`vectores/${modelo}`);
    if (img){
      const ratio = Math.min(vecArea.w/img.width, vecArea.h/img.height);
      const dw = img.width * ratio, dh = img.height * ratio;
      const dx = vecArea.x + (vecArea.w - dw)/2;
      const dy = vecArea.y + (vecArea.h - dh)/2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.strokeStyle = '#bbb'; ctx.strokeRect(vecArea.x, vecArea.y, vecArea.w, vecArea.h);
    }
  } else {
    ctx.strokeStyle = '#bbb'; ctx.strokeRect(vecArea.x, vecArea.y, vecArea.w, vecArea.h);
    ctx.fillStyle = '#555'; ctx.font = `14px system-ui, sans-serif`; ctx.fillText('Solo las letras', vecArea.x + 8, vecArea.y + 8);
  }
  return canvas.toDataURL('image/png');
}
function drawWrappedText(doc, text, x, y, maxWidth, lineHeight){
  const parts = (text || '').split('\n');
  let yPos = y;
  for (const p of parts){
    const words = p.split(/\s+/);
    let line = '';
    for (let i=0;i<words.length;i++){
      const testLine = line ? line + ' ' + words[i] : words[i];
      if (doc.getTextWidth(testLine) <= maxWidth){
        line = testLine;
      } else {
        if (line) { doc.text(line, x, yPos); yPos += lineHeight; }
        line = words[i];
      }
    }
    if (line){ doc.text(line, x, yPos); yPos += lineHeight; }
  }
}
async function generarPDFPedidoMultiple(p){
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF){ alert('No se pudo cargar jsPDF.'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFillColor(17, 23, 37); doc.rect(0, 0, 595, 80, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(255,255,255);
  doc.text(p.marca || 'Blackink', 40, 50);
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(0);
  doc.text(`Pedido #${p.id} — ${p.items.length} líneas`, 40, 110);

  const thumbs = await Promise.all(
    p.items.map(it => renderMockupDataURL({ texto: it.texto, fuente: it.fuente, modelo: it.modelo }))
  );

  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  let y = 130;
  const rowH = 110;
  doc.text('Mockup', 40, y); doc.text('Info', 180, y); doc.text('Tamaño', 360, y); doc.text('Tipo/Cant', 440, y); doc.text('Unit.', 520, y); doc.text('Total', 560, y);
  doc.setFont('helvetica','normal');

  for (let i=0;i<p.items.length;i++){
    const it = p.items[i]; const lineTotal = (it.precio * it.cantidad);
    y += rowH; if (y > 780){ doc.addPage(); y = 120; }
    doc.setDrawColor(200); doc.rect(40, y-92, 120, 84);
    doc.addImage(thumbs[i], 'PNG', 44, y-88, 112, 76);
    const infoX = 180, infoMaxW = 160;
    const infoTxt = `${it.fuente} — ${it.modelo || 'Solo letras'}\n“${it.texto}”`;
    drawWrappedText(doc, infoTxt, infoX, y-70, infoMaxW, 14);
    doc.text(String(it.tamano), 360, y-40);
    doc.text(`${it.paquete?'Paquete':'Unidad'}×${it.cantidad}`, 440, y-40);
    doc.text(`$${it.precio}`, 520, y-40);
    doc.text(`$${lineTotal.toFixed(2)}`, 560, y-40);
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(14);
  const totalStr = `TOTAL: $${p.total.toFixed(2)}`;
  doc.text(totalStr, 595 - 40 - doc.getTextWidth(totalStr), 842 - 40);
  doc.save(`pedido-${p.id}.pdf`);
}

/* === Entrada de texto === */
textoEl.addEventListener('input', ()=> {
  document.querySelectorAll('.preview-text').forEach(el => el.textContent = textoEl.value || 'Ejemplo');
  if (!contCompras.classList.contains('hidden')) render('comprar');
});

/* === INIT === */
async function init(){
  await cargarPreciosDesdeArchivo();
  await cargarPoliticasDesdeArchivo();
  await cargarFuentes();
  await cargarModelos();
  watchJSON();
  mostrarSeccion(document.querySelector('.tab.active').dataset.tab);
}
init();
