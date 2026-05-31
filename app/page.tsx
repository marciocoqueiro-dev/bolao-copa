'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Trophy,
  Coins,
  Copy,
  Check,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Wallet,
  Target,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';

interface Setting {
  id: number;
  bolao_name: string;
  entry_value: number;
  pix_key: string | null;
  pix_name: string | null;
  organizer_fee_percent: number;
  first_place_percent?: number;
  second_place_percent?: number;
  third_place_percent?: number;
  rollover_amount?: number;
  prize_rule?: string;
}

interface Participant {
  id: string;
  name: string;
  phone: string | null;
  paid: boolean;
  points: number;
  payment_id?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  payment_method?: string | null;
  payment_approved_at?: string | null;
  created_at?: string;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  stage: string | null;
  match_time: string | null;
  active: boolean;
  locked: boolean;
  home_score: number | null;
  away_score: number | null;
  prize_amount?: number;
  finalized?: boolean;
}

interface Prediction {
  id: string;
  participant_id: string;
  match_id: string;
  home_guess: number;
  away_guess: number;
  points: number;
  winner?: boolean;
  created_at?: string;
}

interface PixPayment {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
}

const DEFAULT_SETTINGS: Setting = {
  id: 1,
  bolao_name: 'CopaPix 2026',
  entry_value: 20,
  pix_key: 'sua-chave-pix-aqui',
  pix_name: 'Organizador do Bolão',
  organizer_fee_percent: 10,
  rollover_amount: 0,
  prize_rule: 'exact_score',
};

const TEAM_FLAGS: Record<string, string> = {
  brasil: '🇧🇷',
  brazil: '🇧🇷',
  bra: '🇧🇷',
  marrocos: '🇲🇦',
  morocco: '🇲🇦',
  mar: '🇲🇦',
  argentina: '🇦🇷',
  arg: '🇦🇷',
  franca: '🇫🇷',
  frança: '🇫🇷',
  france: '🇫🇷',
  alemanha: '🇩🇪',
  germany: '🇩🇪',
  espanha: '🇪🇸',
  spain: '🇪🇸',
  portugal: '🇵🇹',
  inglaterra: '🏴',
  england: '🏴',
  italia: '🇮🇹',
  itália: '🇮🇹',
  uruguai: '🇺🇾',
  mexico: '🇲🇽',
  méxico: '🇲🇽',
  eua: '🇺🇸',
  usa: '🇺🇸',
  canada: '🇨🇦',
};

function normalizeTeamName(team?: string | null) {
  return String(team || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function teamFlag(team?: string | null, savedFlag?: string | null) {
  const key = normalizeTeamName(team);
  return TEAM_FLAGS[key] || savedFlag || '⚽';
}

function brl(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatMatchDate(value: string | null) {
  if (!value) return 'Data a definir';

  return new Date(value).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00h 00m 00s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function CopaPixPage() {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(true);
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [settings, setSettings] = useState<Setting>(DEFAULT_SETTINGS);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [bgMuted, setBgMuted] = useState(true);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [homeGuess, setHomeGuess] = useState('');
  const [awayGuess, setAwayGuess] = useState('');

  useEffect(() => {
    const audio = new Audio('/moonpub-sunny-brasil-bossa-nova-60sec-492513.mp3');
    audio.loop = true;
    audio.volume = 0.25;
    bgAudioRef.current = audio;

    return () => {
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio) return;

    if (bgMuted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [bgMuted]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());

    const stored = localStorage.getItem('copapix_current_participant');
    if (stored) {
      try {
        setCurrentParticipant(JSON.parse(stored));
      } catch {
        localStorage.removeItem('copapix_current_participant');
      }
    }
  }, []);

  const currentMatch = useMemo(() => {
    const activeMatches = matches
      .filter((match) => match.active)
      .sort((a, b) => {
        const da = a.match_time ? new Date(a.match_time).getTime() : 0;
        const db = b.match_time ? new Date(b.match_time).getTime() : 0;
        return da - db;
      });

    return (
      activeMatches.find((match) => !match.finalized && !match.locked) ||
      activeMatches.find((match) => !match.finalized) ||
      activeMatches[0] ||
      null
    );
  }, [matches]);

  const currentPredictions = useMemo(() => {
    if (!currentMatch) return [];
    return predictions.filter((prediction) => prediction.match_id === currentMatch.id);
  }, [predictions, currentMatch]);

  const paidPredictionRows = useMemo(() => {
    return currentPredictions
      .map((prediction) => {
        const participant = participants.find((p) => p.id === prediction.participant_id);
        return { prediction, participant };
      })
      .filter((row) => row.participant?.paid);
  }, [currentPredictions, participants]);

  const myPrediction = useMemo(() => {
    if (!currentMatch || !currentParticipant) return null;

    return (
      predictions.find(
        (prediction) =>
          prediction.match_id === currentMatch.id &&
          prediction.participant_id === currentParticipant.id
      ) || null
    );
  }, [predictions, currentMatch, currentParticipant]);

  const gameFinancials = useMemo(() => {
    const entry = Number(settings.entry_value || 0);
    const organizerPercent = Number(settings.organizer_fee_percent || 10);
    const paidPredictionsCount = paidPredictionRows.length;
    const gross = paidPredictionsCount * entry;
    const organizerFee = gross * (organizerPercent / 100);
    const totalPrize = gross - organizerFee;

    return {
      paidPredictionsCount,
      gross,
      organizerFee,
      totalPrize,
    };
  }, [settings, paidPredictionRows]);

  const countdown = useMemo(() => {
    if (!currentMatch?.match_time) {
      return {
        label: 'Aguardando horário',
        ended: false,
      };
    }

    const diff = new Date(currentMatch.match_time).getTime() - now;

    return {
      label: formatCountdown(diff),
      ended: diff <= 0,
    };
  }, [currentMatch?.match_time, now]);

  const exactWinners = useMemo(() => {
    if (!currentMatch || currentMatch.home_score === null || currentMatch.away_score === null) {
      return [];
    }

    return paidPredictionRows.filter(
      ({ prediction }) =>
        prediction.home_guess === currentMatch.home_score &&
        prediction.away_guess === currentMatch.away_score
    );
  }, [currentMatch, paidPredictionRows]);

  async function loadData(showLoading = false) {
  if (showLoading) setLoading(true);

    if (!configured || !supabase) {
      if (showLoading) setLoading(false);
      return;
    }

    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();

    if (settingsError) console.error('settings error:', settingsError);
    if (settingsData) setSettings({ ...DEFAULT_SETTINGS, ...settingsData });

    const { data: participantsData, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .order('created_at', { ascending: true });

    if (participantsError) console.error('participants error:', participantsError);
    setParticipants(participantsData || []);

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('active', true)
      .order('match_time', { ascending: true });

    if (matchesError) console.error('matches error:', matchesError);
    setMatches(matchesData || []);

    const { data: predictionsData, error: predictionsError } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: true });

    if (predictionsError) console.error('predictions error:', predictionsError);
    setPredictions(predictionsData || []);

    if (currentParticipant) {
      const { data: refreshedParticipant } = await supabase
        .from('participants')
        .select('*')
        .eq('id', currentParticipant.id)
        .maybeSingle();

      if (refreshedParticipant) {
        setCurrentParticipant(refreshedParticipant);
        localStorage.setItem('copapix_current_participant', JSON.stringify(refreshedParticipant));
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadData();
    }, 5000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, currentParticipant?.id]);

  useEffect(() => {
    if (myPrediction) {
      setHomeGuess(String(myPrediction.home_guess));
      setAwayGuess(String(myPrediction.away_guess));
    }
  }, [myPrediction]);

  function playCelebration() {
    try {
      const audio = new Audio('/goal-celebration.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch {}
  }

  async function savePrediction(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!supabase || !currentMatch) {
      setMessage('Supabase não configurado ou nenhum jogo ativo.');
      return;
    }

    if (currentMatch.locked || currentMatch.finalized) {
      setMessage('Os palpites deste jogo já foram encerrados.');
      return;
    }

    if (myPrediction) {
      setMessage('Esta participação já tem um palpite salvo. Para fazer outro palpite, gere uma nova participação.');
      return;
    }

    if (!name.trim() && !currentParticipant) {
      setMessage('Digite seu nome ou apelido para salvar o palpite.');
      return;
    }

    const home = Number(homeGuess);
    const away = Number(awayGuess);

    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      setMessage('Digite placares válidos. Exemplo: 2 x 1.');
      return;
    }

    setSaving(true);

    try {
      let participant = currentParticipant;
      let pixData: PixPayment | null = null;

      if (participant) {
        const { data: refreshedParticipant, error: participantError } = await supabase
          .from('participants')
          .select('*')
          .eq('id', participant.id)
          .maybeSingle();

        if (participantError || !refreshedParticipant) {
          console.error(participantError);
          localStorage.removeItem('copapix_current_participant');
          setCurrentParticipant(null);
          setMessage('Não encontrei seu cadastro. Informe seu nome e salve o palpite novamente.');
          setSaving(false);
          return;
        }

        participant = refreshedParticipant;
      }

      if (!participant) {
        const entryAmount = Number(settings.entry_value || 20);

        const pixResponse = await fetch('/api/create-pix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            amount: entryAmount,
          }),
        });

        pixData = await pixResponse.json();

        if (!pixResponse.ok || !pixData?.qrCode) {
          console.error('Erro Mercado Pago:', pixData);
          setMessage('Erro ao gerar PIX. Confira o token do Mercado Pago e tente novamente.');
          setSaving(false);
          return;
        }

        const { data: createdParticipant, error: createParticipantError } = await supabase
          .from('participants')
          .insert({
            name: name.trim(),
            phone: phone.trim() || null,
            paid: false,
            payment_id: String(pixData.paymentId),
            payment_status: 'pending',
            payment_amount: entryAmount,
            payment_method: 'pix',
            points: 0,
          })
          .select('*')
          .single();

        if (createParticipantError || !createdParticipant) {
          console.error(createParticipantError);
          setMessage('PIX gerado, mas não foi possível cadastrar no Supabase. Confira as permissões.');
          setSaving(false);
          return;
        }

        participant = createdParticipant;
        setPixPayment(pixData);
      }

      if (!participant) {
        setMessage('Participante não encontrado.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('predictions')
        .upsert(
          {
            participant_id: participant.id,
            match_id: currentMatch.id,
            home_guess: home,
            away_guess: away,
          },
          {
            onConflict: 'participant_id,match_id',
          }
        );

      if (error) {
        console.error(error);
        setMessage('Erro ao salvar palpite. Confira as policies da tabela predictions.');
        setSaving(false);
        return;
      }

      setCurrentParticipant(participant);
      localStorage.setItem('copapix_current_participant', JSON.stringify(participant));

      if (!pixData && participant.payment_id && !participant.paid) {
        setMessage('Palpite salvo. PIX pendente para esta participação.');
      } else {
        setMessage(
          participant.paid
            ? 'Palpite salvo com sucesso.'
            : 'Palpite salvo com sucesso. Agora pague o PIX e aguarde a confirmação.'
        );
      }

      setName('');
      setPhone('');
      playCelebration();
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage('Erro ao salvar palpite. Tente novamente.');
    }

    setSaving(false);
  }

  async function copyPix() {
    const pixKey = pixPayment?.qrCode || '';

    if (!pixKey) {
      setMessage('Salve o palpite primeiro para gerar e copiar o PIX.');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(pixKey);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);
      setMessage('PIX copia e cola copiado.');
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error(error);
      setMessage('Não foi possível copiar automaticamente.');
    }
  }

  function clearSession() {
    localStorage.removeItem('copapix_current_participant');
    setCurrentParticipant(null);
    setPixPayment(null);
    setHomeGuess('');
    setAwayGuess('');
    setName('');
    setPhone('');
    setMessage('Participante desconectado neste navegador.');
  }

  function startNewEntry() {
    localStorage.removeItem('copapix_current_participant');
    setCurrentParticipant(null);
    setPixPayment(null);
    setHomeGuess('');
    setAwayGuess('');
    setName('');
    setPhone('');
    setMessage('Nova participação iniciada. Preencha seus dados e seu palpite.');
    document.getElementById('entrar')?.scrollIntoView({ behavior: 'smooth' });
  }

  const currentParticipantStatus = currentParticipant?.paid
    ? 'Pagamento confirmado'
    : 'Pagamento pendente';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,#0a6b3c_0%,#06110d_42%,#020806_100%)] text-white">
      <div className="pointer-events-none fixed bottom-6 right-6 z-20 animate-bounce text-4xl drop-shadow-2xl sm:text-6xl">
        ⚽
      </div>

      <button
        onClick={() => setBgMuted(!bgMuted)}
        className="fixed right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        title={bgMuted ? 'Tocar música' : 'Silenciar música'}
      >
        {bgMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      <section className="relative overflow-hidden border-b border-yellow-300/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,223,0,0.42),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(0,39,118,0.65),transparent_34%),linear-gradient(135deg,#009739_0%,#026b36_36%,#002776_72%,#06110d_100%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(120deg,rgba(255,255,255,.12)_0_1px,transparent_1px_22px)]" />

        <Image
          src="/header-copapix-familia.png"
          alt=""
          width={900}
          height={500}
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-cover object-center opacity-[0.18] mix-blend-screen saturate-150 contrast-125"
          priority
        />

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-300/35 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-blue-700/45 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#06110d]/30 to-[#06110d]" />

        <div className="relative mx-auto grid w-[min(1180px,92%)] gap-6 py-8 sm:gap-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-300/40 bg-yellow-300/20 px-4 py-2 text-sm font-black text-yellow-100 shadow-[0_0_30px_rgba(255,223,0,.22)] backdrop-blur">
              🇧🇷 <Trophy size={16} /> Bolão da Copa 2026
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.88] tracking-[-0.07em] drop-shadow-2xl sm:text-6xl md:text-8xl">
              Acerte o placar.
              <span className="block bg-gradient-to-r from-yellow-200 via-yellow-300 to-white bg-clip-text text-transparent">
                Ganhe o prêmio.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-white/[0.82] drop-shadow sm:text-lg sm:leading-8">
              PIX automático, participação individual e prêmio para quem cravar o placar exato do jogo.
            </p>

            <div className="mt-7 grid max-w-xl grid-cols-3 gap-2 rounded-[1.5rem] border border-white/15 bg-black/25 p-2 backdrop-blur sm:gap-3 sm:rounded-[2rem] sm:p-3">
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-white/60 sm:text-xs">
                  Prêmio
                </span>
                <strong className="mt-1 block text-lg font-black text-yellow-200 sm:text-2xl">
                  {brl(gameFinancials.totalPrize)}
                </strong>
              </div>

              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-white/60 sm:text-xs">
                  Pagos
                </span>
                <strong className="mt-1 block text-lg font-black text-yellow-200 sm:text-2xl">
                  {gameFinancials.paidPredictionsCount}
                </strong>
              </div>

              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-white/60 sm:text-xs">
                  Entrada
                </span>
                <strong className="mt-1 block text-lg font-black text-yellow-200 sm:text-2xl">
                  {brl(settings.entry_value)}
                </strong>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#entrar"
                className="rounded-full bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 px-7 py-4 font-black text-emerald-950 shadow-[0_18px_45px_rgba(255,223,0,.28)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Fazer meu palpite
              </a>

              <a
                href="#jogo-atual"
                className="rounded-full border border-white/20 bg-white/[0.12] px-7 py-4 font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                Ver jogo atual
              </a>
            </div>
          </div>

          <div className="grid content-center gap-4">
            <div className="rounded-[2rem] border border-yellow-300/30 bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-500 p-5 text-emerald-950 shadow-[0_0_60px_rgba(255,223,0,.32)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-black uppercase tracking-[0.22em] text-emerald-950/70">
                  🏆 Prêmio atual
                </span>
                <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-black text-yellow-200">
                  PIX
                </span>
              </div>

              <strong className="mt-3 block text-4xl font-black tracking-tight sm:text-6xl">
                {brl(gameFinancials.totalPrize)}
              </strong>

              <p className="mt-3 text-sm font-bold text-emerald-950/75">
                Calculado somente com participações pagas para este jogo.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/[0.10] p-5 text-center shadow-2xl backdrop-blur sm:p-6">
              <div className="text-sm font-black uppercase tracking-[0.22em] text-yellow-200">
                ⏰ Encerramento dos palpites
              </div>

              <div className="mt-3 rounded-3xl bg-black/30 px-4 py-5 text-4xl font-black tracking-tight text-white shadow-inner sm:text-5xl">
                {countdown.label}
              </div>

              <p className="mt-3 text-sm font-bold text-white/65">
                {countdown.ended
                  ? 'Os palpites deste jogo devem ser encerrados pelo administrador.'
                  : currentMatch?.match_time
                    ? `Jogo em ${formatMatchDate(currentMatch.match_time)}`
                    : 'Cadastre o horário do jogo no admin.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Wallet size={20} />} label="Entrada" value={brl(settings.entry_value)} />
              <StatCard icon={<Users size={20} />} label="Pagos" value={String(gameFinancials.paidPredictionsCount)} />
              <StatCard icon={<Coins size={20} />} label="Organização" value={brl(gameFinancials.organizerFee)} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-[min(1180px,92%)] gap-5 py-8">
        {!configured && (
          <div className="rounded-3xl border border-red-300/20 bg-red-400/10 p-5 text-red-100">
            Supabase não configurado. Confira o arquivo <strong>.env.local</strong>.
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          <MiniPrize label="Arrecadado no jogo" value={brl(gameFinancials.gross)} />
          <MiniPrize label="Organização" value={brl(gameFinancials.organizerFee)} />
          <MiniPrize label="Participações pagas" value={String(gameFinancials.paidPredictionsCount)} />
          <MiniPrize label="Prêmio atual" value={brl(gameFinancials.totalPrize)} highlight />
        </section>

        <section className="grid gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight sm:text-2xl">Pagamento PIX</h2>
                <p className="mt-1 text-sm text-emerald-100/65">
                  Valor da entrada: {brl(settings.entry_value)}
                </p>
              </div>

              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-sm font-black text-emerald-950">
                PIX
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[100px_1fr] md:grid-cols-[120px_1fr]">
              <div className="grid min-h-[100px] w-[100px] place-items-center rounded-2xl border-8 border-white bg-white p-1 text-xs font-black text-emerald-950 shadow-xl sm:min-h-[120px] sm:w-[120px] sm:rounded-3xl sm:text-sm">
                {pixPayment?.qrCodeBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  'QR PIX'
                )}
              </div>

              <div className="space-y-3">
                <InfoLine label="Recebedor" value={settings.pix_name || 'Mercado Pago'} />

                {pixPayment?.qrCode ? (
                  <InfoLine label="PIX copia e cola" value={pixPayment.qrCode} />
                ) : (
                  <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-bold text-yellow-100">
                    Depois de salvar o palpite, o QR Code PIX e o código copia e cola aparecem aqui automaticamente.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copyPix}
                    disabled={!pixPayment?.qrCode}
                    className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-5 py-3 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Copiado' : 'Copiar PIX'}
                  </button>

                  {pixPayment?.ticketUrl && (
                    <a
                      href={pixPayment.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-white/15 bg-white/10 px-5 py-3 font-black text-white"
                    >
                      Abrir pagamento
                    </a>
                  )}

                  {pixPayment && (
                    <button
                      type="button"
                      onClick={startNewEntry}
                      className="inline-flex rounded-full border border-white/15 bg-white/10 px-5 py-3 font-black text-white"
                    >
                      Fazer outro palpite / gerar outro PIX
                    </button>
                  )}
                </div>

                {currentParticipant && (
                  <div className="rounded-2xl border border-white/10 bg-emerald-400/10 p-3 text-sm">
                    <strong>{currentParticipant.name}</strong>
                    <span className={currentParticipant.paid ? 'ml-2 text-emerald-200' : 'ml-2 text-yellow-200'}>
                      {currentParticipantStatus}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="jogo-atual"
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:rounded-[2.2rem] sm:p-6"
        >
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100">
                <Target size={14} /> Jogo atual
              </div>

              <h2 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
                {currentMatch
                  ? `${teamFlag(currentMatch.home_team, currentMatch.home_flag)} ${currentMatch.home_team} x ${currentMatch.away_team} ${teamFlag(currentMatch.away_team, currentMatch.away_flag)}`
                  : 'Nenhum jogo ativo'}
              </h2>

              <p className="mt-2 text-emerald-100/65">
                Palpites exibidos apenas para esta partida.
              </p>
            </div>

            {currentMatch && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right sm:rounded-3xl sm:px-5 sm:py-4">
                <div className="flex items-center justify-end gap-2 text-sm text-emerald-100/65">
                  <CalendarDays size={16} /> {formatMatchDate(currentMatch.match_time)}
                </div>
                <div className="mt-1 font-black text-yellow-200">
                  {currentMatch.stage || 'Fase da Copa'}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="rounded-3xl bg-white/[0.05] p-8 text-center text-emerald-100/70">
              Carregando...
            </div>
          ) : !currentMatch ? (
            <div className="rounded-3xl bg-white/[0.05] p-8 text-center text-emerald-100/70">
              Nenhum jogo ativo cadastrado.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-[2rem] sm:p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                  <TeamBlock flag={currentMatch.home_flag} team={currentMatch.home_team} />

                  <div className="rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black text-emerald-950 sm:px-4 sm:py-2 sm:text-sm">
                    VS
                  </div>

                  <TeamBlock flag={currentMatch.away_flag} team={currentMatch.away_team} right />
                </div>

                {currentMatch.home_score !== null && currentMatch.away_score !== null && (
                  <div className="mt-5 rounded-3xl bg-yellow-300/10 p-4 text-center">
                    <span className="text-sm text-emerald-100/70">Resultado oficial</span>
                    <strong className="block text-2xl text-yellow-200 sm:text-3xl">
                      {currentMatch.home_score} x {currentMatch.away_score}
                    </strong>
                  </div>
                )}

                <form
                  id="entrar"
                  onSubmit={savePrediction}
                  className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:rounded-3xl sm:p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black sm:text-xl">Meu palpite</h3>
                      <p className="text-sm text-emerald-100/60">
                        Digite seu nome, seu placar e gere o PIX automaticamente.
                      </p>
                    </div>

                    {(currentMatch.locked || currentMatch.finalized) && <Lock className="text-yellow-200" />}
                  </div>

                  {!currentParticipant && (
                    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_0.8fr]">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome ou apelido"
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 font-bold outline-none focus:border-yellow-200"
                      />

                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="WhatsApp opcional"
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 font-bold outline-none focus:border-yellow-200"
                      />
                    </div>
                  )}

                  {currentParticipant && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-100">
                      Participação atual: {currentParticipant.name} · {currentParticipantStatus}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                    <input
                      type="number"
                      min="0"
                      value={homeGuess}
                      onChange={(e) => setHomeGuess(e.target.value)}
                      disabled={currentMatch.locked || currentMatch.finalized || !!myPrediction}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center text-2xl font-black outline-none focus:border-yellow-200 disabled:opacity-50 sm:px-4 sm:py-4 sm:text-3xl"
                    />

                    <span className="text-xl font-black text-yellow-200 sm:text-2xl">x</span>

                    <input
                      type="number"
                      min="0"
                      value={awayGuess}
                      onChange={(e) => setAwayGuess(e.target.value)}
                      disabled={currentMatch.locked || currentMatch.finalized || !!myPrediction}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center text-2xl font-black outline-none focus:border-yellow-200 disabled:opacity-50 sm:px-4 sm:py-4 sm:text-3xl"
                    />
                  </div>

                  <button
                    disabled={saving || currentMatch.locked || currentMatch.finalized || !!myPrediction}
                    className="mt-4 w-full rounded-full bg-yellow-300 px-5 py-4 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? 'Salvando...'
                      : myPrediction
                        ? 'Palpite já salvo'
                        : 'Salvar palpite e gerar PIX'}
                  </button>

                  {myPrediction && (
                    <div className="mt-4 rounded-2xl bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">
                      <CheckCircle2 className="mr-2 inline" size={16} />
                      Seu palpite salvo: {currentMatch.home_team} {myPrediction.home_guess} x{' '}
                      {myPrediction.away_guess} {currentMatch.away_team}

                      <button
                        type="button"
                        onClick={startNewEntry}
                        className="mt-3 block rounded-full bg-yellow-300 px-4 py-2 text-xs font-black text-emerald-950"
                      >
                        Quero fazer outro palpite
                      </button>
                    </div>
                  )}
                </form>
              </div>

              <div className="grid gap-5">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-[2rem] sm:p-5">
                  <button
                    type="button"
                    onClick={() => setPredictionsOpen((open) => !open)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                    aria-expanded={predictionsOpen}
                  >
                    <div>
                      <h3 className="text-lg font-black sm:text-xl">Palpites deste jogo</h3>
                      <p className="mt-1 text-sm text-emerald-100/60">
                        {paidPredictionRows.length} palpite
                        {paidPredictionRows.length === 1 ? '' : 's'} confirmado
                        {paidPredictionRows.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yellow-300 font-black text-emerald-950 transition-transform ${
                        predictionsOpen ? 'rotate-180' : ''
                      }`}
                    >
                      ↓
                    </span>
                  </button>

                  {predictionsOpen && (
                    <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1">
                      {paidPredictionRows.length ? (
                        paidPredictionRows.map(({ prediction, participant }) => (
                          <div
                            key={prediction.id}
                            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl bg-white/[0.06] p-3 sm:gap-3"
                          >
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-yellow-300 font-black text-emerald-950 sm:h-11 sm:w-11 sm:rounded-2xl">
                              {participant ? getInitials(participant.name) : '?'}
                            </div>

                            <div>
                              <strong className="block">{participant?.name || 'Participante'}</strong>
                              <span className="text-sm text-emerald-100/60">PIX confirmado</span>
                            </div>

                            <strong className="text-yellow-200">
                              {prediction.home_guess} x {prediction.away_guess}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-white/[0.05] p-4 text-emerald-100/65">
                          Nenhum palpite confirmado para este jogo ainda.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-[2rem] sm:p-5">
                  <h3 className="mb-4 text-lg font-black sm:text-xl">Resultado do prêmio</h3>

                  {currentMatch.home_score === null || currentMatch.away_score === null ? (
                    <div className="rounded-2xl bg-yellow-300/10 p-4 text-yellow-100">
                      <Clock className="mr-2 inline" size={18} />
                      Aguardando o resultado oficial ser lançado pelo administrador.
                    </div>
                  ) : exactWinners.length ? (
                    <div className="grid gap-3">
                      <div className="rounded-2xl bg-emerald-300/10 p-4 text-emerald-100">
                        <Trophy className="mr-2 inline text-yellow-200" size={18} />
                        {exactWinners.length} vencedor(es). Cada um recebe{' '}
                        {brl(gameFinancials.totalPrize / exactWinners.length)}.
                      </div>

                      {exactWinners.map(({ prediction, participant }) => (
                        <div key={prediction.id} className="rounded-2xl bg-white/[0.06] p-3 font-bold">
                          🏆 {participant?.name || 'Participante'} — {prediction.home_guess} x{' '}
                          {prediction.away_guess}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-red-400/10 p-4 text-red-100">
                      <AlertCircle className="mr-2 inline" size={18} />
                      Ninguém acertou o placar exato. O valor do prêmio fica com a organização.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:rounded-[2rem] sm:p-6">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">Regra do jogo</h2>

            <div className="mt-5 grid gap-3">
              <Rule title="💰 Prêmio atual" text={`${brl(gameFinancials.totalPrize)} disponíveis para este jogo.`} />
              <Rule title="👥 Participações pagas" text={`${gameFinancials.paidPredictionsCount} participação(ões) confirmada(s).`} />
              <Rule title="💼 Organização" text={`${settings.organizer_fee_percent || 10}% do arrecadado no jogo fica para organização.`} />
              <Rule title="🏆 Prêmio" text="O restante vai para quem acertar o placar exato da partida." />
              <Rule title="🤝 Vários ganhadores" text="Se mais de uma pessoa acertar, o prêmio é dividido igualmente." />
              <Rule title="💳 Pagamento obrigatório" text="Apenas palpites com pagamento confirmado participam da premiação." />
              <Rule title="👑 Sem ganhador" text="Se ninguém acertar o placar exato, o valor fica com a organização." />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:rounded-[2rem] sm:p-6">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">Próximos jogos</h2>

            <div className="mt-5 grid gap-3">
              {matches
                .filter((match) => match.id !== currentMatch?.id)
                .slice(0, 4)
                .map((match) => (
                  <div
                    key={match.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.06] p-3 sm:flex-nowrap sm:gap-3 sm:p-4"
                  >
                    <strong>
                      {teamFlag(match.home_team, match.home_flag)} {match.home_team} x {match.away_team}{' '}
                      {teamFlag(match.away_team, match.away_flag)}
                    </strong>

                    <span className="text-sm text-emerald-100/60">
                      {formatMatchDate(match.match_time)}
                    </span>
                  </div>
                ))}

              {matches.length <= 1 && (
                <p className="text-emerald-100/60">Nenhum próximo jogo cadastrado.</p>
              )}
            </div>
          </div>
        </section>

        {message && (
          <div className="fixed bottom-6 left-1/2 z-30 w-[min(92%,560px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-emerald-950/95 p-4 text-center font-bold text-white shadow-2xl backdrop-blur">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-3xl sm:p-5">
      <div className="mb-3 text-yellow-200">{icon}</div>
      <span className="block text-xs font-bold text-emerald-100/60 sm:text-sm">{label}</span>
      <strong className="mt-1 block text-2xl font-black tracking-tight text-yellow-200 sm:text-3xl">
        {value}
      </strong>
    </div>
  );
}

function MiniPrize({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-2xl sm:rounded-3xl sm:p-5 ${
        highlight ? 'border-yellow-200/25 bg-yellow-300/10' : 'border-white/10 bg-white/[0.06]'
      }`}
    >
      <span className="block text-xs font-bold text-emerald-100/60 sm:text-sm">{label}</span>
      <strong className="mt-2 block text-xl font-black text-yellow-200 sm:text-2xl">
        {value}
      </strong>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-black uppercase tracking-wider text-emerald-100/50">
        {label}
      </span>
      <strong className="mt-1 block break-words text-base text-white sm:text-lg">
        {value}
      </strong>
    </div>
  );
}

function TeamBlock({
  flag,
  team,
  right,
}: {
  flag: string | null;
  team: string;
  right?: boolean;
}) {
  const finalFlag = teamFlag(team, flag);

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${right ? 'justify-end text-right' : ''}`}>
      {!right && (
        <div className="grid h-12 w-12 place-items-center rounded-full border border-yellow-300/30 bg-white/15 text-3xl shadow-lg sm:h-16 sm:w-16 sm:text-4xl">
          {finalFlag}
        </div>
      )}

      <strong className="text-base font-black sm:text-xl md:text-2xl">{team}</strong>

      {right && (
        <div className="grid h-12 w-12 place-items-center rounded-full border border-yellow-300/30 bg-white/15 text-3xl shadow-lg sm:h-16 sm:w-16 sm:text-4xl">
          {finalFlag}
        </div>
      )}
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-4">
      <strong className="block">{title}</strong>
      <span className="mt-1 block text-sm leading-6 text-emerald-100/65">{text}</span>
    </div>
  );
}