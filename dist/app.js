import {
  DEFAULT_INVITATION_ID,
  InvitationApiError,
  appendGuestToInvitation,
  buildMapLinks,
  fetchInvitationRaw,
  normalizeInvitation,
  resolveInvitationId
} from './backend-adapter.js?v=1';

const UI = {
  ru: {
    invitationLabel:'Свадебное приглашение',scroll:'листайте вниз',dearLabel:'Для самых близких',wishLabel:'От всего сердца',dateLabel:'Сохраните эту дату',programLabel:'В этот особенный день',programTitle:'Программа дня',venueLabel:'Место торжества',answerLabel:'Ваш ответ',rsvpTitle:'Будете ли вы с нами?',rsvpLead:'Пожалуйста, подтвердите участие — нам важно подготовить всё с заботой.',nameLabel:'Ваше имя',namePlaceholder:'Как к вам обращаться?',attendanceLabel:'Вы сможете прийти?',attendanceYes:'Да, с радостью',attendanceNo:'К сожалению, не смогу',guestCount:'Количество гостей',guestWish:'Ваше пожелание',wishPlaceholder:'Несколько тёплых слов…',submit:'Подтвердить участие',submitting:'Отправляем…',success:'Спасибо! Ваш ответ сохранён.',formError:'Пожалуйста, укажите ваше имя.',sendError:'Не удалось сохранить ответ. Попробуйте ещё раз.',countdownTitle:'До нашей свадьбы осталось',countdownDays:'дней',countdownHours:'часов',countdownMinutes:'минут',countdownSeconds:'секунд',and:'и',withLove:'С любовью,',signature:'С любовью',loading:'Загружаем приглашение…',notFound:'Приглашение не найдено',loadError:'Не удалось загрузить приглашение',retry:'Попробовать снова',calendar:'Дата свадьбы',meta:'Свадебное приглашение'
  },
  ky: {
    invitationLabel:'Үйлөнүү тоюна чакыруу',scroll:'ылдый сүрүңүз',dearLabel:'Эң жакындарыбыз үчүн',wishLabel:'Чын жүрөктөн',dateLabel:'Бул күндү белгилеп коюңуз',programLabel:'Бул өзгөчө күнү',programTitle:'Күндүн программасы',venueLabel:'Той өтүүчү жер',answerLabel:'Сиздин жообуңуз',rsvpTitle:'Биз менен болосузбу?',rsvpLead:'Катышарыңызды ырастап коюңуз — баарын камкордук менен даярдоо биз үчүн маанилүү.',nameLabel:'Сиздин атыңыз',namePlaceholder:'Сизге кантип кайрылалы?',attendanceLabel:'Тойго келе аласызбы?',attendanceYes:'Ооба, кубануу менен',attendanceNo:'Тилекке каршы, келе албайм',guestCount:'Коноктордун саны',guestWish:'Сиздин каалооңуз',wishPlaceholder:'Бир нече жылуу сөз…',submit:'Катышууну ырастоо',submitting:'Жөнөтүлүүдө…',success:'Рахмат! Жообуңуз сакталды.',formError:'Атыңызды жазыңыз.',sendError:'Жооп сакталган жок. Кайра аракет кылыңыз.',countdownTitle:'Үйлөнүү тоюбузга калды',countdownDays:'күн',countdownHours:'саат',countdownMinutes:'мүнөт',countdownSeconds:'секунд',and:'жана',withLove:'Сүйүү менен,',signature:'Сүйүү менен',loading:'Чакыруу жүктөлүүдө…',notFound:'Чакыруу табылган жок',loadError:'Чакыруу жүктөлгөн жок',retry:'Кайра аракет кылуу',calendar:'Үйлөнүү тоюнун датасы',meta:'Үйлөнүү тоюна чакыруу'
  },
  kk: {
    invitationLabel:'Үйлену тойына шақыру',scroll:'төмен қарай сырғытыңыз',dearLabel:'Ең жақындарымызға',wishLabel:'Шын жүректен',dateLabel:'Осы күнді сақтаңыз',programLabel:'Осы ерекше күні',programTitle:'Күн бағдарламасы',venueLabel:'Той өтетін орын',answerLabel:'Сіздің жауабыңыз',rsvpTitle:'Бізбен бірге боласыз ба?',rsvpLead:'Қатысатыныңызды растаңыз — бәрін қамқорлықпен дайындау біз үшін маңызды.',nameLabel:'Сіздің атыңыз',namePlaceholder:'Сізге қалай жүгінеміз?',attendanceLabel:'Тойға келе аласыз ба?',attendanceYes:'Иә, қуана келемін',attendanceNo:'Өкінішке қарай, келе алмаймын',guestCount:'Қонақтар саны',guestWish:'Сіздің тілегіңіз',wishPlaceholder:'Бірнеше жылы сөз…',submit:'Қатысуды растау',submitting:'Жіберілуде…',success:'Рақмет! Жауабыңыз сақталды.',formError:'Атыңызды жазыңыз.',sendError:'Жауап сақталмады. Қайталап көріңіз.',countdownTitle:'Тойымызға дейін қалды',countdownDays:'күн',countdownHours:'сағат',countdownMinutes:'минут',countdownSeconds:'секунд',and:'және',withLove:'Сүйіспеншілікпен,',signature:'Сүйіспеншілікпен',loading:'Шақыру жүктелуде…',notFound:'Шақыру табылмады',loadError:'Шақыру жүктелмеді',retry:'Қайталап көру',calendar:'Үйлену тойының күні',meta:'Үйлену тойына шақыру'
  }
};

const DATE = {
  ru:{months:['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],monthsTitle:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],week:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],days:['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']},
  ky:{months:['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'],monthsTitle:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],week:['Дш','Шш','Шр','Бш','Жм','Иш','Жк'],days:['жекшемби','дүйшөмбү','шейшемби','шаршемби','бейшемби','жума','ишемби']},
  kk:{months:['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'],monthsTitle:['Қаңтар','Ақпан','Наурыз','Сәуір','Мамыр','Маусым','Шілде','Тамыз','Қыркүйек','Қазан','Қараша','Желтоқсан'],week:['Дс','Сс','Ср','Бс','Жм','Сб','Жс'],days:['жексенбі','дүйсенбі','сейсенбі','сәрсенбі','бейсенбі','жұма','сенбі']}
};

const BADGES = {ru:'RU',ky:'KG',kk:'KZ'};
const $ = (selector) => document.querySelector(selector);
const elements = {
  video:$('#backgroundVideo'),site:$('#site'),status:$('#statusScreen'),statusTitle:$('#statusTitle'),statusLoader:$('#statusLoader'),retry:$('#retryButton'),
  groom:$('#groomName'),bride:$('#brideName'),heroDate:$('#heroDate'),invitationTitle:$('#invitationTitle'),invitationText:$('#invitationText'),signature:$('#invitationSignature'),signatureNames:$('#signatureNames'),
  wishBlock:$('#wishBlock'),wishTitle:$('#wishTitle'),wishText:$('#wishText'),dateSection:$('#dateSection'),dateDay:$('#dateDay'),dateMonth:$('#dateMonth'),dateMeta:$('#dateMeta'),calendarMonth:$('#calendarMonth'),calendarYear:$('#calendarYear'),calendarWeek:$('#calendarWeek'),calendarDays:$('#calendarDays'),
  program:$('#programSection'),timeline:$('#timeline'),venue:$('#venueSection'),venueType:$('#venueType'),venueName:$('#venueName'),venueAddress:$('#venueAddress'),venueActions:$('#venueActions'),google:$('#googleMap'),twoGis:$('#twoGisMap'),
  rsvp:$('#rsvpSection'),form:$('#rsvpForm'),submit:$('#rsvpSubmit'),formStatus:$('#formStatus'),name:$('#guestName'),count:$('#guestCount'),countField:$('#guestCountField'),wishField:$('#guestWishField'),wish:$('#guestWish'),footerCountdown:$('#footerCountdown'),footerNames:$('#footerNames'),countdownDays:$('#countdownDays'),countdownHours:$('#countdownHours'),countdownMinutes:$('#countdownMinutes'),countdownSeconds:$('#countdownSeconds'),languageSwitch:$('#languageSwitch')
};

const defaultId = Number(document.querySelector('meta[name="invitation-default-id"]')?.content) || DEFAULT_INVITATION_ID;
const state = {id:resolveInvitationId(location.pathname,defaultId),raw:null,invitation:null,language:'ru',submitting:false};
let revealObserver;
let languageOpen = false;
let countdownTimer = 0;

function storedLanguage(){try{return localStorage.getItem('moonlit-garden-language')}catch{return null}}
function saveLanguage(language){try{localStorage.setItem('moonlit-garden-language',language)}catch{}}
function hasText(value){return String(value || '').trim().length > 0}
function textFor(source){return source?.[state.language] || source?.[state.invitation?.languages.default] || source?.ru || {}}
function setStatus(message,{retry=false,loading=false}={}){elements.status.hidden=false;elements.statusTitle.textContent=message;elements.retry.hidden=!retry;elements.statusLoader.hidden=!loading}

function dateParts(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if(!match)return null;
  const [,year,month,day,hour='00',minute='00']=match;
  const numeric={year:Number(year),month:Number(month),day:Number(day)};
  if(numeric.month<1||numeric.month>12||numeric.day<1||numeric.day>31)return null;
  return {...numeric,hour,minute,weekday:new Date(Date.UTC(numeric.year,numeric.month-1,numeric.day)).getUTCDay()};
}

function renderUi(){
  const ui=UI[state.language]||UI.ru;
  document.documentElement.lang=state.language;
  document.querySelectorAll('[data-ui]').forEach(node=>{const value=ui[node.dataset.ui];if(value)node.textContent=value});
  elements.name.placeholder=ui.namePlaceholder;
  elements.wish.placeholder=ui.wishPlaceholder;
  elements.retry.textContent=ui.retry;
  elements.signature.textContent=ui.signature;
  const names=[state.invitation.names.groom,state.invitation.names.bride].filter(hasText).join(' & ');
  document.title=names?`${names} — ${ui.meta}`:ui.meta;
}

function renderDate(){
  const parts=dateParts(state.invitation.dateISO);
  elements.dateSection.hidden=!parts;
  if(!parts)return;
  const dict=DATE[state.language]||DATE.ru;
  const time=`${parts.hour}:${parts.minute}`;
  elements.heroDate.textContent=`${parts.day} ${dict.months[parts.month-1]} ${parts.year}`;
  elements.dateDay.textContent=String(parts.day).padStart(2,'0');
  elements.dateMonth.textContent=dict.months[parts.month-1];
  elements.dateMeta.textContent=`${dict.days[parts.weekday]} · ${time}`;
  elements.calendarMonth.textContent=dict.monthsTitle[parts.month-1];
  elements.calendarYear.textContent=parts.year;
  elements.calendarWeek.replaceChildren(...dict.week.map(label=>Object.assign(document.createElement('span'),{textContent:label})));
  const firstDay=(new Date(Date.UTC(parts.year,parts.month-1,1)).getUTCDay()+6)%7;
  const total=new Date(Date.UTC(parts.year,parts.month,0)).getUTCDate();
  const cells=[];
  for(let index=0;index<firstDay;index++){const cell=document.createElement('span');cell.className='is-empty';cell.textContent='0';cells.push(cell)}
  for(let day=1;day<=total;day++){
    const cell=document.createElement('span');cell.textContent=day;
    if(day===parts.day){cell.className='is-wedding';cell.setAttribute('aria-label',UI[state.language].calendar)}
    cells.push(cell);
  }
  elements.calendarDays.replaceChildren(...cells);
}

function renderTimeline(){
  const items=state.invitation.ceremonies.filter(item=>hasText(item.time)||hasText(textFor(item.title))||hasText(textFor(item.text)));
  elements.program.hidden=!items.length;
  elements.timeline.replaceChildren(...items.map((item,index)=>{
    const article=document.createElement('article');article.className='timeline-item';article.style.transitionDelay=`${Math.min(index*75,300)}ms`;
    const marker=document.createElement('div');marker.className='timeline-item__marker';marker.textContent=String(index+1).padStart(2,'0');
    const body=document.createElement('div');body.className='timeline-item__body';
    const time=document.createElement('time');time.className='timeline-item__time';time.textContent=item.time;
    const heading=document.createElement('h3');heading.textContent=textFor(item.title);
    const copy=document.createElement('p');copy.textContent=textFor(item.text);copy.hidden=!copy.textContent;
    body.append(time,heading,copy);article.append(marker,body);return article;
  }));
}

function setMapLink(element,url){element.hidden=!url;if(url)element.href=url;else element.removeAttribute('href')}
function renderVenue(){
  const venue=textFor(state.invitation.venue.content);
  const visible=[venue.type,venue.name,venue.address].some(hasText);
  elements.venue.hidden=!visible;
  if(!visible)return;
  elements.venueType.textContent=venue.type;elements.venueName.textContent=venue.name;elements.venueAddress.textContent=venue.address;
  const links=buildMapLinks(state.invitation.venue,state.language,state.invitation.languages.default);
  setMapLink(elements.google,links.google);setMapLink(elements.twoGis,links.twoGis);
  elements.venueActions.hidden=!links.enabled;
  elements.venueActions.classList.toggle('is-single',Boolean(links.google)!==Boolean(links.twoGis));
}

function renderRsvp(){
  const config=state.invitation.rsvp;
  elements.rsvp.hidden=!config.enabled;
  if(!config.enabled)return;
  const selected=Math.max(1,Math.min(config.maxGuests,Number(elements.count.value)||1));
  const options=Array.from({length:config.maxGuests},(_,index)=>Object.assign(document.createElement('option'),{value:String(index+1),textContent:String(index+1)}));
  elements.count.replaceChildren(...options);elements.count.value=String(selected);
  elements.wishField.hidden=!config.allowGuestWish;
}

function updateCountdown(){
  const target=new Date(state.invitation?.dateISO).getTime();
  if(!Number.isFinite(target)){elements.footerCountdown.hidden=true;return}
  elements.footerCountdown.hidden=false;
  const remaining=Math.max(0,target-Date.now());
  elements.countdownDays.textContent=String(Math.floor(remaining/86400000));
  elements.countdownHours.textContent=String(Math.floor(remaining/3600000)%24).padStart(2,'0');
  elements.countdownMinutes.textContent=String(Math.floor(remaining/60000)%60).padStart(2,'0');
  elements.countdownSeconds.textContent=String(Math.floor(remaining/1000)%60).padStart(2,'0');
  if(!remaining&&countdownTimer){clearInterval(countdownTimer);countdownTimer=0}
}

function startCountdown(){
  if(countdownTimer)clearInterval(countdownTimer);
  updateCountdown();
  const target=new Date(state.invitation?.dateISO).getTime();
  countdownTimer=Number.isFinite(target)&&target>Date.now()?setInterval(updateCountdown,1000):0;
}

function syncLanguageSwitch(){
  elements.languageSwitch.classList.toggle('is-open',languageOpen);
  elements.languageSwitch.querySelectorAll('button').forEach(button=>{
    const active=button.dataset.language===state.language;
    button.tabIndex=active||languageOpen?0:-1;
    button.setAttribute('aria-hidden',String(!active&&!languageOpen));
    if(active)button.setAttribute('aria-expanded',String(languageOpen));
  });
}
function closeLanguageSwitch(){if(languageOpen){languageOpen=false;syncLanguageSwitch()}}
function renderLanguageSwitch(){
  const languages=state.invitation.languages.enabled;
  elements.languageSwitch.replaceChildren();
  if(languages.length<=1){languageOpen=false;elements.languageSwitch.hidden=true;return}
  elements.languageSwitch.style.setProperty('--language-open-width',`${languages.length*44+4}px`);
  [...languages.filter(language=>language!==state.language),state.language].forEach(language=>{
    const button=document.createElement('button');button.type='button';button.textContent=BADGES[language]||language.toUpperCase();button.dataset.language=language;
    button.classList.toggle('is-active',language===state.language);button.setAttribute('aria-pressed',String(language===state.language));
    button.addEventListener('click',event=>{
      event.stopPropagation();
      if(language===state.language){languageOpen=!languageOpen;syncLanguageSwitch();return}
      languageOpen=false;setLanguage(language);
    });
    elements.languageSwitch.append(button);
  });
  elements.languageSwitch.hidden=false;syncLanguageSwitch();
}

function observeReveals(){
  revealObserver?.disconnect();
  const nodes=document.querySelectorAll('.reveal,.timeline-item');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window)){nodes.forEach(node=>node.classList.add('is-visible'));return}
  revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -4%'});
  nodes.forEach(node=>revealObserver.observe(node));
}

function render(){
  const invitation=textFor(state.invitation.invitation);
  const wishes=textFor(state.invitation.wishBlock.content);
  const names=[state.invitation.names.groom,state.invitation.names.bride].filter(hasText);
  elements.groom.textContent=state.invitation.names.groom;elements.bride.textContent=state.invitation.names.bride;
  elements.invitationTitle.textContent=invitation.title;elements.invitationText.textContent=invitation.text;
  elements.signatureNames.textContent=names.join(' & ');elements.footerNames.textContent=names.join(` ${UI[state.language]?.and||'и'} `);
  const showWish=state.invitation.wishBlock.enabled&&(hasText(wishes.title)||hasText(wishes.text));
  elements.wishBlock.hidden=!showWish;elements.wishTitle.textContent=wishes.title;elements.wishText.textContent=wishes.text;
  renderUi();renderDate();renderTimeline();renderVenue();renderRsvp();renderLanguageSwitch();startCountdown();observeReveals();
}

function setLanguage(language){
  if(!state.invitation.languages.enabled.includes(language))return;
  state.language=language;saveLanguage(language);render();
}

async function load(){
  const ui=UI[state.language]||UI.ru;
  if(!state.id){setStatus(ui.notFound);return}
  setStatus(ui.loading,{loading:true});
  try{
    const raw=await fetchInvitationRaw(state.id);
    const invitation=normalizeInvitation(raw,state.id);
    if(!invitation.id)throw new InvitationApiError(404);
    state.raw=raw;state.invitation=invitation;
    const saved=storedLanguage();state.language=invitation.languages.enabled.includes(saved)?saved:invitation.languages.default;
    elements.site.hidden=false;render();elements.status.hidden=true;
  }catch(error){
    const message=error instanceof InvitationApiError&&error.status===404?ui.notFound:ui.loadError;
    setStatus(message,{retry:true});
  }
}

elements.form.addEventListener('change',event=>{
  if(event.target.name!=='attendance')return;
  const attending=event.target.value==='yes';elements.count.disabled=!attending;elements.countField.style.opacity=attending?'1':'.5';
});
elements.form.addEventListener('submit',async event=>{
  event.preventDefault();if(state.submitting)return;
  const ui=UI[state.language];const data=new FormData(elements.form);const name=String(data.get('name')||'').trim();
  if(!name){elements.formStatus.textContent=ui.formError;elements.formStatus.className='form-status is-error';elements.name.focus();return}
  state.submitting=true;elements.submit.disabled=true;elements.submit.textContent=ui.submitting;elements.formStatus.textContent='';elements.formStatus.className='form-status';
  try{
    const result=await appendGuestToInvitation(state.id,{name,wish:state.invitation.rsvp.allowGuestWish?data.get('wish'):'',guestsCount:data.get('guests_count'),isAttending:data.get('attendance')==='yes'});
    state.raw=result.raw;state.invitation=result.invitation;elements.form.reset();elements.count.disabled=false;elements.countField.style.opacity='1';elements.formStatus.textContent=ui.success;
  }catch{elements.formStatus.textContent=ui.sendError;elements.formStatus.className='form-status is-error'}
  finally{state.submitting=false;elements.submit.disabled=false;elements.submit.textContent=ui.submit}
});

elements.retry.addEventListener('click',load);
document.addEventListener('pointerdown',event=>{if(languageOpen&&!elements.languageSwitch.contains(event.target))closeLanguageSwitch()});
addEventListener('keydown',event=>{if(event.key==='Escape')closeLanguageSwitch()});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){elements.video.pause()}else{elements.video.play().catch(()=>{})}
load();
