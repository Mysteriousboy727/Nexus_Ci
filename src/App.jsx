import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, LineChart, Line, ComposedChart, Bar, Legend
} from "recharts";

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  bg:"#0d0f12", bgPanel:"#111318", bgCard:"#161a20", bgCard2:"#1c2028", bgHov:"#1e2330",
  border:"#252a35", border2:"#2e3545",
  orange:"#ff7a00", orangeDim:"rgba(255,122,0,.12)", orangeBd:"rgba(255,122,0,.35)",
  blue:"#4d8af0",   blueDim:"rgba(77,138,240,.1)",
  green:"#3ecf8e",  greenDim:"rgba(62,207,142,.1)",
  red:"#f0506e",    redDim:"rgba(240,80,110,.1)",
  yellow:"#fbbf24", purple:"#a78bfa", teal:"#22d3ee",
  text:"#e2e4e9", textSec:"#8b8fa8", textMut:"#4d5168",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html{height:100%;font-size:13px}
  body{background:${G.bg};color:${G.text};font-family:'Inter',sans-serif;height:100%;overflow:hidden;font-size:13px;line-height:1.4}
  #root{height:100%;display:flex;flex-direction:column;overflow:hidden}
  button,input,select,textarea{font-family:'Inter',sans-serif;font-size:13px}
  /* kill all Vite/App.css default styles */
  .counter,.hero,.ticks,#center,#next-steps,#spacer,#docs{all:unset}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${G.border2};border-radius:3px}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  .pulse{animation:pulse 2s ease-in-out infinite}
  .slide-in{animation:slideIn .2s ease both}
`;

// ─── Pipeline & Diagnostic data ──────────────────────────────────────────────
const PIPELINES = [
  {id:"p1",name:"nexus-backend", job:"build & test",  branch:"feat/auth-refactor",  author:"Dashi Lukce",    initials:"DL",aColor:"#6366f1",status:"failed",dur:"3m 21s",ago:"2 min ago",  aiTag:"dep error",    risk:"low",  hash:"a3f8c21",msg:"refactor: upgrade auth middleware to v3.2",files:3,  lines:142, riskScore:28},
  {id:"p2",name:"nexus-api",     job:"test-suite",    branch:"main",                author:"Courtney Henry",initials:"CH",aColor:"#22d3ee",status:"failed",dur:"8m 44s",ago:"11 min ago", aiTag:"human needed", risk:"high", hash:"b7d3e90",msg:"feat: add sessions table migration",        files:5,  lines:89,  riskScore:82},
  {id:"p3",name:"frontend-app",  job:"lint + build",  branch:"feat/ui-redesign",    author:"Tim David",     initials:"TD",aColor:"#fbbf24",status:"flaky", dur:"1m 07s",ago:"18 min ago", aiTag:"retrying",     risk:"low",  hash:"c2a11ff",msg:"style: redesign dashboard layout",         files:12, lines:430, riskScore:41},
  {id:"p4",name:"data-pipeline", job:"etl-job",       branch:"release/v2.1",        author:"Jonas Smith",   initials:"JS",aColor:"#3ecf8e",status:"fixed", dur:"5m 33s",ago:"34 min ago", aiTag:"auto-resolved",risk:"low",  hash:"d9f44cc",msg:"fix: update pandas to 2.2.0",              files:1,  lines:2,   riskScore:12},
  {id:"p5",name:"ml-service",    job:"model-deploy",  branch:"main",                author:"Olivia Martinez",initials:"OM",aColor:"#a78bfa",status:"passed",dur:"12m 01s",ago:"1h ago",   aiTag:null,           risk:null,   hash:"e1c22aa",msg:"chore: bump model version to v3.1",        files:2,  lines:8,   riskScore:8},
];

const DIAG = {
  p1:{root:"Dependency version conflict in package.json",explain:"Commit a3f8c21 upgraded auth-middleware to v3.2 which requires jsonwebtoken ^9.0, but your lockfile pins jsonwebtoken@8.5.1. Breaks peer dep resolution in Node 18+.",conf:91,fixType:"auto",fixLabel:"Bump jsonwebtoken → 9.0.2",fixCmd:"npm install jsonwebtoken@9.0.2",
    tests:[{n:"auth.middleware → verify token",s:"fail",d:"1.2s"},{n:"auth.middleware → refresh token",s:"fail",d:"0.8s"},{n:"integration → POST /api/login",s:"fail",d:"2.1s"},{n:"user.service → createUser",s:"pass",d:"0.3s"},{n:"user.service → deleteUser",s:"pass",d:"0.2s"}],
    logs:[{t:"info",m:"▶ Step 1/6 — Install dependencies"},{t:"ok",m:"✓ npm ci completed in 12.3s"},{t:"info",m:"▶ Step 3/6 — Run tests"},{t:"err",m:"✗ Error: Cannot find module 'jsonwebtoken'"},{t:"err",m:"   peer dep jsonwebtoken@^9.0 required, found 8.5.1"},{t:"warn",m:"⚠ npm WARN peer dep mismatch"},{t:"err",m:"✗ Process exited with code 1"}],
    slack:"🔴 nexus-backend/build failed on feat/auth-refactor\n🤖 AI: dependency version conflict (91% confidence)\n⚡ Fix: bump jsonwebtoken → 9.0.2\nLow-risk · AI can apply automatically"},
  p2:{root:"DB schema mismatch — test fixtures pre-date migration",explain:"Migration 0042_add_sessions_table added a NOT NULL column without a default. 17 tests fail with null constraint violation on session_id.",conf:78,fixType:"human",fixLabel:"Add default to migration",fixCmd:"ALTER TABLE sessions ALTER COLUMN session_id SET DEFAULT gen_random_uuid()",
    tests:[{n:"sessions → create session",s:"fail",d:"3.2s"},{n:"sessions → invalidate session",s:"fail",d:"1.1s"},{n:"integration → POST /auth/login",s:"fail",d:"2.8s"},{n:"user.model.spec",s:"pass",d:"0.4s"},{n:"token.service.spec",s:"pass",d:"0.6s"}],
    logs:[{t:"ok",m:"✓ Unit tests: 44/44 passed"},{t:"info",m:"▶ Running integration tests..."},{t:"err",m:"✗ null value in column 'session_id' violates not-null constraint"},{t:"err",m:"   DETAIL: Failing row contains (null, user_123, ...)"},{t:"warn",m:"⚠ 17 integration tests failed (sessions module)"}],
    slack:"🔴 nexus-api/test-suite failed on main\n🤖 AI: DB schema mismatch (78% confidence)\n⚠ Fix involves DB migration — HUMAN REVIEW REQUIRED\nHigh-risk · Requires manual approval"},
  p3:{root:"Intermittent network timeout — flaky test pattern",explain:"Step fetch-remote-config timed out after 30s. This step failed 3× in 7 days with ECONNRESET. Classified as flaky. Auto-retry #2 queued.",conf:84,fixType:"retry",fixLabel:"Auto-retry attempt 2/3",fixCmd:"gh workflow run --ref feat/ui-redesign",
    tests:[{n:"lint → ESLint pass",s:"pass",d:"4.1s"},{n:"lint → Prettier check",s:"pass",d:"1.2s"},{n:"build → Vite production build",s:"fail",d:"30.0s (timeout)"}],
    logs:[{t:"ok",m:"✓ ESLint: 0 errors, 2 warnings"},{t:"ok",m:"✓ TypeScript compiled"},{t:"info",m:"▶ Fetching remote feature flags..."},{t:"err",m:"✗ ECONNRESET: connection reset by peer"},{t:"warn",m:"⚠ Timeout after 30000ms"},{t:"info",m:"↻ AI detected flaky pattern. Queuing retry #2..."}],
    slack:"⚠ frontend-app flaky on feat/ui-redesign\n🤖 AI: intermittent network timeout (84% confidence)\n↻ Auto-retry #2 in progress\nNo action needed — monitoring"},
  p4:{root:"Outdated pandas — breaking API change in v2.0",explain:"pandas 2.0 removed DataFrame.append() used in etl/transform.py:44. Replace with pd.concat(). Known pattern, confidence 96%. Auto-fix applied.",conf:96,fixType:null,fixLabel:null,fixCmd:null,
    tests:[{n:"etl.transform → append rows",s:"pass",d:"0.9s"},{n:"etl.pipeline → end to end",s:"pass",d:"3.2s"}],
    logs:[{t:"ok",m:"✓ Auto-fix applied: pd.concat() replacement"},{t:"ok",m:"✓ All affected tests now passing"},{t:"ok",m:"✓ PR #246 merged: fix deprecated DataFrame.append"}],
    slack:"✅ data-pipeline/etl-job auto-fixed on release/v2.1\n✓ PR #246 merged. Pipeline green."},
  p5:{root:null,explain:"Pipeline passed successfully. All 3 tests green.",conf:100,fixType:null,fixLabel:null,fixCmd:null,
    tests:[{n:"model.inference → predict",s:"pass",d:"2.1s"},{n:"model.inference → batch",s:"pass",d:"5.4s"},{n:"deploy → health check",s:"pass",d:"1.8s"}],
    logs:[{t:"ok",m:"✓ All tests passed (3/3)"},{t:"ok",m:"✓ Docker image built: ml-service:v3.1"},{t:"ok",m:"✓ Deployed to staging. Health check passed."}],
    slack:"✅ ml-service/model-deploy passed on main\n✓ Model v3.1 deployed. All health checks green."},
};

const METRICS = [
  {h:"09:00",passed:18,failed:3,fixed:2},{h:"10:00",passed:22,failed:5,fixed:4},
  {h:"11:00",passed:15,failed:8,fixed:5},{h:"12:00",passed:28,failed:4,fixed:3},
  {h:"13:00",passed:31,failed:6,fixed:5},{h:"14:00",passed:24,failed:7,fixed:4},
];

const AI_FIX_MEMORY = [
  {pattern:"Redis Timeout",confidence:93,fixes:18,color:G.red},
  {pattern:"Null Pointer",confidence:88,fixes:14,color:G.orange},
  {pattern:"Build OOM",confidence:73,fixes:9,color:G.yellow},
  {pattern:"Dep Conflict",confidence:91,fixes:22,color:G.purple},
  {pattern:"DB Migration",confidence:78,fixes:11,color:G.blue},
];

const BLAME_DATA = [
  {name:"Rahul",value:28,color:"#6366f1"},{name:"Priya",value:19,color:G.teal},
  {name:"Yash",value:16,color:G.orange},{name:"Other",value:37,color:G.textMut},
];

const MODULE_HEALTH = [
  {module:"Auth",health:87,pred:87,color:G.green},
  {module:"Payments",health:80,pred:80,color:G.yellow},
  {module:"Dashboard",health:91,pred:91,color:G.green},
  {module:"Notifs",health:74,pred:74,color:G.orange},
  {module:"Analytics",health:65,pred:65,color:G.red},
];

const SERVICE_DEPS = [
  {from:"Auth",to:"Payments",risk:"high",x1:160,y1:100,x2:320,y2:60},
  {from:"Auth",to:"Notifs",risk:"low",x1:160,y1:100,x2:310,y2:160},
  {from:"Payments",to:"Dashboard",risk:"low",x1:320,y1:60,x2:480,y2:100},
];

// ─── Primitives ───────────────────────────────────────────────────────────────
function Tag({color=G.blue,bg,children,small}){
  return <span style={{
    background:bg||color+"18",color,border:`1px solid ${color}30`,
    fontSize:small?9:10,fontWeight:600,padding:small?"1px 5px":"2px 8px",
    borderRadius:3,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",letterSpacing:".03em"
  }}>{children}</span>;
}

function Btn({variant="default",children,onClick,small,full}){
  const [hov,setHov]=useState(false);
  const v={
    default:{bg:hov?G.bgCard2:G.bgCard,fg:G.text,bd:G.border2},
    primary:{bg:hov?"#cc6200":G.orange,fg:"#fff",bd:G.orange},
    success:{bg:hov?G.greenDim:"transparent",fg:G.green,bd:G.green+"55"},
    danger:{bg:hov?G.redDim:"transparent",fg:G.red,bd:G.red+"55"},
    ghost:{bg:"transparent",fg:hov?G.text:G.textSec,bd:"transparent"},
  }[variant]||{};
  return <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
    background:v.bg,color:v.fg,border:`1px solid ${v.bd}`,
    padding:small?"3px 10px":"6px 14px",borderRadius:4,fontSize:small?10:12,fontWeight:500,
    cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"inline-flex",alignItems:"center",
    gap:5,transition:"all .13s",width:full?"100%":"auto",justifyContent:full?"center":"flex-start"
  }}>{children}</button>;
}

function Avatar({initials,color="#6366f1",size=26}){
  return <div style={{
    width:size,height:size,borderRadius:"50%",background:color+"cc",
    display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:size*.36,fontWeight:700,color:"#fff",flexShrink:0
  }}>{initials}</div>;
}

function Dot({status}){
  const c={failed:G.red,flaky:G.yellow,fixed:G.green,passed:G.green}[status]||G.textMut;
  return <span style={{
    width:7,height:7,borderRadius:"50%",background:c,display:"inline-block",
    flexShrink:0,animation:status==="failed"?"pulse 2s ease-in-out infinite":"none"
  }}/>;
}

function Spinner(){
  return <span style={{
    display:"inline-block",width:11,height:11,border:`2px solid ${G.purple}`,
    borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"
  }}/>;
}

function Card({children,style:s={},onClick}){
  const [hov,setHov]=useState(false);
  return <div onClick={onClick}
    onMouseEnter={()=>onClick&&setHov(true)}
    onMouseLeave={()=>setHov(false)}
    style={{background:G.bgCard,border:`1px solid ${hov?G.border2:G.border}`,
    borderRadius:6,overflow:"hidden",cursor:onClick?"pointer":"default",
    transition:"border-color .15s",...s}}>{children}</div>;
}

function CardHeader({title,right,icon,sub}){
  return <div style={{padding:"10px 14px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:8}}>
    {icon&&<span style={{fontSize:13,flexShrink:0}}>{icon}</span>}
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:12,fontWeight:600,color:G.text,lineHeight:1}}>{title}</div>
      {sub&&<div style={{fontSize:10,color:G.textMut,marginTop:2}}>{sub}</div>}
    </div>
    {right}
  </div>;
}

function RingChart({value,max=100,color=G.blue,size=100,label,sub}){
  const r=38,c=2*Math.PI*r,pct=(value/max)*c;
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow:"visible"}}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={G.border} strokeWidth="7"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${pct} ${c}`} strokeDashoffset={c/4}
        strokeLinecap="round" style={{transition:"stroke-dasharray .5s ease"}}/>
      <text x="50" y="46" textAnchor="middle" dominantBaseline="central"
        fill={G.text} fontSize="18" fontWeight="700"
        fontFamily="'JetBrains Mono',monospace" style={{fontSize:"18px"}}>
        {value}{max===100?"%":""}
      </text>
      {sub&&<text x="50" y="62" textAnchor="middle"
        fill={G.textMut} fontSize="10" fontFamily="'Inter',sans-serif" style={{fontSize:"10px"}}>{sub}</text>}
    </svg>
    {label&&<div style={{fontSize:10,color:G.textSec,textAlign:"center",lineHeight:1.3}}>{label}</div>}
  </div>;
}

function MiniBar({value,max=100,color=G.blue,height=4}){
  return <div style={{height,background:G.border,borderRadius:height/2,overflow:"hidden",flex:1}}>
    <div style={{height:"100%",width:`${Math.min(100,value/max*100)}%`,background:color,borderRadius:height/2,transition:"width .4s ease"}}/>
  </div>;
}

// ─── Top Nav ─────────────────────────────────────────────────────────────────
function TopNav({onSimulate}){
  const now=new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  return <div style={{background:G.bgPanel,borderBottom:`1px solid ${G.border}`,height:42,display:"flex",alignItems:"center",padding:"0 16px",gap:8,position:"fixed",top:0,left:0,right:0,zIndex:100}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginRight:10}}>
      <div style={{width:26,height:26,background:`linear-gradient(135deg,${G.orange},#cc4400)`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>N</div>
      <span style={{fontSize:13,fontWeight:700,color:G.text,letterSpacing:"-.01em"}}>NexusCI</span>
    </div>
    {["Dashboards","Explore","Alerts & IRM","AI & Machine Learning","Pipeline Runs","Approvals"].map(n=>(
      <span key={n} style={{fontSize:12,color:G.textMut,cursor:"pointer",padding:"0 4px",whiteSpace:"nowrap",transition:"color .12s"}}
        onMouseEnter={e=>e.target.style.color=G.textSec} onMouseLeave={e=>e.target.style.color=G.textMut}>{n}</span>
    ))}
    <div style={{flex:1}}/>
    <span style={{fontSize:10,color:G.textMut,fontFamily:"'JetBrains Mono',monospace"}}>{now}</span>
    <Btn variant="primary" small onClick={onSimulate}>+ Simulate</Btn>
    <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"4px 8px",borderRadius:4,background:G.bgCard,border:`1px solid ${G.border}`}}>
      <Avatar initials="AZ" color={G.blue} size={20}/>
      <span style={{fontSize:11,color:G.textSec}}>Ayaan Zafar</span>
    </div>
  </div>;
}

// ─── New Left Nav (5 sections) ───────────────────────────────────────────────
const NAV_SECTIONS = [
  {id:"risk",     icon:"⚡",label:"Predictive Risk",  badge:3,  color:G.orange},
  {id:"live",     icon:"📡",label:"Live Pipelines",   badge:null,color:G.blue},
  {id:"debugger", icon:"🤖",label:"AI Debugger",      badge:null,color:G.purple},
  {id:"fixes",    icon:"⚙️",label:"Auto-Fix & Approvals",badge:2,color:G.green},
  {id:"impact",   icon:"💣",label:"Impact & Insights",badge:null,color:G.teal},
  {id:"memory",   icon:"🧠",label:"Learning System",  badge:null,color:G.yellow},
];

function NavItem({item,active,collapsed,onClick}){
  const [hov,setHov]=useState(false);
  return <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{display:"flex",alignItems:"center",gap:10,padding:collapsed?"10px 14px":"8px 12px",cursor:"pointer",
    color:active?"#fff":hov?G.text:G.textSec,
    background:active?`${item.color}18`:hov?G.bgHov:"transparent",
    borderLeft:active?`2px solid ${item.color}`:"2px solid transparent",
    transition:"all .12s",justifyContent:collapsed?"center":"flex-start",marginBottom:1}}>
    <span style={{fontSize:15,flexShrink:0}}>{item.icon}</span>
    {!collapsed&&<>
      <span style={{flex:1,fontSize:12,fontWeight:active?600:400,whiteSpace:"nowrap"}}>{item.label}</span>
      {item.badge&&<span style={{background:G.red,color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:8,fontFamily:"'JetBrains Mono',monospace"}}>{item.badge}</span>}
    </>}
  </div>;
}

function LeftNav({active,onNav,collapsed}){
  return <nav style={{width:collapsed?48:200,background:G.bgPanel,borderRight:`1px solid ${G.border}`,
    display:"flex",flexDirection:"column",position:"relative",top:0,left:0,height:"100%",
    zIndex:90,transition:"width .2s"}}>
    <div style={{padding:"10px 0 6px",borderBottom:`1px solid ${G.border}`,marginBottom:6}}>
      {!collapsed&&<div style={{padding:"4px 14px 8px",fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:G.textMut}}>Monitoring</div>}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"0 0 6px"}}>
      {NAV_SECTIONS.map(item=><NavItem key={item.id} item={item} active={active===item.id} collapsed={collapsed} onClick={()=>onNav(item.id)}/>)}
    </div>
    <div style={{borderTop:`1px solid ${G.border}`,padding:"8px 0"}}>
      {[{id:"set",icon:"⚙",label:"Settings"},{id:"help",icon:"?",label:"Help"}].map(item=>(
        <NavItem key={item.id} item={{...item,color:G.textMut}} active={false} collapsed={collapsed} onClick={()=>{}}/>
      ))}
    </div>
  </nav>;
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Bread({path}){
  return <div style={{background:G.bgPanel,borderBottom:`1px solid ${G.border}`,padding:"7px 16px",display:"flex",alignItems:"center",gap:4,justifyContent:"space-between"}}>
    <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:G.textSec}}>
      {path.map((p,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
        {i>0&&<span style={{color:G.textMut}}>›</span>}
        <span style={{color:i===path.length-1?G.text:G.textSec}}>{p}</span>
      </span>)}
    </div>
    <div style={{display:"flex",gap:6}}>
      <Btn small>⤴ Share</Btn>
      <Btn small>↺ Refresh</Btn>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1: Predictive Risk Panel
// ═══════════════════════════════════════════════════════════════════════════════
const PR_PRS = [
  {pr:"#312",repo:"nexus-backend",branch:"feat/stripe-v3",author:"Tim David",initials:"TD",color:"#fbbf24",riskScore:78,files:14,lines:892,patterns:["payments refactor","untested edge","3rd-party dep"],status:"open",eta:"CI not started"},
  {pr:"#309",repo:"nexus-api",branch:"fix/session-expiry",author:"Rahul K",initials:"RK",color:"#6366f1",riskScore:44,files:5,lines:210,patterns:["session logic","migration"],status:"open",eta:"CI not started"},
  {pr:"#307",repo:"ml-service",branch:"feat/batch-predict",author:"Olivia M",initials:"OM",color:"#a78bfa",riskScore:22,files:3,lines:88,patterns:["model version bump"],status:"open",eta:"CI not started"},
  {pr:"#305",repo:"frontend-app",branch:"chore/deps",author:"Courtney H",initials:"CH",color:"#22d3ee",riskScore:15,files:1,lines:4,patterns:["routine dep update"],status:"open",eta:"CI not started"},
];

const RISK_PATTERNS = [
  {pattern:"Payments module touched",impact:"High failure rate (72%) when payments + auth changed together",color:G.red},
  {pattern:"Migration without rollback",impact:"3 of last 5 migration PRs caused test failures",color:G.orange},
  {pattern:"3rd-party dep upgrade",impact:"Version conflicts detected in 68% of dep bumps",color:G.yellow},
  {pattern:"Large diff (>500 lines)",impact:"Flaky rate 2.3x higher for diffs >500 lines",color:G.blue},
];

function RiskScoreBadge({score}){
  const color=score>=70?G.red:score>=45?G.orange:score>=25?G.yellow:G.green;
  const label=score>=70?"HIGH RISK":score>=45?"MEDIUM":score>=25?"LOW-MED":"SAFE";
  return <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:32,height:32,borderRadius:"50%",border:`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{score}</div>
    <Tag color={color} small>{label}</Tag>
  </div>;
}

function PredictiveRiskPage(){
  return <div style={{padding:"0 0 24px"}}>
    <Bread path={["NexusCI","Predictive Risk Panel"]}/>
    <div style={{padding:"14px 18px"}}>
      {/* Hero metric strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {label:"PRs Scored Today",v:12,sub:"Before CI runs",c:G.blue,icon:"📊"},
          {label:"High-Risk PRs",v:3,sub:"Need attention",c:G.red,icon:"⚠️"},
          {label:"Prevented Failures",v:7,sub:"Est. via early warning",c:G.green,icon:"✓"},
          {label:"Avg Risk Score",v:"41%",sub:"Across open PRs",c:G.orange,icon:"⚡"},
        ].map(m=>(
          <Card key={m.label}>
            <div style={{padding:"14px 14px 12px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-12,right:-12,width:56,height:56,borderRadius:"50%",background:m.c,opacity:.07}}/>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{fontSize:13}}>{m.icon}</span>
                <span style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut}}>{m.label}</span>
              </div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:m.c,lineHeight:1,marginBottom:3}}>{m.v}</div>
              <div style={{fontSize:10,color:G.textMut}}>{m.sub}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* PRs table */}
      <Card style={{marginBottom:12}}>
        <CardHeader title="Open Pull Requests — Risk Scored" icon="🔍" sub="Scored before CI runs using co-change history & author patterns"/>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${G.border}`}}>
                {["PR","Repository","Branch","Author","Risk Score","Patterns Detected","Action"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PR_PRS.map((pr,i)=>(
                <tr key={pr.pr} style={{borderBottom:i<PR_PRS.length-1?`1px solid ${G.border}`:"none",background:pr.riskScore>=70?`${G.red}08`:"transparent"}}>
                  <td style={{padding:"10px 12px"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:G.blue,fontWeight:600}}>{pr.pr}</span></td>
                  <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:G.text,fontWeight:500}}>{pr.repo}</span></td>
                  <td style={{padding:"10px 12px"}}><Tag color={G.blue} small>{pr.branch}</Tag></td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <Avatar initials={pr.initials} color={pr.color} size={20}/>
                      <span style={{fontSize:11,color:G.textSec}}>{pr.author}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 12px"}}><RiskScoreBadge score={pr.riskScore}/></td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {pr.patterns.map(p=><Tag key={p} color={G.purple} small>{p}</Tag>)}
                    </div>
                  </td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:5}}>
                      {pr.riskScore>=70&&<Btn small variant="danger">👁 Review</Btn>}
                      {pr.riskScore<70&&pr.riskScore>=25&&<Btn small variant="default">Review</Btn>}
                      {pr.riskScore<25&&<Btn small variant="ghost">View</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Risk patterns */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card>
          <CardHeader title="Failure Pattern Library" icon="📚" sub="Historical patterns driving risk scoring"/>
          <div style={{padding:"10px 14px"}}>
            {RISK_PATTERNS.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:i<RISK_PATTERNS.length-1?`1px solid ${G.border}`:"none"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:r.color,flexShrink:0,marginTop:4}}/>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:G.text,marginBottom:2}}>{r.pattern}</div>
                  <div style={{fontSize:10,color:G.textSec}}>{r.impact}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Risk Distribution" icon="📊" sub="Current open PRs by risk band"/>
          <div style={{padding:"20px 14px",display:"flex",gap:20,alignItems:"center",justifyContent:"center"}}>
            <RingChart value={78} label="Highest Risk PR" sub="#312 stripe" color={G.red} size={110}/>
            <div style={{flex:1}}>
              {[{label:"High (70-100)",count:1,color:G.red},{label:"Medium (45-69)",count:0,color:G.orange},{label:"Low-Med (25-44)",count:1,color:G.yellow},{label:"Safe (0-24)",count:2,color:G.green}].map(b=>(
                <div key={b.label} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:10,color:G.textSec}}>{b.label}</span>
                    <span style={{fontSize:10,fontWeight:600,color:b.color,fontFamily:"'JetBrains Mono',monospace"}}>{b.count} PRs</span>
                  </div>
                  <MiniBar value={b.count} max={4} color={b.color}/>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 2: Live Pipeline Monitor
// ═══════════════════════════════════════════════════════════════════════════════
const CustomTooltip = ({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return <div style={{background:G.bgCard2,border:`1px solid ${G.border}`,borderRadius:4,padding:"8px 12px",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
    <div style={{color:G.textMut,marginBottom:4}}>{label}</div>
    {payload.map(p=><div key={p.name} style={{color:p.color}}>{p.name}: {p.value}</div>)}
  </div>;
};

function PipelineRow({p,selected,onSelect,onFix}){
  const [hov,setHov]=useState(false);
  const statusTag={
    failed:<Tag color={G.red}>FAILED</Tag>,
    flaky:<Tag color={G.yellow}>FLAKY</Tag>,
    fixed:<Tag color={G.green}>FIXED</Tag>,
    passed:<Tag color={G.green}>PASSED</Tag>,
  }[p.status];
  const aiTagEl=p.aiTag&&{
    "dep error":<Tag color={G.purple}>AI: dep error</Tag>,
    "human needed":<Tag color={G.yellow}>HUMAN NEEDED</Tag>,
    "retrying":<Tag color={G.blue}>AI: retrying</Tag>,
    "auto-resolved":<Tag color={G.teal}>auto-resolved</Tag>,
  }[p.aiTag];

  return <div onClick={onSelect} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{padding:"10px 14px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"flex-start",
    gap:10,cursor:"pointer",background:selected?"rgba(77,138,240,.06)":hov?G.bgHov:"transparent",
    borderLeft:selected?`2px solid ${G.blue}`:"2px solid transparent",transition:"all .12s"}}>
    <Dot status={p.status}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
        <span style={{fontSize:12,fontWeight:600,color:G.text}}>{p.name}</span>
        <span style={{fontSize:11,color:G.textMut}}>/</span>
        <span style={{fontSize:11,color:G.textSec}}>{p.job}</span>
        {statusTag}{aiTagEl}
        {p.riskScore&&<span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:p.riskScore>60?G.red:p.riskScore>35?G.orange:G.textMut}}>risk:{p.riskScore}</span>}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {[`⏱ ${p.dur}`,`⎇ ${p.branch}`,p.ago].map((m,i)=>(
          <span key={i} style={{fontSize:10,color:G.textMut,fontFamily:"'JetBrains Mono',monospace"}}>{m}</span>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <Avatar initials={p.initials} color={p.aColor} size={14}/>
          <span style={{fontSize:10,color:G.textMut}}>{p.author}</span>
        </div>
      </div>
    </div>
    <div onClick={e=>e.stopPropagation()}>
      {p.status==="failed"&&p.risk==="low"&&<Btn variant="success" small onClick={onFix}>⚡ Auto Fix</Btn>}
      {p.status==="failed"&&p.risk==="high"&&<Btn variant="default" small>👁 Review</Btn>}
      {p.status==="flaky"&&<Btn variant="ghost" small>Logs</Btn>}
      {(p.status==="fixed"||p.status==="passed")&&<Btn variant="ghost" small>History</Btn>}
    </div>
  </div>;
}

function LivePipelinePage({pipelines,stats,selectedId,onSelect,onFix,fixedIds}){
  return <div style={{padding:"0 0 24px"}}>
    <Bread path={["NexusCI","Live Pipeline Monitor"]}/>
    <div style={{padding:"14px 18px"}}>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[
          {label:"Total Runs Today",v:stats.total,c:G.blue,sub:"↑ 12% vs yesterday"},
          {label:"Failed",v:stats.failed,c:G.red,sub:`${stats.pending} pending fix`},
          {label:"AI Auto-Fixed",v:stats.fixed,c:G.green,sub:`${Math.round(stats.fixed/Math.max(stats.failed+stats.fixed,1)*100)}% auto-resolve`},
          {label:"Awaiting Approval",v:stats.approval,c:G.yellow,sub:"High-risk flagged"},
        ].map(c=>(
          <Card key={c.label}>
            <div style={{padding:"14px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-12,right:-12,width:52,height:52,borderRadius:"50%",background:c.c,opacity:.07}}/>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:5}}>{c.label}</div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:c.c,lineHeight:1,marginBottom:3}}>{c.v}</div>
              <div style={{fontSize:10,color:G.textMut}}>{c.sub}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chart + failure prediction — fixed heights so no gap */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:12,alignItems:"start"}}>
        <Card style={{display:"flex",flexDirection:"column"}}>
          <CardHeader title="Pipeline Activity — Today" icon="📈" right={
            <div style={{display:"flex",gap:12}}>
              {[[G.green,"Passed"],[G.red,"Failed"],[G.blue,"AI Fixed"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:G.textSec}}>
                  <span style={{width:8,height:3,borderRadius:1,background:c,display:"inline-block"}}/>{l}
                </span>
              ))}
            </div>}/>
          <div style={{padding:"12px 10px 14px",flex:1}}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={METRICS} margin={{top:4,right:4,bottom:0,left:-22}}>
                <defs>
                  {[["g1",G.green],["g2",G.red],["g3",G.blue]].map(([id,c])=>(
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={.25}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="h" tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="passed" name="Passed" stroke={G.green} strokeWidth={2} fill="url(#g1)"/>
                <Area type="monotone" dataKey="failed" name="Failed" stroke={G.red}   strokeWidth={2} fill="url(#g2)"/>
                <Area type="monotone" dataKey="fixed"  name="Fixed"  stroke={G.blue}  strokeWidth={2} fill="url(#g3)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Failure Prediction" icon="🎯" sub="Past 30 days accuracy"/>
          <div style={{padding:"16px 16px 18px"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
              <RingChart value={82} label="Current prediction" sub="correct" color={G.orange} size={120}/>
            </div>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".09em",color:G.textMut,marginBottom:10}}>By module</div>
            {MODULE_HEALTH.map(m=>(
              <div key={m.module} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:10,color:G.textSec,width:64,flexShrink:0}}>{m.module}</span>
                <MiniBar value={m.pred} color={m.color} height={5}/>
                <span style={{fontSize:10,fontWeight:700,color:m.color,fontFamily:"'JetBrains Mono',monospace",width:32,textAlign:"right"}}>{m.pred}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pipeline list */}
      <Card>
        <CardHeader title="All Pipeline Runs" icon="🔴" right={
          <><Tag color={G.red}>{pipelines.filter(p=>p.status==="failed").length} failures</Tag></>}/>
        {pipelines.map(p=><PipelineRow key={p.id} p={p} selected={selectedId===p.id} onSelect={()=>onSelect(p.id)} onFix={()=>onFix(p.id)}/>)}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:G.bg,borderTop:`1px solid ${G.border}`}}>
          <span style={{fontSize:10,color:G.textMut,whiteSpace:"nowrap"}}>AI confidence this hour</span>
          <div style={{flex:1,height:2,background:G.border,borderRadius:1}}>
            <div style={{width:"73%",height:"100%",background:`linear-gradient(90deg,${G.blue},${G.purple})`,borderRadius:1}}/>
          </div>
          <span style={{fontSize:10,color:G.textMut,fontFamily:"'JetBrains Mono',monospace"}}>73%</span>
        </div>
      </Card>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 3: AI Debugger Panel
// ═══════════════════════════════════════════════════════════════════════════════
function SlackSection({pipeline,diag,thinking,isFixed,onFix}){
  const [state,setState]=useState("pending");
  useEffect(()=>{ setState("pending"); },[pipeline?.id]);
  const msg=isFixed||state==="approved"?`✅ Auto-fix applied.\nPR opened: ${diag?.fixLabel||"fix applied"}\nPipeline re-triggered.`:state==="rejected"?`❌ Rejected.\nAssigned to ${pipeline?.author} for manual review.`:state==="escalated"?`⬆️ Escalated to #backend-leads\nOn-call notified via PagerDuty.`:diag?.slack||"";
  return <div style={{padding:"10px 14px",borderTop:`1px solid ${G.border}`}}>
    <div style={{background:G.bgCard2,border:`1px solid ${G.border}`,borderRadius:4,padding:"10px 12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <div style={{width:16,height:16,background:"#4a154b",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#ecb22e"}}>S</div>
        <span style={{fontSize:11,fontWeight:600,color:G.text}}>#devops-alerts</span>
        <span style={{fontSize:9,color:G.textMut,fontFamily:"'JetBrains Mono',monospace"}}>NexusCI Bot</span>
      </div>
      <div style={{fontSize:10,color:G.textSec,lineHeight:1.7,whiteSpace:"pre-line",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>{thinking?"Preparing notification...":msg}</div>
      {!isFixed&&state==="pending"&&!thinking&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {(diag?.fixType==="auto"||diag?.fixType==="human")&&<Btn variant="success" small onClick={()=>{ onFix(); setState("approved"); }}>✓ Approve</Btn>}
          <Btn variant="danger" small onClick={()=>setState("rejected")}>✗ Reject</Btn>
          <Btn variant="default" small onClick={()=>setState("escalated")}>↑ Escalate</Btn>
        </div>
      )}
    </div>
  </div>;
}

function AIDebuggerPage({pipelines,diagData,selectedId,onSelect,onFix,fixedIds}){
  const pipeline=pipelines.find(p=>p.id===selectedId);
  const diag=diagData[selectedId];
  const [thinking,setThinking]=useState(false);
  const [prevId,setPrevId]=useState(null);
  const [logs,setLogs]=useState([]);
  const logRef=useRef();

  useEffect(()=>{
    if(!pipeline||pipeline.id===prevId) return;
    setPrevId(pipeline.id); setThinking(true); setLogs([]);
    const t=setTimeout(()=>setThinking(false),850); return ()=>clearTimeout(t);
  },[pipeline?.id]);

  useEffect(()=>{
    if(thinking||!diag?.logs) return;
    setLogs([]);
    diag.logs.forEach((l,i)=>{ setTimeout(()=>{ setLogs(p=>[...p,l]); if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight; },i*90); });
  },[thinking,diag]);

  const lc=t=>({err:G.red,warn:G.yellow,ok:G.green,info:G.textMut}[t]||G.textMut);
  const isFixed=fixedIds.has(selectedId);

  return <div style={{padding:"0 0 24px"}}>
    <Bread path={["NexusCI","AI Debugger"]}/>
    <div style={{padding:"14px 18px",display:"grid",gridTemplateColumns:"260px 1fr",gap:10}}>

      {/* Pipeline selector */}
      <Card style={{height:"fit-content"}}>
        <CardHeader title="Select Run" icon="🔴"/>
        {pipelines.map(p=>(
          <div key={p.id} onClick={()=>onSelect(p.id)}
            style={{padding:"9px 12px",borderBottom:`1px solid ${G.border}`,cursor:"pointer",
            background:selectedId===p.id?"rgba(77,138,240,.07)":undefined,
            borderLeft:selectedId===p.id?`2px solid ${G.blue}`:"2px solid transparent",transition:"all .12s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}
            onMouseLeave={e=>e.currentTarget.style.background=selectedId===p.id?"rgba(77,138,240,.07)":""}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <Dot status={p.status}/>
              <span style={{fontSize:11,fontWeight:600,color:G.text}}>{p.name}</span>
            </div>
            <div style={{fontSize:9,color:G.textMut,fontFamily:"'JetBrains Mono',monospace",paddingLeft:13}}>{p.ago} · {p.dur}</div>
          </div>
        ))}
      </Card>

      {/* AI Debugger */}
      {pipeline&&diag?<Card style={{display:"flex",flexDirection:"column"}}>
        <CardHeader title="AI Root Cause Debugger" icon="🤖"
          right={isFixed?<Tag color={G.green}>FIXED</Tag>:thinking?<Tag color={G.purple}><Spinner/> analyzing</Tag>:
            pipeline.status==="passed"?<Tag color={G.green}>PASSED</Tag>:
            pipeline.risk==="high"?<Tag color={G.yellow}>HUMAN NEEDED</Tag>:
            diag.root?<Tag color={G.blue}>DIAGNOSED</Tag>:<Tag color={G.green}>CLEAN</Tag>}/>

        <div style={{overflowY:"auto",flex:1}}>
          {/* Blame commit */}
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${G.border}`,background:G.bgCard2}}>
            <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",color:G.textMut,marginBottom:6}}>Blame commit</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <Avatar initials={pipeline.initials} color={pipeline.aColor} size={22}/>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:G.blue}}>{pipeline.hash}</span>
              <span style={{fontSize:10,color:G.textSec,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pipeline.msg}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Tag color={G.red} small>+{pipeline.lines} lines</Tag>
              <Tag color={G.yellow} small>{pipeline.files} files</Tag>
              <Tag color={G.blue} small>{pipeline.branch}</Tag>
            </div>
          </div>

          {/* Diagnosis */}
          <div style={{padding:"10px 14px"}}>
            {thinking?(
              <div style={{background:G.bgCard2,border:`1px solid ${G.border}`,borderRadius:4,padding:"14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Spinner/><span style={{fontSize:12,color:G.purple,fontWeight:500}}>Analyzing context...</span></div>
                <div style={{fontSize:11,color:G.textMut}}>Fetching commit diff · Reading logs · RAG lookup · Scoring fix confidence</div>
              </div>
            ):diag.root?(
              <div style={{background:G.bgCard2,border:`1px solid ${G.blue}25`,borderRadius:4,padding:"12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",color:G.blue}}>✦ Root cause</span>
                  <span style={{marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:G.green,background:G.greenDim,padding:"1px 7px",borderRadius:3,border:`1px solid ${G.green}30`}}>Confidence: {diag.conf}%</span>
                </div>
                <div style={{fontSize:12,fontWeight:600,color:G.text,marginBottom:5}}>{diag.root}</div>
                <div style={{fontSize:11,color:G.textSec,lineHeight:1.65,marginBottom:10}}>{diag.explain}</div>
                {diag.fixType&&!isFixed&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {diag.fixType==="auto"&&<Btn variant="success" small onClick={()=>onFix(selectedId)}>⚡ Auto-fix: {diag.fixLabel}</Btn>}
                    {diag.fixType==="human"&&<span style={{fontSize:11,color:G.yellow}}>⚠ Requires human approval</span>}
                    {diag.fixType==="retry"&&<span style={{fontSize:11,color:G.blue}}>↻ Auto-retry in progress...</span>}
                    {diag.fixCmd&&<code style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:G.textSec,background:G.bg,padding:"2px 7px",borderRadius:3,border:`1px solid ${G.border}`}}>$ {diag.fixCmd}</code>}
                  </div>
                )}
                {isFixed&&<div style={{marginTop:8,padding:"6px 10px",background:G.greenDim,border:`1px solid ${G.green}40`,borderRadius:3,fontSize:11,color:G.green,fontFamily:"'JetBrains Mono',monospace"}}>✓ Fix applied · PR opened · Pipeline re-triggered</div>}
              </div>
            ):(
              <div style={{background:G.bgCard2,border:`1px solid ${G.green}30`,borderRadius:4,padding:"12px"}}>
                <div style={{fontSize:12,fontWeight:600,color:G.green,marginBottom:4}}>✓ No issues detected</div>
                <div style={{fontSize:11,color:G.textSec}}>{diag.explain}</div>
              </div>
            )}
          </div>

          {/* Logs */}
          <div style={{padding:"0 14px 10px"}}>
            <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",color:G.textMut,marginBottom:6}}>Error logs</div>
            <div ref={logRef} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:3,padding:"8px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,lineHeight:1.75,maxHeight:130,overflowY:"auto"}}>
              {logs.map((l,i)=><div key={i} style={{color:lc(l.t)}}>{l.m}</div>)}
              {logs.length===0&&<span style={{color:G.textMut}}>Waiting...</span>}
            </div>
          </div>

          {/* Tests */}
          <div style={{borderTop:`1px solid ${G.border}`}}>
            <div style={{padding:"8px 14px",display:"flex",alignItems:"center",gap:7}}>
              <span style={{fontSize:11,fontWeight:600,flex:1}}>Test results</span>
              <Tag color={G.red} small>{diag.tests.filter(t=>t.s==="fail").length} failed</Tag>
              <Tag color={G.green} small>{diag.tests.filter(t=>t.s==="pass").length} passed</Tag>
            </div>
            {diag.tests.map((t,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",borderTop:`1px solid ${G.border}`}}>
                <Tag color={t.s==="fail"?G.red:G.textMut} small>{t.s.toUpperCase()}</Tag>
                <span style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t.s==="fail"?G.red:G.textMut,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.n}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:G.textMut}}>{t.d}</span>
              </div>
            ))}
          </div>

          <SlackSection pipeline={pipeline} diag={diag} thinking={thinking} isFixed={isFixed} onFix={()=>onFix(selectedId)}/>
        </div>
      </Card>:<Card style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
        <span style={{color:G.textMut,fontSize:12}}>Select a pipeline run to debug</span>
      </Card>}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 4: Auto-Fix & Approval Center
// ═══════════════════════════════════════════════════════════════════════════════
const FIX_QUEUE = [
  {id:"f1",repo:"nexus-backend",branch:"feat/auth-refactor",fix:"Bump jsonwebtoken → 9.0.2",confidence:91,risk:"low",type:"dep",author:"Dashi Lukce",initials:"DL",color:"#6366f1",status:"pending",cmd:"npm install jsonwebtoken@9.0.2"},
  {id:"f2",repo:"nexus-api",branch:"main",fix:"Add default to DB migration session_id",confidence:78,risk:"high",type:"migration",author:"Courtney Henry",initials:"CH",color:"#22d3ee",status:"needs-approval",cmd:"ALTER TABLE sessions ALTER COLUMN session_id SET DEFAULT gen_random_uuid()"},
  {id:"f3",repo:"data-pipeline",branch:"release/v2.1",fix:"Replace DataFrame.append → pd.concat()",confidence:96,risk:"low",type:"api-change",author:"Jonas Smith",initials:"JS",color:"#3ecf8e",status:"applied",cmd:"sed -i 's/\.append(/.concat([/g' etl/transform.py"},
  {id:"f4",repo:"frontend-app",branch:"feat/ui-redesign",fix:"Retry after ECONNRESET timeout",confidence:84,risk:"low",type:"retry",author:"Tim David",initials:"TD",color:"#fbbf24",status:"retrying",cmd:"gh workflow run --ref feat/ui-redesign"},
];

const FIX_HISTORY = [
  {fix:"pd.concat() replacement",repo:"data-pipeline",time:"34m ago",conf:96,saved:"~18 min"},
  {fix:"jsonwebtoken bump",repo:"auth-service",time:"2h ago",conf:91,saved:"~12 min"},
  {fix:"OOM heap limit increase",repo:"ml-service",time:"1d ago",conf:88,saved:"~45 min"},
  {fix:"Retry flaky network call",repo:"nexus-api",time:"2d ago",conf:84,saved:"~8 min"},
  {fix:"Missing null check",repo:"payments-api",time:"3d ago",conf:79,saved:"~22 min"},
];

function FixCard({fix,onApprove,onReject}){
  const riskColor=fix.risk==="high"?G.red:G.green;
  const statusTag={
    pending:<Tag color={G.blue}>PENDING</Tag>,
    "needs-approval":<Tag color={G.yellow}>NEEDS APPROVAL</Tag>,
    applied:<Tag color={G.green}>APPLIED</Tag>,
    retrying:<Tag color={G.purple}>RETRYING</Tag>,
  }[fix.status];
  return <Card style={{marginBottom:8}}>
    <div style={{padding:"12px 14px"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
        <Avatar initials={fix.initials} color={fix.color} size={28}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
            <span style={{fontSize:12,fontWeight:600,color:G.text}}>{fix.fix}</span>
            {statusTag}
            <Tag color={riskColor} small>{fix.risk} risk</Tag>
          </div>
          <div style={{display:"flex",gap:8}}>
            <span style={{fontSize:10,color:G.textMut}}>{fix.repo}</span>
            <Tag color={G.blue} small>{fix.branch}</Tag>
            <span style={{fontSize:10,color:G.green,fontFamily:"'JetBrains Mono',monospace"}}>conf: {fix.confidence}%</span>
          </div>
        </div>
        <RingChart value={fix.confidence} size={50} color={fix.confidence>85?G.green:fix.confidence>70?G.yellow:G.red}/>
      </div>
      <div style={{background:G.bg,borderRadius:3,padding:"6px 10px",marginBottom:8,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:G.textMut,border:`1px solid ${G.border}`}}>$ {fix.cmd}</div>
      {(fix.status==="pending"||fix.status==="needs-approval")&&(
        <div style={{display:"flex",gap:6}}>
          <Btn variant="success" small onClick={()=>onApprove(fix.id)}>✓ Approve & Apply</Btn>
          <Btn variant="danger" small onClick={()=>onReject(fix.id)}>✗ Reject</Btn>
          <Btn variant="ghost" small>↑ Escalate</Btn>
          {fix.risk==="low"&&<Btn variant="ghost" small>Auto-approve all low-risk</Btn>}
        </div>
      )}
      {fix.status==="applied"&&<div style={{fontSize:11,color:G.green}}>✓ PR #246 opened and merged · Pipeline re-triggered</div>}
      {fix.status==="retrying"&&<div style={{fontSize:11,color:G.purple}}>↻ Retry attempt 2/3 in progress...</div>}
    </div>
  </Card>;
}

function AutoFixPage(){
  const [fixes,setFixes]=useState(FIX_QUEUE);
  const approve=id=>setFixes(f=>f.map(x=>x.id===id?{...x,status:"applied"}:x));
  const reject=id=>setFixes(f=>f.filter(x=>x.id!==id));

  return <div style={{padding:"0 0 24px"}}>
    <Bread path={["NexusCI","Auto-Fix & Approval Center"]}/>
    <div style={{padding:"14px 18px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {label:"Fixes Applied Today",v:7,c:G.green,sub:"Auto + approved"},
          {label:"Awaiting Approval",v:fixes.filter(f=>f.status==="needs-approval").length,c:G.yellow,sub:"High-risk"},
          {label:"Pending Auto-Fix",v:fixes.filter(f=>f.status==="pending").length,c:G.blue,sub:"Low-risk, queued"},
          {label:"Time Saved",v:"2.1h",c:G.purple,sub:"Est. developer hours"},
        ].map(m=>(
          <Card key={m.label}><div style={{padding:"14px"}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:5}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:m.c,lineHeight:1,marginBottom:2}}>{m.v}</div>
            <div style={{fontSize:10,color:G.textMut}}>{m.sub}</div>
          </div></Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:G.text,marginBottom:8}}>Fix Queue</div>
          {fixes.map(f=><FixCard key={f.id} fix={f} onApprove={approve} onReject={reject}/>)}
        </div>

        <div>
          <Card style={{marginBottom:10}}>
            <CardHeader title="Auto-Fix History" icon="📋"/>
            {FIX_HISTORY.map((h,i)=>(
              <div key={i} style={{padding:"8px 12px",borderBottom:i<FIX_HISTORY.length-1?`1px solid ${G.border}`:"none"}}>
                <div style={{fontSize:11,fontWeight:500,color:G.text,marginBottom:2}}>{h.fix}</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:9,color:G.textMut}}>{h.repo}</span>
                  <span style={{fontSize:9,color:G.textMut}}>{h.time}</span>
                  <span style={{fontSize:9,color:G.green,fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>saved {h.saved}</span>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <CardHeader title="Approval Policies" icon="🔒"/>
            <div style={{padding:"10px 14px"}}>
              {[
                {label:"Low-risk (<30 risk score)",policy:"Auto-apply",color:G.green},
                {label:"Medium-risk (30-70)",policy:"Approve required",color:G.yellow},
                {label:"High-risk (>70)",policy:"Escalate to lead",color:G.red},
                {label:"Production deploys",policy:"Always manual",color:G.red},
                {label:"DB migrations",policy:"DBA review",color:G.orange},
              ].map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<4?`1px solid ${G.border}`:"none"}}>
                  <span style={{fontSize:11,color:G.textSec,flex:1}}>{p.label}</span>
                  <Tag color={p.color} small>{p.policy}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 5: Impact & Insights
// ═══════════════════════════════════════════════════════════════════════════════
function ImpactPage(){
  const devData=[
    {dev:"Rahul K",   issues:14,reviews:42,avgTime:"2.4d",flaky:47,severity:"high",  color:"#6366f1"},
    {dev:"Tim David", issues:11,reviews:35,avgTime:"3.1d",flaky:22,severity:"high",  color:"#fbbf24"},
    {dev:"Courtney H",issues:8, reviews:38,avgTime:"1.8d",flaky:18,severity:"medium",color:"#22d3ee"},
    {dev:"Olivia M",  issues:6, reviews:51,avgTime:"0.9d",flaky:9, severity:"low",   color:"#a78bfa"},
    {dev:"Jonas S",   issues:4, reviews:29,avgTime:"1.2d",flaky:5, severity:"low",   color:"#3ecf8e"},
  ];
  const severityColor={high:G.red,medium:G.yellow,low:G.green};

  // SVG node positions — all within viewBox 0 0 500 340
  const nodes=[
    {name:"FAIL",    x:250,y:170,r:22,color:G.red,   isFail:true},
    {name:"Auth",    x:250,y: 55,r:30,color:G.red,   sev:"high"},
    {name:"Payments",x:420,y:220,r:28,color:G.yellow,sev:"medium"},
    {name:"Dashboard",x:80,y:220,r:26,color:G.green, sev:"low"},
    {name:"Notifs",  x:130,y: 70,r:24,color:G.teal,  sev:"low"},
  ];
  const edges=[
    [0,1],[0,2],[0,3],[0,4],[1,2],[3,4],
  ];

  return <div style={{padding:"0 0 32px"}}>
    <Bread path={["NexusCI","Impact & Insights"]}/>
    <div style={{padding:"14px 18px"}}>

      {/* ── Row 1: stat strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[
          {label:"Services Impacted",v:4,   c:G.red,    sub:"If failure reaches prod"},
          {label:"Estimated Downtime",v:"8m",c:G.orange, sub:"Auth path critical"},
          {label:"Top Blame Author",  v:"Rahul K",c:G.purple,sub:"28% of failures"},
          {label:"Auto-Resolved",     v:"57%",c:G.green, sub:"No human touch needed"},
        ].map(m=>(
          <Card key={m.label}><div style={{padding:"14px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-10,right:-10,width:48,height:48,borderRadius:"50%",background:m.c,opacity:.07}}/>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:5}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:m.c,lineHeight:1,marginBottom:3}}>{m.v}</div>
            <div style={{fontSize:10,color:G.textMut}}>{m.sub}</div>
          </div></Card>
        ))}
      </div>

      {/* ── Row 2: Blast Radius + Root Cause side-by-side ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>

        {/* Blast Radius */}
        <Card>
          <CardHeader title="Blast Radius Estimator" icon="💣"
            sub="If nexus-backend/build reaches prod"
            right={<Tag color={G.red}>HIGH</Tag>}/>
          <div style={{display:"flex",gap:0,alignItems:"stretch"}}>
            {/* SVG graph — fluid width */}
            <div style={{flex:"1 1 0",minWidth:0,padding:"12px 8px 12px 12px"}}>
              <svg width="100%" viewBox="0 0 500 340" style={{display:"block"}}>
                <defs>
                  <radialGradient id="blastGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={G.red} stopOpacity=".3"/>
                    <stop offset="100%" stopColor={G.red} stopOpacity=".03"/>
                  </radialGradient>
                </defs>
                {/* concentric rings */}
                {[60,110,160,200].map(r=>(
                  <circle key={r} cx="250" cy="170" r={r} fill="none"
                    stroke={G.border} strokeWidth=".8" strokeDasharray="5 4"/>
                ))}
                <circle cx="250" cy="170" r="130" fill="url(#blastGrad)"/>
                {/* edges */}
                {edges.map(([a,b],i)=>{
                  const na=nodes[a],nb=nodes[b];
                  const c=na.isFail?na.color:nb.isFail?nb.color:G.border2;
                  return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                    stroke={c} strokeWidth={na.isFail||nb.isFail?"1.2":".7"} opacity={na.isFail||nb.isFail?".5":".3"}/>;
                })}
                {/* nodes */}
                {nodes.map(n=>(
                  <g key={n.name}>
                    <circle cx={n.x} cy={n.y} r={n.r+4} fill={n.color} opacity=".08"/>
                    <circle cx={n.x} cy={n.y} r={n.r} fill={n.color+"22"} stroke={n.color} strokeWidth="1.8"/>
                    <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="central"
                      fill={n.color} fontSize={n.isFail?10:9} fontWeight="700"
                      fontFamily="'JetBrains Mono',monospace">{n.name}</text>
                    {n.sev&&<text x={n.x} y={n.y+n.r+11} textAnchor="middle"
                      fill={n.color} fontSize="8" opacity=".7">{n.sev}</text>}
                  </g>
                ))}
              </svg>
            </div>
            {/* Impact bars */}
            <div style={{width:160,flexShrink:0,padding:"14px 14px 14px 0",display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:12}}>Estimated Impact</div>
              {[
                {label:"Broken Payments",pct:34,c:G.red},
                {label:"Slow Dashboard", pct:24,c:G.orange},
                {label:"Auth failures",  pct:18,c:G.yellow},
                {label:"Notif delay",    pct:12,c:G.blue},
              ].map(m=>(
                <div key={m.label} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:10,color:G.textSec}}>{m.label}</span>
                    <span style={{fontSize:11,fontWeight:700,color:m.c,fontFamily:"'JetBrains Mono',monospace"}}>{m.pct}%</span>
                  </div>
                  <MiniBar value={m.pct} color={m.c} height={5}/>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Root Cause Analysis */}
        <Card>
          <CardHeader title="Root Cause Analysis" icon="🎯" sub="Blame commits — last 30 days"/>
          <div style={{padding:"16px 18px"}}>
            {/* Donut */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:16,height:180}}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={BLAME_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                    {BLAME_DATA.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v=>`${v}%`}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend with bars */}
            <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:10}}>By Developer</div>
            {BLAME_DATA.map(b=>(
              <div key={b.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                <span style={{fontSize:11,color:G.textSec,width:52,flexShrink:0}}>{b.name}</span>
                <MiniBar value={b.value} color={b.color} height={5}/>
                <span style={{fontSize:11,fontWeight:700,color:b.color,fontFamily:"'JetBrains Mono',monospace",width:32,textAlign:"right"}}>{b.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 3: Developer Performance ── */}
      <Card style={{marginBottom:12}}>
        <CardHeader title="Developer Performance Insights" icon="📊"
          sub="30-day window · flaky test attribution"/>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${G.border}`,background:G.bgCard2}}>
              {["Developer","Failure Issues","Code Reviews","Avg Resolution","Flaky Tests","Risk Level"].map(h=>(
                <th key={h} style={{padding:"9px 14px",fontSize:9,fontWeight:700,letterSpacing:".08em",
                  textTransform:"uppercase",color:G.textMut,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devData.map((d,i)=>(
              <tr key={i} style={{borderBottom:i<devData.length-1?`1px solid ${G.border}`:"none",
                background:i%2===0?"transparent":G.bgCard2+"66"}}>
                <td style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Avatar initials={d.dev.split(" ").map(w=>w[0]).join("")} color={d.color} size={28}/>
                    <span style={{fontSize:12,fontWeight:500,color:G.text}}>{d.dev}</span>
                  </div>
                </td>
                <td style={{padding:"12px 14px"}}>
                  <span style={{fontSize:14,fontWeight:700,color:G.red,fontFamily:"'JetBrains Mono',monospace"}}>{d.issues}</span>
                </td>
                <td style={{padding:"12px 14px"}}>
                  <span style={{fontSize:14,fontWeight:700,color:G.blue,fontFamily:"'JetBrains Mono',monospace"}}>{d.reviews}</span>
                </td>
                <td style={{padding:"12px 14px"}}>
                  <span style={{fontSize:12,fontWeight:600,color:G.yellow,fontFamily:"'JetBrains Mono',monospace"}}>{d.avgTime}</span>
                </td>
                <td style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:d.flaky>30?G.red:G.textSec,
                      fontFamily:"'JetBrains Mono',monospace",width:28,flexShrink:0}}>{d.flaky}</span>
                    <MiniBar value={d.flaky} max={55} color={d.flaky>30?G.red:d.flaky>15?G.orange:G.textMut} height={5}/>
                  </div>
                </td>
                <td style={{padding:"12px 14px"}}>
                  <Tag color={severityColor[d.severity]}>{d.severity.toUpperCase()}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── Row 4: Failure prediction chart + Module health grid ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
        <Card>
          <CardHeader title="Failure Prediction Accuracy — Past 30 Days" icon="📈"
            right={<Tag color={G.green}>88% accurate this week</Tag>}/>
          <div style={{padding:"10px 8px 14px"}}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={METRICS} margin={{top:5,right:10,bottom:0,left:-18}}>
                <XAxis dataKey="h" tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="failed" name="Failures" fill={G.red}   opacity={.55} radius={[2,2,0,0]}/>
                <Bar dataKey="fixed"  name="AI Fixed" fill={G.green} opacity={.55} radius={[2,2,0,0]}/>
                <Line type="monotone" dataKey="passed" name="Passed" stroke={G.blue} strokeWidth={2} dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Module Health" icon="🏥" sub="Real-time SLO tracking"/>
          <div style={{padding:"14px 16px 18px"}}>
            {MODULE_HEALTH.map(m=>(
              <div key={m.module} style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:G.text,fontWeight:500}}>{m.module}</span>
                  <span style={{fontSize:12,fontWeight:700,color:m.color,fontFamily:"'JetBrains Mono',monospace"}}>{m.health}%</span>
                </div>
                <MiniBar value={m.health} color={m.color} height={6}/>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 6: Learning System
// ═══════════════════════════════════════════════════════════════════════════════
function LearningPage(){
  const decayData=[
    {age:"Today",conf:96,fixes:22},{age:"3d",conf:89,fixes:18},{age:"1w",conf:78,fixes:14},
    {age:"2w",conf:64,fixes:9},{age:"1mo",conf:42,fixes:5},{age:"3mo",conf:18,fixes:2},
  ];
  const embeddingDots=[
    {x:60,y:60,label:"pd.concat fix",cluster:"python",color:G.green},
    {x:80,y:80,label:"DataFrame.append",cluster:"python",color:G.green},
    {x:70,y:45,label:"pandas 2.0 API",cluster:"python",color:G.green},
    {x:180,y:70,label:"jsonwebtoken bump",cluster:"node",color:G.blue},
    {x:200,y:55,label:"peer dep conflict",cluster:"node",color:G.blue},
    {x:165,y:88,label:"npm lockfile",cluster:"node",color:G.blue},
    {x:120,y:150,label:"DB migration null",cluster:"db",color:G.orange},
    {x:145,y:165,label:"NOT NULL default",cluster:"db",color:G.orange},
    {x:108,y:168,label:"schema mismatch",cluster:"db",color:G.orange},
    {x:240,y:140,label:"ECONNRESET",cluster:"network",color:G.yellow},
    {x:260,y:158,label:"flaky timeout",cluster:"network",color:G.yellow},
  ];

  return <div style={{padding:"0 0 24px"}}>
    <Bread path={["NexusCI","Learning System"]}/>
    <div style={{padding:"14px 18px"}}>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[
          {label:"Patterns in Memory",v:52,c:G.purple,sub:"Weaviate vector store"},
          {label:"Auto Fixes Applied",v:132,c:G.green,sub:"All time"},
          {label:"Avg Confidence",v:"84%",c:G.blue,sub:"Across all patterns"},
          {label:"New Patterns (7d)",v:4,c:G.orange,sub:"Learned this week"},
        ].map(m=>(
          <Card key={m.label}><div style={{padding:"14px"}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:G.textMut,marginBottom:5}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:m.c,lineHeight:1,marginBottom:2}}>{m.v}</div>
            <div style={{fontSize:10,color:G.textMut}}>{m.sub}</div>
          </div></Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {/* AI Fix Memory */}
        <Card>
          <CardHeader title="AI Fix Memory (RAG)" icon="🧠" sub="Top patterns by confidence"/>
          <div style={{padding:"10px 14px"}}>
            {AI_FIX_MEMORY.map((m,i)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:500,color:G.text,flex:1}}>{m.pattern}</span>
                  <span style={{fontSize:11,fontWeight:700,color:m.color,fontFamily:"'JetBrains Mono',monospace"}}>{m.confidence}%</span>
                  <Tag color={G.textMut} small>{m.fixes} fixes</Tag>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <MiniBar value={m.confidence} color={m.color}/>
                </div>
              </div>
            ))}
            <div style={{padding:"10px 0 0",borderTop:`1px solid ${G.border}`,display:"flex",gap:8,justifyContent:"center"}}>
              <RingChart value={89} label="Avg fix success rate" sub="past 30d" color={G.green} size={80}/>
              <RingChart value={4} max={7} label="New patterns/week" sub="learning rate" color={G.purple} size={80}/>
            </div>
          </div>
        </Card>

        {/* Embedding clusters */}
        <Card>
          <CardHeader title="Fix Embedding Space" icon="🔮" sub="Similar fixes cluster together in vector space"/>
          <div style={{padding:"10px 14px"}}>
            <svg width="100%" height="230" viewBox="0 0 310 230">
              {[{x:70,y:65,r:55,label:"Python",color:G.green},{x:185,y:70,r:50,label:"Node.js",color:G.blue},{x:130,y:158,r:42,label:"Database",color:G.orange},{x:253,y:150,r:40,label:"Network",color:G.yellow}].map(c=>(
                <g key={c.label}>
                  <circle cx={c.x} cy={c.y} r={c.r} fill={c.color+"08"} stroke={c.color+"30"} strokeWidth="1" strokeDasharray="4 4"/>
                  <text x={c.x} y={c.y-c.r+10} textAnchor="middle" fill={c.color} fontSize="9" fontWeight="700">{c.label}</text>
                </g>
              ))}
              {embeddingDots.map((d,i)=>(
                <g key={i}>
                  <circle cx={d.x} cy={d.y} r="4" fill={d.color} opacity=".85"/>
                  <text x={d.x+6} y={d.y+4} fill={G.textMut} fontSize="8">{d.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </Card>
      </div>

      {/* Confidence decay */}
      <Card>
        <CardHeader title="Fix Confidence Decay — Temporal Reliability" icon="⏳" sub="Older fixes lose confidence as codebases evolve" right={<Tag color={G.orange}>RAG cache invalidation</Tag>}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:16,padding:"12px 16px 18px",alignItems:"center"}}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={decayData} margin={{top:5,right:10,bottom:0,left:-18}}>
              <XAxis dataKey="age" tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:G.textMut,fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="conf" name="Confidence" stroke={G.orange} strokeWidth={2.5} dot={{fill:G.orange,r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {decayData.map(d=>{
              const c=d.conf>=80?G.green:d.conf>=60?G.yellow:d.conf>=40?G.orange:G.red;
              return <div key={d.age} style={{background:G.bgCard2,border:`1px solid ${c}30`,borderRadius:3,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:G.textMut,marginBottom:2}}>{d.age}</div>
                <div style={{fontSize:14,fontWeight:700,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{d.conf}%</div>
              </div>;
            })}
          </div>
        </div>
      </Card>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root App
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [page,setPage]            = useState("live");
  const [collapsed,setCollapsed]  = useState(false);
  const [pipelines,setPipelines]  = useState(PIPELINES);
  const [diagData,setDiagData]    = useState(DIAG);
  const [selectedId,setSelectedId]= useState("p1");
  const [fixedIds,setFixedIds]    = useState(new Set());
  const [stats,setStats]          = useState({total:142,failed:7,fixed:4,pending:3,approval:2});

  const handleFix=useCallback((id)=>{
    setFixedIds(p=>new Set([...p,id]));
    setPipelines(p=>p.map(r=>r.id===id?{...r,status:"fixed",aiTag:"auto-resolved",risk:null}:r));
    setStats(p=>({...p,failed:Math.max(0,p.failed-1),fixed:p.fixed+1}));
  },[]);

  const handleSimulate=useCallback(()=>{
    const S=[{name:"nexus-payments",job:"charge-api",branch:"feat/stripe-v3",author:"Tim David",initials:"TD",aColor:G.yellow},{name:"search-service",job:"index-job",branch:"fix/query-timeout",author:"Jonas Smith",initials:"JS",aColor:G.green}];
    const s=S[Math.floor(Math.random()*S.length)]; const id="sim_"+Date.now();
    setPipelines(p=>[{id,name:s.name,job:s.job,branch:s.branch,author:s.author,initials:s.initials,aColor:s.aColor,status:"failed",dur:"--",ago:"just now",aiTag:"dep error",risk:"low",hash:Math.random().toString(16).slice(2,9),msg:"feat: new changes",files:2,lines:45,riskScore:Math.floor(Math.random()*80)+10},...p]);
    setDiagData(p=>({...p,[id]:DIAG["p1"]})); setSelectedId(id);
    setStats(p=>({...p,failed:p.failed+1,total:p.total+1}));
  },[]);

  const navW=collapsed?48:200;

  const renderPage=()=>{
    switch(page){
      case "risk":    return <PredictiveRiskPage/>;
      case "live":    return <LivePipelinePage pipelines={pipelines} stats={stats} selectedId={selectedId} onSelect={setSelectedId} onFix={handleFix} fixedIds={fixedIds}/>;
      case "debugger":return <AIDebuggerPage pipelines={pipelines} diagData={diagData} selectedId={selectedId} onSelect={setSelectedId} onFix={handleFix} fixedIds={fixedIds}/>;
      case "fixes":   return <AutoFixPage/>;
      case "impact":  return <ImpactPage/>;
      case "memory":  return <LearningPage/>;
      default:        return <LivePipelinePage pipelines={pipelines} stats={stats} selectedId={selectedId} onSelect={setSelectedId} onFix={handleFix} fixedIds={fixedIds}/>;
    }
  };

  return <>
    <style>{CSS}</style>
    <TopNav onSimulate={handleSimulate}/>
    <div style={{display:"flex",height:"calc(100vh - 42px)",marginTop:42,overflow:"hidden"}}>
      <LeftNav active={page} onNav={setPage} collapsed={collapsed}/>

      {/* Collapse toggle */}
      <button onClick={()=>setCollapsed(c=>!c)} style={{
        position:"fixed",top:52,left:navW-10,width:20,height:20,
        background:G.bgCard2,border:`1px solid ${G.border2}`,borderRadius:"50%",
        cursor:"pointer",color:G.textSec,fontSize:11,display:"flex",
        alignItems:"center",justifyContent:"center",zIndex:95,transition:"left .2s"
      }}>{collapsed?"›":"‹"}</button>

      {/* Main scrollable content */}
      <main style={{
        flex:1,overflowY:"auto",overflowX:"hidden",
        transition:"margin-left .2s",minWidth:0,height:"100%"
      }}>
        {renderPage()}
      </main>
    </div>
  </>;
}