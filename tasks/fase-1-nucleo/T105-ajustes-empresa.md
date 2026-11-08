# T105 — Ajustes › Empresa (informações e parâmetros de venda)

| Campo | Valor |
| --- | --- |
| Status | Em andamento |
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

- [ ] Modelos, API e testes
- [ ] Tela Informações da empresa
- [ ] Tela Parâmetros de venda

## Dúvidas

- [ ] Domínio (endereço na MarketUP) e "Acesso com Google" não se aplicam ao RDX; ficam fora.
- [ ] Certificado digital entra com a T401 (notas fiscais).
