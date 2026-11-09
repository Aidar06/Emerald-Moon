import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const port=Number(process.env.PORT)||4182;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.mp4':'video/mp4','.woff2':'font/woff2'};

const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const requested=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  let file=path.resolve(root,requested);
  if(!file.startsWith(root)){response.writeHead(403).end('Forbidden');return}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  const stat=fs.statSync(file);
  const range=request.headers.range;
  if(range&&path.extname(file)==='.mp4'){
    const [startText,endText]=range.replace(/bytes=/,'').split('-');
    const start=Number(startText);const end=endText?Number(endText):stat.size-1;
    response.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Type':'video/mp4','Cache-Control':'no-cache'});
    fs.createReadStream(file,{start,end}).pipe(response);return;
  }
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
  fs.createReadStream(file).pipe(response);
});

server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/3`));
