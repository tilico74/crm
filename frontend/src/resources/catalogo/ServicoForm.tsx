import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { ROTA_SERVICOS as ROTA } from "./ServicosList";
import { margem, type Servico, type Unidade } from "./types";

type Dados = Omit<Servico, "id" | "unidade_sigla">;
const VAZIO: Dados = { ativo: true, codigo_barras: "", nome: "", preco_custo: "0.00", preco_venda: "0.00", unidade: 1, reajustar_pela_margem: false };

/** Ficha do serviço, como na MarketUP: ativo, código de barras, nome, custo, valor, unidade. */
export function ServicoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [erros, setErros] = useState<Record<string, string[] | string>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(editando);

  useEffect(() => {
    api<Unidade[]>("/unidades").then(setUnidades, () => undefined);
    if (!editando) return;
    api<Servico>(`/servicos/${id}`).then(
      ({ id: _id, unidade_sigla: _u, ...resto }) => {
        setDados(resto);
        setCarregando(false);
      },
      (e: ApiError) => {
        setAviso(e.message);
        setCarregando(false);
      },
    );
  }, [editando, id]);

  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));
  const erro = (k: string) => {
    const e = erros[k];
    return Array.isArray(e) ? e.join(" ") : e;
  };

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    try {
      const salvo = await api<Servico>(editando ? `/servicos/${id}` : "/servicos", { method: editando ? "PUT" : "POST", body: JSON.stringify(dados) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else setAviso("Serviço salvo.");
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;
  const m = margem(dados.preco_custo, dados.preco_venda);

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Serviços" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="flex flex-col gap-7 lg:flex-row">
          <div className="w-full shrink-0 lg:w-[164px]">
            <SwitchField label="Serviço ativo?" checked={dados.ativo} onChange={(v) => podeSalvar && set("ativo", v)} />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-4">
            <TextField label="Código de barras" inputMode="numeric" className="font-mono tabular-nums" value={dados.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} error={erro("codigo_barras")} disabled={!podeSalvar} />
            <TextField label="Nome do serviço" required span={3} value={dados.nome} onChange={(e) => set("nome", e.target.value)} error={erro("nome")} disabled={!podeSalvar} />
            <TextField label="Custo R$" type="number" min={0} step="0.01" inputMode="decimal" className="text-right tabular-nums" value={dados.preco_custo} onChange={(e) => set("preco_custo", e.target.value)} error={erro("preco_custo")} disabled={!podeSalvar} />
            <TextField label="Valor R$" type="number" min={0} step="0.01" inputMode="decimal" className="text-right tabular-nums" value={dados.preco_venda} onChange={(e) => set("preco_venda", e.target.value)} error={erro("preco_venda")} disabled={!podeSalvar} />
            <div className="flex items-end gap-2" aria-live="polite">
              <span className={cn("text-2xl font-bold tabular-nums", m < 0 ? "text-error" : "text-success")}>{m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              <span className="pb-1 text-xs uppercase text-ink-muted">margem</span>
            </div>
            <SelectField label="Unidade" required value={dados.unidade ?? ""} onChange={(e) => set("unidade", e.target.value ? Number(e.target.value) : null)} options={unidades.map((u) => ({ value: u.id!, label: u.nome }))} error={erro("unidade")} disabled={!podeSalvar} />
            <div className="sm:col-span-4">
              <SwitchField label="Reajustar valor pela margem de lucro" checked={dados.reajustar_pela_margem} onChange={(v) => podeSalvar && set("reajustar_pela_margem", v)} />
            </div>
          </div>
        </div>
        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}
