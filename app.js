const API_BASE = 'http://localhost:8080/api';
const $ = (selector) => document.querySelector(selector);
let currentUser = readUser();
let cachedSkills = [];
function readUser() { try { return JSON.parse(localStorage.getItem('skillswapUser') || 'null'); } catch { return null; } }
function setMessage(id, text, type='success') { const el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = `form-message ${type}`; }
async function api(path, options={}) {
  let response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } }); }
  catch { throw new Error('Cannot connect to the backend. Start Spring Boot on port 8080 and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}
function updateUserUI() {
  $('#welcome').textContent = currentUser ? `Hi, ${currentUser.fullName || currentUser.full_name || currentUser.email}` : 'Welcome, student';
  $('#logoutBtn').classList.toggle('hidden', !currentUser);
  const selects = ['#skillOwner','#requestUser','select[name="requesterId"]'];
  selects.forEach(selector => { const select = $(selector); if (!select) return; select.innerHTML = currentUser ? `<option value="${Number(currentUser.id)}">${escapeHtml(currentUser.fullName || currentUser.full_name || currentUser.email)}</option>` : '<option value="">Sign in first</option>'; });
}
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function saveUser(user) { currentUser = user; localStorage.setItem('skillswapUser', JSON.stringify(user)); updateUserUI(); refreshRequests(); }
$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form));
  try { const user = await api('/auth/register', {method:'POST', body:JSON.stringify(data)}); saveUser(user); form.reset(); setMessage('registerMessage','Account created successfully. You are now signed in.'); await loadSkills(); }
  catch (err) { setMessage('registerMessage',err.message,'error'); }
});
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget;
  try { const user = await api('/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); saveUser(user); form.reset(); setMessage('loginMessage','Signed in successfully.'); await loadSkills(); }
  catch (err) { setMessage('loginMessage',err.message,'error'); }
});
$('#logoutBtn').addEventListener('click', () => { currentUser=null; localStorage.removeItem('skillswapUser'); updateUserUI(); $('#requestsList').innerHTML='<div class="empty-state">Sign in to view requests.</div>'; });
$('#heroAccount').addEventListener('click', () => $('#account').scrollIntoView({behavior:'smooth'}));
$('#addSkillBtn').addEventListener('click', () => { $('#skillForm').scrollIntoView({behavior:'smooth',block:'center'}); if (!currentUser) setMessage('skillMessage','Please create an account or sign in first.','error'); });
$('#skillForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!currentUser) { setMessage('skillMessage','Please create an account or sign in first.','error'); return; }
  const data = Object.fromEntries(new FormData(e.currentTarget)); data.studentId=Number(currentUser.id);
  try { await api('/skills',{method:'POST',body:JSON.stringify(data)}); e.currentTarget.reset(); updateUserUI(); setMessage('skillMessage','Your skill listing has been published.'); await loadSkills(); }
  catch(err) { setMessage('skillMessage',err.message,'error'); }
});
$('#searchBtn').addEventListener('click',loadSkills); $('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadSkills();}}); $('#typeFilter').addEventListener('change',loadSkills);
async function loadSkills() {
  const grid=$('#skillsGrid'); grid.innerHTML='<div class="empty-state">Loading skill listings…</div>';
  const params=new URLSearchParams(); if($('#searchInput').value.trim())params.set('q',$('#searchInput').value.trim()); if($('#typeFilter').value)params.set('type',$('#typeFilter').value);
  try { cachedSkills=await api('/skills'+(params.toString()?'?'+params:'')); renderSkills(); }
  catch(err) { grid.innerHTML=`<div class="empty-state">${escapeHtml(err.message)}</div>`; }
}
function renderSkills() {
  const grid=$('#skillsGrid'); if(!cachedSkills.length){grid.innerHTML='<div class="empty-state">No listings yet. Create an account and publish the first skill listing.</div>';return;}
  grid.innerHTML=cachedSkills.map(s=>`<article class="skill-card"><div class="skill-top"><span class="pill ${s.skillType==='LEARN'?'learn':''}">${s.skillType==='TEACH'?'CAN TEACH':'WANTS TO LEARN'}</span></div><h3>${escapeHtml(s.skillName)}</h3><p>${escapeHtml(s.description)}</p><div class="skill-meta">${escapeHtml(s.studentName)} · ${escapeHtml(s.department||'Student')}</div><button class="btn" data-request="${Number(s.id)}">Request exchange</button></article>`).join('');
  grid.querySelectorAll('[data-request]').forEach(btn=>btn.addEventListener('click',()=>openRequest(Number(btn.dataset.request))));
}
function openRequest(skillId) { if(!currentUser){$('#account').scrollIntoView({behavior:'smooth'});setMessage('loginMessage','Sign in before requesting a skill.','error');return;} const skill=cachedSkills.find(s=>Number(s.id)===skillId); if(!skill)return; if(Number(skill.studentId)===Number(currentUser.id)){alert('You cannot request your own listing.');return;} const form=$('#requestForm');form.elements.skillId.value=skillId;form.elements.message.value='';$('#requestMessage').textContent='';form.elements.requesterId.value=String(currentUser.id);$('#requestDialog').showModal(); }
$('#closeDialog').addEventListener('click',()=>$('#requestDialog').close());
$('#requestForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const data=Object.fromEntries(new FormData(f));data.skillId=Number(data.skillId);data.requesterId=Number(data.requesterId);try{await api('/requests',{method:'POST',body:JSON.stringify(data)});setMessage('requestMessage','Request sent successfully.');$('#requestDialog').close();await refreshRequests();}catch(err){setMessage('requestMessage',err.message,'error');}});
$('#refreshRequests').addEventListener('click',refreshRequests);
async function refreshRequests() {
  if(!currentUser){$('#requestsList').innerHTML='<div class="empty-state">Sign in to view requests.</div>';return;}
  try { const list=await api('/requests?studentId='+Number(currentUser.id)); const root=$('#requestsList'); if(!list.length){root.innerHTML='<div class="empty-state">No exchange requests yet. Browse skill listings and send a request to get started.</div>';return;}
    root.innerHTML=list.map(r=>`<article class="request-item"><div><strong>${escapeHtml(r.skillName)}</strong><p>${escapeHtml(r.requesterName)} → ${escapeHtml(r.ownerName)}</p><p>${escapeHtml(r.message)}</p></div><div><span class="status ${String(r.status).toLowerCase()}">${escapeHtml(r.status)}</span>${Number(r.ownerId)===Number(currentUser.id)&&r.status==='PENDING'?` <button class="btn" data-accept="${Number(r.id)}">Accept</button> <button class="btn btn-outline" data-reject="${Number(r.id)}">Reject</button>`:''}</div></article>`).join('');
    root.querySelectorAll('[data-accept]').forEach(b=>b.addEventListener('click',()=>changeStatus(Number(b.dataset.accept),'ACCEPTED')));root.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>changeStatus(Number(b.dataset.reject),'REJECTED')));
  } catch(err) { $('#requestsList').innerHTML=`<div class="empty-state">${escapeHtml(err.message)}</div>`; }
}
async function changeStatus(id,status){try{await api(`/requests/${id}/status`,{method:'PUT',body:JSON.stringify({studentId:Number(currentUser.id),status})});await refreshRequests();}catch(err){alert(err.message);}}
async function checkBackend(){try{const data=await api('/health');$('#apiStatus').textContent=`Backend ${data.status} · Database ${data.database}`;$('#apiStatus').style.color='#178b66';}catch{$('#apiStatus').textContent='Backend not connected — start Spring Boot';$('#apiStatus').style.color='#b42318';}}
updateUserUI();checkBackend();loadSkills();
