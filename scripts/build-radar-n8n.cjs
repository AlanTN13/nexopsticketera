/* eslint-disable @typescript-eslint/no-require-imports -- Build-time n8n export generator. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
if (process.argv.includes('--sync-site-contract')) {
  const crypto = require('node:crypto');
  const provenance = {};
  for (const filename of ['news-contract.mjs','news-image-policy.mjs']) {
    const raw = fs.readFileSync(path.join(root,'../web/scripts',filename),'utf8');
    const body = filename === 'news-contract.mjs' ? raw : raw.slice(raw.indexOf('export const VISUAL_TYPES'),raw.indexOf('export function validateCoverCollection'));
    fs.writeFileSync(path.join(root,'src/lib/radar-site-contract',filename),'// Generated from webneoxps/scripts/'+filename+'; run scripts/build-radar-n8n.cjs --sync-site-contract to synchronize.\n'+body);
    provenance[filename] = crypto.createHash('sha256').update(raw).digest('hex');
  }
  fs.writeFileSync(path.join(root,'src/lib/radar-site-contract/provenance.json'),JSON.stringify(provenance,null,2)+'\n');
}
// Cloud task runners strip accessor descriptors used by esbuild namespace
// exports. Capture only our public functions as ordinary data properties.
const result = esbuild.buildSync({stdin:{contents:"import { advanceRadarN8n, sanitizeRadarResponse, decideRadarN8n } from './src/lib/radar-n8n-editorial.ts'; __radarExport({ advanceRadarN8n, sanitizeRadarResponse, decideRadarN8n });",resolveDir:root,loader:'ts'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,external:['crypto'],alias:{'node:crypto':'crypto','server-only':path.join(root,'n8n/empty.mjs')},inject:[path.join(root,'n8n/runtime-globals.mjs')]});
const bundle = 'let engine; const __radarExport = value => { engine = value; };\n'+result.outputFiles[0].text.replace(/require\("server-only"\)/g, '({})')+'\n';
const nodes=[];const connections={};
function node(name,type,parameters,position,extra={}){nodes.push({id:name.toLowerCase().replace(/ /g,'-'),name,type:'n8n-nodes-base.'+type,typeVersion:type==='httpRequest'?4.2:type==='code'?2:type==='if'?2.2:2,position,parameters,...extra});}
function link(from,to,output=0){ connections[from]??={main:[]}; while(connections[from].main.length<=output)connections[from].main.push([]); connections[from].main[output].push({node:to,type:'main',index:0}); }
function portal(name,operation,body,position){node(name,'httpRequest',{method:'POST',url:"={{ $vars.RADAR_PORTAL_ORIGIN + '/api/radar/runs/' + $('Private webhook').first().json.body.runId + '/n8n' }}",authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:`={{ { operation: '${operation}', executionId: $execution.id, ${body} } }}`,options:{timeout:55000,redirect:{redirect:{followRedirects:false}}}},position,{credentials:{httpHeaderAuth:{id:'REPLACE_PORTAL_CREDENTIAL_ID',name:'Radar Portal callback'}},retryOnFail:false});}
node('Private webhook','webhook',{httpMethod:'POST',path:'radar-nexops-v1',authentication:'headerAuth',responseMode:'onReceived',options:{responseCode:202}},[0,0],{webhookId:'radar-nexops-v1',credentials:{httpHeaderAuth:{id:'REPLACE_WEBHOOK_CREDENTIAL_ID',name:'Radar private dispatch'}}});
portal('Claim run','claim','',[220,0]);
node('Advance editorial','code',{jsCode:bundle+'return [{json: await engine.advanceRadarN8n($json)}];'},[440,0]);
node('Needs OpenAI','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'needs-request',leftValue:'={{ !!$json.request }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},[660,0]);
portal('Authorize request','checkpoint','state: $json',[880,-160]);
node('OpenAI web search','httpRequest',{method:'POST',url:'https://api.openai.com/v1/responses',authentication:'predefinedCredentialType',nodeCredentialType:'openAiApi',sendBody:true,specifyBody:'json',jsonBody:'={{ $json.request }}',options:{timeout:45000,redirect:{redirect:{followRedirects:false}}}},[1100,-160],{credentials:{openAiApi:{id:'REPLACE_OPENAI_CREDENTIAL_ID',name:'Radar OpenAI'}},retryOnFail:false,onError:'continueRegularOutput'});
node('Preserve safe response','code',{jsCode:bundle+"const state = $('Authorize request').item.json; state.responses.push(engine.sanitizeRadarResponse($json)); return [{json:state}];"},[1320,-160]);
portal('Prepare PNG and gates','prepare','state: $json',[880,160]);
node('Eligibility then score','code',{jsCode:bundle+'return [{json:{...$json,decision:engine.decideRadarN8n($json.state,$json.gates,$json.bands)}}];'},[1100,160]);
portal('Finish in Portal','finish','state: $json.state, decision: $json.decision',[1320,160]);
link('Private webhook','Claim run');link('Claim run','Advance editorial');link('Advance editorial','Needs OpenAI');link('Needs OpenAI','Authorize request');link('Authorize request','OpenAI web search');link('OpenAI web search','Preserve safe response');link('Preserve safe response','Advance editorial');link('Needs OpenAI','Prepare PNG and gates',1);link('Prepare PNG and gates','Eligibility then score');link('Eligibility then score','Finish in Portal');
const workflow={name:'Radar NexOps — n8n controlled pilot',active:false,nodes,connections,settings:{executionOrder:'v1',executionTimeout:240,saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveExecutionProgress:false,saveManualExecutions:false},pinData:{},tags:[]};
const dest=path.join(root,'n8n/radar-nexops.json');
const output=JSON.stringify(workflow,null,2)+'\n';
if(process.argv.includes('--check')) { if(fs.readFileSync(dest,'utf8')!==output)throw new Error('Regenerate n8n/radar-nexops.json'); }
else fs.writeFileSync(dest,output);
console.log('n8n export '+(process.argv.includes('--check')?'verified':'generated')+'; no cron, credentials or execution data embedded.');
