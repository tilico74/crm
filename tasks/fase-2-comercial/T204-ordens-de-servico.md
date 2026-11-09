# T204 — Ordens de serviço

| Campo | Valor |
| --- | --- |
| Status | Em andamento (pesquisa feita) |
| Depende de | T203 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario`, `revisar-acessibilidade-mobile` |
| Contexto | `context/marketup/telas-e-entidades.md` (Ordem de serviço), `context/design-system/mobile-tablet.md` |

## Objetivo

OS com técnico, agenda, status, materiais e fotos; pensada para uso no celular em campo.

## Critérios de aceite

- Uso completo no celular com uma mão
- Foto da instalação anexada

## Pesquisa na MarketUP (08/11/2026, só leitura)

- **A RDX tem 0 OS na MarketUP**: não usa o módulo. Não há o que migrar, e a chave `WorkOrderID` não precisa ser casada com dados antigos (a dúvida antiga cai).
- A OS da MarketUP é uma ficha de venda simplificada: vendedor, emissão, cliente, endereço de faturamento, itens, desconto, observação, **garantia** (prazo) e pagamento; rodapé Cancelar · **Concluir serviço** · Salvar · Salvar e voltar. Status 1 Orçamento, 2 Aprovado, 5 Atrasado, 6 Concluído, 7 Cancelado, 8 Nota fiscal; financeiro igual ao do pedido; contas a receber com origem 11 (OS). Detalhes em `context/marketup/telas-e-entidades.md`.
- Ela **não** tem técnico, agenda nem fotos: isso é do objetivo do RDX.

## Plano proposto (para confirmar com o usuário antes de construir)

1. Reaproveitar a base do pedido: `DocumentoVenda`/`ItemVenda`/`ParcelaVenda` e a ficha `DocumentoVendaForm` com um novo tipo `os` (título "O.S.", datas Emissão · Agendada para · Concluída em).
2. Campos a mais: técnico(s) (funcionários), data/hora agendada, endereço do serviço (o de entrega), garantia (dias + texto), fotos (anexos com legenda), assinatura do cliente (opcional).
3. Status: Orçamento → Aprovado → Concluído / Cancelado, "Atrasado" pela data agendada; "Concluir serviço" com as validações e as contas a receber do pedido (origem 11).
4. Tela de campo no celular: lista "Minhas OS de hoje" do técnico, botões grandes (iniciar, fotos, concluir), uma mão.
5. Impressão no padrão (`resources/orcamentos/impressao.tsx`), com garantia e assinaturas.

## Dúvidas para o usuário

- A OS nasce do orçamento/pedido (instalação vendida) ou é avulsa? Um pedido pode gerar a OS de instalação?
- Quem é o técnico: funcionário marcado como técnico? Pode ter mais de um por OS?
- A OS cobra à parte (contas a receber próprias) ou só registra a execução de um pedido já cobrado?
- Garantia padrão das redes de proteção (ex.: 1 ano)?

## Checklist

- [x] Pesquisa na MarketUP
- [ ] Respostas do usuário às dúvidas
- [ ] Modelo e API
- [ ] Telas mobile
- [ ] Upload de fotos
- [ ] Impressão
