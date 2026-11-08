---
nome: validar-migracao
descricao: Confere uma carga de dados da MarketUP no RDX antes de liberar.
entradas: entidade carregada e o arquivo de exportação usado
saidas: relatório de conciliação (OK ou lista de divergências)
---
# Validar migração

Modelo de importador pronto: `backend/apps/migracao/management/commands/importar_clientes.py`. Ele já faz os passos 1, 2, 5 e o log do passo 6, e tem a opção `--simular` (lê e confere sem gravar). Rode sempre `--simular` antes.

## Passo a passo

1. **Contagem:** o número de registros na exportação é igual ao número de registros na tabela.
2. **IDs:** o conjunto de IDs é idêntico, e o maior ID também.
3. **Chaves estrangeiras:** toda referência aponta para um registro existente.
4. **Totais:** compare valores somados, como vendas por mês, comissões por vendedor e saldo em aberto.
5. **Sequência:** o próximo ID automático é `MAX(id) + 1`.
6. **Nomes:** amostre 20 registros e confira a normalização contra o original no log.
7. Registre o resultado na tarefa da carga, com data e números.

## Verificação

Nenhuma divergência sem explicação. Se houver divergência, a carga não é liberada.
