import React, { useEffect, useMemo, useState } from "react";

/**
 * Baddies Dancer Money Tracker — Stable MVP (Rebuild v4)
 * ✅ 30-Day Boss Dashboard + Minimal Charts + Insights
 * ✅ Bills + due dates + paid checkbox
 * ✅ Weekly target (Option #2 buffer) + weekly target table + plan dropdown
 * ✅ Nightly tracker + journal + energy rules + flags
 * ✅ Sunday check-in + reflection saved per week
 * ✅ Dark-only baddie theme (black + pink glow)
 * ✅ LocalStorage persists
 *
 * No external chart libs (preview-safe). Charts are simple SVG.
 */

// -------------------- helpers --------------------
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const pink = "#ff5ca8";

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const monthKey = (iso) => String(iso || "").slice(0, 7);

const net = (gross, tipout, expenses) =>
  Number(gross || 0) - Number(tipout || 0) - Number(expenses || 0);

function startOfWeekISO(date = new Date()) {
  // Week starts Monday
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function endOfWeekISO(weekStartISO) {
  return addDaysISO(weekStartISO, 6);
}
function inRange(iso, startISO, endISO) {
  return iso >= startISO && iso <= endISO;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// -------------------- defaults --------------------
const DEFAULT_MIN_NET = 250;
const DEFAULT_BUFFER_PERCENT = 10; // Option #2
const DEFAULT_EXPECTED_NET_PER_NIGHT = 300;

const TIERS = [
  { min: 0, max: 150, label: "Dead / Maintenance Night" },
  { min: 151, max: 249, label: "Below Minimum" },
  { min: 250, max: 399, label: "Minimum Secured" },
  { min: 400, max: 699, label: "Good Money" },
  { min: 700, max: 999999, label: "Great Night (Bossed Up)" },
];

const AFFIRMATIONS = [
  "I protect my energy and my money respects me.",
  "My boundaries are part of my bag.",
  "I track it, I stack it, I secure it.",
  "I leave early before burnout steals my glow.",
  "I’m in control — my money follows my standards.",
];

function tierForNet(n) {
  const found = TIERS.find((t) => n >= t.min && n <= t.max);
  return found ? found.label : "—";
}

// -------------------- storage keys --------------------
const LS = {
  entries: "bdmt_entries_rebuild_v4",
  bills: "bdmt_bills_rebuild_v4",
  settings: "bdmt_settings_rebuild_v4",
  checkins: "bdmt_checkins_rebuild_v4",
  affirmDate: "bdmt_affirm_date_rebuild_v4",
  affirmText: "bdmt_affirm_text_rebuild_v4",
};

// -------------------- styles --------------------
const card = {
  background: "#0b0b10",
  border: "1px solid rgba(255,92,168,0.25)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 0 40px rgba(255,92,168,0.12)",
};

const buttonStyle = (variant = "pink") => ({
  background: variant === "pink" ? pink : "transparent",
  color: variant === "pink" ? "#000" : "#fff",
  border: variant === "pink" ? "none" : "1px solid #2a2a36",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
});

const input = {
  width: "100%",
  background: "#0f0f16",
  border: "1px solid #242432",
  color: "#fff",
  padding: "10px 10px",
  borderRadius: 12,
  outline: "none",
};

const label = { fontSize: 12, opacity: 0.78, marginBottom: 6 };
const row = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const row3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };

const th = {
  textAlign: "left",
  padding: "12px 12px",
  fontSize: 12,
  letterSpacing: 0.3,
  opacity: 0.85,
};
const thRight = { ...th, textAlign: "right" };

const td = {
  padding: "12px 12px",
  fontSize: 14,
  opacity: 0.95,
};
const tdRight = { ...td, textAlign: "right" };

function Pill({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,92,168,0.25)",
        background: "rgba(0,0,0,0.35)",
        boxShadow: "0 0 26px rgba(255,92,168,0.10)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function cardMini() {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid #222",
    background: "rgba(0,0,0,0.35)",
  };
}
function miniLabel() {
  return { fontSize: 12, opacity: 0.75, fontWeight: 800 };
}
function miniValue() {
  return { fontSize: 22, fontWeight: 950, marginTop: 6 };
}
function miniFoot() {
  return { fontSize: 12, opacity: 0.65, marginTop: 6 };
}

function Toggle({ checked, onChange, labelText, hint }) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <div style={{ fontWeight: 900 }}>{labelText}</div>
        {hint ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{hint}</div>
        ) : null}
      </div>
    </label>
  );
}

// -------------------- Minimal SVG Charts --------------------
function ChartFrame({ title, subtitle, children, right }) {
  return (
    <div style={{ ...card, padding: 14, border: "1px solid #222" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 950 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function LineChart({ values, height = 120 }) {
  // values: number[] (length 30)
  const w = 520;
  const h = height;

  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);

  const pad = 10;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const xFor = (i) => pad + (i * innerW) / Math.max(1, values.length - 1);
  const yFor = (v) => {
    const t = (v - minV) / Math.max(1e-9, maxV - minV);
    return pad + (1 - t) * innerH;
  };

  const path = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(v).toFixed(2)}`
    )
    .join(" ");

  const zeroY = yFor(0);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={w}
        height={h}
        style={{
          display: "block",
          borderRadius: 12,
          background: "rgba(0,0,0,0.25)",
        }}
      >
        {/* grid line at 0 */}
        <line
          x1={pad}
          y1={zeroY}
          x2={w - pad}
          y2={zeroY}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />
        {/* line */}
        <path d={path} fill="none" stroke={pink} strokeWidth="2.5" />
        {/* dots */}
        {values.map((v, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(v)}
            r="2.2"
            fill="rgba(255,92,168,0.9)"
          />
        ))}
      </svg>
    </div>
  );
}

function BarChart({ values, height = 120, maxOverride }) {
  const w = 520;
  const h = height;
  const pad = 10;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const maxV = Math.max(maxOverride ?? 0, ...values, 1);

  const barW = innerW / Math.max(1, values.length);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={w}
        height={h}
        style={{
          display: "block",
          borderRadius: 12,
          background: "rgba(0,0,0,0.25)",
        }}
      >
        {values.map((v, i) => {
          const bh = (safeNum(v) / maxV) * innerH;
          const x = pad + i * barW;
          const y = pad + (innerH - bh);
          return (
            <rect
              key={i}
              x={x + 1}
              y={y}
              width={Math.max(1, barW - 2)}
              height={Math.max(0, bh)}
              rx="2"
              fill="rgba(255,92,168,0.55)"
            />
          );
        })}
      </svg>
    </div>
  );
}

function ProgressBar({ labelText, value, max }) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div style={{ ...card, padding: 14, border: "1px solid #222" }}>
      <div style={{ fontWeight: 950 }}>{labelText}</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {value} / {max} nights ({pct.toFixed(0)}%)
      </div>
      <div
        style={{
          marginTop: 10,
          height: 10,
          borderRadius: 999,
          border: "1px solid rgba(255,92,168,0.20)",
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "rgba(255,92,168,0.85)",
            boxShadow: "0 0 18px rgba(255,92,168,0.25)",
          }}
        />
      </div>
    </div>
  );
}

// -------------------- app --------------------
export default function App() {
  const [tab, setTab] = useState("dashboard"); // dashboard | bills | tracker | sunday | settings

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(LS.settings);
    return saved
      ? JSON.parse(saved)
      : {
          minNetDefault: DEFAULT_MIN_NET,
          bufferPercent: DEFAULT_BUFFER_PERCENT,
          expectedNetPerNight: DEFAULT_EXPECTED_NET_PER_NIGHT,
        };
  });

  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem(LS.entries);
    return saved ? JSON.parse(saved) : [];
  });

  const [bills, setBills] = useState(() => {
    const saved = localStorage.getItem(LS.bills);
    return saved ? JSON.parse(saved) : [];
  });

  // weekly check-ins: { [weekStartISO]: { reflection: string, updatedAt: iso } }
  const [checkins, setCheckins] = useState(() => {
    const saved = localStorage.getItem(LS.checkins);
    return saved ? JSON.parse(saved) : {};
  });

  const [affirmation, setAffirmation] = useState("");

  // Persist
  useEffect(
    () => localStorage.setItem(LS.settings, JSON.stringify(settings)),
    [settings]
  );
  useEffect(
    () => localStorage.setItem(LS.entries, JSON.stringify(entries)),
    [entries]
  );
  useEffect(
    () => localStorage.setItem(LS.bills, JSON.stringify(bills)),
    [bills]
  );
  useEffect(
    () => localStorage.setItem(LS.checkins, JSON.stringify(checkins)),
    [checkins]
  );

  // Daily affirmation
  useEffect(() => {
    const t = todayISO();
    const savedDate = localStorage.getItem(LS.affirmDate);
    const savedText = localStorage.getItem(LS.affirmText);
    if (savedDate === t && savedText) {
      setAffirmation(savedText);
      return;
    }
    const pick = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
    localStorage.setItem(LS.affirmDate, t);
    localStorage.setItem(LS.affirmText, pick);
    setAffirmation(pick);
  }, []);

  const today = todayISO();
  const weekStart = startOfWeekISO(new Date());
  const weekEnd = endOfWeekISO(weekStart);

  const billsSorted = useMemo(() => {
    return [...bills].sort((a, b) =>
      String(a.dueDate || "").localeCompare(String(b.dueDate || ""))
    );
  }, [bills]);

  const billsDueThisWeek = useMemo(() => {
    return billsSorted.filter(
      (b) => b.dueDate && inRange(b.dueDate, weekStart, weekEnd)
    );
  }, [billsSorted, weekStart, weekEnd]);

  // Weekly target (Option #2)
  const weeklyTarget = useMemo(() => {
    const unpaid = billsDueThisWeek.filter((b) => !b.paid);
    const base = unpaid.reduce((sum, b) => sum + safeNum(b.amount), 0);

    const pct = clamp(safeNum(settings.bufferPercent), 0, 100);
    const buffer = Math.round(base * (pct / 100));
    const total = base + buffer;

    const perNight = Math.max(
      1,
      Math.floor(safeNum(settings.expectedNetPerNight) || 1)
    );
    const nights = total <= 0 ? 0 : Math.ceil(total / perNight);

    return {
      base,
      buffer,
      total,
      pct,
      nights,
      perNight,
      unpaidCount: unpaid.length,
      totalCount: billsDueThisWeek.length,
    };
  }, [billsDueThisWeek, settings.bufferPercent, settings.expectedNetPerNight]);

  // Weekly plan dropdown state
  const [plannedNights, setPlannedNights] = useState(() => {
    const n = Number(weeklyTarget.nights || 0);
    return n > 0 ? Math.min(7, Math.max(1, n)) : 3;
  });

  useEffect(() => {
    setPlannedNights((p) => Math.min(7, Math.max(1, Number(p || 1))));
  }, [weeklyTarget.total]);

  // Totals (all logged nights)
  const totalsAll = useMemo(() => {
    return entries.reduce(
      (acc, e) => {
        const n = net(e.gross, e.tipout, e.expenses);
        acc.gross += safeNum(e.gross);
        acc.tipout += safeNum(e.tipout);
        acc.expenses += safeNum(e.expenses);
        acc.net += n;

        if (e.minKept) acc.minKept += 1;
        if (e.leftEarly) acc.leftEarly += 1;

        const flags = e.flags || {};
        const fcount = ["tired", "anxious", "disrespected", "unsafe"].reduce(
          (s, k) => s + (flags[k] ? 1 : 0),
          0
        );
        acc.flagsTotal += fcount;
        return acc;
      },
      {
        gross: 0,
        tipout: 0,
        expenses: 0,
        net: 0,
        minKept: 0,
        leftEarly: 0,
        flagsTotal: 0,
      }
    );
  }, [entries]);

  // 30-day series: fill missing days with zeros
  const last30 = useMemo(() => {
    const start = addDaysISO(today, -29);

    // map entries by date, if multiple same date: sum them (rare but possible)
    const byDate = new Map();
    for (const e of entries) {
      const d = String(e.date || "");
      if (!d) continue;

      const prev = byDate.get(d) || {
        date: d,
        gross: 0,
        tipout: 0,
        expenses: 0,
        net: 0,
        minHit: 0,
        leftEarly: 0,
        flagsCount: 0,
      };

      const n = net(e.gross, e.tipout, e.expenses);
      const flags = e.flags || {};
      const fcount = ["tired", "anxious", "disrespected", "unsafe"].reduce(
        (s, k) => s + (flags[k] ? 1 : 0),
        0
      );

      const hit = n >= safeNum(settings.minNetDefault);

      prev.gross += safeNum(e.gross);
      prev.tipout += safeNum(e.tipout);
      prev.expenses += safeNum(e.expenses);
      prev.net += n;
      prev.minHit += hit ? 1 : 0;
      prev.leftEarly += e.leftEarly ? 1 : 0;
      prev.flagsCount += fcount;

      byDate.set(d, prev);
    }

    const rows = [];
    for (let i = 0; i < 30; i++) {
      const d = addDaysISO(start, i);
      const got = byDate.get(d);
      rows.push(
        got || {
          date: d,
          gross: 0,
          tipout: 0,
          expenses: 0,
          net: 0,
          minHit: 0,
          leftEarly: 0,
          flagsCount: 0,
        }
      );
    }
    return rows;
  }, [entries, settings.minNetDefault, today]);

  const totals30 = useMemo(() => {
    const t = last30.reduce(
      (acc, r) => {
        acc.gross += safeNum(r.gross);
        acc.tipout += safeNum(r.tipout);
        acc.expenses += safeNum(r.expenses);
        acc.net += safeNum(r.net);
        acc.minHits += r.minHit > 0 ? 1 : 0; // count days where min hit at least once
        acc.leftEarlyDays += r.leftEarly > 0 ? 1 : 0;
        acc.flagsDays += r.flagsCount > 0 ? 1 : 0;
        return acc;
      },
      {
        gross: 0,
        tipout: 0,
        expenses: 0,
        net: 0,
        minHits: 0,
        leftEarlyDays: 0,
        flagsDays: 0,
      }
    );
    return t;
  }, [last30]);

  const seriesNet30 = useMemo(
    () => last30.map((r) => safeNum(r.net)),
    [last30]
  );
  const seriesFlags30 = useMemo(
    () => last30.map((r) => safeNum(r.flagsCount)),
    [last30]
  );

  // Insights (soft + boss mix)
  const insights = useMemo(() => {
    const flagged = last30.filter((r) => r.flagsCount > 0);
    const calm = last30.filter((r) => r.flagsCount === 0);

    const avg = (arr) =>
      arr.length ? arr.reduce((s, r) => s + safeNum(r.net), 0) / arr.length : 0;

    const avgFlag = avg(flagged);
    const avgCalm = avg(calm);
    const diff = avgCalm - avgFlag;

    const hitRatePct = (totals30.minHits / 30) * 100;

    let moneyEnergyLine = "Track the pattern, not the mood.";
    if (flagged.length === 0)
      moneyEnergyLine =
        "No flags logged this month — that’s self-control and peace.";
    else if (diff > 25)
      moneyEnergyLine = `When flags are checked, your average net is lower by about ${USD.format(
        diff
      )}. Protecting your energy protects your bag.`;
    else if (diff < -25)
      moneyEnergyLine = `Even on flagged nights, you still performed. That’s resilience — but don’t normalize burnout.`;
    else
      moneyEnergyLine = `Your net is fairly steady whether flags happen or not. Keep boundaries tight and money stays consistent.`;

    let bossLine = "You’re in control. Small rules make big money.";
    if (hitRatePct >= 70)
      bossLine =
        "Boss behavior: you hit your minimum most nights. Keep that standard.";
    else if (hitRatePct >= 40)
      bossLine =
        "You’re building consistency. Tighten the plan and protect your energy.";
    else
      bossLine =
        "No shame — just data. This month is for rebuilding your standard, one night at a time.";

    return { moneyEnergyLine, bossLine, avgFlag, avgCalm, diff, hitRatePct };
  }, [last30, totals30.minHits]);

  // Bills paid this month total ($)
  const billsPaidThisMonth = useMemo(() => {
    const m = monthKey(today);
    const paid = bills.filter((b) => b.paid && monthKey(b.dueDate) === m);
    const total = paid.reduce((s, b) => s + safeNum(b.amount), 0);
    return { month: m, count: paid.length, total };
  }, [bills, today]);

  // Actions
  const addBill = () => {
    setBills((arr) => [
      ...arr,
      { id: uid(), name: "", amount: "", dueDate: todayISO(), paid: false },
    ]);
    setTab("bills");
  };

  const updateBill = (id, patch) =>
    setBills((arr) => arr.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBill = (id) => setBills((arr) => arr.filter((b) => b.id !== id));

  const addEntry = () => {
    setEntries((arr) => [
      ...arr,
      {
        id: uid(),
        date: todayISO(),
        gross: "",
        tipout: "",
        expenses: "",
        minKept: false,
        leftEarly: false,
        flags: {
          tired: false,
          anxious: false,
          disrespected: false,
          unsafe: false,
        },
        notes: "",
      },
    ]);
    setTab("tracker");
  };

  const updateEntry = (id, patch) =>
    setEntries((arr) => arr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeEntry = (id) =>
    setEntries((arr) => arr.filter((e) => e.id !== id));

  const hasBills = bills.length > 0;

  const thisWeekCheckin = checkins?.[weekStart] || { reflection: "" };
  const setThisWeekReflection = (text) => {
    setCheckins((prev) => ({
      ...prev,
      [weekStart]: { reflection: text, updatedAt: new Date().toISOString() },
    }));
  };

  const paidCountThisWeek = billsDueThisWeek.filter((b) => b.paid).length;

  // planned per-night
  const perNightPlanned = useMemo(() => {
    const target = safeNum(weeklyTarget.total);
    const nights = Math.max(1, safeNum(plannedNights));
    return target / nights;
  }, [weeklyTarget.total, plannedNights]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 22,
        color: "#fff",
        fontFamily: "system-ui",
        background:
          "radial-gradient(circle at top, rgba(255,92,168,0.22), transparent 45%), linear-gradient(180deg,#000,#05050a,#000)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          ...card,
          border: "1px solid rgba(255,92,168,0.55)",
          boxShadow: "0 0 65px rgba(255,92,168,0.20)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: pink,
              color: "#000",
              display: "grid",
              placeItems: "center",
              fontWeight: 950,
              fontSize: 22,
              boxShadow: "0 0 46px rgba(255,92,168,0.55)",
            }}
          >
            $
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.5 }}>
              <span style={{ color: pink }}>Baddies</span> Dancer Money Tracker
            </div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Track your bag. Protect your energy.
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Pill>USD</Pill>
              <Pill>
                Min net: {USD.format(safeNum(settings.minNetDefault))}
              </Pill>
              <Pill>
                Week: {weekStart} → {weekEnd}
              </Pill>
            </div>
          </div>

          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              Daily affirmation
            </div>
            <div style={{ marginTop: 8, color: pink, fontWeight: 900 }}>
              {affirmation}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              {today}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}
        >
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "bills", label: "Bills" },
            { id: "tracker", label: "Tracker" },
            { id: "sunday", label: "Sunday" },
            { id: "settings", label: "Settings" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                ...buttonStyle(tab === t.id ? "pink" : "ghost"),
                ...(tab === t.id
                  ? { boxShadow: "0 0 22px rgba(255,92,168,0.18)" }
                  : { opacity: 0.92 }),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* START HERE */}
      {!hasBills && (
        <div
          style={{
            ...card,
            marginTop: 18,
            border: "1px solid rgba(255,92,168,0.30)",
          }}
        >
          <div style={{ fontWeight: 950, color: pink }}>Start here 💸</div>
          <div style={{ marginTop: 8, opacity: 0.9 }}>
            Step 1: Go to <b style={{ color: pink }}>Bills</b> and list your
            bills with amounts + due dates.
            <br />
            Then your weekly target + nights needed will calculate
            automatically.
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button onClick={() => setTab("bills")} style={buttonStyle("pink")}>
              Go add bills
            </button>
            <button onClick={addBill} style={buttonStyle("ghost")}>
              + Add first bill
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {tab === "dashboard" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          {/* 30-Day Boss Dashboard */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              30-Day Boss Dashboard
            </div>
            <div style={{ opacity: 0.72, marginTop: 4 }}>
              This is your control panel: money, consistency, and energy in one
              place.
            </div>

            <div style={{ ...row3, marginTop: 12 }}>
              <div style={cardMini()}>
                <div style={miniLabel()}>30-day net</div>
                <div style={{ ...miniValue(), color: pink }}>
                  {USD.format(totals30.net)}
                </div>
                <div style={miniFoot()}>Net = gross − tip-outs − expenses</div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>Bills paid this month</div>
                <div style={miniValue()}>
                  {USD.format(billsPaidThisMonth.total)}
                </div>
                <div style={miniFoot()}>
                  {billsPaidThisMonth.month} • {billsPaidThisMonth.count} paid
                </div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>Energy protection</div>
                <div style={miniValue()}>
                  {totals30.leftEarlyDays} 🚪 / {totals30.flagsDays} ⚡
                </div>
                <div style={miniFoot()}>Left-early days / flagged days</div>
              </div>
            </div>

            <div style={{ ...row3, marginTop: 12 }}>
              <div style={cardMini()}>
                <div style={miniLabel()}>30-day gross</div>
                <div style={miniValue()}>{USD.format(totals30.gross)}</div>
                <div style={miniFoot()}>Before tip-outs + expenses</div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>30-day tip-outs</div>
                <div style={miniValue()}>{USD.format(totals30.tipout)}</div>
                <div style={miniFoot()}>What you paid out</div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>30-day expenses</div>
                <div style={miniValue()}>{USD.format(totals30.expenses)}</div>
                <div style={miniFoot()}>Gas, hair, nails, fits, etc.</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <ProgressBar
                labelText="Minimum net hit rate (last 30 days)"
                value={totals30.minHits}
                max={30}
              />
              <div style={{ ...card, padding: 14, border: "1px solid #222" }}>
                <div style={{ fontWeight: 950 }}>Insights</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Soft + boss truth: no shame, just patterns.
                </div>
                <div style={{ marginTop: 10, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 900, color: pink }}>
                    {insights.bossLine}
                  </div>
                  <div style={{ marginTop: 8, opacity: 0.9 }}>
                    {insights.moneyEnergyLine}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    Avg net (flag nights): <b>{USD.format(insights.avgFlag)}</b>{" "}
                    • Avg net (calm nights):{" "}
                    <b>{USD.format(insights.avgCalm)}</b>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button onClick={addEntry} style={buttonStyle("pink")}>
                + Add night
              </button>
              <button onClick={addBill} style={buttonStyle("ghost")}>
                + Add bill
              </button>
              <button
                onClick={() => setTab("tracker")}
                style={buttonStyle("ghost")}
              >
                Go tracker →
              </button>
            </div>
          </div>

          {/* Weekly target + plan */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              Weekly income target
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Unpaid bills due this week + buffer ({settings.bufferPercent}%).
            </div>

            <div style={{ ...row3, marginTop: 12 }}>
              <div style={cardMini()}>
                <div style={miniLabel()}>Bills due this week</div>
                <div style={miniValue()}>{weeklyTarget.totalCount}</div>
                <div style={miniFoot()}>
                  Unpaid:{" "}
                  <b style={{ color: pink }}>{weeklyTarget.unpaidCount}</b>
                </div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>Target total</div>
                <div style={{ ...miniValue(), color: pink }}>
                  {USD.format(weeklyTarget.total)}
                </div>
                <div style={miniFoot()}>
                  Base {USD.format(weeklyTarget.base)} + buffer{" "}
                  {USD.format(weeklyTarget.buffer)} ({weeklyTarget.pct}%)
                </div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>Estimated nights needed</div>
                <div style={miniValue()}>{weeklyTarget.nights}</div>
                <div style={miniFoot()}>
                  At ~{USD.format(weeklyTarget.perNight)} net/night
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>
                Bills due this week (Mon–Sun)
              </div>

              {billsDueThisWeek.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No bills due this week yet.</div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: 14,
                    border: "1px solid #222",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 680,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "rgba(255,92,168,0.07)" }}>
                        <th style={th}>Bill</th>
                        <th style={th}>Due date</th>
                        <th style={thRight}>Amount</th>
                        <th style={th}>Status</th>
                        <th style={thRight}>Running unpaid total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let running = 0;
                        return billsDueThisWeek.map((b) => {
                          const amt = safeNum(b.amount);
                          if (!b.paid) running += amt;
                          return (
                            <tr
                              key={b.id}
                              style={{ borderTop: "1px solid #222" }}
                            >
                              <td style={td}>
                                <b>{b.name || "(Unnamed)"}</b>
                              </td>
                              <td style={td}>{b.dueDate}</td>
                              <td style={tdRight}>{USD.format(amt)}</td>
                              <td style={td}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    fontWeight: 900,
                                    fontSize: 12,
                                    border: "1px solid #2a2a36",
                                    background: b.paid
                                      ? "rgba(34,197,94,0.14)"
                                      : "rgba(255,92,168,0.10)",
                                    color: b.paid ? "#86efac" : pink,
                                  }}
                                >
                                  {b.paid ? "PAID" : "UNPAID"}
                                </span>
                              </td>
                              <td style={tdRight}>{USD.format(running)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Weekly plan dropdown */}
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,92,168,0.22)",
                  background: "rgba(0,0,0,0.30)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 950 }}>
                  Weekly plan{" "}
                  <span style={{ color: pink, fontWeight: 900 }}>
                    — per-night target
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginTop: 10,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                    How many nights are you working?
                  </div>

                  <select
                    value={plannedNights}
                    onChange={(e) => setPlannedNights(Number(e.target.value))}
                    style={{
                      background: "#0f0f16",
                      border: "1px solid #242432",
                      color: "#fff",
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontWeight: 900,
                      outline: "none",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n} night{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>

                  <Pill>
                    Bills paid this week:{" "}
                    <span style={{ color: pink, fontWeight: 950 }}>
                      {paidCountThisWeek}/{billsDueThisWeek.length}
                    </span>
                  </Pill>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #222",
                    background: "rgba(255,92,168,0.06)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                    Target per night
                  </div>
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 950,
                      color: pink,
                      marginTop: 4,
                    }}
                  >
                    {USD.format(
                      Number.isFinite(perNightPlanned) ? perNightPlanned : 0
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        opacity: 0.8,
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      {" "}
                      /night
                    </span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                    Boss tip: hit your plan early, then protect your energy.
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button onClick={addBill} style={buttonStyle("pink")}>
                  + Add bill
                </button>
                <button onClick={addEntry} style={buttonStyle("ghost")}>
                  + Add night
                </button>
                <button
                  onClick={() => setTab("sunday")}
                  style={buttonStyle("ghost")}
                >
                  Sunday check-in →
                </button>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div
            style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}
          >
            <ChartFrame
              title="Net by night (last 30 days)"
              subtitle="Clean view of your money flow. Peaks & dips show your rhythm."
              right={
                <Pill>
                  Min net: {USD.format(safeNum(settings.minNetDefault))}
                </Pill>
              }
            >
              <LineChart values={seriesNet30} />
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Soft reminder: dips aren’t failure — they’re information. Boss
                move is adjusting the plan.
              </div>
            </ChartFrame>

            <ChartFrame
              title="Energy flags (last 30 days)"
              subtitle="Higher bars = more flagged moments. Your body is data too."
              right={<Pill>Flags total: {totals30.flagsDays} days</Pill>}
            >
              <BarChart values={seriesFlags30} height={120} maxOverride={4} />
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Boss rule: if flags stack up, rest is part of the bag.
              </div>
            </ChartFrame>
          </div>

          {/* Min rule tiers */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              Minimum Net Rule overview
            </div>
            <div style={{ opacity: 0.78, marginTop: 6 }}>
              Your minimum net is{" "}
              <b style={{ color: pink }}>
                {USD.format(safeNum(settings.minNetDefault))}
              </b>
              .
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {TIERS.map((t) => (
                <div
                  key={t.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #222",
                    background: "rgba(0,0,0,0.30)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {USD.format(t.min)} – {USD.format(t.max)}
                    </div>
                    <div style={{ opacity: 0.75, marginTop: 3 }}>{t.label}</div>
                  </div>
                  <Pill>{t.label}</Pill>
                </div>
              ))}
            </div>
          </div>

          {/* All-time totals (optional extra) */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              All-time totals (everything you logged)
            </div>
            <div style={{ ...row3, marginTop: 12 }}>
              <div style={cardMini()}>
                <div style={miniLabel()}>Gross</div>
                <div style={miniValue()}>{USD.format(totalsAll.gross)}</div>
              </div>
              <div style={cardMini()}>
                <div style={miniLabel()}>Net</div>
                <div style={{ ...miniValue(), color: pink }}>
                  {USD.format(totalsAll.net)}
                </div>
              </div>
              <div style={cardMini()}>
                <div style={miniLabel()}>Energy rules</div>
                <div style={miniValue()}>
                  {totalsAll.minKept} ✅ / {totalsAll.leftEarly} 🚪
                </div>
                <div style={miniFoot()}>Min kept / left early</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BILLS */}
      {tab === "bills" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div style={{ ...card }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  Bills & due dates
                </div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>
                  Add bills first so weekly targets calculate automatically.
                </div>
              </div>
              <button onClick={addBill} style={buttonStyle("pink")}>
                + Add bill
              </button>
            </div>

            {billsSorted.length === 0 ? (
              <div style={{ marginTop: 14, opacity: 0.8 }}>
                No bills yet. Add your first bill above.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {billsSorted.map((b) => (
                  <div
                    key={b.id}
                    style={{ ...card, padding: 14, border: "1px solid #222" }}
                  >
                    <div style={{ ...row3 }}>
                      <div>
                        <div style={label}>Bill name</div>
                        <input
                          style={input}
                          placeholder="Rent"
                          value={b.name}
                          onChange={(e) =>
                            updateBill(b.id, { name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <div style={label}>Amount</div>
                        <input
                          style={input}
                          type="number"
                          placeholder="0"
                          value={b.amount}
                          onChange={(e) =>
                            updateBill(b.id, { amount: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <div style={label}>Due date</div>
                        <input
                          style={input}
                          type="date"
                          value={b.dueDate}
                          onChange={(e) =>
                            updateBill(b.id, { dueDate: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div
                      style={{ ...row, marginTop: 12, alignItems: "center" }}
                    >
                      <label
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!b.paid}
                          onChange={(e) =>
                            updateBill(b.id, { paid: e.target.checked })
                          }
                        />
                        <span style={{ fontWeight: 900 }}>Paid</span>
                      </label>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 10,
                        }}
                      >
                        <button
                          onClick={() => removeBill(b.id)}
                          style={buttonStyle("ghost")}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                      Due this week?{" "}
                      <b style={{ color: pink }}>
                        {b.dueDate && inRange(b.dueDate, weekStart, weekEnd)
                          ? "YES"
                          : "NO"}
                      </b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRACKER */}
      {tab === "tracker" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div style={{ ...card }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  Nightly tracker + energy rules
                </div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>
                  Log money + protect your energy (min net kept, leave early,
                  flags).
                </div>
              </div>
              <button onClick={addEntry} style={buttonStyle("pink")}>
                + Add night
              </button>
            </div>

            {entries.length === 0 ? (
              <div style={{ marginTop: 14, opacity: 0.8 }}>
                No nights logged yet. Add your first night above.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {entries
                  .slice()
                  .reverse()
                  .map((e) => {
                    const n = net(e.gross, e.tipout, e.expenses);
                    const tier = tierForNet(n);
                    const flags = e.flags || {
                      tired: false,
                      anxious: false,
                      disrespected: false,
                      unsafe: false,
                    };
                    const hitMin = n >= safeNum(settings.minNetDefault);

                    return (
                      <div
                        key={e.id}
                        style={{
                          ...card,
                          padding: 14,
                          border: "1px solid #222",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 950 }}>
                            {e.date}{" "}
                            <span style={{ opacity: 0.7, fontWeight: 700 }}>
                              •
                            </span>{" "}
                            <span style={{ color: pink }}>{tier}</span>{" "}
                            <span style={{ opacity: 0.7, fontWeight: 800 }}>
                              •
                            </span>{" "}
                            <span
                              style={{
                                color: hitMin ? "#86efac" : pink,
                                fontWeight: 950,
                              }}
                            >
                              {hitMin ? "Minimum hit" : "Below minimum"}
                            </span>
                          </div>
                          <button
                            onClick={() => removeEntry(e.id)}
                            style={buttonStyle("ghost")}
                          >
                            Remove
                          </button>
                        </div>

                        <div style={{ ...row3, marginTop: 12 }}>
                          <div>
                            <div style={label}>Gross</div>
                            <input
                              style={input}
                              type="number"
                              value={e.gross}
                              onChange={(ev) =>
                                updateEntry(e.id, { gross: ev.target.value })
                              }
                            />
                          </div>
                          <div>
                            <div style={label}>Tip-out</div>
                            <input
                              style={input}
                              type="number"
                              value={e.tipout}
                              onChange={(ev) =>
                                updateEntry(e.id, { tipout: ev.target.value })
                              }
                            />
                          </div>
                          <div>
                            <div style={label}>Expenses</div>
                            <input
                              style={input}
                              type="number"
                              value={e.expenses}
                              onChange={(ev) =>
                                updateEntry(e.id, { expenses: ev.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <Pill>
                            Net: <b style={{ color: pink }}>{USD.format(n)}</b>
                          </Pill>
                          <Pill>Tier: {tier || "—"}</Pill>
                          <Pill>
                            Min net:{" "}
                            {USD.format(safeNum(settings.minNetDefault))}
                          </Pill>
                        </div>

                        <div
                          style={{ marginTop: 14, display: "grid", gap: 10 }}
                        >
                          <div style={{ fontWeight: 950, color: pink }}>
                            Energy Rules
                          </div>
                          <Toggle
                            checked={!!e.minKept}
                            onChange={(v) => updateEntry(e.id, { minKept: v })}
                            labelText="Minimum Net Rule: I kept my minimum net"
                            hint="Soft + boss truth: stop chasing once you hit your minimum."
                          />
                          <Toggle
                            checked={!!e.leftEarly}
                            onChange={(v) =>
                              updateEntry(e.id, { leftEarly: v })
                            }
                            labelText="Leave Early Rule: I left early"
                            hint="Burnout protection. Rest is part of the bag."
                          />

                          <div style={{ marginTop: 6, fontWeight: 950 }}>
                            Check if any are true
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(190px, 1fr))",
                              gap: 10,
                            }}
                          >
                            <Toggle
                              checked={!!flags.tired}
                              onChange={(v) =>
                                updateEntry(e.id, {
                                  flags: { ...flags, tired: v },
                                })
                              }
                              labelText="Tired"
                            />
                            <Toggle
                              checked={!!flags.anxious}
                              onChange={(v) =>
                                updateEntry(e.id, {
                                  flags: { ...flags, anxious: v },
                                })
                              }
                              labelText="Anxious"
                            />
                            <Toggle
                              checked={!!flags.disrespected}
                              onChange={(v) =>
                                updateEntry(e.id, {
                                  flags: { ...flags, disrespected: v },
                                })
                              }
                              labelText="Disrespected"
                            />
                            <Toggle
                              checked={!!flags.unsafe}
                              onChange={(v) =>
                                updateEntry(e.id, {
                                  flags: { ...flags, unsafe: v },
                                })
                              }
                              labelText="Unsafe"
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <div style={label}>Notes / Journal</div>
                          <textarea
                            style={{ ...input, minHeight: 90 }}
                            placeholder="What happened tonight? What boundary did you keep?"
                            value={e.notes}
                            onChange={(ev) =>
                              updateEntry(e.id, { notes: ev.target.value })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUNDAY CHECK-IN */}
      {tab === "sunday" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Sunday check-in</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Week of <b style={{ color: pink }}>{weekStart}</b> →{" "}
              <b style={{ color: pink }}>{weekEnd}</b>
            </div>

            <div style={{ ...row, marginTop: 14 }}>
              <div style={cardMini()}>
                <div style={miniLabel()}>Bills paid (due this week)</div>
                <div style={miniValue()}>
                  <span style={{ color: pink, fontWeight: 950 }}>
                    {paidCountThisWeek}
                  </span>{" "}
                  / {billsDueThisWeek.length}
                </div>
                <div style={miniFoot()}>
                  Based on bill due dates inside this week
                </div>
              </div>

              <div style={cardMini()}>
                <div style={miniLabel()}>Weekly target</div>
                <div style={{ ...miniValue(), color: pink }}>
                  {USD.format(weeklyTarget.total)}
                </div>
                <div style={miniFoot()}>
                  Unpaid base + buffer ({settings.bufferPercent}%)
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontWeight: 950 }}>
              Bills due this week
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {billsDueThisWeek.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No bills due this week.</div>
              ) : (
                billsDueThisWeek.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      borderRadius: 14,
                      border: "1px solid #222",
                      background: "rgba(0,0,0,0.30)",
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 950 }}>
                        {b.name || "(Unnamed)"} —{" "}
                        <span style={{ color: pink }}>
                          {USD.format(safeNum(b.amount))}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Due {b.dueDate}
                      </div>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!b.paid}
                        onChange={(e) =>
                          updateBill(b.id, { paid: e.target.checked })
                        }
                      />
                      <span style={{ fontWeight: 950 }}>
                        {b.paid ? "Paid" : "Not paid yet"}
                      </span>
                    </label>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 950 }}>Reflection</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                Soft + boss check: what worked, what drained you, and what rule
                you’re keeping next week.
              </div>
              <textarea
                style={{ ...input, minHeight: 150, marginTop: 10 }}
                value={thisWeekCheckin.reflection || ""}
                onChange={(e) => setThisWeekReflection(e.target.value)}
                placeholder="What worked? What drained you? What’s the one rule you’re not breaking next week?"
              />
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setThisWeekReflection("")}
                  style={buttonStyle("ghost")}
                >
                  Clear reflection
                </button>
                <button
                  onClick={() => setTab("dashboard")}
                  style={buttonStyle("pink")}
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div style={{ ...card }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Settings</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Adjust buffer % and expected net/night to match your strategy.
            </div>

            <div style={{ ...row3, marginTop: 12 }}>
              <div>
                <div style={label}>Default minimum net</div>
                <input
                  style={input}
                  type="number"
                  value={settings.minNetDefault}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      minNetDefault: clamp(
                        Number(e.target.value || 0),
                        0,
                        999999
                      ),
                    }))
                  }
                />
              </div>

              <div>
                <div style={label}>Weekly buffer % (Option #2)</div>
                <input
                  style={input}
                  type="number"
                  value={settings.bufferPercent}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      bufferPercent: clamp(Number(e.target.value || 0), 0, 100),
                    }))
                  }
                />
              </div>

              <div>
                <div style={label}>Expected net per night</div>
                <input
                  style={input}
                  type="number"
                  value={settings.expectedNetPerNight}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      expectedNetPerNight: clamp(
                        Number(e.target.value || 0),
                        1,
                        999999
                      ),
                    }))
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
              Next upgrade: login + cloud sync so Pro works everywhere you sign
              in.
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 26,
          opacity: 0.5,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        Stable MVP (Rebuild v4). Next: savings goals + “Tonight Decision Mode” +
        login/subscription.
      </div>
    </div>
  );
}
