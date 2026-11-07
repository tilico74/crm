# Celular e tablet

| Faixa | Largura | Comportamento |
| --- | --- | --- |
| Celular | até 480px | 1 coluna; listagem em cartões; botão principal fixo embaixo, largura total; títulos de 24px |
| Tablet | 481px a 1024px | Formulário em 2 colunas; botões com largura automática; margem lateral de 16px |
| Computador | acima de 1024px | Idêntico à MarketUP |

## Regras

- **Toque:** área mínima de 48×48px em botões, links, ícones clicáveis e linhas.
- **Campos em tela de toque:** 48px de altura, texto de 16px (evita zoom automático no celular).
- **Contraste:** todo texto com pelo menos 4,5:1. O ciano da logo é claro, então o botão usa `primary` (#006C93) com texto branco.
- **Polegar:** a ação principal fica embaixo no celular. Ações destrutivas nunca ficam na barra do polegar.
- **Sol e rua:** nenhuma informação depende só da cor; status sempre tem a palavra escrita.

## Exemplo (Tailwind, depois de instalado)

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-raised text-ink rounded-md">
  <div>
    <h2 class="text-lg md:text-xl font-bold">Orçamento 3874</h2>
    <p class="text-sm md:text-base mt-2">Válido até 21/11/2026.</p>
  </div>
  <button class="w-full md:w-auto min-h-12 px-6 bg-primary hover:bg-primary-dark text-white font-semibold rounded-sm">
    Gerar pedido
  </button>
</div>
```
