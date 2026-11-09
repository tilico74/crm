import { useList } from "@refinedev/core";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormSection, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { ROTA_APROVACAO, ROTA_COMISSOES, type Comissao, type Fechamento } from "./types";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const num = (v: string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aprovação de comissões: lista dos fechamentos. */
export function FechamentosList() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(20);
  const { result, query } = useList<Fechamento>({ resource: "fechamentos-comissao", pagination: { currentPage: 1, pageSize } });
  return (
    <>
      <PageHeader eyebrow="Vendas" title="Aprovação de comissões" />
      <div className="mx-auto max-w-[992px] px-4 pb-10 pt-6 xl:px-0">
        <p className="mb-4 text-sm text-ink-muted">
          Para fechar, marque os lançamentos em aberto em <Link to={ROTA_COMISSOES} className="font-semibold text-primary underline">Comissões</Link> e use "Fechar selecionados".
        </p>
        <table className="w-full text-sm text-ink">
          <thead>
            <tr className="h-[60px] border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
              <th className="px-1">Nº</th>
              <th className="px-1">Data</th>
              <th className="px-1">Descrição</th>
              <th className="px-1 text-right">Lançamentos</th>
              <th className="px-1 text-right">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((f) => (
              <tr key={f.id} onClick={() => navigate(`${ROTA_APROVACAO}/${f.id}`)} className="cursor-pointer border-b border-line hover:bg-primary-light">
                <td className="px-1 py-3 tabular-nums text-primary">{f.id}</td>
                <td className="px-1 tabular-nums">{formatarData(f.data)}</td>
                <td className="px-1">{f.descricao || "—"}</td>
                <td className="px-1 text-right tabular-nums">{f.comissoes.length}</td>
                <td className="px-1 text-right font-semibold tabular-nums">{formatarMoeda(f.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && result.data.length === 0 && <p className="py-8 text-center text-sm font-semibold uppercase text-ink-muted">Nenhum fechamento.</p>}
        {result.data.length < (result.total ?? 0) && (
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setPageSize((n) => n + 20)} className="min-h-12 rounded-xs bg-secondary px-4 text-xs font-bold uppercase text-surface-raised md:min-h-9">Ver mais registros</button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Ficha da aprovação (seller_commission_closing da MarketUP): lançamentos escolhidos (Comissionado · Data · Venda ·
 * % · Comissão · Origem) + Data · Descrição · Valor total. Salvar fecha e gera as contas a pagar ("registro financeiro").
 * Só quem tem a permissão de aprovar (o gerente); ninguém aprova a própria comissão (o servidor confere).
 */
export function FechamentoForm() {
  const { id } = useParams();
  const novo = id === "novo";
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { comissoes?: Comissao[] } | null };
  const { pode } = useMe();
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [comissoes, setComissoes] = useState<Comissao[]>(novo ? (state?.comissoes ?? []) : []);
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desfazer, setDesfazer] = useState(false);

  useEffect(() => {
    if (novo) return;
    api<Fechamento>(`/fechamentos-comissao/${id}`).then(
      (f) => {
        setFechamento(f);
        setComissoes(f.comissoes);
        setData(f.data);
        setDescricao(f.descricao);
      },
      (e: ApiError) => setAviso(e.message),
    );
  }, [id, novo]);

  const total = comissoes.reduce((s, c) => s + Number(c.valor), 0);
  const podeSalvar = novo && comissoes.length > 0 && pode(ROTA_APROVACAO, "adicionar");

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setAviso("");
    setErro(false);
    try {
      const f = await api<Fechamento>("/fechamentos-comissao", { method: "POST", body: JSON.stringify({ data, descricao, comissoes: comissoes.map((c) => c.id) }) });
      navigate(voltar ? ROTA_APROVACAO : `${ROTA_APROVACAO}/${f.id}`, { replace: true });
    } catch (falha) {
      setErro(true);
      setAviso(falha instanceof ApiError ? falha.message : "Não foi possível fechar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Aprovação de comissões" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <FormSection title="Dados gerais">
          <div className="overflow-x-auto sm:col-span-2 lg:col-span-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
                  <th className="px-1 py-2">Comissionado</th>
                  <th className="px-1">Data</th>
                  <th className="px-1 text-right">Venda</th>
                  <th className="px-1 text-right">% Comissão</th>
                  <th className="px-1 text-right">Comissão</th>
                  <th className="px-1">Origem</th>
                  {novo && <th className="w-10"><span className="sr-only">Remover</span></th>}
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id} className="border-b border-line">
                    <td className="px-1 py-2 uppercase">{c.vendedor_nome}</td>
                    <td className="px-1 tabular-nums">{formatarData(c.emissao)}</td>
                    <td className="px-1 text-right tabular-nums">{formatarMoeda(c.valor_venda)}</td>
                    <td className="px-1 text-right tabular-nums">{num(c.percentual)}</td>
                    <td className={cn("px-1 text-right font-semibold tabular-nums", Number(c.valor) < 0 && "text-error")}>{formatarMoeda(c.valor)}</td>
                    <td className="px-1">{c.pedido ? <Link to={`/vendas/pedidos/${c.pedido}`} className="text-primary underline">Pedido {c.pedido}</Link> : c.tipo_nome}</td>
                    {novo && (
                      <td className="text-center">
                        <button type="button" onClick={() => setComissoes((l) => l.filter((x) => x.id !== c.id))} aria-label={`Tirar ${c.vendedor_nome} do fechamento`} className="inline-flex size-10 items-center justify-center text-ink-muted hover:text-error">×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {comissoes.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-muted">
                Nenhum lançamento escolhido. Marque os lançamentos em <Link to={ROTA_COMISSOES} className="font-semibold text-primary underline">Comissões</Link>.
              </p>
            )}
          </div>
          <TextField label="Data" type="date" required value={data} disabled={!novo} onChange={(e) => setData(e.target.value)} />
          <TextField label="Descrição" span={2} maxLength={300} value={descricao} disabled={!novo} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Comissões de novembro" />
          <TextField label="Valor total" value={formatarMoeda(total)} disabled readOnly className="text-right font-semibold" />
        </FormSection>

        {fechamento && (
          <FormSection title="Registro financeiro">
            <div className="sm:col-span-2 lg:col-span-4">
              {fechamento.contas_pagar.length === 0 ? (
                <p className="text-sm text-ink-muted">Nada a pagar neste fechamento (valores zerados ou só estornos).</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {fechamento.contas_pagar.map((c) => (
                    <li key={c.id} className={cn("flex flex-wrap justify-between gap-2 py-2", c.cancelada && "text-ink-muted line-through")}>
                      <span>Conta a pagar Nº {c.id} · {c.descricao}</span>
                      <span className="tabular-nums">vence {formatarData(c.vencimento)} · <strong>{formatarMoeda(c.valor)}</strong></span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-ink-muted">O pagamento das contas a pagar chega com o Financeiro (T302).</p>
            </div>
          </FormSection>
        )}

        <BarraAcoes
          voltar={novo ? ROTA_COMISSOES : ROTA_APROVACAO}
          aviso={aviso}
          erro={erro}
          podeSalvar={podeSalvar}
          salvando={salvando}
          onSalvarEVoltar={salvar(true)}
          extras={
            fechamento && pode(ROTA_APROVACAO, "excluir") ? (
              <button type="button" onClick={() => setDesfazer(true)} className="min-h-12 rounded-xs bg-error px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
                Desfazer fechamento
              </button>
            ) : null
          }
        />
      </form>

      {desfazer && (
        <ConfirmDialog
          title="Desfazer fechamento"
          message={`Desfazer o fechamento Nº ${id}? Os lançamentos voltam a ficar em aberto e as contas a pagar dele são canceladas.`}
          confirmLabel="Desfazer"
          onCancel={() => setDesfazer(false)}
          onConfirm={async () => {
            setDesfazer(false);
            try {
              await api(`/fechamentos-comissao/${id}`, { method: "DELETE" });
              navigate(ROTA_APROVACAO);
            } catch (e) {
              setErro(true);
              setAviso(e instanceof ApiError ? e.message : "Não foi possível desfazer.");
            }
          }}
        />
      )}
    </>
  );
}
