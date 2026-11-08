import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useMe } from "@/app/useMe";
import { FormSection, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROTA = "/ajustes/parametros-de-venda";

type Parametros = {
  compra_validade_orcamento: number;
  compra_entrega_pedido: number;
  compra_entrega_orcamento: number;
  venda_validade_orcamento: number;
  venda_entrega_pedido: number;
  venda_entrega_orcamento: number;
  antecedencia_venda_recorrente: number;
  utilizar_limite_credito: boolean;
  limite_credito_novos: string;
  desconto_maximo_pedido: string;
  bloquear_venda_estoque_negativo: boolean;
  movimentar_estoque_importacao_xml: boolean;
  produto_pedido_compra_movimenta: boolean;
  produto_pedido_venda_movimenta: boolean;
  metodo_valorizacao_estoque: "CMP" | "PEPS";
  notificar_vencimento_estoque: boolean;
  informacoes_fiscais: boolean;
  formato_impressao: "80mm" | "58mm" | "A4";
  ipi_importacao_xml: boolean;
  nome_servico: string;
};

type Chave = keyof Parametros;
type Erros = Record<string, string[] | string>;

const NOMES_SERVICO = ["Ordem de Serviço", "Atendimento", "Consulta", "Contrato", "Fatura de serviço", "Job", "Pedido", "Venda"];

/** Ajustes › Empresa › Parâmetros de venda, nas seções da MarketUP (sem a parte de PDV). */
export function ParametrosVenda() {
  const { pode } = useMe();
  const podeAlterar = pode(ROTA, "alterar");
  const [dados, setDados] = useState<Parametros | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<Parametros>("/parametros-venda").then(setDados, (e: ApiError) => setAviso({ texto: e.message, erro: true }));
  }, []);

  if (!dados) {
    return (
      <>
        <PageHeader eyebrow="Empresa" title="Parâmetros de venda" />
        <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted xl:px-0">{aviso?.texto ?? "Carregando…"}</p>
      </>
    );
  }

  const set = <K extends Chave>(campo: K, valor: Parametros[K]) => setDados({ ...dados, [campo]: valor });
  const dias = (campo: Chave, rotulo: string) => (
    <TextField
      label={`${rotulo} (dias)`}
      type="number"
      min={0}
      inputMode="numeric"
      value={String(dados[campo])}
      onChange={(e) => set(campo, Number(e.target.value) as never)}
      error={erros[campo]}
      disabled={!podeAlterar}
    />
  );
  const simNao = (campo: Chave, rotulo: string, ajuda?: string) => (
    <div className="sm:col-span-2">
      <SwitchField label={rotulo} checked={dados[campo] as boolean} onChange={(v) => podeAlterar && set(campo, v as never)} />
      {ajuda && <p className="text-xs text-ink-muted">{ajuda}</p>}
    </div>
  );

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso(null);
    try {
      setDados(await api<Parametros>("/parametros-venda", { method: "PATCH", body: JSON.stringify(dados) }));
      setAviso({ texto: "Parâmetros de venda salvos.", erro: false });
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErros(erro.errors);
        setAviso({ texto: erro.message, erro: true });
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Empresa" title="Parâmetros de venda" />

      <form onSubmit={salvar} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <FormSection title="Prazos">
          <Grupo titulo="Compras">
            {dias("compra_validade_orcamento", "Prazo de validade para orçamento")}
            {dias("compra_entrega_pedido", "Entrega para pedido")}
            {dias("compra_entrega_orcamento", "Entrega para orçamento")}
          </Grupo>
          <Grupo titulo="Vendas">
            {dias("venda_validade_orcamento", "Prazo de validade para orçamento")}
            {dias("venda_entrega_pedido", "Entrega para pedido")}
            {dias("venda_entrega_orcamento", "Entrega para orçamento")}
          </Grupo>
          <SelectField
            label="Prazo de antecedência para venda recorrente"
            span={2}
            value={dados.antecedencia_venda_recorrente}
            onChange={(e) => set("antecedencia_venda_recorrente", Number(e.target.value))}
            options={[5, 10, 15].map((n) => ({ value: n, label: `${n} dias` }))}
            disabled={!podeAlterar}
          />
        </FormSection>

        <FormSection title="Crédito">
          {simNao("utilizar_limite_credito", "Utilizar limite de crédito")}
          <TextField
            label="Limite de crédito para novos clientes (R$)"
            span={2}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={dados.limite_credito_novos}
            onChange={(e) => set("limite_credito_novos", e.target.value)}
            error={erros.limite_credito_novos}
            disabled={!podeAlterar || !dados.utilizar_limite_credito}
          />
        </FormSection>

        <FormSection title="Desconto">
          <TextField
            label="Desconto máximo no pedido (%)"
            span={2}
            type="number"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            value={dados.desconto_maximo_pedido}
            onChange={(e) => set("desconto_maximo_pedido", e.target.value)}
            error={erros.desconto_maximo_pedido}
            disabled={!podeAlterar}
          />
        </FormSection>

        <FormSection title="Estoque">
          {simNao("bloquear_venda_estoque_negativo", "Bloquear venda com estoque negativo", "Impede vender um item que ficaria com estoque abaixo de zero.")}
          {simNao("movimentar_estoque_importacao_xml", "Movimentação de estoque via importação de XML")}
          {simNao("produto_pedido_compra_movimenta", "Cadastro de produtos via pedido de compra: movimentação de estoque")}
          {simNao("produto_pedido_venda_movimenta", "Cadastro de produtos via pedido de venda: movimentação de estoque")}
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 font-label text-sm text-ink-muted">Método de valorização do estoque</legend>
            <div className="flex gap-6">
              {(["CMP", "PEPS"] as const).map((m) => (
                <label key={m} className="flex min-h-12 items-center gap-2 text-sm font-semibold [@media(pointer:fine)]:min-h-[34px]">
                  <input
                    type="radio"
                    name="valorizacao"
                    checked={dados.metodo_valorizacao_estoque === m}
                    onChange={() => set("metodo_valorizacao_estoque", m)}
                    disabled={!podeAlterar}
                    className="size-4 accent-primary"
                  />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>
          {simNao("notificar_vencimento_estoque", "Receber notificações do vencimento do estoque")}
        </FormSection>

        <FormSection title="Fiscal">{simNao("informacoes_fiscais", "Informações fiscais")}</FormSection>

        <FormSection title="Impressão">
          <SelectField
            label="Formato de impressão"
            value={dados.formato_impressao}
            onChange={(e) => set("formato_impressao", e.target.value as Parametros["formato_impressao"])}
            options={["80mm", "58mm", "A4"].map((f) => ({ value: f, label: f }))}
            disabled={!podeAlterar}
          />
        </FormSection>

        <FormSection title="Importação">{simNao("ipi_importacao_xml", "Ativar IPI na importação de XML")}</FormSection>

        <FormSection title="Serviços">
          <SelectField
            label="Personalização do serviço"
            span={2}
            value={dados.nome_servico}
            onChange={(e) => set("nome_servico", e.target.value)}
            options={NOMES_SERVICO.map((n) => ({ value: n, label: n }))}
            disabled={!podeAlterar}
          />
          <p className="self-end text-xs text-ink-muted sm:col-span-2">Escolha como você quer chamar a sua prestação de serviços.</p>
        </FormSection>

        {aviso && (
          <p role="status" className={cn("mt-6 rounded-xs px-4 py-3 text-sm font-semibold", aviso.erro ? "bg-error-soft text-error" : "bg-success-soft text-success")}>
            {aviso.texto}
          </p>
        )}

        {podeAlterar && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
            <div className="mx-auto flex max-w-[992px] justify-end px-4 py-3 xl:px-0">
              <button type="submit" disabled={salvando} className="min-h-12 rounded-xs bg-primary px-8 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </form>
    </>
  );
}

/** Coluna de prazos (Compras / Vendas) ocupando metade da grade. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-y-4 sm:col-span-2 lg:col-span-2">
      <legend className="mb-2 text-sm font-bold uppercase text-primary-dark">{titulo}</legend>
      {children}
    </fieldset>
  );
}
