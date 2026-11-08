"""Carga dos clientes a partir da exportação da listagem da MarketUP (M003).

Uso:
    docker compose exec backend python manage.py importar_clientes /migracao/dados/ListaClientes.xlsx [--simular]

- ID = "Código Sistema" (ClientID da MarketUP). Recarregar atualiza os mesmos IDs (o RDX é espelho até a virada).
- CNPJ preenchido = pessoa jurídica; senão, física.
- Nome de pessoa física é padronizado (ADR-007); o original vai para o log em backend/logs/migracao/.
- Razão social, nome fantasia e endereço entram como vieram.
- Documentos e telefones gravados só com dígitos. CPF/CNPJ inválidos ou repetidos entram assim mesmo
  (fidelidade à MarketUP) e saem no relatório para correção.
- O endereço da exportação vira o endereço padrão; o código IBGE é buscado pela cidade/UF.
- No fim: sequência em MAX(id) + 1 e conferência da skill validar-migracao.
"""

import csv
import unicodedata
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction
from django.utils import timezone

from apps.clientes.models import Cliente, EnderecoCliente, ListaPreco
from apps.core.documentos import cnpj_valido, cpf_valido, limpar_cnpj, limpar_rg, so_digitos
from apps.core.normalizacao import normalizar_nome

COLUNAS = [
    "Código Sistema", "Nome/Razão Social", "Apelido/Nome fantasia", "Tipo (Lista de Preços)", "Sexo (M ou F)",
    "CPF", "RG", "Expedição RG", "UF do RG", "Indicador IE Destinatário", "CNPJ", "IE", "Telefone", "Celular",
    "Fax", "Email", "Site", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "Estado", "CEP",
    "Data de nascimento",
]

INDICADORES = {
    "contribuinte do icms": Cliente.IndicadorIE.CONTRIBUINTE,
    "contribuinte isento de inscrição": Cliente.IndicadorIE.ISENTO,
    "não contribuinte": Cliente.IndicadorIE.NAO_CONTRIBUINTE,
}


def texto(valor) -> str:
    return "" if valor is None else str(valor).strip()


def sem_acento(valor: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", valor.lower()) if unicodedata.category(c) != "Mn")


def data_br(valor) -> date | None:
    if isinstance(valor, datetime):
        return valor.date()
    try:
        return datetime.strptime(texto(valor), "%d/%m/%Y").date()
    except ValueError:
        return None


class Command(BaseCommand):
    help = "Importa os clientes da exportação ListaClientes.xlsx da MarketUP (ID = Código Sistema)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true", help="Lê e confere, sem gravar nada.")
        parser.add_argument("--sem-ibge", action="store_true", help="Não busca o código IBGE das cidades (sem internet).")

    def handle(self, arquivo, simular, sem_ibge, **opcoes):
        caminho = Path(arquivo)
        if not caminho.exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        planilha = openpyxl.load_workbook(caminho, read_only=True, data_only=True).active
        linhas = list(planilha.iter_rows(values_only=True))
        cabecalho = [texto(c) for c in linhas[0]]
        faltando = [c for c in COLUNAS if c not in cabecalho]
        if faltando:
            raise CommandError(f"A planilha não tem as colunas: {', '.join(faltando)}. É a exportação da listagem de Clientes?")
        idx = {c: cabecalho.index(c) for c in COLUNAS}

        listas = {sem_acento(l.nome): l.id for l in ListaPreco.objects.all()}
        problemas: list[tuple[int, str, str]] = []  # (id, campo, motivo) — sem dados pessoais no terminal
        log_nomes: list[tuple[int, str, str, str]] = []
        registros = []
        ibge = IbgePorCidade(desligado=sem_ibge)

        for numero, linha in enumerate(linhas[1:], start=2):
            v = lambda col: linha[idx[col]]  # noqa: E731
            if v("Código Sistema") in (None, ""):
                continue
            try:
                cliente_id = int(v("Código Sistema"))
            except (TypeError, ValueError):
                raise CommandError(f"Linha {numero}: Código Sistema não é número.")

            cnpj = limpar_cnpj(texto(v("CNPJ")))
            cpf = so_digitos(texto(v("CPF")))
            juridica = bool(cnpj)
            nome_original, apelido_original = texto(v("Nome/Razão Social")), texto(v("Apelido/Nome fantasia"))
            nome, apelido = nome_original, apelido_original
            if not juridica:
                nome = normalizar_nome(nome_original) or ""
                apelido = normalizar_nome(apelido_original) or ""
                for campo, antes, depois in (("nome", nome_original, nome), ("apelido", apelido_original, apelido)):
                    if antes != depois:
                        log_nomes.append((cliente_id, campo, antes, depois))
            if not nome:
                problemas.append((cliente_id, "nome", "sem nome"))

            if cpf and not cpf_valido(cpf):
                problemas.append((cliente_id, "cpf", "CPF inválido"))
            if cnpj and not cnpj_valido(cnpj):
                problemas.append((cliente_id, "cnpj", "CNPJ inválido"))

            lista_nome = sem_acento(texto(v("Tipo (Lista de Preços)")) or "padrão")
            lista_id = listas.get(lista_nome)
            if not lista_id:
                problemas.append((cliente_id, "lista_preco", f"lista '{v('Tipo (Lista de Preços)')}' não existe; usada a Padrão"))
                lista_id = 1

            indicador_texto = sem_acento(texto(v("Indicador IE Destinatário")))
            indicador = next((valor for chave, valor in INDICADORES.items() if sem_acento(chave) == indicador_texto), Cliente.IndicadorIE.NAO_CONTRIBUINTE)

            telefone, celular = so_digitos(texto(v("Telefone"))), so_digitos(texto(v("Celular")))
            for campo, fone in (("telefone", telefone), ("celular", celular)):
                if fone and len(fone) not in (10, 11):
                    problemas.append((cliente_id, campo, f"telefone com {len(fone)} dígitos"))

            sexo = texto(v("Sexo (M ou F)")).upper()
            cliente = Cliente(
                id=cliente_id,
                tipo_pessoa=Cliente.TipoPessoa.JURIDICA if juridica else Cliente.TipoPessoa.FISICA,
                lista_preco_id=lista_id,
                nome=nome[:300],
                apelido=apelido[:300],
                cpf="" if juridica else cpf,
                rg="" if juridica else limpar_rg(texto(v("RG")))[:20],
                rg_emissor="" if juridica else texto(v("Expedição RG"))[:100],
                rg_uf="" if juridica else texto(v("UF do RG")).upper()[:2],
                sexo=sexo if sexo in ("M", "F") and not juridica else "",
                aniversario=None if juridica else data_br(v("Data de nascimento")),
                cnpj=cnpj,
                indicador_ie=indicador,
                inscricao_estadual=texto(v("IE"))[:20],
                telefone=telefone[:15],
                celular=celular[:15],
                email=texto(v("Email")).lower()[:254],
                site=texto(v("Site"))[:64],
            )
            endereco = None
            if any(texto(v(c)) for c in ("Endereço", "CEP", "Cidade")):
                cidade, uf = texto(v("Cidade")), texto(v("Estado")).upper()[:2]
                endereco = EnderecoCliente(
                    cep=so_digitos(texto(v("CEP")))[:8],
                    logradouro=texto(v("Endereço"))[:100],
                    numero=texto(v("Número"))[:10],
                    complemento=texto(v("Complemento"))[:50],
                    bairro=texto(v("Bairro"))[:50],
                    cidade=cidade[:80],
                    uf=uf,
                    ibge=ibge.codigo(uf, cidade),
                    ativo=True,
                    padrao=True,
                )
            registros.append((cliente, endereco))

        # Documentos repetidos (a API não deixa repetir; na carga só avisa).
        for campo in ("cpf", "cnpj"):
            contagem = Counter(getattr(c, campo) for c, _ in registros if getattr(c, campo))
            for c, _ in registros:
                if contagem.get(getattr(c, campo), 0) > 1:
                    problemas.append((c.id, campo, f"{campo.upper()} repetido em {contagem[getattr(c, campo)]} clientes"))

        ids = [c.id for c, _ in registros]
        if len(ids) != len(set(ids)):
            raise CommandError("Há Código Sistema repetido na planilha. Exporte de novo da MarketUP.")

        self.stdout.write(f"Lidos {len(registros)} clientes ({sum(c.tipo_pessoa == 'J' for c, _ in registros)} PJ), "
                          f"{sum(1 for _, e in registros if e)} com endereço, {len(log_nomes)} nomes padronizados.")
        self.stdout.write(f"Endereços sem código IBGE: {sum(1 for _, e in registros if e and not e.ibge)}.")
        self._resumo_problemas(problemas)

        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return

        with transaction.atomic():
            existentes = set(Cliente.objects.filter(id__in=ids).values_list("id", flat=True))
            novos = [c for c, _ in registros if c.id not in existentes]
            atualizar = [c for c, _ in registros if c.id in existentes]
            Cliente.objects.bulk_create(novos, batch_size=500)
            campos = [f.name for f in Cliente._meta.concrete_fields if f.name not in ("id", "criado_em", "criado_por", "limite_credito", "observacao", "email_nfe", "iss_retido", "consumidor_final", "produtor_rural", "bloqueado", "inscricao_municipal")]
            if atualizar:
                agora = timezone.now()  # bulk_update não aplica o auto_now
                for cliente in atualizar:
                    cliente.atualizado_em = agora
                Cliente.objects.bulk_update(atualizar, campos, batch_size=500)
            # Endereço da exportação = endereço padrão do cliente (substitui o padrão anterior da carga).
            EnderecoCliente.objects.filter(cliente_id__in=ids, padrao=True).delete()
            enderecos = []
            for cliente, endereco in registros:
                if endereco:
                    endereco.cliente_id = cliente.id
                    enderecos.append(endereco)
            EnderecoCliente.objects.bulk_create(enderecos, batch_size=500)
            # A exportação não traz o limite de crédito: vale o "Limite para novos clientes" de
            # Ajustes › Parâmetros de venda (decisão do usuário em 08/11/2026). Só preenche quem está sem limite.
            from apps.vendas.models import ParametrosVenda

            padrao = ParametrosVenda.atual().limite_credito_novos
            com_padrao = Cliente.objects.filter(id__in=ids, limite_credito=0).update(limite_credito=padrao)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [Cliente, EnderecoCliente]):
                    cursor.execute(sql)

        log = self._gravar_log(log_nomes, problemas)
        self.stdout.write(self.style.SUCCESS(f"Gravados: {len(novos)} novos, {len(atualizar)} atualizados; {com_padrao} com o limite padrão de R$ {padrao}. Log: {log}"))
        self._conferir(ids)

    def _resumo_problemas(self, problemas):
        if not problemas:
            self.stdout.write("Nenhum problema nos dados.")
            return
        por_motivo = Counter(motivo if "lista" not in motivo else "lista inexistente" for _, _, motivo in problemas)
        self.stdout.write(self.style.WARNING("Avisos (detalhes no log, por ID):"))
        for motivo, qtd in por_motivo.most_common():
            self.stdout.write(f"  {qtd:5d}  {motivo}")

    def _gravar_log(self, log_nomes, problemas) -> str:
        pasta = Path(settings.BASE_DIR) / "logs" / "migracao"
        pasta.mkdir(parents=True, exist_ok=True)
        carimbo = datetime.now().strftime("%Y%m%d-%H%M%S")
        caminho = pasta / f"clientes-{carimbo}.csv"
        with caminho.open("w", newline="", encoding="utf-8-sig") as arquivo:
            saida = csv.writer(arquivo, delimiter=";")
            saida.writerow(["tipo", "cliente_id", "campo", "original / motivo", "gravado"])
            for cliente_id, campo, antes, depois in log_nomes:
                saida.writerow(["nome padronizado", cliente_id, campo, antes, depois])
            for cliente_id, campo, motivo in problemas:
                saida.writerow(["aviso", cliente_id, campo, motivo, ""])
        return str(caminho.relative_to(settings.BASE_DIR))

    def _conferir(self, ids):
        """Skill validar-migracao: contagem, IDs, maior ID e sequência."""
        no_banco = set(Cliente.objects.filter(id__in=ids).values_list("id", flat=True))
        with connection.cursor() as cursor:
            cursor.execute("SELECT last_value FROM cliente_id_seq")
            sequencia = cursor.fetchone()[0]
        # A sequência pode passar do maior ID da planilha se houver clientes criados no RDX (testes).
        ok = no_banco == set(ids) and sequencia >= max(ids)
        self.stdout.write(
            f"Conferência: planilha {len(ids)} · banco {len(no_banco)} · maior ID {max(ids)} · "
            f"próximo ID automático {sequencia + 1} → {'OK' if ok else 'DIVERGÊNCIA'}"
        )
        if not ok:
            raise CommandError("A conferência encontrou divergência. Veja os números acima.")


class IbgePorCidade:
    """Código IBGE pelo nome da cidade (lista oficial do IBGE, com cache no Redis)."""

    def __init__(self, desligado=False):
        self.desligado = desligado
        self.por_uf: dict[str, dict[str, str]] = {}

    def codigo(self, uf: str, cidade: str) -> str:
        if self.desligado or not uf or not cidade:
            return ""
        if uf not in self.por_uf:
            from apps.core.localidades import listar_municipios

            try:
                self.por_uf[uf] = {sem_acento(m["nome"]): str(m["id"]) for m in listar_municipios(uf)}
            except Exception:  # serviço fora do ar: segue sem o código
                self.por_uf[uf] = {}
        return self.por_uf[uf].get(sem_acento(cidade), "")
