import { useState, useRef, useEffect } from "react";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a structured analyst of interdisciplinary connections. The user will provide two or more texts from different fields. Your job is to identify deep structural homologies — shared patterns, analogous mechanisms, transferable methods, isomorphic problems — that are NOT obvious surface similarities.

Rules:
- Privilege structural and mechanistic parallels over topical overlap
- Name the abstract pattern that both fields instantiate
- For each connection, suggest a concrete "transfer" — a technique, framework, or insight from Field A that could generate novel work in Field B (and vice versa)
- Be specific. "Both involve complex systems" is worthless. "Both use negative feedback loops to maintain homeostasis under perturbation, but Field A has formalized the control theory while Field B relies on heuristic titration" is valuable.
- Identify at least one connection that would surprise an expert in either field
- Flag any false homologies that look tempting but break down on inspection

Respond ONLY in valid JSON with this exact structure (no markdown, no backticks, no preamble):
{
  "fields_detected": ["Field A name", "Field B name"],
  "connections": [
    {
      "id": "c1",
      "pattern_name": "Short name for the abstract pattern",
      "description": "2-3 sentences on the structural parallel",
      "field_a_instance": "How Field A instantiates this pattern",
      "field_b_instance": "How Field B instantiates this pattern",
      "transfer_a_to_b": "Concrete technique/insight transferable from A to B",
      "transfer_b_to_a": "Concrete technique/insight transferable from B to A",
      "surprise_rating": 1-5,
      "false_homology_warning": null or "Why this might break down"
    }
  ],
  "meta_pattern": "One sentence describing the deepest structural relationship between these fields overall",
  "generative_questions": ["3-5 research questions that emerge from these connections"]
}`;

const DEEPEN_PROMPT = `You previously identified a structural pattern across fields. The user is now testing whether this pattern extends to a new field by providing additional text.

The original pattern:
PATTERN_NAME: {{pattern_name}}
DESCRIPTION: {{description}}
ORIGINAL FIELDS: {{fields}}

New text from a potentially related field is provided below. Analyze whether the pattern holds, breaks down, or transforms when extended to this new domain.

Respond ONLY in valid JSON (no markdown, no backticks, no preamble):
{
  "extends": true or false,
  "new_field_detected": "Name of the new field",
  "new_instance": "How the new field instantiates (or fails to instantiate) this pattern",
  "transformation": "How the pattern changes or deepens when this third field is included. If it breaks, explain why.",
  "revised_pattern_name": "A more precise or general name for the pattern now that we see it across more domains",
  "revised_description": "2-3 sentences on what the pattern looks like at this higher level of abstraction",
  "new_transfers": [
    "Concrete transfer from new field to original fields",
    "Concrete transfer from original fields to new field"
  ],
  "breaking_point": null or "Where exactly the analogy fails for this new field"
}`;

const QUESTION_PROMPT = `You are a research strategist. The user has identified an interdisciplinary connection and wants to explore a specific generative question that emerged from it.

Context:
FIELDS: {{fields}}
META PATTERN: {{meta_pattern}}
QUESTION: {{question}}

Provide a substantive exploration of this question. Be concrete and actionable.

Respond ONLY in valid JSON (no markdown, no backticks, no preamble):
{
  "exploration": "3-5 sentences exploring why this question matters and what it would reveal",
  "existing_threads": ["2-3 existing research areas, papers, or frameworks that touch on this question — be specific with names and fields"],
  "methods_from_each_field": {
    "field_a": "What methodology from Field A could be brought to bear",
    "field_b": "What methodology from Field B could be brought to bear"
  },
  "study_sketch": "A 2-3 sentence sketch of what a study or project addressing this question might look like",
  "adjacent_questions": ["2 follow-up questions that would emerge from pursuing this one"]
}`;

const EXAMPLE_TEXTS = [
  {
    label: "Epidemiology × Beekeeping",
    texts: [
      { title: "Epidemiological Surveillance", content: "Sentinel surveillance systems use indicator organisms to detect environmental health threats before they manifest in human populations. The key insight is that certain species, due to their metabolic sensitivity and environmental exposure patterns, serve as early warning systems. Their colony-level behavioral changes — altered foraging patterns, brood abandonment, queen supersedure — encode information about contaminant gradients that would require expensive analytical chemistry to detect directly." },
      { title: "Apiculture & Colony Management", content: "Experienced beekeepers read hive health through indirect signals: the pitch of the colony's hum, the pattern of comb construction, the ratio of capped to uncapped brood. A master beekeeper can diagnose varroa mite infestation, nosema infection, or pesticide exposure from the landing board behavior alone. The colony is an information-processing system where individual bee decisions aggregate into legible population-level signatures." }
    ]
  },
  {
    label: "Surgery × Architecture",
    texts: [
      { title: "Intraoperative Decision-Making", content: "Expert surgeons navigate anatomical variation through a combination of pattern recognition and adaptive planning. The critical skill is not following a fixed procedure but maintaining situational awareness — continuously updating a mental model of the operative field as tissue planes are developed. When the expected anatomy diverges from the encountered anatomy, the surgeon must decide in real-time whether to persist with the planned approach or convert to an alternative." },
      { title: "Adaptive Reuse in Architecture", content: "The adaptive reuse of buildings requires architects to work within constraints imposed by existing structures. The most successful projects treat the original building not as an obstacle but as a generative constraint. The architect must read the structural logic of the existing building — load paths, material properties, spatial sequences — and find opportunities where new program can inhabit old form." }
    ]
  },
  {
    label: "Perfumery × Diagnostics",
    texts: [
      { title: "Perfume Composition", content: "A perfumer constructs a fragrance in temporal layers: top notes that announce, heart notes that define character, and base notes that persist. The art lies not in individual ingredients but in the transitions between phases — how a bright bergamot yields to jasmine, how jasmine is caught and held by vetiver. The perfumer must imagine the fragrance not as a static object but as an unfolding experience, predicting how molecular volatility will choreograph the wearer's sensory journey across hours." },
      { title: "Clinical Differential Diagnosis", content: "The experienced clinician builds a differential diagnosis through temporal pattern recognition. The presenting complaint is the top note — what brings the patient in. History and physical exam reveal the heart — the constellation of signs that narrow possibilities. Laboratory and imaging findings provide the base — the persistent, objective data against which clinical intuition is tested. A masterful diagnostician reads not just what is present but the sequence and timing of how findings declare themselves." }
    ]
  }
];

const C = {
  bg: "#FAF6F1", bgWarm: "#F5EFE7", surface: "#FFFFFF", surfaceHover: "#FBF8F4",
  border: "#E8E0D4", borderActive: "#C9B99A", borderGold: "#C4A265",
  text: "#2C2520", textBody: "#4A4038", textMuted: "#8A7E70", textDim: "#B5A998",
  accent: "#B8860B", accentSoft: "#C4A265", accentGlow: "rgba(196, 162, 101, 0.10)",
  field1: "#6B8F71", field1bg: "rgba(107, 143, 113, 0.08)",
  field2: "#9B6B5E", field2bg: "rgba(155, 107, 94, 0.08)",
  field3: "#7B7EA8", field3bg: "rgba(123, 126, 168, 0.08)",
  danger: "#B07060", dangerbg: "rgba(176, 112, 96, 0.06)",
  success: "#6B8F71", successbg: "rgba(107, 143, 113, 0.06)",
  warm100: "#F0E6D6", warm200: "#E2D5C0",
};

const fieldColorList = [
  { color: C.field1, bg: C.field1bg },
  { color: C.field2, bg: C.field2bg },
  { color: C.field3, bg: C.field3bg },
  { color: "#A8917B", bg: "rgba(168,145,123,0.08)" },
  { color: "#8B7BA8", bg: "rgba(139,123,168,0.08)" },
];

function generateMarkdown(result, texts) {
  const filledTexts = texts.filter(t => t.content.trim());
  let md = `# Fertile Margins Analysis\n\n`;
  md += `## Deep Structure\n\n`;
  md += `*${result.meta_pattern}*\n\n`;
  md += `**Fields:** ${result.fields_detected?.join(" × ")}\n\n`;
  md += `---\n\n`;
  md += `## Connections\n\n`;
  result.connections?.forEach((conn, i) => {
    md += `### ${i + 1}. ${conn.pattern_name}\n\n`;
    md += `${conn.description}\n\n`;
    md += `**${result.fields_detected?.[0] || "Field A"}:** ${conn.field_a_instance}\n\n`;
    md += `**${result.fields_detected?.[1] || "Field B"}:** ${conn.field_b_instance}\n\n`;
    md += `**Transfer ${result.fields_detected?.[0]} → ${result.fields_detected?.[1]}:** ${conn.transfer_a_to_b}\n\n`;
    md += `**Transfer ${result.fields_detected?.[1]} → ${result.fields_detected?.[0]}:** ${conn.transfer_b_to_a}\n\n`;
    if (conn.false_homology_warning) {
      md += `> ⚠ **Caution:** ${conn.false_homology_warning}\n\n`;
    }
    md += `Surprise rating: ${"●".repeat(conn.surprise_rating)}${"○".repeat(5 - conn.surprise_rating)}\n\n`;
  });
  if (result.generative_questions?.length) {
    md += `---\n\n## Generative Questions\n\n`;
    result.generative_questions.forEach((q, i) => {
      md += `${i + 1}. *${q}*\n`;
    });
    md += `\n`;
  }
  md += `---\n\n*Generated by [Fertile Margins](https://github.com/katesolpari/fertile-margins)*\n`;
  return md;
}

function App() {
  const [texts, setTexts] = useState([
    { id: 1, title: "", content: "" },
    { id: 2, title: "", content: "" },
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedQ, setExpandedQ] = useState({});
  const [loadingQ, setLoadingQ] = useState({});
  const [deepenMode, setDeepenMode] = useState(null);
  const [deepenText, setDeepenText] = useState({ title: "", content: "" });
  const [deepenResult, setDeepenResult] = useState(null);
  const [deepenLoading, setDeepenLoading] = useState(false);
  const nextId = useRef(3);
  const resultRef = useRef(null);
  const deepenRef = useRef(null);

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const addTextField = () => {
    if (texts.length >= 5) return;
    setTexts([...texts, { id: nextId.current++, title: "", content: "" }]);
  };
  const removeTextField = (id) => {
    if (texts.length <= 2) return;
    setTexts(texts.filter((t) => t.id !== id));
  };
  const updateText = (id, field, value) => {
    setTexts(texts.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };
  const loadExample = (example) => {
    const newTexts = example.texts.map((t) => ({ id: nextId.current++, title: t.title, content: t.content }));
    setTexts(newTexts);
    setResult(null); setError(null); setActiveConnection(null);
    setExpandedQ({}); setDeepenMode(null); setDeepenResult(null);
  };

  const analyze = async () => {
    const filledTexts = texts.filter((t) => t.content.trim());
    if (filledTexts.length < 2) { setError("Need at least two texts."); return; }
    setLoading(true); setError(null); setResult(null); setActiveConnection(null);
    setExpandedQ({}); setDeepenMode(null); setDeepenResult(null);
    const userMessage = filledTexts.map((t, i) => `--- TEXT ${i + 1}${t.title ? ` (${t.title})` : ""} ---\n${t.content}`).join("\n\n");
    try {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").filter(Boolean).join("");
      if (!text) throw new Error("Empty response");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
      setTimeout(() => { resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 200);
    } catch (err) { console.error(err); setError("Analysis failed. Check your connection and try again."); }
    finally { setLoading(false); }
  };

  const copyMarkdown = async () => {
    if (!result) return;
    const md = generateMarkdown(result, texts);
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("Couldn't copy to clipboard."); }
  };

  const exploreQuestion = async (question, index) => {
    if (expandedQ[index]) { setExpandedQ(prev => { const n = {...prev}; delete n[index]; return n; }); return; }
    setLoadingQ(prev => ({...prev, [index]: true}));
    const prompt = QUESTION_PROMPT
      .replace("{{fields}}", result.fields_detected?.join(" and ") || "the analyzed fields")
      .replace("{{meta_pattern}}", result.meta_pattern || "")
      .replace("{{question}}", question);
    try {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: prompt, messages: [{ role: "user", content: `Explore this question: ${question}` }] }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").filter(Boolean).join("");
      if (!text) throw new Error("Empty");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setExpandedQ(prev => ({...prev, [index]: parsed}));
    } catch (err) { console.error(err); }
    finally { setLoadingQ(prev => ({...prev, [index]: false})); }
  };

  const startDeepen = (conn) => {
    setDeepenMode(conn); setDeepenText({ title: "", content: "" }); setDeepenResult(null);
    setTimeout(() => { deepenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  };

  const runDeepen = async () => {
    if (!deepenText.content.trim() || !deepenMode) return;
    setDeepenLoading(true); setDeepenResult(null);
    const prompt = DEEPEN_PROMPT
      .replace("{{pattern_name}}", deepenMode.pattern_name)
      .replace("{{description}}", deepenMode.description)
      .replace("{{fields}}", result.fields_detected?.join(" and ") || "");
    try {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: prompt, messages: [{ role: "user", content: `New text${deepenText.title ? ` (${deepenText.title})` : ""}:\n${deepenText.content}` }] }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").filter(Boolean).join("");
      if (!text) throw new Error("Empty");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setDeepenResult(parsed);
    } catch (err) { console.error(err); }
    finally { setDeepenLoading(false); }
  };

  const surpriseDots = (n) => Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < n ? C.accent : C.warm200, fontSize: 8, letterSpacing: 3 }}>●</span>
  ));
  const fc = (i) => fieldColorList[i % fieldColorList.length];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgWarm} 100%)`, color: C.text, fontFamily: "'EB Garamond', 'Garamond', 'Georgia', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: ${C.warm200}; color: ${C.text}; }
        textarea:focus, input:focus { outline: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gentlePulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes warmShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .s1{animation-delay:.05s}.s2{animation-delay:.1s}.s3{animation-delay:.15s}.s4{animation-delay:.2s}.s5{animation-delay:.3s}
        .text-area{width:100%;background:transparent;border:none;color:${C.textBody};font-family:'EB Garamond',Georgia,serif;font-size:16px;line-height:1.75;resize:vertical;min-height:150px;padding:0}
        .text-area::placeholder{color:${C.textDim};font-style:italic}
        .title-input{width:100%;background:transparent;border:none;border-bottom:1px solid ${C.border};color:${C.text};font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:400;padding:0 0 10px 0;margin-bottom:18px;letter-spacing:.3px}
        .title-input::placeholder{color:${C.textDim};font-style:italic;font-weight:300}
        .card{background:${C.surface};border:1px solid ${C.border};border-radius:3px;box-shadow:0 1px 3px rgba(44,37,32,.04);transition:all .25s ease}
        .card:hover{box-shadow:0 2px 8px rgba(44,37,32,.07);border-color:${C.borderActive}}
        .conn-card{cursor:pointer;background:${C.surface};border:1px solid ${C.border};border-radius:3px;transition:all .25s ease;box-shadow:0 1px 3px rgba(44,37,32,.04)}
        .conn-card:hover{border-color:${C.borderActive};box-shadow:0 2px 8px rgba(44,37,32,.07)}
        .conn-card.active{border-color:${C.borderGold};background:${C.accentGlow};box-shadow:0 2px 12px rgba(196,162,101,.10)}
        .btn-primary{background:${C.accent};color:#FFFBF5;border:none;padding:13px 32px;font-family:'DM Mono',monospace;font-size:11px;font-weight:400;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:all .2s ease;box-shadow:0 1px 4px rgba(184,134,11,.15)}
        .btn-primary:hover{opacity:.9;box-shadow:0 2px 8px rgba(184,134,11,.2)}
        .btn-primary:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
        .btn-ghost{background:none;color:${C.textMuted};border:1px solid ${C.border};padding:9px 18px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer;border-radius:2px;transition:all .2s ease}
        .btn-ghost:hover{color:${C.text};border-color:${C.borderActive}}
        .btn-sm{padding:7px 14px;font-size:10px;letter-spacing:1px}
        .chip{background:${C.surface};border:1px solid ${C.border};color:${C.textMuted};padding:6px 14px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.5px;cursor:pointer;border-radius:2px;transition:all .2s ease}
        .chip:hover{border-color:${C.accentSoft};color:${C.accent};background:${C.accentGlow}}
        .loading-line{height:1px;background:linear-gradient(90deg,transparent,${C.accentSoft},transparent);background-size:200% 100%;animation:warmShimmer 2s ease infinite}
        .field-tag{display:inline-block;padding:3px 10px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;border-radius:2px}
        .transfer-box{padding:18px 20px;background:${C.bgWarm};border:1px solid ${C.border};border-radius:2px;font-size:15px;line-height:1.7;color:${C.textBody}}
        .transfer-label{display:inline-block;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;color:${C.accentSoft};margin-right:10px}
        .question-item{padding:14px 20px;border-left:2px solid ${C.warm200};color:${C.textMuted};font-size:16px;line-height:1.6;transition:all .2s ease;cursor:pointer}
        .question-item:hover{border-left-color:${C.accentSoft};color:${C.textBody}}
        .question-item.active{border-left-color:${C.accent};color:${C.text}}
        .section-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2.5px;color:${C.textDim};text-transform:uppercase;display:block;margin-bottom:14px}
        .ornament{display:block;text-align:center;color:${C.warm200};font-size:14px;letter-spacing:12px;margin:40px 0;font-family:'Cormorant Garamond',serif}
        .explore-panel{padding:24px;background:${C.bgWarm};border:1px solid ${C.border};border-radius:2px;margin-top:12px}
        .deepen-panel{background:${C.surface};border:1px solid ${C.borderGold};border-radius:3px;padding:32px;margin-top:32px;box-shadow:0 2px 12px rgba(196,162,101,.08)}
      `}</style>

      <header style={{ padding: "56px 52px 0", maxWidth: 1100, margin: "0 auto", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(-8px)", transition: "all .7s ease" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 42, fontWeight: 300, fontStyle: "italic", color: C.text, letterSpacing: ".5px", lineHeight: 1.1 }}>Fertile Margins</h1>
        <p style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: 17, color: C.textMuted, maxWidth: 580, lineHeight: 1.7, fontWeight: 400, marginTop: 12 }}>
          Paste texts from different fields. The system finds structural homologies — shared patterns, transferable methods, isomorphic problems — that neither field sees on its own.
        </p>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 52px 100px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 36, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginRight: 2 }}>Try</span>
          {EXAMPLE_TEXTS.map((ex) => (
            <button key={ex.label} className="chip" onClick={() => loadExample(ex)}>{ex.label}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: texts.length <= 2 ? "1fr 1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginBottom: 30 }}>
          {texts.map((t, i) => (
            <div key={t.id} className={`card fade-up s${i + 1}`} style={{ padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: fc(i).color, textTransform: "uppercase" }}>
                  Text {String.fromCharCode(65 + i)}
                </span>
                {texts.length > 2 && (
                  <button onClick={() => removeTextField(t.id)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>×</button>
                )}
              </div>
              <input className="title-input" placeholder="Field or title..." value={t.title} onChange={(e) => updateText(t.id, "title", e.target.value)} />
              <textarea className="text-area" placeholder="Paste a passage from this field..." value={t.content} onChange={(e) => updateText(t.id, "content", e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 48 }}>
          <button className="btn-primary" onClick={analyze} disabled={loading || texts.filter((t) => t.content.trim()).length < 2}>
            {loading ? "Analyzing..." : "Find Connections"}
          </button>
          {texts.length < 5 && <button className="btn-ghost" onClick={addTextField}>+ Add field</button>}
        </div>

        {loading && (
          <div style={{ marginBottom: 48 }}>
            <div className="loading-line" style={{ width: "100%", marginBottom: 18 }} />
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: C.textDim, letterSpacing: 1.5, animation: "gentlePulse 2.5s ease infinite" }}>
              Mapping structural homologies across fields...
            </p>
          </div>
        )}

        {error && (
          <div style={{ padding: 20, border: `1px solid ${C.danger}`, background: C.dangerbg, borderRadius: 3, marginBottom: 32, fontSize: 15, color: C.danger, lineHeight: 1.6 }}>
            {error}
          </div>
        )}

        {result && (
          <div ref={resultRef}>
            {/* Export bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="btn-ghost btn-sm" onClick={copyMarkdown} style={{ color: copied ? C.success : C.textMuted, borderColor: copied ? C.success : C.border }}>
                {copied ? "Copied" : "Copy as Markdown"}
              </button>
            </div>

            {/* Meta pattern */}
            <div className="fade-up" style={{ borderTop: `1px solid ${C.borderGold}`, padding: "32px 0 36px", marginBottom: 12 }}>
              <span className="section-label" style={{ color: C.accentSoft }}>Deep Structure</span>
              <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, fontStyle: "italic", fontWeight: 300, color: C.text, lineHeight: 1.55, maxWidth: 680 }}>
                {result.meta_pattern}
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                {result.fields_detected?.map((f, i) => (
                  <span key={f} className="field-tag" style={{ background: fc(i).bg, color: fc(i).color }}>{f}</span>
                ))}
              </div>
            </div>

            <span className="ornament">· · ·</span>

            {/* Connections */}
            <div style={{ display: "grid", gridTemplateColumns: activeConnection ? "360px 1fr" : "1fr", gap: 24, marginBottom: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <span className="section-label">Connections ({result.connections?.length || 0})</span>
                {result.connections?.map((conn, i) => (
                  <div key={conn.id} className={`conn-card fade-up s${i + 1} ${activeConnection?.id === conn.id ? "active" : ""}`}
                    onClick={() => setActiveConnection(activeConnection?.id === conn.id ? null : conn)}
                    style={{ padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, fontWeight: 500, color: C.text }}>{conn.pattern_name}</h3>
                      <div style={{ flexShrink: 0, marginLeft: 12 }}>{surpriseDots(conn.surprise_rating)}</div>
                    </div>
                    <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65 }}>{conn.description}</p>
                  </div>
                ))}
              </div>

              {activeConnection && (
                <div className="card fade-up" style={{ padding: 36, alignSelf: "start" }}>
                  <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 400, marginBottom: 10, color: C.text }}>{activeConnection.pattern_name}</h3>
                  <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.75, marginBottom: 32 }}>{activeConnection.description}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                    {[0, 1].map((idx) => (
                      <div key={idx}>
                        <span className="field-tag" style={{ background: fc(idx).bg, color: fc(idx).color, marginBottom: 12, display: "inline-block" }}>
                          {result.fields_detected?.[idx] || `Field ${idx === 0 ? "A" : "B"}`}
                        </span>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginTop: 10 }}>
                          {idx === 0 ? activeConnection.field_a_instance : activeConnection.field_b_instance}
                        </p>
                      </div>
                    ))}
                  </div>

                  <span className="section-label">Transfers</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                    <div className="transfer-box">
                      <span className="transfer-label">{result.fields_detected?.[0]?.slice(0, 4)?.toUpperCase()} → {result.fields_detected?.[1]?.slice(0, 4)?.toUpperCase()}</span>
                      {activeConnection.transfer_a_to_b}
                    </div>
                    <div className="transfer-box">
                      <span className="transfer-label">{result.fields_detected?.[1]?.slice(0, 4)?.toUpperCase()} → {result.fields_detected?.[0]?.slice(0, 4)?.toUpperCase()}</span>
                      {activeConnection.transfer_b_to_a}
                    </div>
                  </div>

                  {activeConnection.false_homology_warning && (
                    <div style={{ padding: 18, borderLeft: `2px solid ${C.danger}`, background: C.dangerbg, borderRadius: 2, fontSize: 14, color: C.textMuted, lineHeight: 1.7, fontStyle: "italic", marginBottom: 24 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: C.danger, textTransform: "uppercase", display: "block", marginBottom: 6, fontStyle: "normal" }}>Caution</span>
                      {activeConnection.false_homology_warning}
                    </div>
                  )}

                  {/* Deepen button */}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8 }}>
                    <button className="btn-ghost btn-sm" onClick={() => startDeepen(activeConnection)}
                      style={{ color: C.accent, borderColor: C.borderGold }}>
                      Test this pattern against a new field →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Deepen panel */}
            {deepenMode && (
              <div ref={deepenRef} className="deepen-panel fade-up">
                <span className="section-label" style={{ color: C.accent }}>
                  Deepen: Does "{deepenMode.pattern_name}" extend?
                </span>
                <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7, marginBottom: 20, maxWidth: 600 }}>
                  Paste a text from a third field to test whether this structural pattern holds, transforms, or breaks when extended beyond {result.fields_detected?.join(" and ")}.
                </p>
                <div style={{ maxWidth: 560, marginBottom: 20 }}>
                  <input className="title-input" placeholder="New field or title..."
                    value={deepenText.title} onChange={e => setDeepenText(p => ({...p, title: e.target.value}))} />
                  <textarea className="text-area" style={{ minHeight: 100 }} placeholder="Paste a passage from the new field..."
                    value={deepenText.content} onChange={e => setDeepenText(p => ({...p, content: e.target.value}))} />
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button className="btn-primary" style={{ padding: "10px 24px" }} onClick={runDeepen}
                    disabled={deepenLoading || !deepenText.content.trim()}>
                    {deepenLoading ? "Testing..." : "Test Extension"}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => { setDeepenMode(null); setDeepenResult(null); }}>Cancel</button>
                </div>

                {deepenLoading && <div className="loading-line" style={{ width: "100%", marginTop: 20 }} />}

                {deepenResult && (
                  <div className="fade-up" style={{ marginTop: 28, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 1,
                        color: deepenResult.extends ? C.success : C.danger,
                        textTransform: "uppercase",
                      }}>
                        {deepenResult.extends ? "Pattern extends" : "Pattern breaks"}
                      </span>
                      {deepenResult.new_field_detected && (
                        <span className="field-tag" style={{ background: fc(2).bg, color: fc(2).color }}>
                          {deepenResult.new_field_detected}
                        </span>
                      )}
                    </div>

                    {deepenResult.revised_pattern_name && (
                      <h4 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, fontWeight: 400, marginBottom: 8, color: C.text }}>
                        {deepenResult.revised_pattern_name}
                      </h4>
                    )}
                    {deepenResult.revised_description && (
                      <p style={{ fontSize: 15, color: C.textBody, lineHeight: 1.7, marginBottom: 20, maxWidth: 600 }}>
                        {deepenResult.revised_description}
                      </p>
                    )}

                    <p style={{ fontSize: 15, color: C.textBody, lineHeight: 1.7, marginBottom: 20 }}>
                      {deepenResult.new_instance}
                    </p>

                    {deepenResult.transformation && (
                      <div className="transfer-box" style={{ marginBottom: 16 }}>
                        <span className="transfer-label">Transformation</span>
                        {deepenResult.transformation}
                      </div>
                    )}

                    {deepenResult.new_transfers?.map((t, i) => (
                      <div key={i} className="transfer-box" style={{ marginBottom: 8 }}>
                        <span className="transfer-label">{i === 0 ? "New → Original" : "Original → New"}</span>
                        {t}
                      </div>
                    ))}

                    {deepenResult.breaking_point && (
                      <div style={{ padding: 18, borderLeft: `2px solid ${C.danger}`, background: C.dangerbg, borderRadius: 2, fontSize: 14, color: C.textMuted, lineHeight: 1.7, fontStyle: "italic", marginTop: 16 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: C.danger, textTransform: "uppercase", display: "block", marginBottom: 6, fontStyle: "normal" }}>Breaking point</span>
                        {deepenResult.breaking_point}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generative questions */}
            {result.generative_questions?.length > 0 && (
              <div className="fade-up s4" style={{ marginTop: deepenMode ? 40 : 0 }}>
                <span className="ornament">· · ·</span>
                <span className="section-label">Generative Questions</span>
                <p style={{ fontSize: 14, color: C.textDim, marginBottom: 18, marginTop: -6 }}>
                  Click a question to explore it further.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.generative_questions.map((q, i) => (
                    <div key={i}>
                      <div className={`question-item ${expandedQ[i] ? "active" : ""}`}
                        onClick={() => exploreQuestion(q, i)}
                        style={{ fontStyle: "italic", position: "relative" }}>
                        {q}
                        {loadingQ[i] && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.accentSoft, marginLeft: 8, fontStyle: "normal" }}>loading...</span>}
                      </div>

                      {expandedQ[i] && (
                        <div className="explore-panel fade-up" style={{ marginLeft: 20 }}>
                          <p style={{ fontSize: 15, color: C.textBody, lineHeight: 1.75, marginBottom: 20 }}>
                            {expandedQ[i].exploration}
                          </p>

                          {expandedQ[i].existing_threads?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <span className="section-label">Existing threads</span>
                              {expandedQ[i].existing_threads.map((t, j) => (
                                <p key={j} style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 6, paddingLeft: 12, borderLeft: `1px solid ${C.warm200}` }}>{t}</p>
                              ))}
                            </div>
                          )}

                          {expandedQ[i].methods_from_each_field && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                              <div className="transfer-box" style={{ fontSize: 14 }}>
                                <span className="transfer-label">{result.fields_detected?.[0] || "Field A"} methods</span><br/>
                                {expandedQ[i].methods_from_each_field.field_a}
                              </div>
                              <div className="transfer-box" style={{ fontSize: 14 }}>
                                <span className="transfer-label">{result.fields_detected?.[1] || "Field B"} methods</span><br/>
                                {expandedQ[i].methods_from_each_field.field_b}
                              </div>
                            </div>
                          )}

                          {expandedQ[i].study_sketch && (
                            <div style={{ padding: 18, background: C.surface, border: `1px solid ${C.borderGold}`, borderRadius: 2, marginBottom: 16 }}>
                              <span className="section-label" style={{ color: C.accent }}>Study sketch</span>
                              <p style={{ fontSize: 15, color: C.textBody, lineHeight: 1.7 }}>{expandedQ[i].study_sketch}</p>
                            </div>
                          )}

                          {expandedQ[i].adjacent_questions?.length > 0 && (
                            <div>
                              <span className="section-label">Follow-up questions</span>
                              {expandedQ[i].adjacent_questions.map((aq, j) => (
                                <p key={j} style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, fontStyle: "italic", marginBottom: 4 }}>{aq}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: "center", padding: "64px 0", opacity: mounted ? 1 : 0, transition: "opacity .8s ease .6s" }}>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontStyle: "italic", fontWeight: 300, color: C.textDim, maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>
              The most generative ideas live at the boundaries between disciplines.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
