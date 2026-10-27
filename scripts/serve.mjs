import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.md':'text/plain; charset=utf-8'};
const publicFiles=new Set(['index.html','preview.html','styles.css','MODEL_CONFIG.json','resort-map.json','resort-map.png','BEHAVIOR_SPEC.md','MAP_SPEC.md','README.md']);
const port=Number(process.env.PORT??43880);
http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  if(name.includes('..')||name.includes('\\')||!(publicFiles.has(name)||/^(src|reference|spec)\/[\w-]+\.(mjs|md)$/.test(name))){res.writeHead(404);res.end('Not found');return;}
  const body=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':types[path.extname(name)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Ridgeline: http://127.0.0.1:${port}`));
