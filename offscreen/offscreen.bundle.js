var tn=16*1024*1024,en="hachiue-model-cache-v1",Yt="chunks";function rr(s){let r=3735928559^s.length,n=1103547991^s.length;for(let o=0;o<s.length;o++){let e=s.charCodeAt(o);r=Math.imul(r^e,2654435761),n=Math.imul(n^e,1597334677)}return r=Math.imul(r^r>>>16,2246822507)^Math.imul(n^n>>>13,3266489909),n=Math.imul(n^n>>>16,2246822507)^Math.imul(r^r>>>13,3266489909),(n>>>0).toString(16).padStart(8,"0")+(r>>>0).toString(16).padStart(8,"0")}function ne(){return new Promise((s,r)=>{let n=indexedDB.open(en,1);n.onupgradeneeded=()=>{let o=n.result;o.objectStoreNames.contains(Yt)||o.createObjectStore(Yt)},n.onsuccess=()=>s(n.result),n.onerror=()=>r(n.error)})}async function he(s,r){if(typeof indexedDB>"u")return;let n=r??await ne();return new Promise((o,e)=>{let _=n.transaction(Yt,"readonly").objectStore(Yt).get(s);_.onsuccess=()=>{r||n.close(),o(_.result)},_.onerror=()=>{r||n.close(),e(_.error)}})}async function rn(s,r){if(typeof indexedDB>"u")return!1;let n=r??await ne();return new Promise((o,e)=>{let _=n.transaction(Yt,"readonly").objectStore(Yt).count(s);_.onsuccess=()=>{r||n.close(),o(_.result>0)},_.onerror=()=>{r||n.close(),e(_.error)}})}async function Sr(s,r,n){if(typeof indexedDB>"u")return;let o=n??await ne();return new Promise((e,u)=>{let _=o.transaction(Yt,"readwrite");_.objectStore(Yt).put(r,s),_.oncomplete=()=>{n||o.close(),e()},_.onerror=()=>{n||o.close(),u(_.error)}})}async function nn(){if(typeof indexedDB>"u")return;let s=await ne();return new Promise((r,n)=>{let o=s.transaction(Yt,"readwrite");o.objectStore(Yt).clear(),o.oncomplete=()=>{s.close(),r()},o.onerror=()=>{s.close(),n(o.error)}})}async function Ce(){try{if(typeof navigator<"u"&&navigator.storage?.getDirectory)return await navigator.storage.getDirectory()}catch{}return null}async function Te(s,r,n){let o=rr(s),e=await Ce();if(e)try{let _=await(await(await e.getFileHandle(`${o}.meta.json`)).getFile()).text();if(_){let g=JSON.parse(_),d=Math.min(n,g.totalSize-1);if(d>=r){let x=Math.floor(r/g.chunkBytes),P=Math.floor(d/g.chunkBytes),i=new Set(g.completedChunks),f=!0;for(let b=x;b<=P;b++)if(!i.has(b)){f=!1;break}if(f){let m=await(await e.getFileHandle(`${o}.gguf.bin`)).getFile();if(m.size>d){let y=m.slice(r,d+1);return new Uint8Array(await y.arrayBuffer())}}}}}catch{}try{let u=typeof indexedDB<"u"?await ne():null;if(!u)return null;try{let _=await he(`meta:${o}`,u);if(!_||_.completedChunks.length===0)return null;let g=Math.min(n,_.totalSize-1);if(g<r)return null;let d=Math.floor(r/_.chunkBytes),x=Math.floor(g/_.chunkBytes),P=new Set(_.completedChunks);for(let b=d;b<=x;b++)if(!P.has(b))return null;let i=new Uint8Array(g-r+1),f=0;for(let b=d;b<=x;b++){let m=await he(`chunk:${o}:${b}`,u);if(!m)return null;let y=b*_.chunkBytes,A=Math.max(0,r-y),H=Math.min(m.byteLength,g+1-y),V=m.subarray(A,H);i.set(V,f),f+=V.byteLength}return i}finally{u.close()}}catch{return null}}async function Fe(s,r){let n=rr(s),o=await Ce();if(o)try{let u=await(await o.getFileHandle(`${n}.meta.json`)).getFile(),_=JSON.parse(await u.text());if(r&&_.totalSize!==r)return 0;let g=Math.ceil(_.totalSize/_.chunkBytes);return _.completedChunks.length===g?_.totalSize:0}catch{}try{let e=await he(`meta:${n}`);if(!e||r&&e.totalSize!==r)return 0;let u=Math.ceil(e.totalSize/e.chunkBytes);return e.completedChunks.length===u?e.totalSize:0}catch{return 0}}async function nr(s,r){return await Fe(s,r)>0}async function sr(){let s=await Ce();if(s)try{for await(let r of s.keys())typeof r=="string"&&(r.endsWith(".gguf.bin")||r.endsWith(".meta.json"))&&await s.removeEntry(r).catch(()=>{})}catch{}await nn().catch(()=>{})}async function ae(s,r,n,o,e={}){let u=e.chunkBytes??tn,_=e.useCache??!0,g=e.fetchRange??Re,d=rr(s);_&&typeof navigator<"u"&&navigator.storage?.persist?.().catch(()=>{});let x=Math.floor(r/u),P=Math.ceil(n/u),i=null,f=null,b=null,m={url:s,totalSize:n,chunkBytes:u,completedChunks:[],updatedAt:Date.now()};if(_){i=await Ce();let E=null;if(i)try{let p=await(await(await i.getFileHandle(`${d}.meta.json`)).getFile()).text();if(p){let O=JSON.parse(p);O.totalSize===n&&O.chunkBytes===u&&(E=O)}}catch{}let F=null;try{if(typeof indexedDB<"u"){b=await ne();let S=await he(`meta:${d}`,b);S&&S.totalSize===n&&S.chunkBytes===u&&(F=S)}}catch{}if(F&&(!E||F.completedChunks.length>E.completedChunks.length))m=F,i=null;else if(i)try{let S=await i.getFileHandle(`${d}.gguf.bin`,{create:!0});typeof S.createWritable=="function"?(f=await S.getFile(),E&&(m=E)):(i=null,F&&(m=F))}catch{i=null,F&&(m=F)}}let y=new Set(m.completedChunks),A=!1,H=async()=>{if(A){if(A=!1,m.completedChunks=Array.from(y),m.updatedAt=Date.now(),i)try{let F=await(await i.getFileHandle(`${d}.meta.json`,{create:!0})).createWritable();await F.write(JSON.stringify(m)),await F.close();return}catch{}await Sr(`meta:${d}`,m,b).catch(()=>{})}},V=0,K=n-r,I=(E,F)=>{E>V&&(V=E),e.onProgress?.({phase:"weights",loadedBytes:Math.min(V,K),totalBytes:K,cached:F})},U=async E=>{if(e.signal?.aborted)throw new DOMException("Model loading aborted","AbortError");let F=E*u,S=Math.min(n,F+u),p=S-F,O=null,B=!1;if(_&&y.has(E)){if(i&&f&&f.size>=S)if(!o)O=new Uint8Array(0),B=!0;else try{let v=f.slice(F,S);O=new Uint8Array(await v.arrayBuffer()),B=!0}catch{O=null}if(!O)try{if(!o)await rn(`chunk:${d}:${E}`,b)&&(O=new Uint8Array(0),B=!0);else{let v=await he(`chunk:${d}:${E}`,b);v&&v.byteLength===p&&(O=v,B=!0)}}catch{O=null}}let h=E===0?vr(s):null;if(!O){let v=Math.max(0,F-r);if(h&&h.byteLength>0&&h.byteLength<=p)if(h.byteLength===p)O=h;else{let C=h.byteLength,R=await g(s,C,S-1,e.signal,it=>{let Y=Math.max(0,C+it-r);Y>v&&I(Y,!1)}),j=new Uint8Array(p);j.set(h,0),j.set(R,C),O=j}else O=await g(s,F,S-1,e.signal,C=>{let R=Math.max(0,F+C-r);R>v&&I(R,!1)});if(O.byteLength!==p)throw new Error(`hachiue: chunk ${E} returned ${O.byteLength} bytes, expected ${p}`)}return{ci:E,chunkStart:F,chunkEndExclusive:S,data:O,fromCache:B}},Q=async(E,F,S)=>{if(_){if(i){let p=null;try{p=await(await i.getFileHandle(`${d}.gguf.bin`,{create:!0})).createWritable({keepExistingData:!0}),await p.write({type:"write",position:F,data:S}),await p.close(),p=null,y.add(E),A=!0,((E&3)===0||E===P-1)&&await H();return}catch{p&&await p.close().catch(()=>{}),await i.removeEntry(`${d}.gguf.bin`).catch(()=>{}),await i.removeEntry(`${d}.meta.json`).catch(()=>{}),i=null}}if(!i)try{!b&&typeof indexedDB<"u"&&(b=await ne()),await Sr(`chunk:${d}:${E}`,S,b),y.add(E),A=!0,((E&3)===0||E===P-1)&&await H()}catch{}}};try{let E=x<P?U(x):null;for(let F=x;F<P;F++){let S=await E;E=F+1<P?U(F+1):null,E?.catch(()=>{});let p=Math.max(0,r-S.chunkStart),O=o&&p>0?S.data.subarray(p):S.data;await Promise.all([S.fromCache?Promise.resolve():Q(F,S.chunkStart,S.data),o?o(O,S.chunkStart+p):S.fromCache?Promise.resolve():new Promise(B=>setTimeout(B,0))]),S.data=null,I(S.chunkEndExclusive-r,S.fromCache)}}finally{await H().catch(()=>{}),b&&b.close()}}async function ar(s,r={}){let n=await me(s,r);return await ae(s,0,n.totalFileSize,null,{...r,useCache:!0}),n}var et;(function(s){s[s.F32=0]="F32",s[s.F16=1]="F16",s[s.Q4_0=2]="Q4_0",s[s.Q4_1=3]="Q4_1",s[s.Q8_0=8]="Q8_0",s[s.Q4_K=12]="Q4_K",s[s.Q6_K=14]="Q6_K",s[s.Q1_0=41]="Q1_0",s[s.Q2_0=42]="Q2_0",s[s.PQ2_0=142]="PQ2_0",s[s.PTQ1_0=143]="PTQ1_0"})(et||(et={}));var ge=null;function vr(s){if(ge&&ge.url===s){let r=ge.bytes;return ge=null,r}return null}var sn=1179993927,an=32,on=2*1024*1024,or=32*1024*1024,pe=class extends Error{constructor(){super("GGUF header buffer truncated")}};function se(s){switch(s){case et.F32:return[1,4];case et.F16:return[1,2];case et.Q4_0:return[32,18];case et.Q4_1:return[32,20];case et.Q8_0:return[32,34];case et.Q4_K:return[256,144];case et.Q6_K:return[256,210];case et.Q1_0:return[128,18];case et.Q2_0:return[64,18];case et.PQ2_0:return[128,34];case et.PTQ1_0:return[128,28];default:throw new Error(`hachiue: unsupported GGML tensor type ${s}`)}}function Br(s,r){let[n,o]=se(r),e=s.reduce((u,_)=>u*_,1);if(e%n!==0)throw new Error(`hachiue: tensor elements (${e}) not divisible by block size (${n})`);return e/n*o}function be(s){let r=s&32768?-1:1,n=s>>10&31,o=s&1023;return n===0?r*o*2**-24:n===31?o?NaN:r*(1/0):r*(1024+o)*2**(n-25)}function Mr(s){let r=new DataView(s.buffer,s.byteOffset,s.byteLength),n=new TextDecoder,o=0,e=B=>{if(o+B>s.byteLength)throw new pe},u=()=>(e(1),r.getUint8(o++)),_=()=>(e(1),r.getInt8(o++)),g=()=>{e(2);let B=r.getUint16(o,!0);return o+=2,B},d=()=>{e(2);let B=r.getInt16(o,!0);return o+=2,B},x=()=>{e(4);let B=r.getUint32(o,!0);return o+=4,B},P=()=>{e(4);let B=r.getInt32(o,!0);return o+=4,B},i=()=>{e(4);let B=r.getFloat32(o,!0);return o+=4,B},f=()=>{e(8);let B=r.getFloat64(o,!0);return o+=8,B},b=()=>{e(8);let B=r.getUint32(o,!0),h=r.getUint32(o+4,!0);return o+=8,h*4294967296+B},m=()=>{e(8);let B=r.getUint32(o,!0),h=r.getInt32(o+4,!0);return o+=8,h*4294967296+B},y=()=>{let B=b();e(B);let h=n.decode(s.subarray(o,o+B));return o+=B,h},A=B=>{switch(B){case 0:return u();case 1:return _();case 2:return g();case 3:return d();case 4:return x();case 5:return P();case 6:return i();case 7:return u()!==0;case 8:return y();case 9:{let h=x(),v=b(),C=new Array(v);for(let R=0;R<v;R++)C[R]=A(h);return C}case 10:return b();case 11:return m();case 12:return f();default:throw new Error(`hachiue: unknown GGUF metadata value type ${B}`)}};if(x()!==sn)throw new Error("hachiue: invalid GGUF magic header");let H=x();if(H!==2&&H!==3)throw new Error(`hachiue: unsupported GGUF version ${H}`);let V=b(),K=b(),I={};for(let B=0;B<K;B++){let h=y(),v=x();I[h]=A(v)}let U=[];for(let B=0;B<V;B++){let h=y(),v=x(),C=[];for(let it=0;it<v;it++)C.push(b());let R=x(),j=b();U.push({name:h,dims:C,type:R,relOffset:j})}let Q=Number(I["general.alignment"]??an),E=Math.ceil(o/Q)*Q,F={},S=E;for(let B of U){let h=Br(B.dims,B.type),v=E+B.relOffset;F[B.name]={name:B.name,dims:B.dims,type:B.type,relOffset:B.relOffset,absOffset:v,byteLength:h},v+h>S&&(S=v+h)}let p=un(I,F),O=cn(I);return{version:H,tensorCount:V,kvCount:K,dataStartOffset:E,totalFileSize:S,meta:I,tensors:F,arch:p,tokenizer:O}}function un(s,r){let n=String(s["general.architecture"]??"");if(n!=="qwen3"&&n!=="qwen35"&&n!=="plamo3")throw new Error(`hachiue: unsupported model architecture "${n}" (expected "qwen3", "qwen35", or "plamo3")`);let o=h=>s[`${n}.${h}`],e=h=>{let v=o(h);if(v===void 0)throw new Error(`hachiue: missing required GGUF metadata ${n}.${h}`);return Number(v)},u=e("block_count"),_=e("embedding_length"),g=e("feed_forward_length"),d=e("attention.head_count"),x=e("attention.head_count_kv"),P=Number(o("attention.key_length")??_/d),i=e("attention.layer_norm_rms_epsilon"),f=e("context_length"),b=r["token_embd.weight"];if(!b)throw new Error("hachiue: missing token_embd.weight tensor");let m=b.dims[1],y=!("output.weight"in r),A=Number(s["tokenizer.ggml.eos_token_id"]??151645),H=s["tokenizer.ggml.eom_token_id"]!==void 0?Number(s["tokenizer.ggml.eom_token_id"]):void 0,V=s["tokenizer.ggml.eot_token_id"]!==void 0?Number(s["tokenizer.ggml.eot_token_id"]):void 0,K=s["tokenizer.ggml.bos_token_id"]!==void 0?Number(s["tokenizer.ggml.bos_token_id"]):void 0,I=s["tokenizer.ggml.padding_token_id"]!==void 0?Number(s["tokenizer.ggml.padding_token_id"]):void 0,U=Number(o("rope.freq_base")??1e6),Q=o("rope.freq_base_swa")!==void 0?Number(o("rope.freq_base_swa")):void 0,E=String(o("rope.scaling.type")??"none"),F=Number(o("rope.dimension_count")??P),S={theta:U,localTheta:Q,type:E==="yarn"?"yarn":n==="qwen35"?"mrope":"normal",factor:Number(o("rope.scaling.factor")??1),originalMaxPositions:Number(o("rope.scaling.original_context_length")??f),rotaryDim:F,yarnBetaFast:o("rope.scaling.yarn_beta_fast")!==void 0?Number(o("rope.scaling.yarn_beta_fast")):void 0,yarnBetaSlow:o("rope.scaling.yarn_beta_slow")!==void 0?Number(o("rope.scaling.yarn_beta_slow")):void 0,yarnTruncate:o("rope.scaling.yarn_truncate")!==void 0?!!o("rope.scaling.yarn_truncate"):void 0},p;if(n==="plamo3"&&o("attention.sliding_window")!==void 0){let h=Number(o("attention.sliding_window")),v=Number(o("attention.sliding_window_pattern")??8),C=[];for(let R=0;R<u;R++)C.push((R+1)%v===0?"full":"swa");p={windowSize:h,pattern:v,layerTypes:C}}let O;if(n==="qwen35"){let h=e("full_attention_interval"),v=e("ssm.group_count"),C=e("ssm.time_step_rank"),R=e("ssm.state_size"),j=e("ssm.conv_kernel"),it=[];for(let Y=0;Y<u;Y++)it.push(Y%h===h-1?"full":"linear");O={layerTypes:it,linearKeyHeads:v,linearValueHeads:C,linearHeadDim:R,convKernel:j}}let B;if(s["prism.hadamard.version"]!==void 0){let h=Number(s["prism.hadamard.version"]),v=Number(s["prism.hadamard.block_size"]??512),C=!!(s["prism.hadamard.tied_output"]??!1),R=!!(s["prism.hadamard.gdn_v_grouped"]??!1),j=String(s["prism.hadamard.sign_mode"]??"identity"),it=s["prism.hadamard.weight_names"]??[],Y=s["prism.hadamard.inverse_weight_names"]??[],ht=new Map;if(j==="explicit"){let Dt=s["prism.hadamard.sign_widths"]??[],St=s["prism.hadamard.sign_values"]??[],ut=0;for(let bt of Dt){let Lt=new Int8Array(bt);for(let Ot=0;Ot<bt;Ot++)Lt[Ot]=St[ut+Ot];ht.set(bt,Lt),ut+=bt}}let yt=new Set(it);C&&Y.includes("token_embd.weight")&&yt.add("output.weight"),B={version:h,blockSize:v,tiedOutput:C,gdnVGrouped:R,signMode:j,signsByWidth:ht,foldedWeights:yt,inverseWeights:new Set(Y)}}return{archName:n,modelName:String(s["general.name"]??n),sizeLabel:String(s["general.size_label"]??""),layers:u,hidden:_,intermediate:g,heads:d,kvHeads:x,headDim:P,rmsEps:i,maxPositions:f,vocab:m,eosTokenId:A,eomTokenId:H,eotTokenId:V,bosTokenId:K,padTokenId:I,tieWordEmbeddings:y,rope:S,hybrid:O,swa:p,hadamard:B}}function cn(s){let r=s["tokenizer.ggml.tokens"];if(!r)return;let n=String(s["tokenizer.ggml.model"]??"gpt2"),o=s["tokenizer.ggml.merges"]??[],e=s["tokenizer.ggml.scores"];if(!(n!=="plamo3"&&o.length===0&&!e))return{model:n,tokens:r,scores:e,tokenTypes:s["tokenizer.ggml.token_type"],merges:o,eosTokenId:Number(s["tokenizer.ggml.eos_token_id"]??151645),eomTokenId:s["tokenizer.ggml.eom_token_id"]!==void 0?Number(s["tokenizer.ggml.eom_token_id"]):void 0,eotTokenId:s["tokenizer.ggml.eot_token_id"]!==void 0?Number(s["tokenizer.ggml.eot_token_id"]):void 0,bosTokenId:s["tokenizer.ggml.bos_token_id"]!==void 0?Number(s["tokenizer.ggml.bos_token_id"]):void 0,padTokenId:s["tokenizer.ggml.padding_token_id"]!==void 0?Number(s["tokenizer.ggml.padding_token_id"]):void 0,addBosToken:!!(s["tokenizer.ggml.add_bos_token"]??!1),chatTemplate:s["tokenizer.chat_template"],breakAroundConsecutiveSpacesThreshold:s["tokenizer.ggml.break_around_consecutive_spaces_threshold"]!==void 0?Number(s["tokenizer.ggml.break_around_consecutive_spaces_threshold"]):void 0,breakAroundRepeatedCharsThreshold:s["tokenizer.ggml.break_around_repeated_chars_threshold"]!==void 0?Number(s["tokenizer.ggml.break_around_repeated_chars_threshold"]):void 0}}async function Re(s,r,n,o,e){let u=n-r+1,_=await fetch(s,{headers:{Range:`bytes=${r}-${n}`},signal:o});if(_.status===206){if(_.body&&e){let d=_.body.getReader(),x=new Uint8Array(u),P=0,i=0;try{for(;P<u;){let{done:f,value:b}=await d.read();if(f)break;let m=Math.min(b.byteLength,u-P);x.set(b.subarray(0,m),P),P+=m,(P-i>=512*1024||P===u)&&(i=P,e(P))}}finally{d.releaseLock()}return P===u?x:x.subarray(0,P)}let g=await _.arrayBuffer();return e?.(g.byteLength),new Uint8Array(g)}if(_.ok&&_.body){let g=_.body.getReader(),d=new Uint8Array(u),x=0,P=0;try{for(;P<u;){let{done:i,value:f}=await g.read();if(i)break;if(x+f.byteLength>r){let b=Math.max(0,r-x),m=Math.min(f.byteLength,b+(u-P));d.set(f.subarray(b,m),P),P+=m-b}x+=f.byteLength}}finally{await g.cancel().catch(()=>{})}return d.subarray(0,P)}throw new Error(`hachiue: HTTP Range fetch failed (${_.status} ${_.statusText}) for ${s}`)}async function me(s,r={}){let n=r.fetchRange??Re,o=r.useCache??!0;r.onProgress?.({phase:"header",message:"Fetching GGUF header..."});let e=async(x,P)=>{if(o&&!r.fetchRange){let i=await Te(s,x,P);if(i)return i}return n(s,x,P,r.signal)},u=on,_=!1,g=null;o&&!r.fetchRange&&(g=await Te(s,0,u-1)),g||(g=await n(s,0,u-1,r.signal),_=!0);let d=new Uint8Array(g);for(;;)try{let x=Mr(d);return _&&o&&(ge={url:s,bytes:d}),x}catch(x){if(!(x instanceof pe))throw x;if(d.byteLength<u)throw new Error(`hachiue: GGUF file at ${s} is truncated inside the header (${d.byteLength} bytes)`);if(u>=or)throw new Error(`hachiue: GGUF header exceeds ${or} bytes`);let P=Math.min(u*2,or),i=await e(d.byteLength,P-1),f=new Uint8Array(d.byteLength+i.byteLength);f.set(d,0),f.set(i,d.byteLength),d=f,u=P}}var ir={embed_gather:`
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
`};function Ue(s,r,n,o={}){let e=o.temperature??.6,u=o.topK??20,_=o.topP??.95,g=o.minP??0,d=o.repetitionPenalty??1;if(d!==1&&n.length>0){let S=new Set(n.slice(-128));for(let p of S)if(p>=0&&p<r){let O=s[p];s[p]=O<0?O*d:O/d}}if(e<=0){let S=0,p=s[0];for(let O=1;O<r;O++)s[O]>p&&(p=s[O],S=O);return S}let x=Math.max(1,Math.min(u>0?u:64,r)),P=new Int32Array(x).fill(-1),i=new Float32Array(x).fill(-1/0),f=0,b=-1/0;for(let S=0;S<r;S++){let p=s[S];if(p>b){P[f]=S,i[f]=p,f=0,b=i[0];for(let O=1;O<x;O++)i[O]<b&&(b=i[O],f=O)}}let m=Array.from({length:x},(S,p)=>p).filter(S=>P[S]>=0).sort((S,p)=>i[p]-i[S]);if(m.length===0)return 0;if(m.length===1)return P[m[0]];let y=i[m[0]],A=1/e,H=new Float32Array(m.length),V=0;for(let S=0;S<m.length;S++){let p=Math.exp((i[m[S]]-y)*A);H[S]=p,V+=p}for(let S=0;S<H.length;S++)H[S]/=V;let K=H[0],I=g*K,U=0,Q=H.length;for(let S=0;S<H.length;S++){if(S>0&&H[S]<I){Q=S;break}if(U+=H[S],U>=_){Q=S+1;break}}let E=0;for(let S=0;S<Q;S++)E+=H[S];let F=Math.random()*E;for(let S=0;S<Q;S++)if(F-=H[S],F<=0)return P[m[S]];return P[m[Q-1]]}function ln(){let s=[];for(let u=33;u<=126;u++)s.push(u);for(let u=161;u<=172;u++)s.push(u);for(let u=174;u<=255;u++)s.push(u);let r=[...s],n=0;for(let u=0;u<256;u++)s.includes(u)||(s.push(u),r.push(256+n),n++);let o=new Array(256),e=new Map;for(let u=0;u<256;u++){let _=String.fromCodePoint(r[u]);o[s[u]]=_,e.set(_,s[u])}return{byteToChar:o,charToByte:e}}var{byteToChar:dn,charToByte:_n}=ln(),fn=new RegExp("(?:'[sSdDmMtT]|'[rR][eE]|'[vV][eE]|'[lL][lL])|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+","gu"),Xe=-2e7,hn=-1e7,He="\uEE00",mn=60928,Ar=1e7,we=class{model;tokens;tokenToIdMap;mergeRanks;specialTokens;specialTokenIds;specialRegex;isPlamo3;unigramRoot;byteTokenIds;plamoSpRegex;plamoBoundaryRegex;addBosToken;eosTokenId;eomTokenId;eotTokenId;bosTokenId;padTokenId;constructor(r){this.model=r.model??"gpt2",this.isPlamo3=this.model==="plamo3",this.tokens=r.tokens,this.addBosToken=r.addBosToken,this.eosTokenId=r.eosTokenId,this.eomTokenId=r.eomTokenId,this.eotTokenId=r.eotTokenId,this.bosTokenId=r.bosTokenId,this.padTokenId=r.padTokenId,this.tokenToIdMap=new Map,this.specialTokens=[],this.specialTokenIds=new Set;for(let n=0;n<r.tokens.length;n++){let o=r.tokens[n];this.tokenToIdMap.set(o,n);let e=r.tokenTypes?.[n];this.isPlamo3?(e===2||e===3)&&(this.specialTokens.push(o),this.specialTokenIds.add(n)):(e!==void 0&&e!==1||o.startsWith("<")&&o.endsWith(">")&&o.length>2)&&(o.startsWith("[PAD")||(this.specialTokens.push(o),this.specialTokenIds.add(n)))}if(this.isPlamo3){this.specialRegex=null,this.mergeRanks=new Map;let n={children:new Map,tokenId:-1,score:Xe},o=new Int32Array(256),e=r.scores??[],u=r.tokenTypes??[];for(let x=0;x<r.tokens.length;x++){let P=r.tokens[x];if((u[x]??1)===6&&P.length===6&&P.startsWith("<0x")&&P.endsWith(">")){let m=Number.parseInt(P.slice(3,5),16);!Number.isNaN(m)&&m>=0&&m<256&&(o[m]=x);continue}let f=n;for(let m=0;m<P.length;){let y=P.codePointAt(m);m+=y>65535?2:1;let A=f.children.get(y);A||(A={children:new Map,tokenId:-1,score:Xe},f.children.set(y,A)),f=A}f.tokenId=x;let b=e[x]??0;f.score=Number.isFinite(b)?Math.round(b*1e4):Xe}n.children.set(mn,{children:new Map,tokenId:Ar,score:0}),this.unigramRoot=n,this.byteTokenIds=o,this.plamoSpRegex=/(<\|plamo:[^|\s]{0,64}\|>)/g;let _=r.breakAroundConsecutiveSpacesThreshold??2,g=r.breakAroundRepeatedCharsThreshold??4,d=[];g>1&&d.push(`(.)\\2{${g-1},}`),_>1&&d.push(` {${_},}`),this.plamoBoundaryRegex=d.length>0?new RegExp(`(${d.join("|")})`,"gu"):null}else{if(this.unigramRoot=null,this.byteTokenIds=null,this.plamoSpRegex=null,this.plamoBoundaryRegex=null,this.specialTokens.sort((n,o)=>o.length-n.length),this.specialTokens.length>0){let n=this.specialTokens.map(o=>o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));this.specialRegex=new RegExp(`(${n.join("|")})`,"g")}else this.specialRegex=null;this.mergeRanks=new Map;for(let n=0;n<r.merges.length;n++)this.mergeRanks.set(r.merges[n],n)}}getTokenId(r){return this.tokenToIdMap.get(r)}bpe(r){let n=this.tokenToIdMap.get(r);if(n!==void 0&&r.length<=1)return[n];let o=Array.from(r);for(;o.length>1;){let u=1/0,_=-1;for(let i=0;i<o.length-1;i++){let f=`${o[i]} ${o[i+1]}`,b=this.mergeRanks.get(f);b!==void 0&&b<u&&(u=b,_=i)}if(_===-1)break;let g=o[_],d=o[_+1],x=[],P=0;for(;P<o.length;)P<o.length-1&&o[P]===g&&o[P+1]===d?(x.push(g+d),P+=2):(x.push(o[P]),P++);o=x}let e=[];for(let u of o){let _=this.tokenToIdMap.get(u);_!==void 0&&e.push(_)}return e}encodePlainSegment(r){if(!r)return[];let n=new TextEncoder,o=[],e=r.match(fn)??[r];for(let u of e){let _=n.encode(u),g="";for(let d=0;d<_.length;d++)g+=dn[_[d]];o.push(...this.bpe(g))}return o}encodePlamo3(r){if(!r||!this.unigramRoot||!this.byteTokenIds)return[];let n=r;this.plamoSpRegex&&(n=n.replace(this.plamoSpRegex,`${He}$1${He}`)),this.plamoBoundaryRegex&&(n=n.replace(this.plamoBoundaryRegex,`${He}$1${He}`));let o=[];for(let m=0;m<n.length;){let y=n.codePointAt(m);o.push(y),m+=y>65535?2:1}let e=o.length,u=new Float64Array(e+1);u.fill(1e18),u[e]=0;let _=new Int32Array(e+1),g=new Int32Array(e+1);g.fill(-1);let d=[],x=[],P=[];for(let m=e-1;m>=0;m--){d.length=0,x.length=0,P.length=0;let y=this.unigramRoot,A=m;for(;A<e&&(y=y.children.get(o[A]),!!y);)A++,y.score>Xe&&(d.push(A-m),x.push(y.tokenId),P.push(y.score));let H=1e18,V=1,K=-1;for(let U=d.length-1;U>=0;U--){let Q=d[U],E=u[m+Q]-P[U];E<H&&(H=E,V=Q,K=x[U])}let I=u[m+1]-hn;I<H&&(H=I,V=1,K=-1),u[m]=H,_[m]=V,g[m]=K}let i=new TextEncoder,f=[],b=0;for(;b<e;){let m=g[b];if(m>=0)m!==Ar&&f.push(m);else{let y=i.encode(String.fromCodePoint(o[b]));for(let A=0;A<y.length;A++)f.push(this.byteTokenIds[y[A]])}b+=_[b]}return f}encode(r){if(!r)return[];if(this.isPlamo3)return this.encodePlamo3(r);if(!this.specialRegex)return this.encodePlainSegment(r);let n=[],o=0;this.specialRegex.lastIndex=0;let e;for(;(e=this.specialRegex.exec(r))!==null;){e.index>o&&n.push(...this.encodePlainSegment(r.slice(o,e.index)));let u=this.tokenToIdMap.get(e[0]);u!==void 0?n.push(u):n.push(...this.encodePlainSegment(e[0])),o=this.specialRegex.lastIndex}return o<r.length&&n.push(...this.encodePlainSegment(r.slice(o))),n}decode(r,n=!0){let o=[],e=new TextEncoder;for(let u of r){if(n&&this.specialTokenIds.has(u))continue;let _=this.tokens[u];if(_!==void 0)if(this.isPlamo3){if(_.length===6&&_.startsWith("<0x")&&_.endsWith(">")){let d=Number.parseInt(_.slice(3,5),16);if(!Number.isNaN(d)){o.push(d);continue}}let g=e.encode(_);for(let d=0;d<g.length;d++)o.push(g[d])}else if(this.specialTokenIds.has(u)){let g=e.encode(_);for(let d of g)o.push(d)}else for(let g of _){let d=_n.get(g);if(d!==void 0)o.push(d);else{let x=e.encode(g);for(let P of x)o.push(P)}}}return new TextDecoder("utf-8",{fatal:!1}).decode(new Uint8Array(o))}createDecoderStream(r=!0){let n=[],o=0;return{push:e=>{n.push(e);let u=this.decode(n,r),_=u.length;for(;_>o&&u.charCodeAt(_-1)===65533;)_--;let g=u.slice(o,_);return o=_,g},flush:()=>{if(n.length===0)return"";let e=this.decode(n,r),u=e.slice(o);return o=e.length,u}}}tokenToId(r){return this.tokenToIdMap.get(r)}formatChat(r,n={}){if(this.isPlamo3){let _=n.targetLang??"ja",d=`${this.bosTokenId!==void 0?this.tokens[this.bosTokenId]??"<|plamo:bos|>":"<|plamo:bos|>"}<|plamo:tag|>dataset<|plamo:msg|>translation`,x=r.filter(f=>f.role!=="system"),P=r.find(f=>f.role==="system");P?.content?.trim()&&(d+=`<|plamo:tag|>context<|plamo:msg|>${P.content.trim()}`);for(let f=0;f<x.length-1;f++){let b=x[f];b.role==="user"?(d+="<|plamo:tag|>input",n.sourceLang&&(d+=`<|plamo:key|>lang<|plamo:val|>${n.sourceLang}`),d+=`<|plamo:msg|>${b.content}`):d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${_}<|plamo:msg|>${b.content}`}let i=x[x.length-1];return i&&(d+="<|plamo:tag|>input",n.sourceLang&&(d+=`<|plamo:key|>lang<|plamo:val|>${n.sourceLang}`),d+=`<|plamo:msg|>${i.content}<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${_}<|plamo:msg|>`),d}let o=n.addGenerationPrompt??!0,e=n.enableThinking??!1,u="";for(let _ of r)_.role==="assistant"&&!e&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")&&!_.content.startsWith("<think>")?u+=`<|im_start|>assistant
<think>

</think>

${_.content}<|im_end|>
`:u+=`<|im_start|>${_.role}
${_.content}<|im_end|>
`;return o&&(u+=`<|im_start|>assistant
`,!e&&this.tokenToIdMap.has("<think>")&&this.tokenToIdMap.has("</think>")?u+=`<think>

</think>

`:e&&this.tokenToIdMap.has("<think>")&&(u+=`<think>
`)),u}};function Xt(s){let r=[],n=s>>>0;do{let o=n&127;n>>>=7,n!==0&&(o|=128),r.push(o)}while(n!==0);return r}function gn(s){let r=[],n=s|0,o=!0;for(;o;){let e=n&127;n>>=7,n===0&&(e&64)===0||n===-1&&(e&64)!==0?o=!1:e|=128,r.push(e)}return r}function pn(s){let r=new ArrayBuffer(4);return new DataView(r).setFloat32(0,s,!0),Array.from(new Uint8Array(r))}function Ut(s){let r=new ArrayBuffer(16),n=new DataView(r);for(let o=0;o<8;o++)n.setInt16(o*2,s,!0);return[253,...Xt(12),...new Uint8Array(r)]}function w(s,...r){return[253,...Xt(s),...r]}function nt(s,r,n=0){return[253,...Xt(s),...Xt(r),...Xt(n)]}function mt(s,r,n=0){return[s,...Xt(r),...Xt(n)]}function l(s){return[65,...gn(s)]}function It(s){return[67,...pn(s)]}function t(s){return[32,...Xt(s)]}function a(s){return[33,...Xt(s)]}function ft(s){return[34,...Xt(s)]}function At(s){return[...t(s),...w(27,0),...t(s),...w(27,1),106,...t(s),...w(27,2),106,...t(s),...w(27,3),106]}function bn(s){return[...t(s),...w(31,0),...t(s),...w(31,1),146,...t(s),...w(31,2),146,...t(s),...w(31,3),146]}function Tt(s,r=0){return[...s,...mt(47,1,r),...l(2),116,...mt(42,2,0)]}function kt(s,r,n,o,e,u,_){return[...t(s),...t(e),108,...t(o),106,...t(r),106,...l(2),116,...l(1048576),106,...ft(_),...t(n),4,125,...t(_),...mt(42,2,0),...t(u),146,5,...t(u),11,...mt(56,2,0)]}function wn(){let d=[...l(0),...a(7),2,64,3,64,...t(7),...t(0),79,13,1,...l(0),...a(8),2,64,3,64,...t(8),...t(1),79,13,1,...It(0),...w(19),...a(14),...t(7),...t(2),108,...l(2),116,...l(266240),106,...a(10),...t(3),...t(8),...t(2),108,...l(2),116,106,...a(11),...l(0),...a(9),2,64,3,64,...t(9),...t(2),79,13,1,...t(14),...t(10),...nt(0,2,0),...t(11),...nt(0,2,0),...w(230),...w(228),...a(14),...t(10),...l(16),106,...a(10),...t(11),...l(16),106,...a(11),...t(9),...l(4),106,...a(9),12,0,11,11,...bn(14),...a(13),...kt(7,8,4,5,6,13,12),...t(8),...l(1),106,...a(8),12,0,11,11,...t(7),...l(1),106,...a(7),12,0,11,11,11];return ee([[6,127],[1,125],[1,123]],d)}function Pn(){let p=(B,h)=>[...t(h),...t(B),...t(12),106,...mt(45,0,0),...l(3),116,...nt(1,3,262144),...t(34),...w(186),...w(174),...a(h)],O=[...t(3),...l(4),116,...a(22),...t(3),...l(1),116,...a(23),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...l(3),106,...t(1),79,13,1,...It(0),...a(25),...It(0),...a(26),...It(0),...a(27),...It(0),...a(28),...t(4),...t(10),...t(22),108,106,...ft(14),...t(22),106,...ft(15),...t(22),106,...ft(16),...t(22),106,...a(17),...t(5),...t(10),...t(23),108,106,...ft(18),...t(23),106,...ft(19),...t(23),106,...ft(20),...t(23),106,...a(21),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...ft(30),...ft(31),...ft(32),...a(33),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(13),...l(0),...a(12),2,64,3,64,...t(12),...l(16),79,13,1,...t(13),...t(12),...l(4),116,106,...nt(0,4,0),...a(34),...p(14,30),...p(15,31),...p(16,32),...p(17,33),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(26),...At(31),178,...Tt(t(19),0),148,...t(29),148,146,...a(26),...t(27),...At(32),178,...Tt(t(20),0),148,...t(29),148,146,...a(27),...t(28),...At(33),178,...Tt(t(21),0),148,...t(29),148,146,...a(28),...t(14),...l(16),106,...a(14),...t(15),...l(16),106,...a(15),...t(16),...l(16),106,...a(16),...t(17),...l(16),106,...a(17),...t(18),...l(2),106,...a(18),...t(19),...l(2),106,...a(19),...t(20),...l(2),106,...a(20),...t(21),...l(2),106,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,26,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,27,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,28,24),...t(10),...l(1),106,...a(10),12,0,11,11,2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(25),...t(4),...t(10),...t(22),108,106,...a(14),...t(5),...t(10),...t(23),108,106,...a(18),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(30),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(13),...l(0),...a(12),2,64,3,64,...t(12),...l(16),79,13,1,...t(13),...t(12),...l(4),116,106,...nt(0,4,0),...a(34),...p(14,30),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(14),...l(16),106,...a(14),...t(18),...l(2),106,...a(18),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[16,127],[5,125],[5,123]],O)}function yn(){let R=(it,Y)=>[...t(it),...t(12),...l(3),116,106,...nt(2,3,0),...a(38),...t(Y),...t(38),...t(39),...w(78),...t(40),...w(145),...t(34),...w(186),...t(38),...l(2),...w(141),...t(39),...w(78),...t(40),...w(145),...t(35),...w(186),...w(174),...t(38),...l(4),...w(141),...t(39),...w(78),...t(40),...w(145),...t(36),...w(186),...t(38),...l(6),...w(141),...t(40),...w(145),...t(37),...w(186),...w(174),...w(174),...w(174),...a(Y)],j=[...Ut(3),...a(39),...Ut(1),...a(40),...t(3),...l(5),116,...a(22),...t(3),...l(1),116,...a(23),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...l(3),106,...t(1),79,13,1,...It(0),...a(25),...It(0),...a(26),...It(0),...a(27),...It(0),...a(28),...t(4),...t(10),...t(22),108,106,...ft(14),...t(22),106,...ft(15),...t(22),106,...ft(16),...t(22),106,...a(17),...t(5),...t(10),...t(23),108,106,...ft(18),...t(23),106,...ft(19),...t(23),106,...ft(20),...t(23),106,...a(21),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...ft(30),...ft(31),...ft(32),...a(33),...l(0),...a(12),2,64,3,64,...t(12),...l(4),79,13,1,...t(9),...t(3),108,...t(11),106,...l(8),116,...t(12),...l(6),116,106,...l(659456),106,...ft(13),...nt(0,4,0),...a(34),...t(13),...nt(0,4,16),...a(35),...t(13),...nt(0,4,32),...a(36),...t(13),...nt(0,4,48),...a(37),...R(14,30),...R(15,31),...R(16,32),...R(17,33),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(26),...At(31),178,...Tt(t(19),0),148,...t(29),148,146,...a(26),...t(27),...At(32),178,...Tt(t(20),0),148,...t(29),148,146,...a(27),...t(28),...At(33),178,...Tt(t(21),0),148,...t(29),148,146,...a(28),...t(14),...l(32),106,...a(14),...t(15),...l(32),106,...a(15),...t(16),...l(32),106,...a(16),...t(17),...l(32),106,...a(17),...t(18),...l(2),106,...a(18),...t(19),...l(2),106,...a(19),...t(20),...l(2),106,...a(20),...t(21),...l(2),106,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,26,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,27,24),...t(10),...l(1),106,...a(10),...kt(9,10,6,7,8,28,24),...t(10),...l(1),106,...a(10),12,0,11,11,2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(25),...t(4),...t(10),...t(22),108,106,...a(14),...t(5),...t(10),...t(23),108,106,...a(18),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(30),...l(0),...a(12),2,64,3,64,...t(12),...l(4),79,13,1,...t(9),...t(3),108,...t(11),106,...l(8),116,...t(12),...l(6),116,106,...l(659456),106,...ft(13),...nt(0,4,0),...a(34),...t(13),...nt(0,4,16),...a(35),...t(13),...nt(0,4,32),...a(36),...t(13),...nt(0,4,48),...a(37),...R(14,30),...t(12),...l(1),106,...a(12),12,0,11,11,...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(29),...t(25),...At(30),178,...Tt(t(18),0),148,...t(29),148,146,...a(25),...t(14),...l(32),106,...a(14),...t(18),...l(2),106,...a(18),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,25,24),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[16,127],[5,125],[11,123]],j)}function On(){let E=(O,B)=>[...B===null?t(O):[...t(O),...t(B),...w(149),...t(24),...w(78)],...t(25),...w(149),...l(8),...w(141),...t(26),...w(145)],F=[null,27,28,29,30],S=[];for(let O=0;O<5;O++){let B=F[O];S.push(...t(20),...E(21,B),...t(12),...nt(0,4,O*32),...w(186),...w(174),...a(20)),S.push(...t(20),...E(22,B),...t(12),...nt(0,4,O*32+16),...w(186),...w(174),...a(20)),S.push(...t(20),...E(23,B),...t(12),...nt(0,4,160+O*16),...w(186),...w(174),...a(20))}let p=[...Ut(255),...a(24),...Ut(3),...ft(25),...a(27),...Ut(1),...a(26),...Ut(9),...a(28),...Ut(27),...a(29),...Ut(81),...a(30),...l(264192),...nt(0,4,0),...a(31),...t(3),...l(26),108,...a(15),...t(3),...l(1),116,...a(16),...l(0),...a(9),2,64,3,64,...t(9),...t(0),79,13,1,...l(0),...a(10),2,64,3,64,...t(10),...t(1),79,13,1,...It(0),...a(18),...t(4),...t(10),...t(15),108,106,...a(13),...t(5),...t(10),...t(16),108,106,...a(14),...l(0),...a(11),2,64,3,64,...t(11),...t(3),79,13,1,...l(0),...w(17),...a(20),...t(9),...t(3),108,...t(11),106,...l(8),116,...l(528384),106,...a(12),...t(13),...nt(2,0,0),...a(21),...t(13),...nt(2,0,8),...a(22),...t(13),...nt(2,0,16),...a(23),...S,...t(20),...t(13),...mt(47,0,24),...w(16),...w(136),...t(31),...w(149),...t(24),...w(78),...t(25),...w(149),...l(8),...w(141),...t(26),...w(145),...t(12),...nt(0,4,240),...w(186),...w(174),...a(20),...t(9),...t(3),108,...t(11),106,...l(2),116,...mt(42,2,790528),...a(19),...t(18),...At(20),178,...Tt(t(14),0),148,...t(19),148,146,...a(18),...t(13),...l(26),106,...a(13),...t(14),...l(2),106,...a(14),...t(11),...l(1),106,...a(11),12,0,11,11,...kt(9,10,6,7,8,18,17),...t(10),...l(1),106,...a(10),12,0,11,11,...t(9),...l(1),106,...a(9),12,0,11,11,11];return ee([[9,127],[2,125],[12,123]],p)}function xn(){let F=(p,O)=>[...t(p),...nt(2,0,2),...a(28),...t(p),...nt(2,0,10),...a(29),...t(28),...t(30),...w(78),...t(31),...w(145),...t(24),...w(186),...t(29),...t(30),...w(78),...t(31),...w(145),...t(25),...w(186),...w(174),...t(28),...l(4),...w(141),...t(31),...w(145),...t(26),...w(186),...t(29),...l(4),...w(141),...t(31),...w(145),...t(27),...w(186),...w(174),...w(174),...a(23),...t(O),...At(23),178,...Tt(t(p),0),148,...t(22),148,146,...a(O)],S=[...Ut(15),...a(30),...Ut(8),...a(31),...t(3),...l(18),108,...a(16),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...l(3),106,...t(1),79,13,1,...It(0),...a(18),...It(0),...a(19),...It(0),...a(20),...It(0),...a(21),...t(4),...t(9),...t(16),108,106,...ft(12),...t(16),106,...ft(13),...t(16),106,...ft(14),...t(16),106,...a(15),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(24),...t(11),...nt(0,4,16),...a(25),...t(11),...nt(0,4,32),...a(26),...t(11),...nt(0,4,48),...a(27),...t(8),...t(3),108,...t(10),106,...l(2),116,...mt(42,2,790528),...a(22),...F(12,18),...F(13,19),...F(14,20),...F(15,21),...t(12),...l(18),106,...a(12),...t(13),...l(18),106,...a(13),...t(14),...l(18),106,...a(14),...t(15),...l(18),106,...a(15),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,18,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,19,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,20,17),...t(9),...l(1),106,...a(9),...kt(8,9,5,6,7,21,17),...t(9),...l(1),106,...a(9),12,0,11,11,2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(18),...t(4),...t(9),...t(16),108,106,...a(12),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(24),...t(11),...nt(0,4,16),...a(25),...t(11),...nt(0,4,32),...a(26),...t(11),...nt(0,4,48),...a(27),...t(8),...t(3),108,...t(10),106,...l(2),116,...mt(42,2,790528),...a(22),...F(12,18),...t(12),...l(18),106,...a(12),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,18,17),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[10,127],[5,125],[9,123]],S)}function In(){let K=[...Ut(15),...a(26),...t(3),...l(20),108,...a(13),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(16),...t(4),...t(9),...t(13),108,106,...a(12),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...t(8),...t(3),108,...t(10),106,...ft(15),...l(6),116,...l(528384),106,...ft(11),...nt(0,4,0),...a(20),...t(11),...nt(0,4,16),...a(21),...t(11),...nt(0,4,32),...a(22),...t(11),...nt(0,4,48),...a(23),...t(15),...l(2),116,...ft(15),...mt(42,2,790528),...a(17),...t(15),...mt(42,2,806912),...a(18),...t(12),...nt(2,0,4),...a(24),...t(12),...nt(2,0,12),...a(25),...t(24),...t(26),...w(78),...t(20),...w(186),...t(25),...t(26),...w(78),...t(21),...w(186),...w(174),...t(24),...l(4),...w(141),...t(22),...w(186),...t(25),...l(4),...w(141),...t(23),...w(186),...w(174),...w(174),...a(19),...t(16),...At(19),178,...Tt(t(12),0),148,...t(17),148,...Tt(t(12),2),...t(18),148,146,146,...a(16),...t(12),...l(20),106,...a(12),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,16,14),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[8,127],[3,125],[8,123]],K)}function kn(){let S=(O,B,h)=>[...O,...l(4),73,4,64,...t(15),...O,106,...mt(45,0,4),...l(63),113,...a(B),...t(15),...O,106,...mt(45,0,8),...l(63),113,...a(h),5,...t(15),...O,106,...mt(45,0,8),...l(15),113,...t(15),...O,106,...mt(45,0,0),...l(6),118,...l(4),116,114,...a(B),...t(15),...O,106,...mt(45,0,8),...l(4),118,...t(15),...O,106,...mt(45,0,4),...l(6),118,...l(4),116,114,...a(h),11],p=[...Ut(15),...a(32),...t(3),...l(144),108,...a(17),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(23),...t(4),...t(9),...t(17),108,106,...a(15),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...Tt(t(15),0),...a(24),...Tt(t(15),2),...a(25),...l(0),...a(11),2,64,3,64,...t(11),...l(4),79,13,1,...t(11),...l(1),116,...a(12),...S(t(12),19,20),...S([...t(12),...l(1),106],21,22),...t(15),...t(11),...l(5),116,106,...ft(16),...nt(2,0,16),...a(28),...t(16),...nt(2,0,24),...a(29),...t(16),...nt(2,0,32),...a(30),...t(16),...nt(2,0,40),...a(31),...t(8),...t(3),108,...t(10),106,...l(3),116,...t(12),106,...ft(13),...l(6),116,...l(528384),106,...a(14),...t(28),...t(32),...w(78),...t(14),...nt(0,4,0),...w(186),...t(29),...t(32),...w(78),...t(14),...nt(0,4,16),...w(186),...w(174),...t(30),...t(32),...w(78),...t(14),...nt(0,4,32),...w(186),...t(31),...t(32),...w(78),...t(14),...nt(0,4,48),...w(186),...w(174),...w(174),...a(26),...t(28),...l(4),...w(141),...t(14),...nt(0,4,64),...w(186),...t(29),...l(4),...w(141),...t(14),...nt(0,4,80),...w(186),...w(174),...t(30),...l(4),...w(141),...t(14),...nt(0,4,96),...w(186),...t(31),...l(4),...w(141),...t(14),...nt(0,4,112),...w(186),...w(174),...w(174),...a(27),...t(13),...l(2),116,...a(13),...t(23),...t(24),...t(19),178,148,...t(13),...mt(42,2,790528),148,...At(26),178,148,...t(25),...t(20),178,148,...t(13),...mt(42,2,806912),148,147,146,...t(24),...t(21),178,148,...t(13),...mt(42,2,790532),148,...At(27),178,148,...t(25),...t(22),178,148,...t(13),...mt(42,2,806916),148,147,146,...a(23),...t(11),...l(1),106,...a(11),12,0,11,11,...t(15),...l(144),106,...a(15),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,23,18),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[15,127],[3,125],[7,123]],p)}function Dn(){let h=C=>[...t(13),...nt(2,0,C),...a(27),...t(13),...nt(2,0,32+C),...a(28),...t(14),...nt(2,0,C),...a(29),...t(23),...t(27),...t(30),...w(78),...t(29),...l(4),...w(139),...t(31),...w(78),...w(142),...t(32),...w(145),...t(33),...w(149),...t(17),...nt(0,4,C*2),...w(186),...w(174),...a(23),...t(24),...t(28),...t(30),...w(78),...t(29),...l(2),...w(139),...t(31),...w(78),...w(142),...t(32),...w(145),...t(34),...w(149),...t(17),...nt(0,4,64+C*2),...w(186),...w(174),...a(24),...t(25),...t(27),...l(4),...w(141),...t(29),...t(31),...w(78),...w(142),...t(32),...w(145),...t(35),...w(149),...t(17),...nt(0,4,128+C*2),...w(186),...w(174),...a(25),...t(26),...t(28),...l(4),...w(141),...t(29),...l(2),...w(141),...t(31),...w(78),...w(142),...t(32),...w(145),...t(36),...w(149),...t(17),...nt(0,4,192+C*2),...w(186),...w(174),...a(26)],v=[...Ut(15),...a(30),...Ut(48),...a(31),...Ut(32),...a(32),...t(3),...l(210),108,...a(19),...l(0),...a(8),2,64,3,64,...t(8),...t(0),79,13,1,...l(0),...a(9),2,64,3,64,...t(9),...t(1),79,13,1,...It(0),...a(21),...t(4),...t(9),...t(19),108,106,...a(18),...l(0),...a(10),2,64,3,64,...t(10),...t(3),79,13,1,...Tt(t(18),208),...a(22),...l(0),...a(11),2,64,3,64,...t(11),...l(2),79,13,1,...l(0),...w(17),...ft(23),...ft(24),...ft(25),...a(26),...t(8),...t(3),108,...t(10),106,...l(3),116,...t(11),...l(2),116,106,...a(16),...t(18),...t(11),...l(6),116,106,...a(13),...t(18),...l(128),106,...t(11),...l(5),116,106,...a(14),...t(18),...l(192),106,...t(11),...l(3),116,106,...a(15),...l(0),...a(12),2,64,3,64,...t(12),...l(2),79,13,1,...t(15),...t(12),106,...mt(44,0,0),...w(16),...a(33),...t(15),...t(12),106,...mt(44,0,2),...w(16),...a(34),...t(15),...t(12),106,...mt(44,0,4),...w(16),...a(35),...t(15),...t(12),106,...mt(44,0,6),...w(16),...a(36),...t(16),...l(6),116,...t(12),...l(5),116,106,...l(528384),106,...a(17),...h(0),...h(8),...t(13),...l(16),106,...a(13),...t(14),...l(16),106,...a(14),...t(12),...l(1),106,...a(12),12,0,11,11,...t(16),...l(2),116,...a(16),...t(21),...t(22),...At(23),178,...t(16),...mt(42,2,790528),148,...At(24),178,...t(16),...mt(42,2,790532),148,146,...At(25),178,...t(16),...mt(42,2,790536),148,...At(26),178,...t(16),...mt(42,2,790540),148,146,146,148,146,...a(21),...t(11),...l(1),106,...a(11),12,0,11,11,...t(18),...l(210),106,...a(18),...t(10),...l(1),106,...a(10),12,0,11,11,...kt(8,9,5,6,7,21,20),...t(9),...l(1),106,...a(9),12,0,11,11,...t(8),...l(1),106,...a(8),12,0,11,11,11];return ee([[13,127],[2,125],[14,123]],v)}function ee(s,r){let n=[...Xt(s.length)];for(let[e,u]of s)n.push(...Xt(e),u);let o=[...n,...r];return[...Xt(o.length),...o]}function Pe(s,r){return[s,...Xt(r.length),...r]}function ur(s){let r=Array.from(new TextEncoder().encode(s));return[...Xt(r.length),...r]}var $e=null;function cr(){if($e)return $e;let s=Pe(1,[3,96,7,127,127,127,127,127,127,127,0,96,9,127,127,127,127,127,127,127,127,127,0,96,8,127,127,127,127,127,127,127,127,0]),r=Pe(2,[1,...ur("env"),...ur("memory"),2,0,1]),n=Pe(3,[8,0,1,1,1,2,2,2,2]),o=["gemv_f32","gemv_q1_0","gemv_pq2_0","gemv_ptq1_0","gemv_q4_0","gemv_q4_1","gemv_q4_k","gemv_q6_k"],e=[o.length];for(let x=0;x<o.length;x++)e.push(...ur(o[x]),0,x);let u=Pe(7,e),_=[wn(),Pn(),yn(),On(),xn(),In(),kn(),Dn()],g=[_.length];for(let x of _)g.push(...x);let d=Pe(10,g);return $e=new Uint8Array([0,97,115,109,1,0,0,0,...s,...r,...n,...u,...d]),$e}function Ve(s){let f=s.arch,b=s.maxSeqLen,m=s.fp16Table,y=s.cos,A=s.sin,H=s.swaCos,V=s.swaSin,K=new Map(s.hadamardSigns),I=0,U=0;for(let k of s.tensors){let M=0;if(k.type===0||k.type===1)M=k.N*k.K*4+15&-16;else if(k.type===41||k.type===142||k.type===143){let q=k.type===41?16:k.type===142?32:26,rt=k.N*k.nb*q+15&-16,D=k.N*k.nb*2+15&-16;M=rt+D}else M=k.byteLength+15&-16;I+=M,M>U&&(U=M)}let Q=!0,E;try{let k=Math.ceil((5242880+I+65536)/65536);E=new WebAssembly.Memory({initial:k})}catch{Q=!1;let k=Math.ceil((5242880+U+65536)/65536);E=new WebAssembly.Memory({initial:k})}let F=new WebAssembly.Module(s.wasmBytes),p=new WebAssembly.Instance(F,{env:{memory:E}}).exports,O=E.buffer;new Float32Array(O,0,65536).set(m);let B=new Int8Array(O,262144,2048);for(let k=0;k<256;k++)for(let M=0;M<8;M++)B[k*8+M]=k>>M&1?1:-1;new Int16Array(O,264192,8).set([1,1,3,3,9,9,27,27]);let h=new Float32Array(O,266240,65536),v=new Int16Array(O,528384,65536),C=new Int16Array(O,659456,65536),R=new Float32Array(O,790528,4096),j=new Float32Array(O,806912,4096),it=new Float32Array(O,1048576,1048576),Y=new Map,ht=5242880;for(let k of s.tensors){let M=0,q=0,rt=0,D=k.type;if(k.type===0||k.type===1)D=0,M=k.K*4,q=k.N*M+15&-16;else if(k.type===41||k.type===142||k.type===143){let X=k.type===41?16:k.type===142?32:26;M=k.nb*X,q=k.N*M+15&-16,rt=k.N*k.nb*2+15&-16}else M=k.byteLength/k.N,q=k.byteLength+15&-16;let st=5242880,c=5242880+q,N,J,W;Q?(st=ht,ht+=q,c=ht,ht+=rt,N=new Uint8Array(O,st,k.N*M),J=new Uint8Array(O,c,rt>0?k.N*k.nb*2:0),D===0&&(W=new Float32Array(O,st,k.N*k.K))):(N=new Uint8Array(k.N*M),J=new Uint8Array(rt>0?k.N*k.nb*2:0),D===0&&(W=new Float32Array(N.buffer,N.byteOffset,k.N*k.K)));let L=k.type===41?18:k.type===142?34:k.type===143?28:0;Y.set(k.name,{type:D,N:k.N,K:k.K,nb:k.nb,rowBytes:M,hadamardFolded:k.hadamardFolded,quantsPtr:st,scalesPtr:c,quantsView:N,scalesView:J,f32View:W,rawF16:k.type===1?new Uint8Array(k.byteLength):void 0,writeCursor:0,leftover:new Uint8Array(L),leftoverLen:0,blockCursor:0})}function yt(k,M){let q=Y.get(k);if(!q)throw new Error(`hachiue: unknown tensor ${k}`);if(q.rawF16){q.rawF16.set(M,q.writeCursor),q.writeCursor+=M.byteLength;return}if(q.type===41||q.type===142||q.type===143){let rt=q.type===41?18:q.type===142?34:28,D=rt-2,st=q.quantsView,c=q.scalesView,N=(W,L)=>{let X=q.blockCursor++,z=X*D,T=X*2;q.type===143?(st.set(W.subarray(L,L+26),z),c[T]=W[L+26],c[T+1]=W[L+27]):(c[T]=W[L],c[T+1]=W[L+1],st.set(W.subarray(L+2,L+rt),z))},J=0;if(q.leftoverLen>0){let W=Math.min(rt-q.leftoverLen,M.byteLength);q.leftover.set(M.subarray(0,W),q.leftoverLen),q.leftoverLen+=W,J+=W,q.leftoverLen===rt&&(N(q.leftover,0),q.leftoverLen=0)}for(;J+rt<=M.byteLength;)N(M,J),J+=rt;J<M.byteLength&&(q.leftover.set(M.subarray(J),0),q.leftoverLen=M.byteLength-J);return}q.quantsView.set(M,q.writeCursor),q.writeCursor+=M.byteLength}function Dt(k){let M=Y.get(k);if(M){if(M.rawF16){let q=new DataView(M.rawF16.buffer,M.rawF16.byteOffset,M.rawF16.byteLength),rt=M.N*M.K,D=M.f32View;for(let st=0;st<rt;st++)D[st]=m[q.getUint16(st*2,!0)];M.rawF16=void 0}if(M.leftoverLen!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor ${k} (${M.leftoverLen} leftover bytes)`)}}function St(){if(f.tieWordEmbeddings){let k=Y.get("token_embd.weight");if(!k)throw new Error("hachiue: missing token_embd.weight");Y.set("output.weight",{...k,hadamardFolded:!!(f.hadamard?.foldedWeights.has("output.weight")||f.hadamard?.tiedOutput)})}}let ut=f.hidden,bt=f.intermediate,Lt=f.heads,Ot=f.kvHeads,wt=f.headDim,Rt=Lt*wt,Ht=Ot*wt,Jt=f.hybrid,ie=Jt?Jt.linearValueHeads:1,gr=Jt?Jt.linearHeadDim:1,ue=Jt?ie*gr:ut,pr=Jt?(Jt.linearKeyHeads*2+ie)*gr:Math.max(ut,Rt+2*Ht),Rr=Math.max(ut,bt,Rt,ue),Ge={curH:new Float32Array(8*ut),nextH:new Float32Array(8*ut),h2:new Float32Array(8*ut),n1:new Float32Array(8*ut),n2:new Float32Array(8*ut),rotBuf:new Float32Array(8*Rr),permBuf:new Float32Array(8*ue),qkvMixed:new Float32Array(8*pr),qkvConv:new Float32Array(8*pr),aProj:new Float32Array(8*ie),bProj:new Float32Array(8*ie),gbeta:new Float32Array(16*ie),core:new Float32Array(8*ue),zGate:new Float32Array(8*ue),normed:new Float32Array(8*ue),qgBuf:new Float32Array(8*Rt*(f.archName==="qwen35"?2:1)),qBuf:new Float32Array(8*Rt),gateBuf:new Float32Array(8*Rt),kBuf:new Float32Array(8*Ht),vBuf:new Float32Array(8*Ht),qNormed:new Float32Array(8*Rt),kNormed:new Float32Array(8*Ht),attOut:new Float32Array(8*Rt),mlpGate:new Float32Array(8*bt*(f.archName==="plamo3"?2:1)),mlpUp:new Float32Array(8*bt),swigluOut:new Float32Array(8*bt),lastHidden:new Float32Array(ut),finalNorm:new Float32Array(ut),logits:new Float32Array(f.vocab)},Qe=new Map,je=new Map,Ye=new Map,Je=new Map,Ze=new Map,tr=new Map,br=b*Ht,wr=b*(Ht>>5);for(let k=0;k<f.layers;k++)if(!(f.hybrid&&f.hybrid.layerTypes[k]==="linear"))Qe.set(k,new Int8Array(br)),je.set(k,new Float32Array(wr)),Ye.set(k,new Int8Array(br)),Je.set(k,new Float32Array(wr));else if(f.hybrid){let q=(f.hybrid.linearKeyHeads*2+f.hybrid.linearValueHeads)*f.hybrid.linearHeadDim,rt=(f.hybrid.convKernel-1)*q,D=f.hybrid.linearValueHeads*f.hybrid.linearHeadDim*f.hybrid.linearHeadDim;Ze.set(k,new Float32Array(rt)),tr.set(k,new Float32Array(D))}let Ft=0;function Ur(){Ft=0;for(let k of Ze.values())k.fill(0);for(let k of tr.values())k.fill(0)}function Pr(k,M,q,rt,D){if(!f.hadamard)return;let st=K.get(rt),c=.04419417382415922;for(let N=0;N<q;N++){let J=N*rt;for(let W=0;W<rt;W+=512){let L=J+W;if(D===0&&st)for(let X=0;X<512;X++)M[L+X]=k[L+X]*st[W+X];else for(let X=0;X<512;X++)M[L+X]=k[L+X];for(let X=1;X<512;X<<=1){let z=X<<1;for(let T=0;T<512;T+=z)for(let G=L+T;G<L+T+X;G++){let Z=M[G],$=M[G+X];M[G]=Z+$,M[G+X]=Z-$}}if(D===1&&st)for(let X=0;X<512;X++)M[L+X]=M[L+X]*c*st[W+X];else for(let X=0;X<512;X++)M[L+X]*=c}}}function zt(k,M,q,rt,D){let st=Y.get(M);if(!st?.f32View)throw new Error(`hachiue: missing norm tensor ${M}`);let c=st.f32View,N=f.rmsEps;for(let J=0;J<q;J++){let W=J*rt,L=0;for(let z=0;z<rt;z++){let T=k[W+z];L+=T*T}let X=1/Math.sqrt(L/rt+N);for(let z=0;z<rt;z++)D[W+z]=k[W+z]*X*c[z]}}function Xr(k,M,q,rt){let D=q>>7,st=M*D;for(let c=0;c<st;c++){let N=c<<7,J=0;for(let X=0;X<128;X++){let z=Math.abs(k[N+X]);z>J&&(J=z)}let W=J/16384,L=J>0?16384/J:0;R[c]=W;for(let X=0;X<128;X++)v[N+X]=Math.round(k[N+X]*L);if(rt)for(let X=0;X<4;X++){let z=N+(X<<5);for(let T=0;T<8;T++)C[z+T]=v[z+T*4+0],C[z+8+T]=v[z+T*4+1],C[z+16+T]=v[z+T*4+2],C[z+24+T]=v[z+T*4+3]}}}function Hr(k,M,q){let rt=q>>5,D=M*rt;for(let st=0;st<D;st++){let c=st<<5,N=0,J=0;for(let X=0;X<32;X++){let z=k[c+X];J+=z;let T=Math.abs(z);T>N&&(N=T)}let W=N/16384,L=N>0?16384/N:0;R[st]=W,j[st]=J;for(let X=0;X<32;X++)v[c+X]=Math.round(k[c+X]*L)}}let $t=null,Ae=0,er=!1;function qt(k,M,q,rt,D,st){let c=Y.get(k);if(!c)throw new Error(`hachiue: missing weight ${k}`);let N=M;if(c.hadamardFolded&&f.hadamard){let L=st.get(M);if(!L){let X=M;if(f.hadamard.gdnVGrouped&&k.includes(".ssm_out.")&&f.hybrid&&f.hybrid.linearValueHeads>f.hybrid.linearKeyHeads){let z=f.hybrid.linearHeadDim,T=f.hybrid.linearKeyHeads,G=f.hybrid.linearValueHeads/T,Z=z*T*G,$=Ge.permBuf;for(let lt=0;lt<q;lt++){let tt=lt*Z;for(let at=0;at<T;at++)for(let ct=0;ct<G;ct++){let ot=tt+(at*G+ct)*z,vt=tt+(ct*T+at)*z;for(let _t=0;_t<z;_t++)$[ot+_t]=M[vt+_t]}}X=$}L=Ge.rotBuf,Pr(X,L,q,c.K,0),st.set(M,L)}N=L}let J=q*c.N;D&&it.set(D.subarray(0,J),0),Q||(new Uint8Array(E.buffer,c.quantsPtr,c.quantsView.byteLength).set(c.quantsView),c.scalesView.byteLength>0&&new Uint8Array(E.buffer,c.scalesPtr,c.scalesView.byteLength).set(c.scalesView));let W=D?1:0;if(c.type===0)h.set(N.subarray(0,q*c.K),0),p.gemv_f32(q,c.N,c.K,c.quantsPtr,W,0,c.N);else if(c.type===41||c.type===142||c.type===143){let L=c.type===142;($t!==N||Ae!==128||L&&!er)&&(Xr(N,q,c.K,L),$t=N,Ae=128,er=L),c.type===41?p.gemv_q1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):c.type===142?p.gemv_pq2_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N):p.gemv_ptq1_0(q,c.N,c.K,c.nb,c.quantsPtr,c.scalesPtr,W,0,c.N)}else if(($t!==N||Ae!==32)&&(Hr(N,q,c.K),$t=N,Ae=32,er=!1),c.type===2)p.gemv_q4_0(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===3)p.gemv_q4_1(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===12)p.gemv_q4_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else if(c.type===14)p.gemv_q6_k(q,c.N,c.K,c.nb,c.quantsPtr,W,0,c.N);else throw new Error(`hachiue: unsupported Wasm GEMV tensor type ${c.type}`);rt.set(it.subarray(0,J),0)}function $r(k,M){let q=Y.get("token_embd.weight"),rt=k.length,D=q.quantsView,st=q.scalesView,c=st.byteLength>0?new DataView(st.buffer,st.byteOffset,st.byteLength):null,N=new DataView(D.buffer,D.byteOffset,D.byteLength),J=[1,3,9,27,81];for(let W=0;W<rt;W++){let L=k[W],X=W*ut;if(q.type===0&&q.f32View)M.set(q.f32View.subarray(L*ut,(L+1)*ut),X);else if(q.type===41){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*16,lt=X+(T<<7);for(let tt=0;tt<128;tt++){let at=D[$+(tt>>3)]>>(tt&7)&1;M[lt+tt]=at?Z:-Z}}}else if(q.type===142){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*32,lt=X+(T<<7);for(let tt=0;tt<128;tt++){let at=D[$+(tt>>2)]>>(tt&3)*2&3;M[lt+tt]=(at-1)*Z}}}else if(q.type===143){let z=ut>>7;for(let T=0;T<z;T++){let G=L*z+T,Z=m[c.getUint16(G*2,!0)],$=G*26,lt=X+(T<<7);for(let tt=0;tt<5;tt++){let at=J[tt];for(let ct=0;ct<16;ct++){let ot=D[$+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}for(let tt=0;tt<5;tt++){let at=J[tt];for(let ct=0;ct<8;ct++){let ot=D[$+16+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}for(let tt=0;tt<4;tt++){let at=J[tt];for(let ct=0;ct<2;ct++){let ot=D[$+24+ct]*at&255;M[lt++]=((ot*3>>8)-1)*Z}}}}else if(q.type===2){let z=ut>>5;for(let T=0;T<z;T++){let G=(L*z+T)*18,Z=m[N.getUint16(G,!0)],$=X+(T<<5);for(let lt=0;lt<16;lt++){let tt=D[G+2+lt];M[$+lt]=((tt&15)-8)*Z,M[$+16+lt]=((tt>>4)-8)*Z}}}else if(q.type===3){let z=ut>>5;for(let T=0;T<z;T++){let G=(L*z+T)*20,Z=m[N.getUint16(G,!0)],$=m[N.getUint16(G+2,!0)],lt=X+(T<<5);for(let tt=0;tt<16;tt++){let at=D[G+4+tt];M[lt+tt]=(at&15)*Z+$,M[lt+16+tt]=(at>>4)*Z+$}}}else if(q.type===12){let z=ut>>8,T=new Uint8Array(8),G=new Uint8Array(8);for(let Z=0;Z<z;Z++){let $=(L*z+Z)*144,lt=m[N.getUint16($,!0)],tt=m[N.getUint16($+2,!0)];for(let ot=0;ot<4;ot++)T[ot]=D[$+4+ot]&63,G[ot]=D[$+8+ot]&63;for(let ot=4;ot<8;ot++)T[ot]=D[$+8+ot]&15|D[$+ot]>>6<<4,G[ot]=D[$+8+ot]>>4|D[$+4+ot]>>6<<4;let at=$+16,ct=X+(Z<<8);for(let ot=0;ot<4;ot++){let vt=lt*T[2*ot],_t=tt*G[2*ot],Bt=lt*T[2*ot+1],xt=tt*G[2*ot+1];for(let Et=0;Et<32;Et++){let Wt=D[at+Et];M[ct+Et]=vt*(Wt&15)-_t,M[ct+32+Et]=Bt*(Wt>>4)-xt}ct+=64,at+=32}}}else if(q.type===14){let z=ut>>8;for(let T=0;T<z;T++){let G=(L*z+T)*210,Z=m[N.getUint16(G+208,!0)];for(let $=0;$<2;$++){let lt=G+$*64,tt=G+128+$*32,at=G+192+$*8,ct=X+(T<<8)+$*128;for(let ot=0;ot<32;ot++){let vt=ot>>4,_t=D[lt+ot],Bt=D[lt+ot+32],xt=D[tt+ot],Et=(_t&15|(xt>>0&3)<<4)-32,Wt=(Bt&15|(xt>>2&3)<<4)-32,Gt=(_t>>4|(xt>>4&3)<<4)-32,Qt=(Bt>>4|(xt>>6&3)<<4)-32;M[ct+ot+0]=Z*N.getInt8(at+vt+0)*Et,M[ct+ot+32]=Z*N.getInt8(at+vt+2)*Wt,M[ct+ot+64]=Z*N.getInt8(at+vt+4)*Gt,M[ct+ot+96]=Z*N.getInt8(at+vt+6)*Qt}}}}}}function Le(k,M,q,rt,D,st,c,N){let J=D>>1;for(let W=0;W<M;W++){let X=(st+W)*J;for(let z=0;z<q;z++){let T=(W*q+z)*rt;for(let G=0;G<J;G++){let Z=c[X+G],$=N[X+G],lt=k[T+G],tt=k[T+G+J];k[T+G]=lt*Z-tt*$,k[T+G+J]=tt*Z+lt*$}}}}function qe(k,M,q,rt,D,st,c){let N=D*(st>>5),J=rt*N;for(let W=0;W<J;W++){let L=Math.floor(W/N),X=W%N,z=(L*N+X)*32,T=(c+L)*N+X,G=T*32,Z=0;for(let tt=0;tt<32;tt++){let at=Math.abs(k[z+tt]);at>Z&&(Z=at)}let $=Z/127,lt=Z>0?127/Z:0;q[T]=$;for(let tt=0;tt<32;tt++){let at=Math.round(k[z+tt]*lt);M[G+tt]=at<-127?-127:at>127?127:at}}}function yr(k,M,q,rt,D,st,c,N,J,W,L,X){let z=N/J,T=W>>5,G=1/Math.sqrt(W),Z=new Float32Array(W);for(let $=0;$<c;$++){let lt=L+$,tt=X>0&&lt+1>X?lt+1-X:0;for(let at=0;at<N;at++){let ct=Math.floor(at/z),ot=($*N+at)*W;Z.fill(0);let vt=-1e30,_t=0;for(let xt=tt;xt<=lt;xt++){let Et=xt*J+ct,Wt=Et*T,Gt=Et*W,Qt=0;for(let dt=0;dt<T;dt++){let Pt=0,Mt=ot+(dt<<5),Nt=Gt+(dt<<5);for(let pt=0;pt<32;pt++)Pt+=k[Mt+pt]*M[Nt+pt];Qt+=Pt*q[Wt+dt]}let ce=Qt*G,re=ce>vt?ce:vt,le=Math.exp(vt-re),Ee=Math.exp(ce-re);_t=_t*le+Ee;for(let dt=0;dt<T;dt++){let Pt=Ee*D[Wt+dt],Mt=Gt+(dt<<5),Nt=dt<<5;for(let pt=0;pt<32;pt++)Z[Nt+pt]=Z[Nt+pt]*le+Pt*rt[Mt+pt]}vt=re}let Bt=1/_t;for(let xt=0;xt<W;xt++)st[ot+xt]=Z[xt]*Bt}}}function Vr(k,M=!0,q=!1,rt){rt!==void 0&&(Ft=rt);let D=k.length;if(D===0)throw new Error("hachiue: empty tokenIds");if(Ft+D>b)throw new Error(`hachiue: context length ${Ft+D} exceeds maxSeqLen ${b}`);let st=f.rope.rotaryDim,c=Ge,N=new Map,J=c.curH,W=c.nextH;$r(k,J),f.hadamard?.inverseWeights.has("token_embd.weight")&&(Pr(J,W,D,ut,1),[J,W]=[W,J]);for(let L=0;L<f.layers;L++){if(zt(J,`blk.${L}.attn_norm.weight`,D,ut,c.n1),N.clear(),$t=null,f.archName==="plamo3"){qt(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N);let G=Rt+2*Ht;for(let _t=0;_t<D;_t++){let Bt=_t*G;c.qBuf.set(c.qkvMixed.subarray(Bt,Bt+Rt),_t*Rt),c.kBuf.set(c.qkvMixed.subarray(Bt+Rt,Bt+Rt+Ht),_t*Ht),c.vBuf.set(c.qkvMixed.subarray(Bt+Rt+Ht,Bt+G),_t*Ht)}zt(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Lt,wt,c.qNormed),zt(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*Ot,wt,c.kNormed);let Z=!!(f.swa&&f.swa.layerTypes[L]==="swa"),$=Z&&H?H:y,lt=Z&&V?V:A,tt=Z&&f.swa?f.swa.windowSize:0;Le(c.qNormed,D,Lt,wt,st,Ft,$,lt),Le(c.kNormed,D,Ot,wt,st,Ft,$,lt);let at=Qe.get(L),ct=je.get(L),ot=Ye.get(L),vt=Je.get(L);qe(c.kNormed,at,ct,D,Ot,wt,Ft),qe(c.vBuf,ot,vt,D,Ot,wt,Ft),yr(c.qNormed,at,ct,ot,vt,c.attOut,D,Lt,Ot,wt,Ft,tt),N.clear(),$t=null,qt(`blk.${L}.attn_output.weight`,c.attOut,D,c.n1,null,N),zt(c.n1,`blk.${L}.post_attention_norm`,D,ut,c.n2);for(let _t=0;_t<D*ut;_t++)c.h2[_t]=J[_t]+c.n2[_t];zt(c.h2,`blk.${L}.ffn_norm.weight`,D,ut,c.n1),N.clear(),$t=null,qt(`blk.${L}.ffn_up.weight`,c.n1,D,c.mlpGate,null,N);for(let _t=0;_t<D;_t++){let Bt=_t*bt*2,xt=_t*bt;for(let Et=0;Et<bt;Et++){let Wt=c.mlpGate[Bt+Et],Gt=c.mlpGate[Bt+bt+Et];c.swigluOut[xt+Et]=Wt/(1+Math.exp(-Wt))*Gt}}N.clear(),$t=null,qt(`blk.${L}.ffn_down.weight`,c.swigluOut,D,c.n1,null,N),zt(c.n1,`blk.${L}.post_ffw_norm`,D,ut,c.n2);for(let _t=0;_t<D*ut;_t++)W[_t]=c.h2[_t]+c.n2[_t];[J,W]=[W,J];continue}if(f.hybrid&&f.hybrid.layerTypes[L]==="linear"&&f.hybrid){let G=f.hybrid.linearKeyHeads,Z=f.hybrid.linearValueHeads,$=f.hybrid.linearHeadDim,lt=G*$,tt=Z*$,at=lt*2+tt,ct=f.hybrid.convKernel,ot=Ft>0;qt(`blk.${L}.attn_qkv.weight`,c.n1,D,c.qkvMixed,null,N),qt(`blk.${L}.attn_gate.weight`,c.n1,D,c.zGate,null,N);let vt=Y.get(`blk.${L}.ssm_conv1d.weight`).f32View,_t=Ze.get(L),Bt=(dt,Pt)=>dt+1<ct?ot?_t[dt*at+Pt]:0:c.qkvMixed[(dt-(ct-1))*at+Pt];for(let dt=0;dt<D;dt++){let Pt=dt*at;for(let Mt=0;Mt<at;Mt++){let Nt=0,pt=Mt*ct;for(let Vt=0;Vt<ct;Vt++)Nt+=vt[pt+Vt]*Bt(dt+Vt,Mt);c.qkvConv[Pt+Mt]=Nt/(1+Math.exp(-Nt))}}let xt=new Float32Array((ct-1)*at);for(let dt=0;dt<ct-1;dt++)for(let Pt=0;Pt<at;Pt++)xt[dt*at+Pt]=Bt(D+dt,Pt);_t.set(xt),qt(`blk.${L}.ssm_alpha.weight`,c.n1,D,c.aProj,null,N),qt(`blk.${L}.ssm_beta.weight`,c.n1,D,c.bProj,null,N);let Et=Y.get(`blk.${L}.ssm_a`).f32View,Wt=Y.get(`blk.${L}.ssm_dt.bias`).f32View,Gt=D*Z;for(let dt=0;dt<Gt;dt++){let Pt=dt%Z,Mt=c.aProj[dt]+Wt[Pt],Nt=(Mt>0?Mt:0)+Math.log(1+Math.exp(-Math.abs(Mt)));c.gbeta[dt]=Et[Pt]*Nt,c.gbeta[Gt+dt]=1/(1+Math.exp(-c.bProj[dt]))}let Qt=tr.get(L);ot||Qt.fill(0);let ce=1/Math.sqrt($),re=new Float32Array($),le=new Float32Array($);for(let dt=0;dt<Z;dt++){let Pt=dt%G,Mt=dt*$*$;for(let Nt=0;Nt<D;Nt++){let pt=Nt*at,Vt=pt+Pt*$,Or=pt+lt+Pt*$,Gr=pt+lt*2+dt*$,xr=Nt*Z+dt,Ir=0,kr=0;for(let Ct=0;Ct<$;Ct++){let de=c.qkvConv[Vt+Ct],Ne=c.qkvConv[Or+Ct];kr+=de*de,Ir+=Ne*Ne}let Qr=1/Math.sqrt(Ir+1e-6),jr=1/Math.sqrt(kr+1e-6)*ce;for(let Ct=0;Ct<$;Ct++)le[Ct]=c.qkvConv[Vt+Ct]*jr,re[Ct]=c.qkvConv[Or+Ct]*Qr;let Yr=Math.exp(c.gbeta[xr]),Jr=c.gbeta[Gt+xr],Zr=(Nt*Z+dt)*$;for(let Ct=0;Ct<$;Ct++){let de=0;for(let jt=0;jt<$;jt++){let _e=Mt+jt*$+Ct,fe=Qt[_e]*Yr;Qt[_e]=fe,de+=fe*re[jt]}let Ne=(c.qkvConv[Gr+Ct]-de)*Jr,Dr=0;for(let jt=0;jt<$;jt++){let _e=Mt+jt*$+Ct,fe=Qt[_e]+re[jt]*Ne;Qt[_e]=fe,Dr+=fe*le[jt]}c.core[Zr+Ct]=Dr}}}let Ee=Y.get(`blk.${L}.ssm_norm.weight`).f32View;for(let dt=0;dt<D*Z;dt++){let Pt=dt*$,Mt=0;for(let pt=0;pt<$;pt++){let Vt=c.core[Pt+pt];Mt+=Vt*Vt}let Nt=1/Math.sqrt(Mt/$+f.rmsEps);for(let pt=0;pt<$;pt++){let Vt=c.zGate[Pt+pt];c.normed[Pt+pt]=Ee[pt]*(c.core[Pt+pt]*Nt)*(Vt/(1+Math.exp(-Vt)))}}N.clear(),$t=null,qt(`blk.${L}.ssm_out.weight`,c.normed,D,c.h2,J,N)}else{let G=f.archName==="qwen35";if(G){qt(`blk.${L}.attn_q.weight`,c.n1,D,c.qgBuf,null,N);let at=D*Lt*wt;for(let ct=0;ct<at;ct++){let ot=ct%wt,_t=Math.floor(ct/wt)*(wt*2);c.qBuf[ct]=c.qgBuf[_t+ot],c.gateBuf[ct]=c.qgBuf[_t+wt+ot]}}else qt(`blk.${L}.attn_q.weight`,c.n1,D,c.qBuf,null,N);qt(`blk.${L}.attn_k.weight`,c.n1,D,c.kBuf,null,N),qt(`blk.${L}.attn_v.weight`,c.n1,D,c.vBuf,null,N),zt(c.qBuf,`blk.${L}.attn_q_norm.weight`,D*Lt,wt,c.qNormed),zt(c.kBuf,`blk.${L}.attn_k_norm.weight`,D*Ot,wt,c.kNormed),Le(c.qNormed,D,Lt,wt,st,Ft,y,A),Le(c.kNormed,D,Ot,wt,st,Ft,y,A);let Z=Qe.get(L),$=je.get(L),lt=Ye.get(L),tt=Je.get(L);if(qe(c.kNormed,Z,$,D,Ot,wt,Ft),qe(c.vBuf,lt,tt,D,Ot,wt,Ft),yr(c.qNormed,Z,$,lt,tt,c.attOut,D,Lt,Ot,wt,Ft,0),G){let at=D*Lt*wt;for(let ct=0;ct<at;ct++)c.attOut[ct]*=1/(1+Math.exp(-c.gateBuf[ct]))}N.clear(),$t=null,qt(`blk.${L}.attn_output.weight`,c.attOut,D,c.h2,J,N)}let z=f.archName==="qwen35"?`blk.${L}.post_attention_norm.weight`:`blk.${L}.ffn_norm.weight`;zt(c.h2,z,D,ut,c.n2),N.clear(),$t=null,qt(`blk.${L}.ffn_gate.weight`,c.n2,D,c.mlpGate,null,N),qt(`blk.${L}.ffn_up.weight`,c.n2,D,c.mlpUp,null,N);let T=D*bt;for(let G=0;G<T;G++){let Z=c.mlpGate[G];c.swigluOut[G]=Z/(1+Math.exp(-Z))*c.mlpUp[G]}N.clear(),$t=null,qt(`blk.${L}.ffn_down.weight`,c.swigluOut,D,W,c.h2,N),[J,W]=[W,J]}if(Ft+=D,!M)return{};if(D>1?(c.lastHidden.set(J.subarray((D-1)*ut,D*ut)),zt(c.lastHidden,"output_norm.weight",1,ut,c.finalNorm)):zt(J,"output_norm.weight",1,ut,c.finalNorm),N.clear(),$t=null,qt("output.weight",c.finalNorm,1,c.logits,null,N),q){let L=-1e30,X=0,z=f.vocab;for(let T=0;T<z;T++){let G=c.logits[T];G>L&&(L=G,X=T)}return{greedyId:X}}return{logits:new Float32Array(c.logits)}}function Wr(k){let M=Y.get(k);if(!M)throw new Error(`hachiue: tensor "${k}" not found`);return{type:M.type,rows:M.N,cols:M.K,rowBytes:M.rowBytes}}function zr(k,M){let q=Y.get(k);if(!q)throw new Error(`hachiue: tensor "${k}" not found`);let rt=M.length,D=new Uint8Array(rt*q.rowBytes);for(let st=0;st<rt;st++){let c=M[st];if(c<0||c>=q.N)throw new Error(`hachiue: row index ${c} out of bounds for "${k}" (rows=${q.N})`);D.set(q.quantsView.subarray(c*q.rowBytes,(c+1)*q.rowBytes),st*q.rowBytes)}return D}function Kr(k,M,q){let rt=Y.get(k);if(!rt)throw new Error(`hachiue: tensor "${k}" not found`);let D=M.length;if(D===0)return;let st=q.byteLength===rt.rowBytes&&D>1;if(!st&&q.byteLength!==D*rt.rowBytes)throw new Error(`hachiue: writeTensorRows("${k}") expected ${D*rt.rowBytes} (or ${rt.rowBytes}) bytes, got ${q.byteLength}`);for(let c=0;c<D;c++){let N=M[c];if(N<0||N>=rt.N)throw new Error(`hachiue: row index ${N} out of bounds for "${k}" (rows=${rt.N})`);let J=st?0:c*rt.rowBytes;rt.quantsView.set(q.subarray(J,J+rt.rowBytes),N*rt.rowBytes)}}return{pushTensorBytes:yt,finishTensor:Dt,finalizeWeights:St,forwardSegment:Vr,resetCache:Ur,getTensorRowSpec:Wr,readTensorRows:zr,writeTensorRows:Kr}}function Sn(s=Ve){let r=null,n=self;n.onmessage=o=>{let e=o.data;try{switch(e.type){case"init":r=s(e.payload),n.postMessage({id:e.id,ok:!0});break;case"pushBatch":for(let u of e.items)r.pushTensorBytes(u.name,u.bytes),u.finished&&r.finishTensor(u.name);n.postMessage({id:e.id,ok:!0});break;case"finalize":r.finalizeWeights(),n.postMessage({id:e.id,ok:!0});break;case"forward":{let u=r.forwardSegment(e.tokenIds,e.computeLogits,e.greedyOnly,e.posBase),_=u.logits?[u.logits.buffer]:[];n.postMessage({id:e.id,ok:!0,res:u},_);break}case"resetCache":r.resetCache(),n.postMessage({id:e.id,ok:!0});break;case"readRows":{let u=r.readTensorRows(e.name,e.rowIndices);n.postMessage({id:e.id,ok:!0,out:u},[u.buffer]);break}case"writeRows":r.writeTensorRows(e.name,e.rowIndices,e.data),n.postMessage({id:e.id,ok:!0});break}}catch(u){n.postMessage({id:e.id,ok:!1,error:u.message||String(u)})}}}var ye=null;function vn(){if(ye)return ye;ye=new Float32Array(65536);for(let s=0;s<65536;s++)ye[s]=be(s);return ye}async function lr(s,r,n,o,e,u){let _=s.arch,g=r.maxSeqLen??4096;r.onProgress?.({phase:"pipelines",message:"Compiling Wasm SIMD kernels..."});let d=cr(),x=vn(),P=[];if(_.hadamard)for(let[p,O]of _.hadamard.signsByWidth.entries()){let B=new Float32Array(p);for(let h=0;h<p;h++)B[h]=O[h];P.push([p,B])}let i=Object.values(s.tensors).sort((p,O)=>p.absOffset-O.absOffset),f=[],b=new Map;for(let p of i){let O=p.dims[0],B=p.dims.length>1?p.dims[1]:1,[h,v]=se(p.type),C=O/h,R=!!_.hadamard?.foldedWeights.has(p.name);f.push({name:p.name,type:p.type,N:B,K:O,nb:C,hadamardFolded:R,byteLength:p.byteLength});let j=0,it=p.type===et.F16?et.F32:p.type;if(it===et.F32)j=O*4;else if(p.type===et.Q1_0||p.type===et.PQ2_0||p.type===et.PTQ1_0){let Y=p.type===et.Q1_0?16:p.type===et.PQ2_0?32:26;j=C*Y}else j=C*v;b.set(p.name,{type:it,rows:B,cols:O,rowBytes:j})}if(_.tieWordEmbeddings){let p=b.get("token_embd.weight");p&&b.set("output.weight",{...p})}let m={arch:_,maxSeqLen:g,wasmBytes:d,fp16Table:x,cos:n,sin:o,swaCos:e,swaSin:u,hadamardSigns:P,tensors:f},y=(r.useWorker??!0)&&typeof Worker<"u"&&typeof Blob<"u"&&typeof URL<"u"&&typeof URL.createObjectURL=="function",A=null,H=null,V=1,K=new Map,I=(p,O=[])=>{let B=V++;return new Promise((h,v)=>{K.set(B,{resolve:h,reject:v}),A.postMessage({...p,id:B},O)})};if(y)try{let p=`(${Sn.toString()})(${Ve.toString()});`,O=new Blob([p],{type:"text/javascript"});H=URL.createObjectURL(O),A=new Worker(H),A.onmessage=B=>{let{id:h,ok:v,res:C,out:R,error:j}=B.data,it=K.get(h);it&&(K.delete(h),v?it.resolve(R??C??!0):it.reject(new Error(j)))},A.onerror=B=>{for(let h of K.values())h.reject(new Error(B.message||"hachiue: Wasm Worker error"));K.clear()},await I({type:"init",payload:m})}catch{A&&A.terminate(),H&&URL.revokeObjectURL(H),A=null,H=null}let U=A?null:Ve(m),Q=!!A;r.onProgress?.({phase:"pipelines",message:Q?"Initializing Wasm SIMD Web Worker...":"Initializing Wasm SIMD kernels...",backend:"wasm",isWorker:Q});let E=0,F=i.length>0?i[0].absOffset:s.dataStartOffset;await ae(r.url,F,s.totalFileSize,async(p,O)=>{let B=O+p.byteLength,h=[],v=[];for(;E<i.length;){let C=i[E],R=C.absOffset,j=C.absOffset+C.byteLength;if(j<=O){E++;continue}if(R>=B)break;let it=Math.max(0,R-O),Y=Math.min(p.byteLength,j-O),ht=O+Y===j;if(Y>it)if(A){let yt=p.slice(it,Y);h.push({name:C.name,bytes:yt,finished:ht}),v.push(yt.buffer)}else U.pushTensorBytes(C.name,p.subarray(it,Y)),ht&&U.finishTensor(C.name);else ht&&(A?h.push({name:C.name,bytes:new Uint8Array(0),finished:!0}):U.finishTensor(C.name));if(ht)E++;else break}A&&h.length>0&&await I({type:"pushBatch",items:h},v),await new Promise(C=>setTimeout(C,0))},r),A?await I({type:"finalize"}):U.finalizeWeights(),r.onProgress?.({phase:"ready",message:A?"Model loaded into Wasm SIMD Worker":"Model loaded into Wasm SIMD memory",backend:"wasm",isWorker:Q});let S=Promise.resolve();return{isWorker:!!A,getTensorRowSpec(p){let O=b.get(p);if(!O)throw new Error(`hachiue: tensor "${p}" not found`);return O},async readTensorRows(p,O){let B=b.get(p);if(!B)throw new Error(`hachiue: tensor "${p}" not found`);for(let h=0;h<O.length;h++){let v=O[h];if(v<0||v>=B.rows)throw new Error(`hachiue: row index ${v} out of bounds for "${p}" (rows=${B.rows})`)}return O.length===0?new Uint8Array(0):A?(await S,await I({type:"readRows",name:p,rowIndices:Array.from(O)})):U.readTensorRows(p,O)},writeTensorRows(p,O,B){let h=b.get(p);if(!h)throw new Error(`hachiue: tensor "${p}" not found`);let v=O.length;if(v===0)return;if(!(B.byteLength===h.rowBytes&&v>1)&&B.byteLength!==v*h.rowBytes)throw new Error(`hachiue: writeTensorRows("${p}") expected ${v*h.rowBytes} (or ${h.rowBytes}) bytes, got ${B.byteLength}`);for(let R=0;R<v;R++){let j=O[R];if(j<0||j>=h.rows)throw new Error(`hachiue: row index ${j} out of bounds for "${p}" (rows=${h.rows})`)}if(A){let R=new Uint8Array(B);S=I({type:"writeRows",name:p,rowIndices:Array.from(O),data:R},[R.buffer]);return}U.writeTensorRows(p,O,B)},async forwardSegment(p,O,B,h){return A?(await S,await I({type:"forward",tokenIds:p,computeLogits:O,greedyOnly:B,posBase:h})):U.forwardSegment(p,O,B,h)},resetCache(){if(A){S=I({type:"resetCache"});return}U.resetCache()},async flush(){await S},dispose(){A&&(A.terminate(),A=null),H&&(URL.revokeObjectURL(H),H=null)}}}var We=1,Bn=4,Oe=8,Mn=64,An=128,Kt=An|Oe|Bn,Ln=Mn|Oe,gt=8;function qn(s,r,n,o,e,u){let _=o/128,g=r===et.Q1_0?18:r===et.PQ2_0?34:28,d=g-2,x=0,P=0,i=n[0].rowCount*_,f=e.byteLength,b=0,m=0,y=0,A=0,H=new Uint8Array(g),V=0,K=()=>{let U=0,Q=n[x];if(b>0){let E=b+3&-4;E>b&&e.fill(0,b,E),s.queue.writeBuffer(Q.quants,y,e,0,E),y+=b,U+=E,b=0}if(m>0){let E=m+3&-4;E>m&&u.fill(0,m,E),s.queue.writeBuffer(Q.scales16,A,u,0,E),A+=m,U+=E,m=0}return U},I=(U,Q)=>{let E=0;return r===et.PTQ1_0?(e.set(U.subarray(Q,Q+26),b),b+=26,u[m++]=U[Q+26],u[m++]=U[Q+27]):(u[m++]=U[Q],u[m++]=U[Q+1],e.set(U.subarray(Q+2,Q+g),b),b+=d),P++,(P&1)===0&&b+1024>=f&&(E+=K()),P===i&&(E+=K(),x++,P=0,y=0,A=0,x<n.length&&(i=n[x].rowCount*_)),E};return{push:U=>{let Q=0,E=0;if(V>0){let F=Math.min(g-V,U.byteLength);H.set(U.subarray(0,F),V),V+=F,E+=F,V===g&&(Q+=I(H,0),V=0)}for(;E+g<=U.byteLength;)Q+=I(U,E),E+=g;return E<U.byteLength&&(H.set(U.subarray(E),0),V=U.byteLength-E),Q},finish:()=>{if(V!==0)throw new Error(`hachiue: incomplete quantized block at end of tensor (${V} leftover bytes)`);return K()}}}function En(s,r,n,o){let e=0,u=0,_=r[0].rowCount*n,g=0,d=0,x=o.byteLength,P=()=>{if(g===0)return 0;let i=r[e],f=g+3&-4;f>g&&o.fill(0,g,f),s.queue.writeBuffer(i.quants,d,o,0,f),d+=g;let b=f;return g=0,b};return{push:i=>{let f=0,b=0;for(;b<i.byteLength&&e<r.length;){let m=_-u,y=x-g,A=y>=4?y&-4:y,H=Math.min(i.byteLength-b,m,A);o.set(i.subarray(b,b+H),g),g+=H,u+=H,b+=H,u===_?(f+=P(),e++,u=0,d=0,e<r.length&&(_=r[e].rowCount*n)):g+4096>=x&&(g&3)===0&&(f+=P())}return f},finish:()=>P()}}function Lr(s,r,n=!1){let o=s.rope.rotaryDim,e=o>>1,u=new Float32Array(r*e),_=new Float32Array(r*e),g=n?s.rope.localTheta??1e4:s.rope.theta,d=!n&&s.rope.factor&&s.rope.factor>1?s.rope.factor:1,x=s.rope.originalMaxPositions??4096,P=s.rope.yarnBetaFast??32,i=s.rope.yarnBetaSlow??1,f=d>1?.1*Math.log(d)+1:1,b=new Float64Array(e),m=0,y=e-1;if(d>1){let A=H=>o*Math.log(x/(H*2*Math.PI))/(2*Math.log(g));m=Math.max(0,A(P)),y=Math.min(e-1,A(i)),m===y&&(y+=.001)}for(let A=0;A<e;A++){let H=1/Math.pow(g,2*A/o);if(d>1){let V=H,K=H/d,I=(A-m)/(y-m),Q=1-Math.min(1,Math.max(0,I));b[A]=K*(1-Q)+V*Q}else b[A]=H}for(let A=0;A<r;A++)for(let H=0;H<e;H++){let V=A*b[H];u[A*e+H]=Math.cos(V)*f,_[A*e+H]=Math.sin(V)*f}return{cos:u,sin:_}}var xe=class s{header;arch;tokenizer;backend;isWorker;backendInfo;device;maxSeqLen;wasmBackend;pipelines;weights;hadamardSigns;cosBuf;sinBuf;swaCosBuf;swaSinBuf;dummyBuf;logitsBuf;logitsReadBuf;logitsCpu;argmaxBuf;argmaxReadBuf;tokensBuf;kCacheQ;kCacheS;vCacheQ;vCacheS;ssmConvState;ssmRecState;scratch;uniformPool=[];uniformCursor=0;uniformScratch=new ArrayBuffer(32);uniformView=new DataView(this.uniformScratch);ssmParity=0;cachePos=0;tokenHistory=[];lastMessages=[];lastTurnTokens=[];disposed=!1;constructor(r,n,o,e,u,_,g,d,x,P,i=null,f){if(this.header=r,this.arch=r.arch,this.tokenizer=r.tokenizer?new we(r.tokenizer):null,this.backend=i?"wasm":"webgpu",this.isWorker=i?i.isWorker:!1,this.backendInfo=f??{backend:this.backend,isWorker:this.isWorker,label:this.backend==="webgpu"?"WebGPU":this.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD"},this.device=n,this.maxSeqLen=o,this.wasmBackend=i,this.pipelines=e,this.weights=u,this.hadamardSigns=_,this.cosBuf=g,this.sinBuf=d,this.swaCosBuf=x,this.swaSinBuf=P,i||!n){this.dummyBuf=null,this.logitsBuf=null,this.logitsReadBuf=null,this.logitsCpu=new Float32Array(0),this.argmaxBuf=null,this.argmaxReadBuf=null,this.tokensBuf=null,this.scratch=null,this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;return}let b=(v,C=Kt)=>n.createBuffer({size:Math.max(16,v+3&-4),usage:C}),m=v=>b(v*4);this.dummyBuf=b(64),this.logitsBuf=b(this.arch.vocab*4),this.logitsReadBuf=n.createBuffer({size:this.arch.vocab*4,usage:We|Oe}),this.logitsCpu=new Float32Array(this.arch.vocab),this.argmaxBuf=b(16),this.argmaxReadBuf=n.createBuffer({size:16,usage:We|Oe}),this.tokensBuf=b(gt*4);let y=this.arch.hidden,A=this.arch.intermediate,H=this.arch.heads,V=this.arch.kvHeads,K=this.arch.headDim,I=H*K,U=V*K,Q=this.arch.hybrid,E=Q?Q.linearValueHeads:1,F=Q?Q.linearHeadDim:1,S=Q?E*F:y,p=Q?(Q.linearKeyHeads*2+E)*F:Math.max(y,I+2*U),O=Math.max(y,A,I,S);this.scratch={curH:m(gt*y),nextH:m(gt*y),h2:m(gt*y),n1:m(gt*y),n2:m(gt*y),rotBuf:m(gt*O),permBuf:m(gt*S),qkvMixed:m(gt*p),qkvConv:m(gt*p),aProj:m(gt*E),bProj:m(gt*E),gbeta:m(2*gt*E),core:m(gt*S),zGate:m(gt*S),normed:m(gt*S),qgBuf:m(gt*I*(this.arch.archName==="qwen35"?2:1)),qBuf:m(gt*I),gateBuf:m(gt*I),kBuf:m(gt*U),vBuf:m(gt*U),qNormed:m(gt*I),kNormed:m(gt*U),attOut:m(gt*I),mlpGate:m(gt*A*(this.arch.archName==="plamo3"?2:1)),mlpUp:m(gt*A),swigluOut:m(gt*A),lastHidden:m(y),finalNorm:m(y)},this.kCacheQ=new Map,this.kCacheS=new Map,this.vCacheQ=new Map,this.vCacheS=new Map,this.ssmConvState=new Map,this.ssmRecState=new Map;let B=o*U,h=o*(U/32)*4;for(let v=0;v<this.arch.layers;v++)if(!(this.arch.hybrid&&this.arch.hybrid.layerTypes[v]==="linear"))this.kCacheQ.set(v,b(B)),this.kCacheS.set(v,b(h)),this.vCacheQ.set(v,b(B)),this.vCacheS.set(v,b(h));else if(this.arch.hybrid){let R=this.arch.hybrid,j=(R.linearKeyHeads*2+R.linearValueHeads)*R.linearHeadDim,it=(R.convKernel-1)*j*4,Y=R.linearValueHeads*R.linearHeadDim*R.linearHeadDim*4;this.ssmConvState.set(v,[b(it),b(it)]),this.ssmRecState.set(v,[b(Y),b(Y)])}}static async prefetch(r,n={}){return ar(r,n)}static async create(r){let n=r.maxSeqLen??4096,o=await me(r.url,r),e=o.arch,u=r.backend??(r.device?"webgpu":"auto"),{cos:_,sin:g}=Lr(e,n,!1),d=null,x=null;if(e.swa){let h=Lr(e,n,!0);d=h.cos,x=h.sin}let P=async h=>{let v=await lr(o,r,_,g,d,x),C={backend:"wasm",isWorker:v.isWorker,label:v.isWorker?"Wasm SIMD (Worker)":"Wasm SIMD",...h?{fallbackReason:h}:{}};return new s(o,null,n,new Map,new Map,new Map,null,null,null,null,v,C)};if(u==="wasm")return P();let i=r.device,f=i?"custom-device":void 0,b=null;try{if(!i){if(typeof navigator>"u"||!navigator.gpu)throw new Error("hachiue: WebGPU is not supported in this browser");let h=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(h?f="high-performance":(h=await navigator.gpu.requestAdapter(),h?f="default":(h=await navigator.gpu.requestAdapter({featureLevel:"compatibility"}),h&&(f="compatibility"))),!h)throw new Error("hachiue: Failed to acquire WebGPU adapter");let v=Math.min(h.limits.maxStorageBufferBindingSize,256*1024*1024),C=Math.min(h.limits.maxBufferSize,512*1024*1024),R=h.limits.maxStorageBuffersPerShaderStage;i=await h.requestDevice({requiredLimits:{maxStorageBufferBindingSize:v,maxBufferSize:C,...R?{maxStorageBuffersPerShaderStage:R}:{}}})}r.onProgress?.({phase:"pipelines",message:"Compiling WebGPU shaders...",backend:"webgpu",isWorker:!1}),b=new Map,await Promise.all(Object.entries(ir).map(async([h,v])=>{let C=i.createShaderModule({code:v,label:h});if(typeof C.getCompilationInfo=="function"){let j=(await C.getCompilationInfo()).messages.find(it=>it.type==="error");if(j)throw new Error(`hachiue: WGSL error in ${h} (L${j.lineNum}:${j.linePos}): ${j.message}`)}try{let R=await i.createComputePipelineAsync({layout:"auto",compute:{module:C,entryPoint:"main"}});b.set(h,R)}catch(R){throw new Error(`hachiue: pipeline compile failed in ${h}: ${R.message||R}`)}}))}catch(h){if(i&&!r.device)try{i.destroy()}catch{}if(u==="webgpu")throw h;let v=h instanceof Error?h.message:String(h);return P(v)}i.lost.then(h=>{r.onDeviceLost?.({reason:String(h.reason??"unknown"),message:h.message})});let m=new Map;if(e.hadamard)for(let[h,v]of e.hadamard.signsByWidth.entries()){let C=new Float32Array(h);for(let j=0;j<h;j++)C[j]=v[j];let R=i.createBuffer({size:C.byteLength,usage:Kt});i.queue.writeBuffer(R,0,C),m.set(h,R)}let y=i.createBuffer({size:_.byteLength,usage:Kt}),A=i.createBuffer({size:g.byteLength,usage:Kt});i.queue.writeBuffer(y,0,_.buffer,_.byteOffset,_.byteLength),i.queue.writeBuffer(A,0,g.buffer,g.byteOffset,g.byteLength);let H=null,V=null;d&&x&&(H=i.createBuffer({size:d.byteLength,usage:Kt}),V=i.createBuffer({size:x.byteLength,usage:Kt}),i.queue.writeBuffer(H,0,d.buffer,d.byteOffset,d.byteLength),i.queue.writeBuffer(V,0,x.buffer,x.byteOffset,x.byteLength));let K=Math.min(i.limits.maxStorageBufferBindingSize,64*1024*1024),I=new Map,U=i.createBuffer({size:16,usage:Kt}),Q=new Uint8Array(new ArrayBuffer(1024*1024)),E=new Uint8Array(new ArrayBuffer(128*1024)),F=[],S=Object.values(o.tensors).sort((h,v)=>h.absOffset-v.absOffset);for(let h of S){let v=h.dims[0],C=h.dims.length>1?h.dims[1]:1,R=!!e.hadamard?.foldedWeights.has(h.name);if(h.type===et.F32||h.type===et.F16){let j=v*C,it=i.createBuffer({size:Math.max(16,j*4),usage:Kt});if(I.set(h.name,{type:et.F32,N:C,K:v,nb:1,hadamardFolded:R,f32Buf:it}),h.type===et.F32){let Y=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:ht=>(i.queue.writeBuffer(it,Y,ht.buffer,ht.byteOffset,ht.byteLength),Y+=ht.byteLength,ht.byteLength),finish:()=>0})}else{let Y=null,ht=0;F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:yt=>(Y||(Y=new Uint8Array(h.byteLength)),Y.set(yt,ht),ht+=yt.byteLength,0),finish:()=>{if(!Y)return 0;let yt=new DataView(Y.buffer,Y.byteOffset,Y.byteLength),Dt=new Float32Array(j);for(let St=0;St<j;St++)Dt[St]=be(yt.getUint16(St*2,!0));return i.queue.writeBuffer(it,0,Dt),Y=null,Dt.byteLength}})}}else if(h.type===et.Q1_0||h.type===et.PQ2_0||h.type===et.PTQ1_0){let j=v/128,it=h.type===et.Q1_0?16:h.type===et.PQ2_0?32:26,Y=j*it,ht=Math.max(1,Math.floor(K/Y)),yt=[];for(let ut=0;ut<C;ut+=ht){let bt=Math.min(ht,C-ut),Lt=Math.max(16,bt*Y+3&-4),Ot=Math.max(16,bt*j*2+3&-4);yt.push({rowStart:ut,rowCount:bt,quants:i.createBuffer({size:Lt,usage:Kt}),scales16:i.createBuffer({size:Ot,usage:Kt})})}let Dt={type:h.type,N:C,K:v,nb:j,hadamardFolded:R,chunks:yt};I.set(h.name,Dt);let St=qn(i,h.type,yt,v,Q,E);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:St.push,finish:St.finish})}else if(h.type===et.Q4_0||h.type===et.Q4_1||h.type===et.Q4_K||h.type===et.Q6_K){let[j,it]=se(h.type),Y=v/j,ht=Y*it,yt=Math.max(1,Math.floor(K/ht)),Dt=[];for(let ut=0;ut<C;ut+=yt){let bt=Math.min(yt,C-ut),Lt=Math.max(16,bt*ht+3&-4);Dt.push({rowStart:ut,rowCount:bt,quants:i.createBuffer({size:Lt,usage:Kt}),scales16:U})}I.set(h.name,{type:h.type,N:C,K:v,nb:Y,hadamardFolded:R,chunks:Dt});let St=En(i,Dt,ht,Q);F.push({absStart:h.absOffset,absEnd:h.absOffset+h.byteLength,push:St.push,finish:St.finish})}else throw new Error(`hachiue: unsupported tensor type ${h.type} for ${h.name}`)}if(e.tieWordEmbeddings){let h=I.get("token_embd.weight");if(!h)throw new Error("hachiue: missing token_embd.weight");I.set("output.weight",{...h,hadamardFolded:!!(e.hadamard?.foldedWeights.has("output.weight")||e.hadamard?.tiedOutput)})}let p=0,O=F.length>0&&F[0]?F[0].absStart:o.dataStartOffset;await ae(r.url,O,o.totalFileSize,async(h,v)=>{let C=v+h.byteLength;for(;p<F.length;){let R=F[p];if(!R||R.absEnd<=v){F[p]=null,p++;continue}if(R.absStart>=C)break;let j=Math.max(0,R.absStart-v),it=Math.min(h.byteLength,R.absEnd-v);if(it>j&&R.push(h.subarray(j,it)),v+it===R.absEnd)R.finish(),F[p]=null,p++;else break}await i.queue.onSubmittedWorkDone(),await new Promise(R=>setTimeout(R,0))},r),await i.queue.onSubmittedWorkDone(),r.onProgress?.({phase:"ready",message:"Model loaded into WebGPU memory",backend:"webgpu",isWorker:!1});let B={backend:"webgpu",isWorker:!1,label:f==="compatibility"?"WebGPU (Compat)":"WebGPU",adapterMode:f};return new s(o,i,n,b,I,m,y,A,H,V,null,B)}resetCache(){this.cachePos=0,this.ssmParity=0,this.tokenHistory=[],this.lastMessages=[],this.lastTurnTokens=[],this.wasmBackend&&this.wasmBackend.resetCache()}dispose(){this.disposed||(this.disposed=!0,this.wasmBackend?this.wasmBackend.dispose():this.device&&this.device.destroy())}async flushDeviceQueue(){if(this.wasmBackend){await this.wasmBackend.flush();return}await this.device.queue.onSubmittedWorkDone()}getTensorRowSpec(r){if(this.wasmBackend)return this.wasmBackend.getTensorRowSpec(r);let n=this.weights.get(r);if(!n)throw new Error(`hachiue: tensor "${r}" not found`);if(n.f32Buf)return{type:n.type,rows:n.N,cols:n.K,rowBytes:n.K*4};if(n.type===et.Q1_0||n.type===et.PQ2_0||n.type===et.PTQ1_0){let e=n.type===et.Q1_0?16:n.type===et.PQ2_0?32:26;return{type:n.type,rows:n.N,cols:n.K,rowBytes:n.nb*e}}let[,o]=se(n.type);return{type:n.type,rows:n.N,cols:n.K,rowBytes:n.nb*o}}resolveTensorRowBuffer(r,n,o){if(o<0||o>=n.N)throw new Error(`hachiue: row index ${o} out of bounds for "${r}" (rows=${n.N})`);if(n.f32Buf)return{buf:n.f32Buf,localRow:o};if(n.chunks){for(let e of n.chunks)if(o>=e.rowStart&&o<e.rowStart+e.rowCount)return{buf:e.quants,localRow:o-e.rowStart}}throw new Error(`hachiue: failed to resolve GPU chunk for "${r}" row ${o}`)}async readTensorRows(r,n){if(this.wasmBackend)return this.wasmBackend.readTensorRows(r,n);let o=this.weights.get(r);if(!o)throw new Error(`hachiue: tensor "${r}" not found`);let{rowBytes:e}=this.getTensorRowSpec(r),u=n.length;if(u===0)return new Uint8Array(0);let _=u*e,g=this.device.createBuffer({size:_,usage:We|Oe}),d=this.device.createCommandEncoder();for(let P=0;P<u;P++){let{buf:i,localRow:f}=this.resolveTensorRowBuffer(r,o,n[P]);d.copyBufferToBuffer(i,f*e,g,P*e,e)}this.device.queue.submit([d.finish()]),await g.mapAsync(We);let x=new Uint8Array(g.getMappedRange().slice(0));return g.unmap(),g.destroy(),x}writeTensorRows(r,n,o){if(this.wasmBackend){this.wasmBackend.writeTensorRows(r,n,o);return}let e=this.weights.get(r);if(!e)throw new Error(`hachiue: tensor "${r}" not found`);let{rowBytes:u}=this.getTensorRowSpec(r),_=n.length;if(_===0)return;let g=o.byteLength===u&&_>1;if(!g&&o.byteLength!==_*u)throw new Error(`hachiue: writeTensorRows("${r}") expected ${_*u} (or ${u}) bytes, got ${o.byteLength}`);for(let d=0;d<_;d++){let{buf:x,localRow:P}=this.resolveTensorRowBuffer(r,e,n[d]),i=g?o.byteOffset:o.byteOffset+d*u;this.device.queue.writeBuffer(x,P*u,o.buffer,i,u)}}mkUniform(r,n=new Set){for(let u=0;u<8;u++){let _=u<r.length?r[u]:0;n.has(u)?this.uniformView.setFloat32(u*4,_,!0):this.uniformView.setUint32(u*4,_>>>0,!0)}let o=this.uniformCursor++,e=this.uniformPool[o];return e||(e=this.device.createBuffer({size:32,usage:Ln}),this.uniformPool.push(e)),this.device.queue.writeBuffer(e,0,this.uniformScratch),e}dispatch(r,n,o,e,u,_=1,g=1){let d=this.pipelines.get(n);if(!d)throw new Error(`hachiue: missing pipeline ${n}`);let x=[{binding:0,resource:{buffer:o}}];for(let i=0;i<e.length;i++)x.push({binding:i+1,resource:{buffer:e[i]}});let P=this.device.createBindGroup({layout:d.getBindGroupLayout(0),entries:x});r.setPipeline(d),r.setBindGroup(0,P),r.dispatchWorkgroups(u,_,g)}runHadamard(r,n,o,e,u,_){if(!this.arch.hadamard)return;let g=this.hadamardSigns.get(u),d=g?1:0,x=this.mkUniform([e,u,_,d]),P=e*(u>>9);this.dispatch(r,"hadamard_512",x,[n,g??this.dummyBuf,o],P)}runRmsNorm(r,n,o,e,u,_){let g=this.weights.get(o);if(!g?.f32Buf)throw new Error(`hachiue: missing norm tensor ${o}`);let d=this.mkUniform([e,u,this.arch.rmsEps,0],new Set([2]));this.dispatch(r,"rmsnorm",d,[n,g.f32Buf,_],e)}runMatmul(r,n,o,e,u,_,g){let d=this.weights.get(n);if(!d)throw new Error(`hachiue: missing weight ${n}`);let x=o;if(d.hadamardFolded&&this.arch.hadamard){let i=g.get(o);if(!i){let f=o;if(this.arch.hadamard.gdnVGrouped&&n.includes(".ssm_out.")&&this.arch.hybrid&&this.arch.hybrid.linearValueHeads>this.arch.hybrid.linearKeyHeads){let b=this.arch.hybrid.linearHeadDim,m=this.arch.hybrid.linearKeyHeads,y=this.arch.hybrid.linearValueHeads/m,A=this.mkUniform([e,b,m,y]);this.dispatch(r,"permute_gdn",A,[o,this.scratch.permBuf],Math.ceil(e*d.K/256)),f=this.scratch.permBuf}i=this.scratch.rotBuf,this.runHadamard(r,f,i,e,d.K,0),g.set(o,i)}x=i}if(d.type===et.F32&&d.f32Buf){let i=Math.ceil(d.N/4),f=Math.min(i,65535),b=Math.ceil(i/f),m=this.mkUniform([e,d.N,d.K,f]);this.dispatch(r,"gemv_f32",m,[x,d.f32Buf,u],f,b,e);return}if(!d.chunks)throw new Error(`hachiue: missing quantized chunks for ${n}`);let P=d.type===et.Q1_0?"gemv_q1_0":d.type===et.PQ2_0?"gemv_pq2_0":d.type===et.PTQ1_0?"gemv_ptq1_0":d.type===et.Q4_0?"gemv_q4_0":d.type===et.Q4_1?"gemv_q4_1":d.type===et.Q4_K?"gemv_q4_k":"gemv_q6_k";for(let i of d.chunks){let f=Math.ceil(i.rowCount/4),b=Math.min(f,65535),m=Math.ceil(f/b),y=this.mkUniform([e,i.rowCount,d.K,d.nb,b,_?1:0,i.rowStart,d.N]);this.dispatch(r,P,y,[x,i.quants,i.scales16,_??this.dummyBuf,u],b,m,e)}}async forwardSegment(r,n=!0,o=!1){let e=r.length;if(e===0)throw new Error("hachiue: empty tokenIds");if(this.cachePos+e>this.maxSeqLen)throw new Error(`hachiue: context length ${this.cachePos+e} exceeds maxSeqLen ${this.maxSeqLen}`);if(this.wasmBackend){let I=this.cachePos;return this.cachePos+=e,this.wasmBackend.forwardSegment(r,n,o,I)}let u=this.arch.heads,_=this.arch.kvHeads,g=this.arch.headDim,d=this.arch.hidden,x=this.arch.intermediate,P=this.arch.rope.rotaryDim,i=this.scratch;this.uniformCursor=0;let f=new Map,b=new Uint32Array(r);this.device.queue.writeBuffer(this.tokensBuf,0,b);let m=this.device.createCommandEncoder(),y=m.beginComputePass(),A=this.weights.get("token_embd.weight"),H=A.type===et.Q1_0?0:A.type===et.PQ2_0?1:A.type===et.PTQ1_0?2:A.type===et.Q4_0?3:A.type===et.Q4_1?4:A.type===et.Q4_K?5:6,V=i.curH,K=i.nextH;for(let I of A.chunks){let U=this.mkUniform([d,H,e,I.rowStart,I.rowCount,0,0,0]);this.dispatch(y,"embed_gather",U,[this.tokensBuf,I.quants,I.scales16,V],Math.ceil(d/256),e)}this.arch.hadamard?.inverseWeights.has("token_embd.weight")&&(this.runHadamard(y,V,K,e,d,1),[V,K]=[K,V]);for(let I=0;I<this.arch.layers;I++){if(this.runRmsNorm(y,V,`blk.${I}.attn_norm.weight`,e,d,i.n1),f.clear(),this.arch.archName==="plamo3"){let F=u*g,S=_*g;this.runMatmul(y,`blk.${I}.attn_qkv.weight`,i.n1,e,i.qkvMixed,null,f);let p=this.mkUniform([e,F,S,0]);this.dispatch(y,"split_qkv",p,[i.qkvMixed,i.qBuf,i.kBuf,i.vBuf],Math.ceil(e*(F+2*S)/256)),this.runRmsNorm(y,i.qBuf,`blk.${I}.attn_q_norm.weight`,e*u,g,i.qNormed),this.runRmsNorm(y,i.kBuf,`blk.${I}.attn_k_norm.weight`,e*_,g,i.kNormed);let O=!!(this.arch.swa&&this.arch.swa.layerTypes[I]==="swa"),B=O&&this.swaCosBuf?this.swaCosBuf:this.cosBuf,h=O&&this.swaSinBuf?this.swaSinBuf:this.sinBuf,v=O&&this.arch.swa?this.arch.swa.windowSize:0,C=this.mkUniform([e,u,g,P,this.cachePos,0,0,0]),R=this.mkUniform([e,_,g,P,this.cachePos,0,0,0]);this.dispatch(y,"rope",C,[B,h,i.qNormed],Math.ceil(e*u*(P>>1)/64)),this.dispatch(y,"rope",R,[B,h,i.kNormed],Math.ceil(e*_*(P>>1)/64));let j=this.mkUniform([e,_,g,this.cachePos]),it=e*_*(g>>5),Y=this.kCacheQ.get(I),ht=this.kCacheS.get(I),yt=this.vCacheQ.get(I),Dt=this.vCacheS.get(I);this.dispatch(y,"kv_append_q8",j,[i.kNormed,Y,ht],it),this.dispatch(y,"kv_append_q8",j,[i.vBuf,yt,Dt],it);let St=this.mkUniform([e,u,_,g,this.cachePos,v,0,0]);this.dispatch(y,"attention_q8",St,[i.qNormed,Y,ht,yt,Dt,i.attOut],e*u),f.clear(),this.runMatmul(y,`blk.${I}.attn_output.weight`,i.attOut,e,i.n1,null,f),this.runRmsNorm(y,i.n1,`blk.${I}.post_attention_norm`,e,d,i.n2);let ut=this.mkUniform([e*d,0,0,0]);this.dispatch(y,"add_inplace",ut,[V,i.n2,i.h2],Math.ceil(e*d/256)),this.runRmsNorm(y,i.h2,`blk.${I}.ffn_norm.weight`,e,d,i.n1),f.clear(),this.runMatmul(y,`blk.${I}.ffn_up.weight`,i.n1,e,i.mlpGate,null,f);let bt=this.mkUniform([e,x,0,0]);this.dispatch(y,"swiglu_fused",bt,[i.mlpGate,i.swigluOut],Math.ceil(e*x/256)),f.clear(),this.runMatmul(y,`blk.${I}.ffn_down.weight`,i.swigluOut,e,i.n1,null,f),this.runRmsNorm(y,i.n1,`blk.${I}.post_ffw_norm`,e,d,i.n2),this.dispatch(y,"add_inplace",ut,[i.h2,i.n2,K],Math.ceil(e*d/256)),[V,K]=[K,V];continue}if(this.arch.hybrid&&this.arch.hybrid.layerTypes[I]==="linear"&&this.arch.hybrid){let F=this.arch.hybrid,S=F.linearKeyHeads,p=F.linearValueHeads,O=F.linearHeadDim,B=S*O,h=p*O,v=B*2+h,C=F.convKernel,R=this.cachePos>0?1:0,j=this.ssmParity;this.runMatmul(y,`blk.${I}.attn_qkv.weight`,i.n1,e,i.qkvMixed,null,f),this.runMatmul(y,`blk.${I}.attn_gate.weight`,i.n1,e,i.zGate,null,f);let it=this.weights.get(`blk.${I}.ssm_conv1d.weight`).f32Buf,Y=this.ssmConvState.get(I),ht=this.mkUniform([e,v,C,R]),yt=e*v+(C-1)*v,Dt=Math.ceil(yt/64),St=Math.min(Dt,65535),ut=Math.ceil(Dt/St);this.dispatch(y,"conv1d_causal",ht,[i.qkvMixed,it,Y[j],i.qkvConv,Y[j^1]],St,ut),this.runMatmul(y,`blk.${I}.ssm_alpha.weight`,i.n1,e,i.aProj,null,f),this.runMatmul(y,`blk.${I}.ssm_beta.weight`,i.n1,e,i.bProj,null,f);let bt=this.weights.get(`blk.${I}.ssm_a`).f32Buf,Lt=this.weights.get(`blk.${I}.ssm_dt.bias`).f32Buf,Ot=this.mkUniform([e,p,0,0]);this.dispatch(y,"deltanet_gbeta",Ot,[i.aProj,i.bProj,bt,Lt,i.gbeta],Math.ceil(e*p/64));let wt=this.ssmRecState.get(I),Rt=this.mkUniform([e,p,O,O,S,R,0,0]);this.dispatch(y,"deltanet_recur",Rt,[i.qkvConv,i.gbeta,wt[j],i.core,wt[j^1]],p);let Ht=this.weights.get(`blk.${I}.ssm_norm.weight`).f32Buf,Jt=this.mkUniform([e*p,O,this.arch.rmsEps,0],new Set([2]));this.dispatch(y,"deltanet_norm_gate",Jt,[i.core,i.zGate,Ht,i.normed],e*p),f.clear(),this.runMatmul(y,`blk.${I}.ssm_out.weight`,i.normed,e,i.h2,V,f)}else{let F=this.arch.archName==="qwen35";if(F){this.runMatmul(y,`blk.${I}.attn_q.weight`,i.n1,e,i.qgBuf,null,f);let it=this.mkUniform([e,u,g,0]);this.dispatch(y,"split_q_gate",it,[i.qgBuf,i.qBuf,i.gateBuf],Math.ceil(e*u*g/256))}else this.runMatmul(y,`blk.${I}.attn_q.weight`,i.n1,e,i.qBuf,null,f);this.runMatmul(y,`blk.${I}.attn_k.weight`,i.n1,e,i.kBuf,null,f),this.runMatmul(y,`blk.${I}.attn_v.weight`,i.n1,e,i.vBuf,null,f),this.runRmsNorm(y,i.qBuf,`blk.${I}.attn_q_norm.weight`,e*u,g,i.qNormed),this.runRmsNorm(y,i.kBuf,`blk.${I}.attn_k_norm.weight`,e*_,g,i.kNormed);let S=this.mkUniform([e,u,g,P,this.cachePos,0,0,0]),p=this.mkUniform([e,_,g,P,this.cachePos,0,0,0]);this.dispatch(y,"rope",S,[this.cosBuf,this.sinBuf,i.qNormed],Math.ceil(e*u*(P>>1)/64)),this.dispatch(y,"rope",p,[this.cosBuf,this.sinBuf,i.kNormed],Math.ceil(e*_*(P>>1)/64));let O=this.mkUniform([e,_,g,this.cachePos]),B=e*_*(g>>5),h=this.kCacheQ.get(I),v=this.kCacheS.get(I),C=this.vCacheQ.get(I),R=this.vCacheS.get(I);this.dispatch(y,"kv_append_q8",O,[i.kNormed,h,v],B),this.dispatch(y,"kv_append_q8",O,[i.vBuf,C,R],B);let j=this.mkUniform([e,u,_,g,this.cachePos,0,0,0]);if(this.dispatch(y,"attention_q8",j,[i.qNormed,h,v,C,R,i.attOut],e*u),F){let it=this.mkUniform([e*u*g,0,0,0]);this.dispatch(y,"sigmoid_gate",it,[i.gateBuf,i.attOut],Math.ceil(e*u*g/256))}f.clear(),this.runMatmul(y,`blk.${I}.attn_output.weight`,i.attOut,e,i.h2,V,f)}let Q=this.arch.archName==="qwen35"?`blk.${I}.post_attention_norm.weight`:`blk.${I}.ffn_norm.weight`;this.runRmsNorm(y,i.h2,Q,e,d,i.n2),f.clear(),this.runMatmul(y,`blk.${I}.ffn_gate.weight`,i.n2,e,i.mlpGate,null,f),this.runMatmul(y,`blk.${I}.ffn_up.weight`,i.n2,e,i.mlpUp,null,f);let E=this.mkUniform([e*x,0,0,0]);this.dispatch(y,"swiglu",E,[i.mlpGate,i.mlpUp,i.swigluOut],Math.ceil(e*x/256)),f.clear(),this.runMatmul(y,`blk.${I}.ffn_down.weight`,i.swigluOut,e,K,i.h2,f),[V,K]=[K,V]}if(this.arch.hybrid&&(this.ssmParity^=1),this.cachePos+=e,!n)return y.end(),this.device.queue.submit([m.finish()]),await this.device.queue.onSubmittedWorkDone(),{};if(e>1){y.end(),m.copyBufferToBuffer(V,(e-1)*d*4,i.lastHidden,0,d*4);let I=m.beginComputePass();if(this.runRmsNorm(I,i.lastHidden,"output_norm.weight",1,d,i.finalNorm),f.clear(),this.runMatmul(I,"output.weight",i.finalNorm,1,this.logitsBuf,null,f),o){let U=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(I,"argmax",U,[this.logitsBuf,this.argmaxBuf],1)}I.end()}else{if(this.runRmsNorm(y,V,"output_norm.weight",1,d,i.finalNorm),f.clear(),this.runMatmul(y,"output.weight",i.finalNorm,1,this.logitsBuf,null,f),o){let I=this.mkUniform([this.arch.vocab,0,0,0]);this.dispatch(y,"argmax",I,[this.logitsBuf,this.argmaxBuf],1)}y.end()}if(o){m.copyBufferToBuffer(this.argmaxBuf,0,this.argmaxReadBuf,0,4),this.device.queue.submit([m.finish()]),await this.argmaxReadBuf.mapAsync(GPUMapMode.READ);let I=new Uint32Array(this.argmaxReadBuf.getMappedRange())[0];return this.argmaxReadBuf.unmap(),{greedyId:I}}return m.copyBufferToBuffer(this.logitsBuf,0,this.logitsReadBuf,0,this.arch.vocab*4),this.device.queue.submit([m.finish()]),await this.logitsReadBuf.mapAsync(GPUMapMode.READ),this.logitsCpu.set(new Float32Array(this.logitsReadBuf.getMappedRange())),this.logitsReadBuf.unmap(),{logits:this.logitsCpu}}async generate(r,n={}){let o,e=null;if(Array.isArray(r)&&typeof r[0]=="number")o=r;else if(typeof r=="string"){if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");o=this.tokenizer.encode(r)}else{if(!this.tokenizer)throw new Error("hachiue: GGUF header does not contain a tokenizer");if(e=r,this.lastMessages.length>0&&e.length>this.lastMessages.length&&this.lastMessages.every((I,U)=>e[U].role===I.role&&e[U].content===I.content)){let I=e.slice(this.lastMessages.length),U=this.tokenizer.formatChat(I);o=[...this.lastTurnTokens,...this.tokenizer.encode(U)]}else{let I=this.tokenizer.formatChat(e);o=this.tokenizer.encode(I)}}if(o.length===0)throw new Error("hachiue: prompt produced 0 tokens");let u=0;for(;u<this.tokenHistory.length&&u<o.length-1&&this.tokenHistory[u]===o[u];)u++;u<this.tokenHistory.length&&(this.arch.hybrid||u===0?(this.resetCache(),u=0):(this.cachePos=u,this.tokenHistory=this.tokenHistory.slice(0,u)));let _=o.slice(u),g=n.maxNewTokens??512,d=new Set([this.arch.eosTokenId,...n.stopTokens??[]]);if(this.arch.eomTokenId!==void 0&&d.add(this.arch.eomTokenId),this.arch.eotTokenId!==void 0&&d.add(this.arch.eotTokenId),this.arch.archName==="plamo3"){let K=this.tokenizer?.tokenToId("<|plamo:eom|>");K!==void 0&&d.add(K)}let x=(n.temperature??.6)<=0&&(n.repetitionPenalty===void 0||n.repetitionPenalty===1),P=performance.now(),i=0;for(let K=0;K<_.length;K+=gt){if(n.signal?.aborted)throw new DOMException("Generation aborted","AbortError");let I=_.slice(K,K+gt),U=K+gt>=_.length,Q=await this.forwardSegment(I,U,x);this.tokenHistory.push(...I),U&&(x&&Q.greedyId!==void 0?i=Q.greedyId:Q.logits&&(i=Ue(Q.logits,this.arch.vocab,this.tokenHistory,n)))}let f=performance.now()-P,b=[],m=this.tokenizer?.createDecoderStream(!0),y=performance.now();for(let K=0;K<g&&!(n.signal?.aborted||d.has(i));K++){b.push(i);let I=m?m.push(i):"";if(n.onToken?.(i,I),K+1>=g||this.cachePos+1>this.maxSeqLen)break;let U=await this.forwardSegment([i],!0,x);this.tokenHistory.push(i),x&&U.greedyId!==void 0?i=U.greedyId:U.logits&&(i=Ue(U.logits,this.arch.vocab,this.tokenHistory,n))}let A=m?m.flush():"";A&&n.onToken?.(-1,A);let H=Math.max(1,performance.now()-y),V=this.tokenizer?this.tokenizer.decode(b,!0):"";if(e&&this.tokenizer){this.lastMessages=[...e.map(I=>({...I})),{role:"assistant",content:V}];let K=this.arch.archName==="plamo3"?"<|plamo:eom|>":`<|im_end|>
`;this.lastTurnTokens=[...o,...b,...this.tokenizer.encode(K)]}return{text:V,tokenIds:b,stats:{promptTokens:_.length,generatedTokens:b.length,prefillMs:f,decodeMs:H,prefillTokensPerSec:_.length/Math.max(1,f)*1e3,decodeTokensPerSec:b.length/H*1e3,reusedCache:u>0,backend:this.backend,isWorker:this.isWorker}}}};function qr(s){return(s||"").replace(/<\|plamo:[^>]*\|>/g,"").trim()}var Nn=new Set(["plain","polite"]);function Er({text:s,targetLang:r,sourceLang:n,form:o,glossary:e,context:u,history:_}){let g=String(r||"ja").trim().toLowerCase();if(!String(s??"").trim())throw new Error("text must not be empty");let d="<|plamo:bos|><|plamo:tag|>dataset<|plamo:msg|>translation";if(u&&String(u).trim()&&(d+=`<|plamo:tag|>context<|plamo:msg|>${String(u).trim()}`),Array.isArray(e)&&e.length){let x=e.filter(P=>P&&String(P.source??"").trim()&&String(P.target??"").trim());if(x.length){d+="<|plamo:tag|>glossary";for(let P of x)d+=`<|plamo:index|>${String(P.source).trim()}<|plamo:item|>${String(P.target).trim()}`}}if(Array.isArray(_)){let x=n&&n!=="auto"?String(n).toLowerCase():"";for(let P of _){if(!P||!String(P.source??"").trim()||!String(P.translation??"").trim())continue;let i=P.sourceLang?String(P.sourceLang).toLowerCase():x,f=P.targetLang?String(P.targetLang).toLowerCase():g;d+="<|plamo:tag|>input",i&&(d+=`<|plamo:key|>lang<|plamo:val|>${i}`),d+=`<|plamo:msg|>${String(P.source).trim()}`,d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${f}<|plamo:msg|>${String(P.translation).trim()}`}}return d+="<|plamo:tag|>input",n&&String(n).toLowerCase()!=="auto"&&(d+=`<|plamo:key|>lang<|plamo:val|>${String(n).toLowerCase()}`),d+=`<|plamo:msg|>${String(s)}`,d+=`<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${g}`,Nn.has(o)&&g.startsWith("ja")&&(d+=`<|plamo:key|>form<|plamo:val|>${o}`),d+="<|plamo:msg|>",d}var Be="https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF/resolve/0c4af2b003fdd94b6868aa955414c1c86ee96997/plamo-3-translate-0.8b-Q4_K_M.gguf",Cn="plamo-3-translate-0.8b-Q4_K_M.gguf",Tn=300*1e3,Me=Tn,Zt=null,te="unloaded",ke=null,De=null,Se=0,ve=null,dr=Promise.resolve(),Ie=null;function ze(...s){console.log("[offscreen]",...s)}function fr(...s){console.warn("[offscreen]",...s)}function hr(){ve&&(clearTimeout(ve),ve=null)}function mr(){hr(),te==="ready"&&(ve=setTimeout(()=>{Fn()},Me))}async function Fn(){let s=dr;ve=null;try{await s}catch{}if(Date.now()-Se<Me){mr();return}ze(`idle for ${Me}ms \u2014 disposing engine`),await Tr();try{await chrome.runtime.sendMessage({type:"BUILTIN_IDLE_UNLOAD"})}catch(r){fr("could not notify SW for document close:",r&&r.message)}}async function Tr(){if(hr(),!Zt){te="unloaded";return}try{Zt.dispose()}catch(s){fr("engine.dispose() threw:",s&&s.message)}Zt=null,te="unloaded",De=null}function oe(s){let r=dr.then(s);return dr=r.then(()=>{},()=>{}),r}function _r(){Se=Date.now(),mr()}var Nr=0;function Cr(s){let r=Date.now();r-Nr<100&&s.phase!=="ready"||(Nr=r,chrome.runtime.sendMessage({type:"OFFSCREEN_PROGRESS",phase:s.phase??"weights",loadedBytes:s.loadedBytes??0,totalBytes:s.totalBytes??0,cached:!!s.cached}).catch(()=>{}))}async function Fr(){if(te==="ready"&&Zt)return Zt;if(Ie)return Ie;if(!navigator.gpu)throw new Error("WEBGPU_UNAVAILABLE: this browser cannot run the built-in model");te="loading",ke=null,Ie=(async()=>{let s=performance.now();try{Zt=await xe.create({url:Be,backend:"webgpu",maxSeqLen:2048,onProgress:Cr,onDeviceLost:r=>{fr("WebGPU device lost:",r.reason,r.message),ke=`WebGPU device lost (${r.reason})`,te="error"}})}catch(r){throw te="error",ke=r&&r.message||String(r),Zt=null,new Error(`LOAD_FAILED: ${ke}`)}return De={...Zt.backendInfo},te="ready",ze(`model loaded in ${((performance.now()-s)/1e3).toFixed(1)}s (${De.backend}${De.isWorker?" worker":""})`),Cr({phase:"ready",loadedBytes:0,totalBytes:0,cached:!0}),_r(),Zt})();try{return await Ie}finally{Ie=null}}function Ke(){return{state:te,lastError:ke,backend:De,lastActivityAt:Se,idleMs:Se?Date.now()-Se:null,webgpuAvailable:!!navigator.gpu,modelUrl:Be,modelName:Cn}}async function Rn(){return Ke()}async function Un(){let[s,r]=await Promise.all([nr(Be).catch(()=>!1),Fe(Be).catch(()=>null)]);return{cached:s,sizeBytes:r??null}}async function Xn(){return await Fr(),Ke()}async function Hn(s){let r=await Fr();hr();try{let n=String(s.text??"");if(!n.trim())throw new Error("EMPTY_TEXT");let o=String(s.targetLang||"ja").toLowerCase(),e=typeof s.sourceLang=="string"?s.sourceLang:void 0,u=Array.isArray(s.glossary)?s.glossary:void 0,_=s.form==="polite"||s.form==="plain"?s.form:void 0,g=typeof s.context=="string"?s.context:void 0,d=Array.isArray(s.history)?s.history:void 0,x=Er({text:n,targetLang:o,sourceLang:e,form:_,glossary:u,context:g,history:d}),P=performance.now(),i=await r.generate(x,{maxNewTokens:512,temperature:0});return _r(),{translation:qr(i.text),stats:{promptTokens:i.stats.promptTokens,generatedTokens:i.stats.generatedTokens,prefillTokensPerSec:i.stats.prefillTokensPerSec,decodeTokensPerSec:i.stats.decodeTokensPerSec,elapsedMs:performance.now()-P,backend:i.stats.backend}}}catch(n){throw _r(),n}}async function $n(){return await Tr(),Ke()}async function Vn(){return await sr(Be),Ke()}chrome.runtime.onMessage.addListener((s,r,n)=>{if(!s||s.target!=="offscreen")return!1;let o=s.type;return ze("recv",o),(async()=>{switch(o){case"OFFSCREEN_STATUS":n({ok:!0,status:await oe(Rn)});return;case"OFFSCREEN_CACHE_INFO":n({ok:!0,cache:await oe(Un)});return;case"OFFSCREEN_LOAD_MODEL":n({ok:!0,status:await oe(Xn)});return;case"OFFSCREEN_TRANSLATE":n({ok:!0,...await oe(()=>Hn(s))});return;case"OFFSCREEN_UNLOAD":n({ok:!0,status:await oe($n)});return;case"OFFSCREEN_CLEAR_CACHE":n({ok:!0,status:await oe(Vn)});return;case"OFFSCREEN_SET_IDLE_TIMEOUT":{let e=Number(s.ms);Number.isFinite(e)&&e>=1e3?(Me=e,mr(),n({ok:!0,idleTimeoutMs:Me})):n({ok:!1,error:"ms must be >= 1000"});return}default:n({ok:!1,error:`unknown offscreen message: ${o}`})}})().catch(e=>{n({ok:!1,error:e&&e.message||String(e)})}),!0});ze("offscreen runtime ready");
