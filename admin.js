/* admin.js */
const tabla = document.getElementById('tabla-precios');
const guardarBtn = document.getElementById('guardar-precios');
const agregarBtn = document.getElementById('agregar-fila');
const mensajeDiv = document.getElementById('mensaje');
const themeToggleAdmin = document.getElementById('theme-toggle-admin');

themeToggleAdmin && themeToggleAdmin.addEventListener('click', () => {
  const dark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', dark ? 'light' : 'dark');
});

let precios = { iva: 0.16, tamaños: [], base_modelo: 0 };

async function load(){
  try{
    const r = await fetch('/api/precios');
    const res = await r.json();
    if(res.ok) precios = res.precios;
    else precios = { iva:0.16, tamaños: [], base_modelo: 0 };
  }catch(e){ precios = { iva:0.16, tamaños: [], base_modelo: 0 }; }

  renderTabla();
}

function renderTabla(){
  tabla.innerHTML = '';
  const ivaRow = document.createElement('div');
  ivaRow.innerHTML = `<label>IVA (ej. 0.16 = 16%):</label> <input id="input-iva" type="number" step="0.01" value="${precios.iva || 0.16}" /> 
  <label style="margin-left:12px">Base modelo:</label> <input id="input-base-model" type="number" step="0.01" value="${precios.base_modelo || 0}" />`;
  tabla.appendChild(ivaRow);

  const header = document.createElement('div'); header.style.marginTop='10px'; header.innerHTML = `<strong>Tamaños</strong>`;
  tabla.appendChild(header);

  const list = document.createElement('div'); list.id='tamaños-list';
  precios.tamaños.forEach((t, idx)=>{
    const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.marginTop='8px';
    row.innerHTML = `<input class="input-nombre" value="${t.nombre}" /> <input class="input-precio" type="number" step="0.01" value="${t.precio}" /> <button class="btn btn-accent btn-eliminar">Eliminar</button>`;
    row.querySelector('.btn-eliminar').addEventListener('click', ()=>{ precios.tamaños.splice(idx,1); renderTabla(); });
    list.appendChild(row);
  });
  tabla.appendChild(list);
}

agregarBtn.addEventListener('click', ()=>{ precios.tamaños.push({ nombre: 'Nuevo', precio: 0 }); renderTabla(); });

guardarBtn.addEventListener('click', async ()=>{
  const ivaInput = document.getElementById('input-iva');
  const baseModelInput = document.getElementById('input-base-model');
  precios.iva = parseFloat(ivaInput.value) || 0;
  precios.base_modelo = parseFloat(baseModelInput.value) || 0;

  const nombres = Array.from(document.querySelectorAll('.input-nombre')).map(i=>i.value);
  const preciosInputs = Array.from(document.querySelectorAll('.input-precio')).map(i=>parseFloat(i.value)||0);
  precios.tamaños = nombres.map((n, idx)=>({ id: n.toLowerCase().replace(/\s+/g,'_'), nombre: n, precio: preciosInputs[idx] }));

  try{
    const r = await fetch('/api/precios', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(precios) });
    const res = await r.json();
    if(res.ok){ mensajeDiv.textContent = 'Guardado correctamente'; mensajeDiv.style.color = 'lightgreen'; }
    else { mensajeDiv.textContent = 'Error guardando'; mensajeDiv.style.color = 'salmon'; }
  }catch(e){
    mensajeDiv.textContent = 'Error de red guardando'; mensajeDiv.style.color = 'salmon';
  }
});

load();
