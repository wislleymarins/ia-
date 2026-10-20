import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CircleHelp, Clock3, Pause, Play, RotateCcw, Signal, TrendingUp, WalletCards } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Candle, Timeframe, TradeSignal } from "./types";
import { calculateFibonacci, generateCandles, generateSignal, latestIndicators, settleSignals, tickPrice, timeframeMs } from "./engine";

const SYMBOLS = ["BTC/USD", "ETH/USD", "EUR/USD", "GBP/USD", "USD/JPY"];
const FRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"];
const money = (n: number, symbol: string) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: /JPY/.test(symbol) ? 3 : /BTC|ETH/.test(symbol) || n >= 100 ? 2 : 5,
  maximumFractionDigits: /JPY/.test(symbol) ? 3 : /BTC|ETH/.test(symbol) || n >= 100 ? 2 : 5,
}).format(n);
const time = (n: number) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(n);
const dateTime = (n: number) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(n);

export default function App() {
  const [symbol, setSymbol] = useState("BTC/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [candles, setCandles] = useState<Candle[]>(() => generateCandles("BTC/USD"));
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [running, setRunning] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const initial: Record<string, number> = {};
    SYMBOLS.forEach(s => { initial[s] = generateCandles(s, 2).at(-1)!.close; });
    setPrices(initial);
  }, []);

  useEffect(() => {
    setCandles(generateCandles(symbol, 90, timeframeMs[timeframe]));
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        SYMBOLS.forEach(s => {
          const fallback = s === "BTC/USD" ? 67400 : s === "ETH/USD" ? 3450 : s.includes("JPY") ? 149.25 : 1.0842;
          next[s] = tickPrice(prev[s] ?? fallback, s);
        });
        return next;
      });
      setCandles(prev => {
        if (!prev.length) return prev;
        const price = tickPrice(prev[prev.length - 1].close, symbol);
        const last = prev[prev.length - 1];
        const next = [...prev.slice(0, -1), {
          ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price),
          volume: last.volume + Math.floor(Math.random() * 10),
        }];
        return next;
      });
      setLastUpdate(Date.now());
    }, 1800);
    return () => window.clearInterval(timer);
  }, [running, symbol]);

  const livePrice = prices[symbol] ?? candles.at(-1)?.close ?? 0;
  const indicators = useMemo(() => latestIndicators(candles), [candles]);
  const fibonacci = useMemo(() => calculateFibonacci(candles), [candles]);
  const chartData = useMemo(() => candles.slice(-45).map(c => ({
    time: new Date(c.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    price: c.close,
  })), [candles]);
  const wins = signals.filter(s => s.status === "WIN").length;
  const losses = signals.filter(s => s.status === "LOSS").length;
  const expired = signals.filter(s => s.status === "EXPIRED").length;
  const closed = wins + losses;
  const winRate = closed ? wins / closed * 100 : 0;

  useEffect(() => {
    if (!running || !livePrice) return;
    const candidate = generateSignal(symbol, timeframe, candles, livePrice);
    if (candidate) {
      setSignals(prev => prev.some(s => s.symbol === symbol && s.status === "PENDING") ? prev : [candidate, ...prev].slice(0, 100));
    }
  }, [candles, livePrice, running, symbol, timeframe]);

  useEffect(() => {
    setSignals(prev => settleSignals(prev, prices));
  }, [prices]);

  const addTestSignal = () => {
    const price = livePrice || 1;
    const direction = Math.random() > 0.5 ? "CALL" : "PUT";
    const offset = price * (/BTC|ETH/.test(symbol) ? 0.003 : 0.001);
    const target = direction === "CALL" ? price + offset : price - offset;
    const stop = direction === "CALL" ? price - offset : price + offset;
    const fib = fibonacci ?? {
      trend: direction === "CALL" ? "UP" as const : "DOWN" as const,
      startPrice: price - offset, endPrice: price + offset,
      levels: { "0.0": price + offset, "23.6": price + offset * .528, "38.2": price + offset * .236, "50.0": price, "61.8": price - offset * .236, "78.6": price - offset * .572, "100.0": price - offset },
    };
    setSignals(prev => [{
      id: `manual-${Date.now()}`, symbol, timeframe, direction, entryPrice: price,
      targetPrice: target, stopLoss: stop, timestamp: Date.now(),
      expirationTime: Date.now() + timeframeMs[timeframe] * 2,
      status: "PENDING", fibonacciLevels: fib,
    }, ...prev].slice(0, 100));
  };

  const reset = () => {
    setSignals([]);
    setCandles(generateCandles(symbol, 90, timeframeMs[timeframe]));
    setLastUpdate(Date.now());
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Activity size={21} /></div><div><strong>Pulse<span>Trade</span></strong><small>TERMINAL DE SINAIS</small></div></div>
        <div className="side-label">AMBIENTE</div>
        <div className="environment"><span className="live-dot" /> Simulação ativa <span className="demo-pill">DEMO</span></div>
        <div className="side-label">MERCADOS</div>
        <div className="symbol-list">
          {SYMBOLS.map(s => <button key={s} className={`symbol-item ${symbol === s ? "selected" : ""}`} onClick={() => setSymbol(s)}>
            <span className="symbol-icon">{s.startsWith("BTC") ? "₿" : s.startsWith("ETH") ? "◆" : s.split("/")[0].slice(0, 2)}</span>
            <span className="symbol-name"><strong>{s}</strong><small>{s.includes("USD") ? "Mercado simulado" : "Par de moedas"}</small></span>
            <span className="symbol-price">{prices[s] ? money(prices[s], s) : "—"}</span>
          </button>)}
        </div>
        <div className="sidebar-bottom"><div className="safe-icon"><CircleHelp size={17} /></div><div><strong>Modo de demonstração</strong><p>Preços aleatórios, sem conexão com corretora.</p></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="breadcrumb">Terminal <span>/</span> Mercado</div><h1>Painel de operações</h1></div>
          <div className="top-actions"><span className="market-status"><i /> Mercado simulado</span><button className={`button ${running ? "button-muted" : "button-primary"}`} onClick={() => setRunning(v => !v)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? "Pausar" : "Retomar"}</button><button className="button button-outline" onClick={reset}><RotateCcw size={15} /> Reiniciar</button></div>
        </header>

        <div className="notice"><Activity size={16} /><span><strong>Ambiente de teste:</strong> todos os preços e sinais são simulados e não representam o mercado real. Não use como recomendação financeira.</span></div>

        <section className="stats-grid">
          <Stat title="Preço atual" value={money(livePrice, symbol)} detail={symbol} icon={<WalletCards size={18} />} tone="blue" />
          <Stat title="Sinais gerados" value={String(signals.length)} detail={`${signals.filter(s => s.status === "PENDING").length} em aberto`} icon={<Signal size={18} />} tone="purple" />
          <Stat title="Taxa de acerto" value={`${winRate.toFixed(1).replace(".", ",")}%`} detail={`${wins} WIN · ${losses} LOSS`} icon={<TrendingUp size={18} />} tone="green" />
          <Stat title="Encerrados" value={String(closed + expired)} detail={`${expired} expirados`} icon={<Clock3 size={18} />} tone="orange" />
        </section>

        <section className="panel chart-panel">
          <div className="panel-header chart-heading">
            <div><div className="eyebrow">MOVIMENTO DO PREÇO</div><h2>{symbol} <span className="price-chip">{timeframe}</span></h2><div className="price-line">{money(livePrice, symbol)} <span className="update-time">Atualizado às {time(lastUpdate)}</span></div></div>
            <div className="frame-switch">{FRAMES.map(f => <button key={f} className={timeframe === f ? "active" : ""} onClick={() => setTimeframe(f)}>{f}</button>)}</div>
          </div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d8cff" stopOpacity={0.28} /><stop offset="95%" stopColor="#6d8cff" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#202a40" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "#78849e", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={35} />
            <YAxis orientation="right" domain={["auto", "auto"]} tick={{ fill: "#78849e", fontSize: 10 }} axisLine={false} tickLine={false} width={72} tickFormatter={v => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
            <Tooltip contentStyle={{ background: "#121a2c", border: "1px solid #29354d", borderRadius: 9, color: "#e7edff", fontSize: 12 }} formatter={(v) => [money(Number(v), symbol), "Preço"]} labelStyle={{ color: "#98a6c4" }} />
            <Area type="monotone" dataKey="price" stroke="#7e96ff" strokeWidth={2} fill="url(#priceFill)" isAnimationActive={false} />
          </AreaChart></ResponsiveContainer></div>
          <div className="chart-footer"><span><i className="legend-dot blue" /> Preço simulado</span><span>Últimos 45 pontos</span><span className="updated"><i /> Atualização automática</span></div>
        </section>

        <section className="two-columns">
          <div className="panel">
            <div className="panel-header"><div><div className="eyebrow">ANÁLISE TÉCNICA</div><h2>Indicadores</h2></div><span className="small-tag">AO VIVO</span></div>
            <div className="indicator-list">
              <Indicator label="EMA (20)" value={indicators.ema === undefined ? "Calculando…" : money(indicators.ema, symbol)} status={indicators.ema === undefined ? "Aguardando dados" : livePrice >= indicators.ema ? "Preço acima da média" : "Preço abaixo da média"} positive={indicators.ema !== undefined && livePrice >= indicators.ema} />
              <Indicator label="RSI (14)" value={indicators.rsi === undefined ? "—" : indicators.rsi.toFixed(1).replace(".", ",")} status={indicators.rsi === undefined ? "Aguardando dados" : indicators.rsi >= 70 ? "Sobrecomprado" : indicators.rsi <= 30 ? "Sobrevendido" : "Faixa neutra"} positive={indicators.rsi !== undefined && (indicators.rsi <= 30 || indicators.rsi >= 70)} />
              <Indicator label="ATR (14)" value={indicators.atr === undefined ? "—" : money(indicators.atr, symbol)} status="Amplitude média estimada" />
              <Indicator label="Tendência Fibonacci" value={fibonacci?.trend === "UP" ? "Alta" : fibonacci?.trend === "DOWN" ? "Baixa" : "—"} status={fibonacci ? `Faixa ${money(fibonacci.startPrice, symbol)} — ${money(fibonacci.endPrice, symbol)}` : "Dados insuficientes"} positive={fibonacci?.trend === "UP"} />
            </div>
            <div className="panel-note">Indicadores calculados sobre a série simulada local.</div>
          </div>

          <div className="panel">
            <div className="panel-header"><div><div className="eyebrow">CONTROLE</div><h2>Motor de sinais</h2></div><span className={`status-pill ${running ? "status-running" : "status-paused"}`}><i />{running ? "Ativo" : "Pausado"}</span></div>
            <div className="engine-summary">
              <div className="engine-orb"><Activity size={26} /></div>
              <div><strong>{running ? "Monitorando condições" : "Monitoramento pausado"}</strong><p>{running ? "EMA + RSI + retração Fibonacci" : "Retome para continuar atualizando preços."}</p></div>
            </div>
            <div className="engine-rules"><div><span>Período</span><strong>{timeframe}</strong></div><div><span>Expiração do sinal</span><strong>2 velas</strong></div><div><span>Fonte de dados</span><strong>Simulação local</strong></div></div>
            <button className="button button-outline full-button" onClick={addTestSignal}><Signal size={15} /> Criar sinal de demonstração</button>
            <p className="microcopy">O botão cria uma operação fictícia para testar o histórico e o estado WIN/LOSS.</p>
          </div>
        </section>

        <section className="panel signals-panel">
          <div className="panel-header signals-title"><div><div className="eyebrow">ATIVIDADE RECENTE</div><h2>Histórico de sinais</h2></div><span className="count-tag">{signals.length} registros</span></div>
          {signals.length === 0 ? <div className="empty-state"><div className="empty-icon"><Signal size={23} /></div><strong>Nenhum sinal registrado ainda</strong><p>O motor gera sinais quando as condições técnicas simuladas são atendidas. Você também pode criar um sinal de demonstração.</p><button className="button button-outline" onClick={addTestSignal}>Criar sinal de teste</button></div> :
            <div className="table-scroll"><table><thead><tr><th>ATIVO</th><th>DIREÇÃO</th><th>ENTRADA</th><th>ALVO</th><th>STOP LOSS</th><th>CRIADO EM</th><th>STATUS</th></tr></thead><tbody>
              {signals.map(s => <tr key={s.id}><td><strong>{s.symbol}</strong><small>{s.timeframe}</small></td><td><span className={`direction ${s.direction.toLowerCase()}`}>{s.direction === "CALL" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{s.direction}</span></td><td>{money(s.entryPrice, s.symbol)}</td><td>{money(s.targetPrice, s.symbol)}</td><td>{money(s.stopLoss, s.symbol)}</td><td>{dateTime(s.timestamp)}</td><td><Status status={s.status} /></td></tr>)}
            </tbody></table></div>}
        </section>
        <footer className="footer"><span>PulseTrade Terminal <b>v1.0.0</b></span><span><i /> Dados sintéticos · Sem conexão externa</span></footer>
      </main>
    </div>
  );
}

function Stat({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{title}</span><strong>{value}</strong><small>{detail}</small></div><div className={`stat-accent ${tone}`} /></div>;
}
function Indicator({ label, value, status, positive }: { label: string; value: string; status: string; positive?: boolean }) {
  return <div className="indicator-row"><div className="indicator-mark"><Activity size={15} /></div><div className="indicator-copy"><strong>{label}</strong><small>{status}</small></div><strong className={`indicator-value ${positive ? "positive" : ""}`}>{value}</strong></div>;
}
function Status({ status }: { status: TradeSignal["status"] }) {
  const labels = { PENDING: "Pendente", WIN: "WIN", LOSS: "LOSS", EXPIRED: "Expirado" };
  return <span className={`trade-status ${status.toLowerCase()}`}><i />{labels[status]}</span>;
}