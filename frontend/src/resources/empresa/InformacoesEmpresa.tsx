import { IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useMe } from "@/app/useMe";
import { CepField } from "@/components/CepField";
import { EnderecoField } from "@/components/EnderecoField";
import { FormSection, MaskedField, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { camposDoCep, listarEstados, listarMunicipios, type Estado, type Municipio } from "@/lib/localidades";
import { limpar, type TipoMascara } from "@/lib/mascaras";
import { normalizarNome } from "@/lib/normalizarNome";
import { cn } from "@/lib/utils";

const ROTA = "/ajustes/empresa";

type Endereco = {
  tipo: "faturamento" | "entregas" | "correspondencias";
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ibge: string;
};

type Empresa = {
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  email: string;
  telefone: string;
  whatsapp: string;
  area_atuacao: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  logotipo: string | null;
  fuso_horario: string;
  horario_verao: boolean;
  produtor_rural: boolean;
  enderecos: Endereco[];
};

// Mesmas listas do back-end (apps/core/models.py), na ordem da MarketUP.
const AREAS = [
  "Mercados, empórios e padarias",
  "Casa, construção e jardinagem",
  "Informática, games e eletrônicos",
  "Comércio varejista ou especializado",
  "Roupas, calçados e acessórios",
  "Perfumarias e farmácias",
  "Veterinárias e pet shops",
  "Salões de beleza, clínicas e spa",
  "Bares, restaurantes e lanchonetes",
  "Bancas, quiosques e papelarias",
  "Oficinas mecânicas e técnicas",
  "Prestadores de serviços e MEIs",
];
const FUSOS = [
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { value: "America/Manaus", label: "Amazonas (UTC-4)" },
  { value: "America/Rio_Branco", label: "Acre (UTC-5)" },
];
const TITULO_ENDERECO = { faturamento: "Faturamento", entregas: "Entregas", correspondencias: "Correspondências" };

type Erros = Record<string, string[] | string>;

/** Ajustes › Empresa › Informações da empresa, no modelo da tela "Dados gerais" da MarketUP. */
export function InformacoesEmpresa() {
  const { pode } = useMe();
  const podeAlterar = pode(ROTA, "alterar");
  const [dados, setDados] = useState<Empresa | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Record<string, Municipio[]>>({});

  useEffect(() => {
    api<Empresa>("/empresa").then(setDados, (e: ApiError) => setAviso({ texto: e.message, erro: true }));
    // Sem a lista do IBGE o campo UF continua com o valor salvo.
    listarEstados().then(setEstados, () => undefined);
  }, []);

  // Carrega os municípios de cada UF usada nos endereços (sugestões do campo Cidade).
  const ufsUsadas = [...new Set(dados?.enderecos.map((e) => e.uf).filter(Boolean))].join(",");
  useEffect(() => {
    for (const uf of ufsUsadas.split(",").filter(Boolean)) {
      if (municipios[uf]) continue;
      listarMunicipios(uf).then((lista) => setMunicipios((m) => ({ ...m, [uf]: lista })), () => undefined);
    }
  }, [ufsUsadas]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dados) {
    return (
      <>
        <PageHeader eyebrow="Empresa" title="Informações da empresa" />
        <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted xl:px-0">{aviso?.texto ?? "Carregando…"}</p>
      </>
    );
  }

  const set = <K extends keyof Empresa>(campo: K, valor: Empresa[K]) => setDados({ ...dados, [campo]: valor });
  const texto = (campo: keyof Empresa) => ({
    value: (dados[campo] as string) ?? "",
    onChange: (e: { target: { value: string } }) => set(campo, e.target.value as never),
    error: erros[campo],
    disabled: !podeAlterar,
  });
  const mascarado = (campo: "cnpj" | "telefone" | "whatsapp", mascara: TipoMascara) => ({
    mascara,
    value: dados[campo],
    onChange: (v: string) => set(campo, v),
    error: erros[campo],
    disabled: !podeAlterar,
  });
  // Forma funcional: a busca de CEP termina depois e não pode usar um estado antigo.
  const mudarEndereco = (tipo: Endereco["tipo"], campos: Partial<Endereco>) =>
    setDados((d) => d && { ...d, enderecos: d.enderecos.map((e) => (e.tipo === tipo ? { ...e, ...campos } : e)) });
  const setEndereco = (tipo: Endereco["tipo"], campo: keyof Endereco, valor: string) => mudarEndereco(tipo, { [campo]: valor });

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso(null);
    try {
      const { logotipo: _logo, ...corpo } = dados;
      setDados(await api<Empresa>("/empresa", { method: "PATCH", body: JSON.stringify(corpo) }));
      setAviso({ texto: "Informações da empresa salvas.", erro: false });
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErros(erro.errors);
        setAviso({ texto: erro.message, erro: true });
      }
    } finally {
      setSalvando(false);
    }
  };

  const enviarLogo = async (file: File | undefined) => {
    if (!file) return;
    const corpo = new FormData();
    corpo.append("arquivo", file);
    try {
      const atual = await api<Empresa>("/empresa/logotipo", { method: "POST", body: corpo });
      setDados({ ...dados, logotipo: atual.logotipo });
      setAviso({ texto: "Logotipo atualizado.", erro: false });
    } catch (erro) {
      if (erro instanceof ApiError) {
        const msg = erro.errors.arquivo;
        setAviso({ texto: Array.isArray(msg) ? msg.join(" ") : (msg ?? erro.message), erro: true });
      }
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  };

  const removerLogo = async () => {
    const atual = await api<Empresa>("/empresa/logotipo", { method: "DELETE" });
    setDados({ ...dados, logotipo: atual.logotipo });
  };

  return (
    <>
      <PageHeader eyebrow="Empresa" title="Informações da empresa" />

      <form onSubmit={salvar} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="mb-6 flex justify-end">
          <SwitchField label="Produtor rural?" checked={dados.produtor_rural} onChange={(v) => podeAlterar && set("produtor_rural", v)} />
        </div>

        <div className="flex flex-col gap-7 lg:flex-row">
          {/* Bloco do CNPJ em destaque, como na MarketUP. */}
          <div className="flex w-full shrink-0 flex-col justify-center bg-success-soft p-4 lg:w-[220px]">
            <MaskedField label="CNPJ" className="text-lg font-bold" {...mascarado("cnpj", "cnpj")} />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
            <TextField label="Nome fantasia" span={2} {...texto("nome_fantasia")} onBlur={() => set("nome_fantasia", normalizarNome(dados.nome_fantasia))} />
            <TextField label="Razão social" span={2} {...texto("razao_social")} onBlur={() => set("razao_social", normalizarNome(dados.razao_social))} />
            <TextField label="E-mail" type="email" className="normal-case" {...texto("email")} />
            <MaskedField label="Telefone" {...mascarado("telefone", "telefone")} />
            <SelectField
              label="Área de atuação"
              value={dados.area_atuacao}
              onChange={(e) => set("area_atuacao", e.target.value)}
              options={AREAS.map((a) => ({ value: a, label: a }))}
              error={erros.area_atuacao}
              disabled={!podeAlterar}
            />
            <TextField label="Inscrição estadual" {...texto("inscricao_estadual")} />
          </div>

          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[200px]">
            <div>
              <span className="mb-1 block font-label text-sm text-ink-muted">Logotipo</span>
              <div className="flex h-28 items-center justify-center rounded-xs border border-line bg-white p-2">
                {dados.logotipo ? (
                  <img src={dados.logotipo} alt="Logotipo da empresa" className="max-h-full max-w-full object-contain" />
                ) : (
                  <IconPhoto size={40} aria-hidden className="text-secondary-light" />
                )}
              </div>
              {podeAlterar && (
                <div className="mt-1 flex gap-1">
                  <input
                    ref={arquivo}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="sr-only"
                    id="logotipo"
                    onChange={(e) => enviarLogo(e.target.files?.[0])}
                  />
                  <label htmlFor="logotipo" className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1 text-xs font-semibold uppercase text-primary hover:bg-primary-light">
                    <IconUpload size={18} aria-hidden /> Enviar
                  </label>
                  {dados.logotipo && (
                    <button type="button" onClick={removerLogo} aria-label="Remover logotipo" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft">
                      <IconTrash size={18} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </div>
            <MaskedField label="WhatsApp" {...mascarado("whatsapp", "telefone")} />
            <TextField label="Inscrição municipal" {...texto("inscricao_municipal")} />
          </div>
        </div>

        <div className="mt-10">
          <FormSection title="Fuso horário">
            <SelectField
              label="Selecione seu fuso horário"
              span={2}
              value={dados.fuso_horario}
              onChange={(e) => set("fuso_horario", e.target.value)}
              options={FUSOS}
              disabled={!podeAlterar}
            />
            <SwitchField label="Ajustar horário de verão automaticamente?" checked={dados.horario_verao} onChange={(v) => podeAlterar && set("horario_verao", v)} />
          </FormSection>
        </div>

        <h2 className="mb-4 mt-10 text-2xl font-normal uppercase text-primary md:text-[30px]">Endereços</h2>
        {dados.enderecos.map((end) => {
          const campo = (nome: keyof Endereco, rotulo: string, extra: object = {}) => (
            <TextField
              label={rotulo}
              value={end[nome]}
              onChange={(e) => setEndereco(end.tipo, nome, e.target.value)}
              disabled={!podeAlterar}
              {...extra}
            />
          );
          const padronizar = (nome: keyof Endereco) => ({ onBlur: () => setEndereco(end.tipo, nome, normalizarNome(end[nome])) });
          return (
            <fieldset key={end.tipo} className="mb-8">
              <legend className="mb-3 text-sm font-bold uppercase text-primary-dark">{TITULO_ENDERECO[end.tipo]}</legend>
              <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                <CepField
                  value={end.cep}
                  onChange={(v) => setEndereco(end.tipo, "cep", v)}
                  onEndereco={(achado) => mudarEndereco(end.tipo, camposDoCep(achado))}
                  disabled={!podeAlterar}
                />
                <EnderecoField
                  span={2}
                  value={end.logradouro}
                  onChange={(v) => setEndereco(end.tipo, "logradouro", v)}
                  {...padronizar("logradouro")}
                  onEndereco={(achado) => mudarEndereco(end.tipo, { cep: limpar("cep", achado.cep), ...camposDoCep(achado) })}
                  uf={end.uf}
                  cidade={end.cidade}
                  disabled={!podeAlterar}
                />
                {campo("numero", "Nº")}
                {campo("complemento", "Complemento", padronizar("complemento"))}
                {campo("bairro", "Bairro", padronizar("bairro"))}
                {campo("cidade", "Cidade", { ...padronizar("cidade"), list: `municipios-${end.uf}` })}
                <SelectField
                  label="UF"
                  value={end.uf}
                  onChange={(e) => setEndereco(end.tipo, "uf", e.target.value)}
                  options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} — ${e.nome}` }))}
                  disabled={!podeAlterar}
                />
              </div>
            </fieldset>
          );
        })}
        {/* Sugestões de cidade (IBGE) para cada UF usada nos endereços. */}
        {Object.entries(municipios).map(([uf, lista]) => (
          <datalist key={uf} id={`municipios-${uf}`}>
            {lista.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
        ))}

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
