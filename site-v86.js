document.body.classList.add('js');
const translations=window.TEP_TRANSLATIONS||{};
const supported=["en","ru","de","fr","es","it","pl","pt","zh","ar","ja","tr"];
const rtl=new Set(['ar']);
const STORE='tep-final-v86';
const LEGACY_STORES=['tep-final-v85','tep-final-v84','tep-final-v83','tep-final-v8','tep-final-v7','tep-final-v6'];
const pathMap={home:'index.html',estate:'estate.html',ship:'titanic.html'};
const routes=['home','estate','ship'];
let state={lang:'',route:document.body.dataset.route||'home',scroll:{home:0,estate:0,ship:0}};
let sheetOpener=null;
function safeNumber(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function loadState(){try{let raw=localStorage.getItem(STORE);if(!raw){for(const k of LEGACY_STORES){raw=localStorage.getItem(k);if(raw)break}}if(!raw)return;const p=JSON.parse(raw);if(!p||typeof p!=='object')return;if(supported.includes(p.lang))state.lang=p.lang;if(routes.includes(p.route))state.route=p.route;if(p.scroll&&typeof p.scroll==='object'){for(const r of routes)state.scroll[r]=safeNumber(p.scroll[r])}}catch(e){}}
function saveState(){try{localStorage.setItem(STORE,JSON.stringify({lang:state.lang,route:state.route,scroll:state.scroll}))}catch(e){}}
function isPreview(){return /open_me_v8_6_preview/i.test(location.pathname)}
function detectLang(){const q=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();if(supported.includes(q))return q;if(supported.includes(state.lang))return state.lang;for(const x of (navigator.languages||[navigator.language||'en'])){const c=String(x).toLowerCase().split('-')[0];if(supported.includes(c))return c}return'en'}
function routeFromLocation(){if(isPreview()){const h=location.hash.replace('#','');if(routes.includes(h))return h;return routes.includes(state.route)?state.route:'home'}const p=location.pathname.toLowerCase();if(p.endsWith('estate.html'))return'estate';if(p.endsWith('titanic.html'))return'ship';return'home'}
function textFor(code,key){return (translations[code]&&translations[code][key])??translations.en[key]??''}
function applyI18nAttrs(code){document.querySelectorAll('[data-i18n-alt]').forEach(el=>el.setAttribute('alt',textFor(code,el.dataset.i18nAlt)));document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',textFor(code,el.dataset.i18nAria)))}
function updateLinks(){document.querySelectorAll('[data-page]').forEach(a=>{const r=a.dataset.page;if(!routes.includes(r))return;if(isPreview())a.setAttribute('href','#'+r);else a.setAttribute('href',pathMap[r]+'?lang='+encodeURIComponent(state.lang))});document.querySelectorAll('.route-link').forEach(a=>{const current=a.dataset.page===state.route;a.classList.toggle('current',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}
function updateMeta(){const d=translations[state.lang]||translations.en;const title=state.route==='estate'?(d.estate_card_h||'The Estate')+' — The Estate Project':state.route==='ship'?(d.ship_card_h||'The Ship')+' — The Estate Project':(d.index_h?d.index_h+' — The Estate Project':'The Estate Project');document.title=title;const desc=state.route==='estate'?d.estate_hero_p:state.route==='ship'?d.ship_hero_p:d.index_p;const md=document.querySelector('meta[name="description"]');if(md&&desc)md.setAttribute('content',desc)}
function applyLang(code,push=true){if(!supported.includes(code))code='en';const y=scrollY;state.lang=code;saveState();const d=translations[code]||translations.en;document.documentElement.lang=code;document.documentElement.dir=rtl.has(code)?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;el.textContent=d[k]??translations.en[k]??el.textContent});applyI18nAttrs(code);const badge=document.querySelector('.lang-code');if(badge)badge.textContent=code.toUpperCase();document.querySelectorAll('.lang-option').forEach(b=>{const active=b.dataset.lang===code;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});updateLinks();updateMeta();if(push&&/^https?:$/.test(location.protocol)){const u=new URL(location.href);u.searchParams.set('lang',code);history.replaceState(history.state,'',u.pathname+u.search+u.hash)}requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo({top:y,left:0,behavior:'auto'})))}
function showRoute(r,restore=false){if(!routes.includes(r))r='home';state.scroll[state.route]=safeNumber(scrollY);state.route=r;saveState();document.body.dataset.route=r;document.querySelectorAll('.route').forEach(el=>el.classList.toggle('active',el.dataset.route===r));updateLinks();updateMeta();refreshReveal();const y=restore?state.scroll[r]:0;requestAnimationFrame(()=>scrollTo({top:y,left:0,behavior:'auto'}))}
let observer;
function refreshReveal(){if(observer)observer.disconnect();if(!('IntersectionObserver'in window)){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));return}observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.07,rootMargin:'0px 0px -30px'});document.querySelectorAll('.route.active .reveal:not(.visible)').forEach(el=>observer.observe(el))}
function setExpanded(open){document.querySelectorAll('.lang-btn').forEach(b=>b.setAttribute('aria-expanded',open?'true':'false'))}
function focusables(root){return [...root.querySelectorAll('a[href],button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hasAttribute('inert')&&el.offsetParent!==null)}
function openSheet(e){sheetOpener=e&&e.currentTarget?e.currentTarget:document.activeElement;const sh=document.getElementById('languageSheet');sh.removeAttribute('inert');sh.classList.add('open');sh.setAttribute('aria-hidden','false');setExpanded(true);document.body.classList.add('sheet-open');requestAnimationFrame(()=>sh.querySelector('.lang-option.active,.lang-option')?.focus())}
function closeSheet(restoreFocus=true){const sh=document.getElementById('languageSheet');sh.classList.remove('open');sh.setAttribute('aria-hidden','true');sh.setAttribute('inert','');setExpanded(false);document.body.classList.remove('sheet-open');if(restoreFocus&&sheetOpener&&document.contains(sheetOpener))sheetOpener.focus()}
function repairTitanicArchiveSources(){
  if(document.body.dataset.route!=='ship')return;
  const fixes=[
    {
      match:'Olympic_%26_Titanic_Grand_Staircase.jpg',
      src:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Olympic_%26_Titanic_Grand_Staircase.jpg/1280px-Olympic_%26_Titanic_Grand_Staircase.jpg',
      srcset:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Olympic_%26_Titanic_Grand_Staircase.jpg/960px-Olympic_%26_Titanic_Grand_Staircase.jpg 960w, https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Olympic_%26_Titanic_Grand_Staircase.jpg/1280px-Olympic_%26_Titanic_Grand_Staircase.jpg 1280w'
    },
    {
      match:'Titanic_first_class_dinning_room.jpg',
      src:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Titanic_first_class_dinning_room.jpg/1280px-Titanic_first_class_dinning_room.jpg',
      srcset:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Titanic_first_class_dinning_room.jpg/960px-Titanic_first_class_dinning_room.jpg 960w, https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Titanic_first_class_dinning_room.jpg/1280px-Titanic_first_class_dinning_room.jpg 1280w'
    },
    {
      match:'1st_Class_Cafe_Parisien_Completed.jpg',
      src:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/1st_Class_Cafe_Parisien_Completed.jpg/1280px-1st_Class_Cafe_Parisien_Completed.jpg',
      srcset:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/1st_Class_Cafe_Parisien_Completed.jpg/960px-1st_Class_Cafe_Parisien_Completed.jpg 960w, https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/1st_Class_Cafe_Parisien_Completed.jpg/1280px-1st_Class_Cafe_Parisien_Completed.jpg 1280w'
    }
  ];
  document.querySelectorAll('img.remote-archive').forEach(img=>{
    const current=img.getAttribute('src')||'';
    const fix=fixes.find(f=>current.includes(f.match));
    if(!fix)return;
    img.setAttribute('src',fix.src);
    img.setAttribute('srcset',fix.srcset);
    img.classList.remove('is-broken');
    img.removeAttribute('aria-hidden');
  });
}

function enhanceTitanicProject(){
  if(document.body.dataset.route!=='ship'||document.getElementById('titanic-framework'))return;
  const route=document.querySelector('.route[data-route="ship"]')||document.querySelector('.route.active');
  if(!route)return;
  const block=document.createElement('div');
  block.id='titanic-framework';
  block.innerHTML=`
    <section class="section titanic-framework-section">
      <div class="wrap">
        <div class="section-head reveal">
          <div><div class="kicker" data-i18n="titanic_framework_k">Project framework</div><h2 class="serif" data-i18n="titanic_framework_h">From historical reference to a credible modern project.</h2></div>
          <p data-i18n="titanic_framework_p">The concept is being developed in layers: visible historical character, modern technical requirements, documented sources and clearly defined questions for future specialists.</p>
        </div>
        <div class="titanic-framework-grid">
          <article class="titanic-framework-card reveal"><span class="tf-index">01</span><h3 data-i18n="titanic_vision_h">Vision</h3><p data-i18n="titanic_vision_p">A full-size Titanic reconstruction concept that preserves a historically recognizable exterior and selected interiors while keeping modern technical systems visually separate where practical.</p></article>
          <article class="titanic-framework-card reveal"><span class="tf-index">02</span><h3 data-i18n="titanic_history_h">Historical approach</h3><p data-i18n="titanic_history_p">Period photographs, plans and documented references guide visible proportions, finishes and spaces. Contemporary visualisations are identified as concept images rather than archival material.</p></article>
          <article class="titanic-framework-card reveal"><span class="tf-index">03</span><h3 data-i18n="titanic_modern_h">Modern operation</h3><p data-i18n="titanic_modern_p">Any future operational vessel would need modern safety, navigation, accessibility, fire-protection, lifesaving and propulsion solutions developed by qualified specialists under applicable rules.</p></article>
          <article class="titanic-framework-card reveal"><span class="tf-index">04</span><h3 data-i18n="titanic_status2_h">Current stage</h3><p data-i18n="titanic_status2_p">This is a public concept-development project. Detailed naval architecture and engineering have not been commissioned or completed, and shipbuilding has not started.</p></article>
        </div>
      </div>
    </section>
    <section class="section alt titanic-study-section">
      <div class="wrap">
        <div class="section-head reveal">
          <div><div class="kicker" data-i18n="titanic_study_k">Professional study</div><h2 class="serif" data-i18n="titanic_study_h">Questions that must be solved before physical development.</h2></div>
          <p data-i18n="titanic_study_p">These areas are deliberately presented as open workstreams, not as solved engineering claims.</p>
        </div>
        <div class="titanic-study-grid">
          <article class="study-card reveal"><h3 data-i18n="titanic_s1h">Hull, structure &amp; stability</h3><p data-i18n="titanic_s1p">Translate the historic external form into a safe modern structural and stability concept without pretending that the original design can simply be copied.</p></article>
          <article class="study-card reveal"><h3 data-i18n="titanic_s2h">Propulsion &amp; power</h3><p data-i18n="titanic_s2p">Define a modern propulsion, electrical and machinery strategy that can support real operation while minimizing visual impact on historic spaces.</p></article>
          <article class="study-card reveal"><h3 data-i18n="titanic_s3h">Safety &amp; evacuation</h3><p data-i18n="titanic_s3p">Develop lifesaving, evacuation, fire-protection and emergency systems around current requirements and realistic passenger operations.</p></article>
          <article class="study-card reveal"><h3 data-i18n="titanic_s4h">Accessibility &amp; circulation</h3><p data-i18n="titanic_s4p">Resolve accessible routes, lifts, service circulation and modern guest needs while protecting the character of reconstructed public spaces.</p></article>
          <article class="study-card reveal"><h3 data-i18n="titanic_s5h">Classification, flag &amp; approvals</h3><p data-i18n="titanic_s5p">Identify the regulatory, classification, flag-state and port requirements that would apply to the intended operating model.</p></article>
          <article class="study-card reveal"><h3 data-i18n="titanic_s6h">Shipyard, cost &amp; operations</h3><p data-i18n="titanic_s6p">Assess build strategy, suitable shipyards, operating model, staffing, maintenance, lifecycle costs and the commercial assumptions needed for feasibility.</p></article>
        </div>
      </div>
    </section>
    <section class="section titanic-gates-section">
      <div class="wrap">
        <div class="section-head reveal">
          <div><div class="kicker" data-i18n="titanic_gates_k">Development gates</div><h2 class="serif" data-i18n="titanic_gates_h">A serious project advances by evidence, not by promises.</h2></div>
        </div>
        <div class="titanic-gates">
          <article class="gate reveal"><span>01</span><div><h3 data-i18n="titanic_g1h">1 · Define the historical package</h3><p data-i18n="titanic_g1p">Fix the exterior language, priority interiors, source hierarchy and what will be reconstructed versus adapted.</p></div></article>
          <article class="gate reveal"><span>02</span><div><h3 data-i18n="titanic_g2h">2 · Prepare the feasibility brief</h3><p data-i18n="titanic_g2p">Turn the visual concept into a structured brief of dimensions, functions, constraints, technical questions and intended operating use.</p></div></article>
          <article class="gate reveal"><span>03</span><div><h3 data-i18n="titanic_g3h">3 · Specialist review</h3><p data-i18n="titanic_g3p">Naval architects, engineers, safety specialists and other qualified professionals test assumptions and identify conflicts.</p></div></article>
          <article class="gate reveal"><span>04</span><div><h3 data-i18n="titanic_g4h">4 · Decide whether to advance</h3><p data-i18n="titanic_g4p">Only after feasibility evidence should the project move toward budgets, shipyard discussions, schedules, partnerships or physical development.</p></div></article>
        </div>
      </div>
    </section>`;
  const supportHeading=route.querySelector('[data-i18n="support_h"]');
  const faqHeading=route.querySelector('[data-i18n="faq_h"]');
  const anchor=(supportHeading&&supportHeading.closest('section'))||(faqHeading&&faqHeading.closest('section'));
  if(anchor)anchor.before(block);else route.append(block);
  const heroActions=route.querySelector('.hero-actions');
  if(heroActions&&!heroActions.querySelector('[href="#titanic-framework"]')){
    const a=document.createElement('a');
    a.className='btn';
    a.href='#titanic-framework';
    a.innerHTML='<span data-i18n="titanic_framework_cta">Project framework</span><span>↓</span>';
    heroActions.append(a);
  }
}

function bindRemote(){document.querySelectorAll('img.remote-img,img.remote-archive').forEach(img=>{img.addEventListener('error',()=>{img.classList.add('is-broken');img.setAttribute('aria-hidden','true')},{once:true})})}
function init(){loadState();state.lang=detectLang();state.route=routeFromLocation();repairTitanicArchiveSources();enhanceTitanicProject();applyLang(state.lang,false);showRoute(state.route,false);bindRemote();const sh=document.getElementById('languageSheet');if(sh){sh.setAttribute('aria-hidden','true');sh.setAttribute('inert','');document.querySelector('.lang-btn')?.addEventListener('click',openSheet);document.querySelector('.close-btn')?.addEventListener('click',()=>closeSheet());sh.addEventListener('click',e=>{if(e.target===sh)closeSheet()});document.addEventListener('keydown',e=>{if(!sh.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();closeSheet();return}if(e.key==='Tab'){const fs=focusables(sh);if(!fs.length)return;const first=fs[0],last=fs[fs.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});document.querySelectorAll('.lang-option').forEach(b=>b.addEventListener('click',()=>{applyLang(b.dataset.lang,true);closeSheet(true)}))}
document.querySelectorAll('[data-page]').forEach(a=>a.addEventListener('click',e=>{if(!isPreview())return;e.preventDefault();const r=a.dataset.page;if(!routes.includes(r))return;state.scroll[state.route]=safeNumber(scrollY);history.pushState(null,'','#'+r);showRoute(r,false);closeSheet(false)}));document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(['#home','#estate','#ship'].includes(h))return;let target;try{target=document.querySelector(h)}catch(err){return}if(target){e.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}}));addEventListener('hashchange',()=>{if(!isPreview())return;const h=location.hash.replace('#','');if(routes.includes(h))showRoute(h,false)});const top=document.querySelectorAll('.back-top');top.forEach(b=>b.addEventListener('click',()=>scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})));const bar=document.querySelector('.progress');function onScroll(){state.scroll[state.route]=safeNumber(scrollY);const d=document.documentElement,den=d.scrollHeight-d.clientHeight;if(bar)bar.value=den?Math.min(100,Math.max(0,(d.scrollTop/den)*100)):0;top.forEach(b=>b.classList.toggle('show',d.scrollTop>650))}addEventListener('scroll',onScroll,{passive:true});addEventListener('pagehide',saveState);onScroll()}
document.addEventListener('DOMContentLoaded',init);
