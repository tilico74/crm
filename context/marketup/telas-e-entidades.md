# MarketUP: telas e entidades (somente referência)

Levantado em 07/11/2026, só por leitura das telas da conta RDX. Nenhum dado foi alterado. Os campos exatos de cada entidade vêm das **exportações oficiais** (tarefa M001); esta página registra telas, seções e valores de listas que a exportação não mostra.

## Menu e rotas

| Grupo | Tela | Rota | Na v1? |
| --- | --- | --- | --- |
| Catálogo | Produtos · Serviços · Combos · Categorias · Marcas · Unidades de medida · Impressão de etiquetas | `item`, `service`, `combo`, `category`, `brand`, `item_unit`, `print_label` | Sim, exceto combos e etiquetas (a confirmar) |
| Vendas | Orçamentos · Pedidos · Clientes · CRM · Comissões · Lista de preços · Ordens de serviço | `sale_budget`, `sale_order`, `client`, `sale_crm`, `seller_commission`, `client_type`, `work_order` | Sim |
| Vendas | Cupons · Consignados · Devoluções | `coupon`, `sale_order`, `sale_return` | A confirmar |
| — | Agenda | `agenda` (aberta pelo CRM) | Sim, faz parte do CRM |
| Estoque | Consulta · Movimentações · Locais · Tipos de estocagem · Inventário · Mapa · Motivo de movimentação · Produção | `stock_query`, `new_stock_movement`, `stock_location`, `storage_type`, `stock_movement_reason`, `item_production` | Sim, exceto produção (a confirmar) |
| Notas Fiscais | Emitir · Recebidas · Emitidas | `invoice/new`, `invoice_manifest`, `invoice` | Sim |
| Financeiro | Fluxo de caixa · Movimentação de caixa · Contas a pagar · Contas a receber | `cash_flow`, `cash_movement`, `payable`, `receivable` | Sim |
| Financeiro | Conciliação bancária · Saldo e extrato integrados | `reconciliation`, `bank_statement` | Não (fora da v1) |

## CRM (`sale_crm`)

**Não é um funil kanban.** É uma lista de clientes com a situação financeira e a última ação de cada um.

| Coluna | Conteúdo |
| --- | --- |
| Cliente | Nome, CPF/CNPJ, celular, e-mail, "Última ação: <tipo> em DD/MM/AAAA" |
| Vencimentos | Vencidos · A vencer · Total (títulos a receber) |
| Pagamentos | Pago · A pagar · Total |
| Créditos | Utilizado · Disponível · Total (limite de crédito do cliente) |
| Ações | Ver cliente · Agenda · E-mail |

Filtros: Valor vencido, Valor a vencer, Total de vencimentos, Valor pago, Valor a pagar, Total de pagamentos, Limite de crédito, Crédito utilizado, Crédito disponível, Data da última ação, Tipo da última ação.

Na conta RDX, todas as últimas ações carregadas são do tipo "Pedido": a última ação parece vir das vendas, não de registros manuais (a confirmar).

**Agenda (`agenda`):** visões Dia, Semana e Mês, com filtro "Exibir agenda de" (Todos ou uma pessoa).

## Cliente (`client/detail/{ClientID}`)

Seções do formulário, nesta ordem:

| Seção | Campos |
| --- | --- |
| Ficha cadastral | Pessoa física ou jurídica · Tipo (lista de preços) · Bloqueado · Nome · Apelido · CPF · RG · Emissor · UF · Sexo (Masculino/Feminino) · Aniversário · Razão social · Nome fantasia · CNPJ · Indicador da IE do destinatário (Contribuinte do ICMS / Contribuinte isento de inscrição / Não contribuinte) · Inscrição estadual · Inscrição municipal · Telefone · Celular · Email · Site · Observação · Limite de crédito |
| Dados fiscais | Email do destinatário da NF-e · ISS retido na fonte? · Consumidor final? · Produtor rural? |
| Características | Título das abas abaixo (não é um campo) |
| Endereços | CEP · Endereço (ou no exterior) · Nº · Complemento · Bairro · Ativo · Padrão (vários por cliente) |
| Contatos | Nome · Cargo · Telefone · Email (vários) |
| Dados bancários | Banco (lista oficial de bancos, 282) · Agência · Dígito · Conta · Dígito |
| Documentos | Tipo (com "+") · Documento · anexo (ícone de envio) |
| Crédito | Parcelas vencidas / a vencer / pagas · Total vencidas · Total a vencer · Total pagas · Limite de crédito · Limite utilizado · Limite disponível |
| Histórico | Data · Descrição · Status (Pendente / Concluído). Orçamentos e pedidos entram sozinhos ("ORÇAMENTO Nº000826 · NOVO", "PEDIDO Nº… · CONCLUÍDO"), com a lupa abrindo o documento. Origens: orçamento −8, pedido 8, PDV 7, loja virtual 10; **OS não aparece**. No RDX, a OS também fica fora (decisão de 08/11/2026). Plano: tarefa T206 |

Botão no rodapé: "Adicionar pedido de venda".

### Detalhes conferidos em 08/11/2026 (modelo Angular, `controller.currentClient.*`)

| Campo na tela | Campo MarketUP | Tamanho | Campo RDX |
| --- | --- | --- | --- |
| Pessoa física ou jurídica | PersonEntityType | — | `tipo_pessoa` |
| Tipo (Lista de Preços) | ClientType (1 = Padrão) | — | `lista_preco` |
| Bloqueado | Blocked | — | `bloqueado` |
| Nome / Razão Social | **OfficialName** (o mesmo campo) | 300 | `nome` |
| Apelido / Nome Fantasia | **Name** (o mesmo campo) | 300 | `apelido` |
| CPF · RG · Emissor · UF | Cpf · DocumentNumber · DocumentIssuer · DocumentState | 14 · 20 · 100 · 2 | `cpf`, `rg`, `rg_emissor`, `rg_uf` |
| Sexo · Aniversário | PersonGender · Birthday | — | `sexo`, `aniversario` |
| CNPJ · Indicador IE · IE · IM | Cnpj · IcmsContributorTypeID (1, 2, 3) · Ie · Im | 18 · — · 20 · 20 | `cnpj`, `indicador_ie`, `inscricao_estadual`, `inscricao_municipal` |
| Telefone · Celular · Email · Site | Phone · Mobile · Email · Site | 15 · 15 · 254 · 64 | iguais |
| Observação · Limite de Crédito | Observation · CreditLimit | 300 · — | `observacao`, `limite_credito` |
| Dados fiscais | FiscalRecipientEmail · WithholdingIss · FinalConsumer · RuralProducer | 254 | `email_nfe`, `iss_retido`, `consumidor_final`, `produtor_rural` |

- Pessoa física esconde Razão social, Nome fantasia, CNPJ, Indicador da IE, IE e IM; jurídica esconde CPF, RG, Emissor, UF, Sexo e Aniversário.
- Endereço: Zipcode (9) · InExterior · Address (100) · Number (10) · Complement (50) · District (50) · IsActive · IsDefault.
- Contato: Name (300) · Role (150) · Phone (15) · Email (254). Banco: BankID · AgencyNumber · AgencyDigit · AccountNumber · AccountDigit (20 cada).
- Tipos de documento (DocumentTypeID): 6 Inscrição Estadual · 11 Inscrição Municipal · 12 Inscrição Estadual ST · 13 CNAE · 14 Suframa.
- Histórico: Date · Observation (300) · HistoryStatus (1 Pendente, 2 Concluído).
- Listagem: colunas Nome · Tipo · Telefone · Celular · Email; filtros Bloqueado · CPF · CNPJ · Tipo · Telefone · E-mail.
- **Exportação da listagem** (`ListaClientes.xlsx`, 26 colunas): a coluna "Código Sistema" é o ClientID (conferido: cliente 109). Dá para migrar clientes mantendo o ID sem esperar a M002.

## Lista de preços / Tipos de clientes (`client_type`)

Descrição (Name, 300) · Desc. Varejo (Discount) e Desc. Atacado (WholesaleDiscount), cada um com botões **R$ / %** · "Itens com desconto diferenciado": Item (busca produto/serviço) · Desconto varejo · Desconto atacado (R$ / %). Só existe a lista "Padrão" (ID 1).

## Orçamento (`sale_budget`)

- Listagem: número (= `SaleBudgetID`) com a situação embaixo, validade, entrega, data do pedido, cliente, data de emissão e valor.
- Situações (`Status`): **1 Novo, 3 Pedido, 4 Cancelado, 6 Concluído** (o orçamento que virou pedido fica Concluído, com `SaleOrderID` e "Ir para o pedido gerado").
- Filtros: Status, Cliente, Data de emissão, Data de pedido, Data de validade, Produtos, Valor.

### Ficha (`sale_budget/detail/{SaleBudgetID}`, conferida em 08/11/2026)

| Seção | Campos |
| --- | --- |
| Orçamento | Quadro do status · # número · Comentários (ícone de balão → `Observation`) · Vendedor (`SellerID`) · Emissão · Validade · Entrega |
| Cliente | Nome grande com "Crédito disponível" e lupa · CPF ou CNPJ · RG ou IE · E-mail · Telefone · Endereço para faturamento e Endereço de entrega (cartões dos endereços do cliente, com "+" para novo; `BillingAddressID`, `DeliveryAddressID`) |
| Itens | Faixa azul "Digite o nome ou código do item · Qntd. (+/−) · Unitário · Total · Incluir no pedido" · tabela: código e descrição, balão de observação (medidas, ex.: "2,30 x 1,30"), quantidade + unidade, unitário, total, % (desconto do item), lixeira · "Imprimir etiquetas" · Subtotal · Desconto (R$ / %) · Frete · Outros custos · Total |
| Pagamento | Forma de pagamento · Parcelamento · Valor · "Gerar contas" → parcelas (Vencimento, Observações, Valor) |

Rodapé: Cancelar · Gerar pedido · Salvar · Salvar e voltar. Topo: listar, imprimir, e-mail, copiar, Adicionar novo.

Modelo: `SaleBudget` (Subtotal, Discount, GeneralDiscount, GeneralDiscountPercentage, Shipping, GeneralTaxes = outros custos, Total, IssueDate, ExpirationDate, DeliveryDate, OrderingDate, CancelDate, NoClient) · `SaleBudgetItem` (ItemID, ItemUnitID, Amount, Value, Discount, DiscountPercentage, Subtotal, Total, InFragmentation, Observation, Order) · `SaleBudgetInstallment` (Date, Value, InstallmentNumber, InstallmentCount, Description, PaymentTypeID, PaymentConditionID).

Exportação da listagem (`ListaOrcamentoVenda.xls`): só Número, Status (Aberto/Pedido/Cancelado/Concluído), Cliente (nome), Data emissão, Data de validade, Valor total. Sem itens, sem ID do cliente.

## Pedido (`sale_order`) — conferido em 08/11/2026, só leitura do código da tela

### Listagem

- Colunas: **Pedido** (número + rótulo: Novo, Faturado, Concluído, Cancelado, com a faixa colorida) · **Status** (emitido em, faturado em) · **Cliente** · **Entrega** (data + "status entrega") · **Valor** (+ "status pgto").
- Rótulo da linha (`getListStatusClass`): Faturado/Finalizado vira **Concluído** quando não há itens a entregar (`ItemsToDelivery`) e o saldo a receber (`OrderBalance`) é zero; senão fica **Faturado**. Cancelado = 7; o resto = Novo.
- Filtros: Status (Novo 1, Faturado/Concluído 2, Cancelado 7, Consignado 11), Cliente, Data de emissão, Data de faturamento, Nº da NF, Produtos, Valor, Tipo (Vendas/Consignadas), Entrega, Financeiro, Recorrentes.
- Exemplos reais: 2990 Concluído (Entregue/Pago), 2987 Faturado (Entregue/**Atrasado**), 2978 Faturado (Entregue/Pago parcialmente).

### Enums (`appErp.Types.Sale`)

| Enum | Valores |
| --- | --- |
| `SaleOrderStatusEnum` | 1 Novo, 2 Faturado, 3 Entrega parcial, 4 Não conformidade, 5 Atrasado, 6 Finalizado, 7 Cancelado, 8 NF-e solicitada, 9 Aguardando pagamento, 10 Pago, 11 Consignado, 12 Enviado |
| `SaleOrderStatusDeliveryEnum` | 1 Pendente, 2 Entregue, 3 Entrega parcial, 4 Atrasado, 5 Devolução parcial, 6 Devolvido, 7 Cancelado |
| `SaleOrderStatusFinancialEnum` | 1 Pendente, 2 Pago, 3 Pago parcial, 4 Atrasado, 6 Devolvido, 7 Cancelado |
| `SaleOrderOriginEnum` | 0 Pedido, 1 E-commerce, 2 Marketplace, 3 Ordem de serviço |
| `FinancialOriginsEnum` | 7 Vendas, 11 OS… |
| Permissões | Bill, Delivery, Cancel, Return, Email, Copy |

### Ficha (`sale_order/detail/{SaleOrderID}`)

- Mesmas seções do orçamento. Topo: quadro do status com "Entrega: X / Pagamento: Y" embaixo · # número · comentários · vendedor · emissão · entrega (com "usar hora"; sem validade). Pedido novo: entrega = hoje + "Entrega para pedido" dos Parâmetros de venda (10 dias).
- **Vendedor:** caixa com lista que filtra enquanto digita (até 8 nomes) sobre `controller.sellerList` (funcionários: EmployeeID, UserID, OfficialName…; na RDX, 2 Esther, 25 Cristian, 1142 Nelson). Abre com o funcionário cujo `UserID` é o do usuário logado; `setSeller` grava `SellerID` = EmployeeID; trava depois de faturado. O ícone de pessoa ao lado abre "novo vendedor" (grava na hora: não clicar).
- Botões do topo: **CONCLUIR** (Novo) ou **ENTREGAR / DEVOLVER** (faturado). Link "Ir para o orçamento de origem".
- Rodapé do Novo: Cancelar · Consignar · **Concluir venda** · Salvar · Salvar e voltar. Do faturado: Cancelar · Devolver · Entregar.
- Modelo `SaleOrder`: ClientID, Billing/DeliveryAddressID, SellerID, IssueDate, DeliveryDate, BillingDate, CancelDate, Subtotal, Shipping, Discount, GeneralTaxes, Total, Status, Origin, DeliveryStatus, FinancialStatus, Observation, SaleBudgetID, Items (com Delivered, Returned), Installments (Value, **Balance**, Interest, Discount, InstallmentNumber/Count, Date, Description, **EventID** = conta a receber, LastPaymentDate, PaymentTypeID, PaymentConditionID, PaymentGuid).

### Concluir venda (`billCurrentOrder`)

Na ordem: nome do cliente · endereço de faturamento · endereço de entrega (salvo retirada) · itens · parcelas cobrindo o total exato ("Forma/Condição de pagamento inválida") · endereço até 150 caracteres · boleto exige CPF/CNPJ e e-mail · "Verifique o valor das parcelas, total inválido" · "Existem parcelas vencidas" (vencimento antes da emissão) · **limite de crédito**: soma das parcelas a prazo (vencimento depois da emissão) ≤ crédito disponível do cliente, senão "O limite de crédito disponível para este cliente (…) está abaixo do valor (a prazo) a ser faturado (…)". Depois o servidor fatura (`SaleOrderBill`, bloqueia estoque negativo se configurado) e mostra "Pedido Nº X concluído com sucesso!".

### Pagamento depois de concluir

- Colunas Parcela · Vencimento (observações) · Valor · Saldo; "Valor pendente de pagamento (R$)".
- Por parcela: **RECIBO** (`showDocket`), **RECEBER** (`goToEvent` → `receivable/detail/{EventID}`, desabilitado com saldo 0) e lupa.
- Recibo "EMITIR RECIBO": enviar para (e-mail do cliente, CC, extra) · Recebi(emos) de · Data (`LastPaymentDate`) · Subtotal (Value), Juros, Desconto, **Valor total = Value − Balance + Interest − Discount** · importância por extenso · "Referente a: PEDIDO 2990 - PARCELA 1 / 1" · assinatura (usuário). Botões Cancelar / Enviar / Imprimir.

### Conta a receber (`receivable/detail/{EventID}`, ex.: 12163 do pedido 2990)

- `Event`: OriginID 7 (Vendas), OriginKey = SaleOrderID, OriginInstallment = parcela, ManagementAccountID 52 "Vendas via Pedido", Description "Pedido de Venda Nº 2990", sacado "CLIENTE: nome", emissão, vencimento, Value, Balance, faixa de status ("RECEBIDA").
- "Efetuar recebimento": data, conta corrente, juros (+), descontos (−), valor recebido (=), efetuado em (forma), "Incluir recebimento". Histórico: data, recebido, desconto, juros, forma, conta, ícone do recibo e **X vermelho (estorno)**.
- **Conta corrente obrigatória:** o select "Conta corrente" (`controller.accounts`, só ativas) vem com a conta `IsDefault` (Principal); `addEntry` grava `Entry.AccountID` da conta escolhida. Na RDX nenhuma conta é Principal, então a pessoa escolhe (o recebimento do pedido 2990 entrou no Nubank CNPJ). Contas da RDX: 1 Caixa, 2 PDV 1 (internas), 3 Banco do Brasil (inativa), 4 Nubank CNPJ, 5 Nubank Esther, 6 Mercado Pago.
- `EntryEvent` (Amortized, Value, Discount, Interest) e `Entry` no caixa (Date, Value, AccountID, PaymentTypeID, IsCredit).

### Entregar e devolver

- **Entregar** (`showDelivery` → `SaleOrderDeliveryController`): modal "ENTREGAR PEDIDO" — local de estoque, data de entrega, dados fiscais (NF-e, série, data), observações e, por item: pedido / estoque / entregue / quantidade a entregar, posição, lote, validade. Mensagem "Pedido Nº X entregue com sucesso!".
- **Devolver** (`showReturnModal` → modal "DEVOLUÇÃO / TROCA"): local de estoque; por item entregue: trocar / devolver; "Produtos devolvidos" (quantidade, data, valor); Saldo pedido · Valor recebido · **Valor estorno · Data estorno · Estornar em** (forma). `doReturn` grava e mostra "Devolução/troca realizada com sucesso!"; o estorno é marcado pago se a data for hoje.

### Cancelar (`checkOrderCancellation` → `cancelOrder` → `doCancel`)

- Bloqueia se houver nota fiscal não cancelada. Confirma "Deseja mesmo cancelar este pedido? Esta operação não poderá ser desfeita!".
- `cancelValue` = soma de (Value − Balance) das parcelas = já recebido; `cancelItemsCount` = itens de estoque entregues. Ambos zero → cancela direto. Senão, modal com valor do estorno, data (pago se hoje), local de estoque para o retorno e forma do estorno.
- Resultado (pedido 2881): Status 7, entrega 7, financeiro 7 e **as parcelas saem do pedido** (contas a receber retiradas).

### Orçamento → pedido (`orderCurrentBudget`)

- Salva o orçamento, confirma "Deseja realmente gerar pedido para o orçamento X? Você será redirecionado para o novo pedido." e abre `sale_order/new` com a cópia (Status Novo, `SaleBudgetID`), ainda sem gravar.
- Com o pedido gravado, o orçamento fica **Concluído (6)** com `SaleOrderID` e `OrderingDate` (3736 → 2881, 3868 → 2986, 3869 → 2990). **Continua Concluído mesmo com o pedido cancelado** (3736/2881).

## Exportação

As listagens de Clientes e Orçamentos têm botões de **exportar** (nuvem) e **imprimir**. São a fonte da migração (tarefa M002).

## Catálogo

### Produto (`item/detail/{ItemID}`)

- **190 produtos** cadastrados.
- Listagem: descrição, preço de venda, categoria, subcategoria, ativo. A descrição é gravada em letras mistas ("Batente alumínio Prime Kids"); a tela só **exibe** em maiúsculas.

| Seção | Campos |
| --- | --- |
| Cabeçalho | Ativo/Inativo · Produto próprio · Descrição · Tipo de item (Produto / Kit / Insumo / Brinde) · Unidade · Categoria · Subcategoria · Código de balança · Marca · Modelo · Tags · Código interno |
| Preços | Custo (última compra) · Venda varejo · Venda atacado · Margem de lucro aproximada (varejo e atacado) · Qtde mínima p/ atacado |
| Características | — |
| Estoque | Movimentar estoque · Movimentar estoque da composição · **Tipo de estoque: Único ou Grade** |
| Fiscal | Tipo (Mercadoria para revenda, Matéria-prima, Embalagem, Ativo imobilizado, Material de uso e consumo…) · NCM · Origem · CEST |
| Composição | Item · Quantidade · Unidade · Custo unitário · Custo total |
| Fragmentação | Quantidade · Unidade · Valor de venda |
| Loja virtual | Fora da v1 |

Filtros da listagem: Código de barras, Código de balança, Categoria, Subcategoria, Tipo de item, Status, Possui grade, Possui composição, Possui código de balança, Movimenta estoque, **Status NCM**, **Status CEST**, Valor de custo, Valor de venda, Venda atacado, Valor de atacado, Tag.

**O CFOP não fica no produto** (a tarefa T103 diz "NCM, CFOP no produto"): na MarketUP o produto tem NCM, Origem e CEST.

### Listas do catálogo

| Lista | Valores na conta RDX |
| --- | --- |
| Categorias | Cerca de Piscina · Corda · Gancho · Rede |
| Subcategorias | Batente · Cerca de Piscina · Chumbador · Haste · Mosquetão · Pitão · Ponteira · Portão automático · Suporte · Tela (todas "para cerca de piscina") |
| Marcas | Alutim · BKT · Equiplex · Guardtec · HT · Metalúrgica Verdadeiro · Protectpool · Sportnet · SportNet · Trifixi |
| Unidades | Barra · Caixa · Cento · Fardo · Hora/Funcionário · Metro · Milheiro · M² · Quilograma · Unidade |

### Serviço (`service`)

Só **3 serviços**, com código de 13 dígitos começando em `2000000000…` (padrão EAN interno da MarketUP):

| Código | Descrição | Unidade | Preço |
| --- | --- | --- | --- |
| 2000000000026 | Mão de obra de instalação de redes de proteção (saída mínima) | Unidade | R$ 100,00 |
| 2000000000035 | Reinstalação de rede do cliente (mão de obra) | Unidade | R$ 25,00 |
| 2000000000064 | Travar basculante com parafusos | Unidade | R$ 10,00 |

### Pontos de atenção do catálogo

1. **Variações como produtos separados.** Cada cor/acabamento é um produto (ex.: Batente Prime Kids Anodizado, Branca, Natural, Preta). A MarketUP tem "Grade", mas a RDX não usa. Migrar 1 para 1 mantém os IDs; agrupar em grade quebraria a regra de IDs.
2. **Dados inconsistentes.** "Natura" e "Natural" na mesma linha de produtos; mesma linha com subcategorias diferentes (Batente × Cerca de Piscina); marca duplicada "Sportnet" / "SportNet"; subcategoria com o nome da categoria.
3. **Produtos sem NCM.** O produto conferido (ID 88) está sem NCM e sem CEST. Sem NCM não se emite NF-e de produto. Falta contar quantos estão assim (filtro "Status NCM").
4. **Produtos sem categoria.** Itens como broca e bucha aparecem sem categoria e subcategoria.
5. **Serviço de instalação é cobrado por unidade.** Rede de proteção costuma ser vendida por m²; conferir nos orçamentos como a metragem entra (produto "Rede" em M² + mão de obra?).

## Ajustes

| Grupo | Telas | No RDX? |
| --- | --- | --- |
| Empresa | Informações da empresa · Funcionários · Usuários · Parâmetros de venda · Permissões | **Sim** |
| Financeiro | Conta gerencial · Conta corrente · Tipos de pagamento | **Sim** |
| Conectores | Loja Integrada · Carteira Digital · Marketplace+ · Migrar Dados | Não |
| Loja virtual | Informações · Aparência · Pagamentos · Entrega · Domínio · Publicação · Campanhas · Menu · Destaques · Banners | **Não: fora do escopo** |
| PDV | (link para a página de venda do PDV+) | **Não: fora do escopo** |
| Restaurantes | Dados gerais · Cardápio | **Não: fora do escopo** |

> Decisão do responsável (07/11/2026): Restaurantes, PDV e Loja virtual não se aplicam à RDX. Nada deles entra no RDX, nem na migração.

### Informações da empresa (`configuration/company/information`)

CNPJ · Situação · Nome fantasia · Razão social · E-mail · Telefone · Área de atuação · Inscrição estadual · Inscrição municipal · WhatsApp · Logotipo · Domínio · Fuso horário · Produtor rural? · Endereços (Faturamento, Entregas, Correspondências) · Certificado digital.

Atenção: a tela tem os botões **"Solicitar limpeza" (banco de dados) e "Excluir conta"**. Nunca usar antes da virada concluída.

### Funcionário (`employee/detail/{EmployeeID}`)

**12 funcionários**, um deles técnico (usuário de integração). O usuário do sistema fica **dentro** do funcionário:

| Seção | Campos |
| --- | --- |
| Ficha cadastral | Pessoa física/jurídica · Código · Terceiro · Bloqueado · Nome · Apelido · CPF · RG · Emissor · UF · Sexo · Aniversário · Razão social · Nome fantasia · CNPJ · IE · IM · Telefone · Celular · Email · Site · Observação |
| Acesso | Login · Senha · Perfil |
| Funções | Operador de PDV? · Administrador de PDV? · Comprador? · **Vendedor?** · **Comissão** (%) |
| Demais | Características · Endereços · Contatos (cargo) · Dados bancários · Documentos |

### Permissões (`configuration/security/permissions`)

Matriz **grupo × funcionalidade × Acessar / Adicionar / Alterar / Excluir**.

Grupos (perfis) da RDX: Administrador · Administrativo · Auxiliar Administrativo · Comprador · Gerente · Gerente + Administrativo · Operador PDV · Vendedor · Vendedor Redex.

Funcionalidades por módulo (as fora do escopo estão riscadas):

| Módulo | Funcionalidades |
| --- | --- |
| Catálogo | Produtos · Marcas · Categorias · Unidades de medida · Impressão de etiquetas · Serviços · Produção · Campanha de desconto · ~~Página de ofertas~~ · Combos |
| Financeiro | OFX · Conciliação bancária · Contas correntes · Contas gerenciais · Pagamentos · Recebimentos · Recuperação de crédito · Movimentação de caixa · Recebimento e pagamento de múltiplas contas · Fluxo de caixa · Tipo de pagamento · Saldo e extrato integrados · Concilia Fácil |
| Vendas | CRM · Devoluções · Pedido de venda · Orçamento de venda · Lançamento de comissões · Aprovação de comissões · Ordem de expedição · ~~Loja virtual (categoria, destaques, banners)~~ · Promoções |
| Pessoas | Clientes · Fornecedores · Tipo de endereço · Lista de preços / Tipos de cliente · Tipos de documento · Tipos de fornecedor |
| ~~PDV~~ | ~~Cardápio · Cupom · Operações PDV · Devoluções~~ |
| Compras | Central de compras · Orçamento de compra · Pedido de compra · Devoluções |
| Relatórios | 39 relatórios (carteira de clientes, contas a pagar/receber, DRE gerencial, vendas por vendedor, curva ABC, Kardex, etc.) |
| Estoque | Locais · Consulta · Movimentações · Motivo · Tipos de estocagem · Transferências internas · Itens pendentes de entrega |
| Faturamento | **Natureza de operação · Matriz fiscal** · Nota fiscal · Manifesto · Exceção fiscal |
| Ordem de serviço | Ordem de serviço |

O **CFOP** vem da natureza de operação e da matriz fiscal, não do produto.

### Parâmetros de venda (`configuration/company/time`)

Valores atuais da RDX (leitura das telas; conferir na T202):

| Parâmetro | Valor |
| --- | --- |
| Validade do orçamento de venda | 15 dias |
| Entrega para pedido / para orçamento (venda) | 10 / 10 dias |
| Utilizar limite de crédito · Limite para novos clientes | Sim · R$ 1.000,00 |
| Desconto máximo no pedido | 100% |
| Bloquear venda com estoque negativo | Não |
| Método de valorização do estoque | PEPS |
| Formato de impressão | A4 |
| Nome da prestação de serviço | Ordem de serviço (padrão) |

### Financeiro (ajustes)

- **Contas gerenciais:** plano de contas com Código · Nome · Tipo (Entrada/Saída) · Grupo do DRE · Ativo. Ex.: Água → Saída → Utilidades; Comissão de vendas → Saída → Pessoal.
- **Contas correntes:** Nome · Interna · Banco · Agência · Conta · Principal · Ativo (6 contas: Caixa, PDV 1, Mercado Pago e outras).
- **Tipos de pagamento:** Descrição · Ativo · PDV. Boleto, Cartão de crédito/débito, Cheque, Depósito, Dinheiro, PIX, Transferência, TEF, Vale, links de pagamento e apps de delivery (iFood, Rappi etc.: fora do escopo).

### Migrar Dados (`configuration/integration/migratedata`)

Importa **para** a MarketUP a partir do ContaAzul (ligado) e do Bling. Não exporta; não serve para a migração do RDX.

## Exportações das telas (o que trazem)

### Funcionários (`ListaFuncionarios.xls`, baixado em 07/11/2026)

22 colunas: Código · Nome/Razão Social · Apelido/Nome fantasia · Sexo (M ou F) · CPF · RG · Expedição RG · UF do RG · CNPJ · IE · Telefone · Celular · Fax · Email · Site · Endereço · Número · Complemento · Bairro · Cidade · Estado · CEP.

**Não traz o `EmployeeID`** (o ID que aparece em `employee/detail/{id}`), nem login, perfil, "Vendedor?" ou comissão. "Código" é um campo livre, preenchido em poucos registros. **A exportação da tela não basta para manter os IDs**: depende do pedido formal da base completa (M002).

## Ajustes › Financeiro em detalhe (levantado em 07/11/2026)

### Conta gerencial (`management_account/detail/{id}`)

Ficha: Tipo (Saída / Entrada) · Conta origem (conta pai, ex.: "Saídas") · Posição relativa (número) · Código referência (ex.: "1.0") · Classificação DRE · Nome · CC débito · CC crédito (texto, contas contábeis) · Compras (sim/não) · Ativo.

Classificação DRE das saídas: Aluguel, condomínio e IPTU · Custo da mercadoria · Despesas financeiras · Gerais e administrativas · Impostos e devoluções · Pessoal · Pro labore · Propaganda e marketing · Utilidades. Entradas: Receitas financeiras · Entradas.

58 contas na RDX. A maioria é padrão do sistema (lixeira desativada); as criadas pela RDX podem ser excluídas: Ajuste de caixa (entrada e saída), Alimentação, Estacionamento, Financiamento veículo, Impostos MEI, Taxa cartão de crédito, Veículo IPVA / licenciamento / seguro.

### Conta corrente (`account`)

Edição na própria linha da lista (sem ficha): Nome · Interna (sim/não) · Banco (lista oficial de bancos) · Agência - dígito · Conta - dígito · Principal · Ativo · confirmar/cancelar. 6 contas na RDX (Caixa e PDV 1 internas; bancos e Mercado Pago externas).

### Tipo de pagamento (`payment_type/detail/{id}`)

Ficha: Descrição · Início contrato · Fim contrato · Carência · Ativo? · Utiliza no PDV? (fora do escopo).

**Condições de pagamento** (várias por tipo): Descrição · Parcelas · Intervalo (dias) · 1ª parcela (dias) · % Adm · % Antecipação · Valor fixo · Classificação · Compras? · Vendas?. Ex.: no cartão de crédito, "À vista" (1 parcela), "Entrada + 02x sem juros" (3 parcelas, intervalo 30, 1ª em 0), "Sem entrada + 02x" (2 parcelas, intervalo 30, 1ª em 30), "Entrada + 45 dias".

### Informações da empresa

Bloco do CNPJ com a situação (Ativo) em destaque · Nome fantasia · Razão social · E-mail · Telefone · Área de atuação (lista) · Inscrição estadual · Logotipo · WhatsApp · Inscrição municipal · Domínio (MarketUP, não se aplica) · Fuso horário · Ajustar horário de verão? · Endereços: Faturamento, Entregas, Correspondências (CEP, logradouro, número, bairro, cidade, UF) · Produtor rural? · Certificado digital.

### Usuários (`configuration/security/users`) — conferido em 08/11/2026

Lista sem barra de ferramentas: **Usuário** (nome, e-mail | telefone) · **Permissões** (grupo do ERP; grupo do PDV fora do escopo) · **Comissão** (%) · **Ativo?** (interruptor na própria linha; o dono da conta não tem). Botão "Adicionar novo usuário" no fim. 5 usuários na RDX, um deles técnico (integração).

### Catálogo › Marcas, Unidades e Categorias — conferido em 08/11/2026

| Tela | Lista | Edição |
| --- | --- | --- |
| Marcas (`brand`) | ID (BrandID) · Nome, em ordem de nome | Na própria linha (nome) + "Enviar foto" / "Remover" (imagem da marca) |
| Unidades de medida (`item_unit`) | ID · Sigla · Nome, em ordem de nome | Na própria linha. **Do sistema (não editam nem excluem):** 1 UN Unidade, 2 CX Caixa, 3 FD Fardo, 4 KG Quilograma, 5 HF Hora/Funcionário. Da RDX: 6 M², 7 M Metro, 8 ML Milheiro, 9 CT Cento, 10 BR Barra |
| Categorias (`category/detail/{id}`) | Nome | Ficha: nome da categoria + lista de **Subcategorias** ("Incluir subcategoria", editar e excluir na linha) + Salvar / Salvar e voltar |

Marcas na RDX (ID · nome): 1 Equiplex · 2 Metalúrgica Verdadeiro · 3 Trifixi · 4 Guardtec · 5 BKT · 6 HT · 7 Sportnet · 8 Alutim · 9 Sportnet (duplicada) · 10 Protectpool.

### Produtos (`Produtos.xlsx`, baixado em 08/11/2026)

40 colunas: Código de barras · Tipo de produto · Descrição · Preço de custo · Preço venda varejo · Preço venda atacado · Quantidade mínima atacado · Unidade · Ativo · Categoria · Subcategoria · Movimenta estoque · Estoque mínimo · Quantidade em estoque · Marca · Modelo · Código balança · Código interno · Tags · Tipo (fiscal) · NCM · CFOP · Origem · CEST · Categoria PDV · Botão PDV · campos da loja virtual (fora do escopo) · Altura · Largura · Profundidade · Peso · Descrição do produto · Garantia · Itens inclusos · Especificações.

- **Não traz o `ItemID`.** Todos os 190 têm código de barras (pode servir de conferência, não de ID).
- **Só 5 de 190 têm NCM** e 3 têm CEST: sem NCM não se emite NF-e de produto.
- 80 produtos sem categoria; 19 sem marca.

### Serviços (`Servicos.xls`)

Código · Nome · Unidade · Custo · Valor · Ativo. **Não traz o `ServiceID`.**

### Ficha do produto (`item/detail/{ItemID}`) — conferida em 08/11/2026

- **Coluna da esquerda:** código de barras (com o desenho das barras), foto ("Download de imagem") e Ativo / Inativo.
- **Dados:** Descrição · Tipo de item (Produto, Kit, Insumo, Brinde) · Unidade (+) · Código de balança (só para KG) · Categoria (+) · Subcategoria (+) · Marca (+) · Modelo · Código interno · Tags.
- **Preços:** Custo (última compra) · Venda varejo · Venda atacado · **Margem de lucro aproximada** (varejo e atacado, calculada na tela: (venda − custo) ÷ venda) · Qtde mínima p/ atacado · "Reajustar preço de venda pela margem de lucro".
- **Características (abas):** Estoque (Movimentar estoque · Movimentar estoque da composição · Tipo de estoque Único/Grade) · Fiscal (Tipo · NCM · Origem · CEST · Classificação) · Composição (Item · Quantidade · Unidade · Custo unitário · Custo total) · Fragmentação ("Para realizar a venda fracionada": 1 <unidade> = Quantidade · Unidade · Valor de venda · Estoque de consumo; ex. 1 Litro = 1000 ml, 1 Caixa = 10 pacotes) · PDV e Loja virtual (fora do escopo).
- Listas fiscais: **Tipo** = Ativo imobilizado, Embalagem, Material de uso e consumo, Matéria-prima, Mercadoria para revenda, Outras, Outros insumos, Produto acabado, Produto em processo, Produto intermediário, Serviços, Subproduto. **Origem** = 0 a 8 (tabela oficial da NF-e). **Classificação** = Comum, Medicamentos, Armamentos, Combustíveis, Veículos novos.
- Na RDX: 169 Produtos, **18 Kits** (usam Composição), 3 Insumos; nenhum movimenta estoque; nenhum usa grade; códigos de barras todos diferentes (100 internos "4000…", 67 "2000…").

### Ficha do serviço (`service/detail/{ServiceID}`)

Serviço ativo? · Código de barras · Nome do serviço · Custo · Valor · Unidade · "Reajustar valor pela margem de lucro". Lista: Código · Nome · Unidade · Valor · Ativo.

## Ordem de serviço (`work_order`) — conferido em 08/11/2026, só leitura

- **A RDX não usa OS na MarketUP: a listagem tem 0 registros.** Não há OS para migrar; o RDX pode desenhar a OS pela necessidade de campo (técnico, agenda, fotos), mantendo a cara das fichas de venda.
- Listagem: "Localizar por" com filtros, imprimir, exportar, "Adicionar novo" (mesmo modelo de orçamento e pedido).
- Ficha nova: Vendedor · Emissão · Cliente (nome, CPF/CNPJ, RG/IE, contribuinte ICMS, e-mail, telefone; "Para iniciar uma nova ordem de serviço é necessário identificar o cliente…") · Endereço para faturamento (cartões, +) · Itens (produtos e serviços, com cadastro rápido de item e unidade) · Desconto geral · Observação · **Garantia** (`GuaranteePeriod` + `GuaranteePeriodName`, ex.: 90 dias) · Pagamento (forma, condição, valor). Sem endereço de entrega, sem técnico, sem agenda e sem fotos.
- Rodapé: Cancelar · **Concluir serviço** · Salvar · Salvar e voltar. Topo: listar, imprimir, e-mail, copiar, Adicionar novo.
- Modelo `currentOrder` (OS): Status, IssueDate, **DoneDate**, Items, Installments, FinancialOrigin (11 = OS), Seller, NoClient, Observation, GeneralDiscount, GuaranteePeriod.
- `WorkOrderStatusEnum`: 1 Orçamento, 2 Aprovado, 5 Atrasado, 6 Concluído, 7 Cancelado, 8 Nota fiscal. `WorkOrderStatusFinancialEnum`: igual ao do pedido (1 Pendente, 2 Pago, 3 Pago parcial, 4 Atrasado, 6 Devolvido, 7 Cancelado). Permissões: Bill, Cancel, Return, Email, Copy, ViewAll, InsertSeller, InsertClient.
- Concluir serviço (`billCurrentOrder`): mensagens com "<título> NÃO FATURADA!": nome do cliente obrigatório; "Endereço de faturamento / cobrança não informado."; "Não há serviços na ordem de serviço"; depois as mesmas regras de pagamento do pedido (parcelas = total, vencidas, limite de crédito) e contas a receber com origem 11.

## Financeiro (T302) — investigado em 09/11/2026, só leitura (código das telas + consultas de leitura)

### Enums (`appErp.Types.Financial`)

| Enum | Valores |
| --- | --- |
| `FinancialOriginsEnum` | 2 Despesas, 3 Receitas, 4 Impostos, 5 Comissões, 6 Compras, 7 Vendas, 8 PDV, 9 Restaurante, 10 Ecommerce, 11 OS, 12 OtherInvoice |
| `FinancialEntryTypesEnum` | 1 Debit, 2 Credit, 3 Transfer, 4 DebitAdjustment, 5 CreditAdjustment, 6 Boleto, 7 Pix, 8 PaymentLink |
| Permissões | Payable: Insert, Delete · Receivable: Insert, Delete |

### Título (`Event`) — contas a receber (`receivable`) e a pagar (`payable`)

- Campos: EventID, Description, Date (vencimento), IssueDate (emissão), Value, Balance (saldo), DocumentNumber, Observation, Barcode, DefaultPaymentTypeID, ManagementAccountID (classificação), OriginID, OriginKey (nº do documento), OriginInstallment, IsCredit (receber = true), PersonID (sacado/beneficiário: cliente, fornecedor ou funcionário), IsManual, EntryEvents (baixas).
- **Status** (`getListEventStatusName`): saldo < 0,009 → **RECEBIDO** (a pagar: **PAGO**); vence hoje → **HOJE**; futuro → **A RECEBER** (a pagar: A PAGAR); passado → **VENCIDA**; saldo ≠ valor e > 0 → acrescenta **" / PARCIALMENTE RECEBIDO"**. Faixa da ficha: NOVO, RECEBIDA, HOJE, A vencer, Vencida.
- **Listagem**: caixa de seleção (✓ quando quitada) · Vencimento + status · Conta (descrição "PEDIDO DE VENDA Nº 15 (CHEQUE)" + "SACADO: nome") · Conta gerencial + "ORIGEM: VENDAS" · Valor · Saldo · lápis (lixeira só em manual). Totais (soma de valor e de saldo da lista) no topo. Sem filtro padrão, ordem por vencimento.
- **Filtros** ("Adicionar filtro"): Vencimento (Vencidas / A vencer) · Status (Recebidas / Em aberto) · Conta gerencial · Tipo de pagamento · Data de vencimento (de/até). A pagar: os mesmos (Pagas / Em aberto).
- **Receber/pagar várias**: marcar na lista → uma só abre a ficha; várias → `revenue/new/{ids}` ("Recebimento de múltiplas contas": lista das escolhidas + data, conta corrente, forma, juros total, descontos total, valor recebido, saldo a receber, RECEBER).
- **Ficha** (esquerda): código de barras (imagem + campo) · Classificação (conta gerencial: a receber só as de entrada, a pagar todas) · Descrição · Sacado (a pagar: Beneficiário; busca cliente/fornecedor/funcionário) · Observações · Emissão · Vencimento · Valor total · **Repetir** ("Não repetir", 2 a 12 vezes; a pagar "Intervalo") · Histórico de recebimentos (Data · Recebido · Desconto · Juros · Forma · Conta · recibo · X) · Saldo a receber. (direita): faixa do status + "Efetuar recebimento": observação, data, conta corrente, juros (+), descontos (−), valor recebido (=), efetuado em, "Incluir recebimento". Rodapé: Ver origem (se veio de documento) · Cancelar (excluir, só manual: origem < 4) · Salvar.
- **Regras da ficha**: descrição e sacado travam se veio de documento (`hasOrigin`); valor, emissão e vencimento travam com baixa (`hasEntry`). "Incluir recebimento" só **acrescenta na lista da tela**; o X **tira da lista**; nada grava até **SALVAR** (conta + baixas juntas). Amortizado = valor + desconto − juros. **Amortizado maior que o saldo → pergunta "Recebimento maior que o saldo da conta. Deseja informar a diferença (R$ x) como juros?"**. Valores negativos ou soma ≤ 0 → "Recebimento inválido, verifique os valores informados.". Conta corrente obrigatória (vem a Principal). Saldo = valor − Σ amortizado (< 0,009 → 0). Salvar manual grava `IsManual`; com repetição, cria N títulos.
- Exemplo: título 12163 (pedido 2990, R$ 3.051,60) recebido com R$ 2.874,91 + desconto R$ 176,69 (taxa do cartão digitada à mão; a condição "Cartão de crédito à vista" tem taxa 0).
- Link de origem (`getOriginLink`): Comissões → fechamento de comissão; Compras → pedido de compra; PDV → cupom; OS → ordem de serviço; senão pedido de venda.

### Movimentação de caixa (`cash_movement`)

- Período (padrão: últimos 7 dias) · filtros: Conta gerencial, Conta (corrente), Pago em (forma), Valor (de/até), Tipo (Crédito / Débito). Botões: Adicionar novo (lançamento), **Nova transferência**, imprimir, exportar.
- Lista **agrupada por data** (faixa cinza com a data): Conta · Descrição ("PEDIDO DE VENDA Nº 2990 - VENDAS VIA PEDIDO", embaixo "(MANUAL)" ou "(AUTOMÁTICO)") · Forma · Tipo (Crédito/Débito) · Valor (débito em vermelho, negativo) · lápis (+ lixeira no manual). Rodapé: **Saldo período** (soma do filtrado) e **Saldo atual** (acumulado de todas as contas, ou da conta filtrada).
- **Lançamento** (modal): Pagamento / Recebimento · Classificação (conta gerencial) · Data · Conta corrente · Valor (> 0) · Efetuado em · Descrição/observação. Grava um **título já quitado** (saldo 0, origem 3 Receitas se crédito, 2 Despesas se débito, manual) + a baixa na conta.
- **Transferência** (modal): Data · Conta de origem · Conta de destino · Nº doc · Valor · Efetuado em · Observação → saída numa conta e entrada na outra (ligadas por `TransferEntryID`).
- Exclusão de movimento manual pede "Deseja realmente excluir o registro?".

### Fluxo de caixa (`cash_flow`)

- Topo: período (de/até), Contas (todas ou uma), Visualizar por **Dias / Meses**, exportar. Colunas = dias ou meses do período.
- Linhas: **Saldo inicial** · **Receita** (Operacionais = DRE "Entradas": Vendas via PDV/Pedido/Loja virtual; Não operacionais: Outras receitas, Transferência, Rendimentos, Aportes, Ajuste de caixa - entrada) · **Despesa** (agrupada pelo grupo do DRE: Impostos e devoluções, Custo da mercadoria, Gerais e administrativas, …) · **Saldo final**. Cada conta gerencial abre os títulos (descrição, pessoa, valor).
- **Regra conferida com os números da RDX**: até hoje entra o **realizado** (baixas). Para período futuro, entra o **previsto**: títulos em aberto pelo vencimento. Saldo inicial de um período futuro = saldo realizado hoje − **contas a pagar vencidas em aberto** + **contas a receber vencidas em aberto** (25.123,51 − 25.478,45 + 14.070,00 = 13.715,06 em 10/11/2026; restante de novembro −3.482,69 → 10.232,37 em 01/12).
- Cards: **Inadimplência** (contas a receber vencidas em aberto: R$ 14.070,00 em 4 contas, crescimento nos últimos 30 dias, Ver todos, "Simular recebimento mensal de" 0/15/30/50/75%) e **Endividamento** (contas a pagar vencidas; o card mostrava R$ 13.065,18 em 5 contas, número que não bateu com nenhum recorte testado — total vencido 25.478,45 em 21 contas). **Saldo simulado** = saldo final ± as simulações mês a mês.

### Plano de contas da RDX (`management_account`)

58 contas, sem hierarquia, com o grupo do DRE (1 Entradas, 2 Impostos e Devoluções, 3 Custo da Mercadoria, 5 Gerais e Administrativas, 6 Aluguel/Condomínio/IPTU, 7 Propaganda e Marketing, 8 Pessoal, 9 Pro labore, 10 Utilidades, 11 Receitas Financeiras, 12 Despesas Financeiras). Arquivo da carga: `migracao/dados/ContasGerenciaisMarketUP.json`. Contas usadas pelo sistema: 52 Vendas via Pedido, 43 Comissão de Vendas, 74 Taxa Cartão de Crédito, 73/72 Ajuste de Caixa, 54/35 Transferência.

### Menu Financeiro (conferido em 09/11/2026)

Fluxo de caixa · Movimentação de caixa · Conciliação bancária (fora da v1) · **Pagamentos** ▸ (Contas a pagar · Contas pagas) · **Recebimentos** ▸ (Cobrança (Conta a receber) · Contas recebidas) · Saldo e extrato integrados (fora da v1). Os quatro itens abrem a **mesma lista** (`payable` / `receivable`) com filtros prontos na URL (`/search/<base64>`): `{"DueDateFrom": hoje − 3 meses, "Page": 1, "Paid"/"Received": false|true}`. A tela mostra o título do item ("CONTAS PAGAS") e os filtros como etiquetas removíveis ("Data de vencimento: De 09/08", "Status: Pagas"). Cada item tem o atalho "+" (Nova conta a pagar / a receber).

## Estoque e Compras (T301) — investigado em 09/11/2026, só leitura

### Uso real na RDX

- **Estoque nunca foi usado**: 0 movimentações, consulta e movimentações com a tela de primeiro uso ("Entendi! Vou começar a usar"); os 190 produtos têm `MovesStock = false`. Um local: **1 Estoque Padrão** (tipo 1). Tipos de estocagem: **1 Padrão, 2 Refrigerado**. Motivos de movimentação: nenhum.
- **Compras é usado**: ~260 pedidos de compra (ex.: 260 ProtectGate, R$ 8.721,43, faturado, recebimento total, pagamento atrasado), 1 orçamento de compra, 0 devoluções, centenas de fornecedores (IDs na mesma faixa dos clientes, ex.: 2895, 3219).

### Menu Estoque

Produção (fora) · Consulta de estoque (`stock_query`) · Movimentações (`new_stock_movement`) · Locais de estoque (`stock_location`) · Tipos de estocagem (`storage_type`) · Inventário (dentro do local) · Mapa de estoque (posições do local) · Motivo movimentação (`stock_movement_reason`) · **Compras** ▸ Orçamentos (`purchase_budget`) · Pedidos (`purchase_order`) · Fornecedores (`supplier`) · Devoluções (`purchase_return`) · Compras em aberto (`purchase_order_query`, relatório).

### Enums

| Enum | Valores |
| --- | --- |
| `StockMovementTypeEnum` | 1 Entrada, 2 Saída, 3 Transferência, 4 Acerto |
| `StockMovementOriginTypeEnum` | 1 SaleOrder, 2 Coupon, 3 Production, 4 Purchase, 5 StockTransfer, 6 SaleOrderCancel, 7 SaleOrderDevolution, 8 CouponCancel, 9 CouponDevolution, 10 PurchaseOrderCancel, 11 PurchaseOrderDevolution, 12 Invoice |
| `PurchaseOrderStatusEnum` | 1 Novo, 2 Faturado, 3 Entrega parcial, 4 Não conformidade, 5 Atrasado, 6 Finalizado, 7 Cancelado, 8 NF-e solicitada, 9 Aguardando pagamento, 10 Pago, 11 Consignado |
| `PurchaseBudgetStatusEnum` | 1 Novo, 2 Vencido, 3 Finalizado, 4 Cancelado, 6 Concluído |
| Permissões do pedido de compra | Bill, Delivery, Cancel, Return, Email, Copy, InsertBuyer, InsertSupplier |

### Locais, tipos, motivos

- **Local** (`StockLocation`): Nome · Tipo de estocagem · Ativo · usa posição (rua, corredor, prateleira, andar) · padrão. Lista: Nome · Tipo estocagem · C. distribuição · Ativo. Ficha com abas **Estoque atual** (código, item, qtd. disponível; importar/exportar) e **Inventários** ("Inventariar estoque" / "Cancelar inventário"), posições ("Adicionar", "Adicionar lote", "Visualizar mapa").
- **Inventário**: "Deseja realmente inventariar o local de estoque? IMPORTANTE: Não será possível movimentar o local de estoque durante o inventário." Contagem e fechamento geram uma movimentação (acerto); pode ser cancelado.
- **Tipo de estocagem**: Nome. **Motivo**: ID · Nome (cadastro rápido na movimentação).

### Consulta de estoque

Item · Qtd. disponível · Estoque mín. · Preço · Valor unitário · Valor total; cada item abre por local (local, qtd., valor total) e permite editar a quantidade (ajuste). Exportar.

### Movimentação manual (`new_stock_movement/new`)

"Qual é o tipo de movimentação?" Entrada · Saída · Transferência → data, local de origem / destino, pessoa, informações adicionais, dados da nota (nº, série, emissão, valor adicional), itens (produto, unidade, quantidade, valor, lote, fabricação, validade), motivo (+ cadastro), "perda e avaria" (só saída). Regras: pelo menos um item; transferência com origem ≠ destino; movimento vindo de documento é "acerto" e não pode ser transferência.
- **Código do formulário (lido em 09/11/2026)**: ao incluir item, `ItemValue = item.Cost` (o preço de venda para saída está comentado: movimentação vale pelo custo); `saveCurrentItem` só valida "Defina o tipo de movimentação!", "Quantidade de itens não permitida." (quantidade ≤ 0) e "Este item não está com a movimentação de estoque habilitada." — **não há checagem de saldo**: saída manual pode deixar o estoque negativo (o bloqueio de negativo existe só na venda, parâmetro "Bloquear venda com estoque negativo"). Tirar item da lista pede "Deseja realmente excluir o registro?". Outras mensagens: "A movimentação deve conter pelo menos um item.", "Movimentações de Transferencia não podem ser referenciadas", "Todos os estoques em inventário ou nenhum ativo.".

### Pedido de compra (`purchase_order`)

- Lista: Pedido (nº + status) · Status (emitido em, faturado em) · Fornecedor (nome, CNPJ, IE) · Recebimento (data + "status entrega") · Valor (+ "status pgto"). Mesmo modelo do pedido de venda.
- Ficha = pedido de venda espelhado: status ("FATURADO", "Recebimento: TOTAL / Pagamento: ATRASADO") · # nº · comentários · **Comprador** (funcionário "Comprador?", + novo comprador) · Emissão · Recebimento (previsto) · botões CONCLUIR (novo) / RECEBER / DEVOLVER · **Fornecedor** (busca + "Cadastrar novo fornecedor"; CPF/CNPJ, RG/IE, e-mail, telefone) · **Endereço de faturamento e de entrega = endereços da própria empresa** (com "Clique aqui para informar…" para dispensar) · Itens (produto, cadastro rápido de item pelo **custo**, quantidade, unidade, valor, desconto, observação; lote e validade) · Desconto, Frete, Outros custos · Pagamento com **conta gerencial** (padrão 58 Mercadoria para Revenda) e as parcelas (descrição = duplicata, ex.: "3612/001"). Topo: importar **XML da NF-e**, imprimir, e-mail, copiar, Adicionar novo.
- Modelo: PurchaseOrderID, SupplierID, BuyerID, Billing/DeliveryAddressID, IssueDate, DeliveryDate, BillingDate, CancelDate, Subtotal, Shipping, Discount, GeneralTaxes, Total, Status, Observation, ItemsToReceive, PurchaseBudgetID, Invoice (nº, série, emissão, XML). Item: ItemID, ItemUnitID, SupplierItemID (código do fornecedor), Amount, **Received**, **Returned**, Value, Discount, Subtotal, Total, InStock, Batch, ExpirationDate, Observation. Parcela: Value, Balance, Description, EventID (conta a pagar), PaymentTypeID, PaymentConditionID, PaymentGuid, **ManagementAccountID**.
- **Concluir (faturar)** (`billCurrentOrder`): "PEDIDO NÃO FATURADO!" + endereço de faturamento/cobrança não informado · endereço de entrega não informado · não há itens · forma/condição de pagamento inválida · "Verifique o valor das parcelas, total inválido". Conta gerencial vazia das parcelas vira 58. (Parcelas vencidas não bloqueiam.) Gera as contas a pagar.
- **Receber** (modal "RECEBER PEDIDO"): local de estoque · data de recebimento · dados fiscais (nº NF-e, série, emissão) · observações · por item: pedido / recebido / **quantidade a receber** (parcial), posição, lote, validade → entrada no estoque (origem 4 Purchase) e status de recebimento. "Pedido Nº X entregue com sucesso!".
- **Devolver** e **Cancelar**: como no pedido de venda (devolução com estorno; cancelamento retira as contas a pagar e devolve o recebido ao estoque — origens 10 e 11).
- **Importar XML**: envio do .xml da NF-e do fornecedor; o servidor monta o pedido com os itens da nota, que se ligam a produtos existentes ou viram produtos novos.

**Código da tela lido em 09/11/2026 (pedido 260, só leitura):**
- **Uso real**: 260 pedidos (IDs 1 a 260): 252 Faturados (status 2), 8 Cancelados (7); nenhum Novo, nenhum consignado. Lista paginada de 20 (`purchaseOrderGetPagedList`); itens e parcelas só na ficha (`purchaseOrderGet`).
- **Modelo da ficha** (`currentOrder`): PurchaseOrderID, SupplierID, BuyerID (comprador = funcionário, ex.: 1142), BillingAddressID/DeliveryAddressID (endereços **da empresa**, 1), IssueDate, DeliveryDate (previsão de recebimento), BillingDate, CancelDate, Subtotal, Shipping, Discount (itens + geral), GeneralDiscount, GeneralDiscountPercentage, GeneralTaxes ("outros custos"), Total, Status, Observation, ItemsToReceive, ReturnedItens, OrderBalance (saldo a pagar), ManagementAccount, PurchaseBudgetID, InvoiceID/Number/Serie/IssueDate/Xml, IsImported, ConsignmentDate.
- **Item**: PurchaseOrderItemID, ItemID, ItemGridID, ItemUnitID, SupplierItemID, Name, Amount, **Received**, **Returned**, ReturnDate, ReturnValue, Value, Discount, DiscountPercentage, ApplyDiscountPercentage, Subtotal, Total, InStock, Batch, ExpirationDate, Observation, Order.
- **Parcela**: PurchaseOrderInstallmentID, Date (vencimento), LastPaymentDate, PurchaseValue, Value, InstallmentNumber/Count, Description (duplicata, ex.: "3612/001"), Balance, **EventID** (conta a pagar), PaymentTypeID (−1 = "IMPORTADO XML"), PaymentConditionID, PaymentGuid, ManagementAccountID.
- **Salvar** (`saveCurrentOrder`): "Data de entrega ou de emissão inválida!" (emissão não pode ser futura; recebimento não antes da emissão) · "O valor total das parcelas está diferente do valor total do orçamento. Favor verificar!" · item com quantidade 0 · endereço/complemento até 150 caracteres. Mensagem "Pedido Nº X salvo com sucesso!". Salvar precisa de fornecedor e itens.
- **Totais** (`calcTotals`): Subtotal = Σ total dos itens; Discount = Σ desconto dos itens + desconto geral; Total = Subtotal − desconto geral + frete + outros custos (GeneralTaxes). Mudar itens antes de faturar **apaga as parcelas**. Desconto máximo da configuração (RDX: 100%).
- **Parcelas** (`setPayment`): igual à venda (valor ÷ parcelas, sobra na 1ª, 1ª em hoje + IntervalFirstDay, depois + IntervalDays); "O valor do recebimento excede o valor a receber" / "não pode ser 0"; conta gerencial da parcela = a do pedido.
- **Concluir** (`billCurrentOrder` → `doBill`): conta gerencial vazia vira 58; mensagens "PEDIDO NÃO FATURADO!" + "Endereço de faturamento / cobrança não informado." / "Endereço de entrega não informado." / "Não há items no pedido." / "Forma/Condição de pagamento inválida." / "Verifique o valor das parcelas, total inválido." (parcelas vencidas **não** bloqueiam). Se algum item tem valor ≠ custo do produto e a valorização do estoque não é CMP (RDX = **2 PEPS**), pergunta "**Deseja atualizar o preço de custo dos seguintes itens?** - Produto => de: R$ x para: R$ y" (sim atualiza o custo). Mensagem "Pedido Nº X concluído com sucesso!".
- **Status na ficha**: faixa "Faturado" ou "Concluído" (sem itens a receber e saldo < 0,001), "Cancelado", "Novo". Recebimento: Total (nada a receber) / Atrasado (previsão passada) / Pendente (nada recebido) / Parcial. Pagamento: Total (saldo < 0,01) / Atrasado (parcela vencida com saldo) / Pendente (nenhuma parcela paga) / Parcial.
- **Status na lista** (diferente!): Recebimento: Cancelado / Pendente (novo) / Entregue (nada a receber) / Atrasado / Pendente — **sem "parcial"**; Pagamento: Cancelado / Pago / Pago Parcialmente / Pendente — **sem "atrasado"**.
- **Botões**: Receber só faturado com itens a receber; Devolver só faturado com itens recebidos; Concluir só antes de faturar; Cancelar em qualquer status menos cancelado.
- **Receber** (`PurchaseOrderReceiveController`, modal "RECEBER PEDIDO"): "Selecione o local de estoque e verifique os itens pendentes para recebimento." · Local de Estoque (padrão) · Data de Recebimento (obrigatória) · Dados fiscais (Nº NF-e, Série, Data de emissão — vêm do pedido) · Observações · itens com saldo (pedido / recebido / **Receber** = pendente, editável até o pendente; posição; lote; validade futura; lixeira tira da lista). "Pedido Nº X entregue com sucesso!".
- **Devolver** (modal "DEVOLUÇÃO / TROCA"): itens recebidos com **Trocar** e **Devolver** (soma ≤ quantidade do item; troca ≤ recebido): "As quantidades informadas excedem quantidade do item." / "A quantidade disponível para troca é a quantidade recebida do item."; "Produtos devolvidos" (quantidade, data, valor); Saldo pedido · Valor recebido (pago) · **Valor estorno** · Data estorno · Estornar em (forma). Valor devolvido = quantidade × (total ÷ quantidade do item). "Devolução/troca realizada com sucesso!".
- **Cancelar**: "Deseja mesmo cancelar este pedido? Esta operação não poderá ser desfeita!"; se já pagou algo ou recebeu itens que movimentam estoque, abre o modal de cancelamento (o mesmo da venda): valor a estornar, data, forma, **local de estoque** de onde saem os itens recebidos. "Pedido Nº X cancelado com sucesso!".

### Orçamento de compra, devoluções, compras em aberto

- **Orçamento de compra**: lista Orçamento · Status · Fornecedor · Data · Valor; gera pedido ("Ordering"), cancelar, e-mail, copiar (como o orçamento de venda).
- **Devoluções**: lista Pedido · Data · Devolução efetuada por · Forma de pagamento · Valor.
- **Compras em aberto** (relatório): pedidos com itens ainda não recebidos.

### Fornecedor (`supplier`)

Ficha igual à do cliente: Pessoa física/jurídica · **Tipo** (+) · Bloqueado · Razão social · Nome fantasia · CPF/CNPJ · RG/órgão/UF · sexo · nascimento · indicador IE · IE · IM · telefone · celular · e-mail · site · e-mail da NF-e · observação · **Transportadora?** · **Produtor rural?**. Abas: Endereços, Contatos, Dados bancários (+ chaves PIX), Documentos, **Financeiro** (contas do fornecedor). Modelo: SupplierID, SupplierTypeID, OfficialName, Name, Blocked, IsCarrier, RuralProducer, InExterior, …

**Detalhes lidos em 09/11/2026 (só leitura, fornecedor 3 Equipesca):**
- Lista (Compras › Fornecedores): Nome · Tipo · Telefone · Celular · Email · lápis/lixeira; filtros Bloqueado, CPF, CNPJ, Tipo, Telefone, E-mail, **Transportador**. Excluir: "Deseja realmente excluir o Fornecedor?" → "Registro excluido com sucesso." ou a mensagem de erro do servidor. A lista **não traz CNPJ, endereços etc.** (só a ficha).
- Campos (`currentSupplier`): SupplierID, SupplierTypeID, OfficialName (razão social/nome), Name (fantasia/apelido), Blocked, IsCarrier, RuralProducer, InExterior, **PersonEntityType (1 = Física, 0 = Jurídica)**, Cpf, DocumentNumber (RG), DocumentIssuer, DocumentState, Birthday, PersonGender, Cnpj, Ie, Im, Phone, Mobile, Email, FiscalRecipientEmail, Site, Observation, IcmsContributorTypeID (pode ficar "Selecione" = vazio), SupplierAddressList, SupplierContactList, SupplierDocumentList, SupplierBankDetailsList, **SupplierPixKeyList**, SupplierFinancialEventList.
- **Tipos de fornecedor** (`supplier_type`, Ajustes › Pessoas): ID · Nome — 1 Geral, 2 Matéria Prima, 3 Material de Escritório, 4 Serviços, 5 Entregas. Ao salvar sem tipo, vai o 1.
- **Salvar** (`saveSupplier`): se trocou física/jurídica num fornecedor gravado, pergunta "Você alterou o tipo de pessoa (pessoa física/pessoa jurídica). Os dados do tipo de pessoa antigo (CPF e RG ou CNPJ e IE) serão apagados. Deseja continuar?". Mensagens "Dados inseridos com sucesso." / "Dados alterados com sucesso.".
- **Dados bancários**: select Tipo = "Conta bancaria" (Banco, Agência, Dígito, Conta, Dígito) ou "Chave Pix" (Tipo da Chave: 1 CPF, 2 CNPJ, 3 Email, 4 Celular, 5 Chave aleatória; Chave Pix). Uma lista só: Tipo/Nº Banco · Chave/Banco · Agência · Conta.
- **Documentos**: os mesmos tipos de documento do cliente (6 Inscrição Estadual, 11 Inscrição Municipal, 12 Inscrição Estadual ST, 13 CNAE, 14 Suframa), com "+".
- **Financeiro** (`supplier-credit`): Total vencidas · Total a vencer · Total pagas; "Parcelas do fornecedor" em Vencidas (saldo e vencimento passado) / A vencer / Pagas/Recebidas (saldo zero); colunas Vencimento · Conta · Valor · Saldo · lupa; marcar e **"Receber selecionados"** (rótulo da MarketUP, mas paga): 1 conta abre a conta a pagar, várias vão para pagar várias (`expenditure/new/<ids>`). A Equipesca tem 295 contas (pedidos de compra, conta gerencial 58, origem 6).
