import { useState, useEffect, useRef, useCallback } from "react";
import { verifyMessage } from "ethers";
import { isMintConfigured, mintAchievement } from "./lib/nft.js";
import { DB, migrateLocalStorageToDb } from "./lib/db.js";

const BG    = "#F5F0E8";
const GOLD  = "#F5A623";
const DARK  = "#1C1C1E";
const MID   = "#6B7280";
const WHITE = "#FFFFFF";
const BORDER= "1px solid #E5E0D8";
const LITE  = "#F0EBE0";

const PUZZLES = [
  {id:1,  url:"https://images.unsplash.com/photo-1539768942893-daf53e448371?w=900&q=85", title:"Pyramid of Giza",  desc:"Ancient wonder of the world and oldest of the seven wonders.",     tags:["pyramid","egypt","ancient"]},
  {id:2,  url:"https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=900&q=85", title:"Burj Khalifa",     desc:"The world's tallest skyscraper piercing the Dubai skyline.",        tags:["dubai","skyscraper","uae"]},
  {id:3,  url:"https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&q=85", title:"Eiffel Tower",     desc:"The iconic iron lattice tower standing tall in Paris, France.",     tags:["paris","france","eiffel"]},
  {id:4,  url:"https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=900&q=85", title:"Forest Path",      desc:"A serene path winding through a lush green forest.",               tags:["nature","forest","green"]},
  {id:5,  url:"https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=900&q=85", title:"Mountain Lake",    desc:"Crystal clear alpine lake reflecting snow-capped mountains.",      tags:["mountain","lake","alpine"]},
  {id:6,  url:"https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=900&q=85", title:"Golden Gate",      desc:"San Francisco's iconic suspension bridge in morning fog.",          tags:["bridge","usa","sanfrancisco"]},
  {id:7,  url:"https://images.unsplash.com/photo-1571371867188-fdc3f1f8e62d?w=900&q=85", title:"Northern Lights",  desc:"The breathtaking aurora borealis dancing across arctic skies.",    tags:["aurora","sky","night"]},
  {id:8,  url:"https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900&q=85", title:"New York City",    desc:"The city that never sleeps, a concrete jungle of skyscrapers.",    tags:["newyork","city","skyline"]},
  {id:9,  url:"https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=900&q=85", title:"Ocean Sunset",     desc:"Golden hour over the ocean with waves gently lapping the shore.", tags:["ocean","sunset","beach"]},
  {id:10, url:"https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=900&q=85", title:"Machu Picchu",     desc:"The lost city of the Incas high in the Andes mountains of Peru.",  tags:["peru","ruins","inca"]},
  {id:11, url:"https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=900&q=85", title:"Swiss Alps",       desc:"Majestic snow-capped peaks of the Swiss Alps in golden light.",    tags:["alps","snow","switzerland"]},
  {id:12, url:"https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=900&q=85", title:"Tokyo at Night",   desc:"Neon-lit streets of Tokyo glowing in the rain-soaked night.",     tags:["tokyo","japan","neon"]},
];

const PIECES = [
  {n:16, g:4,  label:"16"},
  {n:25, g:5,  label:"25"},
  {n:36, g:6,  label:"36"},
  {n:64, g:8,  label:"64"},
  {n:100,g:10, label:"100"},
  {n:144,g:12, label:"144"},
  {n:196,g:14, label:"196"},
  {n:256,g:16, label:"256"},
  {n:289,g:17, label:"289"},
];

const MONAD = {
  chainId: import.meta.env.VITE_MONAD_CHAIN_ID || "0x8F", // Monad Mainnet = chain id 143
  chainName: "Monad",
  nativeCurrency:{name:"MON",symbol:"MON",decimals:18},
  rpcUrls:[import.meta.env.VITE_MONAD_RPC_URL || "https://rpc.monad.xyz"],
  blockExplorerUrls:[import.meta.env.VITE_MONAD_EXPLORER_URL || "https://monadscan.com"],
};
// Wallet address(es) granted admin access, configured via VITE_ADMIN_WALLET (comma-separated
// for more than one). Never hardcode an address here — set it in your deploy environment instead.
const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_WALLET || "")
  .split(",").map(a=>a.trim().toLowerCase()).filter(Boolean);

const S = {
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
};
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const addLog=e=>{const l=S.get("logs",[]);l.unshift({...e,ts:Date.now()});S.set("logs",l);};
const readFile=f=>new Promise(r=>{const fr=new FileReader();fr.onload=e=>r(e.target.result);fr.readAsDataURL(f);});
const shortAddr=a=>a?`${a.slice(0,6)}...${a.slice(-4)}`:"";
const USERNAME_RE=/^[a-zA-Z0-9_]+$/;

function getPuzzleFromURL(){
  const p=new URLSearchParams(window.location.search);
  const pid=parseInt(p.get("puzzle")); const pcs=parseInt(p.get("pieces"));
  if(!pid||!pcs) return null;
  const all=[...PUZZLES,...(S.get("userPuzzles",[])||[])];
  const puzzle=all.find(x=>x.id===pid);
  const opt=PIECES.find(x=>x.n===pcs)||PIECES[0];
  return puzzle?{puzzle,opt}:null;
}
function setPuzzleURL(pid,n){
  const u=new URL(window.location.href);
  u.searchParams.set("puzzle",pid); u.searchParams.set("pieces",n);
  window.history.replaceState({},"",u.toString());
}
function clearPuzzleURL(){
  const u=new URL(window.location.href);
  u.searchParams.delete("puzzle"); u.searchParams.delete("pieces");
  window.history.replaceState({},"",u.toString());
}

function playSnap(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(880,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+0.06);
    g.gain.setValueAtTime(0.3,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);
    o.start(); o.stop(ctx.currentTime+0.12);
  }catch{}
}

async function connectWallet(){
  if(!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask or Rabby.");
  const [addr]=await window.ethereum.request({method:"eth_requestAccounts"});
  try{ await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:MONAD.chainId}]}); }
  catch(e){ if(e.code===4902) await window.ethereum.request({method:"wallet_addEthereumChain",params:[MONAD]}); else throw e; }
  return addr;
}

// ─────────────────────────────────────
// WALLET AUTHENTICATION (replaces username/password)
// Connecting a wallet is not enough on its own — the user must also sign a
// SIWE-style message, proving they control the private key for that address,
// before we trust the address and create/open their session.
// ─────────────────────────────────────
function buildSiweMessage(address,nonce){
  return `${window.location.host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to PuzzleChain to verify you own this wallet. This request will not trigger a blockchain transaction or cost any gas.\n\nURI: ${window.location.origin}\nVersion: 1\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
}

async function signInWithWallet(){
  const address=await connectWallet(); // requests accounts + switches to Monad Mainnet
  const addrLower=address.toLowerCase();
  const nonce=Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  const message=buildSiweMessage(address,nonce);

  let signature;
  try{
    signature=await window.ethereum.request({method:"personal_sign",params:[message,address]});
  }catch(e){
    if(e?.code===4001) throw new Error("Signature request was rejected.");
    throw new Error("Failed to sign the verification message.");
  }

  let recovered=null;
  try{ recovered=verifyMessage(message,signature); }catch{ recovered=null; }
  if(!recovered||recovered.toLowerCase()!==addrLower){
    throw new Error("Wallet signature could not be verified. Please try again.");
  }

  // Signature verified — this wallet is now provably owned by whoever is connecting.
  const usersByWallet=S.get("usersByWallet",{});
  let record=usersByWallet[addrLower];
  let isNew=false;
  const isAdminNow=ADMIN_WALLETS.includes(addrLower);
  if(!record){
    isNew=true;
    record={
      address, addressLower:addrLower,
      username:"", displayName:"", bio:"", pfp:"",
      isAdmin:isAdminNow,
      createdAt:Date.now(),
    };
    usersByWallet[addrLower]=record;
    S.set("usersByWallet",usersByWallet);
  }else if(record.isAdmin!==isAdminNow){
    // Admin status is config-driven (VITE_ADMIN_WALLET), so keep it fresh on every
    // sign-in rather than freezing whatever it was when the account was first created.
    record.isAdmin=isAdminNow;
    usersByWallet[addrLower]=record;
    S.set("usersByWallet",usersByWallet);
  }

  S.set("session",{address:addrLower,signedAt:Date.now()});
  S.set("wallet",address);
  window.dispatchEvent(new Event("walletchange"));
  addLog({type:isNew?"account_created":"account_signed_in",address:addrLower});
  return {...record,address:record.address||address};
}

function signOutWallet(){
  // Ends the app session only — never touches MetaMask's own connection.
  S.set("session",null);
  S.set("wallet",null);
  window.dispatchEvent(new Event("walletchange"));
}

function getSessionUser(){
  const session=S.get("session");
  if(!session?.address) return null;
  const usersByWallet=S.get("usersByWallet",{});
  const record=usersByWallet[session.address];
  if(!record) return null;
  const isAdminNow=ADMIN_WALLETS.includes(session.address);
  if(record.isAdmin!==isAdminNow){
    record.isAdmin=isAdminNow;
    usersByWallet[session.address]=record;
    S.set("usersByWallet",usersByWallet);
  }
  return {...record};
}

function isUsernameTaken(username,excludeAddrLower){
  if(!username) return false;
  const usersByWallet=S.get("usersByWallet",{});
  return Object.values(usersByWallet).some(u=>
    u.addressLower!==excludeAddrLower && u.username && u.username.toLowerCase()===username.toLowerCase()
  );
}

function useTimer(){
  const [secs,set]=useState(0);
  const [on,setOn]=useState(false);
  const r=useRef(null);
  const start=useCallback(()=>{if(on)return;setOn(true);const t0=Date.now()-secs*1000;r.current=setInterval(()=>set(Math.floor((Date.now()-t0)/1000)),100);},[on,secs]);
  const stop=useCallback(()=>{setOn(false);clearInterval(r.current);},[]);
  const toggle=useCallback(()=>{on?stop():start();},[on,start,stop]);
  useEffect(()=>()=>clearInterval(r.current),[]);
  return{secs,on,start,stop,toggle};
}

function tabDir(col,row,side,grid){
  return(((col*374761393+row*668265263+side*2246822519+grid*9999991)>>>0)%2)===0?1:-1;
}
function piecePath(col,row,grid,PS,T){
  const top=row===0?0:-tabDir(col,row-1,1,grid);
  const right=col===grid-1?0:tabDir(col,row,0,grid);
  const bot=row===grid-1?0:tabDir(col,row,1,grid);
  const left=col===0?0:-tabDir(col-1,row,0,grid);
  const c=T*.38; let d=`M 0 0`;
  if(!top)d+=` L ${PS} 0`;else{const r=top;d+=` L ${PS*.3} 0 C ${PS*.3} ${-c*r} ${PS*.4} ${-T*r} ${PS*.5} ${-T*r} C ${PS*.6} ${-T*r} ${PS*.7} ${-c*r} ${PS*.7} 0 L ${PS} 0`;}
  if(!right)d+=` L ${PS} ${PS}`;else{const r=right;d+=` L ${PS} ${PS*.3} C ${PS+c*r} ${PS*.3} ${PS+T*r} ${PS*.4} ${PS+T*r} ${PS*.5} C ${PS+T*r} ${PS*.6} ${PS+c*r} ${PS*.7} ${PS} ${PS*.7} L ${PS} ${PS}`;}
  if(!bot)d+=` L 0 ${PS}`;else{const r=bot;d+=` L ${PS*.7} ${PS} C ${PS*.7} ${PS+c*r} ${PS*.6} ${PS+T*r} ${PS*.5} ${PS+T*r} C ${PS*.4} ${PS+T*r} ${PS*.3} ${PS+c*r} ${PS*.3} ${PS} L 0 ${PS}`;}
  if(!left)d+=` L 0 0`;else{const r=left;d+=` L 0 ${PS*.7} C ${-c*r} ${PS*.7} ${-T*r} ${PS*.6} ${-T*r} ${PS*.5} C ${-T*r} ${PS*.4} ${-c*r} ${PS*.3} 0 ${PS*.3} L 0 0`;}
  return d+"Z";
}

// ─────────────────────────────────────
// PUZZLE GAME
// Puzzle area is always 9:16 on mobile, centered.
// Controls bar is BELOW the puzzle area (not overlapping).
// Fullscreen button expands the puzzle to 100vw×100vh with controls bar still visible.
// ─────────────────────────────────────
function PuzzleGame({puzzle,opt,onBack,user}){
  const {n,g}=opt;
  const timer=useTimer();
  const canvasRef=useRef(null);
  const wrapRef=useRef(null);
  const stRef=useRef(null);
  const dragRef=useRef(null);
  const [done,setDone]=useState(false);
  const [showRef,setShowRef]=useState(false);
  const [paused,setPaused]=useState(false);
  const [progress,setProgress]=useState(0);
  const [completionBar,setCompletionBar]=useState(null);
  const [fullscreen,setFullscreen]=useState(false);
  const imgRef=useRef(null);
  const [imgReady,setImgReady]=useState(false);
  const BS=36; // button size — uniform

  useEffect(()=>{
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{imgRef.current=img;setImgReady(true);};
    img.onerror=()=>{img.src=puzzle.url.replace("?w=900","?w=600");};
    img.src=puzzle.url;
  },[puzzle.url]);

  const initGame=useCallback(()=>{
    const canvas=canvasRef.current; const wrap=wrapRef.current;
    if(!canvas||!wrap||!imgRef.current) return;
    const W=wrap.offsetWidth; const H=wrap.offsetHeight;
    canvas.width=W; canvas.height=H;
    const PAD=20;
    const PS=Math.max(18,Math.min(Math.floor((W-PAD*2)/g),Math.floor((H-PAD*2)/g),82));
    const TAB=Math.floor(PS*0.22);
    const SNAP=PS*0.44;
    const bW=PS*g+TAB*2; const bH=PS*g+TAB*2;
    const mx=Math.max(TAB+PAD,0); const my=mx;
    const pieces=Array.from({length:n},(_,i)=>({
      id:i,col:i%g,row:Math.floor(i/g),
      x:mx+Math.random()*Math.max(bW-PS-mx*2,0),
      y:my+Math.random()*Math.max(bH-PS-my*2,0),
      gid:i,z:i,
    }));
    stRef.current={pieces,PS,TAB,SNAP,W,H,g,n,maxZ:n};
    draw();
  },[n,g]);

  useEffect(()=>{if(imgReady)initGame();},[imgReady,initGame]);

  const doneRef=useRef(false);
  useEffect(()=>{doneRef.current=done;},[done]);

  // Switching between fullscreen/normal layouts swaps the canvas to a new DOM node
  // (different JSX tree shape), which loses whatever was drawn on it. Re-measure the
  // new node and redraw the *existing* pieces (scaled to fit) — never re-randomize.
  const draw=useCallback(()=>{
    const canvas=canvasRef.current; const st=stRef.current; const img=imgRef.current;
    if(!canvas||!st||!img) return;
    const ctx=canvas.getContext("2d");
    const {pieces,PS,TAB,W,H,g}=st; const imgW=PS*g,imgH=PS*g;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#23252F"; ctx.fillRect(0,0,W,H);
    const sorted=[...pieces].sort((a,b)=>a.z-b.z);
    for(const p of sorted){
      const path=new Path2D(piecePath(p.col,p.row,g,PS,TAB));
      const isDrag=dragRef.current?.gid===p.gid;
      ctx.save(); ctx.translate(p.x,p.y);
      ctx.shadowColor=isDrag?"rgba(0,0,0,0.85)":"rgba(0,0,0,0.35)";
      ctx.shadowBlur=isDrag?22:8; ctx.shadowOffsetY=isDrag?7:2;
      ctx.clip(path);
      ctx.drawImage(img,-p.col*PS,-p.row*PS,imgW,imgH);
      ctx.restore();
      ctx.save(); ctx.translate(p.x,p.y);
      ctx.strokeStyle=isDrag?"rgba(245,166,35,0.95)":"rgba(0,0,0,0.28)";
      ctx.lineWidth=isDrag?2.5:1; ctx.stroke(path);
      ctx.restore();
    }
  },[]);

  const relayout=useCallback(()=>{
    const canvas=canvasRef.current; const wrap=wrapRef.current; const st=stRef.current;
    if(!canvas||!wrap) return;
    const W=wrap.offsetWidth; const H=wrap.offsetHeight;
    if(!W||!H) return;
    if(!st){ canvas.width=W; canvas.height=H; return; }
    const PAD=20;
    const PS=Math.max(18,Math.min(Math.floor((W-PAD*2)/st.g),Math.floor((H-PAD*2)/st.g),82));
    const scale=PS/st.PS;
    canvas.width=W; canvas.height=H;
    const TAB=Math.floor(PS*0.22);
    const SNAP=PS*0.44;
    const pieces=st.pieces.map(p=>({...p,x:p.x*scale,y:p.y*scale}));
    stRef.current={...st,pieces,PS,TAB,SNAP,W,H};
    draw();
  },[draw]);

  // Single source of truth for "the canvas container changed size" — covers both
  // ordinary window resizes AND toggling fullscreen (which swaps in a whole new
  // wrapper element). Re-created whenever `fullscreen` changes so it's always bound
  // to the wrapper that's actually on screen, never a stale/detached one. Always
  // rescales the existing pieces in place; it must never re-randomize the board.
  useEffect(()=>{
    if(!imgReady) return;
    relayout(); // sync pass for whichever wrapper node is current right now
    const obs=new ResizeObserver(()=>relayout());
    if(wrapRef.current) obs.observe(wrapRef.current);
    return()=>obs.disconnect();
  },[imgReady,fullscreen,relayout]);

  const getXY=useCallback((e)=>{
    const canvas=canvasRef.current; if(!canvas) return{x:0,y:0};
    const r=canvas.getBoundingClientRect();
    const scX=canvas.width/r.width; const scY=canvas.height/r.height;
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-r.left)*scX,y:(src.clientY-r.top)*scY};
  },[]);

  const doSnap=useCallback((gid,pieces,PS,SNAP,g)=>{
    let arr=[...pieces]; let changed=true; let ag=gid;
    while(changed){
      changed=false;
      const gp=arr.filter(p=>p.gid===ag);
      outer:for(const p of gp){
        for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nc=p.col+dc,nr=p.row+dr;
          if(nc<0||nc>=g||nr<0||nr>=g) continue;
          const nb=arr.find(x=>x.col===nc&&x.row===nr&&x.gid!==ag);
          if(!nb) continue;
          const dx=nb.x-p.x-dc*PS,dy=nb.y-p.y-dr*PS;
          if(Math.hypot(dx,dy)<SNAP){
            arr=arr.map(x=>x.gid===ag?{...x,x:x.x+dx,y:x.y+dy}:x);
            const tg=nb.gid; arr=arr.map(x=>x.gid===ag?{...x,gid:tg}:x);
            ag=tg; changed=true; playSnap(); break outer;
          }
        }
      }
    }
    return arr;
  },[]);

  const onDown=useCallback((e)=>{
    e.preventDefault();
    const st=stRef.current; if(!st||paused) return;
    if(!timer.on&&!doneRef.current) timer.start();
    const {x,y}=getXY(e);
    const sorted=[...st.pieces].sort((a,b)=>b.z-a.z);
    const hit=sorted.find(p=>x>=p.x&&x<=p.x+st.PS&&y>=p.y&&y<=p.y+st.PS);
    if(!hit) return;
    const nz=++st.maxZ;
    st.pieces=st.pieces.map(p=>p.gid===hit.gid?{...p,z:nz}:p);
    dragRef.current={gid:hit.gid,lx:x,ly:y};
    draw();
  },[paused,timer,getXY,draw]);

  const onMove=useCallback((e)=>{
    e.preventDefault();
    if(!dragRef.current) return;
    const {x,y}=getXY(e);
    const dx=x-dragRef.current.lx; const dy=y-dragRef.current.ly;
    dragRef.current.lx=x; dragRef.current.ly=y;
    const gid=dragRef.current.gid;
    stRef.current.pieces=stRef.current.pieces.map(p=>p.gid===gid?{...p,x:p.x+dx,y:p.y+dy}:p);
    draw();
  },[getXY,draw]);

  const solveIdRef=useRef(null); // DB UUID of the just-completed solve, used by ChainButton

  const onUp=useCallback(()=>{
    if(!dragRef.current) return;
    const gid=dragRef.current.gid; dragRef.current=null;
    const st=stRef.current;
    st.pieces=doSnap(gid,st.pieces,st.PS,st.SNAP,st.g);
    draw();
    const groups=[...new Set(st.pieces.map(p=>p.gid))];
    const prog=Math.round((1-(groups.length-1)/Math.max(st.n-1,1))*100);
    setProgress(prog);
    if(groups.length===1&&!doneRef.current){
      timer.stop(); setDone(true);
      solveIdRef.current=null;
      setCompletionBar({secs:timer.secs,pieces:n});
      const entry={
        puzzleId:puzzle.id, puzzleTitle:puzzle.title, pieces:n, secs:timer.secs,
        username:user?.username||user?.displayName||(user?.address?shortAddr(user.address):"Guest"),
        address:user?.address||null, ts:Date.now(),
      };
      // Only write to the shared DB when a wallet is connected — the DB requires a
      // real address to associate the record with the user's account across devices.
      // Guest solves (no wallet) simply don't persist to the shared DB.
      if(entry.address){
        DB.addSolve(entry)
          .then(row=>{ if(row?.id) solveIdRef.current=row.id; console.log("[DB] solve saved, id=",row?.id); })
          .catch(e=>console.error("[DB] addSolve failed:",e?.message||e));
      }
    }
  },[doSnap,draw,timer,puzzle,n,user]);

  const togglePause=()=>{if(done)return;const np=!paused;setPaused(np);np?timer.stop():timer.start();};

  const CTRL_H=52;

  // Fullscreen: puzzle+controls take over viewport, but we keep controls visible
  if(fullscreen){
    return(
      <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",background:"#23252F"}}>
        {/* Canvas fills all space above controls */}
        <div ref={wrapRef} style={{flex:1,position:"relative",overflow:"hidden"}}>
          <canvas ref={canvasRef} style={{display:"block",width:"100%",height:"100%",touchAction:"none",cursor:"grab"}}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
          {showRef&&(
            <div style={{position:"absolute",top:10,right:10,zIndex:20,border:`2px solid ${GOLD}`,borderRadius:10,overflow:"hidden",width:150,boxShadow:"0 4px 20px rgba(0,0,0,.6)"}}>
              <img src={puzzle.url} alt="ref" style={{width:"100%",display:"block"}}/>
              <div style={{background:"rgba(0,0,0,.7)",color:"#fff",fontSize:11,padding:"3px 8px",textAlign:"center"}}>Reference</div>
            </div>
          )}
          {paused&&(
            <div style={{position:"absolute",inset:0,zIndex:30,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)"}} onClick={togglePause}>
              <div style={{background:WHITE,borderRadius:18,padding:"28px 36px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:8}}>⏸️</div>
                <div style={{fontWeight:700,fontSize:18,color:DARK,marginBottom:4}}>Paused</div>
                <div style={{color:MID,fontSize:13}}>Tap to resume</div>
              </div>
            </div>
          )}
        </div>
        {/* Controls always visible at bottom */}
        <div style={{height:CTRL_H,background:BG,borderTop:BORDER,display:"flex",alignItems:"center",gap:8,padding:"0 12px",flexShrink:0}}>
          <button onClick={()=>{clearPuzzleURL();setFullscreen(false);onBack();}} style={ctrlBtn()}>← Back</button>
          <div style={{background:"#E5E0D8",borderRadius:20,height:5,width:70,overflow:"hidden",flexShrink:0}}>
            <div style={{height:"100%",background:progress===100?"#22C55E":GOLD,width:`${progress}%`,borderRadius:20,transition:"width .3s"}}/>
          </div>
          <span style={{fontSize:11,fontWeight:600,color:MID,flexShrink:0}}>{progress}%</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:11,color:DARK,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{puzzle.title}</div></div>
          <div style={{background:GOLD,borderRadius:8,height:BS,minWidth:72,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontWeight:800,fontSize:17,color:DARK,flexShrink:0}}>{fmt(timer.secs)}</div>
          <button onClick={togglePause} disabled={done} style={{...iconBtn(BS,paused?"#FFF3C0":WHITE),opacity:done?.45:1,cursor:done?"default":"pointer"}} title={done?"Solved":paused?"Resume":"Pause"}>{paused?"▶":"⏸"}</button>
          <button onClick={()=>setShowRef(v=>!v)} style={iconBtn(BS,showRef?"#FFF3C0":WHITE)}>🖼</button>
          <button onClick={()=>setFullscreen(false)} style={iconBtn(BS,WHITE)} title="Exit fullscreen">⊡</button>
        </div>
        {/* Completion popup — floats above the controls bar, not docked to canvas or any strip */}
        {completionBar&&(
          <div style={{position:"absolute",left:12,right:12,bottom:CTRL_H+10,zIndex:60,background:DARK,color:WHITE,display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,boxShadow:"0 6px 24px rgba(0,0,0,.45)"}}>
            <span style={{fontSize:18}}>🎉</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13}}>Puzzle Complete!</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:1}}>{fmt(completionBar.secs)} · {n} pieces</div>
            </div>
            <ChainButton puzzle={puzzle} pieces={n} secs={completionBar.secs} user={user} solveIdRef={solveIdRef}/>
            <button onClick={()=>setCompletionBar(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,width:26,height:26,cursor:"pointer",color:WHITE,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
        )}
      </div>
    );
  }

  // Normal mode: puzzle lives INSIDE the page, below header/nav
  // Canvas height = viewport - header(60) - secondnav(48 desktop/0 mobile) - controls(52) - bottomtabs(64 mobile/0 desktop)
  return(
    <div style={{display:"flex",flexDirection:"column",background:BG,position:"relative"}}>
      {/* Controls bar at TOP in normal mode — always visible, part of page flow */}
      <div style={{height:CTRL_H,background:BG,borderBottom:BORDER,display:"flex",alignItems:"center",gap:8,padding:"0 12px",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
        <button onClick={()=>{clearPuzzleURL();onBack();}} style={ctrlBtn()}>← Back</button>
        <div style={{background:"#E5E0D8",borderRadius:20,height:5,width:80,overflow:"hidden",flexShrink:0}}>
          <div style={{height:"100%",background:progress===100?"#22C55E":GOLD,width:`${progress}%`,borderRadius:20,transition:"width .3s"}}/>
        </div>
        <span style={{fontSize:11,fontWeight:600,color:MID,flexShrink:0}}>{progress}%</span>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12,color:DARK,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{puzzle.title}</div></div>
        <div style={{background:GOLD,borderRadius:8,height:BS,minWidth:74,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontWeight:800,fontSize:17,color:DARK,letterSpacing:1,flexShrink:0}}>{fmt(timer.secs)}</div>
        <button onClick={togglePause} disabled={done} style={{...iconBtn(BS,paused?"#FFF3C0":WHITE),opacity:done?.45:1,cursor:done?"default":"pointer"}} title={done?"Solved":paused?"Resume":"Pause"}>{paused?"▶":"⏸"}</button>
        <button onClick={()=>setShowRef(v=>!v)} style={iconBtn(BS,showRef?"#FFF3C0":WHITE)} title="Reference">🖼</button>
        <button onClick={()=>setFullscreen(true)} style={iconBtn(BS,WHITE)} title="Fullscreen">⊞</button>
      </div>

      {/* Canvas — height fills the remaining viewport space */}
      <div ref={wrapRef} style={{position:"relative",width:"100%",height:"calc(100vh - 60px - 52px - 64px)",background:"#23252F"}}
        className="puzzle-canvas-wrap">
        <canvas ref={canvasRef} style={{display:"block",width:"100%",height:"100%",touchAction:"none",cursor:"grab"}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
        {showRef&&(
          <div style={{position:"absolute",top:10,right:10,zIndex:20,border:`2px solid ${GOLD}`,borderRadius:10,overflow:"hidden",width:150,boxShadow:"0 4px 20px rgba(0,0,0,.6)"}}>
            <img src={puzzle.url} alt="ref" style={{width:"100%",display:"block"}}/>
            <div style={{background:"rgba(0,0,0,.7)",color:"#fff",fontSize:11,padding:"3px 8px",textAlign:"center"}}>Reference</div>
          </div>
        )}
        {paused&&(
          <div style={{position:"absolute",inset:0,zIndex:30,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)"}} onClick={togglePause}>
            <div style={{background:WHITE,borderRadius:18,padding:"28px 36px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:8}}>⏸️</div>
              <div style={{fontWeight:700,fontSize:18,color:DARK,marginBottom:4}}>Paused</div>
              <div style={{color:MID,fontSize:13}}>Tap to resume</div>
            </div>
          </div>
        )}
      </div>

      {/* Completion popup — floats just above the bottom tabs (mobile) / footer (desktop), not docked to canvas or any strip */}
      {completionBar&&(
        <div className="completion-toast" style={{position:"fixed",left:12,right:12,zIndex:350,background:DARK,color:WHITE,display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,boxShadow:"0 6px 24px rgba(0,0,0,.35)"}}>
          <span style={{fontSize:18}}>🎉</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13}}>Puzzle Complete!</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:1}}>{fmt(completionBar.secs)} · {n} pieces · {puzzle.title}</div>
          </div>
          <ChainButton puzzle={puzzle} pieces={n} secs={completionBar.secs} user={user} solveIdRef={solveIdRef}/>
          <button onClick={()=>setCompletionBar(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,width:26,height:26,cursor:"pointer",color:WHITE,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
        </div>
      )}
    </div>
  );
}

function ChainButton({puzzle,pieces,secs,user,solveIdRef}){
  const [state,setState]=useState("idle"); // idle | uploading | minting | done | error
  const [result,setResult]=useState(null);
  const [err,setErr]=useState("");
  const configured=isMintConfigured();

  const mint=async()=>{
    setErr(""); setState("uploading");
    try{
      let address=user?.address;
      if(!address){
        const u=await signInWithWallet();
        address=u.address;
      }
      setState("minting");
      const {txHash,tokenId,tokenURI}=await mintAchievement({puzzle,pieces,secs,address});
      const mintedAt=Date.now();
      const username=user?.username||user?.displayName||shortAddr(address);
      // Write the on-chain entry to the shared leaderboard DB.
      DB.addLeaderboardEntry({
        puzzleId:puzzle.id, puzzleTitle:puzzle.title, pieces, secs,
        username, address, txHash, tokenId, tokenURI, mintedAt, ts:Date.now(),
      }).then(()=>console.log("[DB] leaderboard entry saved")).catch(e=>console.error("[DB] addLeaderboardEntry failed:",e?.message||e));
      // Mark the solve_history row as on-chain (if we have its DB id).
      const solveId=solveIdRef?.current;
      if(solveId){
        DB.markSolveOnChain(solveId,{txHash,tokenId,tokenURI,mintedAt})
          .then(()=>console.log("[DB] solve marked on-chain, id=",solveId))
          .catch(e=>console.error("[DB] markSolveOnChain failed:",e?.message||e));
      }else{
        console.warn("[DB] no solveId ref — markSolveOnChain skipped (solve was guest or DB write failed earlier)");
      }
      addLog({type:"nft_minted",user:username,puzzle:puzzle.title,pieces,secs,txHash,tokenId});
      setResult({tokenId}); setState("done");
    }catch(e){
      setErr(e.message||"Mint failed."); setState("error");
    }
  };

  if(state==="done") return <span style={{fontSize:12,color:"#86EFAC",fontWeight:600,flexShrink:0}}>⛓ Minted{result?.tokenId!=null?` #${result.tokenId}`:""}!</span>;

  if(!configured) return <span style={{fontSize:11,color:MID,fontWeight:600,flexShrink:0,textAlign:"right"}}>NFT minting coming soon</span>;

  const busy=state==="uploading"||state==="minting";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
      <button onClick={mint} disabled={busy}
        style={{background:GOLD,color:DARK,border:"none",borderRadius:8,padding:"7px 12px",fontWeight:700,fontSize:12,cursor:"pointer",opacity:busy?.7:1}}>
        {state==="uploading"?"Uploading...":state==="minting"?"Minting...":"⛓ Mint NFT"}
      </button>
      {err&&<span style={{fontSize:10,color:"#EF4444",fontWeight:600,maxWidth:150,textAlign:"right"}}>{err}</span>}
    </div>
  );
}

function Avatar({user,size=32}){
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:"#E5E0D8",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.floor(size*.6),border:BORDER}}>
      {user?.pfp?<img src={user.pfp} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"😊"}
    </div>
  );
}

// ─────────────────────────────────────
// TOP NAV — mobile hides the account control (bottom tabs have Profile)
// ─────────────────────────────────────
function TopNav({page,setPage,user,setAuthOpen,onLogout}){
  const [profileOpen,setProfileOpen]=useState(false);
  const [search,setSearch]=useState("");
  const doSearch=()=>{window.dispatchEvent(new CustomEvent("pzsearch",{detail:search}));setPage("gallery");};
  const disconnect=()=>{setProfileOpen(false);onLogout();setPage("gallery");};

  return(
    <header style={{background:WHITE,borderBottom:BORDER,position:"sticky",top:0,zIndex:200,width:"100%"}}>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"0 16px",height:60,display:"flex",alignItems:"center",gap:10}}>
        {/* Logo */}
        <div onClick={()=>setPage("gallery")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          <span style={{fontSize:26}}>🧩</span>
          <div style={{lineHeight:1.1}}>
            <div style={{fontWeight:800,fontSize:15,color:DARK,letterSpacing:-.2}}>PUZZLE</div>
            <div style={{fontWeight:800,fontSize:15,color:GOLD,letterSpacing:-.2}}>CHAIN ✦</div>
          </div>
        </div>

        {/* Search — grows, visible on all sizes. Input is flex:1 */}
        <div style={{flex:1,display:"flex",minWidth:0}}>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&doSearch()}
            placeholder="Search puzzles..."
            style={{flex:1,minWidth:0,background:"#F8F5F0",border:BORDER,borderRadius:"10px 0 0 10px",padding:"9px 14px",fontSize:14,fontWeight:500,color:DARK,outline:"none"}}
          />
          <button onClick={doSearch} style={{background:GOLD,border:"none",borderRadius:"0 10px 10px 0",width:42,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:16}}>
            🔍
          </button>
        </div>

        {/* Account / Wallet — single control. Hidden on mobile (bottom tabs cover this). */}
        <div className="desktop-profile" style={{position:"relative",height:36,flexShrink:0}}>
          {user?(
            <>
              <button onClick={()=>setProfileOpen(v=>!v)}
                style={{height:"100%",background:"#F0FAF8",border:"1px solid #A7F3D0",borderRadius:9,padding:"0 10px 0 8px",display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontFamily:"inherit"}}>
                <Avatar user={user} size={24}/>
                <span style={{fontWeight:600,fontSize:13,color:DARK,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {user.displayName||(user.username?`@${user.username}`:shortAddr(user.address))}
                </span>
                <span style={{fontSize:10,color:MID}}>{profileOpen?"▲":"▼"}</span>
              </button>
              {profileOpen&&(
                <>
                  <div style={{position:"fixed",inset:0,zIndex:199}} onClick={()=>setProfileOpen(false)}/>
                  <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:WHITE,border:BORDER,borderRadius:14,padding:8,minWidth:230,zIndex:200,boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
                    <div style={{padding:"10px 12px",borderBottom:BORDER,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                      <Avatar user={user} size={34}/>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:14,color:DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName||user.username||"Unnamed wallet"}</div>
                        <div style={{color:MID,fontSize:12}}>{user.username?`@${user.username}`:"No username set"}{user.isAdmin?" · 👑":""}</div>
                      </div>
                    </div>
                    <div style={{padding:"8px 12px",borderBottom:BORDER,marginBottom:4}}>
                      <div style={{fontSize:11,fontWeight:600,color:MID,marginBottom:4}}>WALLET · MONAD MAINNET</div>
                      <span style={{fontFamily:"monospace",fontSize:11,color:DARK}}>{shortAddr(user.address)}</span>
                    </div>
                    {[
                      {icon:"👤",label:"My Profile",pg:"profile"},
                      {icon:"📜",label:"My History",pg:"history"},
                      {icon:"➕",label:"Create Puzzle",pg:"create"},
                      ...(user.isAdmin?[{icon:"👑",label:"Admin Panel",pg:"admin",red:true}]:[]),
                    ].map(({icon,label,pg,red})=>(
                      <button key={pg} onClick={()=>{setPage(pg);setProfileOpen(false);}} style={{...dropItem(),color:red?"#EF4444":DARK}}>
                        {icon} {label}
                      </button>
                    ))}
                    <div style={{borderTop:BORDER,marginTop:4,paddingTop:4}}>
                      <button onClick={disconnect} style={{...dropItem(),color:"#EF4444"}}>🔌 Disconnect Wallet</button>
                    </div>
                  </div>
                </>
              )}
            </>
          ):(
            <button onClick={()=>setAuthOpen(true)}
              style={{height:"100%",background:GOLD,color:DARK,border:"none",borderRadius:9,padding:"0 14px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
              🔗 Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────
// SECOND NAV — desktop only
// ─────────────────────────────────────
function SecondNav({page,setPage,sort,setSort}){
  const tabs=[
    {label:"Gallery",    pg:"gallery",      icon:"🧩"},
    {label:"Hall of Fame",pg:"leaderboard", icon:"🏆"},
    {label:"History",    pg:"history",      icon:"🕐"},
    {label:"Settings",   pg:"settings",     icon:"⚙️"},
  ];
  const [sortOpen,setSortOpen]=useState(false);
  const sortOpts=["Newest First","Oldest First","Most Solved","A–Z"];
  return(
    <div className="desktop-second-nav" style={{background:WHITE,borderBottom:BORDER,position:"sticky",top:60,zIndex:100}}>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",gap:4,height:48}}>
        {tabs.map(({label,pg,icon})=>{
          const active=page===pg||(pg==="gallery"&&page==="detail");
          return(
            <button key={pg} onClick={()=>setPage(pg)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"6px 13px",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13,background:active?LITE:"none",color:active?DARK:MID,transition:"all .12s"}}>
              {icon} {label}
            </button>
          );
        })}
        <div style={{flex:1}}/>
        <div style={{position:"relative"}}>
          <button onClick={()=>setSortOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:7,background:"#F8F5F0",border:BORDER,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13,color:DARK}}>
            ⇅ {sort} <span style={{fontSize:10,color:MID}}>▼</span>
          </button>
          {sortOpen&&(
            <>
              <div style={{position:"fixed",inset:0,zIndex:149}} onClick={()=>setSortOpen(false)}/>
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:WHITE,border:BORDER,borderRadius:12,padding:6,minWidth:160,zIndex:150,boxShadow:"0 6px 24px rgba(0,0,0,.1)"}}>
                {sortOpts.map(s=>(
                  <button key={s} onClick={()=>{setSort(s);setSortOpen(false);}} style={{...dropItem(),fontSize:13,fontWeight:sort===s?700:500,background:sort===s?LITE:"none",borderRadius:8}}>
                    {sort===s?"✓ ":""}{s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// BOTTOM TABS — fixed, always visible on mobile
// ─────────────────────────────────────
function BottomTabs({page,setPage,user,setAuthOpen}){
  const tabs=[
    {label:"Gallery",    pg:"gallery",     icon:"🧩"},
    {label:"Hall of Fame",pg:"leaderboard", icon:"🏆"},
    {label:"History",    pg:"history",     icon:"🕐"},
    {label:"Profile",    pg:"profile",     icon:"👤"},
  ];
  return(
    <nav className="mobile-bottom-tabs" style={{position:"fixed",bottom:0,left:0,right:0,background:WHITE,borderTop:BORDER,zIndex:300,display:"none"}}>
      <div style={{display:"flex",maxWidth:"100%"}}>
        {tabs.map(({label,pg,icon})=>{
          const active=page===pg||(pg==="gallery"&&page==="detail");
          return(
            <button key={pg} onClick={()=>{
              if(pg==="profile"&&!user){setAuthOpen(true);return;}
              setPage(pg);
            }}
              style={{flex:1,border:"none",background:"none",padding:"9px 4px 7px",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:19,filter:active?"none":"grayscale(1) opacity(.45)"}}>{icon}</span>
              <span style={{fontSize:10,fontWeight:active?700:500,color:active?GOLD:MID}}>{label}</span>
              {active&&<div style={{width:16,height:3,background:GOLD,borderRadius:2}}/>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────────────────────────────
// GALLERY — optimized community puzzle loading
// ─────────────────────────────────────

// In-memory thumbnail cache: puzzleId → 400px-wide jpeg data URL.
// Avoids regenerating the canvas thumbnail on every re-render.
const thumbCache = new Map();

// Generates a downscaled thumbnail from a full-res src using Canvas and caches it.
// Returns the thumbnail data URL via the callback once ready.
function generateThumbnail(src, id, onDone) {
  if (thumbCache.has(id)) { onDone(thumbCache.get(id)); return; }
  const img = new Image();
  img.onload = () => {
    const MAX = 400;
    const scale = Math.min(1, MAX / img.naturalWidth, MAX / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const thumb = canvas.toDataURL("image/jpeg", 0.80);
      thumbCache.set(id, thumb);
      onDone(thumb);
    } catch { onDone(src); } // cross-origin canvas taint fallback
  };
  img.onerror = () => onDone(src);
  img.crossOrigin = "anonymous";
  img.src = src;
}

// Renders the puzzle thumbnail for a community card.
// Shows a skeleton while generating the downscaled version; swaps in the
// thumbnail once ready. Built-in puzzles pass `isBuiltin=true` to skip
// the canvas step (they're already small CDN images).
function PuzzleCardImage({ src, id, isBuiltin }) {
  const [displaySrc, setDisplaySrc] = useState(null);

  useEffect(() => {
    if (!src) return;
    if (isBuiltin) { setDisplaySrc(src); return; }
    // Check memory cache first (instant if already generated this session).
    if (thumbCache.has(id)) { setDisplaySrc(thumbCache.get(id)); return; }
    generateThumbnail(src, id, setDisplaySrc);
  }, [src, id, isBuiltin]);

  if (!displaySrc) {
    // Skeleton: same size as the real image, prevents layout shift.
    return (
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg,#E5E0D8 25%,#EDE8E0 50%,#E5E0D8 75%)",
        backgroundSize: "200% 100%",
        animation: "pzSkeleton 1.4s ease infinite",
      }} />
    );
  }
  return (
    <img
      src={displaySrc}
      alt=""
      loading="lazy"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function GalleryPage({setPage,setSelPuzzle,sort}){
  const [search,setSearch]=useState("");
  const [pg,setPg]=useState(1);
  const [dbPuzzles,setDbPuzzles]=useState([]);
  const [solveCounts,setSolveCounts]=useState({});
  const [dbLoading,setDbLoading]=useState(true);
  const PER=12;

  useEffect(()=>{
    const h=e=>{setSearch(e.detail||"");setPg(1);};
    window.addEventListener("pzsearch",h);
    return()=>window.removeEventListener("pzsearch",h);
  },[]);

  // Fetch community puzzles and solve counts in parallel.
  // Built-in PUZZLES are available instantly (no fetch needed) so the
  // gallery renders immediately; community cards arrive and fill in.
  useEffect(()=>{
    Promise.all([
      DB.getCommunityPuzzles(),
      DB.getPuzzleSolveCounts(),
    ]).then(([rows,counts])=>{
      const mapped=rows.map(r=>({
        id:r.id, url:r.url, title:r.title, desc:r.description||"",
        tags:r.tags||[], author:r.author, authorName:r.author_name, createdAt:r.created_at,
        isCommunity:true,
      }));
      setDbPuzzles(mapped);
      setSolveCounts(counts||{});
      setDbLoading(false);
      // Preload the first 4 community images immediately after the DB responds
      // so by the time the user scrolls to them the thumbnails are already generating.
      mapped.slice(0,4).forEach(p=>{ if(p.url&&!thumbCache.has(p.id)) generateThumbnail(p.url,p.id,()=>{}); });
    }).catch(()=>setDbLoading(false));
  },[]);

  const banned=S.get("bannedUsers",[]);
  let all=[...PUZZLES,...dbPuzzles].filter(p=>!banned.includes(p.author));
  const solvedCount=id=>solveCounts[id]||0;
  if(sort==="Newest First") all=[...all].sort((a,b)=>(b.createdAt||b.id)-(a.createdAt||a.id));
  else if(sort==="Oldest First") all=[...all].sort((a,b)=>(a.createdAt||a.id)-(b.createdAt||b.id));
  else if(sort==="Most Solved") all=[...all].sort((a,b)=>solvedCount(b.id)-solvedCount(a.id));
  else if(sort==="A–Z") all=[...all].sort((a,b)=>a.title.localeCompare(b.title));

  const q=search.toLowerCase().trim();
  const filtered=q?all.filter(p=>p.title.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.includes(q))):all;
  const totalPgs=Math.ceil(filtered.length/PER);
  const shown=filtered.slice((pg-1)*PER,pg*PER);

  const [liked,setLiked]=useState(()=>S.get("liked",[])||[]);
  const toggleLike=(e,id)=>{e.stopPropagation();const l=liked.includes(id)?liked.filter(x=>x!==id):[...liked,id];setLiked(l);S.set("liked",l);};
  const sharePuzzle=(e,p)=>{
    e.stopPropagation();
    const u=new URL(window.location.href);u.searchParams.set("puzzle",p.id);u.searchParams.set("pieces",36);
    const url=u.toString();
    if(navigator.share){navigator.share({title:`Solve "${p.title}" on PuzzleChain`,url}).catch(()=>{});}
    else{navigator.clipboard.writeText(url).then(()=>alert("Link copied!"));}
  };

  // Mobile sort
  const [mobSortOpen,setMobSortOpen]=useState(false);
  const sortOpts=["Newest First","Oldest First","Most Solved","A–Z"];

  // How many skeleton cards to show: max 4, but only while DB is still loading
  // and only on the first page so we don't show skeletons on subsequent pages.
  const skeletonCount = dbLoading && pg === 1 ? Math.min(4, PER - shown.length) : 0;

  return(
    <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 16px 24px"}}>
      {/* Skeleton keyframe — injected once inline */}
      <style>{`@keyframes pzSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Mobile-only filter bar */}
      <div className="mobile-only" style={{display:"none",alignItems:"center",gap:8,marginBottom:16}}>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setMobSortOpen(v=>!v)} style={{background:"#F8F5F0",border:BORDER,borderRadius:9,padding:"8px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13,color:DARK,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>⇅ {sort}</span><span style={{fontSize:10,color:MID}}>▼</span>
          </button>
          {mobSortOpen&&(
            <>
              <div style={{position:"fixed",inset:0,zIndex:149}} onClick={()=>setMobSortOpen(false)}/>
              <div style={{position:"absolute",left:0,top:"calc(100% + 6px)",background:WHITE,border:BORDER,borderRadius:12,padding:6,minWidth:160,zIndex:150,boxShadow:"0 6px 24px rgba(0,0,0,.1)"}}>
                {sortOpts.map(s=>(
                  <button key={s} onClick={()=>{window.dispatchEvent(new CustomEvent("setsort",{detail:s}));setMobSortOpen(false);}} style={{...dropItem(),fontSize:13}}>{s}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:24}}>
        {shown.map(p=>(
          <div key={p.id} onClick={()=>{setSelPuzzle(p);setPage("detail");}}
            style={{background:WHITE,borderRadius:14,overflow:"hidden",cursor:"pointer",border:BORDER,transition:"transform .15s,box-shadow .15s",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.12)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)";}}>
            <div style={{position:"relative",paddingTop:"70%",overflow:"hidden"}}>
              <PuzzleCardImage src={p.url} id={p.id} isBuiltin={!p.isCommunity}/>
              <button onClick={e=>toggleLike(e,p.id)} style={{position:"absolute",top:8,right:8,width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.88)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                {liked.includes(p.id)?"❤️":"🤍"}
              </button>
              <button onClick={e=>sharePuzzle(e,p)} style={{position:"absolute",top:8,left:8,width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.88)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                ↗
              </button>
            </div>
            <div style={{padding:"10px 12px"}}>
              <div style={{fontWeight:700,fontSize:13,color:DARK}}>{p.title}</div>
              <div style={{fontSize:11,color:MID,marginTop:2}}>{solvedCount(p.id)} solves</div>
            </div>
          </div>
        ))}

        {/* Skeleton cards — stable placeholders that hold grid space while
            community puzzles are still loading. Same dimensions as real cards. */}
        {Array.from({length:skeletonCount},(_,i)=>(
          <div key={`skel-${i}`} style={{background:WHITE,borderRadius:14,overflow:"hidden",border:BORDER,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{position:"relative",paddingTop:"70%",overflow:"hidden"}}>
              <div style={{
                position:"absolute",inset:0,
                background:"linear-gradient(90deg,#E5E0D8 25%,#EDE8E0 50%,#E5E0D8 75%)",
                backgroundSize:"200% 100%",
                animation:"pzSkeleton 1.4s ease infinite",
              }}/>
            </div>
            <div style={{padding:"10px 12px"}}>
              <div style={{height:13,borderRadius:6,background:"#E5E0D8",width:"70%",marginBottom:6}}/>
              <div style={{height:10,borderRadius:6,background:"#EDE8E0",width:"40%"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination — always visible */}
      {totalPgs>=1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,flexWrap:"wrap",paddingBottom:8}}>
          <PgBtn disabled={pg<=1} onClick={()=>setPg(p=>p-1)}>‹</PgBtn>
          {Array.from({length:Math.min(totalPgs,7)},(_,i)=>{
            const p2=i+1;
            return <PgBtn key={p2} active={p2===pg} onClick={()=>setPg(p2)}>{p2}</PgBtn>;
          })}
          {totalPgs>7&&<><span style={{color:MID,padding:"0 2px"}}>…</span><PgBtn active={totalPgs===pg} onClick={()=>setPg(totalPgs)}>{totalPgs}</PgBtn></>}
          <PgBtn disabled={pg>=totalPgs} onClick={()=>setPg(p=>p+1)}>›</PgBtn>
        </div>
      )}
    </div>
  );
}

function PgBtn({children,onClick,active,disabled}){
  return(
    <button onClick={onClick} disabled={disabled}
      style={{width:34,height:34,borderRadius:8,border:BORDER,background:active?GOLD:WHITE,color:active?DARK:disabled?"#ccc":DARK,fontWeight:active?700:500,fontSize:14,cursor:disabled?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────
// PER-PUZZLE LEADERBOARD
// Reads from the shared DB. Only on-chain entries are in the leaderboard table.
// Rankings (best per wallet, tie-break by earlier mint) are computed client-side.
// ─────────────────────────────────────
function rankRows(rows){
  const tieBreak=(a,b)=>a.secs-b.secs||(a.minted_at||a.ts||0)-(b.minted_at||b.ts||0);
  const best=new Map();
  for(const e of rows){
    const key=(e.address||`guest:${e.username||"Guest"}`).toLowerCase();
    const cur=best.get(key);
    if(!cur||tieBreak(e,cur)<0) best.set(key,e);
  }
  return [...best.values()].sort(tieBreak);
}
// Normalise a DB leaderboard row to the shape the rest of the UI already expects.
function normRow(r){
  return{
    puzzleId:r.puzzle_id, puzzleTitle:r.puzzle_title, pieces:r.pieces, secs:r.secs,
    username:r.username, address:r.address, onChain:true,
    txHash:r.tx_hash, tokenId:r.token_id, tokenURI:r.token_uri,
    mintedAt:r.minted_at, ts:r.ts,
  };
}

function LbRow({rank,entry,usersByWallet,mine}){
  const {name,pfp}=identityFor(entry,usersByWallet);
  const medalBg=rank===1?GOLD:rank===2?"#9CA3AF":rank===3?"#C2703D":null;
  return(
    <div style={{display:"flex",alignItems:"center",gap:11,padding:"9px 8px",borderRadius:10,background:mine?"#EDE9FE":"none"}}>
      <div style={{width:24,flexShrink:0,display:"flex",justifyContent:"center"}}>
        {medalBg?(
          <div style={{width:23,height:23,borderRadius:"50%",background:medalBg,color:WHITE,fontWeight:800,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{rank}</div>
        ):(
          <span style={{fontWeight:700,fontSize:13,color:mine?"#6D28D9":MID}}>{rank}</span>
        )}
      </div>
      <Avatar user={{pfp}} size={32}/>
      <div style={{flex:1,minWidth:0,fontWeight:700,fontSize:13,color:mine?"#6D28D9":DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mine?"You":name}</div>
      <div style={{fontWeight:800,fontSize:13,fontFamily:"monospace",color:mine?"#6D28D9":DARK,flexShrink:0}}>{fmt(entry.secs)}</div>
    </div>
  );
}

function PuzzleLeaderboardModal({puzzle,initialPieces,user,onClose}){
  const [pieces,setPieces]=useState(initialPieces);
  const [pcOpen,setPcOpen]=useState(false);
  const [ranked,setRanked]=useState([]);
  const usersByWallet=S.get("usersByWallet",{});

  useEffect(()=>{
    setRanked([]);
    DB.getPuzzleLeaderboard(puzzle.id,pieces)
      .then(rows=>setRanked(rankRows(rows.map(normRow))))
      .catch(()=>{});
  },[puzzle.id,pieces]);

  const myKey=user?.address?user.address.toLowerCase():null;
  const myIdx=myKey?ranked.findIndex(e=>(e.address||"").toLowerCase()===myKey):-1;
  const top100=ranked.slice(0,100);
  const showExtra=myIdx>=100;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:WHITE,borderRadius:18,width:"100%",maxWidth:460,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.3)",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"16px 16px",borderBottom:BORDER,flexShrink:0}}>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:DARK,padding:4,flexShrink:0}}>←</button>
          <h3 style={{flex:1,fontWeight:800,fontSize:17,color:DARK,margin:0,textAlign:"center"}}>Leaderboard</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:MID,padding:4,flexShrink:0}}>✕</button>
        </div>
        <div style={{padding:"13px 16px",borderBottom:BORDER,flexShrink:0}}>
          <button onClick={()=>setPcOpen(v=>!v)} style={{width:"100%",background:BG,border:BORDER,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,color:DARK}}>
            <span>{pieces} Pieces</span><span style={{fontSize:11,color:MID}}>{pcOpen?"▲":"▼"}</span>
          </button>
        </div>
        {/* This list area is reused for both the piece-count options and the leaderboard rows,
            so opening the picker can never get clipped — it's the same panel that already
            scrolls fine for up to 100 leaderboard rows. */}
        <div style={{overflowY:"auto",flex:1,padding:pcOpen?0:"6px 8px"}}>
          {pcOpen?(
            PIECES.map((o,i)=>(
              <button key={o.n} onClick={()=>{setPieces(o.n);setPcOpen(false);}}
                style={{width:"100%",textAlign:"left",display:"block",background:o.n===pieces?"#FDF1D6":"none",border:"none",borderBottom:i<PIECES.length-1?BORDER:"none",padding:"15px 18px",cursor:"pointer",fontFamily:"inherit",fontWeight:o.n===pieces?700:500,fontSize:14,color:DARK}}>
                {o.n} Pieces
              </button>
            ))
          ):(
            <>
              {top100.length===0&&(
                <div style={{textAlign:"center",padding:40,color:MID,fontWeight:600,fontSize:13}}>No on-chain solves yet for {pieces} pieces — be the first! 🏆</div>
              )}
              {top100.map((e,i)=>{
                const mine=myKey&&(e.address?e.address.toLowerCase():null)===myKey;
                return <LbRow key={i} rank={i+1} entry={e} usersByWallet={usersByWallet} mine={mine}/>;
              })}
              {showExtra&&(
                <>
                  <div style={{textAlign:"center",color:MID,fontSize:13,padding:"4px 0"}}>⋮</div>
                  <LbRow rank={myIdx+1} entry={ranked[myIdx]} usersByWallet={usersByWallet} mine/>
                </>
              )}
            </>
          )}
        </div>
        <div style={{padding:"9px 16px",borderTop:BORDER,textAlign:"center",flexShrink:0}}>
          <span style={{color:MID,fontSize:11}}>🕐 Times are recorded in mm:ss</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// DETAIL PAGE
// ─────────────────────────────────────
function DetailPage({puzzle,setPage,onPlay,user}){
  const [pick,setPick]=useState(null);
  const [aboutOpen,setAboutOpen]=useState(false);
  const [lbOpen,setLbOpen]=useState(false);
  const [liked,setLiked]=useState((S.get("liked",[])||[]).includes(puzzle.id));
  const [ranked,setRanked]=useState([]);
  const lbN=pick?.n||PIECES[0].n;
  const usersByWallet=S.get("usersByWallet",{});

  useEffect(()=>{
    setRanked([]);
    DB.getPuzzleLeaderboard(puzzle.id,lbN)
      .then(rows=>setRanked(rankRows(rows.map(normRow))))
      .catch(()=>{});
  },[puzzle.id,lbN]);

  const top3=ranked.slice(0,3);
  const myKey=user?.address?user.address.toLowerCase():null;
  const myIdx=myKey?ranked.findIndex(e=>(e.address||"").toLowerCase()===myKey):-1;
  const showMyRow=myIdx>=3;

  const share=()=>{
    const u=new URL(window.location.href);u.searchParams.set("puzzle",puzzle.id);u.searchParams.set("pieces",pick?.n||36);
    const link=u.toString();
    if(navigator.share){navigator.share({title:`Solve "${puzzle.title}" on PuzzleChain`,url:link}).catch(()=>{});}
    else{navigator.clipboard.writeText(link).then(()=>alert("Puzzle link copied!"));}
  };

  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"0 0 40px"}}>
      <div style={{position:"relative",height:250,overflow:"hidden"}}>
        <img src={puzzle.url} alt={puzzle.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.2) 0%,transparent 50%)"}}/>
        <button onClick={()=>setPage("gallery")} style={{position:"absolute",top:12,left:12,width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.85)",border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <button onClick={()=>{const l=S.get("liked",[]);const nl=liked?l.filter(x=>x!==puzzle.id):[...l,puzzle.id];S.set("liked",nl);setLiked(!liked);}} style={{position:"absolute",top:12,right:12,width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.85)",border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {liked?"❤️":"🤍"}
        </button>
      </div>
      <div style={{padding:"18px 18px 0"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:6}}>
          <h1 style={{fontWeight:800,fontSize:24,color:DARK,margin:0,flex:1}}>{puzzle.title}</h1>
          <button onClick={share} style={{background:BG,border:BORDER,borderRadius:8,padding:"7px 12px",fontWeight:600,fontSize:12,cursor:"pointer",color:DARK,display:"flex",alignItems:"center",gap:4,flexShrink:0}}>↗ Share</button>
        </div>
        <p style={{color:MID,fontSize:13,lineHeight:1.6,margin:"0 0 16px"}}>{puzzle.desc||"A beautiful jigsaw puzzle."}</p>
        {/* Piece count */}
        <h3 style={{fontWeight:700,fontSize:13,color:DARK,margin:"0 0 10px",letterSpacing:.3}}>CHOOSE PIECE COUNT</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:18}}>
          {PIECES.map(o=>{
            const active=pick?.n===o.n;
            return(
              <button key={o.n} onClick={()=>setPick(o)}
                style={{background:active?GOLD:WHITE,border:active?`2px solid ${GOLD}`:BORDER,borderRadius:11,padding:"13px 8px",cursor:"pointer",fontFamily:"inherit",position:"relative",transition:"all .12s"}}>
                {active&&<div style={{position:"absolute",top:-7,right:-7,width:18,height:18,borderRadius:"50%",background:GOLD,border:"2px solid white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>✓</div>}
                <div style={{fontWeight:800,fontSize:20,color:DARK}}>{o.label}</div>
                <div style={{fontWeight:500,fontSize:11,color:MID,marginTop:2}}>Pieces</div>
              </button>
            );
          })}
        </div>
        <button onClick={()=>pick&&onPlay(pick)} disabled={!pick}
          style={{width:"100%",background:GOLD,color:DARK,border:"none",borderRadius:13,padding:"16px",fontWeight:800,fontSize:17,cursor:pick?"pointer":"default",marginBottom:18,opacity:pick?1:.55,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          ▶ PLAY PUZZLE
        </button>

        {/* Top Solvers */}
        <div style={{background:WHITE,border:BORDER,borderRadius:13,padding:"14px 14px 6px",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:800,fontSize:13,color:DARK,letterSpacing:.3,whiteSpace:"nowrap"}}>
              🏆 TOP SOLVERS ({lbN} PIECES)
            </div>
            <button onClick={()=>setLbOpen(true)} style={{background:"none",border:"none",color:"#6D28D9",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",padding:0}}>
              View Full (Top 100) →
            </button>
          </div>
          {top3.length===0?(
            <div style={{textAlign:"center",padding:"18px 6px",color:MID,fontWeight:600,fontSize:13}}>No on-chain solves yet — be the first! 🏆</div>
          ):(
            <>
              {top3.map((e,i)=>{
                const mine=myKey&&(e.address?e.address.toLowerCase():null)===myKey;
                return <LbRow key={i} rank={i+1} entry={e} usersByWallet={usersByWallet} mine={mine}/>;
              })}
              {showMyRow&&(
                <LbRow rank={myIdx+1} entry={ranked[myIdx]} usersByWallet={usersByWallet} mine/>
              )}
            </>
          )}
        </div>

        <button onClick={()=>setAboutOpen(v=>!v)}
          style={{width:"100%",background:WHITE,color:DARK,border:BORDER,borderRadius:13,padding:"13px 16px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>ABOUT THIS PUZZLE</span><span>{aboutOpen?"▲":"▼"}</span>
        </button>
        {aboutOpen&&(
          <div style={{background:WHITE,border:BORDER,borderTop:"none",borderRadius:"0 0 13px 13px",padding:"12px 16px"}}>
            <p style={{color:MID,fontSize:13,lineHeight:1.6,margin:0}}>{puzzle.desc||"A beautiful jigsaw puzzle."}</p>
          </div>
        )}
      </div>
      {lbOpen&&<PuzzleLeaderboardModal puzzle={puzzle} initialPieces={lbN} user={user} onClose={()=>setLbOpen(false)}/>}
    </div>
  );
}

// ─────────────────────────────────────
// HALL OF FAME
// All numbers below are computed live from real localStorage data
// (leaderboard entries + wallet profiles) — nothing here is mocked.
// ─────────────────────────────────────
function identityFor(entry,usersByWallet){
  const rec=entry.address?usersByWallet[entry.address.toLowerCase()]:null;
  const name=rec?.displayName||rec?.username||entry.username||"Guest";
  return {name,pfp:rec?.pfp||""};
}
function tierFor(solved){
  if(solved>=150) return "Legend";
  if(solved>=75) return "Expert";
  if(solved>=25) return "Pro";
  return "Rookie";
}
function fmtDelta(secs){
  if(secs==null) return null;
  const sign=secs>0?"+":secs<0?"-":"±";
  return `${sign}${fmt(Math.abs(secs))}`;
}

function HallOfFamePage({setPage}){
  // Temporarily disabled while this page is being redesigned — the original
  // implementation (stats, champions, recent activity, top puzzles) is left
  // in place above (identityFor/tierFor/fmtDelta) since other features still
  // use those helpers; only this page's own render is swapped out for now.
  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"80px 24px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>🚧</div>
      <h2 style={{fontWeight:800,fontSize:22,color:DARK,margin:"0 0 8px"}}>Hall of Fame</h2>
      <p style={{color:MID,fontSize:14,lineHeight:1.6,margin:"0 0 22px"}}>This page is currently under maintenance. Check back soon!</p>
      <button onClick={()=>setPage("gallery")} style={{background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>Explore Puzzles</button>
    </div>
  );
}

// ─────────────────────────────────────
// HISTORY
// ─────────────────────────────────────
function HistoryPage({user,setAuthOpen}){
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!user?.address) return;
    setLoading(true);
    DB.getUserHistory(user.address)
      .then(rows=>{
        setRecords(rows.map(r=>({
          puzzleId:r.puzzle_id, puzzleTitle:r.puzzle_title, pieces:r.pieces, secs:r.secs,
          onChain:r.on_chain, txHash:r.tx_hash, tokenId:r.token_id, ts:r.ts,
        })));
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[user?.address]);

  const totalGames=records.length;
  const minted=records.filter(r=>r.onChain).length;
  const uniquePuzzles=new Set(records.map(r=>r.puzzleId)).size;

  return(
    <div style={{maxWidth:700,margin:"0 auto",padding:"28px 16px 40px"}}>
      <h2 style={{fontWeight:800,fontSize:24,color:DARK,margin:"0 0 6px"}}>History</h2>
      <p style={{color:MID,fontSize:13,margin:"0 0 22px"}}>All your past puzzle completions</p>
      {!user&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:44,marginBottom:10}}>📜</div>
          <p style={{color:MID,fontWeight:600,marginBottom:14}}>Connect your wallet to see your history</p>
          <button onClick={()=>setAuthOpen(true)} style={{background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"11px 26px",fontWeight:700,fontSize:14,cursor:"pointer"}}>🔗 Connect Wallet</button>
        </div>
      )}
      {user&&loading&&<div style={{textAlign:"center",padding:60,color:MID}}>Loading…</div>}
      {user&&!loading&&records.length>0&&(
        <div style={{background:WHITE,border:BORDER,borderRadius:13,padding:"14px 20px",marginBottom:20,display:"flex"}}>
          {[["Total Games",""+totalGames],["Minted",""+minted],["Unique Puzzles",""+uniquePuzzles]].map(([l,v],i)=>(
            <div key={l} style={{flex:1,textAlign:"center",borderRight:i<2?BORDER:"none"}}>
              <div style={{fontWeight:800,fontSize:20,color:DARK}}>{v}</div>
              <div style={{color:MID,fontSize:11,fontWeight:600,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      )}
      {user&&!loading&&records.length===0&&<div style={{textAlign:"center",padding:60,color:MID,fontWeight:600}}>No puzzles solved yet 🧩</div>}
      {records.map((r,i)=>{
        const img=[...PUZZLES,...(S.get("userPuzzles",[])||[])].find(p=>p.id===r.puzzleId);
        return(
          <div key={i}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0"}}>
              <div style={{width:68,height:50,position:"relative",flexShrink:0}}>
                <div style={{position:"absolute",top:4,left:4,width:58,height:42,borderRadius:7,overflow:"hidden",background:"#eee",border:BORDER}}>
                  {img&&<img src={img.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",opacity:.6}}/>}
                </div>
                <div style={{position:"absolute",top:0,left:0,width:58,height:42,borderRadius:7,overflow:"hidden",background:WHITE,border:BORDER}}>
                  {img&&<img src={img.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                </div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.puzzleTitle}</div>
                <div style={{color:MID,fontSize:11,marginTop:2}}>{new Date(r.ts).toLocaleDateString("en-GB")} · {r.pieces} pcs{r.onChain?" · ⛓":""}</div>
              </div>
              <div style={{fontWeight:800,fontSize:20,fontFamily:"monospace",color:DARK,flexShrink:0}}>{fmt(r.secs)}</div>
            </div>
            {i<records.length-1&&<div style={{borderBottom:BORDER}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────
// PROFILE
// ─────────────────────────────────────
function ProfilePage({user,onUpdate,setAuthOpen,onLogout}){
  const [displayName,setDisplayName]=useState(user?.displayName||"");
  const [username,setUsername]=useState(user?.username||"");
  const [bio,setBio]=useState(user?.bio||"");
  const [pfpSrc,setPfpSrc]=useState(user?.pfp||"");
  const [saved,setSaved]=useState(false);
  const [err,setErr]=useState("");
  const [unameStatus,setUnameStatus]=useState(null); // null|"checking"|"ok"|"taken"|"invalid"|"same"
  const fileRef=useRef();

  // Live username availability check (debounced) — letters, numbers, underscores only,
  // compared case-insensitively against every other wallet's username.
  useEffect(()=>{
    const u=username.trim();
    if(!u){setUnameStatus(null);return;}
    if(!USERNAME_RE.test(u)){setUnameStatus("invalid");return;}
    if(u.length<3){setUnameStatus("short");return;}
    if(user?.username&&u.toLowerCase()===user.username.toLowerCase()){setUnameStatus("same");return;}
    setUnameStatus("checking");
    const t=setTimeout(()=>{
      setUnameStatus(isUsernameTaken(u,user?.addressLower||user?.address?.toLowerCase())?"taken":"ok");
    },250);
    return()=>clearTimeout(t);
  },[username,user]);

  if(!user) return(
    <div style={{textAlign:"center",padding:"80px 24px"}}>
      <div style={{fontSize:44,marginBottom:10}}>👤</div>
      <p style={{color:MID,fontWeight:600,marginBottom:14}}>Connect your wallet to view your profile</p>
      <button onClick={()=>setAuthOpen(true)} style={{background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"11px 26px",fontWeight:700,fontSize:14,cursor:"pointer"}}>🔗 Connect Wallet</button>
    </div>
  );

  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;const d=await readFile(f);setPfpSrc(d);};
  const save=()=>{
    setErr("");
    const uname=username.trim();
    if(uname){
      if(!USERNAME_RE.test(uname)){setErr("Username can only contain letters, numbers, and underscores.");return;}
      if(uname.length<3){setErr("Username must be at least 3 characters.");return;}
      if(unameStatus==="taken"){setErr("That username is already taken.");return;}
    }
    const addrLower=user.addressLower||user.address.toLowerCase();
    const usersByWallet=S.get("usersByWallet",{});
    const rec=usersByWallet[addrLower]||{address:user.address,addressLower:addrLower,createdAt:user.createdAt||Date.now()};
    const updated={...rec,username:uname,displayName:displayName.trim(),bio:bio.trim().slice(0,280),pfp:pfpSrc};
    usersByWallet[addrLower]=updated;
    S.set("usersByWallet",usersByWallet);
    onUpdate({...user,...updated});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const unameHint={
    invalid:["#EF4444","Only letters, numbers, and underscores are allowed."],
    short:["#EF4444","Username must be at least 3 characters."],
    taken:["#EF4444","✗ Already taken."],
    checking:[MID,"Checking availability…"],
    ok:["#22C55E","✓ Available."],
    same:[MID,"This is your current username."],
  }[unameStatus]||null;

  return(
    <div style={{maxWidth:500,margin:"0 auto",padding:"28px 16px 40px"}}>
      <h2 style={{fontWeight:800,fontSize:24,color:DARK,margin:"0 0 22px"}}>My Profile</h2>
      <div style={{background:WHITE,border:BORDER,borderRadius:15,padding:22,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:76,height:76,borderRadius:"50%",background:"#E5E0D8",border:BORDER,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>
              {pfpSrc?<img src={pfpSrc} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"😊"}
            </div>
            <button onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:-2,right:-2,width:24,height:24,borderRadius:"50%",background:GOLD,border:"2px solid white",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:17,color:DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName||(user.username?`@${user.username}`:"Unnamed wallet")}</div>
            {user.isAdmin&&<div style={{color:"#EF4444",fontSize:12,fontWeight:600,marginTop:2}}>👑 Admin</div>}
            <div style={{color:MID,fontSize:12,marginTop:2}}>Click ✏️ to change photo</div>
          </div>
        </div>

        {/* Read-only identity */}
        <div style={{background:BG,border:BORDER,borderRadius:11,padding:"11px 13px",marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:user.createdAt?6:0}}>
            <span style={{fontSize:11,fontWeight:600,color:MID,letterSpacing:.3}}>WALLET ADDRESS</span>
            <span style={{fontFamily:"monospace",fontSize:12,color:DARK,overflow:"hidden",textOverflow:"ellipsis"}}>{shortAddr(user.address)}</span>
          </div>
          {user.createdAt&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:MID,letterSpacing:.3}}>JOINED</span>
              <span style={{fontSize:12,color:DARK}}>{new Date(user.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
            </div>
          )}
        </div>

        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontWeight:600,fontSize:11,color:MID,marginBottom:5,letterSpacing:.3}}>DISPLAY NAME</label>
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Shown next to your puzzles — doesn't need to be unique"
            style={{width:"100%",background:BG,border:BORDER,borderRadius:9,padding:"10px 13px",fontSize:14,color:DARK,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontWeight:600,fontSize:11,color:MID,marginBottom:5,letterSpacing:.3}}>USERNAME</label>
          <input value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,""))} placeholder="letters, numbers, underscores"
            style={{width:"100%",background:BG,border:BORDER,borderRadius:9,padding:"10px 13px",fontSize:14,color:DARK,outline:"none",boxSizing:"border-box"}}/>
          {unameHint&&<div style={{fontSize:11,fontWeight:600,color:unameHint[0],marginTop:5}}>{unameHint[1]}</div>}
        </div>

        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontWeight:600,fontSize:11,color:MID,marginBottom:5,letterSpacing:.3}}>BIO (OPTIONAL)</label>
          <textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,280))} placeholder="A short bio about yourself" rows={3}
            style={{width:"100%",background:BG,border:BORDER,borderRadius:9,padding:"10px 13px",fontSize:13,color:DARK,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}/>
          <div style={{textAlign:"right",fontSize:10,color:MID,marginTop:3}}>{bio.length}/280</div>
        </div>

        {err&&<p style={{color:"#EF4444",fontWeight:600,fontSize:12,margin:"0 0 12px"}}>⚠️ {err}</p>}
        <button onClick={save} disabled={unameStatus==="taken"||unameStatus==="invalid"||unameStatus==="short"}
          style={{width:"100%",background:saved?"#22C55E":GOLD,color:DARK,border:"none",borderRadius:11,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",transition:"background .2s",opacity:(unameStatus==="taken"||unameStatus==="invalid"||unameStatus==="short")?.6:1,marginBottom:10}}>
          {saved?"✓ Saved!":"Save Changes"}
        </button>
        {onLogout&&(
          <button onClick={onLogout} style={{width:"100%",background:"none",color:"#EF4444",border:"1px solid #FECACA",borderRadius:11,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            🔌 Disconnect Wallet
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// CREATE PUZZLE
// ─────────────────────────────────────
function CreatePage({user,setAuthOpen}){
  const [imgSrc,setImgSrc]=useState(""); const [imgUrl,setImgUrl]=useState("");
  const [title,setTitle]=useState(""); const [tags,setTags]=useState(""); const [desc,setDesc]=useState("");
  const [err,setErr]=useState(""); const [done,setDone]=useState(false);
  const fileRef=useRef();
  if(!user) return(
    <div style={{textAlign:"center",padding:"80px 24px"}}>
      <div style={{fontSize:44,marginBottom:10}}>➕</div>
      <p style={{color:MID,fontWeight:600,marginBottom:14}}>Connect your wallet to create puzzles</p>
      <button onClick={()=>setAuthOpen(true)} style={{background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"11px 26px",fontWeight:700,fontSize:14,cursor:"pointer"}}>🔗 Connect Wallet</button>
    </div>
  );
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;const d=await readFile(f);setImgSrc(d);setImgUrl("");};
  const finalImg=imgSrc||imgUrl;
  const [saving,setSaving]=useState(false);
  const authorName=user.username||user.displayName||shortAddr(user.address);
  const create=async()=>{
    setErr(""); if(!finalImg||!title.trim()){setErr("Image and title required");return;}
    setSaving(true);
    const puzzle={
      id:Date.now(), url:finalImg, title:title.trim(), desc:desc.trim(),
      tags:tags.split(",").map(t=>t.trim()).filter(Boolean),
      author:user.address, authorName, createdAt:Date.now(),
    };
    try{
      await DB.addCommunityPuzzle(puzzle);
      addLog({type:"puzzle_created",user:authorName,puzzle:title});
      setDone(true);setImgSrc("");setImgUrl("");setTitle("");setTags("");setDesc("");
    }catch(e){setErr("Failed to publish puzzle. Please try again.");}
    setSaving(false);
  };
  return(
    <div style={{maxWidth:500,margin:"0 auto",padding:"28px 16px 40px"}}>
      <h2 style={{fontWeight:800,fontSize:24,color:DARK,margin:"0 0 22px"}}>Create Puzzle</h2>
      <div style={{background:WHITE,border:BORDER,borderRadius:15,padding:22,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontWeight:600,fontSize:11,color:MID,marginBottom:6,letterSpacing:.3}}>PUZZLE IMAGE</label>
          <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${finalImg?"#22C55E":"#D0C8BC"}`,borderRadius:12,overflow:"hidden",height:finalImg?190:110,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:BG}}>
            {finalImg?<img src={finalImg} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:(
              <div style={{textAlign:"center",padding:16}}>
                <div style={{fontSize:32,marginBottom:6}}>📁</div>
                <div style={{fontWeight:700,fontSize:13,color:DARK}}>Click to upload image</div>
                <div style={{color:MID,fontSize:11,marginTop:3}}>JPG, PNG, WEBP</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </div>
        {[["OR PASTE IMAGE URL",imgUrl,e=>{setImgUrl(e.target.value);setImgSrc("");},"https://..."],
          ["TITLE",title,e=>setTitle(e.target.value),"e.g. Burj Khalifa at Sunset"],
          ["DESCRIPTION (optional)",desc,e=>setDesc(e.target.value),"A short description"],
          ["TAGS",tags,e=>setTags(e.target.value),"city, night, dubai"]
        ].map(([l,v,onChange,ph])=>(
          <div key={l} style={{marginBottom:13}}>
            <label style={{display:"block",fontWeight:600,fontSize:11,color:MID,marginBottom:5,letterSpacing:.3}}>{l}</label>
            <input value={v} onChange={onChange} placeholder={ph} style={{width:"100%",background:BG,border:BORDER,borderRadius:9,padding:"10px 13px",fontSize:13,color:DARK,outline:"none",boxSizing:"border-box"}}/>
          </div>
        ))}
        {err&&<p style={{color:"#EF4444",fontWeight:600,fontSize:12,margin:"0 0 10px"}}>⚠️ {err}</p>}
        {done&&<div style={{background:"#DCFCE7",borderRadius:9,padding:11,marginBottom:11}}><p style={{color:"#166534",fontWeight:700,margin:0,fontSize:13}}>✅ Puzzle added to gallery!</p></div>}
        <button onClick={create} disabled={saving} style={{width:"100%",background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"13px",fontWeight:700,fontSize:14,cursor:saving?"default":"pointer",opacity:saving?.7:1}}>{saving?"Publishing…":"Create & Share 🎉"}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────
function SettingsPage({user,onLogin,onLogout}){
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const connect=async()=>{
    setLoading(true); setErr("");
    try{const u=await signInWithWallet();onLogin(u);}
    catch(e){setErr(e.message);}
    setLoading(false);
  };
  return(
    <div style={{maxWidth:500,margin:"0 auto",padding:"28px 16px 40px"}}>
      <h2 style={{fontWeight:800,fontSize:24,color:DARK,margin:"0 0 22px"}}>Settings</h2>
      <div style={{background:WHITE,border:BORDER,borderRadius:15,padding:22,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
        <h3 style={{fontWeight:700,fontSize:15,color:DARK,margin:"0 0 8px"}}>⛓️ Wallet — Monad Mainnet</h3>
        <p style={{color:MID,fontSize:13,lineHeight:1.6,margin:"0 0 14px"}}>Your wallet is your PuzzleChain account — connecting it (and signing a verification message) signs you in, and also lets you record puzzle scores on-chain.</p>
        {err&&<p style={{color:"#EF4444",fontWeight:600,fontSize:12,margin:"0 0 11px"}}>⚠️ {err}</p>}
        {user?(
          <>
            <div style={{background:BG,border:BORDER,borderRadius:9,padding:"9px 13px",marginBottom:11,fontFamily:"monospace",fontSize:12,color:DARK,wordBreak:"break-all"}}>✅ {user.address}</div>
            <button onClick={onLogout} style={{background:"#FEE2E2",color:"#EF4444",border:"1px solid #FECACA",borderRadius:9,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Disconnect Wallet</button>
          </>
        ):(
          <button onClick={connect} disabled={loading} style={{background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"12px 22px",fontWeight:700,fontSize:14,cursor:"pointer",opacity:loading?.7:1}}>
            {loading?"Connecting...":"🔗 Connect Wallet"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// ADMIN
// ─────────────────────────────────────
function AdminPage(){
  const [tab,setTab]=useState("logs");
  const logs=S.get("logs",[]);
  const [banned,setBanned]=useState(S.get("bannedUsers",[]));
  const [up,setUp]=useState([]);

  useEffect(()=>{
    DB.getCommunityPuzzles().then(rows=>{
      setUp(rows.map(r=>({
        id:r.id, url:r.url, title:r.title, author:r.author, authorName:r.author_name||r.author,
      })));
    }).catch(()=>{});
  },[]);

  const ban=u=>{const b=[...banned,u];setBanned(b);S.set("bannedUsers",b);addLog({type:"user_banned",admin:"admin",target:u});};
  const unban=u=>{const b=banned.filter(x=>x!==u);setBanned(b);S.set("bannedUsers",b);};
  const hide=id=>{
    DB.hideCommunityPuzzle(id).catch(()=>{});
    setUp(prev=>prev.filter(p=>p.id!==id));
    addLog({type:"puzzle_hidden",admin:"admin",puzzleId:id});
  };
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"28px 16px"}}>
      <h2 style={{fontWeight:800,fontSize:24,color:"#EF4444",margin:"0 0 18px"}}>👑 Admin Panel</h2>
      <div style={{display:"flex",gap:0,borderBottom:BORDER,marginBottom:18}}>
        {["logs","puzzles","users"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:tab===t?`2px solid ${GOLD}`:"2px solid transparent",padding:"9px 16px",cursor:"pointer",fontFamily:"inherit",fontWeight:tab===t?700:500,fontSize:13,color:tab===t?DARK:MID,textTransform:"capitalize"}}>{t}</button>
        ))}
      </div>
      {tab==="logs"&&(logs.length===0?<p style={{color:MID}}>No events.</p>:logs.map((l,i)=>(
        <div key={i} style={{background:WHITE,borderLeft:`4px solid ${l.type?.includes("ban")||l.type?.includes("del")?"#EF4444":"#22C55E"}`,borderRadius:"0 10px 10px 0",padding:"9px 13px",marginBottom:7,border:BORDER}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontWeight:700,fontSize:11,color:DARK}}>{l.type?.replace(/_/g," ").toUpperCase()}</span>
            <span style={{color:MID,fontSize:10}}>{new Date(l.ts).toLocaleString()}</span>
          </div>
          <div style={{color:MID,fontSize:12}}>{l.user}{l.puzzle?` → ${l.puzzle}`:""}</div>
        </div>
      )))}
      {tab==="puzzles"&&(up.length===0?<p style={{color:MID}}>No user puzzles.</p>:up.map(p=>(
        <div key={p.id} style={{background:WHITE,border:BORDER,borderRadius:11,padding:13,marginBottom:9,display:"flex",gap:11,alignItems:"center"}}>
          <img src={p.url} alt="" style={{width:55,height:42,objectFit:"cover",borderRadius:7,border:BORDER,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
            <div style={{color:MID,fontSize:11}}>by {p.authorName||shortAddr(p.author)||p.author}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>hide(p.id)} style={{background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:7,padding:"5px 12px",fontWeight:700,fontSize:12,cursor:"pointer"}}>🗑</button>
            <button onClick={()=>ban(p.author)} style={{background:BG,color:"#EF4444",border:"1px solid #FECACA",borderRadius:7,padding:"5px 12px",fontWeight:700,fontSize:12,cursor:"pointer"}}>🚫</button>
          </div>
        </div>
      )))}
      {tab==="users"&&(banned.length===0?<p style={{color:MID}}>No bans.</p>:banned.map(u=>(
        <div key={u} style={{background:WHITE,border:BORDER,borderRadius:9,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,color:DARK}}>{u}</span>
          <button onClick={()=>unban(u)} style={{background:"#DCFCE7",color:"#166534",border:"none",borderRadius:7,padding:"6px 13px",fontWeight:700,fontSize:12,cursor:"pointer"}}>Unban</button>
        </div>
      )))}
    </div>
  );
}

// ─────────────────────────────────────
// AUTH MODAL
// ─────────────────────────────────────
function AuthModal({onClose,onLogin}){
  const [connecting,setConnecting]=useState(false);

  const go=async()=>{
    setConnecting(true);
    try{
      const u=await signInWithWallet();
      onLogin(u);
    }catch(e){
      setConnecting(false);
    }
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:WHITE,borderRadius:18,width:"100%",maxWidth:340,padding:"24px",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
        <button onClick={go} disabled={connecting}
          style={{width:"100%",background:GOLD,color:DARK,border:"none",borderRadius:11,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:9,opacity:connecting?.7:1}}>
          {connecting?"Connecting…":"🔗 Connect Wallet"}
        </button>
        <button onClick={onClose} style={{width:"100%",background:BG,color:MID,border:BORDER,borderRadius:11,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// STYLE HELPERS
// ─────────────────────────────────────
const ctrlBtn=(bg=WHITE)=>({background:bg,border:BORDER,borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12,color:DARK,display:"inline-flex",alignItems:"center",gap:5,height:36,padding:"0 10px",flexShrink:0});
const iconBtn=(size,bg=WHITE)=>({width:size,height:size,background:bg,border:BORDER,borderRadius:8,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0});
const dropItem=()=>({background:"none",border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:8,color:DARK});

// ─────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("gallery");
  const [user,setUser]=useState(()=>getSessionUser());
  const [authOpen,setAuthOpen]=useState(false);
  const [selPuzzle,setSelPuzzle]=useState(null);
  const [selPieces,setSelPieces]=useState(null);
  const [gameKey,setGameKey]=useState(0);
  const [sort,setSort]=useState("Newest First");

  // DB connectivity check — logs to console so you can see immediately on load
  // whether the database is reachable. Check browser DevTools → Console after deploy.
  useEffect(()=>{
    fetch("/api/db",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ping"})})
      .then(r=>r.json())
      .then(d=>{
        if(d.error&&d.error.includes("not configured")) console.error("[DB] ❌ NOT CONFIGURED — set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel environment variables, then redeploy.",d.error);
        else if(d.error) console.warn("[DB] ⚠️ ping returned an error (DB may still work for valid actions):",d.error);
        else console.log("[DB] ✅ connected");
      })
      .catch(e=>console.error("[DB] ❌ /api/db unreachable:",e?.message||e));
  },[]);

  useEffect(()=>{ migrateLocalStorageToDb(); },[]);

  // Listen for mobile sort change
  useEffect(()=>{
    const h=e=>setSort(e.detail);
    window.addEventListener("setsort",h);
    return()=>window.removeEventListener("setsort",h);
  },[]);

  const onLogin=u=>{setUser(u);setAuthOpen(false);};
  const onLogout=()=>{signOutWallet();setUser(null);};

  // Keep the authenticated session in sync wherever it's changed (sign in, sign out, profile edits).
  useEffect(()=>{
    const sync=()=>setUser(getSessionUser());
    window.addEventListener("walletchange",sync);
    return()=>window.removeEventListener("walletchange",sync);
  },[]);

  // Security: a wallet connection alone never authenticates anyone. If MetaMask's active
  // account changes to one that doesn't match our verified session, end the session rather
  // than silently showing the new address's data under the old one.
  useEffect(()=>{
    if(!window.ethereum?.on) return;
    const onAccountsChanged=accs=>{
      const session=S.get("session");
      if(session?.address&&(!accs.length||accs[0].toLowerCase()!==session.address)) onLogout();
    };
    window.ethereum.on("accountsChanged",onAccountsChanged);
    return()=>window.ethereum.removeListener?.("accountsChanged",onAccountsChanged);
  },[]);

  useEffect(()=>{
    const shared=getPuzzleFromURL();
    if(shared){setSelPuzzle(shared.puzzle);setSelPieces(shared.opt);setGameKey(k=>k+1);setPage("game");}
  },[]);

  const startGame=opt=>{setSelPieces(opt);setGameKey(k=>k+1);if(selPuzzle)setPuzzleURL(selPuzzle.id,opt.n);setPage("game");};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;}
        body{background:${BG};font-family:Inter,system-ui,sans-serif;}
        input,button{font-family:inherit;}
        input:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px ${GOLD}33;}
        button:active{opacity:.85;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#D0C8BC;border-radius:5px;}

        /* Desktop */
        @media(min-width:769px){
          .mobile-bottom-tabs{display:none!important;}
          .mobile-only{display:none!important;}
          .desktop-profile{display:flex!important;}
          .desktop-second-nav{display:block!important;}
          main{min-height:calc(100vh - 108px);}
          /* puzzle canvas: 100vh - topnav(60) - secondnav(48) - puzzle controls(52) */
          .puzzle-canvas-wrap{height:calc(100vh - 60px - 48px - 52px) !important;}
          .completion-toast{bottom:46px;}
        }
        /* Mobile */
        @media(max-width:768px){
          .mobile-bottom-tabs{display:block!important;}
          .mobile-only{display:flex!important;}
          .desktop-profile{display:none!important;}
          .desktop-second-nav{display:none!important;}
          main{padding-bottom:64px;min-height:calc(100vh - 60px);}
          /* puzzle canvas: 100vh - topnav(60) - puzzle controls(52) - bottomtabs(64) */
          .puzzle-canvas-wrap{height:calc(100vh - 60px - 52px - 64px) !important;}
          .completion-toast{bottom:74px;}
        }
      `}</style>

      <TopNav page={page} setPage={setPage} user={user} setAuthOpen={setAuthOpen} onLogout={onLogout}/>
      <SecondNav page={page} setPage={setPage} sort={sort} setSort={setSort}/>

      <main>
        {page==="game"       &&selPuzzle&&selPieces&&<PuzzleGame key={gameKey} puzzle={selPuzzle} opt={selPieces} onBack={()=>setPage("detail")} user={user}/>}
        {page==="gallery"    &&<GalleryPage setPage={setPage} setSelPuzzle={setSelPuzzle} sort={sort}/>}
        {page==="detail"     &&selPuzzle&&<DetailPage puzzle={selPuzzle} setPage={setPage} onPlay={startGame} user={user}/>}
        {page==="leaderboard"&&<HallOfFamePage setPage={setPage}/>}
        {page==="history"    &&<HistoryPage user={user} setAuthOpen={setAuthOpen}/>}
        {page==="profile"    &&<ProfilePage user={user} onUpdate={u=>setUser(u)} setAuthOpen={setAuthOpen} onLogout={onLogout}/>}
        {page==="create"     &&<CreatePage user={user} setAuthOpen={setAuthOpen}/>}
        {page==="settings"   &&<SettingsPage user={user} onLogin={onLogin} onLogout={onLogout}/>}
        {page==="admin"      &&user?.isAdmin&&<AdminPage/>}
      </main>

      <BottomTabs page={page} setPage={setPage} user={user} setAuthOpen={setAuthOpen}/>

      <footer className="desktop-second-nav" style={{borderTop:BORDER,padding:"14px 24px",textAlign:"center",background:WHITE}}>
        <span style={{color:MID,fontSize:12}}>🧩 PuzzleChain · Monad Mainnet · {new Date().getFullYear()}</span>
      </footer>

      {authOpen&&<AuthModal onClose={()=>setAuthOpen(false)} onLogin={onLogin}/>}
    </>
  );
}
