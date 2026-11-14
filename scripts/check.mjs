import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_BASE_URL,
  appendGuestToInvitation,
  buildMapLinks,
  buildPatchPayload,
  normalizeInvitation,
  resolveInvitationId
} from '../dist/backend-adapter.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const required=['index.html','styles.css','app.js','backend-adapter.js','assets/moonlit-garden-loop.mp4','assets/moonlit-garden-poster.jpg','assets/fonts/cormorant-regular.woff2','assets/fonts/cormorant-italic.woff2','assets/fonts/manrope-regular.woff2'];
for(const file of required)assert(fs.statSync(path.join(dist,file)).size>100,`Missing ${file}`);
const decorations=['decor-01-rose-cluster.png','decor-02-hanging-lantern.png','decor-09-pearl-ivy-garland.png','decor-10-water-lilies.png'];
for(const file of decorations)assert(fs.statSync(path.join(dist,'assets','decorations',file)).size>1000,`Missing decoration ${file}`);

const fixture={
  public_id:'pub-3',languages:{enabled:['ru','ky','kk'],default:'ky'},names:{groom:'Айдар',bride:'Алина'},date:'2027-08-18T16:00:00',
  invitation:{ru:{title:'Дорогие гости',text:'Приглашаем вас'},ky:{title:'Кымбаттуу коноктор',text:'Сиздерди чакырабыз'},kk:{title:'Құрметті қонақтар',text:'Сіздерді шақырамыз'}},
  wish_block:{enabled:true,content:{ru:{title:'Пожелание',text:'Будьте рядом'},ky:{title:'Каалоо',text:'Жаныбызда болуңуз'},kk:{title:'Тілек',text:'Жанымызда болыңыз'}}},
  ceremonies:[
    {time:'18:00',sort_order:2,content:{ru:{title:'Ужин',text:'Тёплый вечер'},ky:{title:'Кечки тамак',text:'Жылуу кече'},kk:{title:'Кешкі ас',text:'Жылы кеш'}}},
    {time:'16:00',sort_order:1,content:{ru:{title:'Церемония',text:'Наше да'},ky:{title:'Азем',text:'Биздин ооба'},kk:{title:'Рәсім',text:'Біздің иә'}}}
  ],
  venue:{content:{ru:{type:'Ресторан',name:'Очень длинное название торжественного загородного ресторанного комплекса',address:'г. Бишкек, длинный адрес, 123'},ky:{type:'Ресторан',name:'Узун аталыштагы салтанаттуу ресторан',address:'Бишкек ш., 123'},kk:{type:'Мейрамхана',name:'Ұзын атаулы салтанатты мейрамхана',address:'Бішкек қ., 123'}},map:{enabled:true,google_url:'https://maps.google.com/custom',two_gis_url:null}},
  rsvp:{enabled:true,allow_guest_wish:true,max_guests:4},guests:[]
};

assert.equal(resolveInvitationId('/pub-3'),'pub-3');
assert.equal(resolveInvitationId('/pub-3/details'),'pub-3');
assert.equal(resolveInvitationId('/wrong!'),null);
assert.equal(resolveInvitationId('/',7),'7');
const normalized=normalizeInvitation(fixture,3);
assert.deepEqual(normalized.languages.enabled,['ru','ky','kk']);
assert.equal(normalized.languages.default,'ky');
assert.equal(normalized.ceremonies[0].time,'16:00');
assert.equal(normalized.rsvp.maxGuests,4);

const links=buildMapLinks(normalized.venue,'ru','ky');
assert.equal(links.google,'https://maps.google.com/custom');
assert.match(links.twoGis,/^https:\/\/2gis\.kg\/search\//);
assert.deepEqual(buildMapLinks({...normalized.venue,map:{...normalized.venue.map,enabled:false}},'ru','ru'),{enabled:false,google:'',twoGis:''});

const payload=buildPatchPayload(fixture,{name:'  Айбек ',wish:'<b>Любви!</b>',guestsCount:99,isAttending:true},3);
assert.deepEqual(payload.guests[0],{name:'Айбек',wish:'Любви!',guests_count:4,is_attending:true});
const calls=[];
const mockFetch=async(url,options={})=>{calls.push({url,options});return new Response((options.method||'GET')==='GET'?JSON.stringify(fixture):'{"ok":true}',{status:200})};
await appendGuestToInvitation('pub-3',{name:'Тест',guestsCount:2,isAttending:true},{fetchImpl:mockFetch});
assert.equal(calls[0].url,`${API_BASE_URL}/pub-3`);
assert.equal(calls[1].url,`${API_BASE_URL}/pub-3/full`);

const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dist,'styles.css'),'utf8');
const app=fs.readFileSync(path.join(dist,'app.js'),'utf8');
for(const marker of ['backgroundVideo','autoplay muted loop playsinline','statusScreen','languageSwitch','rsvpForm','googleMap','twoGisMap','calendarDays','countdownDays','countdownSeconds','footerCountdown','<select id="guestCount"'])assert(html.includes(marker),`Missing HTML ${marker}`);
for(const marker of ['decor--rose','decor--hanging-lantern','decor--garland','decor--water-lilies'])assert(html.includes(marker),`Missing decorative overlay ${marker}`);
for(const marker of ['position:fixed','backdrop-filter:blur','overflow-x:clip','@media (max-width:360px)','prefers-reduced-motion','env(safe-area-inset-right)','env(safe-area-inset-bottom)','grid-template-columns:1fr 1fr'])assert(css.includes(marker),`Missing CSS ${marker}`);
for(const marker of ['translateZ(','drop-shadow(','@keyframes decorFloat'])assert(css.includes(marker),`Missing 3D illusion styling ${marker}`);
for(const marker of ['appendGuestToInvitation','IntersectionObserver','localStorage','renderTimeline','renderLanguageSwitch','startCountdown','setInterval(updateCountdown,1000)','pointerdown','replaceChildren(...options)'])assert(app.includes(marker),`Missing behavior ${marker}`);
assert(!html.includes('audio'), 'Audio must not be present');
assert(fs.statSync(path.join(dist,'assets','moonlit-garden-loop.mp4')).size<4_000_000,'Background video is too heavy');
assert.equal((html.match(/assets\/decorations\//g)||[]).length,4,'Exactly 4 selected decoration images must be placed');
assert(html.includes('moonlit-garden-poster.jpg')&&html.includes('moonlit-garden-loop.mp4'),'Moonlit background is not wired');
assert(!html.includes('wedding-arch'),'Old background reference remains');

console.log('Passed: dynamic schema, languages, maps, RSVP, fixed animated background, frame-free moonlight theme, 4 selected overlays, mobile safeguards, and asset budget.');
