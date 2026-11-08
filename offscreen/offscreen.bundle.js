var en=16*1024*1024,rn="hachiue-model-cache-v1",Yt="chunks";function nr(n){let r=3735928559^n.length,s=1103547991^n.length;for(let o=0;o<n.length;o++){let e=n.charCodeAt(o);r=Math.imul(r^e,2654435761),s=Math.imul(s^e,1597334677)}return r=Math.imul(r^r>>>16,2246822507)^Math.imul(s^s>>>13,3266489909),s=Math.imul(s^s>>>16,2246822507)^Math.imul(r^r>>>13,3266489909),(s>>>0).toString(16).padStart(8,"0")+(r>>>0).toString(16).padStart(8,"0")}function ne(){return new Promise((n,r)=>{let s=indexedDB.open(rn,1);s.onupgradeneeded=()=>{let o=s.result;o.objectStoreNames.contains(Yt)||o.createObjectStore(Yt)},s.onsuccess=()=>n(s.result),s.onerror=()=>r(s.error)})}async function fe(n,r){if(typeof indexedDB>"u")return;let s=r??await ne();return new Promise((o,e)=>{let _=s.transaction(Yt,"readonly").objectStore(Yt).get(n);_.onsuccess=()=>{r||s.close(),o(_.result)},_.onerror=()=>{r||s.close(),e(_.error)}})}async function nn(n,r){if(typeof indexedDB>"u")return!1;let s=r??await ne();return new Promise((o,e)=>{let _=s.transaction(Yt,"readonly").objectStore(Yt).count(n);_.onsuccess=()=>{r||s.close(),o(_.result>0)},_.onerror=()=>{r||s.close(),e(_.error)}})}async function Mr(n,r,s){if(typeof indexedDB>"u")return;let o=s??await ne();return new Promise((e,u)=>{let _=o.transaction(Yt,"readwrite");_.objectStore(Yt).put(r,n),_.oncomplete=()=>{s||o.close(),e()},_.onerror=()=>{s||o.close(),u(_.error)}})}async function sn(){if(typeof indexedDB>"u")return;let n=await ne();return new Promise((r,s)=>{let o=n.transaction(Yt,"readwrite");o.objectStore(Yt).clear(),o.oncomplete=()=>{n.close(),r()},o.onerror=()=>{n.close(),s(o.error)}})}async function Ne(){try{if(typeof navigator<"u"&&navigator.storage?.getDirectory)return await navigator.storage.getDirectory()}catch{}return null}async function Ce(n,r,s){let o=nr(n),e=await Ne();if(e)try{let _=await(await(await e.getFileHandle(`${o}.meta.json`)).getFile()).text();if(_){let g=JSON.parse(_),d=Math.min(s,g.totalSize-1);if(d>=r){let x=Math.floor(r/g.chunkBytes),P=Math.floor(d/g.chunkBytes),i=new Set(g.completedChunks),f=!0;for(let b=x;b<=P;b++)if(!i.has(b)){f=!1;break}if(f){let m=await(await e.getFileHandle(`${o}.gguf.bin`)).getFile();if(m.size>d){let y=m.slice(r,d+1);return new Uint8Array(await y.arrayBuffer())}}}}}catch{}try{let u=typeof indexedDB<"u"?await ne():null;if(!u)return null;try{let _=await fe(`meta:${o}`,u);if(!_||_.completedChunks.length===0)return null;let g=Math.min(s,_.totalSize-1);if(g<r)return null;let d=Math.floor(r/_.chunkBytes),x=Math.floor(g/_.chunkBytes),P=new Set(_.completedChunks);for(let b=d;b<=x;b++)if(!P.has(b))return null;let i=new Uint8Array(g-r+1),f=0;for(let b=d;b<=x;b++){let m=await fe(`chunk:${o}:${b}`,u);if(!m)return null;let y=b*_.chunkBytes,A=Math.max(0,r-y),H=Math.min(m.byteLength,g+1-y),V=m.subarray(A,H);i.set(V,f),f+=V.byteLength}return i}finally{u.close()}}catch{return null}}async function Te(n,r){let s=nr(n),o=await Ne();if(o)try{let u=await(await o.getFileHandle(`${s}.meta.json`)).getFile(),_=JSON.parse(await u.text());if(r&&_.totalSize!==r)return 0;let g=Math.ceil(_.totalSize/_.chunkBytes);return _.completedChunks.length===g?_.totalSize:0}catch{}try{let e=await fe(`meta:${s}`);if(!e||r&&e.totalSize!==r)return 0;let u=Math.ceil(e.totalSize/e.chunkBytes);return e.completedChunks.length===u?e.totalSize:0}catch{return 0}}async function sr(n,r){return await Te(n,r)>0}async function ar(){let n=await Ne();if(n)try{for await(let r of n.keys())typeof r=="string"&&(r.endsWith(".gguf.bin")||r.endsWith(".meta.json"))&&await n.removeEntry(r).catch(()=>{})}catch{}await sn().catch(()=>{})}async function ae(n,r,s,o,e={}){let u=e.chunkBytes??en,_=e.useCache??!0,g=e.fetchRange??Fe,d=nr(n);_&&typeof navigator<"u"&&navigator.storage?.persist?.().catch(()=>{});let x=Math.floor(r/u),P=Math.ceil(s/u),i=null,f=null,b=null,m={url:n,totalSize:s,chunkBytes:u,completedChunks:[],updatedAt:Date.now()};if(_){i=await Ne();let E=null;if(i)try{let p=await(await(await i.getFileHandle(`${d}.meta.json`)).getFile()).text();if(p){let O=JSON.parse(p);O.totalSize===s&&O.chunkBytes===u&&(E=O)}}catch{}let F=null;try{if(typeof indexedDB<"u"){b=await ne();let S=await fe(`meta:${d}`,b);S&&S.totalSize===s&&S.chunkBytes===u&&(F=S)}}catch{}if(F&&(!E||F.completedChunks.length>E.completedChunks.length))m=F,i=null;else if(i)try{let S=await i.getFileHandle(`${d}.gguf.bin`,{create:!0});typeof S.createWritable=="function"?(f=await S.getFile(),E&&(m=E)):(i=null,F&&(m=F))}catch{i=null,F&&(m=F)}}let y=new Set(m.completedChunks),A=!1,H=async()=>{if(A){if(A=!1,m.completedChunks=Array.from(y),m.updatedAt=Date.now(),i)try{let F=await(await i.getFileHandle(`${d}.meta.json`,{create:!0})).createWritable();await F.write(JSON.stringify(m)),await F.close();return}catch{}await Mr(`meta:${d}`,m,b).catch(()=>{})}},V=0,K=s-r,I=(E,F)=>{E>V&&(V=E),e.onProgress?.({phase:"weights",loadedBytes:Math.min(V,K),totalBytes:K,cached:F})},U=async E=>{if(e.signal?.aborted)throw new DOMException("Model loading aborted","AbortError");let F=E*u,S=Math.min(s,F+u),p=S-F,O=null,v=!1;if(_&&y.has(E)){if(i&&f&&f.size>=S)if(!o)O=new Uint8Array(0),v=!0;else try{let B=f.slice(F,S);O=new Uint8Array(await B.arrayBuffer()),v=!0}catch{O=null}if(!O)try{if(!o)await nn(`chunk:${d}:${E}`,b)&&(O=new Uint8Array(0),v=!0);else{let B=await fe(`chunk:${d}:${E}`,b);B&&B.byteLength===p&&(O=B,v=!0)}}catch{O=null}}let h=E===0?Ar(n):null;if(!O){let B=Math.max(0,F-r);if(h&&h.byteLength>0&&h.byteLength<=p)if(h.byteLength===p)O=h;else{let C=h.byteLength,R=await g(n,C,S-1,e.signal,it=>{let Y=Math.max(0,C+it-r);Y>B&&I(Y,!1)}),j=new Uint8Array(p);j.set(h,0),j.set(R,C),O=j}else O=await g(n,F,S-1,e.signal,C=>{let R=Math.max(0,F+C-r);R>B&&I(R,!1)});if(O.byteLength!==p)throw new Error(`hachiue: chunk ${E} returned ${O.byteLength} bytes, expected ${p}`)}return{ci:E,chunkStart:F,chunkEndExclusive:S,data:O,fromCache:v}},Q=async(E,F,S)=>{if(_){if(i){let p=null;try{p=await(await i.getFileHandle(`${d}.gguf.bin`,{create:!0})).createWritable({keepExistingData:!0}),await p.write({type:"write",position:F,data:S}),await p.close(),p=null,y.add(E),A=!0,((E&3)===0||E===P-1)&&await H();return}catch{p&&await p.close().catch(()=>{}),await i.removeEntry(`${d}.gguf.bin`).catch(()=>{}),await i.removeEntry(`${d}.meta.json`).catch(()=>{}),i=null}}if(!i)try{!b&&typeof indexedDB<"u"&&(b=await ne()),await Mr(`chunk:${d}:${E}`,S,b),y.add(E),A=!0,((E&3)===0||E===P-1)&&await H()}catch{}}};try{let E=x<P?U(x):null;for(let F=x;F<P;F++){let S=await E;E=F+1<P?U(F+1):null,E?.catch(()=>{});let p=Math.max(0,r-S.chunkStart),O=o&&p>0?S.data.subarray(p):S.data;await Promise.all([S.fromCache?Promise.resolve():Q(F,S.chunkStart,S.data),o?o(O,S.chunkStart+p):S.fromCache?Promise.resolve():new Promise(v=>setTimeout(v,0))]),S.data=null,I(S.chunkEndExclusive-r,S.fromCache)}}finally{await H().catch(()=>{}),b&&b.close()}}async function or(n,r={}){let s=await he(n,r);return await ae(n,0,s.totalFileSize,null,{...r,useCache:!0}),s}var et;(function(n){n[n.F32=0]="F32",n[n.F16=1]="F16",n[n.Q4_0=2]="Q4_0",n[n.Q4_1=3]="Q4_1",n[n.Q8_0=8]="Q8_0",n[n.Q4_K=12]="Q4_K",n[n.Q6_K=14]="Q6_K",n[n.Q1_0=41]="Q1_0",n[n.Q2_0=42]="Q2_0",n[n.PQ2_0=142]="PQ2_0",n[n.PTQ1_0=143]="PTQ1_0"})(et||(et={}));var me=null;function Ar(n){if(me&&me.url===n){let r=me.bytes;return me=null,r}return null}var an=1179993927,on=32,un=2*1024*1024,ir=32*1024*1024,ge=class extends Error{constructor(){super("GGUF header buffer truncated")}};function se(n){switch(n){case et.F32:return[1,4];case et.F16:return[1,2];case et.Q4_0:return[32,18];case et.Q4_1:return[32,20];case et.Q8_0:return[32,34];case et.Q4_K:return[256,144];case et.Q6_K:return[256,210];case et.Q1_0:return[128,18];case et.Q2_0:return[64,18];case et.PQ2_0:return[128,34];case et.PTQ1_0:return[128,28];default:throw new Error(`hachiue: unsupported GGML tensor type ${n}`)}}function Lr(n,r){let[s,o]=se(r),e=n.reduce((u,_)=>u*_,1);if(e%s!==0)throw new Error(`hachiue: tensor elements (${e}) not divisible by block size (${s})`);return e/s*o}function pe(n){let r=n&32768?-1:1,s=n>>10&31,o=n&1023;return s===0?r*o*2**-24:s===31?o?NaN:r*(1/0):r*(1024+o)*2**(s-25)}function qr(n){let r=new DataView(n.buffer,n.byteOffset,n.byteLength),s=new TextDecoder,o=0,e=v=>{if(o+v>n.byteLength)throw new ge},u=()=>(e(1),r.getUint8(o++)),_=()=>(e(1),r.getInt8(o++)),g=()=>{e(2);let v=r.getUint16(o,!0);return o+=2,v},d=()=>{e(2);let v=r.getInt16(o,!0);return o+=2,v},x=()=>{e(4);let v=r.getUint32(o,!0);return o+=4,v},P=()=>{e(4);let v=r.getInt32(o,!0);return o+=4,v},i=()=>{e(4);let v=r.getFloat32(o,!0);return o+=4,v},f=()=>{e(8);let v=r.getFloat64(o,!0);return o+=8,v},b=()=>{e(8);let v=r.getUint32(o,!0),h=r.getUint32(o+4,!0);return o+=8,h*4294967296+v},m=()=>{e(8);let v=r.getUint32(o,!0),h=r.getInt32(o+4,!0);return o+=8,h*4294967296+v},y=()=>{let v=b();e(v);let h=s.decode(n.subarray(o,o+v));return o+=v,h},A=v=>{switch(v){case 0:return u();case 1:return _();case 2:return g();case 3:return d();case 4:return x();case 5:return P();case 6:return i();case 7:return u()!==0;case 8:return y();case 9:{let h=x(),B=b(),C=new Array(B);for(let R=0;R<B;R++)C[R]=A(h);return C}case 10:return b();case 11:return m();case 12:return f();default:throw new Error(`hachiue: unknown GGUF metadata value type ${v}`)}};if(x()!==an)throw new Error("hachiue: invalid GGUF magic header");let H=x();if(H!==2&&H!==3)throw new Error(`hachiue: unsupported GGUF version ${H}`);let V=b(),K=b(),I={};for(let v=0;v<K;v++){let h=y(),B=x();I[h]=A(B)}let U=[];for(let v=0;v<V;v++){let h=y(),B=x(),C=[];for(let it=0;it<B;it++)C.push(b());let R=x(),j=b();U.push({name:h,dims:C,type:R,relOffset:j})}let Q=Number(I["general.alignment"]??on),E=Math.ceil(o/Q)*Q,F={},S=E;for(let v of U){let h=Lr(v.dims,v.type),B=E+v.relOffset;F[v.name]={name:v.name,dims:v.dims,type:v.type,relOffset:v.relOffset,absOffset:B,byteLength:h},B+h>S&&(S=B+h)}let p=cn(I,F),O=ln(I);return{version:H,tensorCount:V,kvCount:K,dataStartOffset:E,totalFileSize:S,meta:I,tensors:F,arch:p,tokenizer:O}}function cn(n,r){let s=String(n["general.architecture"]??"");if(s!=="qwen3"&&s!=="qwen35"&&s!=="plamo3")throw new Error(`hachiue: unsupported model architecture "${s}" (expected "qwen3", "qwen35", or "plamo3")`);let o=h=>n[`${s}.${h}`],e=h=>{let B=o(h);if(B===void 0)throw new Error(`hachiue: missing required GGUF metadata ${s}.${h}`);return Number(B)},u=e("block_count"),_=e("embedding_length"),g=e("feed_forward_length"),d=e("attention.head_count"),x=e("attention.head_count_kv"),P=Number(o("attention.key_length")??_/d),i=e("attention.layer_norm_rms_epsilon"),f=e("context_length"),b=r["token_embd.weight"];if(!b)throw new Error("hachiue: missing token_embd.weight tensor");let m=b.dims[1],y=!("output.weight"in r),A=Number(n["tokenizer.ggml.eos_token_id"]??151645),H=n["tokenizer.ggml.eom_token_id"]!==void 0?Number(n["tokenizer.ggml.eom_token_id"]):void 0,V=n["tokenizer.ggml.eot_token_id"]!==void 0?Number(n["tokenizer.ggml.eot_token_id"]):void 0,K=n["tokenizer.ggml.bos_token_id"]!==void 0?Number(n["tokenizer.ggml.bos_token_id"]):void 0,I=n["tokenizer.ggml.padding_token_id"]!==void 0?Number(n["tokenizer.ggml.padding_token_id"]):void 0,U=Number(o("rope.freq_base")??1e6),Q=o("rope.freq_base_swa")!==void 0?Number(o("rope.freq_base_swa")):void 0,E=String(o("rope.scaling.type")??"none"),F=Number(o("rope.dimension_count")??P),S={theta:U,localTheta:Q,type:E==="yarn"?"yarn":s==="qwen35"?"mrope":"normal",factor:Number(o("rope.scaling.factor")??1),originalMaxPositions:Number(o("rope.scaling.original_context_length")??f),rotaryDim:F,yarnBetaFast:o("rope.scaling.yarn_beta_fast")!==void 0?Number(o("rope.scaling.yarn_beta_fast")):void 0,yarnBetaSlow:o("rope.scaling.yarn_beta_slow")!==void 0?Number(o("rope.scaling.yarn_beta_slow")):void 0,yarnTruncate:o("rope.scaling.yarn_truncate")!==void 0?!!o("rope.scaling.yarn_truncate"):void 0},p;if(s==="plamo3"&&o("attention.sliding_window")!==void 0){let h=Number(o("attention.sliding_window")),B=Number(o("attention.sliding_window_pattern")??8),C=[];for(let R=0;R<u;R++)C.push((R+1)%B===0?"full":"swa");p={windowSize:h,pattern:B,layerTypes:C}}let O;if(s==="qwen35"){let h=e("full_attention_interval"),B=e("ssm.group_count"),C=e("ssm.time_step_rank"),R=e("ssm.state_size"),j=e("ssm.conv_kernel"),it=[];for(let Y=0;Y<u;Y++)it.push(Y%h===h-1?"full":"linear");O={layerTypes:it,linearKeyHeads:B,linearValueHeads:C,linearHeadDim:R,convKernel:j}}let v;if(n["prism.hadamard.version"]!==void 0){let h=Number(n["prism.hadamard.version"]),B=Number(n["prism.hadamard.block_size"]??512),C=!!(n["prism.hadamard.tied_output"]??!1),R=!!(n["prism.hadamard.gdn_v_grouped"]??!1),j=String(n["prism.hadamard.sign_mode"]??"identity"),it=n["prism.hadamard.weight_names"]??[],Y=n["prism.hadamard.inverse_weight_names"]??[],ht=new Map;if(j==="explicit"){let Dt=n["prism.hadamard.sign_widths"]??[],St=n["prism.hadamard.sign_values"]??[],ut=0;for(let bt of Dt){let Lt=new Int8Array(bt);for(let Ot=0;Ot<bt;Ot++)Lt[Ot]=St[ut+Ot];ht.set(bt,Lt),ut+=bt}}let yt=new Set(it);C&&Y.includes("token_embd.weight")&&yt.add("output.weight"),v={version:h,blockSize:B,tiedOutput:C,gdnVGrouped:R,signMode:j,signsByWidth:ht,foldedWeights:yt,inverseWeights:new Set(Y)}}return{archName:s,modelName:String(n["general.name"]??s),sizeLabel:String(n["general.size_label"]??""),layers:u,hidden:_,intermediate:g,heads:d,kvHeads:x,headDim:P,rmsEps:i,maxPositions:f,vocab:m,eosTokenId:A,eomTokenId:H,eotTokenId:V,bosTokenId:K,padTokenId:I,tieWordEmbeddings:y,rope:S,hybrid:O,swa:p,hadamard:v}}function ln(n){let r=n["tokenizer.ggml.tokens"];if(!r)return;let s=String(n["tokenizer.ggml.model"]??"gpt2"),o=n["tokenizer.ggml.merges"]??[],e=n["tokenizer.ggml.scores"];if(!(s!=="plamo3"&&o.length===0&&!e))return{model:s,tokens:r,scores:e,tokenTypes:n["tokenizer.ggml.token_type"],merges:o,eosTokenId:Number(n["tokenizer.ggml.eos_token_id"]??151645),eomTokenId:n["tokenizer.ggml.eom_token_id"]!==void 0?Number(n["tokenizer.ggml.eom_token_id"]):void 0,eotTokenId:n["tokenizer.ggml.eot_token_id"]!==void 0?Number(n["tokenizer.ggml.eot_token_id"]):void 0,bosTokenId:n["tokenizer.ggml.bos_token_id"]!==void 0?Number(n["tokenizer.ggml.bos_token_id"]):void 0,padTokenId:n["tokenizer.ggml.padding_token_id"]!==void 0?Number(n["tokenizer.ggml.padding_token_id"]):void 0,addBosToken:!!(n["tokenizer.ggml.add_bos_token"]??!1),chatTemplate:n["tokenizer.chat_template"],breakAroundConsecutiveSpacesThreshold:n["tokenizer.ggml.break_around_consecutive_spaces_threshold"]!==void 0?Number(n["tokenizer.ggml.break_around_consecutive_spaces_threshold"]):void 0,breakAroundRepeatedCharsThreshold:n["tokenizer.ggml.break_around_repeated_chars_threshold"]!==void 0?Number(n["tokenizer.ggml.break_around_repeated_chars_threshold"]):void 0}}async function Fe(n,r,s,o,e){let u=s-r+1,_=await fetch(n,{headers:{Range:`bytes=${r}-${s}`},signal:o});if(_.status===206){if(_.body&&e){let d=_.body.getReader(),x=new Uint8Array(u),P=0,i=0;try{for(;P<u;){let{done:f,value:b}=await d.read();if(f)break;let m=Math.min(b.byteLength,u-P);x.set(b.subarray(0,m),P),P+=m,(P-i>=512*1024||P===u)&&(i=P,e(P))}}finally{d.releaseLock()}return P===u?x:x.subarray(0,P)}let g=await _.arrayBuffer();return e?.(g.byteLength),new Uint8Array(g)}if(_.ok&&_.body){let g=_.body.getReader(),d=new Uint8Array(u),x=0,P=0;try{for(;P<u;){let{done:i,value:f}=await g.read();if(i)break;if(x+f.byteLength>r){let b=Math.max(0,r-x),m=Math.min(f.byteLength,b+(u-P));d.set(f.subarray(b,m),P),P+=m-b}x+=f.byteLength}}finally{await g.cancel().catch(()=>{})}return d.subarray(0,P)}throw new Error(`hachiue: HTTP Range fetch failed (${_.status} ${_.statusText}) for ${n}`)}async function he(n,r={}){let s=r.fetchRange??Fe,o=r.useCache??!0;r.onProgress?.({phase:"header",message:"Fetching GGUF header..."});let e=async(x,P)=>{if(o&&!r.fetchRange){let i=await Ce(n,x,P);if(i)return i}return s(n,x,P,r.signal)},u=un,_=!1,g=null;o&&!r.fetchRange&&(g=await Ce(n,0,u-1)),g||(g=await s(n,0,u-1,r.signal),_=!0);let d=new Uint8Array(g);for(;;)try{let x=qr(d);return _&&o&&(me={url:n,bytes:d}),x}catch(x){if(!(x instanceof ge))throw x;if(d.byteLength<u)throw new Error(`hachiue: GGUF file at ${n} is truncated inside the header (${d.byteLength} bytes)`);if(u>=ir)throw new Error(`hachiue: GGUF header exceeds ${ir} bytes`);let P=Math.min(u*2,ir),i=await e(d.byteLength,P-1),f=new Uint8Array(d.byteLength+i.byteLength);f.set(d,0),f.set(i,d.byteLength),d=f,u=P}}var ur={embed_gather:`
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
`};function Re(n,r,s,o={}){let e=o.temperature??.6,u=o.topK??20,_=o.topP??.95,g=o.minP??0,d=o.repetitionPenalty??1;if(d!==1&&s.length>0){let S=new Set(s.slice(-128));for(let p of S)if(p>=0&&p<r){let O=n[p];n[p]=O<0?O*d:O/d}}if(e<=0){let S=0,p=n[0];for(let O=1;O<r;O++)n[O]>p&&(p=n[O],S=O);return S}let x=Math.max(1,Math.min(u>0?u:64,r)),P=new Int32Array(x).fill(-1),i=new Float32Array(x).fill(-1/0),f=0,b=-1/0;for(let S=0;S<r;S++){let p=n[S];if(p>b){P[f]=S,i[f]=p,f=0,b=i[0];for(let O=1;O<x;O++)i[O]<b&&(b=i[O],f=O)}}let m=Array.from({length:x},(S,p)=>p).filter(S=>P[S]>=0).sort((S,p)=>i[p]-i[S]);if(m.length===0)return 0;if(m.length===1)return P[m[0]];let y=i[m[0]],A=1/e,H=new Float32Array(m.length),V=0;for(let S=0;S<m.length;S++){let p=Math.exp((i[m[S]]-y)*A);H[S]=p,V+=p}for(let S=0;S<H.length;S++)H[S]/=V;let K=H[0],I=g*K,U=0,Q=H.length;for(let S=0;S<H.length;S++){if(S>0&&H[S]<I){Q=S;break}if(U+=H[S],U>=_){Q=S+1;break}}let E=0;for(let S=0;S<Q;S++)E+=H[S];let F=Math.random()*E;for(let S=0;S<Q;S++)if(F-=H[S],F<=0)return P[m[S]];return P[m[Q-1]]}function dn(){let n=[];for(let u=33;u<=126;u++)n.push(u);for(let u=161;u<=172;u++)n.push(u);for(let u=174;u<=255;u++)n.push(u);let r=[...n],s=0;for(let u=0;u<256;u++)n.includes(u)||(n.push(u),r.push(256+s),s++);let o=new Array(256),e=new Map;for(let u=0;u<256;u++){let _=String.fromCodePoint(r[u]);o[n[u]]=_,e.set(_,n[u])}return{byteToChar:o,charToByte:e}}var{byteToChar:_n,charToByte:fn}=dn(),hn=new RegExp("(?:'[sSdDmMtT]|'[rR][eE]|'[vV][eE]|'[lL][lL])|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+","gu"),Ue=-2e7,mn=-1e7,Xe="\uEE00",gn=60928,Er=1e7,be=class{model;tokens;tokenToIdMap;mergeRanks;specialTokens;specialTokenIds;specialRegex;isPlamo3;unigramRoot;byteTokenIds;plamoSpRegex;plamoBoundaryRegex;addBosToken;eosTokenId;eomTokenId;eotTokenId;bosTokenId;padTokenId;constructor(r){this.model=r.model??"gpt2",this.isPlamo3=this.model==="plamo3",this.tokens=r.tokens,this.addBosToken=r.addBosToken,this.eosTokenId=r.eosTokenId,this.eomTokenId=r.eomTokenId,this.eotTokenId=r.eotTokenId,this.bosTokenId=r.bosTokenId,this.padTokenId=r.padTokenId,this.tokenToIdMap=new Map,this.specialTokens=[],this.specialTokenIds=new Set;for(let s=0;s<r.tokens.length;s++){let o=r.tokens[s];this.tokenToIdMap.set(o,s);let e=r.tokenTypes?.[s];this.isPlamo3?(e===2||e===3)&&(this.specialTokens.push(o),this.specialTokenIds.add(s)):(e!==void 0&&e!==1||o.startsWith("<")&&o.endsWith(">")&&o.length>2)&&(o.startsWith("[PAD")||(this.specialTokens.push(o),this.specialTokenIds.add(s)))}if(this.isPlamo3){this.specialRegex=null,this.mergeRanks=new Map;let s={children:new Map,tokenId:-1,score:Ue},o=new Int32Array(256),e=r.scores??[],u=r.tokenTypes??[];for(let x=0;x<r.tokens.length;x++){let P=r.tokens[x];if((u[x]??1)===6&&P.length===6&&P.startsWith("<0x")&&P.endsWith(">")){let m=Number.parseInt(P.slice(3,5),16);!Number.isNaN(m)&&m>=0&&m<256&&(o[m]=x);continue}let f=s;for(let m=0;m<P.length;){let y=P.codePointAt(m);m+=y>65535?2:1;let A=f.children.get(y);A||(A={children:new Map,tokenId:-1,score:Ue},f.children.set(y,A)),f=A}f.tokenId=x;let b=e[x]??0;f.score=Number.isFinite(b)?Math.round(b*1e4):Ue}s.children.set(gn,{children:new Map,tokenId:Er,score:0}),this.unigramRoot=s,this.byteTokenIds=o,this.plamoSpRegex=/(<\|plamo:[^|\s]{0,64}\|>)/g;let _=r.breakAroundConsecutiveSpacesThreshold??2,g=r.breakAroundRepeatedCharsThreshold??4,d=[];g>1&&d.push(`(.)\\2{${g-1},}`),_>1&&d.push(` {${_},}`),this.plamoBoundaryRegex=d.length>0?new RegExp(`(${d.join("|")})`,"gu"):null}else{if(this.unigramRoot=null,this.byteTokenIds=null,this.plamoSpRegex=null,this.plamoBoundaryRegex=null,this.specialTokens.sort((s,o)=>o.length-s.length),this.specialTokens.length>0){let s=this.specialTokens.map(o=>o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));this.specialRegex=new RegExp(`(${s.join("|")})`,"g")}else this.specialRegex=null;this.mergeRanks=new Map;for(let s=0;s<r.merges.length;s++)this.mergeRanks.set(r.merges[s],s)}}getTokenId(r){return this.tokenToIdMap.get(r)}bpe(r){let s=this.tokenToIdMap.get(r);if(s!==void 0&&r.length<=1)return[s];let o=Array.from(r);for(;o.length>1;){let u=1/0,_=-1;for(let i=0;i<o.length-1;i++){let f=`${o[i]} ${o[i+1]}`,b=this.mergeRanks.get(f);b!==void 0&&b<u&&(u=b,_=i)}if(_===-1)break;let g=o[_],d=o[_+1],x=[],P=0;for(;P<o.length;)P<o.length-1&&o[P]===g&&o[P+1]===d?(x.push(g+d),P+=2):(x.push(o[P]),P++);o=x}let e=[];for(let u of o){let _=this.tokenToIdMap.get(u);_!==void 0&&e.push(_)}return e}encodePlainSegment(r){if(!r)return[];let s=new TextEncoder,o=[],e=r.match(hn)??[r];for(let u of e){let _=s.encode(u),g="";for(let d=0;d<_.length;d++)g+=_n[_[d]];o.push(...this.bpe(g))}return o}encodePlamo3(r){if(!r||!this.unigramRoot||!this.byteTokenIds)return[];let s=r;this.plamoSpRegex&&(s=s.replace(this.plamoSpRegex,`${Xe}$1${Xe}`)),this.plamoBoundaryRegex&&(s=s.replace(this.plamoBoundaryRegex,`${Xe}$1${Xe}`));let o=[];for(let m=0;m<s.length;){let y=s.codePointAt(m);o.push(y),m+=y>65535?2:1}let e=o.length,u=new Float64Array(e+1);u.fill(1e18),u[e]=0;let _=new Int32Array(e+1),g=new Int32Array(e+1);g.fill(-1);let d=[],x=[],P=[];for(let m=e-1;m>=0;m--){d.length=0,x.length=0,P.length=0;let y=this.unigramRoot,A=m;for(;A<e&&(y=y.children.get(o[A]),!!y);)A++,y.score>Ue&&(d.push(A-m),x.push(y.tokenId),P.push(y.score));let H=1e18,V=1,K=-1;for(let U=d.length-1;U>=0;U--){let Q=d[U],E=u[m+Q]-P[U];E<H&&(H=E,V=Q,K=x[U])}let I=u[m+1]-mn;I<H&&(H=I,V=1,K=-1),u[m]=H,_[m]=V,g[m]=K}let i=new TextEncoder,f=[],b=0;for(;b<e;){let m=g[b];if(m>=0)m!==Er&&f.push(m);else{let y=i.encode(String.fromCodePoint(o[b]));for(let A=0;A<y.length;A++)f.push(this.byteTokenIds[y[A]])}b+=_[b]}return f}encode(r){if(!r)return[];if(this.isPlamo3)return this.encodePlamo3(r);if(!this.specialRegex)return this.encodePlainSegment(r);let s=[],o=0;this.specialRegex.lastIndex=0;let e;for(;(e=this.specialRegex.exec(r))!==null;){e.index>o&&s.push(...this.encodePlainSegment(r.slice(o,e.index)));let u=this.tokenToIdMap.get(e[0]);u!==void 0?s.push(u):s.push(...this.encodePlainSegment(e[0])),o=this.specialRegex.lastIndex}return o<r.length&&s.push(...this.encodePlainSegment(r.slice(o))),s}decode(r,s=!0){let o=[],e=new TextEncoder;for(let u of r){if(s&&this.specialTokenIds.has(u))continue;let _=this.tokens[u];if(_!==void 0)if(this.isPlamo3){if(_.length===6&&_.startsWith("<0x")&&_.endsWith(">")){let d=Number.parseInt(_.slice(3,5),16);if(!Number.isNaN(d)){o.push(d);continue}}let g=e.encode(_);for(let d=0;d<g.length;d++)o.push(g[d])}else if(this.specialTokenIds.has(u)){let g=e.encode(_);for(let d of g)o.push(d)}else for(let g of _){let d=fn.get(g);if(d!==void 0)o.push(d);else{let x=e.encode(g);for(let P of x)o.push(P)}}}return new TextDecoder("utf-8",{fatal:!1}).decode(new Uint8Array(o))}createDecoderStream(r=!0){let s=[],o=0;return{push:e=>{s.push(e);let u=this.decode(s,r),_=u.length;for(;_>o&&u.charCodeAt(_-1)===65533;)_--;let g=u.slice(o,_);return o=_,g},flush:()=>{if(s.length===0)return"";let e=this.decode(s,r),u=e.slice(o);return o=e.length,u}}}tokenToId(r){return this.tokenToIdMap.get(r)}formatChat(r,s={}){if(this.isPlamo3){let _=s.targetLang??"ja",d=`${this.bosTokenId!==void 0?this.tokens[this.bosTokenId]??"<|plamo:bos|>":"<|plamo:bos|>"}<|plamo:tag|>dataset<|plamo:msg|>translation`,x=r.filter(f=>f.role!=="system"),P=r.find(f=>f.role==="system");P?.content?.trim()&&(d+=`<|plamo:tag|>context<|plamo:msg|>${P.content.trim()}`);for(let f=0;f<x.length-1;f++){let b=x[f];b.role==="user"?(d+="<|plamo:tag|>input",s.sourceLang&&(d+=`<|plamo:key|>lang<|plamo:val|>${s.sourceLang}`),d+=`<|plamo:msg|>${b.content}`):d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${_}<|plamo:msg|>${b.content}`}let i=x[x.length-1];return i&&(d+="<|plamo:tag|>input",s.sourceLang&&(d+=`<|plamo:key|>lang<|plamo:val|>${s.sourceLang}`),d+=`<|plamo:msg|>${i.content}<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${_}<|plamo:msg|>`),d}let o=s.addGenerationPrompt??!0,e=s.enableThinking??!1,u="";for(let _ of r)_.role==="assistant"&&!e&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")&&!_.content.startsWith("<think>")?u+=`<|im_start|>assistant
<think>

</think>

${_.content}<|im_end|>
`:u+=`<|im_start|>${_.role}
${_.content}<|im_end|>
`;return o&&(u+=`<|im_start|>assistant
`,!e&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")?u+=`<think>

</think>

`:e&&this.tokenToIdMap.has("<think>")&&(u+=`<think>
`)),u}};function Xt(n){let r=[],s=n>>>0;do{let o=s&127;s>>>=7,s!==0&&(o|=128),r.push(o)}while(s!==0);return r}function pn(n){let r=[],s=n|0,o=!0;for(;o;){let e=s&127;s>>=7,s===0&&(e&64)===0||s===-1&&(e&64)!==0?o=!1:e|=128,r.push(e)}return r}function bn(n){let r=new ArrayBuffer(4);return new DataView(r).setFloat32(0,n,!0),Array.from(new Uint8Array(r))}function Ut(n){let r=new ArrayBuffer(16),s=new DataView(r);for(let o=0;o<8;o++)s.setInt16(o*2,n,!0);return[253,...Xt(12),...new Uint8Array(r)]}function w(n,...r){return[253,...Xt(n),...r]}function nt(n,r,s=0){return[253,...Xt(n),...Xt(r),...Xt(s)]}function mt(n,r,s=0){return[n,...Xt(r),...Xt(s)]}function l(n){return[65,...pn(n)]}function It(n){return[67,...bn(n)]}function t(n){return[32,...Xt(n)]}function a(n){return[33,...Xt(n)]}function ft(n){return[34,...Xt(n)]}function At(n){return[...t(n),...w(27,0),...t(n),...w(27,1),106,...t(n),...w(27,2),106,...t(n),...w(27,3),106]}function wn(n){return[...t(n),...w(31,0),...t(n),...w(31,1),146,...t(n),...w(31,2),146,...t(n),...w(31,3),146]}function Tt(n,r=0){return[...n,...mt(47,1,r),...l(2),116,...mt(42,2,0)]}function kt(n,r,s,o,e,u,_){return[...t(n),...t(e),108,...t(o),106,...t(r),106,...l(2),116,...l(1048576),106,...ft(_),...t(s),4,125,...t(_),...mt(42,2,0),...t(u),146,5,...t(u),11,...mt(56,2,0)]}function Pn(){let d=[...l(0),...a(7),2,64,3,64,...t(7),...t(0),79,13,1,...l(0),...a(8),2,64,3,64,...t(8),...t(1),79,13,1,...It(0),...w(19),...a(14),...t(7),...t(2),108,...l(2),116,...l(266240),106,...a(10),...t(3),...t(8),...t(2),108,...l(2),116,106,...a(11),...l(0),...a(9),2,64,3,64,...t(9),...t(2),79,13,1,...t(14),...t(10),...nt(0,2,0),...t(11),...nt(0,2,0),...w(230),...w(228),...a(14),...t(10),...l(16),106,...a(10),...t(11),...l(16),106,...a(11),...t(9),...l(4),106,...a(9),12,0,11,11,...wn(14),...a(13),...kt(7,8,4,5,6,13,12),...t(8),...l(1),106,...a(8),12,0,11,11,...t(7),...l(1),106,...a(7),12,0,11,11,11];return ee([[6,127],[1,125],[1,123]],d)}function yn(){let p=(v,h)=>[...t(h),...t(v),...t(12),106,...mt(45,0,0),...l(3),116,...nt(1,3,262144),...t(34),...w(186),...w(174),...a(h)],O=[...t(3),...l(4),116,...a(22),...t(3),...l(1),116,...a(23),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...l(3),106,...t(1),79,13,1,...It(0),...a(25),...It(0),...a(26),...It(0),...a(27),...It(0),...a(28),...t(4),...t(10),...t(22),108,106,...ft(14),...t(22),106,...ft(15),...t(22),106,...ft(16),...t(22),106,...a(17),...t(5),...t(10),...t(23),108,106,...ft(18),...t(23),106,...ft(19),...t(23),106,...ft(20),...t(23),106,...a(21),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...ft(30),...ft(31),...ft(32),...a(33),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(13),...l(0),...a(12),2,64,3,64,...t(12),...l(16),79,13,1,...t(13),...t(12),...l(4),116,106,...nt(0,4,0),...a(34),...p(14,30),...p(15,31),...p(16,32),...p(17,33),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(26),...At(31),178,...Tt(t(19),0),148,...t(29),148,146,...a(26),...t(27),...At(32),178,...Tt(t(20),0),148,...t(29),148,146,...a(27),...t(28),...At(33),178,...Tt(t(21),0),148,...t(29),148,146,...a(28),...t(14),...l(16),106,...a(14),...t(15),...l(16),106,...a(15),...t(16),...l(16),106,...a(16),...t(17),...l(16),106,...a(17),...t(18),...l(2),106,...a(18),...t(19),...l(2),106,...a(19),...t(20),...l(2),106,...a(20),...t(21),...l(2),106,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,26,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,27,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,28,24),...t(10),...l(1),106,...a(10),12,0,11,11,2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(25),...t(4),...t(10),...t(22),108,106,...a(14),...t(5),...t(10),...t(23),108,106,...a(18),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(30),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(13),...l(0),...a(12),2,64,3,64,...t(12),...l(16),79,13,1,...t(13),...t(12),...l(4),116,106,...nt(0,4,0),...a(34),...p(14,30),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(14),...l(16),106,...a(14),...t(18),...l(2),106,...a(18),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[16,127],[5,125],[5,123]],O)}function On(){let R=(it,Y)=>[...t(it),...t(12),...l(3),116,106,...nt(2,3,0),...a(38),...t(Y),...t(38),...t(39),...w(78),...t(40),...w(145),...t(34),...w(186),...t(38),...l(2),...w(141),...t(39),...w(78),...t(40),...w(145),...t(35),...w(186),...w(174),...t(38),...l(4),...w(141),...t(39),...w(78),...t(40),...w(145),...t(36),...w(186),...t(38),...l(6),...w(141),...t(40),...w(145),...t(37),...w(186),...w(174),...w(174),...w(174),...a(Y)],j=[...Ut(3),...a(39),...Ut(1),...a(40),...t(3),...l(5),116,...a(22),...t(3),...l(1),116,...a(23),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...l(3),106,...t(1),79,13,1,...It(0),...a(25),...It(0),...a(26),...It(0),...a(27),...It(0),...a(28),...t(4),...t(10),...t(22),108,106,...ft(14),...t(22),106,...ft(15),...t(22),106,...ft(16),...t(22),106,...a(17),...t(5),...t(10),...t(23),108,106,...ft(18),...t(23),106,...ft(19),...t(23),106,...ft(20),...t(23),106,...a(21),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...ft(30),...ft(31),...ft(32),...a(33),...l(0),...a(12),2,64,3,64,...t(12),...l(4),79,13,1,...t(9),...t(3),108,...t(11),106,...l(8),116,...t(12),...l(6),116,106,...l(659456),106,...ft(13),...nt(0,4,0),...a(34),...t(13),...nt(0,4,16),...a(35),...t(13),...nt(0,4,32),...a(36),...t(13),...nt(0,4,48),...a(37),...R(14,30),...R(15,31),...R(16,32),...R(17,33),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(26),...At(31),178,...Tt(t(19),0),148,...t(29),148,146,...a(26),...t(27),...At(32),178,...Tt(t(20),0),148,...t(29),148,146,...a(27),...t(28),...At(33),178,...Tt(t(21),0),148,...t(29),148,146,...a(28),...t(14),...l(32),106,...a(14),...t(15),...l(32),106,...a(15),...t(16),...l(32),106,...a(16),...t(17),...l(32),106,...a(17),...t(18),...l(2),106,...a(18),...t(19),...l(2),106,...a(19),...t(20),...l(2),106,...a(20),...t(21),...l(2),106,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,26,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,27,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,28,24),...t(10),...l(1),106,...a(10),12,0,11,11,2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(25),...t(4),...t(10),...t(22),108,106,...a(14),...t(5),...t(10),...t(23),108,106,...a(18),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(30),...l(0),...a(12),2,64,3,64,...t(12),...l(4),79,13,1,...t(9),...t(3),108,...t(11),106,...l(8),116,...t(12),...l(6),116,106,...l(659456),106,...ft(13),...nt(0,4,0),...a(34),...t(13),...nt(0,4,16),...a(35),...t(13),...nt(0,4,32),...a(36),...t(13),...nt(0,4,48),...a(37),...R(14,30),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(14),...l(32),106,...a(14),...t(18),...l(2),106,...a(18),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[16,127],[5,125],[11,123]],j)}function xn(){let E=(O,v)=>[...v===null?t(O):[...t(O),...t(v),...w(149),...t(24),...w(78)],...t(25),...w(149),...l(8),...w(141),...t(26),...w(145)],F=[null,27,28,29,30],S=[];for(let O=0;O<5;O++){let v=F[O];S.push(...t(20),...E(21,v),...t(12),...nt(0,4,O*32),...w(186),...w(174),...a(20)),S.push(...t(20),...E(22,v),...t(12),...nt(0,4,O*32+16),...w(186),...w(174),...a(20)),S.push(...t(20),...E(23,v),...t(12),...nt(0,4,160+O*16),...w(186),...w(174),...a(20))}let p=[...Ut(255),...a(24),...Ut(3),...ft(25),...a(27),...Ut(1),...a(26),...Ut(9),...a(28),...Ut(27),...a(29),...Ut(81),...a(30),...l(264192),...nt(0,4,0),...a(31),...t(3),...l(26),108,...a(15),...t(3),...l(1),116,...a(16),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(18),...t(4),...t(10),...t(15),108,106,...a(13),...t(5),...t(10),...t(16),108,106,...a(14),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(20),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(12),...t(13),...nt(2,0,0),...a(21),...t(13),...nt(2,0,8),...a(22),...t(13),...nt(2,0,16),...a(23),...S,...t(20),...t(13),...mt(47,0,24),...w(16),...w(136),...t(31),...w(149),...t(24),...w(78),...t(25),...w(149),...l(8),...w(141),...t(26),...w(145),...t(12),...nt(0,4,240),...w(186),...w(174),...a(20),...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(19),...t(18),...At(20),178,...Tt(t(14),0),148,...t(19),148,146,...a(18),...t(13),...l(26),106,...a(13),...t(14),...l(2),106,...a(14),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,18,17),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[9,127],[2,125],[12,123]],p)}function In(){let F=(p,O)=>[...t(p),...nt(2,0,2),...a(28),...t(p),...nt(2,0,10),...a(29),...t(28),...t(30),...w(78),...t(31),...w(145),...t(24),...w(186),...t(29),...t(30),...w(78),...t(31),...w(145),...t(25),...w(186),...w(174),...t(28),...l(4),...w(141),...t(31),...w(145),...t(26),...w(186),...t(29),...l(4),...w(141),...t(31),...w(145),...t(27),...w(186),...w(174),...w(174),...a(23),...t(O),...At(23),178,...Tt(t(p),0),148,...t(22),148,146,...a(O)],S=[...Ut(15),...a(30),...Ut(8),...a(31),...t(3),...l(18),108,...a(16),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...l(3),106,...t(1),79,13,1,...It(0),...a(18),...It(0),...a(19),...It(0),...a(20),...It(0),...a(21),...t(4),...t(9),...t(16),108,106,...ft(12),...t(16),106,...ft(13),...t(16),106,...ft(14),...t(16),106,...a(15),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(24),...t(11),...nt(0,4,16),...a(25),...t(11),...nt(0,4,32),...a(26),...t(11),...nt(0,4,48),...a(27),...t(8),...t(3),108,...t(10),106,...l(2),116,...mt(42,2,790528),...a(22),...F(12,18),...F(13,19),...F(14,20),...F(15,21),...t(12),...l(18),106,...a(12),...t(13),...l(18),106,...a(13),...t(14),...l(18),106,...a(14),...t(15),...l(18),106,...a(15),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,18,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,19,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,20,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,21,17),...t(9),...l(1),106,...a(9),12,0,11,11,2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(18),...t(4),...t(9),...t(16),108,106,...a(12),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(24),...t(11),...nt(0,4,16),...a(25),...t(11),...nt(0,4,32),...a(26),...t(11),...nt(0,4,48),...a(27),...t(8),...t(3),108,...t(10),106,...l(2),116,...mt(42,2,790528),...a(22),...F(12,18),...t(12),...l(18),106,...a(12),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,18,17),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[10,127],[5,125],[9,123]],S)}function kn(){let K=[...Ut(15),...a(26),...t(3),...l(20),108,...a(13),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(16),...t(4),...t(9),...t(13),108,106,...a(12),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...ft(15),...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(20),...t(11),...nt(0,4,16),...a(21),...t(11),...nt(0,4,32),...a(22),...t(11),...nt(0,4,48),...a(23),...t(15),...l(2),116,...ft(15),...mt(42,2,790528),...a(17),...t(15),...mt(42,2,806912),...a(18),...t(12),...nt(2,0,4),...a(24),...t(12),...nt(2,0,12),...a(25),...t(24),...t(26),...w(78),...t(20),...w(186),...t(25),...t(26),...w(78),...t(21),...w(186),...w(174),...t(24),...l(4),...w(141),...t(22),...w(186),...t(25),...l(4),...w(141),...t(23),...w(186),...w(174),...w(174),...a(19),...t(16),...At(19),178,...Tt(t(12),0),148,...t(17),148,...Tt(t(12),2),...t(18),148,146,146,...a(16),...t(12),...l(20),106,...a(12),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,16,14),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[8,127],[3,125],[8,123]],K)}function Dn(){let S=(O,v,h)=>[...O,...l(4),73,4,64,...t(15),...O,106,...mt(45,0,4),...l(63),113,...a(v),...t(15),...O,106,...mt(45,0,8),...l(63),113,...a(h),5,...t(15),...O,106,...mt(45,0,8),...l(15),113,...t(15),...O,106,...mt(45,0,0),...l(6),118,...l(4),116,114,...a(v),...t(15),...O,106,...mt(45,0,8),...l(4),118,...t(15),...O,106,...mt(45,0,4),...l(6),118,...l(4),116,114,...a(h),11],p=[...Ut(15),...a(32),...t(3),...l(144),108,...a(17),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(23),...t(4),...t(9),...t(17),108,106,...a(15),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...Tt(t(15),0),...a(24),...Tt(t(15),2),...a(25),...l(0),...a(11),2,64,3,64,...t(11),...l(4),79,13,1,...t(11),...l(1),116,...a(12),...S(t(12),19,20),...S([...t(12),...l(1),106],21,22),...t(15),...t(11),...l(5),116,106,...ft(16),...nt(2,0,16),...a(28),...t(16),...nt(2,0,24),...a(29),...t(16),...nt(2,0,32),...a(30),...t(16),...nt(2,0,40),...a(31),...t(8),...t(3),108,...t(10),106,...l(3),116,...t(12),106,...ft(13),...l(6),116,...l(528384),106,...a(14),...t(28),...t(32),...w(78),...t(14),...nt(0,4,0),...w(186),...t(29),...t(32),...w(78),...t(14),...nt(0,4,16),...w(186),...w(174),...t(30),...t(32),...w(78),...t(14),...nt(0,4,32),...w(186),...t(31),...t(32),...w(78),...t(14),...nt(0,4,48),...w(186),...w(174),...w(174),...a(26),...t(28),...l(4),...w(141),...t(14),...nt(0,4,64),...w(186),...t(29),...l(4),...w(141),...t(14),...nt(0,4,80),...w(186),...w(174),...t(30),...l(4),...w(141),...t(14),...nt(0,4,96),...w(186),...t(31),...l(4),...w(141),...t(14),...nt(0,4,112),...w(186),...w(174),...w(174),...a(27),...t(13),...l(2),116,...a(13),...t(23),...t(24),...t(19),178,148,...t(13),...mt(42,2,790528),148,...At(26),178,148,...t(25),...t(20),178,148,...t(13),...mt(42,2,806912),148,147,146,...t(24),...t(21),178,148,...t(13),...mt(42,2,790532),148,...At(27),178,148,...t(25),...t(22),178,148,...t(13),...mt(42,2,806916),148,147,146,...a(23),...t(11),...l(1),106,...a(11),12,0,11,11,...t(15),...l(144),106,...a(15),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,23,18),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[15,127],[3,125],[7,123]],p)}function Sn(){let h=C=>[...t(13),...nt(2,0,C),...a(27),...t(13),...nt(2,0,32+C),...a(28),...t(14),...nt(2,0,C),...a(29),...t(23),...t(27),...t(30),...w(78),...t(29),...l(4),...w(139),...t(31),...w(78),...w(142),...t(32),...w(145),...t(33),...w(149),...t(17),...nt(0,4,C*2),...w(186),...w(174),...a(23),...t(24),...t(28),...t(30),...w(78),...t(29),...l(2),...w(139),...t(31),...w(78),...w(142),...t(32),...w(145),...t(34),...w(149),...t(17),...nt(0,4,64+C*2),...w(186),...w(174),...a(24),...t(25),...t(27),...l(4),...w(141),...t(29),...t(31),...w(78),...w(142),...t(32),...w(145),...t(35),...w(149),...t(17),...nt(0,4,128+C*2),...w(186),...w(174),...a(25),...t(26),...t(28),...l(4),...w(141),...t(29),...l(2),...w(141),...t(31),...w(78),...w(142),...t(32),...w(145),...t(36),...w(149),...t(17),...nt(0,4,192+C*2),...w(186),...w(174),...a(26)],B=[...Ut(15),...a(30),...Ut(48),...a(31),...Ut(32),...a(32),...t(3),...l(210),108,...a(19),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(21),...t(4),...t(9),...t(19),108,106,...a(18),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...Tt(t(18),208),...a(22),...l(0),...a(11),2,64,3,64,...t(11),...l(2),79,13,1,...l(0),...w(17),...ft(23),...ft(24),...ft(25),...a(26),...t(8),...t(3),108,...t(10),106,...l(3),116,...t(11),...l(2),116,106,...a(16),...t(18),...t(11),...l(6),116,106,...a(13),...t(18),...l(128),106,...t(11),...l(5),116,106,...a(14),...t(18),...l(192),106,...t(11),...l(3),116,106,...a(15),...l(0),...a(12),2,64,3,64,...t(12),...l(2),79,13,1,...t(15),...t(12),106,...mt(44,0,0),...w(16),...a(33),...t(15),...t(12),106,...mt(44,0,2),...w(16),...a(34),...t(15),...t(12),106,...mt(44,0,4),...w(16),...a(35),...t(15),...t(12),106,...mt(44,0,6),...w(16),...a(36),...t(16),...l(6),116,...t(12),...l(5),116,106,...l(528384),106,...a(17),...h(0),...h(8),...t(13),...l(16),106,...a(13),...t(14),...l(16),106,...a(14),...t(12),...l(1),106,...a(12),12,0,11,11,...t(16),...l(2),116,...a(16),...t(21),...t(22),...At(23),178,...t(16),...mt(42,2,790528),148,...At(24),178,...t(16),...mt(42,2,790532),148,146,...At(25),178,...t(16),...mt(42,2,790536),148,...At(26),178,...t(16),...mt(42,2,790540),148,146,146,148,146,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...t(18),...l(210),106,...a(18),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,21,20),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[13,127],[2,125],[14,123]],B)}function ee(n,r){let s=[...Xt(n.length)];for(let[e,u]of n)s.push(...Xt(e),u);let o=[...s,...r];return[...Xt(o.length),...o]}function we(n,r){return[n,...Xt(r.length),...r]}function cr(n){let r=Array.from(new TextEncoder().encode(n));return[...Xt(r.length),...r]}var He=null;function lr(){if(He)return He;let n=we(1,[3,96,7,127,127,127,127,127,127,127,0,96,9,127,127,127,127,127,127,127,127,127,0,96,8,127,127,127,127,127,127,127,127,0]),r=we(2,[1,...cr("env"),...cr("memory"),2,0,1]),s=we(3,[8,0,1,1,1,2,2,2,2]),o=["gemv_f32","gemv_q1_0","gemv_pq2_0","gemv_ptq1_0","gemv_q4_0","gemv_q4_1","gemv_q4_k","gemv_q6_k"],e=[o.length];for(let x=0;x<o.length;x++)e.push(...cr(o[x]),0,x);let u=we(7,e),_=[Pn(),yn(),On(),xn(),In(),kn(),Dn(),Sn()],g=[_.length];for(let x of _)g.push(...x);let d=we(10,g);return He=new Uint8Array([0,97,115,109,1,0,0,0,...n,...r,...s,...u,...d]),He}function $e(n){let f=n.arch,b=n.maxSeqLen,m=n.fp16Table,y=n.cos,A=n.sin,H=n.swaCos,V=n.swaSin,K=new Map(n.hadamardSigns),I=0,U=0;for(let k of n.tensors){let M=0;if(k.type===0||k.type===1)M=k.N*k.K*4+15&-16;else if(k.type===41||k.type===142||k.type===143){let q=k.type===41?16:k.type===142?32:26,rt=k.N*k.nb*q+15&-16,D=k.N*k.nb*2+15&-16;M=rt+D}else M=k.byteLength+15&-16;I+=M,M>U&&(U=M)}let Q=!0,E;try{let k=Math.ceil((5242880+I+65536)/65536);E=new WebAssembly.Memory({initial:k})}catch{Q=!1;let k=Math.ceil((5242880+U+65536)/65536);E=new WebAssembly.Memory({initial:k})}let F=new WebAssembly.Module(n.wasmBytes),p=new WebAssembly.Instance(F,{env:{memory:E}}).exports,O=E.buffer;new Float32Array(O,0,65536).set(m);let v=new Int8Array(O,262144,2048);for(let k=0;k<256;k++)for(let M=0;M<8;M++)v[k*8+M]=k>>M&1?1:-1;new Int16Array(O,264192,8).set([1,1,3,3,9,9,27,27]);let h=new Float32Array(O,266240,65536),B=new Int16Array(O,528384,65536),C=new Int16Array(O,659456,65536),R=new Float32Array(O,790528,4096),j=new Float32Array(O,806912,4096),it=new Float32Array(O,1048576,1048576),Y=new Map,ht=5242880;for(let k of n.tensors){let M=0,q=0,rt=0,D=k.type;if(k.type===0||k.type===1)D=0,M=k.K*4,q=k.N*M+15&-16;else if(k.type===41||k.type===142||k.type===143){let X=k.type===41?16:k.type===142?32:26;M=k.nb*X,q=k.N*M+15&-16,rt=k.N*k.nb*2+15&-16}else M=k.byteLength/k.N,q=k.byteLength+15&-16;let st=5242880,c=5242880+q,N,J,W;Q?(st=ht,ht+=q,c=ht,ht+=rt,N=new Uint8Array(O,st,k.N*M),J=new Uint8Array(O,c,rt>0?k.N*k.nb*2:0),D===0&&(W=new Float32Array(O,st,k.N*k.K))):(N=new Uint8Array(k.N*M),J=new Uint8Array(rt>0?k.N*k.nb*2:0),D===0&&(W=new Float32Array(N.buffer,N.byteOffset,k.N*k.K)));let L=k.type===41?18:k.type===142?34:k.type===143?28:0;Y.set(k.name,{type:D,N:k.N,K:k.K,nb:k.nb,rowBytes:M,hadamardFolded:k.hadamardFolded,quantsPtr:st,scalesPtr:c,quantsView:N,scalesView:J,f32View:W,rawF16:k.type===1?new Uint8Array(k.byteLength):void 0,writeCursor:0,leftover:new Uint8Array(L),leftoverLen:0,blockCursor:0})}function yt(k,M){let q=Y.get(k);if(!q)throw new Error(`hachiue: unknown tensor ${k}`);if(q.rawF16){q.rawF16.set(M,q.writeCursor),q.writeCursor+=M.byteLength;return}if(q.type===41||q.type===142||q.type===143){let rt=q.type===41?18:q.type===142?34:28,D=rt-2,st=q.quantsView,c=q.scalesView,N=(W,L)=>{let X=q.blockCursor++,z=X*D,T=X*2;q.type===143?(st.set(W.subarray(L,L+26),z),c[T]=W[L+26],c[T+1]=W[L+27]):(c[T]=W[L],c[T+1]=W[L+1],st.set(W.subarray(L+2,L+rt),z))},J=0;if(q.leftoverLen>0){let W=Math.min(rt-q.leftoverLen,M.byteLength);q.leftover.set(M.subarray(0,W),q.leftoverLen),q.leftoverLen+=W,J+=W,q.leftoverLen===rt&&(N(q.leftover,0),q.leftoverLen=0)}for(;J+rt<=M.byteLength;)N(M,J),J+=rt;J<M.byteLength&&(q.leftover.set(M.subarray(J),0),q.leftoverLen=M.byteLength-J);return}q.quantsView.set(M,q.writeCursor),q.writeCursor+=M.byteLength}function Dt(k){let M=Y.get(k);if(M){if(M.rawF16){let q=new DataView(M.rawF16.buffer,M.rawF16.byteOffset,M.rawF16.byteLength),rt=M.N*M.K,D=M.f32View;for(let st=0;st<rt;st++)D[st]=m[q.getUint16(st*2,!0)];M.rawF16=void 0}if(M.leftoverLen!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor ${k} (${M.leftoverLen} leftover bytes)`)}}function St(){if(f.tieWordEmbeddings){let k=Y.get("token_embd.weight");if(!k)throw new Error("hachiue: missing token_embd.weight");Y.set("output.weight",{...k,hadamardFolded:!!(f.hadamard?.foldedWeights.has("output.weight")||f.hadamard?.tiedOutput)})}}let ut=f.hidden,bt=f.intermediate,Lt=f.heads,Ot=f.kvHeads,wt=f.headDim,Rt=Lt*wt,Ht=Ot*wt,te=f.hybrid,oe=te?te.linearValueHeads:1,wr=te?te.linearHeadDim:1,ie=te?oe*wr:ut,Pr=te?(te.linearKeyHeads*2+oe)*wr:Math.max(ut,Rt+2*Ht),Ur=Math.max(ut,bt,Rt,ie),Qe={curH:new Float32Array(8*ut),nextH:new Float32Array(8*ut),h2:new Float32Array(8*ut),n1:new Float32Array(8*ut),n2:new Float32Array(8*ut),rotBuf:new Float32Array(8*Ur),permBuf:new Float32Array(8*ie),qkvMixed:new Float32Array(8*Pr),qkvConv:new Float32Array(8*Pr),aProj:new Float32Array(8*oe),bProj:new Float32Array(8*oe),gbeta:new Float32Array(16*oe),core:new Float32Array(8*ie),zGate:new Float32Array(8*ie),normed:new Float32Array(8*ie),qgBuf:new Float32Array(8*Rt*(f.archName==="qwen35"?2:1)),qBuf:new Float32Array(8*Rt),gateBuf:new Float32Array(8*Rt),kBuf:new Float32Array(8*Ht),vBuf:new Float32Array(8*Ht),qNormed:new Float32Array(8*Rt),kNormed:new Float32Array(8*Ht),attOut:new Float32Array(8*Rt),mlpGate:new Float32Array(8*bt*(f.archName==="plamo3"?2:1)),mlpUp:new Float32Array(8*bt),swigluOut:new Float32Array(8*bt),lastHidden:new Float32Array(ut),finalNorm:new Float32Array(ut),logits:new Float32Array(f.vocab)},je=new Map,Ye=new Map,Je=new Map,Ze=new Map,tr=new Map,er=new Map,yr=b*Ht,Or=b*(Ht>>5);for(let k=0;k<f.layers;k++)if(!(f.hybrid&&f.hybrid.layerTypes[k]==="linear"))je.set(k,new Int8Array(yr)),Ye.set(k,new Float32Array(Or)),Je.set(k,new Int8Array(yr)),Ze.set(k,new Float32Array(Or));else if(f.hybrid){let q=(f.hybrid.linearKeyHeads*2+f.hybrid.linearValueHeads)*f.hybrid.linearHeadDim,rt=(f.hybrid.convKernel-1)*q,D=f.hybrid.linearValueHeads*f.hybrid.linearHeadDim*f.hybrid.linearHeadDim;tr.set(k,new Float32Array(rt)),er.set(k,new Float32Array(D))}let Ft=0;function Xr(){Ft=0;for(let k of tr.values())k.fill(0);for(let k of er.values())k.fill(0)}function xr(k,M,q,rt,D){if(!f.hadamard)return;let st=K.get(rt),c=.04419417382415922;for(let N=0;N<q;N++){let J=N*rt;for(let W=0;W<rt;W+=512){let L=J+W;if(D===0&&st)for(let X=0;X<512;X++)M[L+X]=k[L+X]*st[W+X];else for(let X=0;X<512;X++)M[L+X]=k[L+X];for(let X=1;X<512;X<<=1){let z=X<<1;for(let T=0;T<512;T+=z)for(let G=L+T;G<L+T+X;G++){let Z=M[G],$=M[G+X];M[G]=Z+$,M[G+X]=Z-$}}if(D===1&&st)for(let X=0;X<512;X++)M[L+X]=M[L+X]*c*st[W+X];else for(let X=0;X<512;X++)M[L+X]*=c}}}function zt(k,M,q,rt,D){let st=Y.get(M);if(!st?.f32View)throw new Error(`hachiue: missing norm tensor ${M}`);let c=st.f32View,N=f.rmsEps;for(let J=0;J<q;J++){let W=J*rt,L=0;for(let z=0;z<rt;z++){let T=k[W+z];L+=T*T}let X=1/Math.sqrt(L/rt+N);for(let z=0;z<rt;z++)D[W+z]=k[W+z]*X*c[z]}}function Hr(k,M,q,rt){let D=q>>7,st=M*D;for(let c=0;c<st;c++){let N=c<<7,J=0;for(let X=0;X<128;X++){let z=Math.abs(k[N+X]);z>J&&(J=z)}let W=J/16384,L=J>0?16384/J:0;R[c]=W;for(let X=0;X<128;X++)B[N+X]=Math.round(k[N+X]*L);if(rt)for(let X=0;X<4;X++){let z=N+(X<<5);for(let T=0;T<8;T++)C[z+T]=B[z+T*4+0],C[z+8+T]=B[z+T*4+1],C[z+16+T]=B[z+T*4+2],C[z+24+T]=B[z+T*4+3]}}}function $r(k,M,q){let rt=q>>5,D=M*rt;for(let st=0;st<D;st++){let c=st<<5,N=0,J=0;for(let X=0;X<32;X++){let z=k[c+X];J+=z;let T=Math.abs(z);T>N&&(N=T)}let W=N/16384,L=N>0?16384/N:0;R[st]=W,j[st]=J;for(let X=0;X<32;X++)B[c+X]=Math.round(k[c+X]*L)}}let $t=null,Me=0,rr=!1;function qt(k,M,q,rt,D,st){let c=Y.get(k);if(!c)throw new Error(`hachiue: missing weight ${k}`);let N=M;if(c.hadamardFolded&&f.hadamard){let L=st.get(M);if(!L){let X=M;if(f.hadamard.gdnVGrouped&&k.includes(".ssm_out.")&&f.hybrid&&f.hybrid.linearValueHeads>f.hybrid.linearKeyHeads){let z=f.hybrid.linearHeadDim,T=f.hybrid.linearKeyHeads,G=f.hybrid.linearValueHeads/T,Z=z*T*G,$=Qe.permBuf;for(let lt=0;lt<q;lt++){let tt=lt*Z;for(let at=0;at<T;at++)for(let ct=0;ct<G;ct++){let ot=tt+(at*G+ct)*z,Bt=tt+(ct*T+at)*z;for(let _t=0;_t<z;_t++)$[ot+_t]=M[Bt+_t]}}X=$}L=Qe.rotBuf,xr(X,L,q,c.K,0),st.set(M,L)}N=L}let J=q*c.N;D&&it.set(D.subarray(0,J),0),Q||(new Uint8Array(E.buffer,c.quantsPtr,c.quantsView.byteLength).set(c.quantsView),c.scalesView.byteLength>0&&new Uint8Array(E.buffer,c.scalesPtr,c.scalesView.byteLength).set(c.scalesView));let W=D?1:0;if(c.type===0)h.set(N.subarray(0,q*c.K),0),p.gemv_f32(q,c.N,c.K,c.quantsPtr,W,0,c.N);else if(c.type===41||c.type===142||c.type===143){let L=c.type===142;($t!==N||Me!==128||L&&!rr)&&(Hr(N,q,c.K,L),$t=N,Me=128,rr=L),c.type===41?p.gemv_q1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):c.type===142?p.gemv_pq2_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):p.gemv_ptq1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N)}else if(($t!==N||Me!==32)&&($r(N,q,c.K),$t=N,Me=32,rr=!1),c.type===2)p.gemv_q4_0(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===3)p.gemv_q4_1(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===12)p.gemv_q4_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===14)p.gemv_q6_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else throw new Error(`hachiue: unsupported Wasm GEMV tensor type ${c.type}`);rt.set(it.subarray(0,J),0)}function Vr(k,M){let q=Y.get("token_embd.weight"),rt=k.length,D=q.quantsView,st=q.scalesView,c=st.byteLength>0?new DataView(st.buffer,st.byteOffset,st.byteLength):null,N=new DataView(D.buffer,D.byteOffset,D.byteLength),J=[1,3,9,27,81];for(let W=0;W<rt;W++){let L=k[W],X=W*ut;if(q.type===0&&q.f32View)M.set(q.f32View.subarray(L*ut,(L+1)*ut),X);else if(q.type===41){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*16,lt=X+(T<<7);for(let tt=0;tt<128;tt++){let at=D[$+(tt>>3)]>>(tt&7)&1;M[lt+tt]=at?Z:-Z}}}else if(q.type===142){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*32,lt=X+(T<<7);for(let tt=0;tt<128;tt++){let at=D[$+(tt>>2)]>>(tt&3)*2&3;M[lt+tt]=(at-1)*Z}}}else if(q.type===143){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*26,lt=X+(T<<7);for(let tt=0;tt<5;tt++){let at=J[tt];for(let ct=0;ct<16;ct++){let ot=D[$+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}for(let tt=0;tt<5;tt++){let at=J[tt];for(let ct=0;ct<8;ct++){let ot=D[$+16+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}for(let tt=0;tt<4;tt++){let at=J[tt];for(let ct=0;ct<2;ct++){let ot=D[$+24+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}}}else if(q.type===2){let z=ut>>5;for(let T=0;T<z;T++){let G=(L*z+T)*18,Z=m[N.getUint16(G,!0)],$=X+(T<<5);for(let lt=0;lt<16;lt++){let tt=D[G+2+lt];M[$+lt]=((tt&15)-8)*Z,M[$+16+lt]=((tt>>4)-8)*Z}}}else if(q.type===3){let z=ut>>5;for(let T=0;T<z;T++){let G=(L*z+T)*20,Z=m[N.getUint16(G,!0)],$=m[N.getUint16(G+2,!0)],lt=X+(T<<5);for(let tt=0;tt<16;tt++){let at=D[G+4+tt];M[lt+tt]=(at&15)*Z+$,M[lt+16+tt]=(at>>4)*Z+$}}}else if(q.type===12){let z=ut>>8,T=new Uint8Array(8),G=new Uint8Array(8);for(let Z=0;Z<z;Z++){let $=(L*z+Z)*144,lt=m[N.getUint16($,!0)],tt=m[N.getUint16($+2,!0)];for(let ot=0;ot<4;ot++)T[ot]=D[$+4+ot]&63,G[ot]=D[$+8+ot]&63;for(let ot=4;ot<8;ot++)T[ot]=D[$+8+ot]&15|D[$+ot]>>6<<4,G[ot]=D[$+8+ot]>>4|D[$+4+ot]>>6<<4;let at=$+16,ct=X+(Z<<8);for(let ot=0;ot<4;ot++){let Bt=lt*T[2*ot],_t=tt*G[2*ot],vt=lt*T[2*ot+1],xt=tt*G[2*ot+1];for(let Et=0;Et<32;Et++){let Wt=D[at+Et];M[ct+Et]=Bt*(Wt&15)-_t,M[ct+32+Et]=vt*(Wt>>4)-xt}ct+=64,at+=32}}}else if(q.type===14){let z=ut>>8;for(let T=0;T<z;T++){let G=(L*z+T)*210,Z=m[N.getUint16(G+208,!0)];for(let $=0;$<2;$++){let lt=G+$*64,tt=G+128+$*32,at=G+192+$*8,ct=X+(T<<8)+$*128;for(let ot=0;ot<32;ot++){let Bt=ot>>4,_t=D[lt+ot],vt=D[lt+ot+32],xt=D[tt+ot],Et=(_t&15|(xt>>0&3)<<4)-32,Wt=(vt&15|(xt>>2&3)<<4)-32,Gt=(_t>>4|(xt>>4&3)<<4)-32,Qt=(vt>>4|(xt>>6&3)<<4)-32;M[ct+ot+0]=Z*N.getInt8(at+Bt+0)*Et,M[ct+ot+32]=Z*N.getInt8(at+Bt+2)*Wt,M[ct+ot+64]=Z*N.getInt8(at+Bt+4)*Gt,M[ct+ot+96]=Z*N.getInt8(at+Bt+6)*Qt}}}}}}function Ae(k,M,q,rt,D,st,c,N){let J=D>>1;for(let W=0;W<M;W++){let X=(st+W)*J;for(let z=0;z<q;z++){let T=(W*q+z)*rt;for(let G=0;G<J;G++){let Z=c[X+G],$=N[X+G],lt=k[T+G],tt=k[T+G+J];k[T+G]=lt*Z-tt*$,k[T+G+J]=tt*Z+lt*$}}}}function Le(k,M,q,rt,D,st,c){let N=D*(st>>5),J=rt*N;for(let W=0;W<J;W++){let L=Math.floor(W/N),X=W%N,z=(L*N+X)*32,T=(c+L)*N+X,G=T*32,Z=0;for(let tt=0;tt<32;tt++){let at=Math.abs(k[z+tt]);at>Z&&(Z=at)}let $=Z/127,lt=Z>0?127/Z:0;q[T]=$;for(let tt=0;tt<32;tt++){let at=Math.round(k[z+tt]*lt);M[G+tt]=at<-127?-127:at>127?127:at}}}function Ir(k,M,q,rt,D,st,c,N,J,W,L,X){let z=N/J,T=W>>5,G=1/Math.sqrt(W),Z=new Float32Array(W);for(let $=0;$<c;$++){let lt=L+$,tt=X>0&&lt+1>X?lt+1-X:0;for(let at=0;at<N;at++){let ct=Math.floor(at/z),ot=($*N+at)*W;Z.fill(0);let Bt=-1e30,_t=0;for(let xt=tt;xt<=lt;xt++){let Et=xt*J+ct,Wt=Et*T,Gt=Et*W,Qt=0;for(let dt=0;dt<T;dt++){let Pt=0,Mt=ot+(dt<<5),Nt=Gt+(dt<<5);for(let pt=0;pt<32;pt++)Pt+=k[Mt+pt]*M[Nt+pt];Qt+=Pt*q[Wt+dt]}let ue=Qt*G,re=ue>Bt?ue:Bt,ce=Math.exp(Bt-re),qe=Math.exp(ue-re);_t=_t*ce+qe;for(let dt=0;dt<T;dt++){let Pt=qe*D[Wt+dt],Mt=Gt+(dt<<5),Nt=dt<<5;for(let pt=0;pt<32;pt++)Z[Nt+pt]=Z[Nt+pt]*ce+Pt*rt[Mt+pt]}Bt=re}let vt=1/_t;for(let xt=0;xt<W;xt++)st[ot+xt]=Z[xt]*vt}}}function Wr(k,M=!0,q=!1,rt){rt!==void 0&&(Ft=rt);let D=k.length;if(D===0)throw new Error("hachiue: empty tokenIds");if(Ft+D>b)throw new Error(`hachiue: context length ${Ft+D} exceeds maxSeqLen ${b}`);let st=f.rope.rotaryDim,c=Qe,N=new Map,J=c.curH,W=c.nextH;Vr(k,J),f.hadamard?.inverseWeights.has("token_embd.weight")&&(xr(J,W,D,ut,1),[J,W]=[W,J]);for(let L=0;L<f.layers;L++){if(zt(J,`blk.${L}.attn_norm.weight`,D,ut,c.n1),N.clear(),$t=null,f.archName==="plamo3"){qt(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N);let G=Rt+2*Ht;for(let _t=0;_t<D;_t++){let vt=_t*G;c.qBuf.set(c.qkvMixed.subarray(vt,vt+Rt),_t*Rt),c.kBuf.set(c.qkvMixed.subarray(vt+Rt,vt+Rt+Ht),_t*Ht),c.vBuf.set(c.qkvMixed.subarray(vt+Rt+Ht,vt+G),_t*Ht)}zt(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Lt,wt,c.qNormed),zt(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*Ot,wt,c.kNormed);let Z=!!(f.swa&&f.swa.layerTypes[L]==="swa"),$=Z&&H?H:y,lt=Z&&V?V:A,tt=Z&&f.swa?f.swa.windowSize:0;Ae(c.qNormed,D,Lt,wt,st,Ft,$,lt),Ae(c.kNormed,D,Ot,wt,st,Ft,$,lt);let at=je.get(L),ct=Ye.get(L),ot=Je.get(L),Bt=Ze.get(L);Le(c.kNormed,at,ct,D,Ot,wt,Ft),Le(c.vBuf,ot,Bt,D,Ot,wt,Ft),Ir(c.qNormed,at,ct,ot,Bt,c.attOut,D,Lt,Ot,wt,Ft,tt),N.clear(),$t=null,qt(`blk.${L}.attn_output.weight`,c.attOut,D,c.n1,null,N),zt(c.n1,`blk.${L}.post_attention_norm`,D,ut,c.n2);for(let _t=0;_t<D*ut;_t++)c.h2[_t]=J[_t]+c.n2[_t];zt(c.h2,`blk.${L}.ffn_norm.weight`,D,ut,c.n1),N.clear(),$t=null,qt(`blk.${L}.ffn_up.weight`,c.n1,D,c.mlpGate,null,N);for(let _t=0;_t<D;_t++){let vt=_t*bt*2,xt=_t*bt;for(let Et=0;Et<bt;Et++){let Wt=c.mlpGate[vt+Et],Gt=c.mlpGate[vt+bt+Et];c.swigluOut[xt+Et]=Wt/(1+Math.exp(-Wt))*Gt}}N.clear(),$t=null,qt(`blk.${L}.ffn_down.weight`,c.swigluOut,D,c.n1,null,N),zt(c.n1,`blk.${L}.post_ffw_norm`,D,ut,c.n2);for(let _t=0;_t<D*ut;_t++)W[_t]=c.h2[_t]+c.n2[_t];[J,W]=[W,J];continue}if(f.hybrid&&f.hybrid.layerTypes[L]==="linear"&&f.hybrid){let G=f.hybrid.linearKeyHeads,Z=f.hybrid.linearValueHeads,$=f.hybrid.linearHeadDim,lt=G*$,tt=Z*$,at=lt*2+tt,ct=f.hybrid.convKernel,ot=Ft>0;qt(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N),qt(`blk.${L}.attn_gate.weight`,c.n1,D,c.zGate,null,N);let Bt=Y.get(`blk.${L}.ssm_conv1d.weight`).f32View,_t=tr.get(L),vt=(dt,Pt)=>dt+1<ct?ot?_t[dt*at+Pt]:0:c.qkvMixed[(dt-(ct-1))*at+Pt];for(let dt=0;dt<D;dt++){let Pt=dt*at;for(let Mt=0;Mt<at;Mt++){let Nt=0,pt=Mt*ct;for(let Vt=0;Vt<ct;Vt++)Nt+=Bt[pt+Vt]*vt(dt+Vt,Mt);c.qkvConv[Pt+Mt]=Nt/(1+Math.exp(-Nt))}}let xt=new Float32Array((ct-1)*at);for(let dt=0;dt<ct-1;dt++)for(let Pt=0;Pt<at;Pt++)xt[dt*at+Pt]=vt(D+dt,Pt);_t.set(xt),qt(`blk.${L}.ssm_alpha.weight`,c.n1,D,c.aProj,null,N),qt(`blk.${L}.ssm_beta.weight`,c.n1,D,c.bProj,null,N);let Et=Y.get(`blk.${L}.ssm_a`).f32View,Wt=Y.get(`blk.${L}.ssm_dt.bias`).f32View,Gt=D*Z;for(let dt=0;dt<Gt;dt++){let Pt=dt%Z,Mt=c.aProj[dt]+Wt[Pt],Nt=(Mt>0?Mt:0)+Math.log(1+Math.exp(-Math.abs(Mt)));c.gbeta[dt]=Et[Pt]*Nt,c.gbeta[Gt+dt]=1/(1+Math.exp(-c.bProj[dt]))}let Qt=er.get(L);ot||Qt.fill(0);let ue=1/Math.sqrt($),re=new Float32Array($),ce=new Float32Array($);for(let dt=0;dt<Z;dt++){let Pt=dt%G,Mt=dt*$*$;for(let Nt=0;Nt<D;Nt++){let pt=Nt*at,Vt=pt+Pt*$,kr=pt+lt+Pt*$,Qr=pt+lt*2+dt*$,Dr=Nt*Z+dt,Sr=0,Br=0;for(let Ct=0;Ct<$;Ct++){let le=c.qkvConv[Vt+Ct],Ee=c.qkvConv[kr+Ct];Br+=le*le,Sr+=Ee*Ee}let jr=1/Math.sqrt(Sr+1e-6),Yr=1/Math.sqrt(Br+1e-6)*ue;for(let Ct=0;Ct<$;Ct++)ce[Ct]=c.qkvConv[Vt+Ct]*Yr,re[Ct]=c.qkvConv[kr+Ct]*jr;let Jr=Math.exp(c.gbeta[Dr]),Zr=c.gbeta[Gt+Dr],tn=(Nt*Z+dt)*$;for(let Ct=0;Ct<$;Ct++){let le=0;for(let jt=0;jt<$;jt++){let de=Mt+jt*$+Ct,_e=Qt[de]*Jr;Qt[de]=_e,le+=_e*re[jt]}let Ee=(c.qkvConv[Qr+Ct]-le)*Zr,vr=0;for(let jt=0;jt<$;jt++){let de=Mt+jt*$+Ct,_e=Qt[de]+re[jt]*Ee;Qt[de]=_e,vr+=_e*ce[jt]}c.core[tn+Ct]=vr}}}let qe=Y.get(`blk.${L}.ssm_norm.weight`).f32View;for(let dt=0;dt<D*Z;dt++){let Pt=dt*$,Mt=0;for(let pt=0;pt<$;pt++){let Vt=c.core[Pt+pt];Mt+=Vt*Vt}let Nt=1/Math.sqrt(Mt/$+f.rmsEps);for(let pt=0;pt<$;pt++){let Vt=c.zGate[Pt+pt];c.normed[Pt+pt]=qe[pt]*(c.core[Pt+pt]*Nt)*(Vt/(1+Math.exp(-Vt)))}}N.clear(),$t=null,qt(`blk.${L}.ssm_out.weight`,c.normed,D,c.h2,J,N)}else{let G=f.archName==="qwen35";if(G){qt(`blk.${L}.attn_q.weight`,c.n1,D,c.qgBuf,null,N);let at=D*Lt*wt;for(let ct=0;ct<at;ct++){let ot=ct%wt,_t=Math.floor(ct/wt)*(wt*2);c.qBuf[ct]=c.qgBuf[_t+ot],c.gateBuf[ct]=c.qgBuf[_t+wt+ot]}}else qt(`blk.${L}.attn_q.weight`,c.n1,D,c.qBuf,null,N);qt(`blk.${L}.attn_k.weight`,c.n1,D,c.kBuf,null,N),qt(`blk.${L}.attn_v.weight`,c.n1,D,c.vBuf,null,N),zt(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Lt,wt,c.qNormed),zt(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*Ot,wt,c.kNormed),Ae(c.qNormed,D,Lt,wt,st,Ft,y,A),Ae(c.kNormed,D,Ot,wt,st,Ft,y,A);let Z=je.get(L),$=Ye.get(L),lt=Je.get(L),tt=Ze.get(L);if(Le(c.kNormed,Z,$,D,Ot,wt,Ft),Le(c.vBuf,lt,tt,D,Ot,wt,Ft),Ir(c.qNormed,Z,$,lt,tt,c.attOut,D,Lt,Ot,wt,Ft,0),G){let at=D*Lt*wt;for(let ct=0;ct<at;ct++)c.attOut[ct]*=1/(1+Math.exp(-c.gateBuf[ct]))}N.clear(),$t=null,qt(`blk.${L}.attn_output.weight`,c.attOut,D,c.h2,J,N)}let z=f.archName==="qwen35"?`blk.${L}.post_attention_norm.weight`:`blk.${L}.ffn_norm.weight`;zt(c.h2,z,D,ut,c.n2),N.clear(),$t=null,qt(`blk.${L}.ffn_gate.weight`,c.n2,D,c.mlpGate,null,N),qt(`blk.${L}.ffn_up.weight`,c.n2,D,c.mlpUp,null,N);let T=D*bt;for(let G=0;G<T;G++){let Z=c.mlpGate[G];c.swigluOut[G]=Z/(1+Math.exp(-Z))*c.mlpUp[G]}N.clear(),$t=null,qt(`blk.${L}.ffn_down.weight`,c.swigluOut,D,W,c.h2,N),[J,W]=[W,J]}if(Ft+=D,!M)return{};if(D>1?(c.lastHidden.set(J.subarray((D-1)*ut,D*ut)),zt(c.lastHidden,"output_norm.weight",1,ut,c.finalNorm)):zt(J,"output_norm.weight",1,ut,c.finalNorm),N.clear(),$t=null,qt("output.weight",c.finalNorm,1,c.logits,null,N),q){let L=-1e30,X=0,z=f.vocab;for(let T=0;T<z;T++){let G=c.logits[T];G>L&&(L=G,X=T)}return{greedyId:X}}return{logits:new Float32Array(c.logits)}}function zr(k){let M=Y.get(k);if(!M)throw new Error(`hachiue: tensor "${k}" not found`);return{type:M.type,rows:M.N,cols:M.K,rowBytes:M.rowBytes}}function Kr(k,M){let q=Y.get(k);if(!q)throw new Error(`hachiue: tensor "${k}" not found`);let rt=M.length,D=new Uint8Array(rt*q.rowBytes);for(let st=0;st<rt;st++){let c=M[st];if(c<0||c>=q.N)throw new Error(`hachiue: row index ${c} out of bounds for "${k}" (rows=${q.N})`);D.set(q.quantsView.subarray(c*q.rowBytes,(c+1)*q.rowBytes),st*q.rowBytes)}return D}function Gr(k,M,q){let rt=Y.get(k);if(!rt)throw new Error(`hachiue: tensor "${k}" not found`);let D=M.length;if(D===0)return;let st=q.byteLength===rt.rowBytes&&D>1;if(!st&&q.byteLength!==D*rt.rowBytes)throw new Error(`hachiue: writeTensorRows("${k}") expected ${D*rt.rowBytes} (or ${rt.rowBytes}) bytes, got ${q.byteLength}`);for(let c=0;c<D;c++){let N=M[c];if(N<0||N>=rt.N)throw new Error(`hachiue: row index ${N} out of bounds for "${k}" (rows=${rt.N})`);let J=st?0:c*rt.rowBytes;rt.quantsView.set(q.subarray(J,J+rt.rowBytes),N*rt.rowBytes)}}return{pushTensorBytes:yt,finishTensor:Dt,finalizeWeights:St,forwardSegment:Wr,resetCache:Xr,getTensorRowSpec:zr,readTensorRows:Kr,writeTensorRows:Gr}}function Bn(n=$e){let r=null,s=self;s.onmessage=o=>{let e=o.data;try{switch(e.type){case"init":r=n(e.payload),s.postMessage({id:e.id,ok:!0});break;case"pushBatch":for(let u of e.items)r.pushTensorBytes(u.name,u.bytes),u.finished&&r.finishTensor(u.name);s.postMessage({id:e.id,ok:!0});break;case"finalize":r.finalizeWeights(),s.postMessage({id:e.id,ok:!0});break;case"forward":{let u=r.forwardSegment(e.tokenIds,e.computeLogits,e.greedyOnly,e.posBase),_=u.logits?[u.logits.buffer]:[];s.postMessage({id:e.id,ok:!0,res:u},_);break}case"resetCache":r.resetCache(),s.postMessage({id:e.id,ok:!0});break;case"readRows":{let u=r.readTensorRows(e.name,e.rowIndices);s.postMessage({id:e.id,ok:!0,out:u},[u.buffer]);break}case"writeRows":r.writeTensorRows(e.name,e.rowIndices,e.data),s.postMessage({id:e.id,ok:!0});break}}catch(u){s.postMessage({id:e.id,ok:!1,error:u.message||String(u)})}}}var Pe=null;function vn(){if(Pe)return Pe;Pe=new Float32Array(65536);for(let n=0;n<65536;n++)Pe[n]=pe(n);return Pe}async function dr(n,r,s,o,e,u){let _=n.arch,g=r.maxSeqLen??4096;r.onProgress?.({phase:"pipelines",message:"Compiling Wasm SIMD kernels..."});let d=lr(),x=vn(),P=[];if(_.hadamard)for(let[p,O]of _.hadamard.signsByWidth.entries()){let v=new Float32Array(p);for(let h=0;h<p;h++)v[h]=O[h];P.push([p,v])}let i=Object.values(n.tensors).sort((p,O)=>p.absOffset-O.absOffset),f=[],b=new Map;for(let p of i){let O=p.dims[0],v=p.dims.length>1?p.dims[1]:1,[h,B]=se(p.type),C=O/h,R=!!_.hadamard?.foldedWeights.has(p.name);f.push({name:p.name,type:p.type,N:v,K:O,nb:C,hadamardFolded:R,byteLength:p.byteLength});let j=0,it=p.type===et.F16?et.F32:p.type;if(it===et.F32)j=O*4;else if(p.type===et.Q1_0||p.type===et.PQ2_0||p.type===et.PTQ1_0){let Y=p.type===et.Q1_0?16:p.type===et.PQ2_0?32:26;j=C*Y}else j=C*B;b.set(p.name,{type:it,rows:v,cols:O,rowBytes:j})}if(_.tieWordEmbeddings){let p=b.get("token_embd.weight");p&&b.set("output.weight",{...p})}let m={arch:_,maxSeqLen:g,wasmBytes:d,fp16Table:x,cos:s,sin:o,swaCos:e,swaSin:u,hadamardSigns:P,tensors:f},y=(r.useWorker??!0)&&typeof Worker<"u"&&typeof Blob<"u"&&typeof URL<"u"&&typeof URL.createObjectURL=="function",A=null,H=null,V=1,K=new Map,I=(p,O=[])=>{let v=V++;return new Promise((h,B)=>{K.set(v,{resolve:h,reject:B}),A.postMessage({...p,id:v},O)})};if(y)try{let p=`(${Bn.toString()})(${$e.toString()});`,O=new Blob([p],{type:"text/javascript"});H=URL.createObjectURL(O),A=new Worker(H),A.onmessage=v=>{let{id:h,ok:B,res:C,out:R,error:j}=v.data,it=K.get(h);it&&(K.delete(h),B?it.resolve(R??C??!0):it.reject(new Error(j)))},A.onerror=v=>{for(let h of K.values())h.reject(new Error(v.message||"hachiue: Wasm Worker error"));K.clear()},await I({type:"init",payload:m})}catch{A&&A.terminate(),H&&URL.revokeObjectURL(H),A=null,H=null}let U=A?null:$e(m),Q=!!A;r.onProgress?.({phase:"pipelines",message:Q?"Initializing Wasm SIMD Web Worker...":"Initializing Wasm SIMD kernels...",backend:"wasm",isWorker:Q});let E=0,F=i.length>0?i[0].absOffset:n.dataStartOffset;await ae(r.url,F,n.totalFileSize,async(p,O)=>{let v=O+p.byteLength,h=[],B=[];for(;E<i.length;){let C=i[E],R=C.absOffset,j=C.absOffset+C.byteLength;if(j<=O){E++;continue}if(R>=v)break;let it=Math.max(0,R-O),Y=Math.min(p.byteLength,j-O),ht=O+Y===j;if(Y>it)if(A){let yt=p.slice(it,Y);h.push({name:C.name,bytes:yt,finished:ht}),B.push(yt.buffer)}else U.pushTensorBytes(C.name,p.subarray(it,Y)),ht&&U.finishTensor(C.name);else ht&&(A?h.push({name:C.name,bytes:new Uint8Array(0),finished:!0}):U.finishTensor(C.name));if(ht)E++;else break}A&&h.length>0&&await I({type:"pushBatch",items:h},B),await new Promise(C=>setTimeout(C,0))},r),A?await I({type:"finalize"}):U.finalizeWeights(),r.onProgress?.({phase:"ready",message:A?"Model loaded into Wasm SIMD Worker":"Model loaded into Wasm SIMD memory",backend:"wasm",isWorker:Q});let S=Promise.resolve();return{isWorker:!!A,getTensorRowSpec(p){let O=b.get(p);if(!O)throw new Error(`hachiue: tensor "${p}" not found`);return O},async readTensorRows(p,O){let v=b.get(p);if(!v)throw new Error(`hachiue: tensor "${p}" not found`);for(let h=0;h<O.length;h++){let B=O[h];if(B<0||B>=v.rows)throw new Error(`hachiue: row index ${B} out of bounds for "${p}" (rows=${v.rows})`)}return O.length===0?new Uint8Array(0):A?(await S,await I({type:"readRows",name:p,rowIndices:Array.from(O)})):U.readTensorRows(p,O)},writeTensorRows(p,O,v){let h=b.get(p);if(!h)throw new Error(`hachiue: tensor "${p}" not found`);let B=O.length;if(B===0)return;if(!(v.byteLength===h.rowBytes&&B>1)&&v.byteLength!==B*h.rowBytes)throw new Error(`hachiue: writeTensorRows("${p}") expected ${B*h.rowBytes} (or ${h.rowBytes}) bytes, got ${v.byteLength}`);for(let R=0;R<B;R++){let j=O[R];if(j<0||j>=h.rows)throw new Error(`hachiue: row index ${j} out of bounds for "${p}" (rows=${h.rows})`)}if(A){let R=new Uint8Array(v);S=I({type:"writeRows",name:p,rowIndices:Array.from(O),data:R},[R.buffer]);return}U.writeTensorRows(p,O,v)},async forwardSegment(p,O,v,h){return A?(await S,await I({type:"forward",tokenIds:p,computeLogits:O,greedyOnly:v,posBase:h})):U.forwardSegment(p,O,v,h)},resetCache(){if(A){S=I({type:"resetCache"});return}U.resetCache()},async flush(){await S},dispose(){A&&(A.terminate(),A=null),H&&(URL.revokeObjectURL(H),H=null)}}}var Ve=1,Mn=4,ye=8,An=64,Ln=128,Kt=Ln|ye|Mn,qn=An|ye,gt=8;function En(n,r,s,o,e,u){let _=o/128,g=r===et.Q1_0?18:r===et.PQ2_0?34:28,d=g-2,x=0,P=0,i=s[0].rowCount*_,f=e.byteLength,b=0,m=0,y=0,A=0,H=new Uint8Array(g),V=0,K=()=>{let U=0,Q=s[x];if(b>0){let E=b+3&-4;E>b&&e.fill(0,b,E),n.queue.writeBuffer(Q.quants,y,e,0,E),y+=b,U+=E,b=0}if(m>0){let E=m+3&-4;E>m&&u.fill(0,m,E),n.queue.writeBuffer(Q.scales16,A,u,0,E),A+=m,U+=E,m=0}return U},I=(U,Q)=>{let E=0;return r===et.PTQ1_0?(e.set(U.subarray(Q,Q+26),b),b+=26,u[m++]=U[Q+26],u[m++]=U[Q+27]):(u[m++]=U[Q],u[m++]=U[Q+1],e.set(U.subarray(Q+2,Q+g),b),b+=d),P++,(P&1)===0&&b+1024>=f&&(E+=K()),P===i&&(E+=K(),x++,P=0,y=0,A=0,x<s.length&&(i=s[x].rowCount*_)),E};return{push:U=>{let Q=0,E=0;if(V>0){let F=Math.min(g-V,U.byteLength);H.set(U.subarray(0,F),V),V+=F,E+=F,V===g&&(Q+=I(H,0),V=0)}for(;E+g<=U.byteLength;)Q+=I(U,E),E+=g;return E<U.byteLength&&(H.set(U.subarray(E),0),V=U.byteLength-E),Q},finish:()=>{if(V!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor (${V} leftover bytes)`);return K()}}}function Nn(n,r,s,o){let e=0,u=0,_=r[0].rowCount*s,g=0,d=0,x=o.byteLength,P=()=>{if(g===0)return 0;let i=r[e],f=g+3&-4;f>g&&o.fill(0,g,f),n.queue.writeBuffer(i.quants,d,o,0,f),d+=g;let b=f;return g=0,b};return{push:i=>{let f=0,b=0;for(;b<i.byteLength&&e<r.length;){let m=_-u,y=x-g,A=y>=4?y&-4:y,H=Math.min(i.byteLength-b,m,A);o.set(i.subarray(b,b+H),g),g+=H,u+=H,b+=H,u===_?(f+=P(),e++,u=0,d=0,e<r.length&&(_=r[e].rowCount*s)):g+4096>=x&&(g&3)===0&&(f+=P())}return f},finish:()=>P()}}function Nr(n,r,s=!1){let o=n.rope.rotaryDim,e=o>>1,u=new Float32Array(r*e),_=new Float32Array(r*e),g=s?n.rope.localTheta??1e4:n.rope.theta,d=!s&&n.rope.factor&&n.rope.factor>1?n.rope.factor:1,x=n.rope.originalMaxPositions??4096,P=n.rope.yarnBetaFast??32,i=n.rope.yarnBetaSlow??1,f=d>1?.1*Math.log(d)+1:1,b=new Float64Array(e),m=0,y=e-1;if(d>1){let A=H=>o*Math.log(x/(H*2*Math.PI))/(2*Math.log(g));m=Math.max(0,A(P)),y=Math.min(e-1,A(i)),m===y&&(y+=.001)}for(let A=0;A<e;A++){let H=1/Math.pow(g,2*A/o);if(d>1){let V=H,K=H/d,I=(A-m)/(y-m),Q=1-Math.min(1,Math.max(0,I));b[A]=K*(1-Q)+V*Q}else b[A]=H}for(let A=0;A<r;A++)for(let H=0;H<e;H++){let V=A*b[H];u[A*e+H]=Math.cos(V)*f,_[A*e+H]=Math.sin(V)*f}return{cos:u,sin:_}}var Oe=class n{header;arch;tokenizer;backend;isWorker;backendInfo;device;maxSeqLen;wasmBackend;pipelines;weights;hadamardSigns;cosBuf;sinBuf;swaCosBuf;swaSinBuf;dummyBuf;logitsBuf;logitsReadBuf;logitsCpu;argmaxBuf;argmaxReadBuf;tokensBuf;kCacheQ;kCacheS;vCacheQ;vCacheS;ssmConvState;ssmRecState;scratch;uniformPool=[];uniformCursor=0;uniformScratch=new ArrayBuffer(32);uniformView=new DataView(this.uniformScratch);ssmParity=0;cachePos=0;tokenHistory=[];lastMessages=[];lastTurnTokens=[];disposed=!1;constructor(r,s,o,e,u,_,g,d,x,P,i=null,f){if(this.header=r,this.arch=r.arch,this.tokenizer=r.tokenizer?new be(r.tokenizer):null,this.backend=i?"wasm":"webgpu",this.isWorker=i?i.isWorker:!1,this.backendInfo=f??{backend:this.backend,isWorker:this.isWorker,label:this.backend==="webgpu"?"WebGPU":this.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD"},this.device=s,this.maxSeqLen=o,this.wasmBackend=i,this.pipelines=e,this.weights=u,this.hadamardSigns=_,this.cosBuf=g,this.sinBuf=d,this.swaCosBuf=x,this.swaSinBuf=P,i||!s){this.dummyBuf=null,this.logitsBuf=null,this.logitsReadBuf=null,this.logitsCpu=new Float32Array(0),this.argmaxBuf=null,this.argmaxReadBuf=null,this.tokensBuf=null,this.scratch=null,this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;return}let b=(B,C=Kt)=>s.createBuffer({size:Math.max(16,B+3&-4),usage:C}),m=B=>b(B*4);this.dummyBuf=b(64),this.logitsBuf=b(this.arch.vocab*4),this.logitsReadBuf=s.createBuffer({size:this.arch.vocab*4,usage:Ve|ye}),this.logitsCpu=new Float32Array(this.arch.vocab),this.argmaxBuf=b(16),this.argmaxReadBuf=s.createBuffer({size:16,usage:Ve|ye}),this.tokensBuf=b(gt*4);let y=this.arch.hidden,A=this.arch.intermediate,H=this.arch.heads,V=this.arch.kvHeads,K=this.arch.headDim,I=H*K,U=V*K,Q=this.arch.hybrid,E=Q?Q.linearValueHeads:1,F=Q?Q.linearHeadDim:1,S=Q?E*F:y,p=Q?(Q.linearKeyHeads*2+E)*F:Math.max(y,I+2*U),O=Math.max(y,A,I,S);this.scratch={curH:m(gt*y),nextH:m(gt*y),h2:m(gt*y),n1:m(gt*y),n2:m(gt*y),rotBuf:m(gt*O),permBuf:m(gt*S),qkvMixed:m(gt*p),qkvConv:m(gt*p),aProj:m(gt*E),bProj:m(gt*E),gbeta:m(2*gt*E),core:m(gt*S),zGate:m(gt*S),normed:m(gt*S),qgBuf:m(gt*I*(this.arch.archName==="qwen35"?2:1)),qBuf:m(gt*I),gateBuf:m(gt*I),kBuf:m(gt*U),vBuf:m(gt*U),qNormed:m(gt*I),kNormed:m(gt*U),attOut:m(gt*I),mlpGate:m(gt*A*(this.arch.archName==="plamo3"?2:1)),mlpUp:m(gt*A),swigluOut:m(gt*A),lastHidden:m(y),finalNorm:m(y)},this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;let v=o*U,h=o*(U/32)*4;for(let B=0;B<this.arch.layers;B++)if(!(this.arch.hybrid&&this.arch.hybrid.layerTypes[B]==="linear"))this.kCacheQ.set(B,b(v)),this.kCacheS.set(B,b(h)),this.vCacheQ.set(B,b(v)),this.vCacheS.set(B,b(h));else if(this.arch.hybrid){let R=this.arch.hybrid,j=(R.linearKeyHeads*2+R.linearValueHeads)*R.linearHeadDim,it=(R.convKernel-1)*j*4,Y=R.linearValueHeads*R.linearHeadDim*R.linearHeadDim*4;this.ssmConvState.set(B,[b(it),b(it)]),this.ssmRecState.set(B,[b(Y),b(Y)])}}static async prefetch(r,s={}){return or(r,s)}static async create(r){let s=r.maxSeqLen??4096,o=await he(r.url,r),e=o.arch,u=r.backend??(r.device?"webgpu":"auto"),{cos:_,sin:g}=Nr(e,s,!1),d=null,x=null;if(e.swa){let h=Nr(e,s,!0);d=h.cos,x=h.sin}let P=async h=>{let B=await dr(o,r,_,g,d,x),C={backend:"wasm",isWorker:B.isWorker,label:B.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD",...h?{fallbackReason:h}:{}};return new n(o,null,s,new Map,new Map,new Map,null,null,null,null,B,C)};if(u==="wasm")return P();let i=r.device,f=i?"custom-device":void 0,b=null;try{if(!i){if(typeof navigator>"u"||!navigator.gpu)throw new Error("hachiue: WebGPU is not supported in this browser");let h=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(h?f="high-performance":(h=await navigator.gpu.requestAdapter(),h?f="default":(h=await navigator.gpu.requestAdapter({featureLevel:"compatibility"}),h&&(f="compatibility"))),!h)throw new Error("hachiue: Failed to acquire WebGPU adapter");let B=Math.min(h.limits.maxStorageBufferBindingSize,256*1024*1024),C=Math.min(h.limits.maxBufferSize,512*1024*1024),R=h.limits.maxStorageBuffersPerShaderStage;i=await h.requestDevice({requiredLimits:{maxStorageBufferBindingSize:B,maxBufferSize:C,...R?{maxStorageBuffersPerShaderStage:R}:{}}})}r.onProgress?.({phase:"pipelines",message:"Compiling WebGPU shaders...",backend:"webgpu",isWorker:!1}),b=new Map,await Promise.all(Object.entries(ur).map(async([h,B])=>{let C=i.createShaderModule({code:B,label:h});if(typeof C.getCompilationInfo=="function"){let j=(await C.getCompilationInfo()).messages.find(it=>it.type==="error");if(j)throw new Error(`hachiue: WGSL error in ${h} (L${j.lineNum}:${j.linePos}): ${j.message}`)}try{let R=await i.createComputePipelineAsync({layout:"auto",compute:{module:C,entryPoint:"main"}});b.set(h,R)}catch(R){throw new Error(`hachiue: pipeline compile failed in ${h}: ${R.message||R}`)}}))}catch(h){if(i&&!r.device)try{i.destroy()}catch{}if(u==="webgpu")throw h;let B=h instanceof Error?h.message:String(h);return P(B)}i.lost.then(h=>{r.onDeviceLost?.({reason:String(h.reason??"unknown"),message:h.message})});let m=new Map;if(e.hadamard)for(let[h,B]of e.hadamard.signsByWidth.entries()){let C=new Float32Array(h);for(let j=0;j<h;j++)C[j]=B[j];let R=i.createBuffer({size:C.byteLength,usage:Kt});i.queue.writeBuffer(R,0,C),m.set(h,R)}let y=i.createBuffer({size:_.byteLength,usage:Kt}),A=i.createBuffer({size:g.byteLength,usage:Kt});i.queue.writeBuffer(y,0,_.buffer,_.byteOffset,_.byteLength),i.queue.writeBuffer(A,0,g.buffer,g.byteOffset,g.byteLength);let H=null,V=null;d&&x&&(H=i.createBuffer({size:d.byteLength,usage:Kt}),V=i.createBuffer({size:x.byteLength,usage:Kt}),i.queue.writeBuffer(H,0,d.buffer,d.byteOffset,d.byteLength),i.queue.writeBuffer(V,0,x.buffer,x.byteOffset,x.byteLength));let K=Math.min(i.limits.maxStorageBufferBindingSize,64*1024*1024),I=new Map,U=i.createBuffer({size:16,usage:Kt}),Q=new Uint8Array(new ArrayBuffer(1024*1024)),E=new Uint8Array(new ArrayBuffer(128*1024)),F=[],S=Object.values(o.tensors).sort((h,B)=>h.absOffset-B.absOffset);for(let h of S){let B=h.dims[0],C=h.dims.length>1?h.dims[1]:1,R=!!e.hadamard?.foldedWeights.has(h.name);if(h.type===et.F32||h.type===et.F16){let j=B*C,it=i.createBuffer({size:Math.max(16,j*4),usage:Kt});if(I.set(h.name,{type:et.F32,N:C,K:B,nb:1,hadamardFolded:R,f32Buf:it}),h.type===et.F32){let Y=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:ht=>(i.queue.writeBuffer(it,Y,ht.buffer,ht.byteOffset,ht.byteLength),Y+=ht.byteLength,ht.byteLength),finish:()=>0})}else{let Y=null,ht=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:yt=>(Y||(Y=new Uint8Array(h.byteLength)),Y.set(yt,ht),ht+=yt.byteLength,0),finish:()=>{if(!Y)return 0;let yt=new DataView(Y.buffer,Y.byteOffset,Y.byteLength),Dt=new Float32Array(j);for(let St=0;St<j;St++)Dt[St]=pe(yt.getUint16(St*2,!0));return i.queue.writeBuffer(it,0,Dt),Y=null,Dt.byteLength}})}}else if(h.type===et.Q1_0||h.type===et.PQ2_0||h.type===et.PTQ1_0){let j=B/128,it=h.type===et.Q1_0?16:h.type===et.PQ2_0?32:26,Y=j*it,ht=Math.max(1,Math.floor(K/Y)),yt=[];for(let ut=0;ut<C;ut+=ht){let bt=Math.min(ht,C-ut),Lt=Math.max(16,bt*Y+3&-4),Ot=Math.max(16,bt*j*2+3&-4);yt.push({rowStart:ut,rowCount:bt,quants:i.createBuffer({size:Lt,usage:Kt}),scales16:i.createBuffer({size:Ot,usage:Kt})})}let Dt={type:h.type,N:C,K:B,nb:j,hadamardFolded:R,chunks:yt};I.set(h.name,Dt);let St=En(i,h.type,yt,B,Q,E);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:St.push,finish:St.finish})}else if(h.type===et.Q4_0||h.type===et.Q4_1||h.type===et.Q4_K||h.type===et.Q6_K){let[j,it]=se(h.type),Y=B/j,ht=Y*it,yt=Math.max(1,Math.floor(K/ht)),Dt=[];for(let ut=0;ut<C;ut+=yt){let bt=Math.min(yt,C-ut),Lt=Math.max(16,bt*ht+3&-4);Dt.push({rowStart:ut,rowCount:bt,quants:i.createBuffer({size:Lt,usage:Kt}),scales16:U})}I.set(h.name,{type:h.type,N:C,K:B,nb:Y,hadamardFolded:R,chunks:Dt});let St=Nn(i,Dt,ht,Q);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:St.push,finish:St.finish})}else throw new Error(`hachiue: unsupported tensor type ${h.type} for ${h.name}`)}if(e.tieWordEmbeddings){let h=I.get("token_embd.weight");if(!h)throw new Error("hachiue: missing token_embd.weight");I.set("output.weight",{...h,hadamardFolded:!!(e.hadamard?.foldedWeights.has("output.weight")||e.hadamard?.tiedOutput)})}let p=0,O=F.length>0&&F[0]?F[0].absStart:o.dataStartOffset;await ae(r.url,O,o.totalFileSize,async(h,B)=>{let C=B+h.byteLength;for(;p<F.length;){let R=F[p];if(!R||R.absEnd<=B){F[p]=null,p++;continue}if(R.absStart>=C)break;let j=Math.max(0,R.absStart-B),it=Math.min(h.byteLength,R.absEnd-B);if(it>j&&R.push(h.subarray(j,it)),B+it===R.absEnd)R.finish(),F[p]=null,p++;else break}await i.queue.onSubmittedWorkDone(),await new Promise(R=>setTimeout(R,0))},r),await i.queue.onSubmittedWorkDone(),r.onProgress?.({phase:"ready",message:"Model loaded into WebGPU memory",backend:"webgpu",isWorker:!1});let v={backend:"webgpu",isWorker:!1,label:f==="compatibility"?"WebGPU (Compat)":"WebGPU",adapterMode:f};return new n(o,i,s,b,I,m,y,A,H,V,null,v)}resetCache(){this.cachePos=0,this.ssmParity=0,this.tokenHistory=[],this.lastMessages=[],this.lastTurnTokens=[],this.wasmBackend&&this.wasmBackend.resetCache()}dispose(){this.disposed||(this.disposed=!0,this.wasmBackend?this.wasmBackend.dispose():this.device&&this.device.destroy())}async flushDeviceQueue(){if(this.wasmBackend){await this.wasmBackend.flush();return}await this.device.queue.onSubmittedWorkDone()}getTensorRowSpec(r){if(this.wasmBackend)return this.wasmBackend.getTensorRowSpec(r);let s=this.weights.get(r);if(!s)throw new Error(`hachiue: tensor "${r}" not found`);if(s.f32Buf)return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.K*4};if(s.type===et.Q1_0||s.type===et.PQ2_0||s.type===et.PTQ1_0){let e=s.type===et.Q1_0?16:s.type===et.PQ2_0?32:26;return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.nb*e}}let[,o]=se(s.type);return{type:s.type,rows:s.N,cols:s.K,rowBytes:s.nb*o}}resolveTensorRowBuffer(r,s,o){if(o<0||o>=s.N)throw new Error(`hachiue: row index ${o} out of bounds for "${r}" (rows=${s.N})`);if(s.f32Buf)return{buf:s.f32Buf,localRow:o};if(s.chunks){for(let e of s.chunks)if(o>=e.rowStart&&o<e.rowStart+e.rowCount)return{buf:e.quants,localRow:o-e.rowStart}}throw new Error(`hachiue: failed to resolve GPU chunk for "${r}" row ${o}`)}async readTensorRows(r,s){if(this.wasmBackend)return this.wasmBackend.readTensorRows(r,s);let o=this.weights.get(r);if(!o)throw new Error(`hachiue: tensor "${r}" not found`);let{rowBytes:e}=this.getTensorRowSpec(r),u=s.length;if(u===0)return new Uint8Array(0);let _=u*e,g=this.device.createBuffer({size:_,usage:Ve|ye}),d=this.device.createCommandEncoder();for(let P=0;P<u;P++){let{buf:i,localRow:f}=this.resolveTensorRowBuffer(r,o,s[P]);d.copyBufferToBuffer(i,f*e,g,P*e,e)}this.device.queue.submit([d.finish()]),await g.mapAsync(Ve);let x=new Uint8Array(g.getMappedRange().slice(0));return g.unmap(),g.destroy(),x}writeTensorRows(r,s,o){if(this.wasmBackend){this.wasmBackend.writeTensorRows(r,s,o);return}let e=this.weights.get(r);if(!e)throw new Error(`hachiue: tensor "${r}" not found`);let{rowBytes:u}=this.getTensorRowSpec(r),_=s.length;if(_===0)return;let g=o.byteLength===u&&_>1;if(!g&&o.byteLength!==_*u)throw new Error(`hachiue: writeTensorRows("${r}") expected ${_*u} (or ${u}) bytes, got ${o.byteLength}`);for(let d=0;d<_;d++){let{buf:x,localRow:P}=this.resolveTensorRowBuffer(r,e,s[d]),i=g?o.byteOffset:o.byteOffset+d*u;this.device.queue.writeBuffer(x,P*u,o.buffer,i,u)}}mkUniform(r,s=new Set){for(let u=0;u<8;u++){let _=u<r.length?r[u]:0;s.has(u)?this.uniformView.setFloat32(u*4,_,!0):this.uniformView.setUint32(u*4,_>>>0,!0)}let o=this.uniformCursor++,e=this.uniformPool[o];return e||(e=this.device.createBuffer({size:32,usage:qn}),this.uniformPool.push(e)),this.device.queue.writeBuffer(e,0,this.uniformScratch),e}dispatch(r,s,o,e,u,_=1,g=1){let d=this.pipelines.get(s);if(!d)throw new Error(`hachiue: missing pipeline ${s}`);let x=[{binding:0,resource:{buffer:o}}];for(let i=0;i<e.length;i++)x.push({binding:i+1,resource:{buffer:e[i]}});let P=this.device.createBindGroup({layout:d.getBindGroupLayout(0),entries:x});r.setPipeline(d),r.setBindGroup(0,P),r.dispatchWorkgroups(u,_,g)}runHadamard(r,s,o,e,u,_){if(!this.arch.hadamard)return;let g=this.hadamardSigns.get(u),d=g?1:0,x=this.mkUniform([e,u,_,d]),P=e*(u>>9);this.dispatch(r,"hadamard_512",x,[s,g??this.dummyBuf,o],P)}runRmsNorm(r,s,o,e,u,_){let g=this.weights.get(o);if(!g?.f32Buf)throw new Error(`hachiue: missing norm tensor ${o}`);let d=this.mkUniform([e,u,this.arch.rmsEps,0],new Set([2]));this.dispatch(r,"rmsnorm",d,[s,g.f32Buf,_],e)}runMatmul(r,s,o,e,u,_,g){let d=this.weights.get(s);if(!d)throw new Error(`hachiue: missing weight ${s}`);let x=o;if(d.hadamardFolded&&this.arch.hadamard){let i=g.get(o);if(!i){let f=o;if(this.arch.hadamard.gdnVGrouped&&s.includes(".ssm_out.")&&this.arch.hybrid&&this.arch.hybrid.linearValueHeads>this.arch.hybrid.linearKeyHeads){let b=this.arch.hybrid.linearHeadDim,m=this.arch.hybrid.linearKeyHeads,y=this.arch.hybrid.linearValueHeads/m,A=this.mkUniform([e,b,m,y]);this.dispatch(r,"permute_gdn",A,[o,this.scratch.permBuf],Math.ceil(e*d.K/256)),f=this.scratch.permBuf}i=this.scratch.rotBuf,this.runHadamard(r,f,i,e,d.K,0),g.set(o,i)}x=i}if(d.type===et.F32&&d.f32Buf){let i=Math.ceil(d.N/4),f=Math.min(i,65535),b=Math.ceil(i/f),m=this.mkUniform([e,d.N,d.K,f]);this.dispatch(r,"gemv_f32",m,[x,d.f32Buf,u],f,b,e);return}if(!d.chunks)throw new Error(`hachiue: missing quantized chunks for ${s}`);let P=d.type===et.Q1_0?"gemv_q1_0":d.type===et.PQ2_0?"gemv_pq2_0":d.type===et.PTQ1_0?"gemv_ptq1_0":d.type===et.Q4_0?"gemv_q4_0":d.type===et.Q4_1?"gemv_q4_1":d.type===et.Q4_K?"gemv_q4_k":"gemv_q6_k";for(let i of d.chunks){let f=Math.ceil(i.rowCount/4),b=Math.min(f,65535),m=Math.ceil(f/b),y=this.mkUniform([e,i.rowCount,d.K,d.nb,b,_?1:0,i.rowStart,d.N]);this.dispatch(r,P,y,[x,i.quants,i.scales16,_??this.dummyBuf,u],b,m,e)}}async forwardSegment(r,s=!0,o=!1){let e=r.length;if(e===0)throw new Error("hachiue: empty tokenIds");if(this.cachePos+e>this.maxSeqLen)throw new Error(`hachiue: context length ${this.cachePos+e} exceeds maxSeqLen ${this.maxSeqLen}`);if(this.wasmBackend){let I=this.cachePos;return this.cachePos+=e,this.wasmBackend.forwardSegment(r,s,o,I)}let u=this.arch.heads,_=this.arch.kvHeads,g=this.arch.headDim,d=this.arch.hidden,x=this.arch.intermediate,P=this.arch.rope.rotaryDim,i=this.scratch;this.uniformCursor=0;let f=new Map,b=new Uint32Array(r);this.device.queue.writeBuffer(this.tokensBuf,0,b);let m=this.device.createCommandEncoder(),y=m.beginComputePass(),A=this.weights.get("token_embd.weight"),H=A.type===et.Q1_0?0:A.type===et.PQ2_0?1:A.type===et.PTQ1_0?2:A.type===et.Q4_0?3:A.type===et.Q4_1?4:A.type===et.Q4_K?5:6,V=i.curH,K=i.nextH;for(let I of A.chunks){let U=this.mkUniform([d,H,e,I.rowStart,I.rowCount,0,0,0]);this.dispatch(y,"embed_gather",U,[this.tokensBuf,I.quants,I.scales16,V],Math.ceil(d/256),e)}this.arch.hadamard?.inverseWeights.has("token_embd.weight")&&(this.runHadamard(y,V,K,e,d,1),[V,K]=[K,V]);for(let I=0;I<this.arch.layers;I++){if(this.runRmsNorm(y,V,`blk.${I}.attn_norm.weight`,e,d,i.n1),f.clear(),this.arch.archName==="plamo3"){let F=u*g,S=_*g;this.runMatmul(y,`blk.${I}.attn_qkv.weight`,i.n1,e,i.qkvMixed,null,f);let p=this.mkUniform([e,F,S,0]);this.dispatch(y,"split_qkv",p,[i.qkvMixed,i.qBuf,i.kBuf,i.vBuf],Math.ceil(e*(F+2*S)/256)),this.runRmsNorm(y,i.qBuf,`blk.${I}.attn_q_norm.weight`,e*u,g,i.qNormed),this.runRmsNorm(y,i.kBuf,`blk.${I}.attn_k_norm.weight`,e*_,g,i.kNormed);let O=!!(this.arch.swa&&this.arch.swa.layerTypes[I]==="swa"),v=O&&this.swaCosBuf?this.swaCosBuf:this.cosBuf,h=O&&this.swaSinBuf?this.swaSinBuf:this.sinBuf,B=O&&this.arch.swa?this.arch.swa.windowSize:0,C=this.mkUniform([e,u,g,P,this.cachePos,0,0,0]),R=this.mkUniform([e,_,g,P,this.cachePos,0,0,0]);this.dispatch(y,"rope",C,[v,h,i.qNormed],Math.ceil(e*u*(P>>1)/64)),this.dispatch(y,"rope",R,[v,h,i.kNormed],Math.ceil(e*_*(P>>1)/64));let j=this.mkUniform([e,_,g,this.cachePos]),it=e*_*(g>>5),Y=this.kCacheQ.get(I),ht=this.kCacheS.get(I),yt=this.vCacheQ.get(I),Dt=this.vCacheS.get(I);this.dispatch(y,"kv_append_q8",j,[i.kNormed,Y,ht],it),this.dispatch(y,"kv_append_q8",j,[i.vBuf,yt,Dt],it);let St=this.mkUniform([e,u,_,g,this.cachePos,B,0,0]);this.dispatch(y,"attention_q8",St,[i.qNormed,Y,ht,yt,Dt,i.attOut],e*u),f.clear(),this.runMatmul(y,`blk.${I}.attn_output.weight`,i.attOut,e,i.n1,null,f),this.runRmsNorm(y,i.n1,`blk.${I}.post_attention_norm`,e,d,i.n2);let ut=this.mkUniform([e*d,0,0,0]);this.dispatch(y,"add_inplace",ut,[V,i.n2,i.h2],Math.ceil(e*d/256)),this.runRmsNorm(y,i.h2,`blk.${I}.ffn_norm.weight`,e,d,i.n1),f.clear(),this.runMatmul(y,`blk.${I}.ffn_up.weight`,i.n1,e,i.mlpGate,null,f);let bt=this.mkUniform([e,x,0,0]);this.dispatch(y,"swiglu_fused",bt,[i.mlpGate,i.swigluOut],Math.ceil(e*x/256)),f.clear(),this.runMatmul(y,`blk.${I}.ffn_down.weight`,i.swigluOut,e,i.n1,null,f),this.runRmsNorm(y,i.n1,`blk.${I}.post_ffw_norm`,e,d,i.n2),this.dispatch(y,"add_inplace",ut,[i.h2,i.n2,K],Math.ceil(e*d/256)),[V,K]=[K,V];continue}if(this.arch.hybrid&&this.arch.hybrid.layerTypes[I]==="linear"&&this.arch.hybrid){let F=this.arch.hybrid,S=F.linearKeyHeads,p=F.linearValueHeads,O=F.linearHeadDim,v=S*O,h=p*O,B=v*2+h,C=F.convKernel,R=this.cachePos>0?1:0,j=this.ssmParity;this.runMatmul(y,`blk.${I}.attn_qkv.weight`,i.n1,e,i.qkvMixed,null,f),this.runMatmul(y,`blk.${I}.attn_gate.weight`,i.n1,e,i.zGate,null,f);let it=this.weights.get(`blk.${I}.ssm_conv1d.weight`).f32Buf,Y=this.ssmConvState.get(I),ht=this.mkUniform([e,B,C,R]),yt=e*B+(C-1)*B,Dt=Math.ceil(yt/64),St=Math.min(Dt,65535),ut=Math.ceil(Dt/St);this.dispatch(y,"conv1d_causal",ht,[i.qkvMixed,it,Y[j],i.qkvConv,Y[j^1]],St,ut),this.runMatmul(y,`blk.${I}.ssm_alpha.weight`,i.n1,e,i.aProj,null,f),this.runMatmul(y,`blk.${I}.ssm_beta.weight`,i.n1,e,i.bProj,null,f);let bt=this.weights.get(`blk.${I}.ssm_a`).f32Buf,Lt=this.weights.get(`blk.${I}.ssm_dt.bias`).f32Buf,Ot=this.mkUniform([e,p,0,0]);this.dispatch(y,"deltanet_gbeta",Ot,[i.aProj,i.bProj,bt,Lt,i.gbeta],Math.ceil(e*p/64));let wt=this.ssmRecState.get(I),Rt=this.mkUniform([e,p,O,O,S,R,0,0]);this.dispatch(y,"deltanet_recur",Rt,[i.qkvConv,i.gbeta,wt[j],i.core,wt[j^1]],p);let Ht=this.weights.get(`blk.${I}.ssm_norm.weight`).f32Buf,te=this.mkUniform([e*p,O,this.arch.rmsEps,0],new Set([2]));this.dispatch(y,"deltanet_norm_gate",te,[i.core,i.zGate,Ht,i.normed],e*p),f.clear(),this.runMatmul(y,`blk.${I}.ssm_out.weight`,i.normed,e,i.h2,V,f)}else{let F=this.arch.archName==="qwen35";if(F){this.runMatmul(y,`blk.${I}.attn_q.weight`,i.n1,e,i.qgBuf,null,f);let it=this.mkUniform([e,u,g,0]);this.dispatch(y,"split_q_gate",it,[i.qgBuf,i.qBuf,i.gateBuf],Math.ceil(e*u*g/256))}else this.runMatmul(y,`blk.${I}.attn_q.weight`,i.n1,e,i.qBuf,null,f);this.runMatmul(y,`blk.${I}.attn_k.weight`,i.n1,e,i.kBuf,null,f),this.runMatmul(y,`blk.${I}.attn_v.weight`,i.n1,e,i.vBuf,null,f),this.runRmsNorm(y,i.qBuf,`blk.${I}.attn_q_norm.weight`,e*u,g,i.qNormed),this.runRmsNorm(y,i.kBuf,`blk.${I}.attn_k_norm.weight`,e*_,g,i.kNormed);let S=this.mkUniform([e,u,g,P,this.cachePos,0,0,0]),p=this.mkUniform([e,_,g,P,this.cachePos,0,0,0]);this.dispatch(y,"rope",S,[this.cosBuf,this.sinBuf,i.qNormed],Math.ceil(e*u*(P>>1)/64)),this.dispatch(y,"rope",p,[this.cosBuf,this.sinBuf,i.kNormed],Math.ceil(e*_*(P>>1)/64));let O=this.mkUniform([e,_,g,this.cachePos]),v=e*_*(g>>5),h=this.kCacheQ.get(I),B=this.kCacheS.get(I),C=this.vCacheQ.get(I),R=this.vCacheS.get(I);this.dispatch(y,"kv_append_q8",O,[i.kNormed,h,B],v),this.dispatch(y,"kv_append_q8",O,[i.vBuf,C,R],v);let j=this.mkUniform([e,u,_,g,this.cachePos,0,0,0]);if(this.dispatch(y,"attention_q8",j,[i.qNormed,h,B,C,R,i.attOut],e*u),F){let it=this.mkUniform([e*u*g,0,0,0]);this.dispatch(y,"sigmoid_gate",it,[i.gateBuf,i.attOut],Math.ceil(e*u*g/256))}f.clear(),this.runMatmul(y,`blk.${I}.attn_output.weight`,i.attOut,e,i.h2,V,f)}let Q=this.arch.archName==="qwen35"?`blk.${I}.post_attention_norm.weight`:`blk.${I}.ffn_norm.weight`;this.runRmsNorm(y,i.h2,Q,e,d,i.n2),f.clear(),this.runMatmul(y,`blk.${I}.ffn_gate.weight`,i.n2,e,i.mlpGate,null,f),this.runMatmul(y,`blk.${I}.ffn_up.weight`,i.n2,e,i.mlpUp,null,f);let E=this.mkUniform([e*x,0,0,0]);this.dispatch(y,"swiglu",E,[i.mlpGate,i.mlpUp,i.swigluOut],Math.ceil(e*x/256)),f.clear(),this.runMatmul(y,`blk.${I}.ffn_down.weight`,i.swigluOut,e,K,i.h2,f),[V,K]=[K,V]}if(this.arch.hybrid&&(this.ssmParity^=1),this.cachePos+=e,!s)return y.end(),this.device.queue.submit([m.finish()]),await this.device.queue.onSubmittedWorkDone(),{};if(e>1){y.end(),m.copyBufferToBuffer(V,(e-1)*d*4,i.lastHidden,0,d*4);let I=m.beginComputePass();if(this.runRmsNorm(I,i.lastHidden,"output_norm.weight",1,d,i.finalNorm),f.clear(),this.runMatmul(I,"output.weight",i.finalNorm,1,this.logitsBuf,null,f),o){let U=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(I,"argmax",U,[this.logitsBuf,this.argmaxBuf],1)}I.end()}else{if(this.runRmsNorm(y,V,"output_norm.weight",1,d,i.finalNorm),f.clear(),this.runMatmul(y,"output.weight",i.finalNorm,1,this.logitsBuf,null,f),o){let I=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(y,"argmax",I,[this.logitsBuf,this.argmaxBuf],1)}y.end()}if(o){m.copyBufferToBuffer(this.argmaxBuf,0,this.argmaxReadBuf,0,4),this.device.queue.submit([m.finish()]),await this.argmaxReadBuf.mapAsync(GPUMapMode.READ);let I=new Uint32Array(this.argmaxReadBuf.getMappedRange())[0];return this.argmaxReadBuf.unmap(),{greedyId:I}}return m.copyBufferToBuffer(this.logitsBuf,0,this.logitsReadBuf,0,this.arch.vocab*4),this.device.queue.submit([m.finish()]),await this.logitsReadBuf.mapAsync(GPUMapMode.READ),this.logitsCpu.set(new Float32Array(this.logitsReadBuf.getMappedRange())),this.logitsReadBuf.unmap(),{logits:this.logitsCpu}}async generate(r,s={}){let o,e=null;if(Array.isArray(r)&&typeof r[0]=="number")o=r;else if(typeof r=="string"){if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");o=this.tokenizer.encode(r)}else{if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");if(e=r,this.lastMessages.length>0&&e.length>this.lastMessages.length&&this.lastMessages.every((I,U)=>e[U].role===I.role&&e[U].content===I.content)){let I=e.slice(this.lastMessages.length),U=this.tokenizer.formatChat(I);o=[...this.lastTurnTokens,...this.tokenizer.encode(U)]}else{let I=this.tokenizer.formatChat(e);o=this.tokenizer.encode(I)}}if(o.length===0)throw new Error("hachiue: prompt produced 0 tokens");let u=0;for(;u<this.tokenHistory.length&&u<o.length-1&&this.tokenHistory[u]===o[u];)u++;u<this.tokenHistory.length&&(this.arch.hybrid||u===0?(this.resetCache(),u=0):(this.cachePos=u,this.tokenHistory=this.tokenHistory.slice(0,u)));let _=o.slice(u),g=s.maxNewTokens??512,d=new Set([this.arch.eosTokenId,...s.stopTokens??[]]);if(this.arch.eomTokenId!==void 0&&d.add(this.arch.eomTokenId),this.arch.eotTokenId!==void 0&&d.add(this.arch.eotTokenId),this.arch.archName==="plamo3"){let K=this.tokenizer?.tokenToId("<|plamo:eom|>");K!==void 0&&d.add(K)}let x=(s.temperature??.6)<=0&&(s.repetitionPenalty===void 0||s.repetitionPenalty===1),P=performance.now(),i=0;for(let K=0;K<_.length;K+=gt){if(s.signal?.aborted)throw new DOMException("Generation aborted","AbortError");let I=_.slice(K,K+gt),U=K+gt>=_.length,Q=await this.forwardSegment(I,U,x);this.tokenHistory.push(...I),U&&(x&&Q.greedyId!==void 0?i=Q.greedyId:Q.logits&&(i=Re(Q.logits,this.arch.vocab,this.tokenHistory,s)))}let f=performance.now()-P,b=[],m=this.tokenizer?.createDecoderStream(!0),y=performance.now();for(let K=0;K<g&&!(s.signal?.aborted||d.has(i));K++){b.push(i);let I=m?m.push(i):"";if(s.onToken?.(i,I),K+1>=g||this.cachePos+1>this.maxSeqLen)break;let U=await this.forwardSegment([i],!0,x);this.tokenHistory.push(i),x&&U.greedyId!==void 0?i=U.greedyId:U.logits&&(i=Re(U.logits,this.arch.vocab,this.tokenHistory,s))}let A=m?m.flush():"";A&&s.onToken?.(-1,A);let H=Math.max(1,performance.now()-y),V=this.tokenizer?this.tokenizer.decode(b,!0):"";if(e&&this.tokenizer){this.lastMessages=[...e.map(I=>({...I})),{role:"assistant",content:V}];let K=this.arch.archName==="plamo3"?"<|plamo:eom|>":`<|im_end|>
`;this.lastTurnTokens=[...o,...b,...this.tokenizer.encode(K)]}return{text:V,tokenIds:b,stats:{promptTokens:_.length,generatedTokens:b.length,prefillMs:f,decodeMs:H,prefillTokensPerSec:_.length/Math.max(1,f)*1e3,decodeTokensPerSec:b.length/H*1e3,reusedCache:u>0,backend:this.backend,isWorker:this.isWorker}}}};function Cr(n){return(n||"").replace(/<\|plamo:[^>]*\|>/g,"").trim()}var Cn=new Set(["plain","polite"]);function Tr({text:n,targetLang:r,sourceLang:s,form:o,glossary:e,context:u,history:_}){let g=String(r||"ja").trim().toLowerCase();if(!String(n??"").trim())throw new Error("text must not be empty");let d="<|plamo:bos|><|plamo:tag|>dataset<|plamo:msg|>translation";if(u&&String(u).trim()&&(d+=`<|plamo:tag|>context<|plamo:msg|>${String(u).trim()}`),Array.isArray(e)&&e.length){let x=e.filter(P=>P&&String(P.source??"").trim()&&String(P.target??"").trim());if(x.length){d+="<|plamo:tag|>glossary";for(let P of x)d+=`<|plamo:index|>${String(P.source).trim()}<|plamo:item|>${String(P.target).trim()}`}}if(Array.isArray(_)){let x=s&&s!=="auto"?String(s).toLowerCase():"";for(let P of _){if(!P||!String(P.source??"").trim()||!String(P.translation??"").trim())continue;let i=P.sourceLang?String(P.sourceLang).toLowerCase():x,f=P.targetLang?String(P.targetLang).toLowerCase():g;d+="<|plamo:tag|>input",i&&(d+=`<|plamo:key|>lang<|plamo:val|>${i}`),d+=`<|plamo:msg|>${String(P.source).trim()}`,d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${f}<|plamo:msg|>${String(P.translation).trim()}`}}return d+="<|plamo:tag|>input",s&&String(s).toLowerCase()!=="auto"&&(d+=`<|plamo:key|>lang<|plamo:val|>${String(s).toLowerCase()}`),d+=`<|plamo:msg|>${String(n)}`,d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${g}`,Cn.has(o)&&g.startsWith("ja")&&(d+=`<|plamo:key|>form<|plamo:val|>${o}`),d+="<|plamo:msg|>",d}var ze="https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF/resolve/0c4af2b003fdd94b6868aa955414c1c86ee96997/plamo-3-translate-0.8b-Q4_K_M.gguf",Tn="plamo-3-translate-0.8b-Q4_K_M.gguf",Ie=573125952,Fn=300*1e3,ve=Fn,Jt=null,Zt="unloaded",ke=null,De=null,Se=0,Be=null,_r=Promise.resolve(),xe=null;function Ke(...n){console.log("[offscreen]",...n)}function mr(...n){console.warn("[offscreen]",...n)}function gr(){Be&&(clearTimeout(Be),Be=null)}function pr(){gr(),Zt==="ready"&&(Be=setTimeout(()=>{Rn()},ve))}async function Rn(){let n=_r;Be=null;try{await n}catch{}if(Date.now()-Se<ve){pr();return}Ke(`idle for ${ve}ms \u2014 disposing engine`),await br();try{await chrome.runtime.sendMessage({type:"BUILTIN_IDLE_UNLOAD"})}catch(r){mr("could not notify SW for document close:",r&&r.message)}}async function br(){if(gr(),!Jt){Zt="unloaded";return}try{Jt.dispose()}catch(n){mr("engine.dispose() threw:",n&&n.message)}Jt=null,Zt="unloaded",De=null}function We(n){let r=_r.then(n);return _r=r.then(()=>{},()=>{}),r}function fr(){Se=Date.now(),pr()}var Fr=0;function hr(n){let r=Date.now();r-Fr<100&&n.phase!=="ready"||(Fr=r,chrome.runtime.sendMessage({type:"OFFSCREEN_PROGRESS",phase:n.phase??"weights",loadedBytes:n.loadedBytes??0,totalBytes:n.totalBytes??0,cached:!!n.cached}).catch(()=>{}))}async function Rr(){if(Zt==="ready"&&Jt)return Jt;if(xe)return xe;if(!navigator.gpu)throw new Error("WEBGPU_UNAVAILABLE: this browser cannot run the built-in model");Zt="loading",ke=null,xe=(async()=>{let n=performance.now();try{Jt=await Oe.create({url:ze,backend:"webgpu",maxSeqLen:2048,onProgress:hr,onDeviceLost:r=>{mr("WebGPU device lost:",r.reason,r.message),Zt==="ready"&&(ke=`WebGPU device lost (${r.reason})`,Zt="error",Jt=null)}})}catch(r){throw Zt="error",ke=r&&r.message||String(r),Jt=null,new Error(`LOAD_FAILED: ${ke}`)}return De={...Jt.backendInfo},Zt="ready",Ke(`model loaded in ${((performance.now()-n)/1e3).toFixed(1)}s (${De.backend}${De.isWorker?" worker":""})`),hr({phase:"ready",loadedBytes:0,totalBytes:0,cached:!0}),fr(),Jt})();try{return await xe}finally{xe=null}}function Ge(){return{state:Zt,lastError:ke,backend:De,lastActivityAt:Se,idleMs:Se?Date.now()-Se:null,webgpuAvailable:!!navigator.gpu,modelUrl:ze,modelName:Tn,modelSizeBytes:Ie}}async function Un(){let n=await sr(ze,Ie).catch(()=>!1),r=n?await Te(ze,Ie).catch(()=>Ie):0;return{cached:n,sizeBytes:r||0,modelSizeBytes:Ie}}async function Xn(){return await Rr(),Ge()}async function Hn(n){let r=await Rr();gr();try{let s=String(n.text??"");if(!s.trim())throw new Error("EMPTY_TEXT");let o=String(n.targetLang||"ja").toLowerCase(),e=typeof n.sourceLang=="string"?n.sourceLang:void 0,u=Array.isArray(n.glossary)?n.glossary:void 0,_=n.form==="polite"||n.form==="plain"?n.form:void 0,g=typeof n.context=="string"?n.context:void 0,d=Array.isArray(n.history)?n.history:void 0,x=Tr({text:s,targetLang:o,sourceLang:e,form:_,glossary:u,context:g,history:d}),P=performance.now(),i=await r.generate(x,{maxNewTokens:512,temperature:0});return fr(),{translation:Cr(i.text),stats:{promptTokens:i.stats.promptTokens,generatedTokens:i.stats.generatedTokens,prefillTokensPerSec:i.stats.prefillTokensPerSec,decodeTokensPerSec:i.stats.decodeTokensPerSec,elapsedMs:performance.now()-P,backend:i.stats.backend}}}catch(s){throw fr(),s}}async function $n(){return await br(),Ge()}async function Vn(){return await br(),await ar(),hr({phase:"ready",loadedBytes:0,totalBytes:0,cached:!1}),Ge()}chrome.runtime.onMessage.addListener((n,r,s)=>{if(!n||n.target!=="offscreen")return!1;let o=n.type;return Ke("recv",o),(async()=>{switch(o){case"OFFSCREEN_STATUS":s({ok:!0,status:Ge()});return;case"OFFSCREEN_CACHE_INFO":s({ok:!0,cache:await Un()});return;case"OFFSCREEN_LOAD_MODEL":s({ok:!0,status:await We(Xn)});return;case"OFFSCREEN_TRANSLATE":s({ok:!0,...await We(()=>Hn(n))});return;case"OFFSCREEN_UNLOAD":s({ok:!0,status:await We($n)});return;case"OFFSCREEN_CLEAR_CACHE":s({ok:!0,status:await We(Vn)});return;case"OFFSCREEN_SET_IDLE_TIMEOUT":{let e=Number(n.ms);Number.isFinite(e)&&e>=1e3?(ve=e,pr(),s({ok:!0,idleTimeoutMs:ve})):s({ok:!1,error:"ms must be >= 1000"});return}default:s({ok:!1,error:`unknown offscreen message: ${o}`})}})().catch(e=>{s({ok:!1,error:e&&e.message||String(e)})}),!0});Ke("offscreen runtime ready");
