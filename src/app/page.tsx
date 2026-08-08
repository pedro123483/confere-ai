"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type AnyStyle = React.CSSProperties;

// ─── Design tokens ─────────────────────────────────────────────────────────────
const F = "'Inter','Helvetica Neue',Helvetica,sans-serif";
const FM = "'DM Mono','JetBrains Mono',monospace";
const W = { maxWidth: 1140, margin: "0 auto", padding: "0 40px" } as AnyStyle;

// ─── Mobile breakpoint hook ───────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Intersection observer hook ────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── Reveal wrapper ────────────────────────────────────────────────────────────
function R({
  children,
  d = 0,
  s = {},
}: {
  children: React.ReactNode;
  d?: number;
  s?: AnyStyle;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: `opacity .6s cubic-bezier(.22,.68,0,.98) ${d}s, transform .6s cubic-bezier(.22,.68,0,.98) ${d}s`,
        ...s,
      }}
    >
      {children}
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({
  end,
  prefix = "",
  suffix = "",
}: {
  end: number;
  prefix?: string;
  suffix?: string;
}) {
  const { ref, inView } = useInView();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const step = Math.max(1, Math.floor(end / 40));
    const id = setInterval(() => {
      cur += step;
      if (cur >= end) { setN(end); clearInterval(id); } else setN(cur);
    }, 28);
    return () => clearInterval(id);
  }, [inView, end]);
  return (
    <span ref={ref}>
      {prefix}{n.toLocaleString("pt-BR")}{suffix}
    </span>
  );
}

// ─── SVG icons ─────────────────────────────────────────────────────────────────
const CheckIcon = ({ c = "#111" }: { c?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13 4L6.5 11 3 7.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M9 3L3 9M3 3l6 6" stroke="#b91c1c" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 4v10M4 9h10" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M4 9h10" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── CTA button style ──────────────────────────────────────────────────────────
const btnPrimary: AnyStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 24px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14.5,
  fontWeight: 500,
  fontFamily: F,
  cursor: "pointer",
  textDecoration: "none",
  transition: "background .15s",
  whiteSpace: "nowrap" as const,
};

// ─── Animated CT-e Receipt ────────────────────────────────────────────────────
function AuditReceipt() {
  const [step, setStep] = useState(-1);
  const { ref, inView } = useInView();

  useEffect(() => { if (inView) setTimeout(() => setStep(0), 500); }, [inView]);
  useEffect(() => {
    if (step >= 0 && step < 6) {
      const t = setTimeout(() => setStep((s) => s + 1), 520);
      return () => clearTimeout(t);
    }
  }, [step]);

  const rows = [
    { l: "Frete-Peso", ch: "1.240", ex: "1.180", d: "60", e: true },
    { l: "GRIS 0,3%", ch: "142", ex: "142", d: "—", e: false },
    { l: "Ad Valorem", ch: "475", ex: "380", d: "95", e: true },
    { l: "Pedágio", ch: "86", ex: "86", d: "—", e: false },
    { l: "Despacho", ch: "35", ex: "18", d: "17", e: true },
    { l: "TDE", ch: "48", ex: "0", d: "48", e: true },
  ];
  const done = step >= 6;

  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e5e5e5",
        overflow: "hidden",
        maxWidth: 480,
        width: "100%",
        fontFamily: FM,
        boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 20px 60px rgba(0,0,0,.07)",
      }}
    >
      {/* header */}
      <div style={{ padding: "16px 22px 14px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: "#aaa", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            Auditoria CT-e #38291
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            LogExpress · SP → RJ · 1.420 kg
          </div>
        </div>
        <div style={{
          padding: "3px 10px",
          background: done ? "rgba(5,150,105,0.15)" : "rgba(234,179,8,0.12)",
          border: `1px solid ${done ? "rgba(5,150,105,0.3)" : "rgba(234,179,8,0.2)"}`,
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 600,
          color: done ? "#059669" : "#a16207",
          transition: "all .4s",
        }}>
          {done ? "4 divergências" : "Analisando..."}
        </div>
      </div>

      {/* col headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 68px 22px", padding: "8px 22px 6px", fontSize: 9, fontWeight: 600, color: "#bbb", letterSpacing: ".06em", textTransform: "uppercase" }}>
        <span>Componente</span>
        <span style={{ textAlign: "right" }}>Cobrado</span>
        <span style={{ textAlign: "right" }}>Correto</span>
        <span style={{ textAlign: "right" }}>Diff</span>
        <span />
      </div>

      {/* rows */}
      <div style={{ padding: "2px 0 4px" }}>
        {rows.map((row, i) => {
          const show = i < step;
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 72px 72px 68px 22px",
                alignItems: "center",
                padding: "7px 22px",
                fontSize: 12,
                opacity: show ? 1 : 0.08,
                transition: "opacity .3s, background .3s",
                background: show && row.e ? "rgba(185,28,28,0.06)" : "transparent",
                borderLeft: show && row.e ? "2px solid rgba(185,28,28,0.5)" : "2px solid transparent",
              }}
            >
              <span style={{ color: "#222", fontWeight: 500, fontFamily: F, fontSize: 12.5 }}>{row.l}</span>
              <span style={{ textAlign: "right", color: show && row.e ? "#ef4444" : "#bbb", textDecoration: show && row.e ? "line-through" : "none" }}>
                {row.ch}
              </span>
              <span style={{ textAlign: "right", color: show && row.e ? "#059669" : "#bbb", fontWeight: show && row.e ? 600 : 400 }}>
                {row.ex}
              </span>
              <span style={{ textAlign: "right", color: show && row.e ? "#ef4444" : "#ccc", fontWeight: show && row.e ? 600 : 400, fontSize: 11.5 }}>
                {show && row.e ? `+${row.d}` : row.d}
              </span>
              <span style={{ display: "flex", justifyContent: "center" }}>
                {show ? (row.e ? <XIcon /> : <CheckIcon c="#059669" />) : null}
              </span>
            </div>
          );
        })}
      </div>

      {/* footer */}
      <div style={{
        padding: "14px 22px 18px",
        borderTop: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: done ? 1 : 0,
        transition: "opacity .5s .15s",
      }}>
        <span style={{ fontSize: 11.5, color: "#999", fontFamily: F }}>
          Valor recuperável neste CT-e
        </span>
        <span style={{ fontSize: 22, fontWeight: 900, color: "#059669", fontFamily: F }}>
          R$ 220
        </span>
      </div>
    </div>
  );
}

// ─── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #e5e5e5" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: F,
          gap: 16,
        }}
      >
        <span style={{ fontSize: 15.5, fontWeight: 500, color: "#111", textAlign: "left" }}>{q}</span>
        <span style={{ flexShrink: 0 }}>{open ? <MinusIcon /> : <PlusIcon />}</span>
      </button>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height .3s cubic-bezier(.22,.68,0,.98)" }}>
        <p style={{ fontSize: 14.5, color: "#666", lineHeight: 1.7, margin: 0, paddingBottom: 22, fontFamily: F }}>{a}</p>
      </div>
    </div>
  );
}

// ─── Hover card wrapper ────────────────────────────────────────────────────────
function HoverCard({ children, style = {} }: { children: React.ReactNode; style?: AnyStyle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transition: "transform .2s, box-shadow .2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 6px 24px rgba(0,0,0,0.06)" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  const WW = { ...W, padding: isMobile ? "0 20px" : "0 40px" } as AnyStyle;

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ fontFamily: F, color: "#111", background: "#fff", overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 60,
        background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid #eee" : "1px solid transparent",
        transition: "all .25s",
      }}>
        <div style={{ ...WW, display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-.02em" }}>Confere</span>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 32 }}>
            {!isMobile && (["Como funciona", "Resultados"] as const).map((label, i) => (
              <a key={i} href={`#s${i}`} style={{ fontSize: 14, fontWeight: 500, color: "#666", textDecoration: "none" }}>
                {label}
              </a>
            ))}
            <a
              href="#cta"
              style={{ ...btnPrimary, padding: "8px 18px", fontSize: 13.5 }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#333")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#111")}
            >
              Auditar grátis
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: isMobile ? 100 : 136, paddingBottom: isMobile ? 56 : 80, background: "#f7f7f5" }}>
        <div style={WW}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 40 : 64, alignItems: "center" }}>
            <div>
              <R>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>
                  Auditoria de Fretes · Inteligência Artificial
                </p>
              </R>
              <R d={0.06}>
                <h1 style={{ fontSize: "clamp(38px, 4.2vw, 56px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-.03em", color: "#111", marginBottom: 24 }}>
                  Cada cobrança<br />
                  indevida,<br />
                  identificada.
                </h1>
              </R>
              <R d={0.12}>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: "#666", maxWidth: 440, marginBottom: 32 }}>
                  Envie seus CT-es e tabelas de frete. Nossa IA audita cada componente — frete-peso, GRIS, ad valorem, pedágio, TDE — e entrega um relatório com tudo que você está pagando a mais.
                </p>
              </R>
              <R d={0.16}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a
                    href="#cta"
                    style={btnPrimary}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#333")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#111")}
                  >
                    Auditar 100 CT-es grátis <ArrowRight />
                  </a>
                  <a href="#s0" style={{ ...btnPrimary, background: "transparent", color: "#666", border: "1px solid #ddd" }}
                    onMouseEnter={(e) => { const el = e.target as HTMLElement; el.style.background = "#f0f0f0"; el.style.color = "#111"; }}
                    onMouseLeave={(e) => { const el = e.target as HTMLElement; el.style.background = "transparent"; el.style.color = "#666"; }}
                  >
                    Ver como funciona
                  </a>
                </div>
              </R>
              <R d={0.2}>
                <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
                  {["Sem software para instalar", "100% dos CT-es auditados", "Resultado em horas"].map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#999" }}>
                      <CheckIcon c="#999" /> {f}
                    </div>
                  ))}
                </div>
              </R>
            </div>
            <R d={0.1} s={{ display: "flex", justifyContent: isMobile ? "center" : "flex-end" }}>
              <AuditReceipt />
            </R>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "36px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ ...WW, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 18 }}>
            Feito para quem paga frete
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 16 : 48, alignItems: "center", opacity: 0.4, flexWrap: "wrap" }}>
            {["Indústria Alimentícia", "E-commerce", "Atacado Distribuidor", "Transportadoras", "Logística 3PL"].map((n) => (
              <span key={n} style={{ fontSize: 13.5, fontWeight: 700, color: "#111", letterSpacing: "-.01em" }}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="s0" style={{ padding: isMobile ? "64px 0" : "96px 0", borderBottom: "1px solid #eee", background: "#f7f7f5" }}>
        <div style={WW}>
          <R>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              Como funciona
            </p>
          </R>
          <R d={0.04}>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", maxWidth: 600, marginBottom: 14 }}>
              Do envio ao relatório em horas, não semanas.
            </h2>
          </R>
          <R d={0.08}>
            <p style={{ fontSize: 16, color: "#666", maxWidth: 500, marginBottom: 56, lineHeight: 1.7 }}>
              Não é software que você precisa configurar. É um serviço — você envia, a IA audita, você recebe o resultado pronto para contestação.
            </p>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {[
              {
                n: "01",
                title: "Envie os documentos",
                desc: "CT-es em XML e suas tabelas de frete em Excel ou PDF. Qualquer transportadora, qualquer formato.",
              },
              {
                n: "02",
                title: "A IA audita tudo",
                desc: "Frete-peso, GRIS, ad valorem, pedágio, despacho, ICMS — cada componente verificado contra a tabela contratada.",
              },
              {
                n: "03",
                title: "Relatório com evidência",
                desc: "Cada divergência referencia o CT-e, o componente com erro, o valor cobrado vs. esperado, e a cláusula contratual para contestação.",
              },
            ].map((c, i) => (
              <R key={i} d={i * 0.06}>
                <HoverCard style={{ padding: 28, background: "#f7f7f5", borderRadius: 12, border: "1px solid #eee", height: "100%" }}>
                  <p style={{ fontSize: 32, fontWeight: 900, color: "#e5e5e5", fontFamily: F, marginBottom: 18, letterSpacing: "-.02em" }}>{c.n}</p>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: "#111", marginBottom: 10, lineHeight: 1.3, letterSpacing: "-.01em" }}>{c.title}</h3>
                  <p style={{ fontSize: 14, color: "#777", lineHeight: 1.7 }}>{c.desc}</p>
                </HoverCard>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 0" : "96px 0", borderBottom: "1px solid #eee" }}>
        <div style={WW}>
          <R>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              Cobertura completa
            </p>
          </R>
          <R d={0.04}>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", maxWidth: 660, marginBottom: 14 }}>
              Tudo que você precisa para auditar, recuperar e garantir conformidade.
            </h2>
          </R>
          <R d={0.08}>
            <p style={{ fontSize: 16, color: "#666", maxWidth: 520, marginBottom: 56, lineHeight: 1.7 }}>
              Sistemas legados são planilhas digitais. A Confere automatiza o trabalho, do upload do CT-e ao relatório de divergências — componente por componente.
            </p>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {[
              { title: "Frete-Peso", label: "Peso & Cubagem", desc: "Faixa de peso correta, cubagem e alíquota aplicada verificadas contra a tabela vigente. Nenhuma cobrança por engano passa." },
              { title: "GRIS & Ad Valorem", label: "Taxas Percentuais", desc: "Percentuais sobre o valor da NF conferidos contra o contrato. Mínimos e máximos validados automaticamente." },
              { title: "Pedágio & Despacho", label: "Taxas de Rota", desc: "Tabelas de pedágio por rota e taxas de despacho auditadas contra os valores contratados por trecho." },
              { title: "TDE & Acessórias", label: "Taxas Extras", desc: "Taxa de Dificuldade de Entrega e todas as taxas extras verificadas cláusula por cláusula. Sem surpresas na fatura." },
              { title: "Auditoria Fiscal", label: "ICMS & Reforma Tributária", desc: "Alíquotas por UF de origem e destino. Preparado para IBS e CBS da Reforma Tributária." },
              { title: "Interpretação Inteligente", label: "Tabelas sem Cadastro", desc: "Envie em Excel ou PDF. O agente interpreta faixas, percentuais, regras de pedágio e exceções sem configuração manual." },
            ].map((c, i) => (
              <R key={i} d={i * 0.05}>
                <HoverCard style={{ padding: 28, background: "#fff", borderRadius: 12, border: "1px solid #eee", height: "100%" }}>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: "#999", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14, fontFamily: FM }}>{c.label}</p>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: "#111", marginBottom: 10, lineHeight: 1.3, letterSpacing: "-.01em" }}>{c.title}</h3>
                  <p style={{ fontSize: 14, color: "#777", lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
                </HoverCard>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ── NUMBERS ─────────────────────────────────────────────────────────── */}
      <section id="s1" style={{ padding: isMobile ? "64px 0" : "80px 0", borderBottom: "1px solid #eee", background: "#f7f7f5" }}>
        <div style={WW}>
          <R>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              Os números do setor
            </p>
          </R>
          <R d={0.04}>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", maxWidth: 540, marginBottom: 14 }}>
              Você está pagando mais do que deveria.
            </h2>
          </R>
          <R d={0.08}>
            <p style={{ fontSize: 16, color: "#666", maxWidth: 500, marginBottom: 56, lineHeight: 1.7 }}>
              A conferência manual consome tempo, gera erros e deixa dinheiro na mesa.
            </p>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", borderTop: "1px solid #e5e5e5" }}>
            {[
              { px: "até ", v: 8, sx: "%", label: "das cobranças de frete divergem do contrato: tabela errada, adicional indevido, cubagem distorcida." },
              { v: 8.5, sx: "%", label: "do PIB brasileiro é gasto só com transporte — a maior fatia do custo logístico do país." },
              { v: 168, sx: "h", label: "para cancelar um CT-e com erro. Depois disso, só contestação." },
            ].map((n, i) => (
              <R key={i} d={i * 0.06}>
                <div style={{ padding: isMobile ? "32px 0" : "40px 32px 40px 0", borderRight: !isMobile && i < 2 ? "1px solid #e5e5e5" : "none", paddingLeft: !isMobile && i > 0 ? 32 : 0, borderBottom: isMobile && i < 2 ? "1px solid #e5e5e5" : "none" }}>
                  <div style={{ fontSize: 40, fontWeight: 900, color: "#111", letterSpacing: "-.025em", marginBottom: 12 }}>
                    <Counter end={n.v} prefix={n.px} suffix={n.sx} />
                  </div>
                  <p style={{ fontSize: 14, color: "#777", lineHeight: 1.65 }}>{n.label}</p>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 0" : "96px 0", borderBottom: "1px solid #eee" }}>
        <div style={WW}>
          <R>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              O mercado fala
            </p>
          </R>
          <R d={0.04}>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", maxWidth: 520, marginBottom: 48 }}>
              O problema é real. Profissionais confirmam.
            </h2>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            {[
              { q: "O método que eu presenciei é bem moroso — conferência unitária de cada frete cobrado. O tempo do colaborador é full nessa atividade, e o risco de não ter assertividade permite muitas vezes a cobrança de fretes errados.", who: "Analista de Logística", role: "Embarcador, Indústria" },
              { q: "CT-e errado gera escrituração fiscal errada, e tem prazo para cancelar. O maior desafio é garantir que todos os documentos emitidos estão sendo auditados. Sempre tem espaço para melhoria.", who: "Renato Maciel Saade", role: "Especialista em Conformidade Fiscal" },
            ].map((t, i) => (
              <R key={i} d={i * 0.06}>
                <HoverCard style={{ padding: 32, background: "#f7f7f5", borderRadius: 12, border: "1px solid #eee", height: "100%" }}>
                  <p style={{ fontSize: 15, color: "#333", lineHeight: 1.7, marginBottom: 24 }}>&ldquo;{t.q}&rdquo;</p>
                  <div style={{ height: 1, background: "#e5e5e5", marginBottom: 20 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: 0 }}>{t.who}</p>
                  <p style={{ fontSize: 13, color: "#999", margin: 0, marginTop: 2 }}>{t.role}</p>
                </HoverCard>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE ──────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 0" : "96px 0", background: "#f7f7f5", borderBottom: "1px solid #eee" }}>
        <div style={WW}>
          <R>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              Compliance
            </p>
          </R>
          <R d={0.04}>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", maxWidth: 560, marginBottom: 14 }}>
              Conformidade fiscal é a base, não um extra.
            </h2>
          </R>
          <R d={0.08}>
            <p style={{ fontSize: 16, color: "#666", maxWidth: 480, marginBottom: 48, lineHeight: 1.7 }}>
              CT-e com valor errado compromete sua escrituração fiscal. A Confere valida cada documento antes que entre na contabilidade — dentro do prazo de cancelamento.
            </p>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[
              { label: "VERIFICAÇÃO FISCAL", title: "ICMS, ISS e alíquotas por UF", desc: "Verificação automática de alíquotas por UF de origem e destino. Identifica divergências fiscais antes de gerar multa." },
              { label: "REFORMA TRIBUTÁRIA", title: "Pronto para IBS e CBS", desc: "Acompanhamos as notas técnicas da SEFAZ. Quando os novos campos entrarem nos CT-es, nos adaptamos automaticamente." },
            ].map((c, i) => (
              <R key={i} d={i * 0.06}>
                <HoverCard style={{ padding: 32, background: "#2a2a28", borderRadius: 12 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: "#666", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14, fontFamily: FM }}>{c.label}</p>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>{c.title}</h3>
                  <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
                </HoverCard>
              </R>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "PRAZO", title: "168h para cancelar", desc: "CT-e errado tem prazo para cancelamento. Depois disso, multa. Auditamos no mesmo dia." },
              { label: "COBERTURA", title: "100% dos CT-es", desc: "Sem amostragem. Cada documento é verificado componente por componente antes do pagamento." },
              { label: "EVIDÊNCIA", title: "Relatório com lastro", desc: "Cada divergência referencia o CT-e, o componente e a cláusula contratual. Pronto para contestação." },
            ].map((c, i) => (
              <R key={i} d={i * 0.06}>
                <HoverCard style={{ padding: 28, background: "#2a2a28", borderRadius: 12 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: "#666", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12, fontFamily: FM }}>{c.label}</p>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{c.title}</h3>
                  <p style={{ fontSize: 13.5, color: "#aaa", lineHeight: 1.65 }}>{c.desc}</p>
                </HoverCard>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 0" : "96px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ ...WW, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "340px 1fr", gap: isMobile ? 32 : 80 }}>
          <R>
            <div style={{ position: isMobile ? "relative" : "sticky", top: 100 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 14 }}>FAQ</p>
              <h2 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-.02em", marginBottom: 16 }}>
                Perguntas frequentes
              </h2>
              <p style={{ fontSize: 14.5, color: "#666", lineHeight: 1.7 }}>
                Não encontrou o que procura? Fale com a gente.
              </p>
              <a
                href="#cta"
                style={{ ...btnPrimary, marginTop: 20, background: "transparent", color: "#111", border: "1px solid #ddd", padding: "10px 20px", fontSize: 14 }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#f5f5f5")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "transparent")}
              >
                Entrar em contato
              </a>
            </div>
          </R>
          <R d={0.1}>
            <div>
              {[
                { q: "Preciso instalar algum software?", a: "Não. A Confere é um serviço. Envie CT-es e tabelas de frete, receba o relatório pronto. Sem instalação, configuração ou treinamento de equipe." },
                { q: "Funciona com qualquer transportadora?", a: "Sim. Processamos CT-es no padrão XML brasileiro (versões 3.0 e 4.0) e aceitamos tabelas de frete em Excel ou PDF de qualquer transportadora nacional." },
                { q: "Como sei que as divergências estão corretas?", a: "Cada divergência vem com evidência: o CT-e, o componente com erro, o valor cobrado vs. esperado, e a referência à cláusula contratual. Pronto para contestar com lastro." },
                { q: "Já uso TMS. Ainda faz sentido?", a: "Sim. Como disse um profissional do setor: 'nem o humano nem o sistema chega a 100%.' A Confere funciona como camada adicional de verificação sobre o que seu TMS já faz." },
                { q: "E se eu não tenho TMS?", a: "Ótimo caso de uso. A maioria dos nossos clientes usa Excel hoje. A Confere substitui a conferência manual inteira — sem precisar implementar TMS." },
                { q: "Como funciona o trial gratuito?", a: "Envie até 100 CT-es de uma transportadora. Auditamos gratuitamente e entregamos o relatório completo com as divergências encontradas. Sem compromisso, sem cartão." },
              ].map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} />
              ))}
            </div>
          </R>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      {/* <section id="s2" style={{ padding: "96px 0", background: "#f7f7f5", borderBottom: "1px solid #eee" }}>
        <div style={W}>
          <R>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", marginBottom: 14 }}>
              Um serviço. Todos os recursos.
            </h2>
          </R>
          <R d={0.04}>
            <p style={{ fontSize: 16, color: "#666", maxWidth: 480, marginBottom: 56, lineHeight: 1.7 }}>
              Sem módulos separados. Sem cobrança por feature. Todo plano inclui auditoria completa componente por componente.
            </p>
          </R>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              {
                name: "Diagnóstico",
                price: "Grátis",
                sub: "",
                desc: "Auditoria gratuita para você ver o resultado antes de pagar qualquer coisa.",
                features: ["Até 100 CT-es", "1 transportadora", "Relatório completo", "Sem compromisso"],
                cta: "Começar grátis",
                highlight: false,
              },
              {
                name: "Profissional",
                price: "R$ 1.490",
                sub: "/mês",
                desc: "Para operações que precisam de auditoria contínua e conformidade fiscal.",
                features: ["Até 5.000 CT-es/mês", "Transportadoras ilimitadas", "Conformidade fiscal (ICMS)", "Detecção de anomalias", "Suporte prioritário"],
                cta: "Começar diagnóstico",
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "Sob medida",
                sub: "",
                desc: "Para grandes embarcadores. Inclui success fee sobre os savings identificados.",
                features: ["CT-es ilimitados", "Integração ERP/TMS", "API dedicada", "Success fee", "Gerente de conta dedicado"],
                cta: "Falar com a equipe",
                highlight: false,
              },
            ].map((p, i) => (
              <R key={i} d={i * 0.06}>
                <div style={{
                  padding: 32,
                  background: "#fff",
                  borderRadius: 12,
                  border: p.highlight ? "2px solid #111" : "1px solid #eee",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 6 }}>{p.name}</p>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>{p.price}</span>
                    <span style={{ fontSize: 14, color: "#999", marginLeft: 2 }}>{p.sub}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#777", marginBottom: 24, lineHeight: 1.6 }}>{p.desc}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flex: 1 }}>
                    {p.features.map((f, j) => (
                      <li key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 14, color: "#555" }}>
                        <CheckIcon /> {f}
                      </li>
                    ))}
                  </ul>
                  <PricingButton label={p.cta} highlight={p.highlight} />
                </div>
              </R>
            ))}
          </div>
          <R d={0.2}>
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e5e5e5" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 14 }}>
                Incluído em todos os planos
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {["Auditoria componente por componente", "Interpretação automática de tabelas de frete", "Relatórios com evidência para contestação"].map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#555" }}>
                    <CheckIcon /> {f}
                  </div>
                ))}
              </div>
            </div>
          </R>
        </div>
      </section> */}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section id="cta" style={{ padding: isMobile ? "64px 0" : "96px 0", background: "#f7f7f5" }}>
        <div style={{ ...WW, maxWidth: 640 }}>
          <R>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-.03em", marginBottom: 16 }}>
              Descubra quanto você paga a mais em frete.
            </h2>
          </R>
          <R d={0.06}>
            <p style={{ fontSize: 16, color: "#666", marginBottom: 36, lineHeight: 1.7 }}>
              Envie 100 CT-es e receba o relatório com cada divergência e o valor recuperável. Sem custo, sem compromisso, sem cartão de crédito.
            </p>
          </R>
          <R d={0.1}>
            {!sent ? (
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email) {
                      window.location.href = `mailto:pg308758@gmail.com?subject=${encodeURIComponent("Interesse na Confere")}&body=${encodeURIComponent(`Olá,\n\nTenho interesse em auditar meus fretes com a Confere.\n\nMeu e-mail para contato: ${email}\n\nAguardo o contato.`)}`;
                      setSent(true);
                    }
                  }}
                  placeholder="seu@email.com"
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    background: "#f7f7f5",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    color: "#111",
                    fontSize: 15,
                    fontFamily: F,
                    outline: "none",
                    transition: "border-color .15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#999")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd")}
                />
                <CtaButton
                  label="Auditar grátis"
                  fullWidth={isMobile}
                  onClick={() => {
                    if (!email) return;
                    window.location.href = `mailto:pg308758@gmail.com?subject=${encodeURIComponent("Interesse na Confere")}&body=${encodeURIComponent(`Olá,\n\nTenho interesse em auditar meus fretes com a Confere.\n\nMeu e-mail para contato: ${email}\n\nAguardo o contato.`)}`;
                    setSent(true);
                  }}
                />
              </div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "13px 24px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                <CheckIcon c="#059669" />
                <span style={{ color: "#166534", fontWeight: 600, fontFamily: F }}>Ótimo! Seu cliente de e-mail foi aberto com a mensagem pronta.</span>
              </div>
            )}
            <p style={{ fontSize: 12, color: "#bbb", marginTop: 14, fontFamily: F }}>
              Sem software para instalar · Sem cartão de crédito
            </p>
          </R>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ padding: "32px 0", borderTop: "1px solid #eee" }}>
        <div style={{ ...WW, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 16 : 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>Confere</span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Privacidade", "Termos"].map((l) => (
              <a key={l} href="#" style={{ fontSize: 12, color: "#aaa", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>© 2026 Confere · São Paulo, Brasil</p>
        </div>
      </footer>
    </div>
  );
}

function CtaButton({ label, onClick, fullWidth = false }: { label: string; onClick: () => void; fullWidth?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 24px",
        background: hov ? "#333" : "#111",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 14.5,
        fontWeight: 500,
        fontFamily: "'Inter','Helvetica Neue',Helvetica,sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background .15s",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {label}
    </button>
  );
}
