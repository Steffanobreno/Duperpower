# Fino: estratégia de SEO e de visibilidade em IA

Data: 2026-11-07. Três frentes diferentes, cada uma com seu próprio trabalho.

## A. Buscadores (Google, Bing, DuckDuckGo, Brave, Yahoo)

O DuckDuckGo e o Yahoo usam muito o índice do Bing; o Brave tem índice próprio. Por isso o trabalho é o mesmo para todos: HTML com conteúdo, um canonical por página, sitemap e autoridade (links e avaliações).

**Já está pronto (verificado):**
- A página de vendas é renderizada no servidor: o HTML inicial já tem o texto, o h1 e o FAQ.
- Title, description, canonical, hreflang (en, pt, es e x-default) e Open Graph.
- JSON-LD: SoftwareApplication com os preços reais, Organization e FAQPage.
- `robots.txt` (áreas privadas bloqueadas) e `sitemap.xml`.
- Os links privados (`/a/`, `/r/`, `/s/`, `/u/`, `/intake`) e o `/admin` têm `noindex`.
- As páginas `/book/<slug>` são indexáveis, com o nome da empresa no título. Ficam fora da busca quando a agenda está pausada.

**Depende de você (contas externas; não invento IDs nem tokens):**
1. Comprar o domínio (finogroom.com) e configurar `APP_URL` no Netlify. Sem domínio, nada disso tem efeito.
2. Google Search Console: verificar o domínio por DNS e enviar `https://<domínio>/sitemap.xml`.
3. Bing Webmaster Tools: importar do Search Console (é um clique) e enviar o sitemap.
4. IndexNow (Bing, Yandex e outros): preparar só depois do domínio. A chave fica num arquivo público; o aviso vai apenas para URLs novas ou alteradas, nunca repetidas. A Google Indexing API **não** serve para este tipo de página e não será usada.

**Páginas comerciais (fase 2; uma de cada vez, sem gerar dezenas de páginas parecidas):**

| Ordem | Página | Intenção de busca | Observação |
|---|---|---|---|
| 1 | `/pricing` | "fino pricing", "mobile grooming software price" | Hoje o preço é uma seção da home; uma página própria ajuda o Google e as IAs. |
| 2 | `/mobile-grooming-software` | "mobile dog grooming software" | A intenção mais forte; o conteúdo vem das funções reais. |
| 3 | `/mobile-grooming-route-planner` | "route planner for mobile groomers" | Rota otimizada e ETA existem de verdade. |
| 4 | `/moego-alternative` | "moego alternative" | Só com fatos verificados, data e fonte (ver `fino-competitor-analysis.md`). |
| 5 | `/faq` | perguntas de compradores | Hoje o FAQ está na home; vale avaliar se uma página separada ajuda. |
| 6 | `/about` | quem fez e por quê | "Feito por um groomer móvel." Só se for verdade; com pouco dado pessoal. |

As páginas /groomsoft-alternative, /daysmart-pet-alternative, /goldie-alternative, /blog e /demo ficam para depois das 6 acima. /contact pode ser só um e-mail na página About.

## B. Assistentes de IA (ChatGPT, Claude, Perplexity, Copilot, Google AI Overviews)

Não existe integração que garanta ser recomendado. O que aumenta a chance de ser citado:
1. **Páginas públicas acessíveis**, com o conteúdo no HTML. Isso já está pronto.
2. **Fatos verificáveis e fáceis de citar:** preço, teste grátis, países, idiomas, o que faz e o que não faz. Hoje estão na home, no FAQ e no `/llms.txt`.
3. **Estar onde as IAs leem:** Capterra, G2, GetApp, Software Advice e blogs de comparação. As respostas de IA sobre "best mobile grooming software" citam essas listas. Cadastrar o Fino (é grátis) e pedir avaliações reais aos primeiros clientes.
4. **`/llms.txt`:** já existe. É um recurso experimental e complementar, não substitui nada.
5. **Robôs (decisão sua):**
   - `OAI-SearchBot`: busca do ChatGPT. Recomendo **liberar**.
   - `GPTBot`: treino de modelos da OpenAI. Liberar ou não é escolha sua; não afeta a busca do ChatGPT.
   - `ChatGPT-User`, `Claude-User`, `Perplexity-User`: são buscas feitas a pedido de um usuário. Hoje estão liberados por `*`.
   - `ClaudeBot`, `Google-Extended`, `CCBot`: são para treino. Mesma decisão do GPTBot.
   - Hoje o `robots.txt` libera **todos** com `User-agent: *`. O código não tem nenhuma regra antirrobô. Depois do domínio, confirme no painel do Netlify que nenhuma regra de firewall ou de tráfego bloqueia esses robôs.
6. **Monitoramento:** uma vez por mês, fazer as mesmas 10 perguntas ("best app for mobile dog groomers", "moego alternative cheaper", "app agenda banho e tosa móvel" etc.) no ChatGPT, no Perplexity, no Claude e no Google, e anotar numa planilha se o Fino aparece e qual fonte foi citada.

## C. Mobile e desktop (experiência e conversão)

Medido em laboratório (ver `fino-audit.md`): LCP de 0,65 a 1,94 s, CLS 0, sem rolagem horizontal de 320 a 1920 px. Próximos passos:
- Medir o INP e os dados reais depois do domínio (Search Console → Core Web Vitals).
- Reduzir o JS da home (cerca de 470 KB sem compressão).
- Fazer o teste com axe de novo nas páginas novas.

## D. Idiomas da página de vendas

Hoje são en, pt e es, com hreflang recíproco. Não vou gerar as outras 17 versões automaticamente. A próxima língua deve ser escolhida pela demanda real (os cadastros por país no painel /admin). O app em si já tem 20 idiomas.
