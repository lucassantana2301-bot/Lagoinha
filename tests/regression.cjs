const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=process.argv[2] || path.resolve(__dirname,'..'); let handler; let now=100000;
const clock=class extends Date { static now(){return now;} };
const server={listen(p,cb){cb();},on(){}};
vm.runInNewContext(fs.readFileSync(path.join(root,'server.js'),'utf8'),{require(n){if(n==='http')return {createServer(h){handler=h;return server;}};return require(n);},__dirname:root,process:{env:{}},Date:clock,URL,console:{log(){},error(){}},setTimeout});
function req(url,body){let status=200,result;let callbacks={}; const request={url,headers:{host:'localhost'},method:body?'POST':'GET',on(k,v){callbacks[k]=v;}};handler(request,{setHeader(){},writeHead(s){status=s;},end(s){result=JSON.parse(s);}});if(body){callbacks.data(JSON.stringify(body));callbacks.end();}return {status,result};}
const sector=req('/api/state').result.zones[0].id;
const payload=(id,status='available_probable')=>({producer:'simulation',producerId:id,sectors:[{id:sector,aiStatus:status,detectedCarsCount:2}]});
assert.equal(req('/api/telemetry',payload('one')).status,200);
assert.equal(req('/api/telemetry',payload('two')).status,409);
assert.equal(req('/api/override',{sectorId:sector,status:'blocked'}).status,200);
assert.equal(req('/api/state').result.sectors[sector].humanOverride.status,'blocked');
assert.equal(req('/api/telemetry',{producer:'detector',sectors:[{id:sector,aiStatus:'uncertain',detectedCarsCount:3}]}).status,200);
assert.equal(req('/api/telemetry',payload('one')).status,409);
now+=21000;
assert.equal(req('/api/state').result.sectors[sector].aiStatus,'offline');
assert.equal(req('/api/telemetry',payload('two')).status,409);
now+=300000; assert.equal(req('/api/state').result.sectors[sector].humanOverride,null);
console.log('Servidor: exclusividade da simulação, prioridade do detector, interdição, expiração e perda de telemetria OK');
async function frontend(search='?view=entrance'){
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return nodes.get(id);};
let init,tick,poll;let posts=0;let sent;let current={zones:[{id:'a',type:'parking',name:'A',points:[]}],sectors:{a:{aiStatus:'available_probable',humanOverride:null}},videoSource:{},detectorConnected:false};
class Simulator {constructor(){this.activeSource='local_video';this.weatherCondition='clear';} getCurrentDetections(){return [];} }
class Editor {constructor(){this.zones=[];}getZones(){return this.zones;}setZones(z){this.zones=z;}render(){}setEditMode(v){this.editModeEnabled=v;}}
const docEl={setAttribute(){},getAttribute(){return null;},classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}}};
const ctx={document:{addEventListener(_,fn){init=fn;},getElementById:get,querySelectorAll(){return [];},documentElement:docEl},ParkingSimulator:Simulator,PolygonEditor:Editor,SectorAnalyzer:class {analyze(){return [];}},window:{location:{search}},crypto:require('crypto').webcrypto,URLSearchParams,AbortSignal,Date:clock,setInterval(fn){poll=fn;},requestAnimationFrame(fn){tick=fn;},console,fetch:async(url,opt)=>{if(opt?.method==='POST'){posts++;sent=JSON.parse(opt.body);return {ok:true};}return {ok:true,json:async()=>current};}};
vm.runInNewContext(fs.readFileSync(path.join(root,'public/js/app.js'),'utf8'),ctx);init();await new Promise(setImmediate);tick();
if (!search) {assert.equal(sent.sectors[0].aiStatus,'uncertain');assert.equal(sent.sectors[0].detectedCarsCount,null);console.log('Vídeo local sem detector: disponibilidade incerta OK');return;}
assert.equal(posts,0);
current.sectors.a.humanOverride={status:'blocked',volunteerName:'Teste',timestamp:now};await poll();tick();assert.match(get('entranceCardsContainer').innerHTML,/INTERDITADO/);
current.sectors.a={aiStatus:'uncertain'};await poll();tick();assert.match(get('entranceCardsContainer').innerHTML,/VERIFICAR ANTES/);
current.sectors.a={aiStatus:'available_probable'};await poll();now+=6000;tick();assert.match(get('entranceCardsContainer').innerHTML,/SINAL OFFLINE/);
console.log('Interface: painel leitor, atualização remota, interdição, incerteza e conexão perdida OK');
}
frontend().then(()=>frontend('')).catch(e=>{console.error(e);process.exitCode=1;});
