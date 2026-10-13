'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Scissors,
  CalendarDays,
  Clock3,
  Check,
  X,
  Menu,
  LogOut,
  Sparkles,
  ShieldCheck,
  Users,
  LoaderCircle,
} from 'lucide-react';

const money = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
const dateLabel = (date) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(date));
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Não foi possível concluir.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError')
      throw new Error(
        'O servidor está iniciando. Aguarde um momento e tente novamente.',
      );
    if (error instanceof SyntaxError || error instanceof TypeError)
      throw new Error(
        'Não foi possível conectar ao servidor. Tente novamente em instantes.',
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default function Home() {
  const [catalog, setCatalog] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [authMode, setAuthMode] = useState('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [times, setTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [selection, setSelection] = useState({
    serviceId: 'corte',
    barberId: 'david',
    date: '',
    time: '',
  });
  const [cancelId, setCancelId] = useState(null);
  async function loadCatalog() {
    try {
      const data = await api('/catalog');
      setCatalog(data);
      setError('');
      setSelection((s) => ({ ...s, date: s.date || data.today }));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    loadCatalog();
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (view !== 'booking' || !user || !selection.date) return;
    let active = true;
    setLoadingTimes(true);
    setTimes([]);
    api(
      `/availability?${new URLSearchParams({ serviceId: selection.serviceId, barberId: selection.barberId, date: selection.date })}`,
    )
      .then((data) => {
        if (active) setTimes(data.times);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoadingTimes(false);
      });
    return () => {
      active = false;
    };
  }, [view, user, selection.serviceId, selection.barberId, selection.date]);
  async function loadBookings() {
    const data = await api('/bookings');
    setBookings(data.bookings);
  }
  function navigate(next) {
    setError('');
    setSuccess('');
    setMenu(false);
    setView(next);
    if (next === 'dashboard') loadBookings().catch((e) => setError(e.message));
  }
  function startBooking(serviceId) {
    setSelection((s) => ({
      ...s,
      ...(serviceId ? { serviceId } : {}),
      time: '',
    }));
    navigate(
      user ? (user.role === 'client' ? 'booking' : 'dashboard') : 'auth',
    );
  }
  async function action(fn) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demo(role) {
    await action(async () => {
      const data = await api('/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setUser(data.user);
      setView(role === 'client' ? 'booking' : 'dashboard');
      if (role !== 'client') await loadBookings();
    });
  }
  async function login(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      const data = await api(`/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setUser(data.user);
      setView(data.user.role === 'client' ? 'booking' : 'dashboard');
      if (data.user.role !== 'client') await loadBookings();
    });
  }
  async function reserve(event) {
    event.preventDefault();
    await action(async () => {
      await api('/bookings', {
        method: 'POST',
        body: JSON.stringify(selection),
      });
      await loadBookings();
      setSelection((s) => ({ ...s, time: '' }));
      setView('dashboard');
      setSuccess('Tudo certo! Seu horário está reservado.');
    });
  }
  async function cancel() {
    await action(async () => {
      await api(`/bookings/${cancelId}/cancel`, { method: 'PATCH' });
      setCancelId(null);
      await loadBookings();
      setSuccess('Reserva cancelada. O horário está disponível novamente.');
    });
  }
  const selectedService = catalog?.services.find(
    (s) => s.id === selection.serviceId,
  );
  const selectedBarber = catalog?.barbers.find(
    (b) => b.id === selection.barberId,
  );
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.start) > new Date(),
  );
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate('home')}
            aria-label="XD Barbershop, início"
          >
            <span className="brand-symbol">
              <Scissors size={22} />
            </span>
            <span>
              XD<span className="brand-light"> BARBERSHOP</span>
            </span>
          </button>
          <nav
            className={menu ? 'nav open' : 'nav'}
            aria-label="Navegação principal"
          >
            <a
              href="/#servicos"
              onClick={() => {
                navigate('home');
              }}
            >
              Serviços
            </a>
            <a href="/#equipe" onClick={() => navigate('home')}>
              Barbeiros
            </a>
            <button onClick={() => navigate(user ? 'dashboard' : 'auth')}>
              {user ? 'Minha agenda' : 'Entrar'}
            </button>
            <button className="button small" onClick={() => startBooking()}>
              Agendar horário <ArrowUpRight size={16} />
            </button>
          </nav>
          <button
            className="mobile-menu"
            aria-label="Abrir menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        {(error || success) && (
          <div
            className={`notice ${success ? 'success' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || success}
            {!catalog && (
              <button onClick={loadCatalog}>Tentar novamente</button>
            )}
            <button
              aria-label="Fechar mensagem"
              onClick={() => {
                setError('');
                setSuccess('');
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {view === 'home' && (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> TRADIÇÃO NO CORTE. LIBERDADE NO AGENDAMENTO.
                </div>
                <h1>
                  Seu estilo.
                  <br />
                  Seu horário.
                  <br />
                  <em>Sem complicação.</em>
                </h1>
                <p>
                  Um bom corte começa com uma boa experiência.
                  <br className="desktop" /> Escolha seu barbeiro. Reserve seu
                  momento.
                  <br className="desktop" /> O resto é com a gente.
                </p>
                <div className="hero-actions">
                  <button className="button" onClick={() => startBooking()}>
                    Reservar meu horário <ArrowUpRight size={19} />
                  </button>
                  <a className="text-link" href="#servicos">
                    Conhecer os serviços <ArrowRight size={16} />
                  </a>
                </div>
                <div className="hero-proof">
                  <span className="proof-icon">
                    <Check size={17} />
                  </span>
                  <span>
                    Agendamento online <b>·</b> Segunda a sábado, 09h–19h
                  </span>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="Ilustração de uma barbearia clássica"
              >
                <div className="art-grid" />
                <div className="art-top">
                  <span>EST. 2026</span>
                  <span>O SEU PRÓXIMO VISUAL</span>
                </div>
                <div className="barber-pole">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="chair">
                  <div className="chair-head" />
                  <div className="chair-back" />
                  <div className="chair-seat" />
                  <div className="chair-arm left" />
                  <div className="chair-arm right" />
                  <div className="chair-stem" />
                  <div className="chair-base" />
                </div>
                <div className="art-wordmark">
                  XD<span>BARBERSHOP</span>
                </div>
                <div className="floating-ticket">
                  <span className="ticket-icon">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <strong>Seu momento, reservado.</strong>
                    <span>Menos espera. Mais estilo.</span>
                  </div>
                  <span className="ticket-check">
                    <Check size={16} />
                  </span>
                </div>
                <div className="art-bottom">
                  FEITO COM PRECISÃO.<span>01 / 03</span>
                </div>
              </div>
            </section>
            <div className="benefit-strip">
              <div className="container">
                <span>
                  <CalendarDays size={18} /> Reserve em poucos cliques
                </span>
                <span>
                  <Scissors size={18} /> Profissionais com personalidade
                </span>
                <span>
                  <Clock3 size={18} /> Seu tempo merece respeito
                </span>
              </div>
            </div>
            <section className="section container" id="servicos">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">O QUE A GENTE FAZ</span>
                  <h2>Cuidado em cada detalhe.</h2>
                </div>
                <p>
                  Do clássico ao seu próximo estilo.
                  <br />
                  Encontre o serviço que combina com você.
                </p>
              </div>
              <div className="service-grid">
                {catalog ? (
                  catalog.services.map((service, i) => (
                    <article
                      className={`service-card ${i === 2 ? 'featured' : ''}`}
                      key={service.id}
                    >
                      <div className="card-top">
                        <span className="service-icon">
                          {i === 2 ? <Sparkles /> : <Scissors />}
                        </span>
                        {i === 2 ? (
                          <span className="tag">O COMBO COMPLETO</span>
                        ) : (
                          <span className="card-number">0{i + 1}</span>
                        )}
                      </div>
                      <h3>{service.name}</h3>
                      <p>{service.description}</p>
                      <div className="service-details">
                        <span>
                          <Clock3 size={14} /> {service.duration} min
                        </span>
                        <strong>{money(service.price)}</strong>
                      </div>
                      <button onClick={() => startBooking(service.id)}>
                        Escolher serviço <ArrowUpRight size={18} />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="loading">
                    <LoaderCircle className="spin" /> Conectando à barbearia… O
                    primeiro acesso pode levar um momento.
                  </div>
                )}
              </div>
            </section>
            <section className="section container team-section" id="equipe">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">QUEM CUIDA DO SEU ESTILO</span>
                  <h2>Encontre seu barbeiro.</h2>
                </div>
                <span className="section-note">
                  Técnica, conversa boa e atenção de verdade.
                </span>
              </div>
              <div className="team-grid">
                {catalog?.barbers.map((barber) => (
                  <article className="barber-card" key={barber.id}>
                    <div className={`avatar ${barber.color}`}>
                      {barber.initials}
                      <Scissors size={35} />
                    </div>
                    <div>
                      <h3>{barber.name}</h3>
                      <p>{barber.specialty}</p>
                    </div>
                    <button
                      aria-label={`Agendar com ${barber.name}`}
                      onClick={() => {
                        setSelection((s) => ({
                          ...s,
                          barberId: barber.id,
                          time: '',
                        }));
                        startBooking();
                      }}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section className="demo-section container">
              <div>
                <span className="eyebrow">POR TRÁS DO CORTE</span>
                <h2>Um produto feito para experimentar.</h2>
                <p>
                  Este é um projeto público de portfólio. Explore o agendamento
                  como cliente ou veja a operação pelos olhos da equipe. Todos
                  os serviços e profissionais são fictícios.
                </p>
              </div>
              <div className="demo-buttons">
                <button
                  className="button"
                  disabled={busy || !catalog?.demoEnabled}
                  onClick={() => demo('client')}
                >
                  Experimentar como cliente <ArrowRight size={17} />
                </button>
                <div>
                  <button
                    disabled={busy || !catalog?.demoEnabled}
                    onClick={() => demo('barber')}
                  >
                    Sou barbeiro
                  </button>
                  <button
                    disabled={busy || !catalog?.demoEnabled}
                    onClick={() => demo('admin')}
                  >
                    Sou administrador
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
        {view === 'auth' && (
          <section className="workspace container">
            <div className="auth-panel">
              <span className="eyebrow">BEM-VINDO À XD</span>
              <h1>
                {authMode === 'login'
                  ? 'Seu próximo corte começa aqui.'
                  : 'Vamos cuidar do seu estilo.'}
              </h1>
              <p>Entre na sua conta ou experimente com dados fictícios.</p>
              <form onSubmit={login}>
                {authMode === 'register' && (
                  <label>
                    Seu nome
                    <input
                      name="name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={60}
                      required
                    />
                  </label>
                )}
                <label>
                  E-mail
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      authMode === 'login' ? 'current-password' : 'new-password'
                    }
                    minLength={8}
                    maxLength={72}
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  {busy
                    ? 'Aguarde…'
                    : authMode === 'login'
                      ? 'Entrar'
                      : 'Criar conta'}
                  <ArrowRight size={18} />
                </button>
              </form>
              <button
                className="switch-auth"
                onClick={() =>
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                }
              >
                {authMode === 'login'
                  ? 'Primeira visita? Criar conta'
                  : 'Já tem conta? Entrar'}
              </button>
              {catalog?.demoEnabled && (
                <div className="auth-demo">
                  <span>Quer apenas conhecer o projeto?</span>
                  <button disabled={busy} onClick={() => demo('client')}>
                    Entrar na demonstração <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <aside className="auth-aside">
              <Scissors size={56} />
              <h2>
                Um espaço para
                <br />
                <em>ser você.</em>
              </h2>
              <p>
                Precisão no corte.
                <br />
                Praticidade na sua rotina.
              </p>
              <span>XD BARBERSHOP / EST. 2026</span>
            </aside>
          </section>
        )}
        {view === 'booking' && user && (
          <section className="workspace container">
            <div className="workspace-title">
              <span className="eyebrow">RESERVE SEU MOMENTO</span>
              <h1>Como vai ser hoje, {user.name.split(' ')[0]}?</h1>
              <p>Escolha o serviço, o barbeiro e um horário disponível.</p>
            </div>
            <form className="booking-layout" onSubmit={reserve}>
              <div className="booking-steps">
                <fieldset>
                  <legend>
                    <span>01</span> Seu serviço
                  </legend>
                  <div className="choice-grid">
                    {catalog?.services.map((s) => (
                      <button
                        type="button"
                        className={`choice ${selection.serviceId === s.id ? 'selected' : ''}`}
                        aria-pressed={selection.serviceId === s.id}
                        key={s.id}
                        onClick={() =>
                          setSelection((v) => ({
                            ...v,
                            serviceId: s.id,
                            time: '',
                          }))
                        }
                      >
                        <Scissors size={20} />
                        <strong>{s.name}</strong>
                        <span>
                          {s.duration} min · {money(s.price)}
                        </span>
                        {selection.serviceId === s.id && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    <span>02</span> Quem vai cuidar de você?
                  </legend>
                  <div className="choice-grid">
                    {catalog?.barbers.map((b) => (
                      <button
                        type="button"
                        className={`choice ${selection.barberId === b.id ? 'selected' : ''}`}
                        aria-pressed={selection.barberId === b.id}
                        key={b.id}
                        onClick={() =>
                          setSelection((v) => ({
                            ...v,
                            barberId: b.id,
                            time: '',
                          }))
                        }
                      >
                        <span className={`mini-avatar ${b.color}`}>
                          {b.initials}
                        </span>
                        <strong>{b.name}</strong>
                        <span>{b.specialty}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    <span>03</span> Dia e horário
                  </legend>
                  <label className="date-label">
                    Escolha a data
                    <input
                      aria-label="Data do agendamento"
                      type="date"
                      required
                      min={catalog?.today}
                      value={selection.date}
                      onChange={(e) => {
                        setError('');
                        setSelection((s) => ({
                          ...s,
                          date: e.target.value,
                          time: '',
                        }));
                      }}
                    />
                  </label>
                  <div className="time-grid" aria-live="polite">
                    {loadingTimes ? (
                      <p>Consultando horários…</p>
                    ) : times.length ? (
                      times.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={selection.time === time ? 'selected' : ''}
                          aria-pressed={selection.time === time}
                          onClick={() => setSelection((s) => ({ ...s, time }))}
                        >
                          {time}
                        </button>
                      ))
                    ) : (
                      <p>
                        Sem horários para esta data. Atendemos de segunda a
                        sábado. Experimente outro dia.
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>
              <aside className="booking-summary">
                <span className="eyebrow">SEU AGENDAMENTO</span>
                <h2>Um momento só seu.</h2>
                <div className="summary-row">
                  <span>Serviço</span>
                  <strong>{selectedService?.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Barbeiro</span>
                  <strong>{selectedBarber?.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Duração</span>
                  <strong>{selectedService?.duration} minutos</strong>
                </div>
                <div className="summary-row">
                  <span>Quando</span>
                  <strong>
                    {selection.date
                      ? selection.date.split('-').reverse().join('/')
                      : 'Selecione'}
                    {selection.time && ` às ${selection.time}`}
                  </strong>
                </div>
                <div className="summary-total">
                  <span>Total</span>
                  <strong>{money(selectedService?.price || 0)}</strong>
                </div>
                <button
                  className="button"
                  disabled={busy || !selection.time || loadingTimes}
                >
                  {busy ? 'Reservando…' : 'Confirmar agendamento'}
                  <ArrowRight size={18} />
                </button>
                <p>
                  <ShieldCheck size={14} /> Reserva confirmada na hora.
                  <br />
                  Pagamento presencial, após o serviço.
                </p>
                {user.demo && (
                  <div className="demo-tag">
                    Demonstração: nenhuma cobrança real.
                  </div>
                )}
              </aside>
            </form>
          </section>
        )}
        {view === 'dashboard' && user && (
          <section className="workspace container">
            <div className="dashboard-heading">
              <div>
                <span className="eyebrow">
                  {user.role === 'client'
                    ? 'SEU ESPAÇO'
                    : 'PAINEL DA BARBEARIA'}
                </span>
                <h1>
                  {user.role === 'client'
                    ? 'Minha agenda.'
                    : user.role === 'barber'
                      ? 'Agenda do David.'
                      : 'Visão da operação.'}
                </h1>
                <p>
                  {user.demo
                    ? 'Ambiente de demonstração exclusivo desta sessão.'
                    : `Bem-vindo, ${user.name}.`}
                </p>
              </div>
              <div className="dashboard-actions">
                {user.role === 'client' && (
                  <button
                    className="button small"
                    onClick={() => startBooking()}
                  >
                    Novo agendamento <ArrowUpRight size={17} />
                  </button>
                )}
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api('/auth/logout', { method: 'POST' });
                      setUser(null);
                      setView('home');
                      setBookings([]);
                    })
                  }
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            </div>
            {user.demo && (
              <div className="role-switch">
                <span>Explorar como:</span>
                {[
                  ['client', 'Cliente'],
                  ['barber', 'Barbeiro'],
                  ['admin', 'Administrador'],
                ].map(([role, name]) => (
                  <button
                    key={role}
                    disabled={busy}
                    className={user.role === role ? 'active' : ''}
                    onClick={() => demo(role)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="stats-grid">
              <article>
                <CalendarDays size={20} />
                <span>Próximos agendamentos</span>
                <strong>{upcoming.length}</strong>
              </article>
              <article>
                <Scissors size={20} />
                <span>Reservas registradas</span>
                <strong>{bookings.length}</strong>
              </article>
              <article>
                <Users size={20} />
                <span>
                  {user.role === 'client'
                    ? 'Investimento reservado'
                    : 'Receita prevista'}
                </span>
                <strong>
                  {money(upcoming.reduce((sum, b) => sum + b.price, 0))}
                </strong>
              </article>
            </div>
            <div className="agenda-header">
              <h2>
                {user.role === 'client'
                  ? 'Seus agendamentos'
                  : 'Agendamentos da equipe'}
              </h2>
              <button disabled={busy} onClick={() => action(loadBookings)}>
                Atualizar
              </button>
            </div>
            {!bookings.length ? (
              <div className="empty-state">
                <CalendarDays size={42} />
                <h3>A agenda está esperando seu primeiro horário.</h3>
                <p>
                  {user.role === 'client'
                    ? 'Escolha um serviço e reserve seu próximo corte.'
                    : 'Na demonstração, faça uma reserva como cliente e volte a este painel para acompanhar.'}
                </p>
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => (user.demo ? demo('client') : startBooking())}
                >
                  Agendar um serviço <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="booking-list">
                {bookings.map((b) => (
                  <article key={b._id} className="booking-row">
                    <span className="booking-row-icon">
                      <Scissors size={20} />
                    </span>
                    <div>
                      <h3>
                        {
                          catalog?.services.find((s) => s.id === b.serviceId)
                            ?.name
                        }
                      </h3>
                      <p>
                        {dateLabel(b.start)} ·{' '}
                        {
                          catalog?.barbers.find((v) => v.id === b.barberId)
                            ?.name
                        }
                        {user.role !== 'client' && ` · ${b.clientName}`}
                      </p>
                    </div>
                    <strong>{money(b.price)}</strong>
                    <span className={`status ${b.status}`}>
                      {b.status === 'cancelled'
                        ? 'Cancelado'
                        : new Date(b.start) < new Date()
                          ? 'Encerrado'
                          : 'Confirmado'}
                    </span>
                    {b.status === 'confirmed' &&
                      new Date(b.start) > new Date() && (
                        <button
                          className="cancel-button"
                          onClick={() => setCancelId(b._id)}
                        >
                          Cancelar
                        </button>
                      )}
                  </article>
                ))}
              </div>
            )}
            {user.role === 'admin' && (
              <div className="admin-catalog">
                <h2>Catálogo da barbearia</h2>
                <p>
                  Serviços e equipe configurados no código, com preços e
                  durações consistentes em todos os agendamentos.
                </p>
                <div className="admin-items">
                  {catalog?.services.map((s) => (
                    <span key={s.id}>
                      {s.name}{' '}
                      <strong>
                        {money(s.price)} · {s.duration} min
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="footer container">
        <div className="brand">
          <Scissors size={20} />
          <span>
            XD<span className="brand-light"> BARBERSHOP</span>
          </span>
        </div>
        <p>
          Desenvolvido por{' '}
          <a
            href="https://github.com/davidxavierxdplanschat"
            target="_blank"
            rel="noreferrer"
          >
            David Xavier <ArrowUpRight size={13} />
          </a>
          <span>Projeto público de portfólio · {new Date().getFullYear()}</span>
        </p>
        <a
          href="https://github.com/davidxavierxdplanschat"
          target="_blank"
          rel="noreferrer"
          className="footer-link"
        >
          Conheça o desenvolvedor <ArrowUpRight size={16} />
        </a>
      </footer>
      {cancelId && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
          >
            <h2 id="cancel-title">Cancelar este horário?</h2>
            <p>
              O horário será liberado para uma nova reserva. Você pode agendar
              novamente depois.
            </p>
            <div>
              <button
                autoFocus
                className="button small"
                onClick={() => setCancelId(null)}
                disabled={busy}
              >
                Manter reserva
              </button>
              <button
                className="cancel-button"
                onClick={cancel}
                disabled={busy}
              >
                {busy ? 'Cancelando…' : 'Sim, cancelar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
