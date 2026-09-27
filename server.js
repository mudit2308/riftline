// Riftline game server — made by Mudit Pathak
// Serves the game from ./public and relays online matches over WebSockets at /ws.
// No dependencies: needs Node.js 18 or newer. Start with:  node server.js
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||8080,PUB=path.join(__dirname,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);
  if(u==='/health'){res.writeHead(200,{'content-type':'text/plain'});res.end('ok '+rooms.size+' rooms');return;}
  let f=path.normalize(path.join(PUB,u==='/'?'index.html':u));
  if(!f.startsWith(PUB)){res.writeHead(403);res.end();return;}
  fs.readFile(f,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return;}
    res.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream','cache-control':u.endsWith('sw.js')?'no-cache':'public, max-age=300'});res.end(data);});
});
/* ---- minimal WebSocket (RFC 6455) ---- */
function frame(str){const p=Buffer.from(str);let h;if(p.length<126)h=Buffer.from([0x81,p.length]);else if(p.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(p.length,2);}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(p.length),2);}return Buffer.concat([h,p]);}
function ctl(op,p=Buffer.alloc(0)){return Buffer.concat([Buffer.from([0x80|op,p.length]),p]);}
const rooms=new Map();let nextId=1;
const CH='ABCDEFGHJKLMNPQRSTUVWXYZ';
function code(){let c;do{c=Array.from({length:4},()=>CH[Math.floor(Math.random()*CH.length)]).join('');}while(rooms.has(c));return c;}
function send(c,o){if(!c.dead)try{c.sock.write(frame(JSON.stringify(o)));}catch(e){}}
function roster(r){const players=[...r.clients].map(c=>({id:c.id,name:c.name}));for(const c of r.clients)send(c,{t:'players',players,hostId:r.host});}
function leave(c){const r=c.room;if(!r)return;r.clients.delete(c);c.room=null;
  if(!r.clients.size){rooms.delete(r.code);return;}
  if(r.host===c.id)r.host=[...r.clients][0].id;
  for(const o of r.clients)send(o,{t:'left',id:c.id});roster(r);}
function onMsg(c,txt){let m;try{m=JSON.parse(txt);}catch(e){return;}
  const name=String(m.name||'Player').replace(/[<>]/g,'').slice(0,14)||'Player';
  if(m.t==='create'){leave(c);const r={code:code(),clients:new Set(),host:c.id};rooms.set(r.code,r);c.room=r;c.name=name;r.clients.add(c);
    send(c,{t:'joined',code:r.code,id:c.id,hostId:r.host,players:[{id:c.id,name}]});return;}
  if(m.t==='join'){const r=rooms.get(String(m.code||'').toUpperCase());if(!r){send(c,{t:'error',msg:'No room with that code. Check it with your friend.'});return;}
    if(r.clients.size>=8){send(c,{t:'error',msg:'That room is full (8 players).'});return;}
    leave(c);c.room=r;c.name=name;r.clients.add(c);send(c,{t:'joined',code:r.code,id:c.id,hostId:r.host,players:[...r.clients].map(x=>({id:x.id,name:x.name}))});roster(r);return;}
  if(m.t==='relay'&&c.room){const out={t:'relay',from:c.id,d:m.d};for(const o of c.room.clients)if(o!==c)send(o,out);return;}
  if(m.t==='leave')leave(c);}
server.on('upgrade',(req,sock)=>{
  if((req.url||'').split('?')[0]!=='/ws'||req.headers.upgrade!=='websocket'){sock.destroy();return;}
  const key=req.headers['sec-websocket-key'];if(!key){sock.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  sock.setNoDelay(true);
  const c={id:'c'+(nextId++),sock,room:null,name:'Player',dead:false,buf:Buffer.alloc(0),frag:[],alive:true};
  sock.on('data',d=>{c.buf=Buffer.concat([c.buf,d]);
    for(;;){const b=c.buf;if(b.length<2)break;const fin=b[0]&0x80,op=b[0]&0x0f,masked=b[1]&0x80;let len=b[1]&0x7f,off=2;
      if(len===126){if(b.length<4)break;len=b.readUInt16BE(2);off=4;}else if(len===127){if(b.length<10)break;len=Number(b.readBigUInt64BE(2));off=10;}
      if(len>1<<20){sock.destroy();return;}
      const mo=off;if(masked)off+=4;if(b.length<off+len)break;
      let p=b.subarray(off,off+len);if(masked){const k=b.subarray(mo,mo+4);p=Buffer.from(p);for(let i=0;i<p.length;i++)p[i]^=k[i&3];}
      c.buf=b.subarray(off+len);
      if(op===8){try{sock.end(ctl(8));}catch(e){}return;}
      if(op===9){try{sock.write(ctl(10,p));}catch(e){}continue;}
      if(op===10){c.alive=true;continue;}
      if(op===1||op===0){c.frag.push(p);if(fin){const txt=Buffer.concat(c.frag).toString('utf8');c.frag=[];onMsg(c,txt);}}
    }});
  const bye=()=>{if(c.dead)return;c.dead=true;leave(c);};
  sock.on('close',bye);sock.on('error',bye);sock.on('end',bye);
  c.ping=setInterval(()=>{if(c.dead){clearInterval(c.ping);return;}if(!c.alive){sock.destroy();return;}c.alive=false;try{sock.write(ctl(9));}catch(e){}},25000);
});
server.listen(PORT,()=>console.log(`Riftline server (made by Mudit Pathak) on http://localhost:${PORT}  ·  WebSocket at /ws`));
