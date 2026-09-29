(function () {
"use strict";

const CATS = {
  ingreso: ["Sueldo", "Comisiones", "Ventas", "Rentas", "Inversiones", "Otro"],
  egreso: ["Comida", "Súper", "Vivienda", "Servicios", "Transporte", "Salud", "Entretenimiento", "Pago de deuda", "Otro"]
};
const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = n => fmt.format(n || 0);
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const round2 = n => Math.round(n * 100) / 100;
const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const ym = iso => (iso || "").slice(0, 7);
const fDate = iso => { const [y,m,d] = iso.split("-").map(Number); return d + " " + MESES[m-1] + " " + y; };

/* ---------- Supabase ---------- */
const cfg = window.FINANZAS_CONFIG || {};
if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("TU-PROYECTO")) {
  $("#config-notice").hidden = false;
  return;
}
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

let movs = [], deudas = [], loaded = false, user = null;
let filtroTipo = "todos", filtroMes = "todos", tipoNuevo = "egreso", tab = "resumen";

$("#today").textContent = (() => { const d = new Date(); return d.getDate() + " de " + MESES_L[d.getMonth()] + " de " + d.getFullYear(); })();

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2400); }
function fail(e) { console.error(e); toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."); }

async function cargar() {
  const [a, b] = await Promise.all([
    sb.from("movimientos").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("deudas").select("*").order("created_at", { ascending: true })
  ]);
  if (a.error || b.error) { toast("No se pudieron cargar tus datos."); console.error(a.error || b.error); return; }
  movs = a.data.map(m => ({ ...m, monto: Number(m.monto) }));
  deudas = b.data.map(d => ({ ...d, total: Number(d.total), pagado: Number(d.pagado) }));
  loaded = true;
  render();
}

/* ---------- Acceso ---------- */
let modoRegistro = false;
function setModo(reg) {
  modoRegistro = reg;
  $("#a-btn").textContent = reg ? "Crear cuenta" : "Entrar";
  $("#a-toggle").textContent = reg ? "Ya tengo cuenta, quiero entrar" : "¿Primera vez? Crea tu cuenta";
  $("#auth-sub").textContent = reg ? "Crea tu cuenta con tu correo y una contraseña de al menos 6 caracteres." : "Entra con tu correo para ver tus finanzas.";
  $("#a-pass").autocomplete = reg ? "new-password" : "current-password";
  $("#a-err").textContent = "";
}
$("#a-toggle").addEventListener("click", () => setModo(!modoRegistro));
$("#form-auth").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#a-email").value.trim(), password = $("#a-pass").value;
  if (!email || password.length < 6) { $("#a-err").textContent = "Escribe tu correo y una contraseña de al menos 6 caracteres."; return; }
  $("#a-btn").disabled = true; $("#a-err").textContent = "";
  try {
    if (modoRegistro) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      if (!data.session) { setModo(false); $("#a-err").textContent = "Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego entra aquí."; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    const m = String(err.message || "");
    $("#a-err").textContent =
      /invalid login/i.test(m) ? "Correo o contraseña incorrectos." :
      /not confirmed/i.test(m) ? "Primero confirma tu correo con el enlace que te enviamos." :
      /already registered/i.test(m) ? "Ese correo ya tiene cuenta. Entra con tu contraseña." :
      /signups not allowed/i.test(m) ? "El registro de cuentas nuevas está cerrado." :
      "No se pudo continuar: " + m;
  } finally { $("#a-btn").disabled = false; }
});
$("#logout").addEventListener("click", () => sb.auth.signOut());

let mostrado = false;
function mostrar(session) {
  const nuevo = session?.user || null;
  if (mostrado && (nuevo?.id || null) === (user?.id || null)) return;
  mostrado = true;
  user = nuevo;
  $("#auth").hidden = !!user; $("#app").hidden = !user;
  if (user) { $("#who").textContent = user.email; loaded = false; render(); cargar(); }
  else { movs = []; deudas = []; }
}
sb.auth.getSession().then(({ data }) => mostrar(data.session));
sb.auth.onAuthStateChange((_ev, session) => mostrar(session));

/* ---------- Render ---------- */
function rowHTML(m) {
  const inn = m.tipo === "ingreso";
  return `<li>
    <div class="dot ${inn ? "in" : "out"}" aria-hidden="true">${inn ? "+" : "−"}</div>
    <div class="mv-main"><div class="c">${esc(m.concepto || m.categoria)}</div><div class="m">${esc(m.categoria)} · ${fDate(m.fecha)}</div></div>
    <div class="amt num ${inn ? "in" : "out"}">${inn ? "+" : "−"}${money(m.monto)}</div>
    <button class="del" data-del-mov="${esc(m.id)}" aria-label="Eliminar movimiento">Eliminar</button>
  </li>`;
}
function emptyMovs(msg) {
  return `<div class="empty"><strong>${msg}</strong><span>Registra tu primer ingreso o egreso y aquí verás tu historial.</span>
  <button class="btn sm" data-open="mov">+ Registrar movimiento</button></div>`;
}

function render() {
  const now = todayISO(), curM = ym(now);
  const sum = (arr, t) => arr.filter(m => m.tipo === t).reduce((s, m) => s + m.monto, 0);
  const bal = sum(movs, "ingreso") - sum(movs, "egreso");
  const delMes = movs.filter(m => ym(m.fecha) === curM);
  const dTot = deudas.reduce((s, d) => s + d.total, 0);
  const dPaid = deudas.reduce((s, d) => s + Math.min(d.pagado, d.total), 0);

  $("#balance").textContent = money(bal);
  $("#balance-sub").textContent = !loaded ? "Cargando tus datos…" :
    movs.length ? `${movs.length} movimiento${movs.length === 1 ? "" : "s"} registrado${movs.length === 1 ? "" : "s"}` : "Aún no hay movimientos registrados";
  $("#s-in").textContent = money(sum(delMes, "ingreso"));
  $("#s-out").textContent = money(sum(delMes, "egreso"));
  $("#s-debt").textContent = money(dTot - dPaid);
  $("#d-total").textContent = money(dTot); $("#d-paid").textContent = money(dPaid); $("#d-left").textContent = money(dTot - dPaid);

  const rec = movs.slice(0, 6);
  $("#recent").innerHTML = !loaded ? `<div class="empty">Cargando…</div>` : rec.length ? `<ul class="list">${rec.map(rowHTML).join("")}</ul>` : emptyMovs("Todavía no hay movimientos");

  const meses = [...new Set(movs.map(m => ym(m.fecha)))].sort().reverse();
  const opts = `<option value="todos">Todos los meses</option>` + meses.map(k => { const [y, m] = k.split("-"); return `<option value="${k}">${MESES_L[+m-1]} ${y}</option>`; }).join("");
  const sel = $("#f-mes");
  if (sel.innerHTML !== opts) { sel.innerHTML = opts; if (!meses.includes(filtroMes)) filtroMes = "todos"; sel.value = filtroMes; }

  const lst = movs.filter(m => (filtroTipo === "todos" || m.tipo === filtroTipo) && (filtroMes === "todos" || ym(m.fecha) === filtroMes));
  const fi = sum(lst, "ingreso"), fo = sum(lst, "egreso");
  $("#all-movs").innerHTML = !loaded ? `<div class="empty">Cargando…</div>` : lst.length
    ? `<div class="month-sum"><span>Ingresos <b class="num p">${money(fi)}</b></span><span>Egresos <b class="num n">${money(fo)}</b></span><span>Neto <b class="num">${money(fi - fo)}</b></span></div><ul class="list">${lst.map(rowHTML).join("")}</ul>`
    : (movs.length ? `<div class="empty"><strong>Sin movimientos con este filtro</strong></div>` : emptyMovs("Todavía no hay movimientos"));

  renderDebts(now);
  renderChart(now);
}

function renderDebts(now) {
  const el = $("#debts");
  if (!loaded) { el.innerHTML = `<div class="panel empty">Cargando…</div>`; return; }
  if (!deudas.length) { el.innerHTML = `<div class="panel empty"><strong>Sin deudas registradas</strong><span>Agrega tarjetas, préstamos o lo que debas y lleva el control de tus abonos.</span><button class="btn sm" data-open="deuda">+ Nueva deuda</button></div>`; return; }
  const list = [...deudas].sort((a, b) => {
    const la = a.total - a.pagado <= 0, lb = b.total - b.pagado <= 0;
    if (la !== lb) return la ? 1 : -1;
    return (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999");
  });
  el.innerHTML = list.map(d => {
    const pag = Math.min(d.pagado, d.total), rest = Math.max(d.total - pag, 0), pct = d.total ? Math.round(pag / d.total * 100) : 0;
    let pill = `<span class="pill open">Pendiente</span>`;
    if (rest <= 0) pill = `<span class="pill ok">Liquidada</span>`;
    else if (d.fecha_limite) {
      const days = Math.round((new Date(d.fecha_limite) - new Date(now)) / 864e5);
      if (days < 0) pill = `<span class="pill late">Vencida hace ${-days} día${days === -1 ? "" : "s"}</span>`;
      else if (days <= 7) pill = `<span class="pill soon">Vence ${days === 0 ? "hoy" : "en " + days + " día" + (days === 1 ? "" : "s")}</span>`;
      else pill = `<span class="pill open">Vence ${fDate(d.fecha_limite)}</span>`;
    }
    const id = esc(d.id);
    return `<article class="debt">
      <div class="debt-top"><div><h3>${esc(d.acreedor)}</h3>${d.nota ? `<div class="muted debt-note">${esc(d.nota)}</div>` : ""}</div>${pill}</div>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <div class="debt-nums muted"><span>Pagado <b class="num">${money(pag)}</b> de <b class="num">${money(d.total)}</b> (${pct}%)</span><span>Resta <b class="num rest">${money(rest)}</b></span></div>
      ${rest > 0 ? `<form class="abono" data-abono="${id}">
        <input type="number" id="ab-${id}" step="0.01" min="0" inputmode="decimal" placeholder="Monto del abono" aria-label="Monto del abono">
        <button class="btn sm" type="submit">Abonar</button>
        <label class="chk"><input type="checkbox" id="abchk-${id}" checked> Registrar también como egreso</label>
      </form>` : ""}
      <div class="debt-actions"><button class="del" data-del-deuda="${id}">Eliminar deuda</button></div>
    </article>`;
  }).join("");
}

function renderChart(now) {
  const [y0, m0] = now.split("-").map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(y0, m0 - 1 - i, 1); months.push({ k: d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"), l: MESES[d.getMonth()] }); }
  months.forEach(o => {
    o.i = movs.filter(m => m.tipo === "ingreso" && ym(m.fecha) === o.k).reduce((s, m) => s + m.monto, 0);
    o.o = movs.filter(m => m.tipo === "egreso" && ym(m.fecha) === o.k).reduce((s, m) => s + m.monto, 0);
  });
  const raw = Math.max(...months.map(o => Math.max(o.i, o.o)), 0);
  const nice = v => { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const max = nice(raw);
  const W = 600, H = 220, L = 62, R = 10, T = 12, B = 28, cw = (W - L - R) / 6, bw = Math.min(22, cw * 0.3);
  const yv = v => T + (H - T - B) * (1 - v / max);
  const short = v => v >= 1e6 ? (v/1e6).toFixed(v % 1e6 ? 1 : 0) + "M" : v >= 1e3 ? (v/1e3).toFixed(v % 1e3 ? 1 : 0) + "k" : String(v);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, yy = yv(v);
    g += `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>` +
         `<text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">$${short(v)}</text>`;
  }
  months.forEach((o, idx) => {
    const cx = L + cw * idx + cw / 2, hi = (H - T - B) * o.i / max, ho = (H - T - B) * o.o / max;
    g += `<rect x="${cx-bw-2}" y="${H-B-hi}" width="${bw}" height="${hi}" rx="3" fill="var(--pos)"><title>Ingresos ${o.l}: ${money(o.i)}</title></rect>`;
    g += `<rect x="${cx+2}" y="${H-B-ho}" width="${bw}" height="${ho}" rx="3" fill="var(--neg)"><title>Egresos ${o.l}: ${money(o.o)}</title></rect>`;
    g += `<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="12" fill="${idx === 5 ? "var(--ink)" : "var(--muted)"}" font-weight="${idx === 5 ? 600 : 400}">${o.l}</text>`;
  });
  $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;display:block" role="img" aria-label="Ingresos y egresos de los últimos seis meses">${g}</svg>`;
}

/* ---------- Pestañas y hojas ---------- */
function setTab(t) {
  tab = t;
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  ["resumen", "movs", "deudas"].forEach(k => $("#tab-" + k).hidden = k !== t);
  window.scrollTo(0, 0);
}
document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

function setTipo(t) {
  tipoNuevo = t;
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === t));
  $("#m-cat").innerHTML = CATS[t].map(c => `<option>${c}</option>`).join("");
}
function openSheet(kind) {
  if (kind === "mov") { setTipo(tipoNuevo); $("#m-fecha").value = todayISO(); $("#m-err").textContent = ""; $("#sheet-mov").hidden = false; setTimeout(() => $("#m-monto").focus(), 50); }
  else { $("#d-err").textContent = ""; $("#sheet-deuda").hidden = false; setTimeout(() => $("#d-acreedor").focus(), 50); }
}
function closeSheets() { $("#sheet-mov").hidden = true; $("#sheet-deuda").hidden = true; }
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => setTipo(b.dataset.v)));
document.querySelectorAll(".sheet-bg").forEach(bg => bg.addEventListener("click", e => { if (e.target === bg) closeSheets(); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheets(); });
$("#fab").addEventListener("click", () => openSheet(tab === "deudas" ? "deuda" : "mov"));

/* ---------- Guardar ---------- */
$("#form-mov").addEventListener("submit", async e => {
  e.preventDefault();
  const monto = round2(parseFloat($("#m-monto").value));
  if (!(monto > 0)) { $("#m-err").textContent = "Escribe un monto mayor a cero."; return; }
  const row = { tipo: tipoNuevo, monto, concepto: $("#m-concepto").value.trim(), categoria: $("#m-cat").value, fecha: $("#m-fecha").value || todayISO() };
  closeSheets(); $("#m-monto").value = ""; $("#m-concepto").value = "";
  const { error } = await sb.from("movimientos").insert(row);
  if (error) return fail(error);
  toast(row.tipo === "ingreso" ? "Ingreso guardado" : "Egreso guardado");
  cargar();
});

$("#form-deuda").addEventListener("submit", async e => {
  e.preventDefault();
  const acreedor = $("#d-acreedor").value.trim(), total = round2(parseFloat($("#d-monto").value)), pagado = round2(parseFloat($("#d-pagado").value) || 0);
  if (!acreedor) { $("#d-err").textContent = "Escribe a quién le debes."; return; }
  if (!(total > 0)) { $("#d-err").textContent = "Escribe un monto total mayor a cero."; return; }
  if (pagado > total) { $("#d-err").textContent = "Lo pagado no puede ser mayor al total."; return; }
  const row = { acreedor, total, pagado, fecha_limite: $("#d-fecha").value || null, nota: $("#d-nota").value.trim() };
  closeSheets(); ["#d-acreedor", "#d-monto", "#d-pagado", "#d-fecha", "#d-nota"].forEach(s => $(s).value = "");
  const { error } = await sb.from("deudas").insert(row);
  if (error) return fail(error);
  toast("Deuda guardada");
  cargar();
});

document.addEventListener("click", async e => {
  const o = e.target.closest("[data-open]"); if (o) { openSheet(o.dataset.open); return; }
  if (e.target.closest("[data-close]")) { closeSheets(); return; }
  const g = e.target.closest("[data-goto]"); if (g) { setTab(g.dataset.goto); return; }
  const c = e.target.closest(".chip[data-f]");
  if (c) { filtroTipo = c.dataset.f; document.querySelectorAll(".chip[data-f]").forEach(x => x.setAttribute("aria-pressed", x === c)); render(); return; }
  const dm = e.target.closest("[data-del-mov],[data-del-deuda]");
  if (dm) {
    if (!dm.classList.contains("confirm")) {
      document.querySelectorAll(".del.confirm").forEach(x => { x.classList.remove("confirm"); x.textContent = x.dataset.delDeuda ? "Eliminar deuda" : "Eliminar"; });
      dm.classList.add("confirm"); dm.textContent = "¿Seguro? Toca otra vez"; return;
    }
    const esMov = !!dm.dataset.delMov;
    const { error } = await sb.from(esMov ? "movimientos" : "deudas").delete().eq("id", esMov ? dm.dataset.delMov : dm.dataset.delDeuda);
    if (error) return fail(error);
    toast(esMov ? "Movimiento eliminado" : "Deuda eliminada");
    cargar();
  }
});
$("#f-mes").addEventListener("change", e => { filtroMes = e.target.value; render(); });

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-abono]"); if (!f) return;
  e.preventDefault();
  const d = deudas.find(x => x.id === f.dataset.abono); if (!d) return;
  let v = round2(parseFloat(f.querySelector("input[type=number]").value));
  if (!(v > 0)) { toast("Escribe el monto del abono"); return; }
  v = Math.min(v, round2(d.total - d.pagado));
  const asEgreso = f.querySelector("input[type=checkbox]").checked;
  const up = await sb.from("deudas").update({ pagado: round2(d.pagado + v) }).eq("id", d.id);
  if (up.error) return fail(up.error);
  if (asEgreso) {
    const ins = await sb.from("movimientos").insert({ tipo: "egreso", monto: v, concepto: "Abono a " + d.acreedor, categoria: "Pago de deuda", fecha: todayISO() });
    if (ins.error) fail(ins.error);
  }
  toast("Abono de " + money(v) + " registrado");
  cargar();
});

setTipo("egreso");
setModo(false);
})();
