"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  PlusCircle,
  RefreshCw,
  Save,
  Shield,
  Target,
  Trophy,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";

interface Setting {
  id: number;
  bolao_name: string;
  entry_value: number;
  pix_key: string | null;
  pix_name: string | null;
  organizer_fee_percent: number;
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


const TEAM_FLAGS: Record<string, string> = {
  brasil: '🇧🇷', brazil: '🇧🇷',
  argentina: '🇦🇷', uruguai: '🇺🇾', paraguai: '🇵🇾', chile: '🇨🇱', colombia: '🇨🇴', equador: '🇪🇨', ecuador: '🇪🇨', peru: '🇵🇪', bolivia: '🇧🇴', venezuela: '🇻🇪',
  mexico: '🇲🇽', méxico: '🇲🇽', estadosunidos: '🇺🇸', eua: '🇺🇸', usa: '🇺🇸', canadá: '🇨🇦', canada: '🇨🇦', costarica: '🇨🇷', panama: '🇵🇦', panamá: '🇵🇦', jamaica: '🇯🇲',
  franca: '🇫🇷', frança: '🇫🇷', france: '🇫🇷', alemanha: '🇩🇪', germany: '🇩🇪', espanha: '🇪🇸', spain: '🇪🇸', portugal: '🇵🇹', inglaterra: '🏴', england: '🏴',
  holanda: '🇳🇱', paisesbaixos: '🇳🇱', paísesbaixos: '🇳🇱', netherlands: '🇳🇱', italia: '🇮🇹', itália: '🇮🇹', belgium: '🇧🇪', belgica: '🇧🇪', bélgica: '🇧🇪',
  croacia: '🇭🇷', croácia: '🇭🇷', suica: '🇨🇭', suíça: '🇨🇭', denmark: '🇩🇰', dinamarca: '🇩🇰', polonia: '🇵🇱', polônia: '🇵🇱', servia: '🇷🇸', sérvia: '🇷🇸',
  japao: '🇯🇵', japão: '🇯🇵', japan: '🇯🇵', coreiadosul: '🇰🇷', coreia: '🇰🇷', austrália: '🇦🇺', australia: '🇦🇺', iran: '🇮🇷', irã: '🇮🇷', catar: '🇶🇦', qatar: '🇶🇦', arabiasaudita: '🇸🇦', arábiasaudita: '🇸🇦',
  marrocos: '🇲🇦', morocco: '🇲🇦', senegal: '🇸🇳', gana: '🇬🇭', ghana: '🇬🇭', camaroes: '🇨🇲', camarões: '🇨🇲', nigeria: '🇳🇬', nigéria: '🇳🇬', tunisia: '🇹🇳', tunísia: '🇹🇳'
};

function normalizeTeamName(team: string) {
  return team
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function teamFlag(team: string, savedFlag?: string | null) {
  return TEAM_FLAGS[normalizeTeamName(team)] || savedFlag || '🏳️';
}

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Não informado";

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

function paymentLabel(status?: string | null, paid?: boolean) {
  if (paid || status === "approved") return "Pago";
  if (status === "pending") return "Pendente";
  if (status === "cancelled") return "Cancelado";
  if (status === "rejected") return "Recusado";
  return status || "Pendente";
}

export default function AdminPage() {
  const [settings, setSettings] = useState<Setting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [newHomeTeam, setNewHomeTeam] = useState("");
  const [newAwayTeam, setNewAwayTeam] = useState("");
  const [newHomeFlag, setNewHomeFlag] = useState("🇧🇷");
  const [newAwayFlag, setNewAwayFlag] = useState("🇦🇷");
  const [newStage, setNewStage] = useState("Jogo da Copa");
  const [newMatchTime, setNewMatchTime] = useState("");

  const activeMatch = useMemo(() => {
    return matches.find((m) => m.active) || matches[0] || null;
  }, [matches]);

  const activePredictions = useMemo(() => {
    if (!activeMatch) return [];
    return predictions.filter((p) => p.match_id === activeMatch.id);
  }, [predictions, activeMatch]);

  const paidPredictions = useMemo(() => {
    return activePredictions.filter((prediction) => {
      const participant = participants.find(
        (p) => p.id === prediction.participant_id,
      );
      return participant?.paid;
    });
  }, [activePredictions, participants]);

  const winners = useMemo(() => {
    if (!activeMatch) return [];

    const hasFinalScore =
      activeMatch.home_score !== null && activeMatch.away_score !== null;

    if (hasFinalScore) {
      return paidPredictions.filter(
        (prediction) =>
          prediction.home_guess === activeMatch.home_score &&
          prediction.away_guess === activeMatch.away_score,
      );
    }

    return paidPredictions.filter((p) => p.winner);
  }, [activeMatch, paidPredictions]);

  const paidParticipants = participants.filter((p) => p.paid).length;
  const pendingParticipants = participants.filter((p) => !p.paid).length;
  const entryValue = Number(settings?.entry_value || 0);
  const organizerPercent = Number(settings?.organizer_fee_percent || 10);
  const grossFromEntries = paidPredictions.length * entryValue;
  const organizerFee = grossFromEntries * (organizerPercent / 100);
  const prizePool = grossFromEntries - organizerFee;
  const prizePerWinner = winners.length ? prizePool / winners.length : 0;
  const organizerReceivesIfNoWinner = winners.length
    ? organizerFee
    : grossFromEntries;
  const organizerReceivesWithWinner = organizerFee;

  async function loadData() {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [
      settingsResult,
      participantsResult,
      matchesResult,
      predictionsResult,
    ] = await Promise.all([
      supabase.from("settings").select("*").single(),
      supabase
        .from("participants")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true }),
      supabase
        .from("predictions")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    if (settingsResult.error) console.error(settingsResult.error);
    if (participantsResult.error) console.error(participantsResult.error);
    if (matchesResult.error) console.error(matchesResult.error);
    if (predictionsResult.error) console.error(predictionsResult.error);

    setSettings(settingsResult.data || null);
    setParticipants(participantsResult.data || []);
    setMatches(matchesResult.data || []);
    setPredictions(predictionsResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveSettings() {
    if (!supabase || !settings) return;

    setSaving(true);

    const { error } = await supabase
      .from("settings")
      .update({
        bolao_name: settings.bolao_name,
        entry_value: Number(settings.entry_value || 0),
        pix_key: settings.pix_key,
        pix_name: settings.pix_name,
        organizer_fee_percent: Number(settings.organizer_fee_percent || 0),
        rollover_amount: Number(settings.rollover_amount || 0),
      })
      .eq("id", settings.id);

    setSaving(false);
    setMessage(
      error
        ? "Erro ao salvar configurações."
        : "Configurações salvas com sucesso.",
    );

    if (!error) loadData();
  }

  async function createMatch() {
    if (!supabase) return;

    if (!newHomeTeam.trim() || !newAwayTeam.trim()) {
      setMessage("Informe os dois times para criar o jogo.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("matches").insert({
      home_team: newHomeTeam.trim(),
      away_team: newAwayTeam.trim(),
      home_flag: newHomeFlag.trim() || null,
      away_flag: newAwayFlag.trim() || null,
      stage: newStage.trim() || "Jogo da Copa",
      match_time: newMatchTime ? new Date(newMatchTime).toISOString() : null,
      active: false,
      locked: false,
      finalized: false,
      home_score: null,
      away_score: null,
      prize_amount: 0,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("Erro ao criar jogo. Verifique as permissões no Supabase.");
      return;
    }

    setMessage("Jogo criado com sucesso.");
    setNewHomeTeam("");
    setNewAwayTeam("");
    setNewHomeFlag("🇧🇷");
    setNewAwayFlag("🇦🇷");
    setNewStage("Jogo da Copa");
    setNewMatchTime("");
    loadData();
  }

  async function togglePaid(participant: Participant) {
    if (!supabase) return;

    const newPaid = !participant.paid;
    const { error } = await supabase
      .from("participants")
      .update({
        paid: newPaid,
        payment_status: newPaid ? "approved_manual" : "pending",
        payment_approved_at: newPaid ? new Date().toISOString() : null,
        payment_method: participant.payment_method || "manual",
      })
      .eq("id", participant.id);

    if (error) {
      console.error(error);
      setMessage(
        "Erro ao alterar pagamento. Verifique as permissões no Supabase.",
      );
      return;
    }

    setMessage(
      newPaid
        ? "Pagamento confirmado manualmente."
        : "Pagamento voltou para pendente.",
    );
    loadData();
  }

  async function setActiveMatch(match: Match) {
    if (!supabase) return;

    setSaving(true);
    await supabase
      .from("matches")
      .update({ active: false })
      .neq("id", match.id);
    const { error } = await supabase
      .from("matches")
      .update({ active: true })
      .eq("id", match.id);
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("Erro ao ativar jogo.");
      return;
    }

    setMessage("Jogo ativo atualizado.");
    loadData();
  }

  async function toggleLock(match: Match) {
    if (!supabase) return;

    const { error } = await supabase
      .from("matches")
      .update({ locked: !match.locked })
      .eq("id", match.id);

    if (error) {
      console.error(error);
      setMessage("Erro ao bloquear/desbloquear jogo.");
      return;
    }

    setMessage(!match.locked ? "Palpites bloqueados." : "Palpites liberados.");
    loadData();
  }

  async function updateScore(
    match: Match,
    field: "home_score" | "away_score",
    value: string,
  ) {
    if (!supabase) return;

    const parsedValue = value === "" ? null : Number(value);
    const { error } = await supabase
      .from("matches")
      .update({ [field]: parsedValue })
      .eq("id", match.id);

    if (error) {
      console.error(error);
      setMessage("Erro ao atualizar placar.");
      return;
    }

    setMatches((current) =>
      current.map((item) =>
        item.id === match.id ? { ...item, [field]: parsedValue } : item,
      ),
    );
  }

  async function finalizeMatch(match: Match) {
    if (!supabase) return;

    if (match.home_score === null || match.away_score === null) {
      setMessage("Informe o placar final antes de finalizar o jogo.");
      return;
    }

    setSaving(true);

    const matchPredictions = predictions.filter(
      (prediction) => prediction.match_id === match.id,
    );
    const paidParticipantIds = new Set(
      participants.filter((p) => p.paid).map((p) => p.id),
    );

    const updates = matchPredictions.map((prediction) => {
      const isPaid = paidParticipantIds.has(prediction.participant_id);
      const exactScore =
        prediction.home_guess === match.home_score &&
        prediction.away_guess === match.away_score;
      const points = isPaid && exactScore ? 1 : 0;

      return supabase
        .from("predictions")
        .update({
          points,
          winner: Boolean(points),
        })
        .eq("id", prediction.id);
    });

    await Promise.all(updates);

    const winnerCount = matchPredictions.filter(
      (prediction) =>
        paidParticipantIds.has(prediction.participant_id) &&
        prediction.home_guess === match.home_score &&
        prediction.away_guess === match.away_score,
    ).length;

    const paidCount = matchPredictions.filter((prediction) =>
      paidParticipantIds.has(prediction.participant_id),
    ).length;
    const gross = paidCount * Number(settings?.entry_value || 0);
    const fee = gross * (Number(settings?.organizer_fee_percent || 10) / 100);
    const totalPrize = gross - fee + Number(settings?.rollover_amount || 0);

    const { error } = await supabase
      .from("matches")
      .update({
        finalized: true,
        locked: true,
        prize_amount: winnerCount ? totalPrize / winnerCount : 0,
      })
      .eq("id", match.id);

    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("Erro ao finalizar jogo.");
      return;
    }

    setMessage(
      winnerCount
        ? `Jogo finalizado com ${winnerCount} vencedor(es).`
        : "Jogo finalizado sem vencedores.",
    );
    loadData();
  }

  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
          <AlertCircle className="mb-3 text-red-300" />
          <h1 className="text-2xl font-black">Supabase não configurado</h1>
          <p className="mt-2 text-slate-300">
            Configure as variáveis do Supabase no arquivo .env.local.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#06110d] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(255,223,0,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(0,39,118,0.38),transparent_34%),linear-gradient(135deg,#001f16_0%,#004b26_40%,#002776_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(0,151,57,0.16),rgba(255,223,0,0.10),rgba(0,39,118,0.18))]" />
      <div className="mx-auto w-[min(1180px,94%)] py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm font-bold text-emerald-200">
              <Shield size={16} /> Painel Admin
            </div>
            <h1 className="text-3xl font-black md:text-5xl">
              {settings?.bolao_name || "Bolão da Copa"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Painel financeiro, pagamentos PIX, jogos, palpites e divisão
              automática dos prêmios.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-emerald-950 transition hover:scale-[1.02] disabled:opacity-60"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />{" "}
            Atualizar
          </button>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-5">
          <StatCard
            icon={<Users size={20} />}
            label="Participantes"
            value={String(participants.length)}
            accent="blue"
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Pagos"
            value={String(paidParticipants)}
            accent="green"
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Pendentes"
            value={String(pendingParticipants)}
            accent="yellow"
          />
          <StatCard
            icon={<Wallet size={20} />}
            label="Arrecadado no jogo"
            value={money(grossFromEntries)}
            accent="green"
          />
          <StatCard
            icon={<Trophy size={20} />}
            label="Prêmio do jogo"
            value={money(prizePool)}
            accent="yellow"
          />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-4">
          <PrizeCard
            title="🏆 Divisão do prêmio"
            value={winners.length ? money(prizePerWinner) : money(0)}
            description={
              winners.length
                ? `${winners.length} vencedor(es). Cada um recebe ${money(prizePerWinner)}.`
                : "Nenhum vencedor até agora. Se finalizar assim, o prêmio fica com a organização."
            }
          />
          <PrizeCard
            title="💼 Organização"
            value={money(
              winners.length
                ? organizerReceivesWithWinner
                : organizerReceivesIfNoWinner,
            )}
            description={
              winners.length
                ? `${organizerPercent}% da arrecadação.`
                : "Sem ganhador, 100% da arrecadação fica com a organização."
            }
          />
          <PrizeCard
            title="👥 Palpites pagos"
            value={String(paidPredictions.length)}
            description="Somente estes entram no cálculo do prêmio."
          />
          <PrizeCard
            title="🎯 Acertadores"
            value={String(winners.length)}
            description="Baseado no placar final informado ou no jogo finalizado."
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-6">
            <Card title="Configurações" icon={<Save size={20} />}>
              {settings ? (
                <div className="grid gap-3">
                  <Label text="Nome do bolão">
                    <input
                      value={settings.bolao_name}
                      onChange={(e) =>
                        setSettings({ ...settings, bolao_name: e.target.value })
                      }
                      className="input"
                    />
                  </Label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Label text="Valor da entrada">
                      <input
                        type="number"
                        value={settings.entry_value}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            entry_value: Number(e.target.value),
                          })
                        }
                        className="input"
                      />
                    </Label>
                    <Label text="Taxa do organizador (%)">
                      <input
                        type="number"
                        value={settings.organizer_fee_percent}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            organizer_fee_percent: Number(e.target.value),
                          })
                        }
                        className="input"
                      />
                    </Label>
                  </div>

                  <Label text="Acumulado para este jogo">
                    <input
                      type="number"
                      value={settings.rollover_amount || 0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          rollover_amount: Number(e.target.value),
                        })
                      }
                      className="input"
                    />
                  </Label>

                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    Salvar configurações
                  </button>
                </div>
              ) : (
                <p className="text-slate-300">Carregando configurações...</p>
              )}
            </Card>

            <Card title="Criar jogo" icon={<PlusCircle size={20} />}>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label text="Time da casa">
                    <input
                      value={newHomeTeam}
                      onChange={(e) => setNewHomeTeam(e.target.value)}
                      className="input"
                    />
                  </Label>
                  <Label text="Time visitante">
                    <input
                      value={newAwayTeam}
                      onChange={(e) => setNewAwayTeam(e.target.value)}
                      className="input"
                    />
                  </Label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Label text="Bandeira casa">
                    <input
                      value={newHomeFlag}
                      placeholder="Opcional: automático pelo nome"
                      onChange={(e) => setNewHomeFlag(e.target.value)}
                      className="input"
                    />
                  </Label>
                  <Label text="Bandeira visitante">
                    <input
                      value={newAwayFlag}
                      placeholder="Opcional: automático pelo nome"
                      onChange={(e) => setNewAwayFlag(e.target.value)}
                      className="input"
                    />
                  </Label>
                  <Label text="Fase">
                    <input
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      className="input"
                    />
                  </Label>
                </div>

                <Label text="Data e hora">
                  <input
                    type="datetime-local"
                    value={newMatchTime}
                    onChange={(e) => setNewMatchTime(e.target.value)}
                    className="input"
                  />
                </Label>

                <button
                  onClick={createMatch}
                  disabled={saving}
                  className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200 disabled:opacity-60"
                >
                  Criar jogo
                </button>
              </div>
            </Card>
          </section>

          <section className="space-y-6">
            <Card title="Jogo ativo" icon={<Target size={20} />}>
              {activeMatch ? (
                <div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                          {activeMatch.stage || "Jogo"}
                        </p>
                        <h2 className="mt-1 text-2xl font-black">
                          {teamFlag(activeMatch.home_team, activeMatch.home_flag)} {activeMatch.home_team} x{" "}
                          {activeMatch.away_team} {teamFlag(activeMatch.away_team, activeMatch.away_flag)}
                        </h2>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                          <CalendarDays size={15} />{" "}
                          {dateLabel(activeMatch.match_time)}
                        </p>
                      </div>
                      <Badge ok={activeMatch.locked}>
                        {activeMatch.locked ? "Bloqueado" : "Aberto"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Label text={`Placar ${activeMatch.home_team}`}>
                        <input
                          type="number"
                          value={activeMatch.home_score ?? ""}
                          onChange={(e) =>
                            updateScore(
                              activeMatch,
                              "home_score",
                              e.target.value,
                            )
                          }
                          className="input"
                        />
                      </Label>
                      <Label text={`Placar ${activeMatch.away_team}`}>
                        <input
                          type="number"
                          value={activeMatch.away_score ?? ""}
                          onChange={(e) =>
                            updateScore(
                              activeMatch,
                              "away_score",
                              e.target.value,
                            )
                          }
                          className="input"
                        />
                      </Label>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() => toggleLock(activeMatch)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black transition hover:bg-white/15"
                      >
                        {activeMatch.locked ? (
                          <Unlock size={18} />
                        ) : (
                          <Lock size={18} />
                        )}
                        {activeMatch.locked ? "Desbloquear" : "Bloquear"}{" "}
                        palpites
                      </button>
                      <button
                        onClick={() => finalizeMatch(activeMatch)}
                        disabled={saving || activeMatch.finalized}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-50"
                      >
                        <Crown size={18} />{" "}
                        {activeMatch.finalized
                          ? "Finalizado"
                          : "Finalizar jogo"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniStat
                      label="Palpites pagos"
                      value={String(paidPredictions.length)}
                    />
                    <MiniStat
                      label="Vencedores"
                      value={String(winners.length)}
                    />
                    <MiniStat
                      label="Por vencedor"
                      value={
                        winners.length ? money(prizePerWinner) : "Sem ganhador"
                      }
                    />
                  </div>

                  <div className="mt-4 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                    <div className="mb-3 flex items-center gap-2 text-yellow-100">
                      <TrendingUp size={18} />
                      <h3 className="font-black">
                        Simulação financeira do jogo ativo
                      </h3>
                    </div>
                    <div className="grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-slate-400">Arrecadação</p>
                        <p className="text-xl font-black">
                          {money(grossFromEntries)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-slate-400">Taxa organização</p>
                        <p className="text-xl font-black">
                          {money(organizerFee)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-slate-400">Prêmio total</p>
                        <p className="text-xl font-black text-yellow-200">
                          {money(prizePool)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-slate-400">Regra sem ganhador</p>
                        <p className="text-xl font-black">
                          Organização fica com {money(grossFromEntries)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-300">Nenhum jogo cadastrado.</p>
              )}
            </Card>

            <Card title="Todos os jogos" icon={<CalendarDays size={20} />}>
              <div className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black">
                          {teamFlag(match.home_team, match.home_flag)} {match.home_team} x{" "}
                          {match.away_team} {teamFlag(match.away_team, match.away_flag)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {dateLabel(match.match_time)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setActiveMatch(match)}
                          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15"
                        >
                          {match.active ? "Ativo" : "Ativar"}
                        </button>
                        <button
                          onClick={() => toggleLock(match)}
                          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15"
                        >
                          {match.locked ? "Desbloquear" : "Bloquear"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card title="Participantes e pagamentos" icon={<Users size={20} />}>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black">{participant.name}</h3>
                        <Badge ok={participant.paid}>
                          {paymentLabel(
                            participant.payment_status,
                            participant.paid,
                          )}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {participant.phone || "Sem telefone"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cadastro: {dateLabel(participant.created_at)}
                      </p>
                    </div>

                    <button
                      onClick={() => togglePaid(participant)}
                      className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                        participant.paid
                          ? "bg-red-400/20 text-red-100 hover:bg-red-400/30"
                          : "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                      }`}
                    >
                      {participant.paid
                        ? "Marcar pendente"
                        : "Confirmar manual"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-xl bg-black/30 p-3 text-xs text-slate-200 sm:grid-cols-2">
                    <div>
                      <strong>ID Pagamento:</strong>{" "}
                      {participant.payment_id || "Não gerado"}
                    </div>
                    <div>
                      <strong>Status:</strong>{" "}
                      {participant.payment_status || "pending"}
                    </div>
                    <div>
                      <strong>Valor:</strong>{" "}
                      {participant.payment_amount !== null &&
                      participant.payment_amount !== undefined
                        ? money(Number(participant.payment_amount))
                        : "Não informado"}
                    </div>
                    <div>
                      <strong>Método:</strong>{" "}
                      {participant.payment_method?.toUpperCase() ||
                        "Não informado"}
                    </div>
                    <div className="sm:col-span-2">
                      <strong>Aprovado em:</strong>{" "}
                      {dateLabel(participant.payment_approved_at)}
                    </div>
                  </div>
                </div>
              ))}

              {!participants.length && (
                <p className="text-slate-300">
                  Nenhum participante cadastrado ainda.
                </p>
              )}
            </div>
          </Card>

          <Card title="Palpites do jogo ativo" icon={<Target size={20} />}>
            <div className="space-y-3">
              {activePredictions.map((prediction) => {
                const participant = participants.find(
                  (p) => p.id === prediction.participant_id,
                );

                return (
                  <div
                    key={prediction.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {participant?.name || "Participante removido"}
                        </p>
                        <p className="text-sm text-slate-400">
                          Palpite: {prediction.home_guess} x{" "}
                          {prediction.away_guess}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge ok={Boolean(participant?.paid)}>
                          {participant?.paid ? "Pago" : "Pendente"}
                        </Badge>
                        {winners.some(
                          (winner) => winner.id === prediction.id,
                        ) && (
                          <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">
                            Ganhador: {money(prizePerWinner)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!activePredictions.length && (
                <p className="text-slate-300">
                  Nenhum palpite para o jogo ativo.
                </p>
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-lg font-black">
        <span className="text-emerald-300">{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-200">
      {text}
      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = "green",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "green" | "yellow" | "blue";
}) {
  const styles = {
    green:
      "from-emerald-400/20 to-green-500/5 text-emerald-100 border-emerald-300/20",
    yellow:
      "from-yellow-300/25 to-yellow-500/5 text-yellow-100 border-yellow-300/25",
    blue: "from-blue-400/20 to-blue-700/5 text-blue-100 border-blue-300/20",
  };

  return (
    <div
      className={`rounded-3xl border bg-gradient-to-br ${styles[accent]} p-5 shadow-xl backdrop-blur`}
    >
      <div className="mb-3 inline-flex rounded-2xl bg-white/10 p-3">{icon}</div>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function PrizeCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-xl backdrop-blur">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-yellow-200">
        {title}
      </p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        {description}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${
        ok
          ? "bg-emerald-400/20 text-emerald-100"
          : "bg-yellow-300/20 text-yellow-100"
      }`}
    >
      {children}
    </span>
  );
}
