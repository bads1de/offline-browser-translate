var sn=16*1024*1024,an="hachiue-model-cache-v1",Ye="chunks";function nr(n){let t=3735928559^n.length,s=1103547991^n.length;for(let a=0;a<n.length;a++){let r=n.charCodeAt(a);t=Math.imul(t^r,2654435761),s=Math.imul(s^r,1597334677)}return t=Math.imul(t^t>>>16,2246822507)^Math.imul(s^s>>>13,3266489909),s=Math.imul(s^s>>>16,2246822507)^Math.imul(t^t>>>13,3266489909),(s>>>0).toString(16).padStart(8,"0")+(t>>>0).toString(16).padStart(8,"0")}function nt(){return new Promise((n,t)=>{let s=indexedDB.open(an,1);s.onupgradeneeded=()=>{let a=s.result;a.objectStoreNames.contains(Ye)||a.createObjectStore(Ye)},s.onsuccess=()=>n(s.result),s.onerror=()=>t(s.error)})}async function mt(n,t){if(typeof indexedDB>"u")return;let s=t??await nt();return new Promise((a,r)=>{let d=s.transaction(Ye,"readonly").objectStore(Ye).get(n);d.onsuccess=()=>{t||s.close(),a(d.result)},d.onerror=()=>{t||s.close(),r(d.error)}})}async function on(n,t){if(typeof indexedDB>"u")return!1;let s=t??await nt();return new Promise((a,r)=>{let d=s.transaction(Ye,"readonly").objectStore(Ye).count(n);d.onsuccess=()=>{t||s.close(),a(d.result>0)},d.onerror=()=>{t||s.close(),r(d.error)}})}async function vr(n,t,s){if(typeof indexedDB>"u")return;let a=s??await nt();return new Promise((r,u)=>{let d=a.transaction(Ye,"readwrite");d.objectStore(Ye).put(t,n),d.oncomplete=()=>{s||a.close(),r()},d.onerror=()=>{s||a.close(),u(d.error)}})}async function un(){if(typeof indexedDB>"u")return;let n=await nt();return new Promise((t,s)=>{let a=n.transaction(Ye,"readwrite");a.objectStore(Ye).clear(),a.oncomplete=()=>{n.close(),t()},a.onerror=()=>{n.close(),s(a.error)}})}async function Ct(){try{if(typeof navigator<"u"&&navigator.storage?.getDirectory)return await navigator.storage.getDirectory()}catch{}return null}async function Ft(n,t,s){let a=nr(n),r=await Ct();if(r)try{let d=await(await(await r.getFileHandle(`${a}.meta.json`)).getFile()).text();if(d){let g=JSON.parse(d),f=Math.min(s,g.totalSize-1);if(f>=t){let I=Math.floor(t/g.chunkBytes),k=Math.floor(f/g.chunkBytes),i=new Set(g.completedChunks),_=!0;for(let b=I;b<=k;b++)if(!i.has(b)){_=!1;break}if(_){let m=await(await r.getFileHandle(`${a}.gguf.bin`)).getFile();if(m.size>f){let P=m.slice(t,f+1);return new Uint8Array(await P.arrayBuffer())}}}}}catch{}try{let u=typeof indexedDB<"u"?await nt():null;if(!u)return null;try{let d=await mt(`meta:${a}`,u);if(!d||d.completedChunks.length===0)return null;let g=Math.min(s,d.totalSize-1);if(g<t)return null;let f=Math.floor(t/d.chunkBytes),I=Math.floor(g/d.chunkBytes),k=new Set(d.completedChunks);for(let b=f;b<=I;b++)if(!k.has(b))return null;let i=new Uint8Array(g-t+1),_=0;for(let b=f;b<=I;b++){let m=await mt(`chunk:${a}:${b}`,u);if(!m)return null;let P=b*d.chunkBytes,A=Math.max(0,t-P),H=Math.min(m.byteLength,g+1-P),$=m.subarray(A,H);i.set($,_),_+=$.byteLength}return i}finally{u.close()}}catch{return null}}async function Rt(n,t){let s=nr(n),a=await Ct();if(a)try{let u=await(await a.getFileHandle(`${s}.meta.json`)).getFile(),d=JSON.parse(await u.text());if(t&&d.totalSize!==t)return 0;let g=Math.ceil(d.totalSize/d.chunkBytes);return d.completedChunks.length===g?d.totalSize:0}catch{}try{let r=await mt(`meta:${s}`);if(!r||t&&r.totalSize!==t)return 0;let u=Math.ceil(r.totalSize/r.chunkBytes);return r.completedChunks.length===u?r.totalSize:0}catch{return 0}}async function sr(n,t){return await Rt(n,t)>0}async function ar(){let n=await Ct();if(n)try{for await(let t of n.keys())typeof t=="string"&&(t.endsWith(".gguf.bin")||t.endsWith(".meta.json"))&&await n.removeEntry(t).catch(()=>{})}catch{}await un().catch(()=>{})}async function ot(n,t,s,a,r={}){let u=r.chunkBytes??sn,d=r.useCache??!0,g=r.fetchRange??Ut,f=nr(n);d&&typeof navigator<"u"&&navigator.storage?.persist?.().catch(()=>{});let I=Math.floor(t/u),k=Math.ceil(s/u),i=null,_=null,b=null,m={url:n,totalSize:s,chunkBytes:u,completedChunks:[],updatedAt:Date.now()};if(d){i=await Ct();let E=null;if(i)try{let p=await(await(await i.getFileHandle(`${f}.meta.json`)).getFile()).text();if(p){let O=JSON.parse(p);O.totalSize===s&&O.chunkBytes===u&&(E=O)}}catch{}let F=null;try{if(typeof indexedDB<"u"){b=await nt();let S=await mt(`meta:${f}`,b);S&&S.totalSize===s&&S.chunkBytes===u&&(F=S)}}catch{}if(F&&(!E||F.completedChunks.length>E.completedChunks.length))m=F,i=null;else if(i)try{let S=await i.getFileHandle(`${f}.gguf.bin`,{create:!0});typeof S.createWritable=="function"?(_=await S.getFile(),E&&(m=E)):(i=null,F&&(m=F))}catch{i=null,F&&(m=F)}}let P=new Set(m.completedChunks),A=!1,H=async()=>{if(A){if(A=!1,m.completedChunks=Array.from(P),m.updatedAt=Date.now(),i)try{let F=await(await i.getFileHandle(`${f}.meta.json`,{create:!0})).createWritable();await F.write(JSON.stringify(m)),await F.close();return}catch{}await vr(`meta:${f}`,m,b).catch(()=>{})}},$=0,K=s-t,y=(E,F)=>{E>$&&($=E),r.onProgress?.({phase:"weights",loadedBytes:Math.min($,K),totalBytes:K,cached:F})},U=async E=>{if(r.signal?.aborted)throw new DOMException("Model loading aborted","AbortError");let F=E*u,S=Math.min(s,F+u),p=S-F,O=null,v=!1;if(d&&P.has(E)){if(i&&_&&_.size>=S)if(!a)O=new Uint8Array(0),v=!0;else try{let B=_.slice(F,S);O=new Uint8Array(await B.arrayBuffer()),v=!0}catch{O=null}if(!O)try{if(!a)await on(`chunk:${f}:${E}`,b)&&(O=new Uint8Array(0),v=!0);else{let B=await mt(`chunk:${f}:${E}`,b);B&&B.byteLength===p&&(O=B,v=!0)}}catch{O=null}}let h=E===0?Mr(n):null;if(!O){let B=Math.max(0,F-t);if(h&&h.byteLength>0&&h.byteLength<=p)if(h.byteLength===p)O=h;else{let T=h.byteLength,R=await g(n,T,S-1,r.signal,ie=>{let Y=Math.max(0,T+ie-t);Y>B&&y(Y,!1)}),j=new Uint8Array(p);j.set(h,0),j.set(R,T),O=j}else O=await g(n,F,S-1,r.signal,T=>{let R=Math.max(0,F+T-t);R>B&&y(R,!1)});if(O.byteLength!==p)throw new Error(`hachiue: chunk ${E} returned ${O.byteLength} bytes, expected ${p}`)}return{ci:E,chunkStart:F,chunkEndExclusive:S,data:O,fromCache:v}},Q=async(E,F,S)=>{if(d){if(i){let p=null;try{p=await(await i.getFileHandle(`${f}.gguf.bin`,{create:!0})).createWritable({keepExistingData:!0}),await p.write({type:"write",position:F,data:S}),await p.close(),p=null,P.add(E),A=!0,((E&3)===0||E===k-1)&&await H();return}catch{p&&await p.close().catch(()=>{}),await i.removeEntry(`${f}.gguf.bin`).catch(()=>{}),await i.removeEntry(`${f}.meta.json`).catch(()=>{}),i=null}}if(!i)try{!b&&typeof indexedDB<"u"&&(b=await nt()),await vr(`chunk:${f}:${E}`,S,b),P.add(E),A=!0,((E&3)===0||E===k-1)&&await H()}catch{}}};try{let E=I<k?U(I):null;for(let F=I;F<k;F++){let S=await E;E=F+1<k?U(F+1):null,E?.catch(()=>{});let p=Math.max(0,t-S.chunkStart),O=a&&p>0?S.data.subarray(p):S.data;await Promise.all([S.fromCache?Promise.resolve():Q(F,S.chunkStart,S.data),a?a(O,S.chunkStart+p):S.fromCache?Promise.resolve():new Promise(v=>setTimeout(v,0))]),S.data=null,y(S.chunkEndExclusive-t,S.fromCache)}}finally{await H().catch(()=>{}),b&&b.close()}}async function or(n,t={}){let s=await gt(n,t);return await ot(n,0,s.totalFileSize,null,{...t,useCache:!0}),s}var te;(function(n){n[n.F32=0]="F32",n[n.F16=1]="F16",n[n.Q4_0=2]="Q4_0",n[n.Q4_1=3]="Q4_1",n[n.Q8_0=8]="Q8_0",n[n.Q4_K=12]="Q4_K",n[n.Q6_K=14]="Q6_K",n[n.Q1_0=41]="Q1_0",n[n.Q2_0=42]="Q2_0",n[n.PQ2_0=142]="PQ2_0",n[n.PTQ1_0=143]="PTQ1_0"})(te||(te={}));var pt=null;function Mr(n){if(pt&&pt.url===n){let t=pt.bytes;return pt=null,t}return null}var cn=1179993927,ln=32,dn=2*1024*1024,ir=32*1024*1024,bt=class extends Error{constructor(){super("GGUF header buffer truncated")}};function st(n){switch(n){case te.F32:return[1,4];case te.F16:return[1,2];case te.Q4_0:return[32,18];case te.Q4_1:return[32,20];case te.Q8_0:return[32,34];case te.Q4_K:return[256,144];case te.Q6_K:return[256,210];case te.Q1_0:return[128,18];case te.Q2_0:return[64,18];case te.PQ2_0:return[128,34];case te.PTQ1_0:return[128,28];default:throw new Error(`hachiue: unsupported GGML tensor type ${n}`)}}function Ar(n,t){let[s,a]=st(t),r=n.reduce((u,d)=>u*d,1);if(r%s!==0)throw new Error(`hachiue: tensor elements (${r}) not divisible by block size (${s})`);return r/s*a}function wt(n){let t=n&32768?-1:1,s=n>>10&31,a=n&1023;return s===0?t*a*2**-24:s===31?a?NaN:t*(1/0):t*(1024+a)*2**(s-25)}function Lr(n){let t=new DataView(n.buffer,n.byteOffset,n.byteLength),s=new TextDecoder,a=0,r=v=>{if(a+v>n.byteLength)throw new bt},u=()=>(r(1),t.getUint8(a++)),d=()=>(r(1),t.getInt8(a++)),g=()=>{r(2);let v=t.getUint16(a,!0);return a+=2,v},f=()=>{r(2);let v=t.getInt16(a,!0);return a+=2,v},I=()=>{r(4);let v=t.getUint32(a,!0);return a+=4,v},k=()=>{r(4);let v=t.getInt32(a,!0);return a+=4,v},i=()=>{r(4);let v=t.getFloat32(a,!0);return a+=4,v},_=()=>{r(8);let v=t.getFloat64(a,!0);return a+=8,v},b=()=>{r(8);let v=t.getUint32(a,!0),h=t.getUint32(a+4,!0);return a+=8,h*4294967296+v},m=()=>{r(8);let v=t.getUint32(a,!0),h=t.getInt32(a+4,!0);return a+=8,h*4294967296+v},P=()=>{let v=b();r(v);let h=s.decode(n.subarray(a,a+v));return a+=v,h},A=v=>{switch(v){case 0:return u();case 1:return d();case 2:return g();case 3:return f();case 4:return I();case 5:return k();case 6:return i();case 7:return u()!==0;case 8:return P();case 9:{let h=I(),B=b(),T=new Array(B);for(let R=0;R<B;R++)T[R]=A(h);return T}case 10:return b();case 11:return m();case 12:return _();default:throw new Error(`hachiue: unknown GGUF metadata value type ${v}`)}};if(I()!==cn)throw new Error("hachiue: invalid GGUF magic header");let H=I();if(H!==2&&H!==3)throw new Error(`hachiue: unsupported GGUF version ${H}`);let $=b(),K=b(),y={};for(let v=0;v<K;v++){let h=P(),B=I();y[h]=A(B)}let U=[];for(let v=0;v<$;v++){let h=P(),B=I(),T=[];for(let ie=0;ie<B;ie++)T.push(b());let R=I(),j=b();U.push({name:h,dims:T,type:R,relOffset:j})}let Q=Number(y["general.alignment"]??ln),E=Math.ceil(a/Q)*Q,F={},S=E;for(let v of U){let h=Ar(v.dims,v.type),B=E+v.relOffset;F[v.name]={name:v.name,dims:v.dims,type:v.type,relOffset:v.relOffset,absOffset:B,byteLength:h},B+h>S&&(S=B+h)}let p=_n(y,F),O=fn(y);return{version:H,tensorCount:$,kvCount:K,dataStartOffset:E,totalFileSize:S,meta:y,tensors:F,arch:p,tokenizer:O}}function _n(n,t){let s=String(n["general.architecture"]??"");if(s!=="qwen3"&&s!=="qwen35"&&s!=="plamo3")throw new Error(`hachiue: unsupported model architecture "${s}" (expected "qwen3", "qwen35", or "plamo3")`);let a=h=>n[`${s}.${h}`],r=h=>{let B=a(h);if(B===void 0)throw new Error(`hachiue: missing required GGUF metadata ${s}.${h}`);return Number(B)},u=r("block_count"),d=r("embedding_length"),g=r("feed_forward_length"),f=r("attention.head_count"),I=r("attention.head_count_kv"),k=Number(a("attention.key_length")??d/f),i=r("attention.layer_norm_rms_epsilon"),_=r("context_length"),b=t["token_embd.weight"];if(!b)throw new Error("hachiue: missing token_embd.weight tensor");let m=b.dims[1],P=!("output.weight"in t),A=Number(n["tokenizer.ggml.eos_token_id"]??151645),H=n["tokenizer.ggml.eom_token_id"]!==void 0?Number(n["tokenizer.ggml.eom_token_id"]):void 0,$=n["tokenizer.ggml.eot_token_id"]!==void 0?Number(n["tokenizer.ggml.eot_token_id"]):void 0,K=n["tokenizer.ggml.bos_token_id"]!==void 0?Number(n["tokenizer.ggml.bos_token_id"]):void 0,y=n["tokenizer.ggml.padding_token_id"]!==void 0?Number(n["tokenizer.ggml.padding_token_id"]):void 0,U=Number(a("rope.freq_base")??1e6),Q=a("rope.freq_base_swa")!==void 0?Number(a("rope.freq_base_swa")):void 0,E=String(a("rope.scaling.type")??"none"),F=Number(a("rope.dimension_count")??k),S={theta:U,localTheta:Q,type:E==="yarn"?"yarn":s==="qwen35"?"mrope":"normal",factor:Number(a("rope.scaling.factor")??1),originalMaxPositions:Number(a("rope.scaling.original_context_length")??_),rotaryDim:F,yarnBetaFast:a("rope.scaling.yarn_beta_fast")!==void 0?Number(a("rope.scaling.yarn_beta_fast")):void 0,yarnBetaSlow:a("rope.scaling.yarn_beta_slow")!==void 0?Number(a("rope.scaling.yarn_beta_slow")):void 0,yarnTruncate:a("rope.scaling.yarn_truncate")!==void 0?!!a("rope.scaling.yarn_truncate"):void 0},p;if(s==="plamo3"&&a("attention.sliding_window")!==void 0){let h=Number(a("attention.sliding_window")),B=Number(a("attention.sliding_window_pattern")??8),T=[];for(let R=0;R<u;R++)T.push((R+1)%B===0?"full":"swa");p={windowSize:h,pattern:B,layerTypes:T}}let O;if(s==="qwen35"){let h=r("full_attention_interval"),B=r("ssm.group_count"),T=r("ssm.time_step_rank"),R=r("ssm.state_size"),j=r("ssm.conv_kernel"),ie=[];for(let Y=0;Y<u;Y++)ie.push(Y%h===h-1?"full":"linear");O={layerTypes:ie,linearKeyHeads:B,linearValueHeads:T,linearHeadDim:R,convKernel:j}}let v;if(n["prism.hadamard.version"]!==void 0){let h=Number(n["prism.hadamard.version"]),B=Number(n["prism.hadamard.block_size"]??512),T=!!(n["prism.hadamard.tied_output"]??!1),R=!!(n["prism.hadamard.gdn_v_grouped"]??!1),j=String(n["prism.hadamard.sign_mode"]??"identity"),ie=n["prism.hadamard.weight_names"]??[],Y=n["prism.hadamard.inverse_weight_names"]??[],he=new Map;if(j==="explicit"){let De=n["prism.hadamard.sign_widths"]??[],Se=n["prism.hadamard.sign_values"]??[],ue=0;for(let be of De){let Le=new Int8Array(be);for(let ye=0;ye<be;ye++)Le[ye]=Se[ue+ye];he.set(be,Le),ue+=be}}let Oe=new Set(ie);T&&Y.includes("token_embd.weight")&&Oe.add("output.weight"),v={version:h,blockSize:B,tiedOutput:T,gdnVGrouped:R,signMode:j,signsByWidth:he,foldedWeights:Oe,inverseWeights:new Set(Y)}}return{archName:s,modelName:String(n["general.name"]??s),sizeLabel:String(n["general.size_label"]??""),layers:u,hidden:d,intermediate:g,heads:f,kvHeads:I,headDim:k,rmsEps:i,maxPositions:_,vocab:m,eosTokenId:A,eomTokenId:H,eotTokenId:$,bosTokenId:K,padTokenId:y,tieWordEmbeddings:P,rope:S,hybrid:O,swa:p,hadamard:v}}function fn(n){let t=n["tokenizer.ggml.tokens"];if(!t)return;let s=String(n["tokenizer.ggml.model"]??"gpt2"),a=n["tokenizer.ggml.merges"]??[],r=n["tokenizer.ggml.scores"];if(!(s!=="plamo3"&&a.length===0&&!r))return{model:s,tokens:t,scores:r,tokenTypes:n["tokenizer.ggml.token_type"],merges:a,eosTokenId:Number(n["tokenizer.ggml.eos_token_id"]??151645),eomTokenId:n["tokenizer.ggml.eom_token_id"]!==void 0?Number(n["tokenizer.ggml.eom_token_id"]):void 0,eotTokenId:n["tokenizer.ggml.eot_token_id"]!==void 0?Number(n["tokenizer.ggml.eot_token_id"]):void 0,bosTokenId:n["tokenizer.ggml.bos_token_id"]!==void 0?Number(n["tokenizer.ggml.bos_token_id"]):void 0,padTokenId:n["tokenizer.ggml.padding_token_id"]!==void 0?Number(n["tokenizer.ggml.padding_token_id"]):void 0,addBosToken:!!(n["tokenizer.ggml.add_bos_token"]??!1),chatTemplate:n["tokenizer.chat_template"],breakAroundConsecutiveSpacesThreshold:n["tokenizer.ggml.break_around_consecutive_spaces_threshold"]!==void 0?Number(n["tokenizer.ggml.break_around_consecutive_spaces_threshold"]):void 0,breakAroundRepeatedCharsThreshold:n["tokenizer.ggml.break_around_repeated_chars_threshold"]!==void 0?Number(n["tokenizer.ggml.break_around_repeated_chars_threshold"]):void 0}}async function Ut(n,t,s,a,r){let u=s-t+1,d=await fetch(n,{headers:{Range:`bytes=${t}-${s}`},signal:a});if(d.status===206){if(d.body&&r){let f=d.body.getReader(),I=new Uint8Array(u),k=0,i=0;try{for(;k<u;){let{done:_,value:b}=await f.read();if(_)break;let m=Math.min(b.byteLength,u-k);I.set(b.subarray(0,m),k),k+=m,(k-i>=512*1024||k===u)&&(i=k,r(k))}}finally{f.releaseLock()}return k===u?I:I.subarray(0,k)}let g=await d.arrayBuffer();return r?.(g.byteLength),new Uint8Array(g)}if(d.ok&&d.body){let g=d.body.getReader(),f=new Uint8Array(u),I=0,k=0;try{for(;k<u;){let{done:i,value:_}=await g.read();if(i)break;if(I+_.byteLength>t){let b=Math.max(0,t-I),m=Math.min(_.byteLength,b+(u-k));f.set(_.subarray(b,m),k),k+=m-b}I+=_.byteLength}}finally{await g.cancel().catch(()=>{})}return f.subarray(0,k)}throw new Error(`hachiue: HTTP Range fetch failed (${d.status} ${d.statusText}) for ${n}`)}async function gt(n,t={}){let s=t.fetchRange??Ut,a=t.useCache??!0;t.onProgress?.({phase:"header",message:"Fetching GGUF header..."});let r=async(I,k)=>{if(a&&!t.fetchRange){let i=await Ft(n,I,k);if(i)return i}return s(n,I,k,t.signal)},u=dn,d=!1,g=null;a&&!t.fetchRange&&(g=await Ft(n,0,u-1)),g||(g=await s(n,0,u-1,t.signal),d=!0);let f=new Uint8Array(g);for(;;)try{let I=Lr(f);return d&&a&&(pt={url:n,bytes:f}),I}catch(I){if(!(I instanceof bt))throw I;if(f.byteLength<u)throw new Error(`hachiue: GGUF file at ${n} is truncated inside the header (${f.byteLength} bytes)`);if(u>=ir)throw new Error(`hachiue: GGUF header exceeds ${ir} bytes`);let k=Math.min(u*2,ir),i=await r(f.byteLength,k-1),_=new Uint8Array(f.byteLength+i.byteLength);_.set(f,0),_.set(i,f.byteLength),f=_,u=k}}var ur={embed_gather:`
struct Params { H: u32, mode: u32, S: u32, rowOffset: u32, rowCount: u32, _p0: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> tokens: array<u32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read_write> out: array<f32>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

fn readSByte(byteIdx: u32) -> i32 {
  let b = readByte(byteIdx);
  return select(i32(b), i32(b) - 256, b >= 128u);
}

fn readFp16AtByte(byteIdx: u32) -> f32 {
  let u16val = readByte(byteIdx) | (readByte(byteIdx + 1u) << 8u);
  return unpack2x16float(u16val).x;
}

fn readScale(scaleIdx: u32) -> f32 {
  let pair = unpack2x16float(scales16[scaleIdx >> 1u]);
  return select(pair.x, pair.y, (scaleIdx & 1u) != 0u);
}

fn ptqTrit(blockBaseByte: u32, idxInBlock: u32) -> f32 {
  let pow3 = array<u32, 5>(1u, 3u, 9u, 27u, 81u);
  var b: u32 = 0u;
  var p3: u32 = 1u;
  if (idxInBlock < 80u) {
    let n = idxInBlock / 16u;
    let m = idxInBlock % 16u;
    b = readByte(blockBaseByte + m);
    p3 = pow3[n];
  } else if (idxInBlock < 120u) {
    let rem = idxInBlock - 80u;
    let n = rem / 8u;
    let m = rem % 8u;
    b = readByte(blockBaseByte + 16u + m);
    p3 = pow3[n];
  } else {
    let rem = idxInBlock - 120u;
    let n = rem / 2u;
    let h = rem % 2u;
    b = readByte(blockBaseByte + 24u + h);
    p3 = pow3[n];
  }
  let q = (b * p3) & 0xffu;
  let xi = (q * 3u) >> 8u;
  return f32(i32(xi) - 1);
}

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let s = wg.y;
  if (s >= p.S) { return; }
  let rawTok = tokens[s];
  if (rawTok < p.rowOffset || rawTok >= p.rowOffset + p.rowCount) { return; }
  let tok = rawTok - p.rowOffset;

  for (var k = lid.x; k < p.H; k = k + 256u) {
    var val = 0.0;
    if (p.mode <= 2u) {
      let nb = p.H >> 7u;
      let blk = k >> 7u;
      let inBlk = k & 127u;
      let scale = readScale((tok * nb) + blk);
      if (p.mode == 0u) {
        let wordIdx = (tok * nb + blk) * 4u + (inBlk >> 5u);
        let bit = (quants[wordIdx] >> (inBlk & 31u)) & 1u;
        val = select(-scale, scale, bit != 0u);
      } else if (p.mode == 1u) {
        let wordIdx = (tok * nb + blk) * 8u + (inBlk >> 4u);
        let shift = (inBlk & 15u) * 2u;
        let q = (quants[wordIdx] >> shift) & 3u;
        val = f32(i32(q) - 1) * scale;
      } else {
        let baseByte = (tok * nb + blk) * 26u;
        val = ptqTrit(baseByte, inBlk) * scale;
      }
    } else if (p.mode == 3u) {
      // Q4_0: 32 elems per 18-byte block
      let nb = p.H >> 5u;
      let blk = k >> 5u;
      let inBlk = k & 31u;
      let baseByte = (tok * nb + blk) * 18u;
      let d = readFp16AtByte(baseByte);
      let qByte = readByte(baseByte + 2u + (inBlk & 15u));
      let nib = select(qByte & 15u, qByte >> 4u, inBlk >= 16u);
      val = (f32(nib) - 8.0) * d;
    } else if (p.mode == 4u) {
      // Q4_1: 32 elems per 20-byte block
      let nb = p.H >> 5u;
      let blk = k >> 5u;
      let inBlk = k & 31u;
      let baseByte = (tok * nb + blk) * 20u;
      let d = readFp16AtByte(baseByte);
      let m = readFp16AtByte(baseByte + 2u);
      let qByte = readByte(baseByte + 4u + (inBlk & 15u));
      let nib = select(qByte & 15u, qByte >> 4u, inBlk >= 16u);
      val = f32(nib) * d + m;
    } else if (p.mode == 5u) {
      // Q4_K: 256 elems per 144-byte block
      let nb = p.H >> 8u;
      let blk = k >> 8u;
      let inBlk = k & 255u;
      let baseByte = (tok * nb + blk) * 144u;
      let d = readFp16AtByte(baseByte);
      let dmin = readFp16AtByte(baseByte + 2u);
      let sub = inBlk >> 5u; // 0..7
      let l = inBlk & 31u;
      var sc: u32 = 0u;
      var mn: u32 = 0u;
      if (sub < 4u) {
        sc = readByte(baseByte + 4u + sub) & 63u;
        mn = readByte(baseByte + 8u + sub) & 63u;
      } else {
        sc = (readByte(baseByte + 8u + sub) & 15u) | ((readByte(baseByte + sub) >> 6u) << 4u);
        mn = (readByte(baseByte + 8u + sub) >> 4u) | ((readByte(baseByte + 4u + sub) >> 6u) << 4u);
      }
      let qByte = readByte(baseByte + 16u + (sub >> 1u) * 32u + l);
      let nib = select(qByte & 15u, qByte >> 4u, (sub & 1u) != 0u);
      val = d * f32(sc) * f32(nib) - dmin * f32(mn);
    } else {
      // Q6_K: 256 elems per 210-byte block
      let nb = p.H >> 8u;
      let blk = k >> 8u;
      let inBlk = k & 255u;
      let baseByte = (tok * nb + blk) * 210u;
      let d = readFp16AtByte(baseByte + 208u);
      let n = inBlk >> 7u; // 0..1
      let rem = inBlk & 127u;
      let qGroup = rem >> 5u; // 0..3
      let l = rem & 31u;
      let qlByte = readByte(baseByte + n * 64u + (qGroup & 1u) * 32u + l);
      let qhByte = readByte(baseByte + 128u + n * 32u + l);
      let qlNib = select(qlByte & 15u, qlByte >> 4u, qGroup >= 2u);
      let qhBits = (qhByte >> (qGroup * 2u)) & 3u;
      let q = i32(qlNib | (qhBits << 4u)) - 32;
      let sc = readSByte(baseByte + 192u + n * 8u + qGroup * 2u + (l >> 4u));
      val = d * f32(sc) * f32(q);
    }
    out[s * p.H + k] = val;
  }
}
`,hadamard_512:`
struct Params { totalRows: u32, width: u32, mode: u32, hasSigns: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read> signs: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

var<workgroup> sh: array<f32, 512>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let blocksPerRow = p.width >> 9u; // width / 512
  let blockIdx = wg.x;
  let row = blockIdx / blocksPerRow;
  if (row >= p.totalRows) { return; }
  let blkInRow = blockIdx % blocksPerRow;
  let colBase = blkInRow * 512u;
  let globalBase = row * p.width + colBase;

  let tid = lid.x;
  let i0 = tid;
  let i1 = tid + 256u;

  var v0 = src[globalBase + i0];
  var v1 = src[globalBase + i1];

  if (p.mode == 0u && p.hasSigns != 0u) {
    v0 = v0 * signs[colBase + i0];
    v1 = v1 * signs[colBase + i1];
  }

  sh[i0] = v0;
  sh[i1] = v1;
  workgroupBarrier();

  // 9 stages of butterfly for N = 512 (h = 1, 2, 4, 8, 16, 32, 64, 128, 256)
  for (var s = 0u; s < 9u; s = s + 1u) {
    let h = 1u << s;
    let idx0 = ((tid >> s) << (s + 1u)) | (tid & (h - 1u));
    let idx1 = idx0 + h;
    let a = sh[idx0];
    let b = sh[idx1];
    workgroupBarrier();
    sh[idx0] = a + b;
    sh[idx1] = a - b;
    workgroupBarrier();
  }

  // Normalization factor: 1 / sqrt(512) = 0.04419417382415922
  let norm = 0.04419417382415922;
  var out0 = sh[i0] * norm;
  var out1 = sh[i1] * norm;

  if (p.mode == 1u && p.hasSigns != 0u) {
    out0 = out0 * signs[colBase + i0];
    out1 = out1 * signs[colBase + i1];
  }

  dst[globalBase + i0] = out0;
  dst[globalBase + i1] = out1;
}
`,gemv_f32:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params { M: u32, N: u32, K: u32, gridX: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> w: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let Kvec = p.K >> 2u;
  let xBase = m * Kvec;

  var acc = vec4<f32>(0.0);
  for (var kv = tid; kv < Kvec; kv = kv + WG) {
    let xv = x[xBase + kv];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        acc[r] = acc[r] + dot(xv, w[n * Kvec + kv]);
      }
    }
  }
  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }
  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        y[m * p.N + n] = totals[r];
      }
    }
  }
}
`,permute_gdn:`
struct Params { S: u32, hd: u32, nk: u32, rep: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let width = p.hd * p.nk * p.rep;
  let total = p.S * width;
  let idx = wg.x * 256u + lid.x;
  if (idx >= total) { return; }
  let s = idx / width;
  let rem = idx % width;
  let d = rem % p.hd;
  let tmp = rem / p.hd;
  let r = tmp % p.rep;
  let k = tmp / p.rep;
  let srcIdx = s * width + (r * p.nk + k) * p.hd + d;
  dst[idx] = src[srcIdx];
}
`,rmsnorm:`
struct Params { rows: u32, D: u32, eps: f32, addUnitOffset: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> gamma: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let row = wg.x;
  if (row >= p.rows) { return; }
  let tid = lid.x;
  let base = row * p.D;
  var sumSq = 0.0;
  for (var i = tid; i < p.D; i = i + 256u) {
    let v = x[base + i];
    sumSq = sumSq + v * v;
  }
  sdata[tid] = sumSq;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }
  let inv = inverseSqrt(sdata[0] / f32(p.D) + p.eps);
  for (var i = tid; i < p.D; i = i + 256u) {
    let g = select(gamma[i], 1.0 + gamma[i], p.addUnitOffset != 0u);
    y[base + i] = x[base + i] * inv * g;
  }
}
`,gemv_q1_0:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readScale(scaleIdx: u32) -> f32 {
  let pair = unpack2x16float(scales16[scaleIdx >> 1u]);
  return select(pair.x, pair.y, (scaleIdx & 1u) != 0u);
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let numUnits = p.nb * 4u; // each unit is 32 weights (1 u32 in Q1_0)
  let xRowBase = m * (p.K >> 2u);

  var acc = vec4<f32>(0.0);

  for (var u = tid; u < numUnits; u = u + WG) {
    let blk = u >> 2u;
    let sub = u & 3u;
    let xVecBase = xRowBase + u * 8u;

    // Load 32 activations (8 x vec4<f32>) into registers once for all 4 output rows
    let x0 = x[xVecBase + 0u];
    let x1 = x[xVecBase + 1u];
    let x2 = x[xVecBase + 2u];
    let x3 = x[xVecBase + 3u];
    let x4 = x[xVecBase + 4u];
    let x5 = x[xVecBase + 5u];
    let x6 = x[xVecBase + 6u];
    let x7 = x[xVecBase + 7u];

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let word = quants[(n * p.nb + blk) * 4u + sub];
        let scale = readScale(n * p.nb + blk);
        var subSum = 0.0;
        subSum += dot(x0, vec4<f32>(select(-1.0, 1.0, (word & (1u << 0u)) != 0u), select(-1.0, 1.0, (word & (1u << 1u)) != 0u), select(-1.0, 1.0, (word & (1u << 2u)) != 0u), select(-1.0, 1.0, (word & (1u << 3u)) != 0u)));
        subSum += dot(x1, vec4<f32>(select(-1.0, 1.0, (word & (1u << 4u)) != 0u), select(-1.0, 1.0, (word & (1u << 5u)) != 0u), select(-1.0, 1.0, (word & (1u << 6u)) != 0u), select(-1.0, 1.0, (word & (1u << 7u)) != 0u)));
        subSum += dot(x2, vec4<f32>(select(-1.0, 1.0, (word & (1u << 8u)) != 0u), select(-1.0, 1.0, (word & (1u << 9u)) != 0u), select(-1.0, 1.0, (word & (1u << 10u)) != 0u), select(-1.0, 1.0, (word & (1u << 11u)) != 0u)));
        subSum += dot(x3, vec4<f32>(select(-1.0, 1.0, (word & (1u << 12u)) != 0u), select(-1.0, 1.0, (word & (1u << 13u)) != 0u), select(-1.0, 1.0, (word & (1u << 14u)) != 0u), select(-1.0, 1.0, (word & (1u << 15u)) != 0u)));
        subSum += dot(x4, vec4<f32>(select(-1.0, 1.0, (word & (1u << 16u)) != 0u), select(-1.0, 1.0, (word & (1u << 17u)) != 0u), select(-1.0, 1.0, (word & (1u << 18u)) != 0u), select(-1.0, 1.0, (word & (1u << 19u)) != 0u)));
        subSum += dot(x5, vec4<f32>(select(-1.0, 1.0, (word & (1u << 20u)) != 0u), select(-1.0, 1.0, (word & (1u << 21u)) != 0u), select(-1.0, 1.0, (word & (1u << 22u)) != 0u), select(-1.0, 1.0, (word & (1u << 23u)) != 0u)));
        subSum += dot(x6, vec4<f32>(select(-1.0, 1.0, (word & (1u << 24u)) != 0u), select(-1.0, 1.0, (word & (1u << 25u)) != 0u), select(-1.0, 1.0, (word & (1u << 26u)) != 0u), select(-1.0, 1.0, (word & (1u << 27u)) != 0u)));
        subSum += dot(x7, vec4<f32>(select(-1.0, 1.0, (word & (1u << 28u)) != 0u), select(-1.0, 1.0, (word & (1u << 29u)) != 0u), select(-1.0, 1.0, (word & (1u << 30u)) != 0u), select(-1.0, 1.0, (word & (1u << 31u)) != 0u)));
        acc[r] = acc[r] + subSum * scale;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_pq2_0:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readScale(scaleIdx: u32) -> f32 {
  let pair = unpack2x16float(scales16[scaleIdx >> 1u]);
  return select(pair.x, pair.y, (scaleIdx & 1u) != 0u);
}

fn decode4x2bit(byteVal: u32) -> vec4<f32> {
  return vec4<f32>(
    f32(i32(byteVal & 3u) - 1),
    f32(i32((byteVal >> 2u) & 3u) - 1),
    f32(i32((byteVal >> 4u) & 3u) - 1),
    f32(i32((byteVal >> 6u) & 3u) - 1)
  );
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let numUnits = p.nb * 8u; // each unit is 16 weights (1 u32 in PQ2_0)
  let xRowBase = m * (p.K >> 2u);

  var acc = vec4<f32>(0.0);

  for (var u = tid; u < numUnits; u = u + WG) {
    let blk = u >> 3u;
    let sub = u & 7u;
    let xVecBase = xRowBase + u * 4u;

    let x0 = x[xVecBase + 0u];
    let x1 = x[xVecBase + 1u];
    let x2 = x[xVecBase + 2u];
    let x3 = x[xVecBase + 3u];

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let word = quants[(n * p.nb + blk) * 8u + sub];
        let scale = readScale(n * p.nb + blk);
        var subSum = 0.0;
        subSum += dot(x0, decode4x2bit(word & 0xffu));
        subSum += dot(x1, decode4x2bit((word >> 8u) & 0xffu));
        subSum += dot(x2, decode4x2bit((word >> 16u) & 0xffu));
        subSum += dot(x3, decode4x2bit((word >> 24u) & 0xffu));
        acc[r] = acc[r] + subSum * scale;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_ptq1_0:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

fn readScale(scaleIdx: u32) -> f32 {
  let pair = unpack2x16float(scales16[scaleIdx >> 1u]);
  return select(pair.x, pair.y, (scaleIdx & 1u) != 0u);
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let numUnits = p.nb * 16u; // 16 threads cover one 128-weight PTQ1_0 block
  let xRowBase = m * p.K;
  let pow3 = array<u32, 5>(1u, 3u, 9u, 27u, 81u);

  var acc = vec4<f32>(0.0);

  for (var u = tid; u < numUnits; u = u + WG) {
    let blk = u >> 4u;
    let sub = u & 15u;
    let xBlkBase = xRowBase + blk * 128u;

    // Preload activations for this thread's assigned trits
    let xa0 = x[xBlkBase + sub + 0u];
    let xa1 = x[xBlkBase + sub + 16u];
    let xa2 = x[xBlkBase + sub + 32u];
    let xa3 = x[xBlkBase + sub + 48u];
    let xa4 = x[xBlkBase + sub + 64u];

    var xb0 = 0.0; var xb1 = 0.0; var xb2 = 0.0; var xb3 = 0.0; var xb4 = 0.0;
    if (sub < 8u) {
      xb0 = x[xBlkBase + 80u + sub + 0u];
      xb1 = x[xBlkBase + 80u + sub + 8u];
      xb2 = x[xBlkBase + 80u + sub + 16u];
      xb3 = x[xBlkBase + 80u + sub + 24u];
      xb4 = x[xBlkBase + 80u + sub + 32u];
    }
    var xc0 = 0.0; var xc1 = 0.0; var xc2 = 0.0; var xc3 = 0.0;
    if (sub < 2u) {
      xc0 = x[xBlkBase + 120u + sub + 0u];
      xc1 = x[xBlkBase + 120u + sub + 2u];
      xc2 = x[xBlkBase + 120u + sub + 4u];
      xc3 = x[xBlkBase + 120u + sub + 6u];
    }

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let baseByte = (n * p.nb + blk) * 26u;
        let scale = readScale(n * p.nb + blk);
        var subSum = 0.0;

        let ba = readByte(baseByte + sub);
        subSum += xa0 * f32(i32((((ba * 1u) & 0xffu) * 3u) >> 8u) - 1);
        subSum += xa1 * f32(i32((((ba * 3u) & 0xffu) * 3u) >> 8u) - 1);
        subSum += xa2 * f32(i32((((ba * 9u) & 0xffu) * 3u) >> 8u) - 1);
        subSum += xa3 * f32(i32((((ba * 27u) & 0xffu) * 3u) >> 8u) - 1);
        subSum += xa4 * f32(i32((((ba * 81u) & 0xffu) * 3u) >> 8u) - 1);

        if (sub < 8u) {
          let bb = readByte(baseByte + 16u + sub);
          subSum += xb0 * f32(i32((((bb * 1u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xb1 * f32(i32((((bb * 3u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xb2 * f32(i32((((bb * 9u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xb3 * f32(i32((((bb * 27u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xb4 * f32(i32((((bb * 81u) & 0xffu) * 3u) >> 8u) - 1);
        }
        if (sub < 2u) {
          let bc = readByte(baseByte + 24u + sub);
          subSum += xc0 * f32(i32((((bc * 1u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xc1 * f32(i32((((bc * 3u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xc2 * f32(i32((((bc * 9u) & 0xffu) * 3u) >> 8u) - 1);
          subSum += xc3 * f32(i32((((bc * 27u) & 0xffu) * 3u) >> 8u) - 1);
        }

        acc[r] = acc[r] + subSum * scale;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_q4_0:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

fn readFp16AtByte(byteIdx: u32) -> f32 {
  let u16val = readByte(byteIdx) | (readByte(byteIdx + 1u) << 8u);
  return unpack2x16float(u16val).x;
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let xRowBase = m * p.K;

  var acc = vec4<f32>(0.0);

  for (var blk = tid; blk < p.nb; blk = blk + WG) {
    let xBlkBase = xRowBase + blk * 32u;
    var xSum = 0.0;
    for (var j = 0u; j < 32u; j = j + 1u) {
      xSum = xSum + x[xBlkBase + j];
    }

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let baseByte = (n * p.nb + blk) * 18u + (scales16[0] & 0u);
        let d = readFp16AtByte(baseByte);
        var qDot = 0.0;
        for (var j = 0u; j < 16u; j = j + 1u) {
          let qb = readByte(baseByte + 2u + j);
          qDot = qDot + x[xBlkBase + j] * f32(qb & 15u) + x[xBlkBase + 16u + j] * f32(qb >> 4u);
        }
        acc[r] = acc[r] + (qDot - 8.0 * xSum) * d;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_q4_1:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let xRowBase = m * p.K;

  var acc = vec4<f32>(0.0);

  for (var blk = tid; blk < p.nb; blk = blk + WG) {
    let xBlkBase = xRowBase + blk * 32u;
    var xSum = 0.0;
    for (var j = 0u; j < 32u; j = j + 1u) {
      xSum = xSum + x[xBlkBase + j];
    }

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let wordBase = (n * p.nb + blk) * 5u + (scales16[0] & 0u);
        let dm = unpack2x16float(quants[wordBase]);
        let d = dm.x;
        let mn = dm.y;
        let baseByte = wordBase * 4u + 4u;
        var qDot = 0.0;
        for (var j = 0u; j < 16u; j = j + 1u) {
          let qb = readByte(baseByte + j);
          qDot = qDot + x[xBlkBase + j] * f32(qb & 15u) + x[xBlkBase + 16u + j] * f32(qb >> 4u);
        }
        acc[r] = acc[r] + qDot * d + xSum * mn;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_q4_k:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let numUnits = p.nb * 8u; // 8 sub-blocks of 32 weights per 256-weight super-block
  let xRowBase = m * p.K;

  var acc = vec4<f32>(0.0);

  for (var u = tid; u < numUnits; u = u + WG) {
    let blk = u >> 3u;
    let sub = u & 7u;
    let xSubBase = xRowBase + u * 32u;
    let isHigh = (sub & 1u) != 0u;
    let pairIdx = sub >> 1u;

    var xSum = 0.0;
    for (var l = 0u; l < 32u; l = l + 1u) {
      xSum = xSum + x[xSubBase + l];
    }

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let blkWordBase = (n * p.nb + blk) * 36u + (scales16[0] & 0u);
        let baseByte = blkWordBase * 4u;
        let dm = unpack2x16float(quants[blkWordBase]);
        let d = dm.x;
        let dmin = dm.y;

        var sc: u32 = 0u;
        var mn: u32 = 0u;
        if (sub < 4u) {
          sc = readByte(baseByte + 4u + sub) & 63u;
          mn = readByte(baseByte + 8u + sub) & 63u;
        } else {
          sc = (readByte(baseByte + 8u + sub) & 15u) | ((readByte(baseByte + sub) >> 6u) << 4u);
          mn = (readByte(baseByte + 8u + sub) >> 4u) | ((readByte(baseByte + 4u + sub) >> 6u) << 4u);
        }

        let qBaseByte = baseByte + 16u + pairIdx * 32u;
        var qDot = 0.0;
        for (var l = 0u; l < 32u; l = l + 1u) {
          let qb = readByte(qBaseByte + l);
          let nib = select(qb & 15u, qb >> 4u, isHigh);
          qDot = qDot + x[xSubBase + l] * f32(nib);
        }
        acc[r] = acc[r] + (d * f32(sc)) * qDot - (dmin * f32(mn)) * xSum;
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,gemv_q6_k:`
const WG: u32 = 64u;
const ROWS: u32 = 4u;

struct Params {
  M: u32,
  N: u32,
  K: u32,
  nb: u32,
  gridX: u32,
  hasResid: u32,
  rowOffset: u32,
  totalN: u32,
};

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> quants: array<u32>;
@group(0) @binding(3) var<storage, read> scales16: array<u32>;
@group(0) @binding(4) var<storage, read> resid: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<vec4<f32>, 64>;

fn readByte(byteIdx: u32) -> u32 {
  return (quants[byteIdx >> 2u] >> ((byteIdx & 3u) * 8u)) & 0xffu;
}

fn readSByte(byteIdx: u32) -> i32 {
  let b = readByte(byteIdx);
  return select(i32(b), i32(b) - 256, b >= 128u);
}

fn readFp16AtByte(byteIdx: u32) -> f32 {
  let u16val = readByte(byteIdx) | (readByte(byteIdx + 1u) << 8u);
  return unpack2x16float(u16val).x;
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowBase = (wg.y * p.gridX + wg.x) * ROWS;
  let m = wg.z;
  if (m >= p.M) { return; }
  let tid = lid.x;
  let numUnits = p.nb * 8u; // 8 sub-blocks of 32 weights per 256-weight super-block
  let xRowBase = m * p.K;

  var acc = vec4<f32>(0.0);

  for (var u = tid; u < numUnits; u = u + WG) {
    let blk = u >> 3u;
    let sub = u & 7u;
    let nHalf = sub >> 2u; // 0 or 1
    let qGroup = sub & 3u; // 0..3
    let xSubBase = xRowBase + u * 32u;

    for (var r = 0u; r < ROWS; r = r + 1u) {
      let rowIdx = rowBase + r;
      if (rowIdx < p.N) {
        let baseByte = (rowIdx * p.nb + blk) * 210u + (scales16[0] & 0u);
        let d = readFp16AtByte(baseByte + 208u);
        let qlBase = baseByte + nHalf * 64u + (qGroup & 1u) * 32u;
        let qhBase = baseByte + 128u + nHalf * 32u;
        let scBase = baseByte + 192u + nHalf * 8u + qGroup * 2u;
        let sc0 = f32(readSByte(scBase));
        let sc1 = f32(readSByte(scBase + 1u));
        let qhShift = qGroup * 2u;
        let isUpperNib = qGroup >= 2u;

        var sum0 = 0.0;
        for (var l = 0u; l < 16u; l = l + 1u) {
          let qlb = readByte(qlBase + l);
          let qhb = readByte(qhBase + l);
          let qlNib = select(qlb & 15u, qlb >> 4u, isUpperNib);
          let qhBits = (qhb >> qhShift) & 3u;
          let q = f32(i32(qlNib | (qhBits << 4u)) - 32);
          sum0 = sum0 + x[xSubBase + l] * q;
        }
        var sum1 = 0.0;
        for (var l = 16u; l < 32u; l = l + 1u) {
          let qlb = readByte(qlBase + l);
          let qhb = readByte(qhBase + l);
          let qlNib = select(qlb & 15u, qlb >> 4u, isUpperNib);
          let qhBits = (qhb >> qhShift) & 3u;
          let q = f32(i32(qlNib | (qhBits << 4u)) - 32);
          sum1 = sum1 + x[xSubBase + l] * q;
        }
        acc[r] = acc[r] + d * (sc0 * sum0 + sc1 * sum1);
      }
    }
  }

  sdata[tid] = acc;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) { sdata[tid] = sdata[tid] + sdata[tid + s]; }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totals = sdata[0];
    for (var r = 0u; r < ROWS; r = r + 1u) {
      let n = rowBase + r;
      if (n < p.N) {
        let outIdx = m * p.totalN + p.rowOffset + n;
        let resVal = select(0.0, resid[outIdx], p.hasResid != 0u);
        y[outIdx] = totals[r] + resVal;
      }
    }
  }
}
`,rope:`
struct Params { S: u32, H: u32, Dh: u32, rotaryDim: u32, posBase: u32, _p0: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> cosTable: array<f32>;
@group(0) @binding(2) var<storage, read> sinTable: array<f32>;
@group(0) @binding(3) var<storage, read_write> x: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let halfRot = p.rotaryDim >> 1u;
  let totalPairs = p.S * p.H * halfRot;
  let idx = wg.x * 64u + lid.x;
  if (idx >= totalPairs) { return; }

  let pair = idx % halfRot;
  let tmp = idx / halfRot;
  let h = tmp % p.H;
  let s = tmp / p.H;

  let pos = p.posBase + s;
  let csIdx = pos * halfRot + pair;
  let c = cosTable[csIdx];
  let sn = sinTable[csIdx];

  let base = (s * p.H + h) * p.Dh;
  let v0 = x[base + pair];
  let v1 = x[base + pair + halfRot];
  x[base + pair] = v0 * c - v1 * sn;
  x[base + pair + halfRot] = v1 * c + v0 * sn;
}
`,split_q_gate:`
struct Params { S: u32, H: u32, Dh: u32, _pad: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> qg: array<f32>;
@group(0) @binding(2) var<storage, read_write> q: array<f32>;
@group(0) @binding(3) var<storage, read_write> gate: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let total = p.S * p.H * p.Dh;
  let idx = wg.x * 256u + lid.x;
  if (idx >= total) { return; }
  let d = idx % p.Dh;
  let sh = idx / p.Dh;
  let srcBase = sh * (p.Dh * 2u);
  q[idx] = qg[srcBase + d];
  gate[idx] = qg[srcBase + p.Dh + d];
}
`,split_qkv:`
struct Params { S: u32, qDim: u32, kvDim: u32, _pad: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> qkv: array<f32>;
@group(0) @binding(2) var<storage, read_write> q: array<f32>;
@group(0) @binding(3) var<storage, read_write> k: array<f32>;
@group(0) @binding(4) var<storage, read_write> v: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowStride = p.qDim + 2u * p.kvDim;
  let total = p.S * rowStride;
  let idx = wg.x * 256u + lid.x;
  if (idx >= total) { return; }
  let s = idx / rowStride;
  let col = idx % rowStride;
  let val = qkv[idx];
  if (col < p.qDim) {
    q[s * p.qDim + col] = val;
  } else if (col < p.qDim + p.kvDim) {
    k[s * p.kvDim + (col - p.qDim)] = val;
  } else {
    v[s * p.kvDim + (col - p.qDim - p.kvDim)] = val;
  }
}
`,swiglu_fused:`
struct Params { S: u32, F: u32, _p0: u32, _p1: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> gateUp: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let total = p.S * p.F;
  let idx = wg.x * 256u + lid.x;
  if (idx >= total) { return; }
  let s = idx / p.F;
  let col = idx % p.F;
  let base = s * (p.F * 2u);
  let g = gateUp[base + col];
  let u = gateUp[base + p.F + col];
  out[idx] = (g / (1.0 + exp(-g))) * u;
}
`,add_inplace:`
struct Params { N: u32, _p0: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let idx = wg.x * 256u + lid.x;
  if (idx >= p.N) { return; }
  dst[idx] = a[idx] + b[idx];
}
`,sigmoid_gate:`
struct Params { N: u32, _p0: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> gate: array<f32>;
@group(0) @binding(2) var<storage, read_write> att: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let idx = wg.x * 256u + lid.x;
  if (idx >= p.N) { return; }
  let g = gate[idx];
  att[idx] = att[idx] * (1.0 / (1.0 + exp(-g)));
}
`,swiglu:`
struct Params { N: u32, _p0: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> gate: array<f32>;
@group(0) @binding(2) var<storage, read> up: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let idx = wg.x * 256u + lid.x;
  if (idx >= p.N) { return; }
  let g = gate[idx];
  out[idx] = (g / (1.0 + exp(-g))) * up[idx];
}
`,kv_append_q8:`
struct Params { S: u32, KV: u32, Dh: u32, posBase: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> cacheQ: array<u32>;
@group(0) @binding(3) var<storage, read_write> cacheS: array<f32>;

var<workgroup> smax: array<f32, 32>;
var<workgroup> sq: array<u32, 32>;

@compute @workgroup_size(32)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let blocksPerToken = p.KV * (p.Dh >> 5u);
  let totalBlocks = p.S * blocksPerToken;
  let blkIdx = wg.x;
  if (blkIdx >= totalBlocks) { return; }

  let tid = lid.x;
  let s = blkIdx / blocksPerToken;
  let rem = blkIdx % blocksPerToken;
  let srcBase = (s * blocksPerToken + rem) * 32u;
  let dstBlockIdx = ((p.posBase + s) * blocksPerToken) + rem;

  let v = src[srcBase + tid];
  smax[tid] = abs(v);
  workgroupBarrier();
  for (var st = 16u; st > 0u; st = st >> 1u) {
    if (tid < st) { smax[tid] = max(smax[tid], smax[tid + st]); }
    workgroupBarrier();
  }
  let amax = smax[0];
  let scale = amax / 127.0;
  let inv = select(0.0, 127.0 / amax, amax > 0.0);
  let q = clamp(i32(round(v * inv)), -127, 127);
  sq[tid] = u32(q & 0xff);
  workgroupBarrier();

  if (tid < 8u) {
    let b0 = sq[tid * 4u + 0u];
    let b1 = sq[tid * 4u + 1u];
    let b2 = sq[tid * 4u + 2u];
    let b3 = sq[tid * 4u + 3u];
    cacheQ[dstBlockIdx * 8u + tid] = b0 | (b1 << 8u) | (b2 << 16u) | (b3 << 24u);
  }
  if (tid == 0u) {
    cacheS[dstBlockIdx] = scale * 127.0; // unpack4x8snorm maps [-127, 127] to [-1, 1]
  }
}
`,attention_q8:`
struct Params { S: u32, H: u32, KV: u32, Dh: u32, posBase: u32, windowSize: u32, _p1: u32, _p2: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> q: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> Kq: array<u32>;
@group(0) @binding(3) var<storage, read> Ks: array<f32>;
@group(0) @binding(4) var<storage, read> Vq: array<u32>;
@group(0) @binding(5) var<storage, read> Vs: array<f32>;
@group(0) @binding(6) var<storage, read_write> out: array<vec4<f32>>;

var<workgroup> sdot: array<f32, 32>;

@compute @workgroup_size(32)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let idx = wg.x;
  if (idx >= p.S * p.H) { return; }
  let tid = lid.x;
  let h = idx % p.H;
  let qi = idx / p.H;
  let pos = p.posBase + qi;
  let kvh = h / (p.H / p.KV);

  let W4 = p.Dh >> 2u;   // vec4 count per head (e.g. 32 for Dh=128, 64 for Dh=256)
  let B32 = p.Dh >> 5u;  // 32-elem block count per head (e.g. 4 for Dh=128, 8 for Dh=256)
  let qBase = (qi * p.H + h) * W4;
  let scale = inverseSqrt(f32(p.Dh));

  var acc0 = vec4<f32>(0.0);
  var acc1 = vec4<f32>(0.0);
  var m = -1e30;
  var l = 0.0;

  // In PLaMo-3 swa_mask: key_positions > query_positions - window_size => j >= pos + 1 - windowSize
  var jStart = 0u;
  if (p.windowSize > 0u && pos + 1u > p.windowSize) {
    jStart = pos + 1u - p.windowSize;
  }

  for (var j = jStart; j <= pos; j = j + 1u) {
    let kvRow = j * p.KV + kvh;
    let qWordBase = kvRow * W4;
    let sBlockBase = kvRow * B32;

    var part = 0.0;
    if (tid < W4) {
      let kw = unpack4x8snorm(Kq[qWordBase + tid]) * Ks[sBlockBase + (tid >> 3u)];
      part = part + dot(q[qBase + tid], kw);
    }
    if (tid + 32u < W4) {
      let kw2 = unpack4x8snorm(Kq[qWordBase + tid + 32u]) * Ks[sBlockBase + ((tid + 32u) >> 3u)];
      part = part + dot(q[qBase + tid + 32u], kw2);
    }
    sdot[tid] = part;
    workgroupBarrier();
    for (var s = 16u; s > 0u; s = s >> 1u) {
      if (tid < s) { sdot[tid] = sdot[tid] + sdot[tid + s]; }
      workgroupBarrier();
    }

    let score = sdot[0] * scale;
    let mNew = max(m, score);
    let corr = exp(m - mNew);
    let wgt = exp(score - mNew);
    l = l * corr + wgt;

    if (tid < W4) {
      let vw = unpack4x8snorm(Vq[qWordBase + tid]) * Vs[sBlockBase + (tid >> 3u)];
      acc0 = acc0 * corr + wgt * vw;
    }
    if (tid + 32u < W4) {
      let vw2 = unpack4x8snorm(Vq[qWordBase + tid + 32u]) * Vs[sBlockBase + ((tid + 32u) >> 3u)];
      acc1 = acc1 * corr + wgt * vw2;
    }
    m = mNew;
    workgroupBarrier();
  }

  let invL = 1.0 / l;
  if (tid < W4) {
    out[qBase + tid] = acc0 * invL;
  }
  if (tid + 32u < W4) {
    out[qBase + tid + 32u] = acc1 * invL;
  }
}
`,conv1d_causal:`
struct Params { S: u32, C: u32, K: u32, loadState: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> w: array<f32>;
@group(0) @binding(3) var<storage, read> stateIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
@group(0) @binding(5) var<storage, read_write> stateOut: array<f32>;

fn ext(m: u32, c: u32) -> f32 {
  if (m + 1u < p.K) {
    return select(0.0, stateIn[m * p.C + c], p.loadState != 0u);
  }
  return x[(m - (p.K - 1u)) * p.C + c];
}

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(num_workgroups) nwg: vec3<u32>) {
  let i = (wid.y * nwg.x + wid.x) * 64u + lid.x;
  let outN = p.S * p.C;
  if (i < outN) {
    let c = i % p.C;
    let t = i / p.C;
    var acc = 0.0;
    for (var j = 0u; j < p.K; j = j + 1u) {
      acc = acc + w[c * p.K + j] * ext(t + j, c);
    }
    y[i] = acc / (1.0 + exp(-acc));
  } else if (i < outN + (p.K - 1u) * p.C) {
    let si = i - outN;
    let sc = si % p.C;
    let sk = si / p.C;
    stateOut[sk * p.C + sc] = ext(p.S + sk, sc);
  }
}
`,deltanet_gbeta:`
struct Params { S: u32, H: u32, _p0: u32, _p1: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read> aNeg: array<f32>;
@group(0) @binding(4) var<storage, read> dtBias: array<f32>;
@group(0) @binding(5) var<storage, read_write> out: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let i = wg.x * 64u + lid.x;
  let n = p.S * p.H;
  if (i >= n) { return; }
  let h = i % p.H;
  let x = a[i] + dtBias[h];
  let sp = max(x, 0.0) + log(1.0 + exp(-abs(x)));
  out[i] = aNeg[h] * sp;
  out[n + i] = 1.0 / (1.0 + exp(-b[i]));
}
`,deltanet_recur:`
struct Params { S: u32, H: u32, DK: u32, DV: u32, HK: u32, loadState: u32, _p0: u32, _p1: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> qkvConv: array<f32>;
@group(0) @binding(2) var<storage, read> gbeta: array<f32>;
@group(0) @binding(3) var<storage, read> stateIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> core: array<f32>;
@group(0) @binding(5) var<storage, read_write> stateOut: array<f32>;

var<workgroup> ksh: array<f32, 128>;
var<workgroup> qsh: array<f32, 128>;

@compute @workgroup_size(128)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let h = wg.x;
  let hk = h % p.HK;
  let dv = lid.x;
  let DK = p.DK;
  let keyDim = p.HK * DK;
  let valDim = p.H * p.DV;
  let convDim = keyDim * 2u + valDim;
  let sbase = h * DK * p.DV + dv;
  let scale = inverseSqrt(f32(DK));
  let betaOff = p.S * p.H;

  var s: array<f32, 128>;
  for (var dk = 0u; dk < DK; dk = dk + 1u) {
    s[dk] = select(0.0, stateIn[sbase + dk * p.DV], p.loadState != 0u);
  }

  for (var t = 0u; t < p.S; t = t + 1u) {
    let rowConv = t * convDim;
    let qOff = rowConv + hk * DK;
    let kOff = rowConv + keyDim + hk * DK;
    let vOff = rowConv + keyDim * 2u + h * p.DV;
    let gbIdx = t * p.H + h;

    if (dv < DK) {
      qsh[dv] = qkvConv[qOff + dv];
      ksh[dv] = qkvConv[kOff + dv];
    }
    workgroupBarrier();

    var sk = 0.0;
    var sq = 0.0;
    for (var dk = 0u; dk < DK; dk = dk + 1u) {
      sk = sk + ksh[dk] * ksh[dk];
      sq = sq + qsh[dk] * qsh[dk];
    }
    let ik = inverseSqrt(sk + 1e-6);
    let iq = inverseSqrt(sq + 1e-6) * scale;

    if (dv < p.DV) {
      let gt = exp(gbeta[gbIdx]);
      let bt = gbeta[betaOff + gbIdx];
      var kv = 0.0;
      for (var dk = 0u; dk < DK; dk = dk + 1u) {
        s[dk] = s[dk] * gt;
        kv = kv + s[dk] * ksh[dk] * ik;
      }
      let delta = (qkvConv[vOff + dv] - kv) * bt;
      var o = 0.0;
      for (var dk = 0u; dk < DK; dk = dk + 1u) {
        s[dk] = s[dk] + ksh[dk] * ik * delta;
        o = o + s[dk] * qsh[dk] * iq;
      }
      core[(t * p.H + h) * p.DV + dv] = o;
    }
    workgroupBarrier();
  }

  if (dv < p.DV) {
    for (var dk = 0u; dk < DK; dk = dk + 1u) {
      stateOut[sbase + dk * p.DV] = s[dk];
    }
  }
}
`,deltanet_norm_gate:`
struct Params { rows: u32, DV: u32, eps: f32, _pad: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> core: array<f32>;
@group(0) @binding(2) var<storage, read> z: array<f32>;
@group(0) @binding(3) var<storage, read> gamma: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;

var<workgroup> sdata: array<f32, 128>;

@compute @workgroup_size(128)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let row = wg.x;
  if (row >= p.rows) { return; }
  let tid = lid.x;
  let base = row * p.DV;
  var s = 0.0;
  for (var i = tid; i < p.DV; i = i + 128u) {
    let c = core[base + i];
    s = s + c * c;
  }
  sdata[tid] = s;
  workgroupBarrier();
  for (var st = 64u; st > 0u; st = st >> 1u) {
    if (tid < st) { sdata[tid] = sdata[tid] + sdata[tid + st]; }
    workgroupBarrier();
  }
  let inv = inverseSqrt(sdata[0] / f32(p.DV) + p.eps);
  for (var i = tid; i < p.DV; i = i + 128u) {
    let zz = z[base + i];
    y[base + i] = gamma[i] * (core[base + i] * inv) * (zz / (1.0 + exp(-zz)));
  }
}
`,argmax:`
struct Params { vocab: u32, rowOffset: u32, _p0: u32, _p1: u32 };
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> logits: array<f32>;
@group(0) @binding(2) var<storage, read_write> outToken: array<u32>;

var<workgroup> smax: array<f32, 256>;
var<workgroup> sidx: array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let base = p.rowOffset * p.vocab;
  var bestVal = -1e30;
  var bestIdx = 0u;
  for (var i = tid; i < p.vocab; i = i + 256u) {
    let v = logits[base + i];
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  smax[tid] = bestVal;
  sidx[tid] = bestIdx;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      if (smax[tid + s] > smax[tid]) {
        smax[tid] = smax[tid + s];
        sidx[tid] = sidx[tid + s];
      }
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    outToken[0] = sidx[0];
  }
}
`};function Xt(n,t,s,a={}){let r=a.temperature??.6,u=a.topK??20,d=a.topP??.95,g=a.minP??0,f=a.repetitionPenalty??1;if(f!==1&&s.length>0){let S=new Set(s.slice(-128));for(let p of S)if(p>=0&&p<t){let O=n[p];n[p]=O<0?O*f:O/f}}if(r<=0){let S=0,p=n[0];for(let O=1;O<t;O++)n[O]>p&&(p=n[O],S=O);return S}let I=Math.max(1,Math.min(u>0?u:64,t)),k=new Int32Array(I).fill(-1),i=new Float32Array(I).fill(-1/0),_=0,b=-1/0;for(let S=0;S<t;S++){let p=n[S];if(p>b){k[_]=S,i[_]=p,_=0,b=i[0];for(let O=1;O<I;O++)i[O]<b&&(b=i[O],_=O)}}let m=Array.from({length:I},(S,p)=>p).filter(S=>k[S]>=0).sort((S,p)=>i[p]-i[S]);if(m.length===0)return 0;if(m.length===1)return k[m[0]];let P=i[m[0]],A=1/r,H=new Float32Array(m.length),$=0;for(let S=0;S<m.length;S++){let p=Math.exp((i[m[S]]-P)*A);H[S]=p,$+=p}for(let S=0;S<H.length;S++)H[S]/=$;let K=H[0],y=g*K,U=0,Q=H.length;for(let S=0;S<H.length;S++){if(S>0&&H[S]<y){Q=S;break}if(U+=H[S],U>=d){Q=S+1;break}}let E=0;for(let S=0;S<Q;S++)E+=H[S];let F=Math.random()*E;for(let S=0;S<Q;S++)if(F-=H[S],F<=0)return k[m[S]];return k[m[Q-1]]}function hn(){let n=[];for(let u=33;u<=126;u++)n.push(u);for(let u=161;u<=172;u++)n.push(u);for(let u=174;u<=255;u++)n.push(u);let t=[...n],s=0;for(let u=0;u<256;u++)n.includes(u)||(n.push(u),t.push(256+s),s++);let a=new Array(256),r=new Map;for(let u=0;u<256;u++){let d=String.fromCodePoint(t[u]);a[n[u]]=d,r.set(d,n[u])}return{byteToChar:a,charToByte:r}}var{byteToChar:mn,charToByte:gn}=hn(),pn=new RegExp("(?:'[sSdDmMtT]|'[rR][eE]|'[vV][eE]|'[lL][lL])|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+","gu"),Ht=-2e7,bn=-1e7,Vt="\uEE00",wn=60928,qr=1e7,Pt=class{model;tokens;tokenToIdMap;mergeRanks;specialTokens;specialTokenIds;specialRegex;isPlamo3;unigramRoot;byteTokenIds;plamoSpRegex;plamoBoundaryRegex;addBosToken;eosTokenId;eomTokenId;eotTokenId;bosTokenId;padTokenId;constructor(t){this.model=t.model??"gpt2",this.isPlamo3=this.model==="plamo3",this.tokens=t.tokens,this.addBosToken=t.addBosToken,this.eosTokenId=t.eosTokenId,this.eomTokenId=t.eomTokenId,this.eotTokenId=t.eotTokenId,this.bosTokenId=t.bosTokenId,this.padTokenId=t.padTokenId,this.tokenToIdMap=new Map,this.specialTokens=[],this.specialTokenIds=new Set;for(let s=0;s<t.tokens.length;s++){let a=t.tokens[s];this.tokenToIdMap.set(a,s);let r=t.tokenTypes?.[s];this.isPlamo3?(r===2||r===3)&&(this.specialTokens.push(a),this.specialTokenIds.add(s)):(r!==void 0&&r!==1||a.startsWith("<")&&a.endsWith(">")&&a.length>2)&&(a.startsWith("[PAD")||(this.specialTokens.push(a),this.specialTokenIds.add(s)))}if(this.isPlamo3){this.specialRegex=null,this.mergeRanks=new Map;let s={children:new Map,tokenId:-1,score:Ht},a=new Int32Array(256),r=t.scores??[],u=t.tokenTypes??[];for(let I=0;I<t.tokens.length;I++){let k=t.tokens[I];if((u[I]??1)===6&&k.length===6&&k.startsWith("<0x")&&k.endsWith(">")){let m=Number.parseInt(k.slice(3,5),16);!Number.isNaN(m)&&m>=0&&m<256&&(a[m]=I);continue}let _=s;for(let m=0;m<k.length;){let P=k.codePointAt(m);m+=P>65535?2:1;let A=_.children.get(P);A||(A={children:new Map,tokenId:-1,score:Ht},_.children.set(P,A)),_=A}_.tokenId=I;let b=r[I]??0;_.score=Number.isFinite(b)?Math.round(b*1e4):Ht}s.children.set(wn,{children:new Map,tokenId:qr,score:0}),this.unigramRoot=s,this.byteTokenIds=a,this.plamoSpRegex=/(<\|plamo:[^|\s]{0,64}\|>)/g;let d=t.breakAroundConsecutiveSpacesThreshold??2,g=t.breakAroundRepeatedCharsThreshold??4,f=[];g>1&&f.push(`(.)\\2{${g-1},}`),d>1&&f.push(` {${d},}`),this.plamoBoundaryRegex=f.length>0?new RegExp(`(${f.join("|")})`,"gu"):null}else{if(this.unigramRoot=null,this.byteTokenIds=null,this.plamoSpRegex=null,this.plamoBoundaryRegex=null,this.specialTokens.sort((s,a)=>a.length-s.length),this.specialTokens.length>0){let s=this.specialTokens.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));this.specialRegex=new RegExp(`(${s.join("|")})`,"g")}else this.specialRegex=null;this.mergeRanks=new Map;for(let s=0;s<t.merges.length;s++)this.mergeRanks.set(t.merges[s],s)}}getTokenId(t){return this.tokenToIdMap.get(t)}bpe(t){let s=this.tokenToIdMap.get(t);if(s!==void 0&&t.length<=1)return[s];let a=Array.from(t);for(;a.length>1;){let u=1/0,d=-1;for(let i=0;i<a.length-1;i++){let _=`${a[i]} ${a[i+1]}`,b=this.mergeRanks.get(_);b!==void 0&&b<u&&(u=b,d=i)}if(d===-1)break;let g=a[d],f=a[d+1],I=[],k=0;for(;k<a.length;)k<a.length-1&&a[k]===g&&a[k+1]===f?(I.push(g+f),k+=2):(I.push(a[k]),k++);a=I}let r=[];for(let u of a){let d=this.tokenToIdMap.get(u);d!==void 0&&r.push(d)}return r}encodePlainSegment(t){if(!t)return[];let s=new TextEncoder,a=[],r=t.match(pn)??[t];for(let u of r){let d=s.encode(u),g="";for(let f=0;f<d.length;f++)g+=mn[d[f]];a.push(...this.bpe(g))}return a}encodePlamo3(t){if(!t||!this.unigramRoot||!this.byteTokenIds)return[];let s=t;this.plamoSpRegex&&(s=s.replace(this.plamoSpRegex,`${Vt}$1${Vt}`)),this.plamoBoundaryRegex&&(s=s.replace(this.plamoBoundaryRegex,`${Vt}$1${Vt}`));let a=[];for(let m=0;m<s.length;){let P=s.codePointAt(m);a.push(P),m+=P>65535?2:1}let r=a.length,u=new Float64Array(r+1);u.fill(1e18),u[r]=0;let d=new Int32Array(r+1),g=new Int32Array(r+1);g.fill(-1);let f=[],I=[],k=[];for(let m=r-1;m>=0;m--){f.length=0,I.length=0,k.length=0;let P=this.unigramRoot,A=m;for(;A<r&&(P=P.children.get(a[A]),!!P);)A++,P.score>Ht&&(f.push(A-m),I.push(P.tokenId),k.push(P.score));let H=1e18,$=1,K=-1;for(let U=f.length-1;U>=0;U--){let Q=f[U],E=u[m+Q]-k[U];E<H&&(H=E,$=Q,K=I[U])}let y=u[m+1]-bn;y<H&&(H=y,$=1,K=-1),u[m]=H,d[m]=$,g[m]=K}let i=new TextEncoder,_=[],b=0;for(;b<r;){let m=g[b];if(m>=0)m!==qr&&_.push(m);else{let P=i.encode(String.fromCodePoint(a[b]));for(let A=0;A<P.length;A++)_.push(this.byteTokenIds[P[A]])}b+=d[b]}return _}encode(t){if(!t)return[];if(this.isPlamo3)return this.encodePlamo3(t);if(!this.specialRegex)return this.encodePlainSegment(t);let s=[],a=0;this.specialRegex.lastIndex=0;let r;for(;(r=this.specialRegex.exec(t))!==null;){r.index>a&&s.push(...this.encodePlainSegment(t.slice(a,r.index)));let u=this.tokenToIdMap.get(r[0]);u!==void 0?s.push(u):s.push(...this.encodePlainSegment(r[0])),a=this.specialRegex.lastIndex}return a<t.length&&s.push(...this.encodePlainSegment(t.slice(a))),s}decode(t,s=!0){let a=[],r=new TextEncoder;for(let u of t){if(s&&this.specialTokenIds.has(u))continue;let d=this.tokens[u];if(d!==void 0)if(this.isPlamo3){if(d.length===6&&d.startsWith("<0x")&&d.endsWith(">")){let f=Number.parseInt(d.slice(3,5),16);if(!Number.isNaN(f)){a.push(f);continue}}let g=r.encode(d);for(let f=0;f<g.length;f++)a.push(g[f])}else if(this.specialTokenIds.has(u)){let g=r.encode(d);for(let f of g)a.push(f)}else for(let g of d){let f=gn.get(g);if(f!==void 0)a.push(f);else{let I=r.encode(g);for(let k of I)a.push(k)}}}return new TextDecoder("utf-8",{fatal:!1}).decode(new Uint8Array(a))}createDecoderStream(t=!0){let s=[],a=0;return{push:r=>{s.push(r);let u=this.decode(s,t),d=u.length;for(;d>a&&u.charCodeAt(d-1)===65533;)d--;let g=u.slice(a,d);return a=d,g},flush:()=>{if(s.length===0)return"";let r=this.decode(s,t),u=r.slice(a);return a=r.length,u}}}tokenToId(t){return this.tokenToIdMap.get(t)}formatChat(t,s={}){if(this.isPlamo3){let d=s.targetLang??"ja",f=`${this.bosTokenId!==void 0?this.tokens[this.bosTokenId]??"<|plamo:bos|>":"<|plamo:bos|>"}<|plamo:tag|>dataset<|plamo:msg|>translation`,I=t.filter(_=>_.role!=="system"),k=t.find(_=>_.role==="system");k?.content?.trim()&&(f+=`<|plamo:tag|>context<|plamo:msg|>${k.content.trim()}`);for(let _=0;_<I.length-1;_++){let b=I[_];b.role==="user"?(f+="<|plamo:tag|>input",s.sourceLang&&(f+=`<|plamo:key|>lang<|plamo:val|>${s.sourceLang}`),f+=`<|plamo:msg|>${b.content}`):f+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${d}<|plamo:msg|>${b.content}`}let i=I[I.length-1];return i&&(f+="<|plamo:tag|>input",s.sourceLang&&(f+=`<|plamo:key|>lang<|plamo:val|>${s.sourceLang}`),f+=`<|plamo:msg|>${i.content}<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${d}<|plamo:msg|>`),f}let a=s.addGenerationPrompt??!0,r=s.enableThinking??!1,u="";for(let d of t)d.role==="assistant"&&!r&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")&&!d.content.startsWith("<think>")?u+=`<|im_start|>assistant
<think>

</think>

${d.content}<|im_end|>
`:u+=`<|im_start|>${d.role}
${d.content}<|im_end|>
`;return a&&(u+=`<|im_start|>assistant
`,!r&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")?u+=`<think>

</think>

`:r&&this.tokenToIdMap.has("<think>")&&(u+=`<think>
`)),u}};function Xe(n){let t=[],s=n>>>0;do{let a=s&127;s>>>=7,s!==0&&(a|=128),t.push(a)}while(s!==0);return t}function Pn(n){let t=[],s=n|0,a=!0;for(;a;){let r=s&127;s>>=7,s===0&&(r&64)===0||s===-1&&(r&64)!==0?a=!1:r|=128,t.push(r)}return t}function On(n){let t=new ArrayBuffer(4);return new DataView(t).setFloat32(0,n,!0),Array.from(new Uint8Array(t))}function Ue(n){let t=new ArrayBuffer(16),s=new DataView(t);for(let a=0;a<8;a++)s.setInt16(a*2,n,!0);return[253,...Xe(12),...new Uint8Array(t)]}function w(n,...t){return[253,...Xe(n),...t]}function ne(n,t,s=0){return[253,...Xe(n),...Xe(t),...Xe(s)]}function me(n,t,s=0){return[n,...Xe(t),...Xe(s)]}function l(n){return[65,...Pn(n)]}function Ie(n){return[67,...On(n)]}function e(n){return[32,...Xe(n)]}function o(n){return[33,...Xe(n)]}function fe(n){return[34,...Xe(n)]}function Ae(n){return[...e(n),...w(27,0),...e(n),...w(27,1),106,...e(n),...w(27,2),106,...e(n),...w(27,3),106]}function yn(n){return[...e(n),...w(31,0),...e(n),...w(31,1),146,...e(n),...w(31,2),146,...e(n),...w(31,3),146]}function Ce(n,t=0){return[...n,...me(47,1,t),...l(2),116,...me(42,2,0)]}function ke(n,t,s,a,r,u,d){return[...e(n),...e(r),108,...e(a),106,...e(t),106,...l(2),116,...l(1048576),106,...fe(d),...e(s),4,125,...e(d),...me(42,2,0),...e(u),146,5,...e(u),11,...me(56,2,0)]}function xn(){let f=[...l(0),...o(7),2,64,3,64,...e(7),...e(0),79,13,1,...l(0),...o(8),2,64,3,64,...e(8),...e(1),79,13,1,...Ie(0),...w(19),...o(14),...e(7),...e(2),108,...l(2),116,...l(266240),106,...o(10),...e(3),...e(8),...e(2),108,...l(2),116,106,...o(11),...l(0),...o(9),2,64,3,64,...e(9),...e(2),79,13,1,...e(14),...e(10),...ne(0,2,0),...e(11),...ne(0,2,0),...w(230),...w(228),...o(14),...e(10),...l(16),106,...o(10),...e(11),...l(16),106,...o(11),...e(9),...l(4),106,...o(9),12,0,11,11,...yn(14),...o(13),...ke(7,8,4,5,6,13,12),...e(8),...l(1),106,...o(8),12,0,11,11,...e(7),...l(1),106,...o(7),12,0,11,11,11];return tt([[6,127],[1,125],[1,123]],f)}function In(){let p=(v,h)=>[...e(h),...e(v),...e(12),106,...me(45,0,0),...l(3),116,...ne(1,3,262144),...e(34),...w(186),...w(174),...o(h)],O=[...e(3),...l(4),116,...o(22),...e(3),...l(1),116,...o(23),...l(0),...o(9),2,64,3,64,...e(9),...e(0),79,13,1,...l(0),...o(10),2,64,3,64,...e(10),...l(3),106,...e(1),79,13,1,...Ie(0),...o(25),...Ie(0),...o(26),...Ie(0),...o(27),...Ie(0),...o(28),...e(4),...e(10),...e(22),108,106,...fe(14),...e(22),106,...fe(15),...e(22),106,...fe(16),...e(22),106,...o(17),...e(5),...e(10),...e(23),108,106,...fe(18),...e(23),106,...fe(19),...e(23),106,...fe(20),...e(23),106,...o(21),...l(0),...o(11),2,64,3,64,...e(11),...e(3),79,13,1,...l(0),...w(17),...fe(30),...fe(31),...fe(32),...o(33),...e(9),...e(3),108,...e(11),106,...l(8),116,...l(528384),106,...o(13),...l(0),...o(12),2,64,3,64,...e(12),...l(16),79,13,1,...e(13),...e(12),...l(4),116,106,...ne(0,4,0),...o(34),...p(14,30),...p(15,31),...p(16,32),...p(17,33),...e(12),...l(1),106,...o(12),12,0,11,11,...e(9),...e(3),108,...e(11),106,...l(2),116,...me(42,2,790528),...o(29),...e(25),...Ae(30),178,...Ce(e(18),0),148,...e(29),148,146,...o(25),...e(26),...Ae(31),178,...Ce(e(19),0),148,...e(29),148,146,...o(26),...e(27),...Ae(32),178,...Ce(e(20),0),148,...e(29),148,146,...o(27),...e(28),...Ae(33),178,...Ce(e(21),0),148,...e(29),148,146,...o(28),...e(14),...l(16),106,...o(14),...e(15),...l(16),106,...o(15),...e(16),...l(16),106,...o(16),...e(17),...l(16),106,...o(17),...e(18),...l(2),106,...o(18),...e(19),...l(2),106,...o(19),...e(20),...l(2),106,...o(20),...e(21),...l(2),106,...o(21),...e(11),...l(1),106,...o(11),12,0,11,11,...ke(9,10,6,7,8,25,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,26,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,27,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,28,24),...e(10),...l(1),106,...o(10),12,0,11,11,2,64,3,64,...e(10),...e(1),79,13,1,...Ie(0),...o(25),...e(4),...e(10),...e(22),108,106,...o(14),...e(5),...e(10),...e(23),108,106,...o(18),...l(0),...o(11),2,64,3,64,...e(11),...e(3),79,13,1,...l(0),...w(17),...o(30),...e(9),...e(3),108,...e(11),106,...l(8),116,...l(528384),106,...o(13),...l(0),...o(12),2,64,3,64,...e(12),...l(16),79,13,1,...e(13),...e(12),...l(4),116,106,...ne(0,4,0),...o(34),...p(14,30),...e(12),...l(1),106,...o(12),12,0,11,11,...e(9),...e(3),108,...e(11),106,...l(2),116,...me(42,2,790528),...o(29),...e(25),...Ae(30),178,...Ce(e(18),0),148,...e(29),148,146,...o(25),...e(14),...l(16),106,...o(14),...e(18),...l(2),106,...o(18),...e(11),...l(1),106,...o(11),12,0,11,11,...ke(9,10,6,7,8,25,24),...e(10),...l(1),106,...o(10),12,0,11,11,...e(9),...l(1),106,...o(9),12,0,11,11,11];return tt([[16,127],[5,125],[5,123]],O)}function kn(){let R=(ie,Y)=>[...e(ie),...e(12),...l(3),116,106,...ne(2,3,0),...o(38),...e(Y),...e(38),...e(39),...w(78),...e(40),...w(145),...e(34),...w(186),...e(38),...l(2),...w(141),...e(39),...w(78),...e(40),...w(145),...e(35),...w(186),...w(174),...e(38),...l(4),...w(141),...e(39),...w(78),...e(40),...w(145),...e(36),...w(186),...e(38),...l(6),...w(141),...e(40),...w(145),...e(37),...w(186),...w(174),...w(174),...w(174),...o(Y)],j=[...Ue(3),...o(39),...Ue(1),...o(40),...e(3),...l(5),116,...o(22),...e(3),...l(1),116,...o(23),...l(0),...o(9),2,64,3,64,...e(9),...e(0),79,13,1,...l(0),...o(10),2,64,3,64,...e(10),...l(3),106,...e(1),79,13,1,...Ie(0),...o(25),...Ie(0),...o(26),...Ie(0),...o(27),...Ie(0),...o(28),...e(4),...e(10),...e(22),108,106,...fe(14),...e(22),106,...fe(15),...e(22),106,...fe(16),...e(22),106,...o(17),...e(5),...e(10),...e(23),108,106,...fe(18),...e(23),106,...fe(19),...e(23),106,...fe(20),...e(23),106,...o(21),...l(0),...o(11),2,64,3,64,...e(11),...e(3),79,13,1,...l(0),...w(17),...fe(30),...fe(31),...fe(32),...o(33),...l(0),...o(12),2,64,3,64,...e(12),...l(4),79,13,1,...e(9),...e(3),108,...e(11),106,...l(8),116,...e(12),...l(6),116,106,...l(659456),106,...fe(13),...ne(0,4,0),...o(34),...e(13),...ne(0,4,16),...o(35),...e(13),...ne(0,4,32),...o(36),...e(13),...ne(0,4,48),...o(37),...R(14,30),...R(15,31),...R(16,32),...R(17,33),...e(12),...l(1),106,...o(12),12,0,11,11,...e(9),...e(3),108,...e(11),106,...l(2),116,...me(42,2,790528),...o(29),...e(25),...Ae(30),178,...Ce(e(18),0),148,...e(29),148,146,...o(25),...e(26),...Ae(31),178,...Ce(e(19),0),148,...e(29),148,146,...o(26),...e(27),...Ae(32),178,...Ce(e(20),0),148,...e(29),148,146,...o(27),...e(28),...Ae(33),178,...Ce(e(21),0),148,...e(29),148,146,...o(28),...e(14),...l(32),106,...o(14),...e(15),...l(32),106,...o(15),...e(16),...l(32),106,...o(16),...e(17),...l(32),106,...o(17),...e(18),...l(2),106,...o(18),...e(19),...l(2),106,...o(19),...e(20),...l(2),106,...o(20),...e(21),...l(2),106,...o(21),...e(11),...l(1),106,...o(11),12,0,11,11,...ke(9,10,6,7,8,25,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,26,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,27,24),...e(10),...l(1),106,...o(10),...ke(9,10,6,7,8,28,24),...e(10),...l(1),106,...o(10),12,0,11,11,2,64,3,64,...e(10),...e(1),79,13,1,...Ie(0),...o(25),...e(4),...e(10),...e(22),108,106,...o(14),...e(5),...e(10),...e(23),108,106,...o(18),...l(0),...o(11),2,64,3,64,...e(11),...e(3),79,13,1,...l(0),...w(17),...o(30),...l(0),...o(12),2,64,3,64,...e(12),...l(4),79,13,1,...e(9),...e(3),108,...e(11),106,...l(8),116,...e(12),...l(6),116,106,...l(659456),106,...fe(13),...ne(0,4,0),...o(34),...e(13),...ne(0,4,16),...o(35),...e(13),...ne(0,4,32),...o(36),...e(13),...ne(0,4,48),...o(37),...R(14,30),...e(12),...l(1),106,...o(12),12,0,11,11,...e(9),...e(3),108,...e(11),106,...l(2),116,...me(42,2,790528),...o(29),...e(25),...Ae(30),178,...Ce(e(18),0),148,...e(29),148,146,...o(25),...e(14),...l(32),106,...o(14),...e(18),...l(2),106,...o(18),...e(11),...l(1),106,...o(11),12,0,11,11,...ke(9,10,6,7,8,25,24),...e(10),...l(1),106,...o(10),12,0,11,11,...e(9),...l(1),106,...o(9),12,0,11,11,11];return tt([[16,127],[5,125],[11,123]],j)}function Dn(){let E=(O,v)=>[...v===null?e(O):[...e(O),...e(v),...w(149),...e(24),...w(78)],...e(25),...w(149),...l(8),...w(141),...e(26),...w(145)],F=[null,27,28,29,30],S=[];for(let O=0;O<5;O++){let v=F[O];S.push(...e(20),...E(21,v),...e(12),...ne(0,4,O*32),...w(186),...w(174),...o(20)),S.push(...e(20),...E(22,v),...e(12),...ne(0,4,O*32+16),...w(186),...w(174),...o(20)),S.push(...e(20),...E(23,v),...e(12),...ne(0,4,160+O*16),...w(186),...w(174),...o(20))}let p=[...Ue(255),...o(24),...Ue(3),...fe(25),...o(27),...Ue(1),...o(26),...Ue(9),...o(28),...Ue(27),...o(29),...Ue(81),...o(30),...l(264192),...ne(0,4,0),...o(31),...e(3),...l(26),108,...o(15),...e(3),...l(1),116,...o(16),...l(0),...o(9),2,64,3,64,...e(9),...e(0),79,13,1,...l(0),...o(10),2,64,3,64,...e(10),...e(1),79,13,1,...Ie(0),...o(18),...e(4),...e(10),...e(15),108,106,...o(13),...e(5),...e(10),...e(16),108,106,...o(14),...l(0),...o(11),2,64,3,64,...e(11),...e(3),79,13,1,...l(0),...w(17),...o(20),...e(9),...e(3),108,...e(11),106,...l(8),116,...l(528384),106,...o(12),...e(13),...ne(2,0,0),...o(21),...e(13),...ne(2,0,8),...o(22),...e(13),...ne(2,0,16),...o(23),...S,...e(20),...e(13),...me(47,0,24),...w(16),...w(136),...e(31),...w(149),...e(24),...w(78),...e(25),...w(149),...l(8),...w(141),...e(26),...w(145),...e(12),...ne(0,4,240),...w(186),...w(174),...o(20),...e(9),...e(3),108,...e(11),106,...l(2),116,...me(42,2,790528),...o(19),...e(18),...Ae(20),178,...Ce(e(14),0),148,...e(19),148,146,...o(18),...e(13),...l(26),106,...o(13),...e(14),...l(2),106,...o(14),...e(11),...l(1),106,...o(11),12,0,11,11,...ke(9,10,6,7,8,18,17),...e(10),...l(1),106,...o(10),12,0,11,11,...e(9),...l(1),106,...o(9),12,0,11,11,11];return tt([[9,127],[2,125],[12,123]],p)}function Sn(){let F=(p,O)=>[...e(p),...ne(2,0,2),...o(28),...e(p),...ne(2,0,10),...o(29),...e(28),...e(30),...w(78),...e(31),...w(145),...e(24),...w(186),...e(29),...e(30),...w(78),...e(31),...w(145),...e(25),...w(186),...w(174),...e(28),...l(4),...w(141),...e(31),...w(145),...e(26),...w(186),...e(29),...l(4),...w(141),...e(31),...w(145),...e(27),...w(186),...w(174),...w(174),...o(23),...e(O),...Ae(23),178,...Ce(e(p),0),148,...e(22),148,146,...o(O)],S=[...Ue(15),...o(30),...Ue(8),...o(31),...e(3),...l(18),108,...o(16),...l(0),...o(8),2,64,3,64,...e(8),...e(0),79,13,1,...l(0),...o(9),2,64,3,64,...e(9),...l(3),106,...e(1),79,13,1,...Ie(0),...o(18),...Ie(0),...o(19),...Ie(0),...o(20),...Ie(0),...o(21),...e(4),...e(9),...e(16),108,106,...fe(12),...e(16),106,...fe(13),...e(16),106,...fe(14),...e(16),106,...o(15),...l(0),...o(10),2,64,3,64,...e(10),...e(3),79,13,1,...e(8),...e(3),108,...e(10),106,...l(6),116,...l(528384),106,...fe(11),...ne(0,4,0),...o(24),...e(11),...ne(0,4,16),...o(25),...e(11),...ne(0,4,32),...o(26),...e(11),...ne(0,4,48),...o(27),...e(8),...e(3),108,...e(10),106,...l(2),116,...me(42,2,790528),...o(22),...F(12,18),...F(13,19),...F(14,20),...F(15,21),...e(12),...l(18),106,...o(12),...e(13),...l(18),106,...o(13),...e(14),...l(18),106,...o(14),...e(15),...l(18),106,...o(15),...e(10),...l(1),106,...o(10),12,0,11,11,...ke(8,9,5,6,7,18,17),...e(9),...l(1),106,...o(9),...ke(8,9,5,6,7,19,17),...e(9),...l(1),106,...o(9),...ke(8,9,5,6,7,20,17),...e(9),...l(1),106,...o(9),...ke(8,9,5,6,7,21,17),...e(9),...l(1),106,...o(9),12,0,11,11,2,64,3,64,...e(9),...e(1),79,13,1,...Ie(0),...o(18),...e(4),...e(9),...e(16),108,106,...o(12),...l(0),...o(10),2,64,3,64,...e(10),...e(3),79,13,1,...e(8),...e(3),108,...e(10),106,...l(6),116,...l(528384),106,...fe(11),...ne(0,4,0),...o(24),...e(11),...ne(0,4,16),...o(25),...e(11),...ne(0,4,32),...o(26),...e(11),...ne(0,4,48),...o(27),...e(8),...e(3),108,...e(10),106,...l(2),116,...me(42,2,790528),...o(22),...F(12,18),...e(12),...l(18),106,...o(12),...e(10),...l(1),106,...o(10),12,0,11,11,...ke(8,9,5,6,7,18,17),...e(9),...l(1),106,...o(9),12,0,11,11,...e(8),...l(1),106,...o(8),12,0,11,11,11];return tt([[10,127],[5,125],[9,123]],S)}function Bn(){let K=[...Ue(15),...o(26),...e(3),...l(20),108,...o(13),...l(0),...o(8),2,64,3,64,...e(8),...e(0),79,13,1,...l(0),...o(9),2,64,3,64,...e(9),...e(1),79,13,1,...Ie(0),...o(16),...e(4),...e(9),...e(13),108,106,...o(12),...l(0),...o(10),2,64,3,64,...e(10),...e(3),79,13,1,...e(8),...e(3),108,...e(10),106,...fe(15),...l(6),116,...l(528384),106,...fe(11),...ne(0,4,0),...o(20),...e(11),...ne(0,4,16),...o(21),...e(11),...ne(0,4,32),...o(22),...e(11),...ne(0,4,48),...o(23),...e(15),...l(2),116,...fe(15),...me(42,2,790528),...o(17),...e(15),...me(42,2,806912),...o(18),...e(12),...ne(2,0,4),...o(24),...e(12),...ne(2,0,12),...o(25),...e(24),...e(26),...w(78),...e(20),...w(186),...e(25),...e(26),...w(78),...e(21),...w(186),...w(174),...e(24),...l(4),...w(141),...e(22),...w(186),...e(25),...l(4),...w(141),...e(23),...w(186),...w(174),...w(174),...o(19),...e(16),...Ae(19),178,...Ce(e(12),0),148,...e(17),148,...Ce(e(12),2),...e(18),148,146,146,...o(16),...e(12),...l(20),106,...o(12),...e(10),...l(1),106,...o(10),12,0,11,11,...ke(8,9,5,6,7,16,14),...e(9),...l(1),106,...o(9),12,0,11,11,...e(8),...l(1),106,...o(8),12,0,11,11,11];return tt([[8,127],[3,125],[8,123]],K)}function vn(){let S=(O,v,h)=>[...O,...l(4),73,4,64,...e(15),...O,106,...me(45,0,4),...l(63),113,...o(v),...e(15),...O,106,...me(45,0,8),...l(63),113,...o(h),5,...e(15),...O,106,...me(45,0,8),...l(15),113,...e(15),...O,106,...me(45,0,0),...l(6),118,...l(4),116,114,...o(v),...e(15),...O,106,...me(45,0,8),...l(4),118,...e(15),...O,106,...me(45,0,4),...l(6),118,...l(4),116,114,...o(h),11],p=[...Ue(15),...o(32),...e(3),...l(144),108,...o(17),...l(0),...o(8),2,64,3,64,...e(8),...e(0),79,13,1,...l(0),...o(9),2,64,3,64,...e(9),...e(1),79,13,1,...Ie(0),...o(23),...e(4),...e(9),...e(17),108,106,...o(15),...l(0),...o(10),2,64,3,64,...e(10),...e(3),79,13,1,...Ce(e(15),0),...o(24),...Ce(e(15),2),...o(25),...l(0),...o(11),2,64,3,64,...e(11),...l(4),79,13,1,...e(11),...l(1),116,...o(12),...S(e(12),19,20),...S([...e(12),...l(1),106],21,22),...e(15),...e(11),...l(5),116,106,...fe(16),...ne(2,0,16),...o(28),...e(16),...ne(2,0,24),...o(29),...e(16),...ne(2,0,32),...o(30),...e(16),...ne(2,0,40),...o(31),...e(8),...e(3),108,...e(10),106,...l(3),116,...e(12),106,...fe(13),...l(6),116,...l(528384),106,...o(14),...e(28),...e(32),...w(78),...e(14),...ne(0,4,0),...w(186),...e(29),...e(32),...w(78),...e(14),...ne(0,4,16),...w(186),...w(174),...e(30),...e(32),...w(78),...e(14),...ne(0,4,32),...w(186),...e(31),...e(32),...w(78),...e(14),...ne(0,4,48),...w(186),...w(174),...w(174),...o(26),...e(28),...l(4),...w(141),...e(14),...ne(0,4,64),...w(186),...e(29),...l(4),...w(141),...e(14),...ne(0,4,80),...w(186),...w(174),...e(30),...l(4),...w(141),...e(14),...ne(0,4,96),...w(186),...e(31),...l(4),...w(141),...e(14),...ne(0,4,112),...w(186),...w(174),...w(174),...o(27),...e(13),...l(2),116,...o(13),...e(23),...e(24),...e(19),178,148,...e(13),...me(42,2,790528),148,...Ae(26),178,148,...e(25),...e(20),178,148,...e(13),...me(42,2,806912),148,147,146,...e(24),...e(21),178,148,...e(13),...me(42,2,790532),148,...Ae(27),178,148,...e(25),...e(22),178,148,...e(13),...me(42,2,806916),148,147,146,...o(23),...e(11),...l(1),106,...o(11),12,0,11,11,...e(15),...l(144),106,...o(15),...e(10),...l(1),106,...o(10),12,0,11,11,...ke(8,9,5,6,7,23,18),...e(9),...l(1),106,...o(9),12,0,11,11,...e(8),...l(1),106,...o(8),12,0,11,11,11];return tt([[15,127],[3,125],[7,123]],p)}function Mn(){let h=T=>[...e(13),...ne(2,0,T),...o(27),...e(13),...ne(2,0,32+T),...o(28),...e(14),...ne(2,0,T),...o(29),...e(23),...e(27),...e(30),...w(78),...e(29),...l(4),...w(139),...e(31),...w(78),...w(142),...e(32),...w(145),...e(33),...w(149),...e(17),...ne(0,4,T*2),...w(186),...w(174),...o(23),...e(24),...e(28),...e(30),...w(78),...e(29),...l(2),...w(139),...e(31),...w(78),...w(142),...e(32),...w(145),...e(34),...w(149),...e(17),...ne(0,4,64+T*2),...w(186),...w(174),...o(24),...e(25),...e(27),...l(4),...w(141),...e(29),...e(31),...w(78),...w(142),...e(32),...w(145),...e(35),...w(149),...e(17),...ne(0,4,128+T*2),...w(186),...w(174),...o(25),...e(26),...e(28),...l(4),...w(141),...e(29),...l(2),...w(141),...e(31),...w(78),...w(142),...e(32),...w(145),...e(36),...w(149),...e(17),...ne(0,4,192+T*2),...w(186),...w(174),...o(26)],B=[...Ue(15),...o(30),...Ue(48),...o(31),...Ue(32),...o(32),...e(3),...l(210),108,...o(19),...l(0),...o(8),2,64,3,64,...e(8),...e(0),79,13,1,...l(0),...o(9),2,64,3,64,...e(9),...e(1),79,13,1,...Ie(0),...o(21),...e(4),...e(9),...e(19),108,106,...o(18),...l(0),...o(10),2,64,3,64,...e(10),...e(3),79,13,1,...Ce(e(18),208),...o(22),...l(0),...o(11),2,64,3,64,...e(11),...l(2),79,13,1,...l(0),...w(17),...fe(23),...fe(24),...fe(25),...o(26),...e(8),...e(3),108,...e(10),106,...l(3),116,...e(11),...l(2),116,106,...o(16),...e(18),...e(11),...l(6),116,106,...o(13),...e(18),...l(128),106,...e(11),...l(5),116,106,...o(14),...e(18),...l(192),106,...e(11),...l(3),116,106,...o(15),...l(0),...o(12),2,64,3,64,...e(12),...l(2),79,13,1,...e(15),...e(12),106,...me(44,0,0),...w(16),...o(33),...e(15),...e(12),106,...me(44,0,2),...w(16),...o(34),...e(15),...e(12),106,...me(44,0,4),...w(16),...o(35),...e(15),...e(12),106,...me(44,0,6),...w(16),...o(36),...e(16),...l(6),116,...e(12),...l(5),116,106,...l(528384),106,...o(17),...h(0),...h(8),...e(13),...l(16),106,...o(13),...e(14),...l(16),106,...o(14),...e(12),...l(1),106,...o(12),12,0,11,11,...e(16),...l(2),116,...o(16),...e(21),...e(22),...Ae(23),178,...e(16),...me(42,2,790528),148,...Ae(24),178,...e(16),...me(42,2,790532),148,146,...Ae(25),178,...e(16),...me(42,2,790536),148,...Ae(26),178,...e(16),...me(42,2,790540),148,146,146,148,146,...o(21),...e(11),...l(1),106,...o(11),12,0,11,11,...e(18),...l(210),106,...o(18),...e(10),...l(1),106,...o(10),12,0,11,11,...ke(8,9,5,6,7,21,20),...e(9),...l(1),106,...o(9),12,0,11,11,...e(8),...l(1),106,...o(8),12,0,11,11,11];return tt([[13,127],[2,125],[14,123]],B)}function tt(n,t){let s=[...Xe(n.length)];for(let[r,u]of n)s.push(...Xe(r),u);let a=[...s,...t];return[...Xe(a.length),...a]}function Ot(n,t){return[n,...Xe(t.length),...t]}function cr(n){let t=Array.from(new TextEncoder().encode(n));return[...Xe(t.length),...t]}var $t=null;function lr(){if($t)return $t;let n=Ot(1,[3,96,7,127,127,127,127,127,127,127,0,96,9,127,127,127,127,127,127,127,127,127,0,96,8,127,127,127,127,127,127,127,127,0]),t=Ot(2,[1,...cr("env"),...cr("memory"),2,0,1]),s=Ot(3,[8,0,1,1,1,2,2,2,2]),a=["gemv_f32","gemv_q1_0","gemv_pq2_0","gemv_ptq1_0","gemv_q4_0","gemv_q4_1","gemv_q4_k","gemv_q6_k"],r=[a.length];for(let I=0;I<a.length;I++)r.push(...cr(a[I]),0,I);let u=Ot(7,r),d=[xn(),In(),kn(),Dn(),Sn(),Bn(),vn(),Mn()],g=[d.length];for(let I of d)g.push(...I);let f=Ot(10,g);return $t=new Uint8Array([0,97,115,109,1,0,0,0,...n,...t,...s,...u,...f]),$t}function Wt(n){let _=n.arch,b=n.maxSeqLen,m=n.fp16Table,P=n.cos,A=n.sin,H=n.swaCos,$=n.swaSin,K=new Map(n.hadamardSigns),y=0,U=0;for(let x of n.tensors){let M=0;if(x.type===0||x.type===1)M=x.N*x.K*4+15&-16;else if(x.type===41||x.type===142||x.type===143){let q=x.type===41?16:x.type===142?32:26,re=x.N*x.nb*q+15&-16,D=x.N*x.nb*2+15&-16;M=re+D}else M=x.byteLength+15&-16;y+=M,M>U&&(U=M)}let Q=!0,E;try{let x=Math.ceil((5242880+y+65536)/65536);E=new WebAssembly.Memory({initial:x})}catch{Q=!1;let x=Math.ceil((5242880+U+65536)/65536);E=new WebAssembly.Memory({initial:x})}let F=new WebAssembly.Module(n.wasmBytes),p=new WebAssembly.Instance(F,{env:{memory:E}}).exports,O=E.buffer;new Float32Array(O,0,65536).set(m);let v=new Int8Array(O,262144,2048);for(let x=0;x<256;x++)for(let M=0;M<8;M++)v[x*8+M]=x>>M&1?1:-1;new Int16Array(O,264192,8).set([1,1,3,3,9,9,27,27]);let h=new Float32Array(O,266240,65536),B=new Int16Array(O,528384,65536),T=new Int16Array(O,659456,65536),R=new Float32Array(O,790528,4096),j=new Float32Array(O,806912,4096),ie=new Float32Array(O,1048576,1048576),Y=new Map,he=5242880;for(let x of n.tensors){let M=0,q=0,re=0,D=x.type;if(x.type===0||x.type===1)D=0,M=x.K*4,q=x.N*M+15&-16;else if(x.type===41||x.type===142||x.type===143){let X=x.type===41?16:x.type===142?32:26;M=x.nb*X,q=x.N*M+15&-16,re=x.N*x.nb*2+15&-16}else M=x.byteLength/x.N,q=x.byteLength+15&-16;let se=5242880,c=5242880+q,N,J,W;Q?(se=he,he+=q,c=he,he+=re,N=new Uint8Array(O,se,x.N*M),J=new Uint8Array(O,c,re>0?x.N*x.nb*2:0),D===0&&(W=new Float32Array(O,se,x.N*x.K))):(N=new Uint8Array(x.N*M),J=new Uint8Array(re>0?x.N*x.nb*2:0),D===0&&(W=new Float32Array(N.buffer,N.byteOffset,x.N*x.K)));let L=x.type===41?18:x.type===142?34:x.type===143?28:0;Y.set(x.name,{type:D,N:x.N,K:x.K,nb:x.nb,rowBytes:M,hadamardFolded:x.hadamardFolded,quantsPtr:se,scalesPtr:c,quantsView:N,scalesView:J,f32View:W,rawF16:x.type===1?new Uint8Array(x.byteLength):void 0,writeCursor:0,leftover:new Uint8Array(L),leftoverLen:0,blockCursor:0})}function Oe(x,M){let q=Y.get(x);if(!q)throw new Error(`hachiue: unknown tensor ${x}`);if(q.rawF16){q.rawF16.set(M,q.writeCursor),q.writeCursor+=M.byteLength;return}if(q.type===41||q.type===142||q.type===143){let re=q.type===41?18:q.type===142?34:28,D=re-2,se=q.quantsView,c=q.scalesView,N=(W,L)=>{let X=q.blockCursor++,z=X*D,C=X*2;q.type===143?(se.set(W.subarray(L,L+26),z),c[C]=W[L+26],c[C+1]=W[L+27]):(c[C]=W[L],c[C+1]=W[L+1],se.set(W.subarray(L+2,L+re),z))},J=0;if(q.leftoverLen>0){let W=Math.min(re-q.leftoverLen,M.byteLength);q.leftover.set(M.subarray(0,W),q.leftoverLen),q.leftoverLen+=W,J+=W,q.leftoverLen===re&&(N(q.leftover,0),q.leftoverLen=0)}for(;J+re<=M.byteLength;)N(M,J),J+=re;J<M.byteLength&&(q.leftover.set(M.subarray(J),0),q.leftoverLen=M.byteLength-J);return}q.quantsView.set(M,q.writeCursor),q.writeCursor+=M.byteLength}function De(x){let M=Y.get(x);if(M){if(M.rawF16){let q=new DataView(M.rawF16.buffer,M.rawF16.byteOffset,M.rawF16.byteLength),re=M.N*M.K,D=M.f32View;for(let se=0;se<re;se++)D[se]=m[q.getUint16(se*2,!0)];M.rawF16=void 0}if(M.leftoverLen!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor ${x} (${M.leftoverLen} leftover bytes)`)}}function Se(){if(_.tieWordEmbeddings){let x=Y.get("token_embd.weight");if(!x)throw new Error("hachiue: missing token_embd.weight");Y.set("output.weight",{...x,hadamardFolded:!!(_.hadamard?.foldedWeights.has("output.weight")||_.hadamard?.tiedOutput)})}}let ue=_.hidden,be=_.intermediate,Le=_.heads,ye=_.kvHeads,we=_.headDim,Re=Le*we,He=ye*we,Je=_.hybrid,ut=Je?Je.linearValueHeads:1,br=Je?Je.linearHeadDim:1,ct=Je?ut*br:ue,wr=Je?(Je.linearKeyHeads*2+ut)*br:Math.max(ue,Re+2*He),Vr=Math.max(ue,be,Re,ct),Qt={curH:new Float32Array(8*ue),nextH:new Float32Array(8*ue),h2:new Float32Array(8*ue),n1:new Float32Array(8*ue),n2:new Float32Array(8*ue),rotBuf:new Float32Array(8*Vr),permBuf:new Float32Array(8*ct),qkvMixed:new Float32Array(8*wr),qkvConv:new Float32Array(8*wr),aProj:new Float32Array(8*ut),bProj:new Float32Array(8*ut),gbeta:new Float32Array(16*ut),core:new Float32Array(8*ct),zGate:new Float32Array(8*ct),normed:new Float32Array(8*ct),qgBuf:new Float32Array(8*Re*(_.archName==="qwen35"?2:1)),qBuf:new Float32Array(8*Re),gateBuf:new Float32Array(8*Re),kBuf:new Float32Array(8*He),vBuf:new Float32Array(8*He),qNormed:new Float32Array(8*Re),kNormed:new Float32Array(8*He),attOut:new Float32Array(8*Re),mlpGate:new Float32Array(8*be*(_.archName==="plamo3"?2:1)),mlpUp:new Float32Array(8*be),swigluOut:new Float32Array(8*be),lastHidden:new Float32Array(ue),finalNorm:new Float32Array(ue),logits:new Float32Array(_.vocab)},jt=new Map,Yt=new Map,Jt=new Map,Zt=new Map,er=new Map,tr=new Map,Pr=b*He,Or=b*(He>>5);for(let x=0;x<_.layers;x++)if(!(_.hybrid&&_.hybrid.layerTypes[x]==="linear"))jt.set(x,new Int8Array(Pr)),Yt.set(x,new Float32Array(Or)),Jt.set(x,new Int8Array(Pr)),Zt.set(x,new Float32Array(Or));else if(_.hybrid){let q=(_.hybrid.linearKeyHeads*2+_.hybrid.linearValueHeads)*_.hybrid.linearHeadDim,re=(_.hybrid.convKernel-1)*q,D=_.hybrid.linearValueHeads*_.hybrid.linearHeadDim*_.hybrid.linearHeadDim;er.set(x,new Float32Array(re)),tr.set(x,new Float32Array(D))}let Fe=0;function $r(){Fe=0;for(let x of er.values())x.fill(0);for(let x of tr.values())x.fill(0)}function yr(x,M,q,re,D){if(!_.hadamard)return;let se=K.get(re),c=.04419417382415922;for(let N=0;N<q;N++){let J=N*re;for(let W=0;W<re;W+=512){let L=J+W;if(D===0&&se)for(let X=0;X<512;X++)M[L+X]=x[L+X]*se[W+X];else for(let X=0;X<512;X++)M[L+X]=x[L+X];for(let X=1;X<512;X<<=1){let z=X<<1;for(let C=0;C<512;C+=z)for(let G=L+C;G<L+C+X;G++){let Z=M[G],V=M[G+X];M[G]=Z+V,M[G+X]=Z-V}}if(D===1&&se)for(let X=0;X<512;X++)M[L+X]=M[L+X]*c*se[W+X];else for(let X=0;X<512;X++)M[L+X]*=c}}}function ze(x,M,q,re,D){let se=Y.get(M);if(!se?.f32View)throw new Error(`hachiue: missing norm tensor ${M}`);let c=se.f32View,N=_.rmsEps;for(let J=0;J<q;J++){let W=J*re,L=0;for(let z=0;z<re;z++){let C=x[W+z];L+=C*C}let X=1/Math.sqrt(L/re+N);for(let z=0;z<re;z++)D[W+z]=x[W+z]*X*c[z]}}function Wr(x,M,q,re){let D=q>>7,se=M*D;for(let c=0;c<se;c++){let N=c<<7,J=0;for(let X=0;X<128;X++){let z=Math.abs(x[N+X]);z>J&&(J=z)}let W=J/16384,L=J>0?16384/J:0;R[c]=W;for(let X=0;X<128;X++)B[N+X]=Math.round(x[N+X]*L);if(re)for(let X=0;X<4;X++){let z=N+(X<<5);for(let C=0;C<8;C++)T[z+C]=B[z+C*4+0],T[z+8+C]=B[z+C*4+1],T[z+16+C]=B[z+C*4+2],T[z+24+C]=B[z+C*4+3]}}}function zr(x,M,q){let re=q>>5,D=M*re;for(let se=0;se<D;se++){let c=se<<5,N=0,J=0;for(let X=0;X<32;X++){let z=x[c+X];J+=z;let C=Math.abs(z);C>N&&(N=C)}let W=N/16384,L=N>0?16384/N:0;R[se]=W,j[se]=J;for(let X=0;X<32;X++)B[c+X]=Math.round(x[c+X]*L)}}let Ve=null,Lt=0,rr=!1;function qe(x,M,q,re,D,se){let c=Y.get(x);if(!c)throw new Error(`hachiue: missing weight ${x}`);let N=M;if(c.hadamardFolded&&_.hadamard){let L=se.get(M);if(!L){let X=M;if(_.hadamard.gdnVGrouped&&x.includes(".ssm_out.")&&_.hybrid&&_.hybrid.linearValueHeads>_.hybrid.linearKeyHeads){let z=_.hybrid.linearHeadDim,C=_.hybrid.linearKeyHeads,G=_.hybrid.linearValueHeads/C,Z=z*C*G,V=Qt.permBuf;for(let le=0;le<q;le++){let ee=le*Z;for(let ae=0;ae<C;ae++)for(let ce=0;ce<G;ce++){let oe=ee+(ae*G+ce)*z,Be=ee+(ce*C+ae)*z;for(let _e=0;_e<z;_e++)V[oe+_e]=M[Be+_e]}}X=V}L=Qt.rotBuf,yr(X,L,q,c.K,0),se.set(M,L)}N=L}let J=q*c.N;D&&ie.set(D.subarray(0,J),0),Q||(new Uint8Array(E.buffer,c.quantsPtr,c.quantsView.byteLength).set(c.quantsView),c.scalesView.byteLength>0&&new Uint8Array(E.buffer,c.scalesPtr,c.scalesView.byteLength).set(c.scalesView));let W=D?1:0;if(c.type===0)h.set(N.subarray(0,q*c.K),0),p.gemv_f32(q,c.N,c.K,c.quantsPtr,W,0,c.N);else if(c.type===41||c.type===142||c.type===143){let L=c.type===142;(Ve!==N||Lt!==128||L&&!rr)&&(Wr(N,q,c.K,L),Ve=N,Lt=128,rr=L),c.type===41?p.gemv_q1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):c.type===142?p.gemv_pq2_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):p.gemv_ptq1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N)}else if((Ve!==N||Lt!==32)&&(zr(N,q,c.K),Ve=N,Lt=32,rr=!1),c.type===2)p.gemv_q4_0(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===3)p.gemv_q4_1(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===12)p.gemv_q4_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===14)p.gemv_q6_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else throw new Error(`hachiue: unsupported Wasm GEMV tensor type ${c.type}`);re.set(ie.subarray(0,J),0)}function Kr(x,M){let q=Y.get("token_embd.weight"),re=x.length,D=q.quantsView,se=q.scalesView,c=se.byteLength>0?new DataView(se.buffer,se.byteOffset,se.byteLength):null,N=new DataView(D.buffer,D.byteOffset,D.byteLength),J=[1,3,9,27,81];for(let W=0;W<re;W++){let L=x[W],X=W*ue;if(q.type===0&&q.f32View)M.set(q.f32View.subarray(L*ue,(L+1)*ue),X);else if(q.type===41){let z=ue>>7;for(let C=0;C<z;C++){let G=L*z+C,Z=m[c.getUint16(G*2,!0)],V=G*16,le=X+(C<<7);for(let ee=0;ee<128;ee++){let ae=D[V+(ee>>3)]>>(ee&7)&1;M[le+ee]=ae?Z:-Z}}}else if(q.type===142){let z=ue>>7;for(let C=0;C<z;C++){let G=L*z+C,Z=m[c.getUint16(G*2,!0)],V=G*32,le=X+(C<<7);for(let ee=0;ee<128;ee++){let ae=D[V+(ee>>2)]>>(ee&3)*2&3;M[le+ee]=(ae-1)*Z}}}else if(q.type===143){let z=ue>>7;for(let C=0;C<z;C++){let G=L*z+C,Z=m[c.getUint16(G*2,!0)],V=G*26,le=X+(C<<7);for(let ee=0;ee<5;ee++){let ae=J[ee];for(let ce=0;ce<16;ce++){let oe=D[V+ce]*ae&255;M[le++]=((oe*3>>8)-1)*Z}}for(let ee=0;ee<5;ee++){let ae=J[ee];for(let ce=0;ce<8;ce++){let oe=D[V+16+ce]*ae&255;M[le++]=((oe*3>>8)-1)*Z}}for(let ee=0;ee<4;ee++){let ae=J[ee];for(let ce=0;ce<2;ce++){let oe=D[V+24+ce]*ae&255;M[le++]=((oe*3>>8)-1)*Z}}}}else if(q.type===2){let z=ue>>5;for(let C=0;C<z;C++){let G=(L*z+C)*18,Z=m[N.getUint16(G,!0)],V=X+(C<<5);for(let le=0;le<16;le++){let ee=D[G+2+le];M[V+le]=((ee&15)-8)*Z,M[V+16+le]=((ee>>4)-8)*Z}}}else if(q.type===3){let z=ue>>5;for(let C=0;C<z;C++){let G=(L*z+C)*20,Z=m[N.getUint16(G,!0)],V=m[N.getUint16(G+2,!0)],le=X+(C<<5);for(let ee=0;ee<16;ee++){let ae=D[G+4+ee];M[le+ee]=(ae&15)*Z+V,M[le+16+ee]=(ae>>4)*Z+V}}}else if(q.type===12){let z=ue>>8,C=new Uint8Array(8),G=new Uint8Array(8);for(let Z=0;Z<z;Z++){let V=(L*z+Z)*144,le=m[N.getUint16(V,!0)],ee=m[N.getUint16(V+2,!0)];for(let oe=0;oe<4;oe++)C[oe]=D[V+4+oe]&63,G[oe]=D[V+8+oe]&63;for(let oe=4;oe<8;oe++)C[oe]=D[V+8+oe]&15|D[V+oe]>>6<<4,G[oe]=D[V+8+oe]>>4|D[V+4+oe]>>6<<4;let ae=V+16,ce=X+(Z<<8);for(let oe=0;oe<4;oe++){let Be=le*C[2*oe],_e=ee*G[2*oe],ve=le*C[2*oe+1],xe=ee*G[2*oe+1];for(let Ee=0;Ee<32;Ee++){let We=D[ae+Ee];M[ce+Ee]=Be*(We&15)-_e,M[ce+32+Ee]=ve*(We>>4)-xe}ce+=64,ae+=32}}}else if(q.type===14){let z=ue>>8;for(let C=0;C<z;C++){let G=(L*z+C)*210,Z=m[N.getUint16(G+208,!0)];for(let V=0;V<2;V++){let le=G+V*64,ee=G+128+V*32,ae=G+192+V*8,ce=X+(C<<8)+V*128;for(let oe=0;oe<32;oe++){let Be=oe>>4,_e=D[le+oe],ve=D[le+oe+32],xe=D[ee+oe],Ee=(_e&15|(xe>>0&3)<<4)-32,We=(ve&15|(xe>>2&3)<<4)-32,Ge=(_e>>4|(xe>>4&3)<<4)-32,Qe=(ve>>4|(xe>>6&3)<<4)-32;M[ce+oe+0]=Z*N.getInt8(ae+Be+0)*Ee,M[ce+oe+32]=Z*N.getInt8(ae+Be+2)*We,M[ce+oe+64]=Z*N.getInt8(ae+Be+4)*Ge,M[ce+oe+96]=Z*N.getInt8(ae+Be+6)*Qe}}}}}}function qt(x,M,q,re,D,se,c,N){let J=D>>1;for(let W=0;W<M;W++){let X=(se+W)*J;for(let z=0;z<q;z++){let C=(W*q+z)*re;for(let G=0;G<J;G++){let Z=c[X+G],V=N[X+G],le=x[C+G],ee=x[C+G+J];x[C+G]=le*Z-ee*V,x[C+G+J]=ee*Z+le*V}}}}function Et(x,M,q,re,D,se,c){let N=D*(se>>5),J=re*N;for(let W=0;W<J;W++){let L=Math.floor(W/N),X=W%N,z=(L*N+X)*32,C=(c+L)*N+X,G=C*32,Z=0;for(let ee=0;ee<32;ee++){let ae=Math.abs(x[z+ee]);ae>Z&&(Z=ae)}let V=Z/127,le=Z>0?127/Z:0;q[C]=V;for(let ee=0;ee<32;ee++){let ae=Math.round(x[z+ee]*le);M[G+ee]=ae<-127?-127:ae>127?127:ae}}}function xr(x,M,q,re,D,se,c,N,J,W,L,X){let z=N/J,C=W>>5,G=1/Math.sqrt(W),Z=new Float32Array(W);for(let V=0;V<c;V++){let le=L+V,ee=X>0&&le+1>X?le+1-X:0;for(let ae=0;ae<N;ae++){let ce=Math.floor(ae/z),oe=(V*N+ae)*W;Z.fill(0);let Be=-1e30,_e=0;for(let xe=ee;xe<=le;xe++){let Ee=xe*J+ce,We=Ee*C,Ge=Ee*W,Qe=0;for(let de=0;de<C;de++){let Pe=0,Me=oe+(de<<5),Ne=Ge+(de<<5);for(let pe=0;pe<32;pe++)Pe+=x[Me+pe]*M[Ne+pe];Qe+=Pe*q[We+de]}let lt=Qe*G,rt=lt>Be?lt:Be,dt=Math.exp(Be-rt),Nt=Math.exp(lt-rt);_e=_e*dt+Nt;for(let de=0;de<C;de++){let Pe=Nt*D[We+de],Me=Ge+(de<<5),Ne=de<<5;for(let pe=0;pe<32;pe++)Z[Ne+pe]=Z[Ne+pe]*dt+Pe*re[Me+pe]}Be=rt}let ve=1/_e;for(let xe=0;xe<W;xe++)se[oe+xe]=Z[xe]*ve}}}function Gr(x,M=!0,q=!1,re){re!==void 0&&(Fe=re);let D=x.length;if(D===0)throw new Error("hachiue: empty tokenIds");if(Fe+D>b)throw new Error(`hachiue: context length ${Fe+D} exceeds maxSeqLen ${b}`);let se=_.rope.rotaryDim,c=Qt,N=new Map,J=c.curH,W=c.nextH;Kr(x,J),_.hadamard?.inverseWeights.has("token_embd.weight")&&(yr(J,W,D,ue,1),[J,W]=[W,J]);for(let L=0;L<_.layers;L++){if(ze(J,`blk.${L}.attn_norm.weight`,D,ue,c.n1),N.clear(),Ve=null,_.archName==="plamo3"){qe(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N);let G=Re+2*He;for(let _e=0;_e<D;_e++){let ve=_e*G;c.qBuf.set(c.qkvMixed.subarray(ve,ve+Re),_e*Re),c.kBuf.set(c.qkvMixed.subarray(ve+Re,ve+Re+He),_e*He),c.vBuf.set(c.qkvMixed.subarray(ve+Re+He,ve+G),_e*He)}ze(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Le,we,c.qNormed),ze(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*ye,we,c.kNormed);let Z=!!(_.swa&&_.swa.layerTypes[L]==="swa"),V=Z&&H?H:P,le=Z&&$?$:A,ee=Z&&_.swa?_.swa.windowSize:0;qt(c.qNormed,D,Le,we,se,Fe,V,le),qt(c.kNormed,D,ye,we,se,Fe,V,le);let ae=jt.get(L),ce=Yt.get(L),oe=Jt.get(L),Be=Zt.get(L);Et(c.kNormed,ae,ce,D,ye,we,Fe),Et(c.vBuf,oe,Be,D,ye,we,Fe),xr(c.qNormed,ae,ce,oe,Be,c.attOut,D,Le,ye,we,Fe,ee),N.clear(),Ve=null,qe(`blk.${L}.attn_output.weight`,c.attOut,D,c.n1,null,N),ze(c.n1,`blk.${L}.post_attention_norm`,D,ue,c.n2);for(let _e=0;_e<D*ue;_e++)c.h2[_e]=J[_e]+c.n2[_e];ze(c.h2,`blk.${L}.ffn_norm.weight`,D,ue,c.n1),N.clear(),Ve=null,qe(`blk.${L}.ffn_up.weight`,c.n1,D,c.mlpGate,null,N);for(let _e=0;_e<D;_e++){let ve=_e*be*2,xe=_e*be;for(let Ee=0;Ee<be;Ee++){let We=c.mlpGate[ve+Ee],Ge=c.mlpGate[ve+be+Ee];c.swigluOut[xe+Ee]=We/(1+Math.exp(-We))*Ge}}N.clear(),Ve=null,qe(`blk.${L}.ffn_down.weight`,c.swigluOut,D,c.n1,null,N),ze(c.n1,`blk.${L}.post_ffw_norm`,D,ue,c.n2);for(let _e=0;_e<D*ue;_e++)W[_e]=c.h2[_e]+c.n2[_e];[J,W]=[W,J];continue}if(_.hybrid&&_.hybrid.layerTypes[L]==="linear"&&_.hybrid){let G=_.hybrid.linearKeyHeads,Z=_.hybrid.linearValueHeads,V=_.hybrid.linearHeadDim,le=G*V,ee=Z*V,ae=le*2+ee,ce=_.hybrid.convKernel,oe=Fe>0;qe(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N),qe(`blk.${L}.attn_gate.weight`,c.n1,D,c.zGate,null,N);let Be=Y.get(`blk.${L}.ssm_conv1d.weight`).f32View,_e=er.get(L),ve=(de,Pe)=>de+1<ce?oe?_e[de*ae+Pe]:0:c.qkvMixed[(de-(ce-1))*ae+Pe];for(let de=0;de<D;de++){let Pe=de*ae;for(let Me=0;Me<ae;Me++){let Ne=0,pe=Me*ce;for(let $e=0;$e<ce;$e++)Ne+=Be[pe+$e]*ve(de+$e,Me);c.qkvConv[Pe+Me]=Ne/(1+Math.exp(-Ne))}}let xe=new Float32Array((ce-1)*ae);for(let de=0;de<ce-1;de++)for(let Pe=0;Pe<ae;Pe++)xe[de*ae+Pe]=ve(D+de,Pe);_e.set(xe),qe(`blk.${L}.ssm_alpha.weight`,c.n1,D,c.aProj,null,N),qe(`blk.${L}.ssm_beta.weight`,c.n1,D,c.bProj,null,N);let Ee=Y.get(`blk.${L}.ssm_a`).f32View,We=Y.get(`blk.${L}.ssm_dt.bias`).f32View,Ge=D*Z;for(let de=0;de<Ge;de++){let Pe=de%Z,Me=c.aProj[de]+We[Pe],Ne=(Me>0?Me:0)+Math.log(1+Math.exp(-Math.abs(Me)));c.gbeta[de]=Ee[Pe]*Ne,c.gbeta[Ge+de]=1/(1+Math.exp(-c.bProj[de]))}let Qe=tr.get(L);oe||Qe.fill(0);let lt=1/Math.sqrt(V),rt=new Float32Array(V),dt=new Float32Array(V);for(let de=0;de<Z;de++){let Pe=de%G,Me=de*V*V;for(let Ne=0;Ne<D;Ne++){let pe=Ne*ae,$e=pe+Pe*V,Ir=pe+le+Pe*V,Jr=pe+le*2+de*V,kr=Ne*Z+de,Dr=0,Sr=0;for(let Te=0;Te<V;Te++){let _t=c.qkvConv[$e+Te],Tt=c.qkvConv[Ir+Te];Sr+=_t*_t,Dr+=Tt*Tt}let Zr=1/Math.sqrt(Dr+1e-6),en=1/Math.sqrt(Sr+1e-6)*lt;for(let Te=0;Te<V;Te++)dt[Te]=c.qkvConv[$e+Te]*en,rt[Te]=c.qkvConv[Ir+Te]*Zr;let tn=Math.exp(c.gbeta[kr]),rn=c.gbeta[Ge+kr],nn=(Ne*Z+de)*V;for(let Te=0;Te<V;Te++){let _t=0;for(let je=0;je<V;je++){let ft=Me+je*V+Te,ht=Qe[ft]*tn;Qe[ft]=ht,_t+=ht*rt[je]}let Tt=(c.qkvConv[Jr+Te]-_t)*rn,Br=0;for(let je=0;je<V;je++){let ft=Me+je*V+Te,ht=Qe[ft]+rt[je]*Tt;Qe[ft]=ht,Br+=ht*dt[je]}c.core[nn+Te]=Br}}}let Nt=Y.get(`blk.${L}.ssm_norm.weight`).f32View;for(let de=0;de<D*Z;de++){let Pe=de*V,Me=0;for(let pe=0;pe<V;pe++){let $e=c.core[Pe+pe];Me+=$e*$e}let Ne=1/Math.sqrt(Me/V+_.rmsEps);for(let pe=0;pe<V;pe++){let $e=c.zGate[Pe+pe];c.normed[Pe+pe]=Nt[pe]*(c.core[Pe+pe]*Ne)*($e/(1+Math.exp(-$e)))}}N.clear(),Ve=null,qe(`blk.${L}.ssm_out.weight`,c.normed,D,c.h2,J,N)}else{let G=_.archName==="qwen35";if(G){qe(`blk.${L}.attn_q.weight`,c.n1,D,c.qgBuf,null,N);let ae=D*Le*we;for(let ce=0;ce<ae;ce++){let oe=ce%we,_e=Math.floor(ce/we)*(we*2);c.qBuf[ce]=c.qgBuf[_e+oe],c.gateBuf[ce]=c.qgBuf[_e+we+oe]}}else qe(`blk.${L}.attn_q.weight`,c.n1,D,c.qBuf,null,N);qe(`blk.${L}.attn_k.weight`,c.n1,D,c.kBuf,null,N),qe(`blk.${L}.attn_v.weight`,c.n1,D,c.vBuf,null,N),ze(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Le,we,c.qNormed),ze(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*ye,we,c.kNormed),qt(c.qNormed,D,Le,we,se,Fe,P,A),qt(c.kNormed,D,ye,we,se,Fe,P,A);let Z=jt.get(L),V=Yt.get(L),le=Jt.get(L),ee=Zt.get(L);if(Et(c.kNormed,Z,V,D,ye,we,Fe),Et(c.vBuf,le,ee,D,ye,we,Fe),xr(c.qNormed,Z,V,le,ee,c.attOut,D,Le,ye,we,Fe,0),G){let ae=D*Le*we;for(let ce=0;ce<ae;ce++)c.attOut[ce]*=1/(1+Math.exp(-c.gateBuf[ce]))}N.clear(),Ve=null,qe(`blk.${L}.attn_output.weight`,c.attOut,D,c.h2,J,N)}let z=_.archName==="qwen35"?`blk.${L}.post_attention_norm.weight`:`blk.${L}.ffn_norm.weight`;ze(c.h2,z,D,ue,c.n2),N.clear(),Ve=null,qe(`blk.${L}.ffn_gate.weight`,c.n2,D,c.mlpGate,null,N),qe(`blk.${L}.ffn_up.weight`,c.n2,D,c.mlpUp,null,N);let C=D*be;for(let G=0;G<C;G++){let Z=c.mlpGate[G];c.swigluOut[G]=Z/(1+Math.exp(-Z))*c.mlpUp[G]}N.clear(),Ve=null,qe(`blk.${L}.ffn_down.weight`,c.swigluOut,D,W,c.h2,N),[J,W]=[W,J]}if(Fe+=D,!M)return{};if(D>1?(c.lastHidden.set(J.subarray((D-1)*ue,D*ue)),ze(c.lastHidden,"output_norm.weight",1,ue,c.finalNorm)):ze(J,"output_norm.weight",1,ue,c.finalNorm),N.clear(),Ve=null,qe("output.weight",c.finalNorm,1,c.logits,null,N),q){let L=-1e30,X=0,z=_.vocab;for(let C=0;C<z;C++){let G=c.logits[C];G>L&&(L=G,X=C)}return{greedyId:X}}return{logits:new Float32Array(c.logits)}}function Qr(x){let M=Y.get(x);if(!M)throw new Error(`hachiue: tensor "${x}" not found`);return{type:M.type,rows:M.N,cols:M.K,rowBytes:M.rowBytes}}function jr(x,M){let q=Y.get(x);if(!q)throw new Error(`hachiue: tensor "${x}" not found`);let re=M.length,D=new Uint8Array(re*q.rowBytes);for(let se=0;se<re;se++){let c=M[se];if(c<0||c>=q.N)throw new Error(`hachiue: row index ${c} out of bounds for "${x}" (rows=${q.N})`);D.set(q.quantsView.subarray(c*q.rowBytes,(c+1)*q.rowBytes),se*q.rowBytes)}return D}function Yr(x,M,q){let re=Y.get(x);if(!re)throw new Error(`hachiue: tensor "${x}" not found`);let D=M.length;if(D===0)return;let se=q.byteLength===re.rowBytes&&D>1;if(!se&&q.byteLength!==D*re.rowBytes)throw new Error(`hachiue: writeTensorRows("${x}") expected ${D*re.rowBytes} (or ${re.rowBytes}) bytes, got ${q.byteLength}`);for(let c=0;c<D;c++){let N=M[c];if(N<0||N>=re.N)throw new Error(`hachiue: row index ${N} out of bounds for "${x}" (rows=${re.N})`);let J=se?0:c*re.rowBytes;re.quantsView.set(q.subarray(J,J+re.rowBytes),N*re.rowBytes)}}return{pushTensorBytes:Oe,finishTensor:De,finalizeWeights:Se,forwardSegment:Gr,resetCache:$r,getTensorRowSpec:Qr,readTensorRows:jr,writeTensorRows:Yr}}function An(n=Wt){let t=null,s=self;s.onmessage=a=>{let r=a.data;try{switch(r.type){case"init":t=n(r.payload),s.postMessage({id:r.id,ok:!0});break;case"pushBatch":for(let u of r.items)t.pushTensorBytes(u.name,u.bytes),u.finished&&t.finishTensor(u.name);s.postMessage({id:r.id,ok:!0});break;case"finalize":t.finalizeWeights(),s.postMessage({id:r.id,ok:!0});break;case"forward":{let u=t.forwardSegment(r.tokenIds,r.computeLogits,r.greedyOnly,r.posBase),d=u.logits?[u.logits.buffer]:[];s.postMessage({id:r.id,ok:!0,res:u},d);break}case"resetCache":t.resetCache(),s.postMessage({id:r.id,ok:!0});break;case"readRows":{let u=t.readTensorRows(r.name,r.rowIndices);s.postMessage({id:r.id,ok:!0,out:u},[u.buffer]);break}case"writeRows":t.writeTensorRows(r.name,r.rowIndices,r.data),s.postMessage({id:r.id,ok:!0});break}}catch(u){s.postMessage({id:r.id,ok:!1,error:u.message||String(u)})}}}var yt=null;function Ln(){if(yt)return yt;yt=new Float32Array(65536);for(let n=0;n<65536;n++)yt[n]=wt(n);return yt}async function dr(n,t,s,a,r,u){let d=n.arch,g=t.maxSeqLen??4096;t.onProgress?.({phase:"pipelines",message:"Compiling Wasm SIMD kernels..."});let f=lr(),I=Ln(),k=[];if(d.hadamard)for(let[p,O]of d.hadamard.signsByWidth.entries()){let v=new Float32Array(p);for(let h=0;h<p;h++)v[h]=O[h];k.push([p,v])}let i=Object.values(n.tensors).sort((p,O)=>p.absOffset-O.absOffset),_=[],b=new Map;for(let p of i){let O=p.dims[0],v=p.dims.length>1?p.dims[1]:1,[h,B]=st(p.type),T=O/h,R=!!d.hadamard?.foldedWeights.has(p.name);_.push({name:p.name,type:p.type,N:v,K:O,nb:T,hadamardFolded:R,byteLength:p.byteLength});let j=0,ie=p.type===te.F16?te.F32:p.type;if(ie===te.F32)j=O*4;else if(p.type===te.Q1_0||p.type===te.PQ2_0||p.type===te.PTQ1_0){let Y=p.type===te.Q1_0?16:p.type===te.PQ2_0?32:26;j=T*Y}else j=T*B;b.set(p.name,{type:ie,rows:v,cols:O,rowBytes:j})}if(d.tieWordEmbeddings){let p=b.get("token_embd.weight");p&&b.set("output.weight",{...p})}let m={arch:d,maxSeqLen:g,wasmBytes:f,fp16Table:I,cos:s,sin:a,swaCos:r,swaSin:u,hadamardSigns:k,tensors:_},P=(t.useWorker??!0)&&typeof Worker<"u"&&typeof Blob<"u"&&typeof URL<"u"&&typeof URL.createObjectURL=="function",A=null,H=null,$=1,K=new Map,y=(p,O=[])=>{let v=$++;return new Promise((h,B)=>{K.set(v,{resolve:h,reject:B}),A.postMessage({...p,id:v},O)})};if(P)try{let p=`(${An.toString()})(${Wt.toString()});`,O=new Blob([p],{type:"text/javascript"});H=URL.createObjectURL(O),A=new Worker(H),A.onmessage=v=>{let{id:h,ok:B,res:T,out:R,error:j}=v.data,ie=K.get(h);ie&&(K.delete(h),B?ie.resolve(R??T??!0):ie.reject(new Error(j)))},A.onerror=v=>{for(let h of K.values())h.reject(new Error(v.message||"hachiue: Wasm Worker error"));K.clear()},await y({type:"init",payload:m})}catch{A&&A.terminate(),H&&URL.revokeObjectURL(H),A=null,H=null}let U=A?null:Wt(m),Q=!!A;t.onProgress?.({phase:"pipelines",message:Q?"Initializing Wasm SIMD Web Worker...":"Initializing Wasm SIMD kernels...",backend:"wasm",isWorker:Q});let E=0,F=i.length>0?i[0].absOffset:n.dataStartOffset;await ot(t.url,F,n.totalFileSize,async(p,O)=>{let v=O+p.byteLength,h=[],B=[];for(;E<i.length;){let T=i[E],R=T.absOffset,j=T.absOffset+T.byteLength;if(j<=O){E++;continue}if(R>=v)break;let ie=Math.max(0,R-O),Y=Math.min(p.byteLength,j-O),he=O+Y===j;if(Y>ie)if(A){let Oe=p.slice(ie,Y);h.push({name:T.name,bytes:Oe,finished:he}),B.push(Oe.buffer)}else U.pushTensorBytes(T.name,p.subarray(ie,Y)),he&&U.finishTensor(T.name);else he&&(A?h.push({name:T.name,bytes:new Uint8Array(0),finished:!0}):U.finishTensor(T.name));if(he)E++;else break}A&&h.length>0&&await y({type:"pushBatch",items:h},B),await new Promise(T=>setTimeout(T,0))},t),A?await y({type:"finalize"}):U.finalizeWeights(),t.onProgress?.({phase:"ready",message:A?"Model loaded into Wasm SIMD Worker":"Model loaded into Wasm SIMD memory",backend:"wasm",isWorker:Q});let S=Promise.resolve();return{isWorker:!!A,getTensorRowSpec(p){let O=b.get(p);if(!O)throw new Error(`hachiue: tensor "${p}" not found`);return O},async readTensorRows(p,O){let v=b.get(p);if(!v)throw new Error(`hachiue: tensor "${p}" not found`);for(let h=0;h<O.length;h++){let B=O[h];if(B<0||B>=v.rows)throw new Error(`hachiue: row index ${B} out of bounds for "${p}" (rows=${v.rows})`)}return O.length===0?new Uint8Array(0):A?(await S,await y({type:"readRows",name:p,rowIndices:Array.from(O)})):U.readTensorRows(p,O)},writeTensorRows(p,O,v){let h=b.get(p);if(!h)throw new Error(`hachiue: tensor "${p}" not found`);let B=O.length;if(B===0)return;if(!(v.byteLength===h.rowBytes&&B>1)&&v.byteLength!==B*h.rowBytes)throw new Error(`hachiue: writeTensorRows("${p}") expected ${B*h.rowBytes} (or ${h.rowBytes}) bytes, got ${v.byteLength}`);for(let R=0;R<B;R++){let j=O[R];if(j<0||j>=h.rows)throw new Error(`hachiue: row index ${j} out of bounds for "${p}" (rows=${h.rows})`)}if(A){let R=new Uint8Array(v);S=y({type:"writeRows",name:p,rowIndices:Array.from(O),data:R},[R.buffer]);return}U.writeTensorRows(p,O,v)},async forwardSegment(p,O,v,h){return A?(await S,await y({type:"forward",tokenIds:p,computeLogits:O,greedyOnly:v,posBase:h})):U.forwardSegment(p,O,v,h)},resetCache(){if(A){S=y({type:"resetCache"});return}U.resetCache()},async flush(){await S},dispose(){A&&(A.terminate(),A=null),H&&(URL.revokeObjectURL(H),H=null)}}}var zt=1,qn=4,xt=8,En=64,Nn=128,Ke=Nn|xt|qn,Tn=En|xt,ge=8;function Cn(n,t,s,a,r,u){let d=a/128,g=t===te.Q1_0?18:t===te.PQ2_0?34:28,f=g-2,I=0,k=0,i=s[0].rowCount*d,_=r.byteLength,b=0,m=0,P=0,A=0,H=new Uint8Array(g),$=0,K=()=>{let U=0,Q=s[I];if(b>0){let E=b+3&-4;E>b&&r.fill(0,b,E),n.queue.writeBuffer(Q.quants,P,r,0,E),P+=b,U+=E,b=0}if(m>0){let E=m+3&-4;E>m&&u.fill(0,m,E),n.queue.writeBuffer(Q.scales16,A,u,0,E),A+=m,U+=E,m=0}return U},y=(U,Q)=>{let E=0;return t===te.PTQ1_0?(r.set(U.subarray(Q,Q+26),b),b+=26,u[m++]=U[Q+26],u[m++]=U[Q+27]):(u[m++]=U[Q],u[m++]=U[Q+1],r.set(U.subarray(Q+2,Q+g),b),b+=f),k++,(k&1)===0&&b+1024>=_&&(E+=K()),k===i&&(E+=K(),I++,k=0,P=0,A=0,I<s.length&&(i=s[I].rowCount*d)),E};return{push:U=>{let Q=0,E=0;if($>0){let F=Math.min(g-$,U.byteLength);H.set(U.subarray(0,F),$),$+=F,E+=F,$===g&&(Q+=y(H,0),$=0)}for(;E+g<=U.byteLength;)Q+=y(U,E),E+=g;return E<U.byteLength&&(H.set(U.subarray(E),0),$=U.byteLength-E),Q},finish:()=>{if($!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor (${$} leftover bytes)`);return K()}}}function Fn(n,t,s,a){let r=0,u=0,d=t[0].rowCount*s,g=0,f=0,I=a.byteLength,k=()=>{if(g===0)return 0;let i=t[r],_=g+3&-4;_>g&&a.fill(0,g,_),n.queue.writeBuffer(i.quants,f,a,0,_),f+=g;let b=_;return g=0,b};return{push:i=>{let _=0,b=0;for(;b<i.byteLength&&r<t.length;){let m=d-u,P=I-g,A=P>=4?P&-4:P,H=Math.min(i.byteLength-b,m,A);a.set(i.subarray(b,b+H),g),g+=H,u+=H,b+=H,u===d?(_+=k(),r++,u=0,f=0,r<t.length&&(d=t[r].rowCount*s)):g+4096>=I&&(g&3)===0&&(_+=k())}return _},finish:()=>k()}}function Er(n,t,s=!1){let a=n.rope.rotaryDim,r=a>>1,u=new Float32Array(t*r),d=new Float32Array(t*r),g=s?n.rope.localTheta??1e4:n.rope.theta,f=!s&&n.rope.factor&&n.rope.factor>1?n.rope.factor:1,I=n.rope.originalMaxPositions??4096,k=n.rope.yarnBetaFast??32,i=n.rope.yarnBetaSlow??1,_=f>1?.1*Math.log(f)+1:1,b=new Float64Array(r),m=0,P=r-1;if(f>1){let A=H=>a*Math.log(I/(H*2*Math.PI))/(2*Math.log(g));m=Math.max(0,A(k)),P=Math.min(r-1,A(i)),m===P&&(P+=.001)}for(let A=0;A<r;A++){let H=1/Math.pow(g,2*A/a);if(f>1){let $=H,K=H/f,y=(A-m)/(P-m),Q=1-Math.min(1,Math.max(0,y));b[A]=K*(1-Q)+$*Q}else b[A]=H}for(let A=0;A<t;A++)for(let H=0;H<r;H++){let $=A*b[H];u[A*r+H]=Math.cos($)*_,d[A*r+H]=Math.sin($)*_}return{cos:u,sin:d}}var It=class n{header;arch;tokenizer;backend;isWorker;backendInfo;device;maxSeqLen;wasmBackend;pipelines;weights;hadamardSigns;cosBuf;sinBuf;swaCosBuf;swaSinBuf;dummyBuf;logitsBuf;logitsReadBuf;logitsCpu;argmaxBuf;argmaxReadBuf;tokensBuf;kCacheQ;kCacheS;vCacheQ;vCacheS;ssmConvState;ssmRecState;scratch;uniformPool=[];uniformCursor=0;uniformScratch=new ArrayBuffer(32);uniformView=new DataView(this.uniformScratch);ssmParity=0;cachePos=0;tokenHistory=[];lastMessages=[];lastTurnTokens=[];disposed=!1;constructor(t,s,a,r,u,d,g,f,I,k,i=null,_){if(this.header=t,this.arch=t.arch,this.tokenizer=t.tokenizer?new Pt(t.tokenizer):null,this.backend=i?"wasm":"webgpu",this.isWorker=i?i.isWorker:!1,this.backendInfo=_??{backend:this.backend,isWorker:this.isWorker,label:this.backend==="webgpu"?"WebGPU":this.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD"},this.device=s,this.maxSeqLen=a,this.wasmBackend=i,this.pipelines=r,this.weights=u,this.hadamardSigns=d,this.cosBuf=g,this.sinBuf=f,this.swaCosBuf=I,this.swaSinBuf=k,i||!s){this.dummyBuf=null,this.logitsBuf=null,this.logitsReadBuf=null,this.logitsCpu=new Float32Array(0),this.argmaxBuf=null,this.argmaxReadBuf=null,this.tokensBuf=null,this.scratch=null,this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;return}let b=(B,T=Ke)=>s.createBuffer({size:Math.max(16,B+3&-4),usage:T}),m=B=>b(B*4);this.dummyBuf=b(64),this.logitsBuf=b(this.arch.vocab*4),this.logitsReadBuf=s.createBuffer({size:this.arch.vocab*4,usage:zt|xt}),this.logitsCpu=new Float32Array(this.arch.vocab),this.argmaxBuf=b(16),this.argmaxReadBuf=s.createBuffer({size:16,usage:zt|xt}),this.tokensBuf=b(ge*4);let P=this.arch.hidden,A=this.arch.intermediate,H=this.arch.heads,$=this.arch.kvHeads,K=this.arch.headDim,y=H*K,U=$*K,Q=this.arch.hybrid,E=Q?Q.linearValueHeads:1,F=Q?Q.linearHeadDim:1,S=Q?E*F:P,p=Q?(Q.linearKeyHeads*2+E)*F:Math.max(P,y+2*U),O=Math.max(P,A,y,S);this.scratch={curH:m(ge*P),nextH:m(ge*P),h2:m(ge*P),n1:m(ge*P),n2:m(ge*P),rotBuf:m(ge*O),permBuf:m(ge*S),qkvMixed:m(ge*p),qkvConv:m(ge*p),aProj:m(ge*E),bProj:m(ge*E),gbeta:m(2*ge*E),core:m(ge*S),zGate:m(ge*S),normed:m(ge*S),qgBuf:m(ge*y*(this.arch.archName==="qwen35"?2:1)),qBuf:m(ge*y),gateBuf:m(ge*y),kBuf:m(ge*U),vBuf:m(ge*U),qNormed:m(ge*y),kNormed:m(ge*U),attOut:m(ge*y),mlpGate:m(ge*A*(this.arch.archName==="plamo3"?2:1)),mlpUp:m(ge*A),swigluOut:m(ge*A),lastHidden:m(P),finalNorm:m(P)},this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;let v=a*U,h=a*(U/32)*4;for(let B=0;B<this.arch.layers;B++)if(!(this.arch.hybrid&&this.arch.hybrid.layerTypes[B]==="linear"))this.kCacheQ.set(B,b(v)),this.kCacheS.set(B,b(h)),this.vCacheQ.set(B,b(v)),this.vCacheS.set(B,b(h));else if(this.arch.hybrid){let R=this.arch.hybrid,j=(R.linearKeyHeads*2+R.linearValueHeads)*R.linearHeadDim,ie=(R.convKernel-1)*j*4,Y=R.linearValueHeads*R.linearHeadDim*R.linearHeadDim*4;this.ssmConvState.set(B,[b(ie),b(ie)]),this.ssmRecState.set(B,[b(Y),b(Y)])}}static async prefetch(t,s={}){return or(t,s)}static async create(t){let s=t.maxSeqLen??4096,a=await gt(t.url,t),r=a.arch,u=t.backend??(t.device?"webgpu":"auto"),{cos:d,sin:g}=Er(r,s,!1),f=null,I=null;if(r.swa){let h=Er(r,s,!0);f=h.cos,I=h.sin}let k=async h=>{let B=await dr(a,t,d,g,f,I),T={backend:"wasm",isWorker:B.isWorker,label:B.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD",...h?{fallbackReason:h}:{}};return new n(a,null,s,new Map,new Map,new Map,null,null,null,null,B,T)};if(u==="wasm")return k();let i=t.device,_=i?"custom-device":void 0,b=null;try{if(!i){if(typeof navigator>"u"||!navigator.gpu)throw new Error("hachiue: WebGPU is not supported in this browser");let h=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(h?_="high-performance":(h=await navigator.gpu.requestAdapter(),h?_="default":(h=await navigator.gpu.requestAdapter({featureLevel:"compatibility"}),h&&(_="compatibility"))),!h)throw new Error("hachiue: Failed to acquire WebGPU adapter");let B=Math.min(h.limits.maxStorageBufferBindingSize,256*1024*1024),T=Math.min(h.limits.maxBufferSize,512*1024*1024),R=h.limits.maxStorageBuffersPerShaderStage;i=await h.requestDevice({requiredLimits:{maxStorageBufferBindingSize:B,maxBufferSize:T,...R?{maxStorageBuffersPerShaderStage:R}:{}}})}t.onProgress?.({phase:"pipelines",message:"Compiling WebGPU shaders...",backend:"webgpu",isWorker:!1}),b=new Map,await Promise.all(Object.entries(ur).map(async([h,B])=>{let T=i.createShaderModule({code:B,label:h});if(typeof T.getCompilationInfo=="function"){let j=(await T.getCompilationInfo()).messages.find(ie=>ie.type==="error");if(j)throw new Error(`hachiue: WGSL error in ${h} (L${j.lineNum}:${j.linePos}): ${j.message}`)}try{let R=await i.createComputePipelineAsync({layout:"auto",compute:{module:T,entryPoint:"main"}});b.set(h,R)}catch(R){throw new Error(`hachiue: pipeline compile failed in ${h}: ${R.message||R}`)}}))}catch(h){if(i&&!t.device)try{i.destroy()}catch{}if(u==="webgpu")throw h;let B=h instanceof Error?h.message:String(h);return k(B)}i.lost.then(h=>{t.onDeviceLost?.({reason:String(h.reason??"unknown"),message:h.message})});let m=new Map;if(r.hadamard)for(let[h,B]of r.hadamard.signsByWidth.entries()){let T=new Float32Array(h);for(let j=0;j<h;j++)T[j]=B[j];let R=i.createBuffer({size:T.byteLength,usage:Ke});i.queue.writeBuffer(R,0,T),m.set(h,R)}let P=i.createBuffer({size:d.byteLength,usage:Ke}),A=i.createBuffer({size:g.byteLength,usage:Ke});i.queue.writeBuffer(P,0,d.buffer,d.byteOffset,d.byteLength),i.queue.writeBuffer(A,0,g.buffer,g.byteOffset,g.byteLength);let H=null,$=null;f&&I&&(H=i.createBuffer({size:f.byteLength,usage:Ke}),$=i.createBuffer({size:I.byteLength,usage:Ke}),i.queue.writeBuffer(H,0,f.buffer,f.byteOffset,f.byteLength),i.queue.writeBuffer($,0,I.buffer,I.byteOffset,I.byteLength));let K=Math.min(i.limits.maxStorageBufferBindingSize,64*1024*1024),y=new Map,U=i.createBuffer({size:16,usage:Ke}),Q=new Uint8Array(new ArrayBuffer(1024*1024)),E=new Uint8Array(new ArrayBuffer(128*1024)),F=[],S=Object.values(a.tensors).sort((h,B)=>h.absOffset-B.absOffset);for(let h of S){let B=h.dims[0],T=h.dims.length>1?h.dims[1]:1,R=!!r.hadamard?.foldedWeights.has(h.name);if(h.type===te.F32||h.type===te.F16){let j=B*T,ie=i.createBuffer({size:Math.max(16,j*4),usage:Ke});if(y.set(h.name,{type:te.F32,N:T,K:B,nb:1,hadamardFolded:R,f32Buf:ie}),h.type===te.F32){let Y=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:he=>(i.queue.writeBuffer(ie,Y,he.buffer,he.byteOffset,he.byteLength),Y+=he.byteLength,he.byteLength),finish:()=>0})}else{let Y=null,he=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:Oe=>(Y||(Y=new Uint8Array(h.byteLength)),Y.set(Oe,he),he+=Oe.byteLength,0),finish:()=>{if(!Y)return 0;let Oe=new DataView(Y.buffer,Y.byteOffset,Y.byteLength),De=new Float32Array(j);for(let Se=0;Se<j;Se++)De[Se]=wt(Oe.getUint16(Se*2,!0));return i.queue.writeBuffer(ie,0,De),Y=null,De.byteLength}})}}else if(h.type===te.Q1_0||h.type===te.PQ2_0||h.type===te.PTQ1_0){let j=B/128,ie=h.type===te.Q1_0?16:h.type===te.PQ2_0?32:26,Y=j*ie,he=Math.max(1,Math.floor(K/Y)),Oe=[];for(let ue=0;ue<T;ue+=he){let be=Math.min(he,T-ue),Le=Math.max(16,be*Y+3&-4),ye=Math.max(16,be*j*2+3&-4);Oe.push({rowStart:ue,rowCount:be,quants:i.createBuffer({size:Le,usage:Ke}),scales16:i.createBuffer({size:ye,usage:Ke})})}let De={type:h.type,N:T,K:B,nb:j,hadamardFolded:R,chunks:Oe};y.set(h.name,De);let Se=Cn(i,h.type,Oe,B,Q,E);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:Se.push,finish:Se.finish})}else if(h.type===te.Q4_0||h.type===te.Q4_1||h.type===te.Q4_K||h.type===te.Q6_K){let[j,ie]=st(h.type),Y=B/j,he=Y*ie,Oe=Math.max(1,Math.floor(K/he)),De=[];for(let ue=0;ue<T;ue+=Oe){let be=Math.min(Oe,T-ue),Le=Math.max(16,be*he+3&-4);De.push({rowStart:ue,rowCount:be,quants:i.createBuffer({size:Le,usage:Ke}),scales16:U})}y.set(h.name,{type:h.type,N:T,K:B,nb:Y,hadamardFolded:R,chunks:De});let Se=Fn(i,De,he,Q);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:Se.push,finish:Se.finish})}else throw new Error(`hachiue: unsupported tensor type ${h.type} for ${h.name}`)}if(r.tieWordEmbeddings){let h=y.get("token_embd.weight");if(!h)throw new Error("hachiue: missing token_embd.weight");y.set("output.weight",{...h,hadamardFolded:!!(r.hadamard?.foldedWeights.has("output.weight")||r.hadamard?.tiedOutput)})}let p=0,O=F.length>0&&F[0]?F[0].absStart:a.dataStartOffset;await ot(t.url,O,a.totalFileSize,async(h,B)=>{let T=B+h.byteLength;for(;p<F.length;){let R=F[p];if(!R||R.absEnd<=B){F[p]=null,p++;continue}if(R.absStart>=T)break;let j=Math.max(0,R.absStart-B),ie=Math.min(h.byteLength,R.absEnd-B);if(ie>j&&R.push(h.subarray(j,ie)),B+ie===R.absEnd)R.finish(),F[p]=null,p++;else break}await i.queue.onSubmittedWorkDone(),await new Promise(R=>setTimeout(R,0))},t),await i.queue.onSubmittedWorkDone(),t.onProgress?.({phase:"ready",message:"Model loaded into WebGPU memory",backend:"webgpu",isWorker:!1});let v={backend:"webgpu",isWorker:!1,label:_==="compatibility"?"WebGPU (Compat)":"WebGPU",adapterMode:_};return new n(a,i,s,b,y,m,P,A,H,$,null,v)}resetCache(){this.cachePos=0,this.ssmParity=0,this.tokenHistory=[],this.lastMessages=[],this.lastTurnTokens=[],this.wasmBackend&&this.wasmBackend.resetCache()}dispose(){this.disposed||(this.disposed=!0,this.wasmBackend?this.wasmBackend.dispose():this.device&&this.device.destroy())}async flushDeviceQueue(){if(this.wasmBackend){await this.wasmBackend.flush();return}await this.device.queue.onSubmittedWorkDone()}getTensorRowSpec(t){if(this.wasmBackend)return this.wasmBackend.getTensorRowSpec(t);let s=this.weights.get(t);if(!s)throw new Error(`hachiue: tensor "${t}" not found`);if(s.f32Buf)return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.K*4};if(s.type===te.Q1_0||s.type===te.PQ2_0||s.type===te.PTQ1_0){let r=s.type===te.Q1_0?16:s.type===te.PQ2_0?32:26;return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.nb*r}}let[,a]=st(s.type);return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.nb*a}}resolveTensorRowBuffer(t,s,a){if(a<0||a>=s.N)throw new Error(`hachiue: row index ${a} out of bounds for "${t}" (rows=${s.N})`);if(s.f32Buf)return{buf:s.f32Buf,localRow:a};if(s.chunks){for(let r of s.chunks)if(a>=r.rowStart&&a<r.rowStart+r.rowCount)return{buf:r.quants,localRow:a-r.rowStart}}throw new Error(`hachiue: failed to resolve GPU chunk for "${t}" row ${a}`)}async readTensorRows(t,s){if(this.wasmBackend)return this.wasmBackend.readTensorRows(t,s);let a=this.weights.get(t);if(!a)throw new Error(`hachiue: tensor "${t}" not found`);let{rowBytes:r}=this.getTensorRowSpec(t),u=s.length;if(u===0)return new Uint8Array(0);let d=u*r,g=this.device.createBuffer({size:d,usage:zt|xt}),f=this.device.createCommandEncoder();for(let k=0;k<u;k++){let{buf:i,localRow:_}=this.resolveTensorRowBuffer(t,a,s[k]);f.copyBufferToBuffer(i,_*r,g,k*r,r)}this.device.queue.submit([f.finish()]),await g.mapAsync(zt);let I=new Uint8Array(g.getMappedRange().slice(0));return g.unmap(),g.destroy(),I}writeTensorRows(t,s,a){if(this.wasmBackend){this.wasmBackend.writeTensorRows(t,s,a);return}let r=this.weights.get(t);if(!r)throw new Error(`hachiue: tensor "${t}" not found`);let{rowBytes:u}=this.getTensorRowSpec(t),d=s.length;if(d===0)return;let g=a.byteLength===u&&d>1;if(!g&&a.byteLength!==d*u)throw new Error(`hachiue: writeTensorRows("${t}") expected ${d*u} (or ${u}) bytes, got ${a.byteLength}`);for(let f=0;f<d;f++){let{buf:I,localRow:k}=this.resolveTensorRowBuffer(t,r,s[f]),i=g?a.byteOffset:a.byteOffset+f*u;this.device.queue.writeBuffer(I,k*u,a.buffer,i,u)}}mkUniform(t,s=new Set){for(let u=0;u<8;u++){let d=u<t.length?t[u]:0;s.has(u)?this.uniformView.setFloat32(u*4,d,!0):this.uniformView.setUint32(u*4,d>>>0,!0)}let a=this.uniformCursor++,r=this.uniformPool[a];return r||(r=this.device.createBuffer({size:32,usage:Tn}),this.uniformPool.push(r)),this.device.queue.writeBuffer(r,0,this.uniformScratch),r}dispatch(t,s,a,r,u,d=1,g=1){let f=this.pipelines.get(s);if(!f)throw new Error(`hachiue: missing pipeline ${s}`);let I=[{binding:0,resource:{buffer:a}}];for(let i=0;i<r.length;i++)I.push({binding:i+1,resource:{buffer:r[i]}});let k=this.device.createBindGroup({layout:f.getBindGroupLayout(0),entries:I});t.setPipeline(f),t.setBindGroup(0,k),t.dispatchWorkgroups(u,d,g)}runHadamard(t,s,a,r,u,d){if(!this.arch.hadamard)return;let g=this.hadamardSigns.get(u),f=g?1:0,I=this.mkUniform([r,u,d,f]),k=r*(u>>9);this.dispatch(t,"hadamard_512",I,[s,g??this.dummyBuf,a],k)}runRmsNorm(t,s,a,r,u,d){let g=this.weights.get(a);if(!g?.f32Buf)throw new Error(`hachiue: missing norm tensor ${a}`);let f=this.mkUniform([r,u,this.arch.rmsEps,0],new Set([2]));this.dispatch(t,"rmsnorm",f,[s,g.f32Buf,d],r)}runMatmul(t,s,a,r,u,d,g){let f=this.weights.get(s);if(!f)throw new Error(`hachiue: missing weight ${s}`);let I=a;if(f.hadamardFolded&&this.arch.hadamard){let i=g.get(a);if(!i){let _=a;if(this.arch.hadamard.gdnVGrouped&&s.includes(".ssm_out.")&&this.arch.hybrid&&this.arch.hybrid.linearValueHeads>this.arch.hybrid.linearKeyHeads){let b=this.arch.hybrid.linearHeadDim,m=this.arch.hybrid.linearKeyHeads,P=this.arch.hybrid.linearValueHeads/m,A=this.mkUniform([r,b,m,P]);this.dispatch(t,"permute_gdn",A,[a,this.scratch.permBuf],Math.ceil(r*f.K/256)),_=this.scratch.permBuf}i=this.scratch.rotBuf,this.runHadamard(t,_,i,r,f.K,0),g.set(a,i)}I=i}if(f.type===te.F32&&f.f32Buf){let i=Math.ceil(f.N/4),_=Math.min(i,65535),b=Math.ceil(i/_),m=this.mkUniform([r,f.N,f.K,_]);this.dispatch(t,"gemv_f32",m,[I,f.f32Buf,u],_,b,r);return}if(!f.chunks)throw new Error(`hachiue: missing quantized chunks for ${s}`);let k=f.type===te.Q1_0?"gemv_q1_0":f.type===te.PQ2_0?"gemv_pq2_0":f.type===te.PTQ1_0?"gemv_ptq1_0":f.type===te.Q4_0?"gemv_q4_0":f.type===te.Q4_1?"gemv_q4_1":f.type===te.Q4_K?"gemv_q4_k":"gemv_q6_k";for(let i of f.chunks){let _=Math.ceil(i.rowCount/4),b=Math.min(_,65535),m=Math.ceil(_/b),P=this.mkUniform([r,i.rowCount,f.K,f.nb,b,d?1:0,i.rowStart,f.N]);this.dispatch(t,k,P,[I,i.quants,i.scales16,d??this.dummyBuf,u],b,m,r)}}async forwardSegment(t,s=!0,a=!1){let r=t.length;if(r===0)throw new Error("hachiue: empty tokenIds");if(this.cachePos+r>this.maxSeqLen)throw new Error(`hachiue: context length ${this.cachePos+r} exceeds maxSeqLen ${this.maxSeqLen}`);if(this.wasmBackend){let y=this.cachePos;return this.cachePos+=r,this.wasmBackend.forwardSegment(t,s,a,y)}let u=this.arch.heads,d=this.arch.kvHeads,g=this.arch.headDim,f=this.arch.hidden,I=this.arch.intermediate,k=this.arch.rope.rotaryDim,i=this.scratch;this.uniformCursor=0;let _=new Map,b=new Uint32Array(t);this.device.queue.writeBuffer(this.tokensBuf,0,b);let m=this.device.createCommandEncoder(),P=m.beginComputePass(),A=this.weights.get("token_embd.weight"),H=A.type===te.Q1_0?0:A.type===te.PQ2_0?1:A.type===te.PTQ1_0?2:A.type===te.Q4_0?3:A.type===te.Q4_1?4:A.type===te.Q4_K?5:6,$=i.curH,K=i.nextH;for(let y of A.chunks){let U=this.mkUniform([f,H,r,y.rowStart,y.rowCount,0,0,0]);this.dispatch(P,"embed_gather",U,[this.tokensBuf,y.quants,y.scales16,$],Math.ceil(f/256),r)}this.arch.hadamard?.inverseWeights.has("token_embd.weight")&&(this.runHadamard(P,$,K,r,f,1),[$,K]=[K,$]);for(let y=0;y<this.arch.layers;y++){if(this.runRmsNorm(P,$,`blk.${y}.attn_norm.weight`,r,f,i.n1),_.clear(),this.arch.archName==="plamo3"){let F=u*g,S=d*g;this.runMatmul(P,`blk.${y}.attn_qkv.weight`,i.n1,r,i.qkvMixed,null,_);let p=this.mkUniform([r,F,S,0]);this.dispatch(P,"split_qkv",p,[i.qkvMixed,i.qBuf,i.kBuf,i.vBuf],Math.ceil(r*(F+2*S)/256)),this.runRmsNorm(P,i.qBuf,`blk.${y}.attn_q_norm.weight`,r*u,g,i.qNormed),this.runRmsNorm(P,i.kBuf,`blk.${y}.attn_k_norm.weight`,r*d,g,i.kNormed);let O=!!(this.arch.swa&&this.arch.swa.layerTypes[y]==="swa"),v=O&&this.swaCosBuf?this.swaCosBuf:this.cosBuf,h=O&&this.swaSinBuf?this.swaSinBuf:this.sinBuf,B=O&&this.arch.swa?this.arch.swa.windowSize:0,T=this.mkUniform([r,u,g,k,this.cachePos,0,0,0]),R=this.mkUniform([r,d,g,k,this.cachePos,0,0,0]);this.dispatch(P,"rope",T,[v,h,i.qNormed],Math.ceil(r*u*(k>>1)/64)),this.dispatch(P,"rope",R,[v,h,i.kNormed],Math.ceil(r*d*(k>>1)/64));let j=this.mkUniform([r,d,g,this.cachePos]),ie=r*d*(g>>5),Y=this.kCacheQ.get(y),he=this.kCacheS.get(y),Oe=this.vCacheQ.get(y),De=this.vCacheS.get(y);this.dispatch(P,"kv_append_q8",j,[i.kNormed,Y,he],ie),this.dispatch(P,"kv_append_q8",j,[i.vBuf,Oe,De],ie);let Se=this.mkUniform([r,u,d,g,this.cachePos,B,0,0]);this.dispatch(P,"attention_q8",Se,[i.qNormed,Y,he,Oe,De,i.attOut],r*u),_.clear(),this.runMatmul(P,`blk.${y}.attn_output.weight`,i.attOut,r,i.n1,null,_),this.runRmsNorm(P,i.n1,`blk.${y}.post_attention_norm`,r,f,i.n2);let ue=this.mkUniform([r*f,0,0,0]);this.dispatch(P,"add_inplace",ue,[$,i.n2,i.h2],Math.ceil(r*f/256)),this.runRmsNorm(P,i.h2,`blk.${y}.ffn_norm.weight`,r,f,i.n1),_.clear(),this.runMatmul(P,`blk.${y}.ffn_up.weight`,i.n1,r,i.mlpGate,null,_);let be=this.mkUniform([r,I,0,0]);this.dispatch(P,"swiglu_fused",be,[i.mlpGate,i.swigluOut],Math.ceil(r*I/256)),_.clear(),this.runMatmul(P,`blk.${y}.ffn_down.weight`,i.swigluOut,r,i.n1,null,_),this.runRmsNorm(P,i.n1,`blk.${y}.post_ffw_norm`,r,f,i.n2),this.dispatch(P,"add_inplace",ue,[i.h2,i.n2,K],Math.ceil(r*f/256)),[$,K]=[K,$];continue}if(this.arch.hybrid&&this.arch.hybrid.layerTypes[y]==="linear"&&this.arch.hybrid){let F=this.arch.hybrid,S=F.linearKeyHeads,p=F.linearValueHeads,O=F.linearHeadDim,v=S*O,h=p*O,B=v*2+h,T=F.convKernel,R=this.cachePos>0?1:0,j=this.ssmParity;this.runMatmul(P,`blk.${y}.attn_qkv.weight`,i.n1,r,i.qkvMixed,null,_),this.runMatmul(P,`blk.${y}.attn_gate.weight`,i.n1,r,i.zGate,null,_);let ie=this.weights.get(`blk.${y}.ssm_conv1d.weight`).f32Buf,Y=this.ssmConvState.get(y),he=this.mkUniform([r,B,T,R]),Oe=r*B+(T-1)*B,De=Math.ceil(Oe/64),Se=Math.min(De,65535),ue=Math.ceil(De/Se);this.dispatch(P,"conv1d_causal",he,[i.qkvMixed,ie,Y[j],i.qkvConv,Y[j^1]],Se,ue),this.runMatmul(P,`blk.${y}.ssm_alpha.weight`,i.n1,r,i.aProj,null,_),this.runMatmul(P,`blk.${y}.ssm_beta.weight`,i.n1,r,i.bProj,null,_);let be=this.weights.get(`blk.${y}.ssm_a`).f32Buf,Le=this.weights.get(`blk.${y}.ssm_dt.bias`).f32Buf,ye=this.mkUniform([r,p,0,0]);this.dispatch(P,"deltanet_gbeta",ye,[i.aProj,i.bProj,be,Le,i.gbeta],Math.ceil(r*p/64));let we=this.ssmRecState.get(y),Re=this.mkUniform([r,p,O,O,S,R,0,0]);this.dispatch(P,"deltanet_recur",Re,[i.qkvConv,i.gbeta,we[j],i.core,we[j^1]],p);let He=this.weights.get(`blk.${y}.ssm_norm.weight`).f32Buf,Je=this.mkUniform([r*p,O,this.arch.rmsEps,0],new Set([2]));this.dispatch(P,"deltanet_norm_gate",Je,[i.core,i.zGate,He,i.normed],r*p),_.clear(),this.runMatmul(P,`blk.${y}.ssm_out.weight`,i.normed,r,i.h2,$,_)}else{let F=this.arch.archName==="qwen35";if(F){this.runMatmul(P,`blk.${y}.attn_q.weight`,i.n1,r,i.qgBuf,null,_);let ie=this.mkUniform([r,u,g,0]);this.dispatch(P,"split_q_gate",ie,[i.qgBuf,i.qBuf,i.gateBuf],Math.ceil(r*u*g/256))}else this.runMatmul(P,`blk.${y}.attn_q.weight`,i.n1,r,i.qBuf,null,_);this.runMatmul(P,`blk.${y}.attn_k.weight`,i.n1,r,i.kBuf,null,_),this.runMatmul(P,`blk.${y}.attn_v.weight`,i.n1,r,i.vBuf,null,_),this.runRmsNorm(P,i.qBuf,`blk.${y}.attn_q_norm.weight`,r*u,g,i.qNormed),this.runRmsNorm(P,i.kBuf,`blk.${y}.attn_k_norm.weight`,r*d,g,i.kNormed);let S=this.mkUniform([r,u,g,k,this.cachePos,0,0,0]),p=this.mkUniform([r,d,g,k,this.cachePos,0,0,0]);this.dispatch(P,"rope",S,[this.cosBuf,this.sinBuf,i.qNormed],Math.ceil(r*u*(k>>1)/64)),this.dispatch(P,"rope",p,[this.cosBuf,this.sinBuf,i.kNormed],Math.ceil(r*d*(k>>1)/64));let O=this.mkUniform([r,d,g,this.cachePos]),v=r*d*(g>>5),h=this.kCacheQ.get(y),B=this.kCacheS.get(y),T=this.vCacheQ.get(y),R=this.vCacheS.get(y);this.dispatch(P,"kv_append_q8",O,[i.kNormed,h,B],v),this.dispatch(P,"kv_append_q8",O,[i.vBuf,T,R],v);let j=this.mkUniform([r,u,d,g,this.cachePos,0,0,0]);if(this.dispatch(P,"attention_q8",j,[i.qNormed,h,B,T,R,i.attOut],r*u),F){let ie=this.mkUniform([r*u*g,0,0,0]);this.dispatch(P,"sigmoid_gate",ie,[i.gateBuf,i.attOut],Math.ceil(r*u*g/256))}_.clear(),this.runMatmul(P,`blk.${y}.attn_output.weight`,i.attOut,r,i.h2,$,_)}let Q=this.arch.archName==="qwen35"?`blk.${y}.post_attention_norm.weight`:`blk.${y}.ffn_norm.weight`;this.runRmsNorm(P,i.h2,Q,r,f,i.n2),_.clear(),this.runMatmul(P,`blk.${y}.ffn_gate.weight`,i.n2,r,i.mlpGate,null,_),this.runMatmul(P,`blk.${y}.ffn_up.weight`,i.n2,r,i.mlpUp,null,_);let E=this.mkUniform([r*I,0,0,0]);this.dispatch(P,"swiglu",E,[i.mlpGate,i.mlpUp,i.swigluOut],Math.ceil(r*I/256)),_.clear(),this.runMatmul(P,`blk.${y}.ffn_down.weight`,i.swigluOut,r,K,i.h2,_),[$,K]=[K,$]}if(this.arch.hybrid&&(this.ssmParity^=1),this.cachePos+=r,!s)return P.end(),this.device.queue.submit([m.finish()]),await this.device.queue.onSubmittedWorkDone(),{};if(r>1){P.end(),m.copyBufferToBuffer($,(r-1)*f*4,i.lastHidden,0,f*4);let y=m.beginComputePass();if(this.runRmsNorm(y,i.lastHidden,"output_norm.weight",1,f,i.finalNorm),_.clear(),this.runMatmul(y,"output.weight",i.finalNorm,1,this.logitsBuf,null,_),a){let U=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(y,"argmax",U,[this.logitsBuf,this.argmaxBuf],1)}y.end()}else{if(this.runRmsNorm(P,$,"output_norm.weight",1,f,i.finalNorm),_.clear(),this.runMatmul(P,"output.weight",i.finalNorm,1,this.logitsBuf,null,_),a){let y=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(P,"argmax",y,[this.logitsBuf,this.argmaxBuf],1)}P.end()}if(a){m.copyBufferToBuffer(this.argmaxBuf,0,this.argmaxReadBuf,0,4),this.device.queue.submit([m.finish()]),await this.argmaxReadBuf.mapAsync(GPUMapMode.READ);let y=new Uint32Array(this.argmaxReadBuf.getMappedRange())[0];return this.argmaxReadBuf.unmap(),{greedyId:y}}return m.copyBufferToBuffer(this.logitsBuf,0,this.logitsReadBuf,0,this.arch.vocab*4),this.device.queue.submit([m.finish()]),await this.logitsReadBuf.mapAsync(GPUMapMode.READ),this.logitsCpu.set(new Float32Array(this.logitsReadBuf.getMappedRange())),this.logitsReadBuf.unmap(),{logits:this.logitsCpu}}async generate(t,s={}){let a,r=null;if(Array.isArray(t)&&typeof t[0]=="number")a=t;else if(typeof t=="string"){if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");a=this.tokenizer.encode(t)}else{if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");if(r=t,this.lastMessages.length>0&&r.length>this.lastMessages.length&&this.lastMessages.every((y,U)=>r[U].role===y.role&&r[U].content===y.content)){let y=r.slice(this.lastMessages.length),U=this.tokenizer.formatChat(y);a=[...this.lastTurnTokens,...this.tokenizer.encode(U)]}else{let y=this.tokenizer.formatChat(r);a=this.tokenizer.encode(y)}}if(a.length===0)throw new Error("hachiue: prompt produced 0 tokens");let u=0;for(;u<this.tokenHistory.length&&u<a.length-1&&this.tokenHistory[u]===a[u];)u++;u<this.tokenHistory.length&&(this.arch.hybrid||u===0?(this.resetCache(),u=0):(this.cachePos=u,this.tokenHistory=this.tokenHistory.slice(0,u)));let d=a.slice(u),g=s.maxNewTokens??512,f=new Set([this.arch.eosTokenId,...s.stopTokens??[]]);if(this.arch.eomTokenId!==void 0&&f.add(this.arch.eomTokenId),this.arch.eotTokenId!==void 0&&f.add(this.arch.eotTokenId),this.arch.archName==="plamo3"){let K=this.tokenizer?.tokenToId("<|plamo:eom|>");K!==void 0&&f.add(K)}let I=(s.temperature??.6)<=0&&(s.repetitionPenalty===void 0||s.repetitionPenalty===1),k=performance.now(),i=0;for(let K=0;K<d.length;K+=ge){if(s.signal?.aborted)throw new DOMException("Generation aborted","AbortError");let y=d.slice(K,K+ge),U=K+ge>=d.length,Q=await this.forwardSegment(y,U,I);this.tokenHistory.push(...y),U&&(I&&Q.greedyId!==void 0?i=Q.greedyId:Q.logits&&(i=Xt(Q.logits,this.arch.vocab,this.tokenHistory,s)))}let _=performance.now()-k,b=[],m=this.tokenizer?.createDecoderStream(!0),P=performance.now();for(let K=0;K<g&&!(s.signal?.aborted||f.has(i));K++){b.push(i);let y=m?m.push(i):"";if(s.onToken?.(i,y),K+1>=g||this.cachePos+1>this.maxSeqLen)break;let U=await this.forwardSegment([i],!0,I);this.tokenHistory.push(i),I&&U.greedyId!==void 0?i=U.greedyId:U.logits&&(i=Xt(U.logits,this.arch.vocab,this.tokenHistory,s))}let A=m?m.flush():"";A&&s.onToken?.(-1,A);let H=Math.max(1,performance.now()-P),$=this.tokenizer?this.tokenizer.decode(b,!0):"";if(r&&this.tokenizer){this.lastMessages=[...r.map(y=>({...y})),{role:"assistant",content:$}];let K=this.arch.archName==="plamo3"?"<|plamo:eom|>":`<|im_end|>
`;this.lastTurnTokens=[...a,...b,...this.tokenizer.encode(K)]}return{text:$,tokenIds:b,stats:{promptTokens:d.length,generatedTokens:b.length,prefillMs:_,decodeMs:H,prefillTokensPerSec:d.length/Math.max(1,_)*1e3,decodeTokensPerSec:b.length/H*1e3,reusedCache:u>0,backend:this.backend,isWorker:this.isWorker}}}};var Rn={en:{canonical:"en",plamoCode:"en",englishName:"English"},english:{canonical:"en",plamoCode:"en",englishName:"English"},ja:{canonical:"ja",plamoCode:"ja",englishName:"Japanese"},jp:{canonical:"ja",plamoCode:"ja",englishName:"Japanese"},japanese:{canonical:"ja",plamoCode:"ja",englishName:"Japanese"},"ja-easy":{canonical:"ja-easy",plamoCode:"ja-easy",englishName:"Easy Japanese"},zh:{canonical:"zh-CN",plamoCode:"zh-Hans",englishName:"Simplified Chinese"},"zh-cn":{canonical:"zh-CN",plamoCode:"zh-Hans",englishName:"Simplified Chinese"},"zh-hans":{canonical:"zh-CN",plamoCode:"zh-Hans",englishName:"Simplified Chinese"},"zh-tw":{canonical:"zh-TW",plamoCode:"zh-Hant",englishName:"Traditional Chinese"},"zh-hant":{canonical:"zh-TW",plamoCode:"zh-Hant",englishName:"Traditional Chinese"},ko:{canonical:"ko",plamoCode:"ko",englishName:"Korean"},korean:{canonical:"ko",plamoCode:"ko",englishName:"Korean"},es:{canonical:"es",plamoCode:"es",englishName:"Spanish"},spanish:{canonical:"es",plamoCode:"es",englishName:"Spanish"},fr:{canonical:"fr",plamoCode:"fr",englishName:"French"},french:{canonical:"fr",plamoCode:"fr",englishName:"French"},de:{canonical:"de",plamoCode:"de",englishName:"German"},german:{canonical:"de",plamoCode:"de",englishName:"German"},it:{canonical:"it",plamoCode:"it",englishName:"Italian"},italian:{canonical:"it",plamoCode:"it",englishName:"Italian"},pt:{canonical:"pt",plamoCode:"pt",englishName:"Portuguese"},"pt-br":{canonical:"pt-BR",plamoCode:"pt-BR",englishName:"Brazilian Portuguese"},ru:{canonical:"ru",plamoCode:"ru",englishName:"Russian"},ar:{canonical:"ar",plamoCode:"ar",englishName:"Arabic"},vi:{canonical:"vi",plamoCode:"vi",englishName:"Vietnamese"},th:{canonical:"th",plamoCode:"th",englishName:"Thai"},id:{canonical:"id",plamoCode:"id",englishName:"Indonesian"},nl:{canonical:"nl",plamoCode:"nl",englishName:"Dutch"},pl:{canonical:"pl",plamoCode:"pl",englishName:"Polish"},tr:{canonical:"tr",plamoCode:"tr",englishName:"Turkish"},uk:{canonical:"uk",plamoCode:"uk",englishName:"Ukrainian"},hi:{canonical:"hi",plamoCode:"hi",englishName:"Hindi"}};function at(n){let t=n.trim().toLowerCase();return Rn[t]??{canonical:n.trim(),plamoCode:n.trim(),englishName:n.trim()}}function Nr(n){return n.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/<think>[\s\S]*$/gi,"").replace(/<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>|$)/gi,"").replace(/<\|plamo:[^>]*\|>/g,"").replace(/<\|im_end\|>/g,"").trim()}function Tr(n){return Nr(n).replace(/^(?:日本語訳|翻訳|Translation)\s*[:：]\s*/i,"").trim()}function Cr(n){let t=at(n.targetLang),s=n.sourceLang?at(n.sourceLang):null,a="<|plamo:bos|><|plamo:tag|>dataset<|plamo:msg|>translation",r=[];if(n.context?.trim()&&r.push(n.context.trim()),r.length>0&&(a+=`<|plamo:tag|>context<|plamo:msg|>${r.join(`
`)}`),n.glossary&&n.glossary.length>0){let u=n.glossary.filter(d=>d.source.trim()&&d.target.trim());if(u.length>0){let d=u.map(g=>`${g.source.trim()}	${g.target.trim()}`).join(`
`);a+=`<|plamo:tag|>glossary<|plamo:msg|>${d}`}}if(n.history&&n.history.length>0)for(let u of n.history){if(!u.source.trim()||!u.translation.trim())continue;let d=u.sourceLang?at(u.sourceLang).plamoCode:s?.plamoCode,g=u.targetLang?at(u.targetLang).plamoCode:t.plamoCode;a+="<|plamo:tag|>input",d&&(a+=`<|plamo:key|>lang<|plamo:val|>${d}`),a+=`<|plamo:msg|>${u.source.trim()}`,a+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${g}<|plamo:msg|>${u.translation.trim()}`}if(a+="<|plamo:tag|>input",s&&(a+=`<|plamo:key|>lang<|plamo:val|>${s.plamoCode}`),a+=`<|plamo:msg|>${n.input}`,a+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${t.plamoCode}`,n.form&&(t.plamoCode==="ja"||t.plamoCode==="ja-easy")){let u=n.form==="polite"?"Polite":"Plain";a+=`<|plamo:key|>form<|plamo:val|>${u}`}return a+="<|plamo:msg|>",a}function Fr(n){let t=at(n.targetLang),s=n.sourceLang?at(n.sourceLang):null,a=[s?`You are a professional translator from ${s.englishName} to ${t.englishName}.`:`You are a professional translator into ${t.englishName}.`,`Output ONLY the ${t.englishName} translation of the user's text, without any introductory remarks, notes, or explanations.`];if(n.form&&(t.canonical==="ja"||t.canonical==="ja-easy")&&a.push(n.form==="polite"?"Use polite Japanese style (\u3067\u3059\u30FB\u307E\u3059\u8ABF).":"Use plain Japanese style (\u3060\u30FB\u3067\u3042\u308B\u8ABF)."),n.context?.trim()&&a.push(`Context: ${n.context.trim()}`),n.glossary&&n.glossary.length>0){let u=n.glossary.filter(d=>d.source.trim()&&d.target.trim()).map(d=>`"${d.source.trim()}" -> "${d.target.trim()}"`).join(", ");u&&a.push(`Use the following glossary terms: ${u}.`)}let r=[{role:"system",content:a.join(" ")}];if(n.history&&n.history.length>0)for(let u of n.history)u.source.trim()&&u.translation.trim()&&(r.push({role:"user",content:u.source.trim()}),r.push({role:"assistant",content:u.translation.trim()}));return r.push({role:"user",content:n.text.trim()}),r}async function _r(n,t){let s=t.text.trim();if(!s)throw new Error("hachiue: translateText requires non-empty text");let a=t.maxNewTokens??512,r=t.temperature??0,u=n.arch.archName==="plamo3",d={maxNewTokens:a,temperature:r,repetitionPenalty:t.repetitionPenalty,signal:t.signal,onToken:t.onToken},g;if(u){let I=Cr({input:s,sourceLang:t.sourceLang,targetLang:t.targetLang,context:t.context,glossary:t.glossary,form:t.form,history:t.history});g=await n.generate(I,d)}else{let I=Fr(t);g=await n.generate(I,d)}return{translation:Tr(g.text),rawText:g.text,usedContext:!!t.context?.trim(),stats:g.stats}}var Mt="https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF/resolve/0c4af2b003fdd94b6868aa955414c1c86ee96997/plamo-3-translate-0.8b-Q4_K_M.gguf",Un="plamo-3-translate-0.8b-Q4_K_M.gguf",Xn=300*1e3,At=Xn,Ze=null,et="unloaded",Dt=null,St=null,Bt=0,vt=null,fr=Promise.resolve(),kt=null;function Kt(...n){console.log("[offscreen]",...n)}function mr(...n){console.warn("[offscreen]",...n)}function gr(){vt&&(clearTimeout(vt),vt=null)}function pr(){gr(),et==="ready"&&(vt=setTimeout(()=>{Hn()},At))}async function Hn(){let n=fr;vt=null;try{await n}catch{}if(Date.now()-Bt<At){pr();return}Kt(`idle for ${At}ms \u2014 disposing engine`),await Xr();try{await chrome.runtime.sendMessage({type:"BUILTIN_IDLE_UNLOAD"})}catch(t){mr("could not notify SW for document close:",t&&t.message)}}async function Xr(){if(gr(),!Ze){et="unloaded";return}try{Ze.dispose()}catch(n){mr("engine.dispose() threw:",n&&n.message)}Ze=null,et="unloaded",St=null}function it(n){let t=fr.then(n);return fr=t.then(()=>{},()=>{}),t}function hr(){Bt=Date.now(),pr()}var Rr=0;function Ur(n){let t=Date.now();t-Rr<100&&n.phase!=="ready"||(Rr=t,chrome.runtime.sendMessage({type:"OFFSCREEN_PROGRESS",phase:n.phase??"weights",loadedBytes:n.loadedBytes??0,totalBytes:n.totalBytes??0,cached:!!n.cached}).catch(()=>{}))}async function Hr(){if(et==="ready"&&Ze)return Ze;if(kt)return kt;if(!navigator.gpu)throw new Error("WEBGPU_UNAVAILABLE: this browser cannot run the built-in model");et="loading",Dt=null,kt=(async()=>{let n=performance.now();try{Ze=await It.create({url:Mt,backend:"webgpu",maxSeqLen:2048,onProgress:Ur,onDeviceLost:t=>{mr("WebGPU device lost:",t.reason,t.message),Dt=`WebGPU device lost (${t.reason})`,et="error"}})}catch(t){throw et="error",Dt=t&&t.message||String(t),Ze=null,new Error(`LOAD_FAILED: ${Dt}`)}return St={...Ze.backendInfo},et="ready",Kt(`model loaded in ${((performance.now()-n)/1e3).toFixed(1)}s (${St.backend}${St.isWorker?" worker":""})`),Ur({phase:"ready",loadedBytes:0,totalBytes:0,cached:!0}),hr(),Ze})();try{return await kt}finally{kt=null}}function Gt(){return{state:et,lastError:Dt,backend:St,lastActivityAt:Bt,idleMs:Bt?Date.now()-Bt:null,webgpuAvailable:!!navigator.gpu,modelUrl:Mt,modelName:Un}}async function Vn(){return Gt()}async function $n(){let[n,t]=await Promise.all([sr(Mt).catch(()=>!1),Rt(Mt).catch(()=>null)]);return{cached:n,sizeBytes:t??null}}async function Wn(){return await Hr(),Gt()}async function zn(n){let t=await Hr();gr();try{let s=String(n.text??"");if(!s.trim())throw new Error("EMPTY_TEXT");let a={text:s,targetLang:n.targetLang,sourceLang:n.sourceLang&&n.sourceLang!=="auto"?n.sourceLang:void 0,form:n.form==="polite"||n.form==="plain"?n.form:void 0,glossary:Array.isArray(n.glossary)?n.glossary:void 0,context:typeof n.context=="string"?n.context:void 0},r=performance.now(),u=await _r(t,a);return hr(),{translation:u.translation,stats:{promptTokens:u.stats.promptTokens,generatedTokens:u.stats.generatedTokens,prefillTokensPerSec:u.stats.prefillTokensPerSec,decodeTokensPerSec:u.stats.decodeTokensPerSec,elapsedMs:performance.now()-r,backend:u.stats.backend}}}catch(s){throw hr(),s}}async function Kn(){return await Xr(),Gt()}async function Gn(){return await ar(Mt),Gt()}chrome.runtime.onMessage.addListener((n,t,s)=>{if(!n||n.target!=="offscreen")return!1;let a=n.type;return Kt("recv",a),(async()=>{switch(a){case"OFFSCREEN_STATUS":s({ok:!0,status:await it(Vn)});return;case"OFFSCREEN_CACHE_INFO":s({ok:!0,cache:await it($n)});return;case"OFFSCREEN_LOAD_MODEL":s({ok:!0,status:await it(Wn)});return;case"OFFSCREEN_TRANSLATE":s({ok:!0,...await it(()=>zn(n))});return;case"OFFSCREEN_UNLOAD":s({ok:!0,status:await it(Kn)});return;case"OFFSCREEN_CLEAR_CACHE":s({ok:!0,status:await it(Gn)});return;case"OFFSCREEN_SET_IDLE_TIMEOUT":{let r=Number(n.ms);Number.isFinite(r)&&r>=1e3?(At=r,pr(),s({ok:!0,idleTimeoutMs:At})):s({ok:!1,error:"ms must be >= 1000"});return}default:s({ok:!1,error:`unknown offscreen message: ${a}`})}})().catch(r=>{s({ok:!1,error:r&&r.message||String(r)})}),!0});Kt("offscreen runtime ready");
