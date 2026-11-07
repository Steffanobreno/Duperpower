# O que foi feito no site (noite de 2026-11-07)

Tudo está na branch `google-map-tiles`. **Nada foi publicado**: para ir ao ar, diga "pode publicar".

## Páginas novas (cada uma em inglês, português e espanhol)
| Página | Para quê |
|---|---|
| `/features` | Tudo o que o app faz, por parte do dia, com as telas reais |
| `/pricing` | US$29/mês ou US$290/ano para o negócio inteiro, o que está incluído, indicação e dúvidas sobre cobrança |
| `/mobile-grooming-software` | Para quem busca "software para banho e tosa móvel" (a busca mais forte) |
| `/mobile-grooming-route-planner` | Para quem busca "rotas para groomer móvel" |
| `/switch` | Para quem vem de outro app: como trazer os clientes |
| `/guides` e 20 guias | Os guias passo a passo da central de ajuda, agora abertos (conteúdo real para o Google e as IAs citarem) |

Não há comparação com concorrentes: nenhuma afirmação sobre eles pôde ser conferida no site oficial. Cada frase sobre o Fino foi conferida no código. Ao conferir, corrigi três textos: recorrência ("a cada tantos dias, semanas ou meses"), áreas (por CEP, mostradas no mapa) e o portal de cobrança (não prometo trocar de plano por lá).

## Em todas as páginas
- **Menu** com Recursos, Preços e Entrar, e um botão de menu no celular.
- **Rodapé** com todas as páginas e os 3 idiomas.
- **Imagem própria ao compartilhar** (WhatsApp, Facebook, prévias de busca e de IA), com o título da página. Antes aparecia uma captura de celular cortada.
- **Para o Google e as IAs:**
  - título e descrição próprios;
  - endereço canônico;
  - as 3 versões de idioma ligadas entre si;
  - dados estruturados: trilha de navegação, perguntas e respostas, preços, passo a passo nos guias;
  - sitemap, `llms.txt` (resumo para IAs, agora com todos os recursos, preços e guias) e `robots.txt` atualizados.
- **Acessibilidade:** o teste automático (axe) passou limpo em todas as páginas, no celular e no computador. Escureci um pouco o azul dos botões para o texto branco ficar legível (contraste AA).
- **Velocidade** (build de produção, celular simulado com 4G lento): o maior elemento aparece em 0,8 a 1,1 s, sem a página tremer, e sem rolagem para o lado de 320 px a 1920 px.

## Melhorias no app que o site pedia
- O **cadastro** e o **login** agora abrem no idioma da página de onde a pessoa veio, e a conta nasce nesse idioma. Antes, uma brasileira com o celular em inglês que clicava em "Começar grátis" na página em português caía num cadastro em inglês.
- **"Cartão"** virou uma forma de pagamento para registrar, porque a página dizia que o groomer recebe em cartão e a opção não existia. O Fino não processa o cartão: só registra que o groomer recebeu na maquininha dele.

## Testes
- Novo `tests/e2e/site.mjs`, que testa as 8 páginas nos 3 idiomas:
  - título, canonical, idiomas, dados estruturados e imagem de compartilhamento;
  - sem rolagem lateral;
  - links do rodapé e menu do celular;
  - cadastro no idioma certo;
  - guias, sitemap, `llms.txt` e `robots.txt`.
- A suíte completa rodou de novo depois das mudanças (resultado na mensagem da manhã).

## Depois disso, ainda na mesma noite
- **Telas do app em português e espanhol.** As páginas em pt agora mostram o app em português, num negócio de demonstração em São Paulo e em reais; as páginas em es mostram um na Cidade do México, em pesos. Os cartões flutuantes da página inicial usam os mesmos nomes. O script `scripts/site-shots.mjs` refaz essas fotos quando o app mudar.
- **Cadastro:** "14 dias grátis · Sem cartão · Cancele quando quiser" logo abaixo do título, nos 20 idiomas.
- **Página de agendamento de cada groomer:** agora diz ao Google e às IAs que aquilo é um negócio de banho e tosa: nome, telefone, cidade (nunca a rua), serviços com preços na moeda do groomer e um botão "agendar". Isso também é um argumento de venda do Fino.
- **Página 404** com a cara do site, no idioma de quem visita e com links úteis. Termos e Privacidade ganharam o menu e o rodapé do site.
- **Lighthouse** (build de produção, celular), todas as páginas públicas, inclusive cadastro e login:

  | Velocidade | Acessibilidade | Boas práticas | SEO |
  |---|---|---|---|
  | 97 a 100 | 100 | 100 | 100 |

- **Acessibilidade no app inteiro:** WCAG 2.2 AA em 37 telas (site, páginas do cliente e 20 telas do app do groomer), no celular e no computador. Para chegar lá, escureci o verde de "sucesso", corrigi a estrutura dos relatórios e deixei a tabela alcançável pelo teclado. Agora há um teste permanente (`tests/e2e/a11y.mjs`) para isso não voltar a quebrar.
- **Testes de app ajustados:** dois testes antigos (`blocks` e `fixes`) às vezes conferiam a tela antes de ela terminar de carregar. Agora esperam; o app não mudou.

## Precisa de você
1. **Ler os textos** das páginas novas (principalmente em português) e me dizer o que mudar.
2. **Sua história:** uma página "Sobre" ("feito por quem faz banho e tosa móvel") só se for verdade e com o que você quiser contar. É o que mais dá confiança e o que as IAs mais gostam de citar.
3. **Logo do Fino:** ele entra no menu, na imagem de compartilhamento e no ícone.
4. **Capturas em português/espanhol:** as telas do celular nas páginas estão em inglês. Posso gerar versões em pt/es do app de demonstração quando você quiser.
5. **Depoimentos reais:** assim que tiver os primeiros clientes, com autorização deles.
