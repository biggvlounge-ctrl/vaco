import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Bell, MessageCircle, Compass, Wallet as WalletIcon, Coins,
  ShoppingBag, TrendingUp, Zap, Clock, User, Shield, DollarSign, Scale,
  Heart, Navigation, Megaphone, Sparkles, Music, Share2, Video, Phone,
  PhoneOff, Mic, MicOff, Send, X, Tv, Car, Grid3x3,
  Network, Settings, ArrowLeft, MapPin, CheckCircle2, Circle,
  Package, Ticket, Activity, ChevronRight, Eye, EyeOff
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Design tokens (V4_CLAUDE.md §6) — reconciled to one styling system  */
/* (Tailwind throughout, per the §7 gap) and one shared frame width    */
/* (430px, matching the reconciliation the brief flagged as needed).   */
/* ------------------------------------------------------------------ */
const BG_OUTER = "#14141A";
const BG_CC = "#0A0E17";
const CARD_OUTER = "#1E1E27";
const CARD_CC = "#121826";
const BORDER_OUTER = "#2C2C38";
const BORDER_CC = "#1F2937";
const ACCENT = "#5B5FEF";
const ACCENT_LIGHT = "#8B8FFF";
const TIER_COLOR = { business: "#E8927C", user: "#A78BFA", vulture: "#7DD3E8", orchestrator: "#8B8FFF" };
const TIER_LABEL = { business: "Business Executive", user: "User-Facing", vulture: "Vvltvre Media", orchestrator: "Executive AI Director" };

/* ------------------------------------------------------------------ */
/* Agent roster — VACON → MIA → agents (V4_EXECUTIVE_AGENT_ARCHITECTURE)*/
/* ------------------------------------------------------------------ */
const AGENTS = [
  { id: "qvan", name: "QVAN", role: "Chief Security Officer", tier: "business", app: "Internal", Icon: Shield,
    systemPrompt: "You are QVAN, Chief Security Officer inside VACON, the operating network of the VACO ecosystem. You handle cybersecurity, fraud detection, identity protection, disaster recovery, zero-trust security, and platform monitoring. You are heard through V4's interface. Speak like a sharp, no-nonsense security exec: precise, calm under pressure, allergic to vague answers. Keep replies tight — 2-4 sentences unless asked for depth. Reference security tooling (Rubrik, Cohesity, Zerto, CrowdStrike-class defenses) only when it's actually relevant, never as name-dropping." },
  { id: "leslie", name: "Leslie", role: "Chief Financial Officer", tier: "business", app: "V3", Icon: DollarSign,
    systemPrompt: "You are Leslie, Chief Financial Officer inside VACON. You handle financial forecasting, budgeting, treasury, banking operations, the VCoin economy, and financial compliance, working directly against the V3 ledger. Speak like a measured, detail-oriented CFO — grounded in numbers, careful with claims, never hypey. Keep replies concise and concrete. If a user asks for something you'd need real account data for, say so plainly rather than inventing figures." },
  { id: "deskins", name: "Deskins", role: "Chief Legal & Compliance Officer", tier: "business", app: "Internal", Icon: Scale,
    systemPrompt: "You are Deskins, Chief Legal & Compliance Officer inside VACON. You handle contract review, gambling compliance, privacy law, Terms of Service, IP, and regulatory monitoring across the ecosystem. Speak like a precise, dry-witted general counsel: careful with language, quick to flag risk, never gives real legal advice without the caveat that you're not a substitute for a licensed attorney for binding matters. Keep replies short and structured." },
  { id: "kevin", name: "Kevin", role: "Dating Executive", tier: "user", app: "Convo", Icon: Heart,
    systemPrompt: "You are Kevin, the dating executive inside VACON, representing Convo (CVNVO). You help with profile advice, conversation openers, date planning, and reading the proximity/crossing-paths features Convo surfaces through V4's shared map layer. Speak warm, a little playful, genuinely invested in helping people connect — never sleazy, never generic pickup-artist energy. Keep replies short and human." },
  { id: "kay", name: "Kay", role: "Travel Executive", tier: "user", app: "VACAY", Icon: Compass,
    systemPrompt: "You are Kay, the travel executive inside VACON, representing VACAY. You help with stay and Experience search (Airbnb-style local-hosted tours and workshops), itinerary building, and location discovery through V4's shared map layer. Speak like an well-traveled friend with great taste and zero patience for tourist traps. Keep replies vivid but short." },
  { id: "gibson", name: "Gibson", role: "Routing & Navigation", tier: "user", app: "VOID", Icon: Navigation,
    systemPrompt: "You are Gibson, the routing and navigation executive inside VACON, representing VOID. You handle dispatch, live routing, and delivery/ride coordination, all built on V4's shared map layer. Speak like a sharp dispatcher: fast, efficient, spatially precise, calm in traffic-jam-of-words moments. Keep replies short and action-oriented." },
  { id: "drea", name: "DREA", role: "Ad Intelligence", tier: "user", app: "DREAMS", Icon: Megaphone,
    systemPrompt: "You are DREA, the ad intelligence executive inside VACON, representing DREAMS — the ad/screen network. You handle screen location targeting and traffic-based dynamic pricing, using real foot-traffic data through V4's shared map layer. Speak like a data-sharp media strategist: confident, numbers-forward, a little sales-savvy but honest about tradeoffs. Keep replies short." },
  // Added to close real drift against VACON's registry: Anderson and
  // Stephanie were added to `vacon/lib/agents.js` after this prototype
  // was written, so V4's Command Center listed 10 of VACON's 12
  // domain agents and these two were unreachable from this interface
  // even though VACON could invoke them. Prompts copied verbatim from
  // VACON, which remains the authority -- this array stays display-only.
  { id: "anderson", name: "Anderson", role: "Live Events Executive", tier: "user", app: "VOID MAGIC", Icon: Ticket,
    systemPrompt: "You are Anderson, the live events executive inside VACON, representing VOID MAGIC — event ticketing, meet & greet booking, the digital waiting room check-in flow, and creator/fan interactions, operationally powered by VOID's own transportation and security infrastructure and commercially part of Vvltvre Touring & Tix. Speak like a warm, sharp event host: genuinely glad to see the fan, precise about logistics and timing, never oversells an experience. Keep replies short and specific." },
  { id: "stephanie", name: "Stephanie", role: "Market Research Executive", tier: "business", app: "Vex Business", Icon: TrendingUp,
    systemPrompt: "You are Stephanie, the market research executive inside VACON, representing Vex Business — the internal, management-facing identity of CALL, the autonomous futures-trading research platform. You track real comparable and competing products in the quant/algorithmic trading research market (platforms like QuantConnect's LEAN engine, TrendSpider, Trade Ideas, open-source backtesters such as Backtrader/Zipline-reloaded/vectorbt, and ES-specific signal-alert tools like AbleTrend and Power E-mini) and report genuine findings, not fabricated ones — if you don't have a real, sourced answer, say so plainly rather than guessing. Speak like a sharp, well-read competitive-intelligence analyst: precise, comparison-driven, always naming your source. Keep replies short and concrete. This is an internal management tool for now, not a customer-facing feature." },
  { id: "ava", name: "Ava", role: "Discovery", tier: "vulture", app: "Vvltvre", Icon: Sparkles,
    systemPrompt: "You are Ava, the discovery executive inside VACON, representing Vvltvre Media. You help people find new music, artists, and content matched to their taste. Speak like a tastemaker friend — enthusiastic, specific, never generic 'you might like' filler. Keep replies short and full of real texture." },
  { id: "autumn", name: "Autumn", role: "Creator Tools", tier: "vulture", app: "Vvltvre", Icon: Music,
    systemPrompt: "You are Autumn, the creator-tools executive inside VACON, representing Vvltvre Media. You help creators with production advice, release strategy, and using Vvltvre's tools. Speak like a supportive, technically sharp studio collaborator. Keep replies short, practical, and encouraging without being saccharine." },
  { id: "jacobi", name: "Jacobi", role: "Distribution", tier: "vulture", app: "Vvltvre", Icon: Share2,
    systemPrompt: "You are Jacobi, the distribution executive inside VACON, representing Vvltvre Media. You help with release planning, playlist strategy, and getting content in front of the right audience across platforms. Speak like a plugged-in, straight-talking distribution strategist. Keep replies short and concrete." },
];

const AGENT_BY_TIER = { business: AGENTS.filter(a => a.tier === "business"),
  user: AGENTS.filter(a => a.tier === "user"), vulture: AGENTS.filter(a => a.tier === "vulture") };

/* ------------------------------------------------------------------ */
/* Real sync from VACON's own live agent registry (GET /api/agents) —  */
/* closes this file's own previously-flagged gap: the roster above was */
/* pure hardcoded display data, never actually read from VACON's real  */
/* API even though the invoke call already did. This mutates the       */
/* existing AGENTS entries IN PLACE (same array reference every        */
/* consumer below already holds) so name/role/app/systemPrompt track   */
/* VACON's own registry as the real source of truth; only Icon (a UI   */
/* concept VACON's backend has no reason to own) stays sourced locally.*/
/* VACON's registry also has a real "orchestrator"-tier agent (MIA)    */
/* this local roster never listed at all -- synced into `AGENTS` too,  */
/* and `TIER_COLOR`/`TIER_LABEL` both gained a real `orchestrator`     */
/* entry so she renders correctly wherever `AGENTS` is mapped directly */
/* (the Agents-grid tab). `Orchestration`'s own MIA box (below) is now */
/* a real, tappable `AgentAvatar`-equivalent sourced from `AGENTS`     */
/* once she's synced in, not a decorative static box with no real      */
/* identity behind it -- see that function's own comment.              */
/* ------------------------------------------------------------------ */
async function syncAgentRosterFromVacon() {
  const res = await fetch("/api/agents");
  if (!res.ok) throw new Error(`GET /api/agents failed (${res.status})`);
  const { agents: liveAgents } = await res.json();
  for (const live of liveAgents) {
    const existing = AGENTS.find((a) => a.id === live.id);
    if (existing) {
      existing.name = live.name;
      existing.role = live.role;
      existing.app = live.app;
      existing.systemPrompt = live.systemPrompt;
      // tier deliberately NOT overwritten for a known agent -- it
      // drives which local Icon/TIER_COLOR bucket this entry renders
      // in, a UI concern VACON's own registry has no opinion on.
    } else {
      AGENTS.push({ ...live, Icon: Network });
    }
  }
  AGENT_BY_TIER.business = AGENTS.filter((a) => a.tier === "business");
  AGENT_BY_TIER.user = AGENTS.filter((a) => a.tier === "user");
  AGENT_BY_TIER.vulture = AGENTS.filter((a) => a.tier === "vulture");
  return liveAgents.length;
}

/* ------------------------------------------------------------------ */
/* Real, working Claude API call — routed through the backend proxy    */
/* (v4-proxy/server.js), which holds the key server-side. This closes  */
/* V4_CLAUDE.md §7 gap 0 — the frontend never touches api.anthropic.com*/
/* directly and never sees a key.                                      */
/*                                                                      */
/* Routed through VACON (../vacon/), not v4-proxy directly, now that   */
/* VACON exists as the real operating network this file's own comment  */
/* above (and the Command Center screens below) already named: VACON   */
/* owns the agent's real identity/systemPrompt in its own registry,    */
/* V4 (v4-proxy) stays exactly what it already was — the interface     */
/* layer holding the Anthropic key. This local AGENTS array is now     */
/* display-only (icons, tier grouping for the screens below); the      */
/* systemPrompt VACON actually calls with lives in vacon/lib/agents.js */
/* (copied from here verbatim when VACON was built, so the two match   */
/* today, but VACON's copy — not this one — is the one a real call     */
/* uses). Swap VACON_ENDPOINT below if VACON is deployed somewhere     */
/* other than the same origin. Not runnable in this session (this file */
/* has no package.json/build of its own — it's reference material, per */
/* its own original header), so unlike everything else built this      */
/* session this specific edit is unverified in a live browser.         */
/* ------------------------------------------------------------------ */
const VACON_ENDPOINT = (agentId) => `/api/agents/${agentId}/invoke`;

async function callAgent(agent, history) {
  try {
    const response = await fetch(VACON_ENDPOINT(agent.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return `${agent.name}: ${data?.error || "couldn't process that."}`;
    }
    return data?.text || "…I didn't catch that. Could you say it again?";
  } catch (err) {
    return `${agent.name} can't reach VACON right now — is it running?`;
  }
}

/* ------------------------------------------------------------------ */
/* Real, working cross-ecosystem search — routed through v4-search     */
/* (v4-search/server.js), the canonical search layer for HVNTZ, VACAY, */
/* VENVS, Vvltvre, VOKEN, and VACON-C. Same proxy pattern as the agent  */
/* endpoint above: relative path, swap SEARCH_ENDPOINT if v4-search is  */
/* deployed somewhere other than the same origin.                      */
/* ------------------------------------------------------------------ */
const SEARCH_ENDPOINT = "/api/search";
const SEARCH_APPS = ["HVNTZ", "VACAY", "VENVS", "Vvltvre", "VOKEN", "VACON-C"];

async function searchEcosystem(query) {
  const response = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Search request failed.");
  }
  return data.results || [];
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */
function ScreenHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER_OUTER }}>
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full active:opacity-60">
            <ArrowLeft size={20} color="#EDEDF2" />
          </button>
        )}
        <h1 className="text-[17px] font-semibold text-[#EDEDF2]">{title}</h1>
      </div>
      {right}
    </div>
  );
}

function Pill({ children, color }) {
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      {children}
    </span>
  );
}

/* ==================================================================== */
/* LOGIN                                                                 */
/* ==================================================================== */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="flex flex-col h-full px-6 pt-20 pb-8" style={{ backgroundColor: BG_OUTER }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 30% 30%, ${ACCENT_LIGHT}, ${ACCENT} 70%)`, boxShadow: `0 0 40px ${ACCENT}55` }}
        >
          <Network size={34} color="#fff" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#EDEDF2] tracking-tight">V4</h1>
          <p className="text-sm text-[#8B8B99] mt-1">Your ecosystem, one command center.</p>
        </div>

        <div className="w-full flex flex-col gap-3 mt-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl px-4 py-3 text-sm text-[#EDEDF2] outline-none placeholder:text-[#5A5A66]"
            style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}
          />
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              className="w-full rounded-xl px-4 py-3 text-sm text-[#EDEDF2] outline-none placeholder:text-[#5A5A66]"
              style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}
            />
            <button onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A66]">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          onClick={onLogin}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white active:opacity-80"
          style={{ backgroundColor: ACCENT }}
        >
          Sign in
        </button>
        <p className="text-[11px] text-[#5A5A66] text-center -mt-2">Prototype login — any email and password works.</p>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* HOME                                                                  */
/* ==================================================================== */
const EXPLORE_ITEMS = [
  { id: "predictions", label: "Predictions", Icon: TrendingUp, color: "#8B8FFF" },
  { id: "wallet", label: "Wallet", Icon: WalletIcon, color: "#E8927C" },
  { id: "voken", label: "VOKEN", Icon: Coins, color: "#7DD3E8" },
  { id: "marketplace", label: "Marketplace", Icon: ShoppingBag, color: "#A78BFA" },
  { id: "automation", label: "Automation", Icon: Zap, color: "#F2C94C" },
  { id: "timeline", label: "Timeline", Icon: Clock, color: "#6FCF97" },
];

const RECENT_ACTIVITY = [
  { id: 1, text: "Gibson rerouted your VOID delivery around traffic on I-70", time: "12m ago" },
  { id: 2, text: "Kay found 3 new VACAY Experiences near your saved trip", time: "1h ago" },
  { id: 3, text: "Leslie flagged a VCoin balance milestone", time: "3h ago" },
  { id: 4, text: "New crossing-paths match surfaced by Kevin", time: "Yesterday" },
];

function Home({ go }) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: BG_OUTER }}>
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-[#8B8B99]">Good to see you</p>
          <h1 className="text-xl font-bold text-[#EDEDF2]">Home</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go("notifications")} className="p-2 rounded-full" style={{ backgroundColor: CARD_OUTER }}>
            <Bell size={17} color="#EDEDF2" />
          </button>
          <button onClick={() => go("profile")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <User size={16} color="#fff" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-2">
        <button
          onClick={() => go("ecosystemSearch")}
          className="w-full flex items-center gap-2 rounded-xl px-4 py-3 text-left"
          style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}
        >
          <Search size={16} color="#5A5A66" />
          <span className="text-sm text-[#5A5A66]">Search hunts, stays, products, music…</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 flex flex-col gap-5">
        {/* Command Center card */}
        <button
          onClick={() => go("command")}
          className="w-full rounded-2xl p-4 text-left relative overflow-hidden active:opacity-90"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #2D2FA8)` }}
        >
          <Network size={64} color="#ffffff22" className="absolute -right-2 -bottom-2" />
          <p className="text-[11px] text-white/70 font-medium">Agent Command Center</p>
          <p className="text-white font-bold text-lg mt-0.5">Talk to VACON</p>
          <p className="text-white/80 text-xs mt-1">10 executives, one interface.</p>
        </button>

        {/* Rows */}
        <button onClick={() => go("search")} className="w-full flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
          <div className="flex items-center gap-3">
            <MapPin size={16} color={ACCENT_LIGHT} />
            <span className="text-sm text-[#EDEDF2]">Nearby Businesses</span>
          </div>
          <ChevronRight size={16} color="#5A5A66" />
        </button>
        <button onClick={() => go("messages")} className="w-full flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
          <div className="flex items-center gap-3">
            <MessageCircle size={16} color={ACCENT_LIGHT} />
            <span className="text-sm text-[#EDEDF2]">Messages</span>
          </div>
          <ChevronRight size={16} color="#5A5A66" />
        </button>
        <button onClick={() => go("hunts")} className="w-full flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
          <div className="flex items-center gap-3">
            <Ticket size={16} color={ACCENT_LIGHT} />
            <span className="text-sm text-[#EDEDF2]">Hunts</span>
          </div>
          <ChevronRight size={16} color="#5A5A66" />
        </button>

        {/* Explore grid */}
        <div>
          <p className="text-[13px] font-semibold text-[#8B8B99] mb-2 px-0.5">Explore</p>
          <div className="grid grid-cols-3 gap-2.5">
            {EXPLORE_ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => go(it.id)}
                className="rounded-xl py-4 flex flex-col items-center gap-1.5 active:opacity-80"
                style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}
              >
                <it.Icon size={18} color={it.color} />
                <span className="text-[11px] text-[#C7C7D1]">{it.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <p className="text-[13px] font-semibold text-[#8B8B99] mb-2 px-0.5">Recent activity</p>
          <div className="flex flex-col gap-2">
            {RECENT_ACTIVITY.map((a) => (
              <div key={a.id} className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
                <Activity size={14} color="#5A5A66" className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] text-[#C7C7D1] leading-snug">{a.text}</p>
                  <p className="text-[11px] text-[#5A5A66] mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* AGENT MODAL — ringing → call → chat  (V4_CLAUDE.md §3.4)             */
/* ==================================================================== */
function IncomingCall({ agent, onAccept, onDecline }) {
  const color = TIER_COLOR[agent.tier];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between py-16" style={{ backgroundColor: BG_CC }}>
      <div className="flex flex-col items-center gap-3 mt-8">
        <p className="text-[13px] text-[#8B8B99]">Incoming call</p>
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: color }} />
          <div className="w-28 h-28 rounded-full flex items-center justify-center relative" style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}>
            <agent.Icon size={40} color={color} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#EDEDF2] mt-2">{agent.name}</h2>
        <p className="text-sm text-[#8B8B99]">{agent.role}</p>
      </div>
      <div className="flex items-center gap-16">
        <button onClick={onDecline} className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 active:opacity-80">
          <PhoneOff size={24} color="#fff" />
        </button>
        <button onClick={onAccept} className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500 active:opacity-80">
          <Phone size={24} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function FaceTimeCall({ agent, history, setHistory, onOpenChat, onEnd }) {
  const color = TIER_COLOR[agent.tier];
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const lastMsg = history[history.length - 1];

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const send = useCallback(async () => {
    if (!draft.trim() || loading) return;
    const next = [...history, { role: "user", content: draft }];
    setHistory(next);
    setDraft("");
    setLoading(true);
    const reply = await callAgent(agent, next);
    setHistory([...next, { role: "assistant", content: reply }]);
    setLoading(false);
  }, [draft, history, loading, agent, setHistory]);

  return (
    <div className="absolute inset-0 flex flex-col justify-between py-10 px-5" style={{ backgroundColor: BG_CC }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#8B8B99]">{mm}:{ss}</span>
        <button onClick={onOpenChat} className="p-1.5 rounded-full" style={{ backgroundColor: CARD_CC }}>
          <MessageCircle size={16} color="#EDEDF2" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-pulse opacity-40" style={{ backgroundColor: color }} />
          <div className="w-32 h-32 rounded-full flex items-center justify-center relative" style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}>
            <agent.Icon size={46} color={color} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-[#EDEDF2]">{agent.name}</h2>
          <p className="text-xs text-[#8B8B99]">{loading ? "thinking…" : "on the line"}</p>
        </div>
        {lastMsg && (
          <div className="mt-2 max-w-[280px] rounded-2xl px-4 py-2.5 text-[13px] text-[#EDEDF2] leading-snug" style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}>
            {lastMsg.content}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {showInput && (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Say something to ${agent.name}…`}
              className="flex-1 rounded-full px-4 py-2.5 text-sm text-[#EDEDF2] outline-none placeholder:text-[#5A5A66]"
              style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}
            />
            <button onClick={send} disabled={loading} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
              <Send size={15} color="#fff" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setMuted((m) => !m)} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: muted ? "#EF4444" : CARD_CC }}>
            {muted ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#EDEDF2" />}
          </button>
          <button onClick={() => setShowInput((s) => !s)} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: showInput ? ACCENT : CARD_CC }}>
            <MessageCircle size={18} color={showInput ? "#fff" : "#EDEDF2"} />
          </button>
          <button onClick={onEnd} className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500">
            <PhoneOff size={22} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TextChat({ agent, history, setHistory, onOpenCall, onClose }) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const color = TIER_COLOR[agent.tier];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, loading]);

  const send = useCallback(async () => {
    if (!draft.trim() || loading) return;
    const next = [...history, { role: "user", content: draft }];
    setHistory(next);
    setDraft("");
    setLoading(true);
    const reply = await callAgent(agent, next);
    setHistory([...next, { role: "assistant", content: reply }]);
    setLoading(false);
  }, [draft, history, loading, agent, setHistory]);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: BG_CC }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER_CC }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}22`, border: `1px solid ${color}` }}>
            <agent.Icon size={16} color={color} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#EDEDF2]">{agent.name}</p>
            <p className="text-[11px] text-[#8B8B99]">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onOpenCall} className="p-2 rounded-full" style={{ backgroundColor: CARD_CC }}>
            <Video size={15} color="#EDEDF2" />
          </button>
          <button onClick={onClose} className="p-2 rounded-full" style={{ backgroundColor: CARD_CC }}>
            <X size={15} color="#EDEDF2" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {history.length === 0 && (
          <p className="text-[12px] text-[#5A5A66] text-center mt-8">Say hi to {agent.name} — this is a real conversation.</p>
        )}
        {history.map((m, i) => (
          <div key={i} className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${m.role === "user" ? "self-end text-white" : "self-start text-[#EDEDF2]"}`}
            style={{ backgroundColor: m.role === "user" ? ACCENT : CARD_CC, border: m.role === "user" ? "none" : `1px solid ${BORDER_CC}` }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="self-start rounded-2xl px-3.5 py-2.5 text-[13px]" style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}>
            <span className="text-[#8B8B99]">{agent.name} is typing…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-3 border-t" style={{ borderColor: BORDER_CC }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 rounded-full px-4 py-2.5 text-sm text-[#EDEDF2] outline-none placeholder:text-[#5A5A66]"
          style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}
        />
        <button onClick={send} disabled={loading} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          <Send size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function AgentModal({ agent, onClose }) {
  const [phase, setPhase] = useState("ringing"); // ringing | call | chat
  const [history, setHistory] = useState([]);

  return (
    <div className="absolute inset-0 z-30">
      {phase === "ringing" && (
        <IncomingCall agent={agent} onAccept={() => setPhase("call")} onDecline={onClose} />
      )}
      {phase === "call" && (
        <FaceTimeCall agent={agent} history={history} setHistory={setHistory} onOpenChat={() => setPhase("chat")} onEnd={onClose} />
      )}
      {phase === "chat" && (
        <TextChat agent={agent} history={history} setHistory={setHistory} onOpenCall={() => setPhase("call")} onClose={onClose} />
      )}
    </div>
  );
}

/* ==================================================================== */
/* COMMAND CENTER — Orchestration / Grid / TV Play / CarPlay             */
/* ==================================================================== */
function AgentAvatar({ agent, onTap, size = "md" }) {
  const color = TIER_COLOR[agent.tier];
  const dim = size === "lg" ? "w-16 h-16" : "w-14 h-14";
  return (
    <button onClick={() => onTap(agent)} className="flex flex-col items-center gap-1.5 shrink-0 active:opacity-70">
      <div className={`${dim} rounded-full flex items-center justify-center`} style={{ backgroundColor: `${color}1F`, border: `1.5px solid ${color}` }}>
        <agent.Icon size={size === "lg" ? 24 : 20} color={color} />
      </div>
      <span className="text-[11px] text-[#EDEDF2] font-medium">{agent.name}</span>
    </button>
  );
}

function Orchestration({ onTapAgent }) {
  // Real, once VACON's live roster has synced (see
  // syncAgentRosterFromVacon's own header) -- MIA becomes a genuinely
  // tappable agent here, same as every executive below her, instead of
  // a decorative static box with no real identity behind it. Before
  // the sync resolves (or if VACON is unreachable), the static box
  // stays as an honest fallback -- the operating-network diagram is
  // still true even without a live MIA to tap.
  const mia = AGENTS.find((a) => a.id === "mia");
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
      {/* VACON -> MIA */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl px-6 py-3 text-center" style={{ backgroundColor: CARD_CC, border: `1px solid ${ACCENT_LIGHT}` }}>
          <p className="text-[10px] text-[#8B8B99] tracking-wide">OPERATING NETWORK</p>
          <p className="text-sm font-bold text-[#EDEDF2]">VACON</p>
        </div>
        <div className="w-px h-5" style={{ backgroundColor: BORDER_CC }} />
        {mia ? (
          <button onClick={() => onTapAgent(mia)} className="rounded-2xl px-6 py-3 text-center active:opacity-80" style={{ backgroundColor: `${ACCENT}22`, border: `1px solid ${ACCENT}` }}>
            <p className="text-[10px] text-[#B8B8FF] tracking-wide">{TIER_LABEL.orchestrator}</p>
            <p className="text-sm font-bold text-white">{mia.name}</p>
          </button>
        ) : (
          <div className="rounded-2xl px-6 py-3 text-center" style={{ backgroundColor: `${ACCENT}22`, border: `1px solid ${ACCENT}` }}>
            <p className="text-[10px] text-[#B8B8FF] tracking-wide">EXECUTIVE AI DIRECTOR</p>
            <p className="text-sm font-bold text-white">MIA</p>
          </div>
        )}
        <div className="w-px h-5" style={{ backgroundColor: BORDER_CC }} />
      </div>

      {(["business", "user", "vulture"]).map((tier) => (
        <div key={tier}>
          <div className="flex items-center gap-2 mb-2.5 px-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIER_COLOR[tier] }} />
            <p className="text-[12px] font-semibold text-[#C7C7D1]">{TIER_LABEL[tier]}</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-0.5 px-0.5">
            {AGENT_BY_TIER[tier].map((a) => (
              <AgentAvatar key={a.id} agent={a} onTap={onTapAgent} size="lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentGrid({ onTapAgent }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="grid grid-cols-2 gap-3">
        {AGENTS.map((a) => {
          const color = TIER_COLOR[a.tier];
          return (
            <button key={a.id} onClick={() => onTapAgent(a)} className="rounded-2xl p-3.5 flex items-center gap-3 text-left active:opacity-80"
              style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, border: `1.5px solid ${color}` }}>
                <a.Icon size={18} color={color} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#EDEDF2] truncate">{a.name}</p>
                <p className="text-[10.5px] text-[#8B8B99] truncate">{a.role}</p>
                <Pill color={color}>{a.app}</Pill>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentTVPlay({ onTapAgent }) {
  const userAgents = AGENT_BY_TIER.user;
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
      <div className="rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#000", border: `1px solid ${BORDER_CC}` }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${ACCENT}33, transparent 70%)` }} />
        <Tv size={40} color="#3A3A45" />
        <span className="absolute bottom-3 left-3 text-[10px] text-[#5A5A66]">TV Play · mock video panel</span>
      </div>
      <p className="text-[12px] font-semibold text-[#8B8B99] px-0.5">Talk to an agent on the big screen</p>
      <div className="grid grid-cols-2 gap-3">
        {userAgents.map((a) => (
          <button key={a.id} onClick={() => onTapAgent(a)} className="rounded-xl p-3 flex items-center gap-2.5" style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}>
            <a.Icon size={16} color={TIER_COLOR.user} />
            <span className="text-[13px] text-[#EDEDF2]">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentCarPlay({ onTapAgent }) {
  const gibson = AGENTS.find((a) => a.id === "gibson");
  const chips = [
    { label: "Delivery routing", Icon: Package },
    { label: "Ride coordination", Icon: Car },
    { label: "Nearby businesses", Icon: MapPin },
    { label: "Travel assist", Icon: Compass },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-5">
      <div className="relative">
        <div className="absolute inset-0 rounded-full animate-pulse opacity-30" style={{ backgroundColor: TIER_COLOR.user }} />
        <div className="w-24 h-24 rounded-full flex items-center justify-center relative" style={{ backgroundColor: `${TIER_COLOR.user}22`, border: `2px solid ${TIER_COLOR.user}` }}>
          <Navigation size={36} color={TIER_COLOR.user} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[12px] text-[#8B8B99]">Listening…</p>
        <div className="flex items-end gap-0.5 justify-center mt-2 h-6">
          {[6, 14, 20, 12, 18, 8, 16].map((h, i) => (
            <span key={i} className="w-1 rounded-full animate-pulse" style={{ height: h, backgroundColor: TIER_COLOR.user, animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 w-full">
        {chips.map((c) => (
          <div key={c.label} className="rounded-xl px-3 py-3 flex items-center gap-2" style={{ backgroundColor: CARD_CC, border: `1px solid ${BORDER_CC}` }}>
            <c.Icon size={15} color="#8B8B99" />
            <span className="text-[11.5px] text-[#C7C7D1]">{c.label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => onTapAgent(gibson)} className="w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
        Talk to Gibson
      </button>
    </div>
  );
}

const CC_TABS = [
  { id: "orch", label: "Orch", Icon: Network },
  { id: "agents", label: "Agents", Icon: Grid3x3 },
  { id: "tv", label: "TV Play", Icon: Tv },
  { id: "car", label: "CarPlay", Icon: Car },
];

function CommandCenter({ onBack, initialTab }) {
  const [tab, setTab] = useState(initialTab || "orch");
  const [activeAgent, setActiveAgent] = useState(null);

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: BG_CC }}>
      <ScreenHeader title="Agent Command Center" onBack={onBack} />
      <div className="flex px-4 pt-3 gap-2">
        {CC_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl"
            style={{ backgroundColor: tab === t.id ? `${ACCENT}22` : "transparent", border: `1px solid ${tab === t.id ? ACCENT : BORDER_CC}` }}
          >
            <t.Icon size={15} color={tab === t.id ? ACCENT_LIGHT : "#8B8B99"} />
            <span className="text-[10px]" style={{ color: tab === t.id ? "#EDEDF2" : "#8B8B99" }}>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "orch" && <Orchestration onTapAgent={setActiveAgent} />}
      {tab === "agents" && <AgentGrid onTapAgent={setActiveAgent} />}
      {tab === "tv" && <AgentTVPlay onTapAgent={setActiveAgent} />}
      {tab === "car" && <AgentCarPlay onTapAgent={setActiveAgent} />}

      {activeAgent && <AgentModal agent={activeAgent} onClose={() => setActiveAgent(null)} />}
    </div>
  );
}

/* ==================================================================== */
/* PREVIEW SCREENS — mocked ecosystem windows (V4_CLAUDE.md §4)          */
/* Each is explicitly a placeholder for its sibling app, not a V4       */
/* feature — every header says which app ultimately owns it.            */
/* ==================================================================== */
function PreviewShell({ title, ownerApp, onBack, children }) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: BG_OUTER }}>
      <ScreenHeader title={title} onBack={onBack} right={ownerApp ? <Pill color={ACCENT_LIGHT}>→ {ownerApp}</Pill> : null} />
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}

function Wallet({ onBack }) {
  const cards = [{ id: 1, label: "VACO Card", last4: "4471" }, { id: 2, label: "VCoin Rewards", last4: "9902" }];
  const txns = [
    { id: 1, label: "VOID delivery — Gibson routed", amt: "-$18.40" },
    { id: 2, label: "VACAY Experience deposit", amt: "-$64.00" },
    { id: 3, label: "VCoin cashback", amt: "+$3.12" },
  ];
  return (
    <PreviewShell title="Wallet" ownerApp="VASH" onBack={onBack}>
      <div className="rounded-2xl p-5 mb-4" style={{ background: `linear-gradient(135deg, ${ACCENT}, #2D2FA8)` }}>
        <p className="text-[11px] text-white/70">Total balance</p>
        <p className="text-2xl font-bold text-white mt-1">$1,284.55</p>
        <p className="text-[11px] text-white/70 mt-3">742 VCoin</p>
      </div>
      <p className="text-[12px] font-semibold text-[#8B8B99] mb-2">Cards</p>
      <div className="flex flex-col gap-2 mb-4">
        {cards.map((c) => (
          <div key={c.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <span className="text-sm text-[#EDEDF2]">{c.label}</span>
            <span className="text-xs text-[#8B8B99]">•••• {c.last4}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] font-semibold text-[#8B8B99] mb-2">Recent transactions</p>
      <div className="flex flex-col gap-2">
        {txns.map((t) => (
          <div key={t.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <span className="text-[13px] text-[#EDEDF2]">{t.label}</span>
            <span className={`text-[13px] font-medium ${t.amt.startsWith("+") ? "text-green-400" : "text-[#C7C7D1]"}`}>{t.amt}</span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Voken({ onBack }) {
  const assets = [
    { id: 1, name: "Founders Culture Card #0091", value: "412 VOKEN" },
    { id: 2, name: "Vvltvre Live Set — Ava Drop", value: "88 VOKEN" },
    { id: 3, name: "VACAY Stay Voucher — Kyoto", value: "150 VOKEN" },
  ];
  return (
    <PreviewShell title="VOKEN" ownerApp="VOKEN" onBack={onBack}>
      <div className="flex flex-col gap-2.5">
        {assets.map((a) => (
          <div key={a.id} className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TIER_COLOR.vulture}22` }}>
              <Coins size={18} color={TIER_COLOR.vulture} />
            </div>
            <div>
              <p className="text-sm text-[#EDEDF2] font-medium">{a.name}</p>
              <p className="text-[11px] text-[#8B8B99]">{a.value}</p>
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Marketplace({ onBack }) {
  const rows = [
    { app: "VOID", desc: "Fulfillment & delivery listings" },
    { app: "VACAY", desc: "Stays & Experiences for booking" },
    { app: "Vvltvre", desc: "Merch, tickets, and creator drops" },
    { app: "DREAMS", desc: "Ad inventory & screen placements" },
  ];
  return (
    <PreviewShell title="Marketplace" onBack={onBack}>
      <p className="text-[12px] text-[#8B8B99] mb-3">Placeholder — will power once each sibling app exists natively.</p>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.app} className="rounded-xl p-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag size={14} color={ACCENT_LIGHT} />
              <p className="text-sm font-semibold text-[#EDEDF2]">{r.app}</p>
            </div>
            <p className="text-[12px] text-[#8B8B99]">{r.desc}</p>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Hunts({ onBack }) {
  const checkpoints = [
    { id: 1, name: "Riverfront Coffee Co.", done: true },
    { id: 2, name: "Union Station Plaza", done: true },
    { id: 3, name: "Gallery District Mural", done: false },
    { id: 4, name: "Harbor Overlook", done: false },
  ];
  const leaderboard = [
    { id: 1, name: "mariposa_j", pts: 1240 },
    { id: 2, name: "kdel_runs", pts: 1105 },
    { id: 3, name: "you", pts: 980, me: true },
  ];
  return (
    <PreviewShell title="Hunts" ownerApp="HVNTZ" onBack={onBack}>
      <p className="text-[12px] font-semibold text-[#8B8B99] mb-2">Downtown Scavenger Hunt · checkpoints</p>
      <div className="flex flex-col gap-2 mb-5">
        {checkpoints.map((c) => (
          <div key={c.id} className="rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            {c.done ? <CheckCircle2 size={16} color="#6FCF97" /> : <Circle size={16} color="#5A5A66" />}
            <span className={`text-sm ${c.done ? "text-[#8B8B99] line-through" : "text-[#EDEDF2]"}`}>{c.name}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] font-semibold text-[#8B8B99] mb-2">Leaderboard</p>
      <div className="flex flex-col gap-2">
        {leaderboard.map((l, i) => (
          <div key={l.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: l.me ? `${ACCENT}1A` : CARD_OUTER, border: `1px solid ${l.me ? ACCENT : BORDER_OUTER}` }}>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] text-[#5A5A66] w-4">{i + 1}</span>
              <span className="text-sm text-[#EDEDF2]">{l.name}</span>
            </div>
            <span className="text-[12px] text-[#8B8B99]">{l.pts} pts</span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Predictions({ onBack }) {
  const cards = [
    { id: 1, label: "Traffic", body: "Downtown congestion expected to peak 5:15–5:45pm.", conf: 87 },
    { id: 2, label: "Weather", body: "Light rain likely after 8pm — plan indoor Experiences.", conf: 74 },
    { id: 3, label: "Wait times", body: "Harbor District restaurants trending 20min above average tonight.", conf: 68 },
    { id: 4, label: "Demand", body: "VOID delivery demand spiking near the stadium post-event.", conf: 91 },
  ];
  return (
    <PreviewShell title="Predictions" onBack={onBack}>
      <div className="flex flex-col gap-2.5">
        {cards.map((c) => (
          <div key={c.id} className="rounded-xl p-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-[#EDEDF2]">{c.label}</p>
              <Pill color="#6FCF97">{c.conf}% conf.</Pill>
            </div>
            <p className="text-[12.5px] text-[#8B8B99] leading-snug">{c.body}</p>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Automation({ onBack }) {
  const [rules, setRules] = useState([
    { id: 1, label: "Auto-reroute for traffic > 15min delay", on: true },
    { id: 2, label: "Auto-book VACAY Experience under $50 match", on: false },
    { id: 3, label: "Alert on VCoin balance below $50", on: true },
    { id: 4, label: "Auto-decline dating messages flagged by QVAN", on: false },
  ]);
  const toggle = (id) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));
  return (
    <PreviewShell title="Automation" onBack={onBack}>
      <p className="text-[12px] text-[#8B8B99] mb-3">Toggles are live in this session — nothing downstream executes yet.</p>
      <div className="flex flex-col gap-2.5">
        {rules.map((r) => (
          <div key={r.id} className="rounded-xl px-4 py-3.5 flex items-center justify-between" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <span className="text-[13px] text-[#EDEDF2] pr-3">{r.label}</span>
            <button onClick={() => toggle(r.id)} className="w-11 h-6 rounded-full relative shrink-0 transition-colors" style={{ backgroundColor: r.on ? ACCENT : "#3A3A45" }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: r.on ? 22 : 2 }} />
            </button>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Timeline({ onBack }) {
  const groups = [
    { day: "Today", items: ["Gibson rerouted delivery around I-70 traffic", "Leslie flagged a VCoin milestone"] },
    { day: "Yesterday", items: ["New crossing-paths match from Kevin", "Kay saved 2 VACAY Experiences to your trip"] },
    { day: "Monday", items: ["Ava added a discovery playlist", "QVAN cleared a routine security check"] },
  ];
  return (
    <PreviewShell title="Timeline" onBack={onBack}>
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g.day}>
            <p className="text-[12px] font-semibold text-[#8B8B99] mb-2">{g.day}</p>
            <div className="flex flex-col gap-2">
              {g.items.map((it, i) => (
                <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
                  <Clock size={13} color="#5A5A66" className="mt-0.5 shrink-0" />
                  <span className="text-[13px] text-[#C7C7D1] leading-snug">{it}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

/* ==================================================================== */
/* ECOSYSTEM SEARCH — real, calls v4-search (v4-search/server.js), not   */
/* a mock preview like the screens above. Distinct from BusinessSearch   */
/* below: that's the Maps layer (location pins), this is the Search      */
/* layer (cross-ecosystem content across HVNTZ, VACAY, VENVS, Vvltvre,   */
/* VOKEN, VACON-C).                                                       */
/* ==================================================================== */
function SearchResultRow({ result }) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Pill color={ACCENT_LIGHT}>{result.app}</Pill>
          <span className="text-[10px] text-[#5A5A66] uppercase tracking-wide">{result.type}</span>
        </div>
        <p className="text-sm text-[#EDEDF2] font-medium truncate">{result.title}</p>
        {result.subtitle && <p className="text-[12px] text-[#8B8B99] truncate">{result.subtitle}</p>}
      </div>
    </div>
  );
}

function EcosystemSearch({ onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = no search run yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await searchEcosystem(query.trim());
      setResults(r);
    } catch (err) {
      setError("Can't reach the search layer right now — is v4-search running?");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <PreviewShell title="Search" ownerApp="V4 Search Layer" onBack={onBack}>
      <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
        <Search size={16} color="#5A5A66" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search hunts, stays, products, music, cards, locations…"
          className="flex-1 bg-transparent text-sm text-[#EDEDF2] outline-none placeholder:text-[#5A5A66]"
        />
      </div>

      {loading && <p className="text-[12px] text-[#8B8B99] text-center mt-6">Searching…</p>}
      {error && <p className="text-[12px] text-red-400 text-center mt-6">{error}</p>}
      {!loading && !error && results === null && (
        <p className="text-[12px] text-[#5A5A66] text-center mt-6">
          Search across {SEARCH_APPS.join(", ")}.
        </p>
      )}
      {!loading && !error && results !== null && results.length === 0 && (
        <p className="text-[12px] text-[#5A5A66] text-center mt-6">No results for "{query}".</p>
      )}
      {!loading && !error && results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <SearchResultRow key={`${r.app}-${r.id}`} result={r} />
          ))}
        </div>
      )}
    </PreviewShell>
  );
}

function BusinessSearch({ onBack }) {
  const pins = [
    { x: 60, y: 90, label: "Riverfront Coffee" },
    { x: 160, y: 50, label: "Union Market" },
    { x: 240, y: 130, label: "Gallery District" },
    { x: 120, y: 170, label: "Harbor Grill" },
  ];
  return (
    <PreviewShell title="Business Search" ownerApp="V4 Map System" onBack={onBack}>
      <div className="rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
        <svg viewBox="0 0 320 220" className="w-full h-52">
          <defs>
            <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="#2C2C38" />
            </pattern>
          </defs>
          <rect width="320" height="220" fill="url(#dots)" />
          {pins.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill={ACCENT_LIGHT} />
              <circle cx={p.x} cy={p.y} r="10" fill="none" stroke={ACCENT_LIGHT} strokeOpacity="0.4" />
            </g>
          ))}
        </svg>
        <p className="text-center text-[10px] text-[#5A5A66] pb-2">Illustrative map — not live positions</p>
      </div>
      <div className="flex flex-col gap-2">
        {pins.map((p, i) => (
          <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <MapPin size={14} color={ACCENT_LIGHT} />
            <span className="text-[13px] text-[#EDEDF2]">{p.label}</span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Messages({ onBack }) {
  const threads = [
    { id: 1, name: "Jordan M.", preview: "See you at the crossing point!", time: "2m" },
    { id: 2, name: "VOID Support", preview: "Your delivery is 4 stops away.", time: "20m" },
    { id: 3, name: "Sam R.", preview: "That Experience Kay found looks amazing", time: "1h" },
  ];
  return (
    <PreviewShell title="Messages" ownerApp="Convo" onBack={onBack}>
      <div className="flex flex-col gap-2">
        {threads.map((t) => (
          <div key={t.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ACCENT}22` }}>
              <User size={16} color={ACCENT_LIGHT} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#EDEDF2] truncate">{t.name}</p>
                <span className="text-[10px] text-[#5A5A66] shrink-0 ml-2">{t.time}</span>
              </div>
              <p className="text-[12px] text-[#8B8B99] truncate">{t.preview}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Phone size={14} color="#5A5A66" />
              <Video size={14} color="#5A5A66" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#5A5A66] mt-3">Call icons here are visual only — separate from the live agent call flow in Command Center.</p>
    </PreviewShell>
  );
}

function Notifications({ onBack }) {
  const items = [
    "Gibson: route updated for your 5pm delivery",
    "Kay: new Experience matches near your saved trip",
    "Leslie: monthly VCoin summary is ready",
    "QVAN: routine security check completed",
  ];
  return (
    <PreviewShell title="Notifications" onBack={onBack}>
      <div className="flex flex-col gap-2">
        {items.map((n, i) => (
          <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <Bell size={14} color="#5A5A66" className="mt-0.5 shrink-0" />
            <span className="text-[13px] text-[#C7C7D1] leading-snug">{n}</span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Profile({ onBack, go }) {
  const rows = [
    { label: "Admin Dashboard", target: "admin" },
    { label: "TV Play", target: "tv" },
    { label: "CarPlay", target: "car" },
  ];
  return (
    <PreviewShell title="Profile" onBack={onBack}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
          <User size={22} color="#fff" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#EDEDF2]">Prototype User</p>
          <p className="text-[12px] text-[#8B8B99]">user@vaco.app</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <button key={r.label} onClick={() => go(r.target === "tv" || r.target === "car" ? "command" : r.target, r.target)} className="w-full flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <span className="text-sm text-[#EDEDF2]">{r.label}</span>
            <ChevronRight size={16} color="#5A5A66" />
          </button>
        ))}
        {["Account settings", "Privacy", "Linked apps"].map((s) => (
          <div key={s} className="w-full flex items-center justify-between rounded-xl px-4 py-3 opacity-60" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <span className="text-sm text-[#EDEDF2]">{s}</span>
            <Settings size={14} color="#5A5A66" />
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function Admin({ onBack }) {
  const stats = [
    { label: "Active users", value: "12,480" },
    { label: "Growth (30d)", value: "+8.4%" },
    { label: "Agent calls today", value: "3,102" },
    { label: "Avg. response time", value: "1.4s" },
  ];
  return (
    <PreviewShell title="Admin Dashboard" onBack={onBack}>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
            <p className="text-[11px] text-[#8B8B99]">{s.label}</p>
            <p className="text-lg font-bold text-[#EDEDF2] mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_OUTER, border: `1px solid ${BORDER_OUTER}` }}>
        <p className="text-sm font-semibold text-[#EDEDF2] mb-1">AI performance</p>
        <p className="text-[12.5px] text-[#8B8B99] leading-snug">All 10 agents operating within normal latency. No elevated error rates in the last 24h.</p>
      </div>
    </PreviewShell>
  );
}

/* ==================================================================== */
/* ROOT                                                                  */
/* ==================================================================== */
export default function V4Prototype() {
  const [screen, setScreen] = useState("login");
  const [ccTab, setCcTab] = useState("orch");
  // Bumped after a real sync from VACON's own live registry completes,
  // to force a re-render of whatever's currently reading the mutated
  // `AGENTS`/`AGENT_BY_TIER` module-level arrays -- see
  // `syncAgentRosterFromVacon`'s own header for why they're mutated in
  // place rather than threaded through as props.
  const [rosterVersion, setRosterVersion] = useState(0);

  useEffect(() => {
    syncAgentRosterFromVacon()
      .then(() => setRosterVersion((v) => v + 1))
      .catch(() => { /* VACON not reachable -- the local hardcoded roster stays as an honest fallback */ });
  }, []);

  const go = (target, tab) => {
    if (tab) setCcTab(tab);
    setScreen(target);
  };

  return (
    <div className="w-full min-h-[100dvh] flex items-center justify-center py-6" style={{ backgroundColor: "#000" }}>
      <div
        key={rosterVersion}
        className="relative w-full max-w-[430px] h-[844px] overflow-hidden"
        style={{ backgroundColor: BG_OUTER, borderRadius: 16, border: `1px solid ${BORDER_OUTER}`, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        {screen === "login" && <Login onLogin={() => go("home")} />}
        {screen === "home" && <Home go={go} />}
        {screen === "command" && <CommandCenter onBack={() => go("home")} initialTab={ccTab} />}
        {screen === "wallet" && <Wallet onBack={() => go("home")} />}
        {screen === "voken" && <Voken onBack={() => go("home")} />}
        {screen === "marketplace" && <Marketplace onBack={() => go("home")} />}
        {screen === "hunts" && <Hunts onBack={() => go("home")} />}
        {screen === "predictions" && <Predictions onBack={() => go("home")} />}
        {screen === "automation" && <Automation onBack={() => go("home")} />}
        {screen === "timeline" && <Timeline onBack={() => go("home")} />}
        {screen === "search" && <BusinessSearch onBack={() => go("home")} />}
        {screen === "ecosystemSearch" && <EcosystemSearch onBack={() => go("home")} />}
        {screen === "messages" && <Messages onBack={() => go("home")} />}
        {screen === "notifications" && <Notifications onBack={() => go("home")} />}
        {screen === "profile" && <Profile onBack={() => go("home")} go={go} />}
        {screen === "admin" && <Admin onBack={() => go("profile")} />}
      </div>
    </div>
  );
}
