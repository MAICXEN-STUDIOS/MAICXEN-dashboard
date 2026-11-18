/**
 * Shared Stylized Hardware PCB SVG Visualizer for MAICXEN EDGE Products.
 * Supports Smarty 23x5 LED Matrix, AledA V4 Relay/Dimmer Controller, and any future ESP32-S3 board.
 */
export function buildStylizedPcbSvg(prodId, opts = {}) {
  const {
    progressPct = -1,
    isError = false,
    customColor = null,
    isPoweredOn = true,
    maxWidth = null
  } = opts;

  const p = String(prodId || "smarty").toLowerCase();

  if (p === "aleda") {
    const activeRelays =
      progressPct >= 0
        ? Math.ceil((progressPct / 100) * 4)
        : isPoweredOn
        ? 4
        : 0;
    const relayGlow = isError
      ? "#ef4444"
      : progressPct >= 0
      ? "#06b6d4"
      : customColor || "#1da1f2";

    let topTerminals = "";
    for (let i = 0; i < 24; i++) {
      const cx = 56 + i * 16.5;
      topTerminals += `<rect x="${cx - 6}" y="8" width="13" height="22" rx="1.5" fill="#3a9d4e" stroke="#1e562b" stroke-width="0.8"/>`;
      topTerminals += `<circle cx="${cx + 0.5}" cy="18" r="4.2" fill="#94a3b8" stroke="#475569" stroke-width="0.8"/>`;
      topTerminals += `<line x1="${cx - 2.5}" y1="18" x2="${cx + 3.5}" y2="18" stroke="#334155" stroke-width="1"/>`;
      topTerminals += `<rect x="${cx - 3}" y="40" width="6" height="4" fill="#1e293b" stroke="#cbd5e1" stroke-width="0.5"/>`;
      topTerminals += `<rect x="${cx - 2}" y="48" width="4" height="2.5" fill="#d97706" stroke="#fde68a" stroke-width="0.4"/>`;
    }

    let relaysSvg = "";
    for (let r = 0; r < 4; r++) {
      const rx = 86 + r * 92;
      const isLit = r < activeRelays;
      const rColor = isLit ? relayGlow : "#1e3a5f";
      relaysSvg += `<rect x="${rx + 26}" y="150" width="24" height="7" rx="1" fill="#0f172a" stroke="#94a3b8" stroke-width="0.8"/>`;
      relaysSvg += `<text x="${rx + 38}" y="164" fill="#cbd5e1" font-size="6" text-anchor="middle" font-family="monospace">D${r + 2}</text>`;
      relaysSvg += `<rect x="${rx}" y="168" width="76" height="78" rx="4" fill="${rColor}" stroke="#bae6fd" stroke-width="1.2" ${
        isLit && progressPct >= 0 ? 'filter="drop-shadow(0 0 8px #06b6d4)"' : ""
      }/>`;
      relaysSvg += `<circle cx="${rx + 38}" cy="212" r="5" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
      relaysSvg += `<text x="${rx + 38}" y="186" fill="#082f49" font-size="7.5" font-weight="800" text-anchor="middle" font-family="sans-serif">RLY${r + 1}</text>`;
      relaysSvg += `<rect x="${rx + 6}" y="246" width="64" height="24" rx="2" fill="#10b981" stroke="#047857" stroke-width="1"/>`;
      for (let k = 0; k < 3; k++) {
        const scx = rx + 17 + k * 21;
        relaysSvg += `<circle cx="${scx}" cy="259" r="6" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
      }
    }

    let rightEncSvg = "";
    for (let b = 0; b < 3; b++) {
      const by = 86 + b * 36;
      rightEncSvg += `<rect x="448" y="${by}" width="24" height="31" rx="1.5" fill="#3a9d4e" stroke="#1e562b" stroke-width="0.8"/>`;
      for (let q = 0; q < 4; q++) {
        rightEncSvg += `<circle cx="460" cy="${by + 4.5 + q * 7.2}" r="2.6" fill="#cbd5e1"/>`;
      }
    }

    const mw = maxWidth || "460px";
    return `
      <svg viewBox="0 0 500 280" style="width:100%;max-width:${mw};height:auto;display:block;">
        <rect x="24" y="14" width="452" height="248" rx="10" fill="#122b54" stroke="#284e8a" stroke-width="2"/>
        <circle cx="38" cy="28" r="6" fill="#090d16" stroke="#64748b" stroke-width="2"/>
        <circle cx="460" cy="28" r="6" fill="#090d16" stroke="#64748b" stroke-width="2"/>
        <circle cx="38" cy="248" r="6" fill="#090d16" stroke="#64748b" stroke-width="2"/>
        <circle cx="460" cy="248" r="6" fill="#090d16" stroke="#64748b" stroke-width="2"/>
        ${topTerminals}
        <rect x="430" y="34" width="44" height="44" rx="3" fill="#3a9d4e" stroke="#1e562b" stroke-width="1.2"/>
        <circle cx="452" cy="46" r="7.5" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>
        <circle cx="452" cy="66" r="7.5" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>
        ${rightEncSvg}
        <rect x="24" y="76" width="22" height="44" rx="2" fill="#1e293b" stroke="#d4a64a" stroke-width="1"/>
        <path d="M28 82 h12 v6 h-10 v6 h10 v6 h-10 v6 h10 v6 h-12" fill="none" stroke="#eab308" stroke-width="1.4"/>
        <rect x="46" y="76" width="54" height="44" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.2"/>
        <text x="73" y="101" fill="#334155" font-size="7" font-weight="700" text-anchor="middle" font-family="monospace">ESP32-S3</text>
        <rect x="28" y="48" width="12" height="9" rx="1" fill="#f8fafc"/><circle cx="34" cy="52.5" r="2.3" fill="#0f172a"/>
        <rect x="48" y="128" width="12" height="9" rx="1" fill="#f8fafc"/><circle cx="54" cy="132.5" r="2.3" fill="#0f172a"/>
        <rect x="18" y="142" width="28" height="24" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
        <text x="32" y="156" fill="#334155" font-size="5.5" font-weight="700" text-anchor="middle">USB-C</text>
        <rect x="52" y="238" width="12" height="12" rx="1" fill="#f8fafc"/><circle cx="58" cy="244" r="3" fill="#0f172a"/>
        <rect x="148" y="64" width="38" height="16" rx="1.5" fill="#0f172a" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="210" y="66" width="48" height="34" rx="2" fill="none" stroke="#94a3b8" stroke-width="0.9"/>
        <circle cx="234" cy="83" r="11" fill="none" stroke="#d4a64a" stroke-width="1.4"/>
        <text x="206" y="114" fill="#f8fafc" font-size="13.5" font-weight="800" text-anchor="middle" font-family="sans-serif" letter-spacing="0.5">MAICXEN EDGE</text>
        <text x="195" y="131" fill="#e2e8f0" font-size="13" font-weight="800" text-anchor="middle" font-family="sans-serif">ALedaV4</text>
        <g transform="translate(268, 108) rotate(-8)">
          <rect x="0" y="0" width="46" height="32" rx="2" fill="#f8fafc"/>
          <line x1="0" y1="8" x2="46" y2="8" stroke="#122b54" stroke-width="2"/>
          <text x="23" y="19" fill="#122b54" font-size="5.5" font-weight="900" text-anchor="middle">MAICXEN</text>
          <text x="23" y="26" fill="#122b54" font-size="5.5" font-weight="900" text-anchor="middle">EDGE</text>
        </g>
        ${relaysSvg}
      </svg>
    `;
  }

  if (p === "smarty") {
    const filledCols =
      progressPct >= 0
        ? Math.round((Math.max(0, Math.min(100, progressPct)) / 100) * 23)
        : -1;
    const baseGlow = isError ? "#ef4444" : customColor || (isPoweredOn ? "#f59e0b" : "#334155");

    let capsAndLeds = "";
    for (let r = 0; r < 5; r++) {
      const ry = 44 + r * 20;
      capsAndLeds += `<line x1="42" y1="${ry}" x2="478" y2="${ry}" stroke="#1c3d72" stroke-width="3.2"/>`;
    }
    for (let c = 0; c < 23; c++) {
      const cx = 48 + c * 19;
      capsAndLeds += `<rect x="${cx - 4.5}" y="22" width="9" height="4.5" rx="0.8" fill="#d4a64a"/>`;
      capsAndLeds += `<rect x="${cx - 2}" y="22" width="4" height="4.5" fill="#78350f"/>`;
      for (let r = 0; r < 5; r++) {
        const cy = 44 + r * 20;
        let ledFill = isPoweredOn ? "#f1f5f9" : "#e2e8f0";
        let glowAttr = "";
        if (progressPct >= 0) {
          if (c < filledCols - 1) {
            ledFill = "#06b6d4";
            glowAttr = 'filter="drop-shadow(0 0 4px #06b6d4)"';
          } else if (c === filledCols - 1) {
            ledFill = "#ffffff";
            glowAttr = 'filter="drop-shadow(0 0 5px #ffffff)"';
          } else {
            ledFill = "#334155";
          }
        } else {
          const isBorder = r === 0 || r === 4 || c === 0 || c === 22;
          if (isBorder && isPoweredOn) {
            ledFill = baseGlow;
            glowAttr = `filter="drop-shadow(0 0 3px ${baseGlow})"`;
          }
        }
        capsAndLeds += `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" rx="1.5" fill="${ledFill}" stroke="#94a3b8" stroke-width="0.6" ${glowAttr}/>`;
      }
    }

    const mw = maxWidth || "520px";
    return `
      <svg viewBox="0 0 520 156" style="width:100%;max-width:${mw};height:auto;display:block;">
        <rect x="8" y="8" width="504" height="140" rx="22" fill="#132a4f" stroke="#284e8a" stroke-width="2"/>
        <circle cx="28" cy="26" r="7.5" fill="#090d16" stroke="#d4a64a" stroke-width="3.5"/>
        <circle cx="492" cy="26" r="7.5" fill="#090d16" stroke="#d4a64a" stroke-width="3.5"/>
        <circle cx="28" cy="130" r="7.5" fill="#090d16" stroke="#d4a64a" stroke-width="3.5"/>
        <circle cx="492" cy="130" r="7.5" fill="#090d16" stroke="#d4a64a" stroke-width="3.5"/>
        ${capsAndLeds}
      </svg>
    `;
  }

  if (p === "onir") {
    const irGlow = isError
      ? "#ef4444"
      : progressPct >= 0
      ? "#06b6d4"
      : customColor || (isPoweredOn ? "#a855f7" : "#475569");
    const waveOpacity = progressPct >= 0 ? 0.9 : isPoweredOn ? 0.85 : 0.2;
    const txLit = progressPct >= 0 || isPoweredOn;
    const mw = maxWidth || "440px";
    return `
      <svg viewBox="0 0 480 200" style="width:100%;max-width:${mw};height:auto;display:block;">
        <rect x="28" y="18" width="424" height="164" rx="14" fill="#122b54" stroke="#284e8a" stroke-width="2"/>
        <circle cx="46" cy="36" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
        <circle cx="434" cy="36" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
        <circle cx="46" cy="164" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
        <circle cx="434" cy="164" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
        <rect x="16" y="76" width="24" height="48" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1.2"/>
        <text x="28" y="103" fill="#334155" font-size="6.5" font-weight="800" text-anchor="middle" font-family="monospace">USB</text>
        <rect x="64" y="54" width="84" height="92" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
        <text x="106" y="96" fill="#1e293b" font-size="9.5" font-weight="800" text-anchor="middle" font-family="monospace">ESP32</text>
        <text x="106" y="110" fill="#475569" font-size="7" font-weight="700" text-anchor="middle" font-family="monospace">D1 MINI32</text>
        <text x="242" y="84" fill="#f8fafc" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">MAICXEN EDGE</text>
        <text x="242" y="105" fill="${irGlow}" font-size="13" font-weight="800" text-anchor="middle" font-family="monospace">onIR MATTER</text>
        <text x="242" y="124" fill="#94a3b8" font-size="8" font-weight="600" text-anchor="middle" font-family="monospace">GPIO26 TX · GPIO18 RX</text>
        <circle cx="364" cy="68" r="14" fill="${txLit ? irGlow : "#1e293b"}" stroke="#cbd5e1" stroke-width="1.5" ${
      txLit ? `filter="drop-shadow(0 0 8px ${irGlow})"` : ""
    }/>
        <text x="364" y="94" fill="#cbd5e1" font-size="7" font-weight="700" text-anchor="middle" font-family="monospace">IR TX</text>
        <path d="M388 54 Q404 68 388 82" fill="none" stroke="${irGlow}" stroke-width="2.5" stroke-linecap="round" opacity="${waveOpacity}"/>
        <path d="M398 46 Q420 68 398 90" fill="none" stroke="#00d2ff" stroke-width="2.2" stroke-linecap="round" opacity="${waveOpacity}"/>
        <rect x="350" y="118" width="28" height="26" rx="3" fill="#0f172a" stroke="#64748b" stroke-width="1.2"/>
        <circle cx="364" cy="131" r="7" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
        <text x="364" y="156" fill="#cbd5e1" font-size="7" font-weight="700" text-anchor="middle" font-family="monospace">IR RX 38kHz</text>
      </svg>
    `;
  }

  const accent = isError
    ? "#ef4444"
    : progressPct >= 0
    ? "#06b6d4"
    : customColor || "#38bdf8";
  const mw = maxWidth || "460px";
  return `
    <svg viewBox="0 0 480 180" style="width:100%;max-width:${mw};height:auto;display:block;">
      <rect x="20" y="14" width="440" height="152" rx="14" fill="#122b54" stroke="#284e8a" stroke-width="2"/>
      <circle cx="38" cy="32" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
      <circle cx="442" cy="32" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
      <circle cx="38" cy="148" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
      <circle cx="442" cy="148" r="6" fill="#090d16" stroke="#d4a64a" stroke-width="2.5"/>
      <rect x="60" y="54" width="76" height="72" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
      <text x="98" y="93" fill="#1e293b" font-size="9" font-weight="800" text-anchor="middle" font-family="monospace">ESP32-S3</text>
      <text x="275" y="84" fill="#f8fafc" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">MAICXEN EDGE</text>
      <text x="275" y="104" fill="${accent}" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">${p.toUpperCase()} PCB</text>
    </svg>
  `;
}
