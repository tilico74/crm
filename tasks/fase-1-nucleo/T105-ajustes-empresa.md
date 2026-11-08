# T105 — Ajustes › Empresa (informações e parâmetros de venda)

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T101, T104 |
| Skills | `criar-tela-formulario`, `normalizar-nomes`, `revisar-acessibilidade-mobile` |
| Contexto | `context/marketup/telas-e-entidades.md` (seção Ajustes) |

## Objetivo

Telas Ajustes › Empresa › Informações da empresa e Parâmetros de venda, com os campos da MarketUP.

## Critérios de aceite

- Informações da empresa: CNPJ e situação, nome fantasia, razão social, e-mail, telefone, WhatsApp, área de atuação, inscrições estadual e municipal, logotipo, fuso horário, produtor rural e os 3 endereços (faturamento, entregas, correspondências)
- Parâmetros de venda: prazos de compra e venda, venda recorrente, crédito, desconto, estoque, fiscal, impressão e nome do serviço; sem a parte de PDV (fora do escopo)
- Registro único (uma empresa, um conjunto de parâmetros), lido pelos outros módulos
- Permissões `empresa` e `parametros_venda`

## Checklist

- [x] Modelos, API e testes
- [x] Tela Informações da empresa
- [x] Tela Parâmetros de venda

## Dúvidas

- [ ] Domínio (endereço na MarketUP) e "Acesso com Google" não se aplicam ao RDX; ficam fora.
- [ ] Certificado digital entra com a T401 (notas fiscais).

## Observações

- Back-end: `backend/apps/core/models.py` (`Empresa`, `EnderecoEmpresa` com código IBGE), `backend/apps/core/empresa.py` (`/api/empresa`, `/api/empresa/logotipo`), `backend/apps/vendas/` (`ParametrosVenda`, `/api/parametros-venda`). Registro único (id = 1), criado na primeira leitura; parâmetros começam com os valores da RDX na MarketUP.
- Telas: `frontend/src/resources/empresa/`. Endereços com `CepField` e `EnderecoField` (ADR-006); CNPJ e telefones com `MaskedField` (T108).
- Testes: `backend/tests/test_ajustes_empresa.py`.
