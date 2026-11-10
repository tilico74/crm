"""Carga dos fornecedores da MarketUP (M003 / T301), com o SupplierID como ID.

Fonte: FornecedoresMarketUP.json, lido em 09/11/2026 da ficha de cada fornecedor (personSupplierGet, só leitura),
porque a exportação ListaFornecedores.xls não traz o ID, o tipo nem o "bloqueado", e a lista não traz CNPJ nem endereço.
Chaves curtas: id, t (SupplierTypeID), pf (1 física / 0 jurídica), n (OfficialName), a (Name), cpf, rg, re, ru, sx, nas,
cnpj, ie, im, ind (IcmsContributorTypeID), tel, cel, em, nfe, site, obs, bl, tr, pr e end (cep, l, nu, c, b, ci, uf, ib, at, pd).
Nenhum fornecedor da RDX tem contatos, dados bancários, chaves Pix ou documentos na MarketUP.

Uso: docker compose exec backend python manage.py importar_fornecedores /migracao/dados/FornecedoresMarketUP.json [--simular]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.compras.models import EnderecoFornecedor, Fornecedor, TipoFornecedor
from apps.core.documentos import cnpj_valido, cpf_valido, limpar_cnpj, so_digitos


def t(valor, tamanho=300) -> str:
    return (str(valor).strip() if valor is not None else "")[:tamanho]


class Command(BaseCommand):
    help = "Importa os fornecedores da MarketUP (ID = SupplierID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        tipos = set(TipoFornecedor.objects.values_list("id", flat=True))
        fornecedores, avisos = [], []
        for f in dados:
            juridica = not f.get("pf")
            cnpj = limpar_cnpj(t(f.get("cnpj"))) if juridica else ""
            cpf = "" if juridica else so_digitos(t(f.get("cpf")))
            if cnpj and not cnpj_valido(cnpj):
                avisos.append(f"{f['id']}: CNPJ inválido {cnpj} (gravado vazio)")
                cnpj = ""
            if cpf and not cpf_valido(cpf):
                avisos.append(f"{f['id']}: CPF inválido {cpf} (gravado vazio)")
                cpf = ""
            tipo = f.get("t") or 1
            if tipo not in tipos:
                raise CommandError(f"Fornecedor {f['id']}: tipo {tipo} não cadastrado.")
            fornecedores.append((
                {
                    "id": int(f["id"]), "tipo_id": tipo, "tipo_pessoa": "J" if juridica else "F", "bloqueado": bool(f.get("bl")),
                    "nome": t(f.get("n")), "apelido": t(f.get("a")), "cpf": cpf, "cnpj": cnpj,
                    "rg": "" if juridica else t(f.get("rg"), 20), "rg_emissor": "" if juridica else t(f.get("re"), 100),
                    "rg_uf": "" if juridica else t(f.get("ru"), 2),
                    "sexo": "" if juridica else {1: "M", 2: "F"}.get(f.get("sx"), ""),
                    "aniversario": (f.get("nas") or "")[:10] or None if not juridica else None,
                    "indicador_ie": f.get("ind") if juridica and f.get("ind") in (1, 2, 3) else None,
                    "inscricao_estadual": t(f.get("ie"), 20) if juridica else "", "inscricao_municipal": t(f.get("im"), 20) if juridica else "",
                    "telefone": so_digitos(t(f.get("tel")))[:15], "celular": so_digitos(t(f.get("cel")))[:15],
                    "email": t(f.get("em"), 254).lower(), "email_nfe": t(f.get("nfe"), 254).lower(), "site": t(f.get("site"), 150),
                    "observacao": t(f.get("obs")), "transportadora": bool(f.get("tr")), "produtor_rural": bool(f.get("pr")),
                },
                [
                    {
                        "cep": so_digitos(t(e.get("cep")))[:8], "logradouro": t(e.get("l"), 100), "numero": t(e.get("nu"), 10),
                        "complemento": t(e.get("c"), 50), "bairro": t(e.get("b"), 50), "cidade": t(e.get("ci"), 80), "uf": t(e.get("uf"), 2),
                        "ibge": t(e.get("ib"), 7), "ativo": e.get("at", True), "padrao": bool(e.get("pd")), "exterior": bool(e.get("ex")),
                    }
                    for e in f.get("end") or []
                ],
            ))
        self.stdout.write(f"Lidos {len(fornecedores)} fornecedores, {sum(len(e) for _, e in fornecedores)} endereços.")
        for a in avisos:
            self.stdout.write(self.style.WARNING(a))
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for dados_f, enderecos in fornecedores:
                fornecedor_id = dados_f.pop("id")
                fornecedor, _ = Fornecedor.objects.update_or_create(id=fornecedor_id, defaults=dados_f)
                fornecedor.enderecos.all().delete()
                for i, e in enumerate(enderecos):
                    # Um padrão por fornecedor: o marcado na MarketUP ou o primeiro ativo.
                    if not any(x["padrao"] for x in enderecos) and i == 0:
                        e["padrao"] = True
                    EnderecoFornecedor.objects.create(fornecedor=fornecedor, **e)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [Fornecedor]):
                    cursor.execute(sql)
        total = Fornecedor.objects.count()
        maior = Fornecedor.objects.order_by("-id").values_list("id", flat=True).first()
        self.stdout.write(self.style.SUCCESS(f"Gravados {len(fornecedores)} fornecedores. Total no banco: {total}; maior ID: {maior}."))
