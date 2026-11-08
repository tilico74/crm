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
| Características | Nome (etiquetas livres) |
| Endereços | CEP · Endereço (ou no exterior) · Nº · Complemento · Bairro · Ativo · Padrão (vários por cliente) |
| Contatos | Nome · Cargo · Telefone · Email (vários) |
| Dados bancários | Banco (lista oficial de bancos) · Agência · Dígito · Conta · Dígito · Tipo |
| Documentos | Tipo · Documento (anexos) |
| Crédito | Limite, utilizado e disponível |
| Histórico | Data · Descrição · Status (Pendente / Concluído) |

Botão no rodapé: "Adicionar pedido de venda".

## Orçamento (`sale_budget`)

- Listagem: número (= `SaleBudgetID`) com a situação embaixo, validade, entrega, data do pedido, cliente, data de emissão e valor.
- Situações: **Novo, Pedido, Cancelado, Concluído**.
- Filtros: Status, Cliente, Data de emissão, Data de pedido, Data de validade, Produtos, Valor.

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
