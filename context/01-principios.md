# Princípios (vencem qualquer outra regra)

1. **Na dúvida, siga a MarketUP.** Telas, fluxos, nomes de campos, medidas e IDs seguem a MarketUP, para que a migração seja a mais fácil possível. Só estas exceções são permitidas:
   - identidade visual da RDX (cores, logo, fontes do design system);
   - nenhuma propaganda;
   - acessibilidade (contraste mínimo de 4,5:1, foco visível, toque de 48px);
   - comportamento em celular e tablet.
2. **Compatibilidade total de IDs.** Registro migrado mantém o ID da MarketUP. Ver `regras-de-negocio/ids-marketup.md`.
3. **Nomes padronizados.** Nomes de pessoas, empresas e endereços seguem `regras-de-negocio/padronizacao-de-nomes.md`.
4. **Docker em tudo.** Desenvolvimento, testes e produção rodam em contêineres. Ver `decisoes/ADR-001-docker.md`.
5. **Sem propaganda.** Nenhuma tela mostra anúncio, banner promocional, oferta de upgrade ou script de anúncio e rastreamento de terceiros.
6. **Código e telas originais.** A MarketUP é referência de funcionalidade e de medidas, nunca de código. Nada do código, das imagens ou dos textos dela é copiado.
