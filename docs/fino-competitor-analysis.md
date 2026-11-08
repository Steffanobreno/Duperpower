# Fino: análise de concorrentes

Pesquisa de 2026-11-07. **Atenção:** os sites oficiais (daysmart.com, vagaro.com, heygoldie.com, moego.pet) não abriram nesta sessão por causa do bloqueio de rede. Os dados vêm de diretórios (Capterra, GetApp, Software Advice) e de blogs de comparação, e as fontes às vezes discordam. **Nada daqui vai para uma página pública sem antes conferir no site oficial e anotar a data.**

## Preços (não verificados no site oficial)

| Concorrente | Preço inicial | Grátis | Observação | Fonte |
|---|---|---|---|---|
| Goldie | US$19,99/mês | Plano grátis de 20 agendamentos/mês (página antiga) | Cartão: 2,6% + 30¢ | heygoldie.com/?p=639, Capterra |
| BookSteam | US$19,95–29,95 | As fontes divergem | Genérico, não é só para pet | Capterra, Spotsaas |
| DaySmart Pet | US$29/mês (as fontes divergem) | Teste | "Sem contrato" segundo avaliações | Software Advice, Capterra UK |
| Groomsoft | US$29,95 loja / US$39,90 móvel | Demo de 30 dias | Rotas, Street View, quilometragem, SMS de mão dupla | groomsoft.com/pricing, Capterra |
| Revelation Pets | US$39–55 | Teste | Integração com QuickBooks | Capterra |
| Pet Manager | A$30–150 | "Free version" no rótulo, mas na prática é um teste | Australiano | GetApp, Software Advice AU |
| Paw Partner | US$44,99 (há um dado conflitante de US$24) | Teste | App com a marca do groomer: +US$99,99/mês | Capterra, Toolradar |
| RunLoyal | US$49–249 | Teste | Por volume de agendamentos | GetApp, Capterra CA |
| MoeGo | US$49–159 (Growth e Ultimate por van) | Teste de 14 dias | O mais citado para banho e tosa móvel | Toolradar, Guideflow |
| Gingr | US$109–169 | Teste | Foco em creche e hotel | Toolradar (lido em 2026-10-26) |
| Vagaro | US$24–30 + US$10 por agenda + extras | Teste | Marketplace; "Fill My Books" cobra 20% do 1º atendimento de um cliente novo | Vagaro (marketplace), blogs |

## IA (não verificada no site oficial)
- **Vagaro:** "Vera Receptionist", um chatbot que responde as mensagens 24h (página oficial de novidades, ago/2026). Também gera textos de marketing.
- **MoeGo:** um blog menciona uma IA "Marvin". Não confirmado.
- **DaySmart, Goldie, Gingr e os demais:** nada de IA encontrado.
- **Novatos com recepcionista de IA:** Groomify, Teddy, GoPet AI. Fonte: um blog de comparação.

## Marketing (com fonte)
- DaySmart: quem indica ganha US$100 de crédito e o indicado ganha 50% no 1º mês (daysmart.com/pet/customer-referral-program).
- RunLoyal: indicou, os dois ganham 1 mês grátis.
- Gingr: 50% nos 3 primeiros meses para quem troca de sistema (parceria Paragon).
- Desconto anual equivalente a "2 meses grátis" é comum. O Fino já faz isso (US$290 = 10 × 29).
- Vagaro: reclamações no Trustpilot sobre a comissão de 20% do marketplace.

## Onde o Fino está, comparado (só o que o código confirma)

| Função | Fino (verificado) | Lacuna |
|---|---|---|
| Agendamento online por link e QR, com intake e contrato | ✅ | — |
| Rota do dia otimizada e "estou chegando" com ETA | ✅ (com chave do Google) | — |
| Lista de espera, repetição de visitas, histórico com foto | ✅ | — |
| 20 idiomas e funcionamento em qualquer país (moeda, telefone, CEP, km/mi) | ✅ | Diferencial: as fontes não mostram isso nos concorrentes |
| Equipe, papéis, folha (comissão, por hora, gorjeta) | ✅ | — |
| Lembretes por e-mail; SMS saindo do iPhone do dono | ✅ | Sem SMS de mão dupla nem número próprio |
| Cobrança de cartão do cliente, sinal, taxa de falta | ❌ | **Maior lacuna** (todos os grandes têm) |
| "Esqueci minha senha" | ❌ | Lacuna básica |
| Importar de outro sistema | CSV de clientes ✅ | Sem modelo pronto para MoeGo/DaySmart |
| IA que atende o cliente final | ❌ (a IA só ajuda o groomer) | Oportunidade, depois dos primeiros assinantes |
| Programa de indicação | ❌ | Barato de fazer |
| Plano grátis | ❌ (teste de 14 dias) | Decisão comercial sua |

## Diferenciação honesta (o que pode ir para a página de vendas)
- "Um preço: US$29/mês ou US$290/ano." É verdade: o preço é por empresa, não por van.
- "Rota do dia e ETA para o cliente." Verdade, com a chave do Google configurada.
- "Em 20 idiomas, em qualquer país." Verdade para o app; a página de vendas está em 3.
- **Não usar** "mais barato que o MoeGo" nem "melhor que X" sem conferir o preço oficial no dia e citar a fonte.

## Pesquisa de 2026-11-07, segunda rodada

Feita para a spec `docs/superpowers/specs/2026-11-07-fino-vantagem-competitiva-design.md` (seção 2). Os sites oficiais continuavam bloqueados nesta sessão: os dados vêm de Capterra, GetApp, Toolradar e blogs. **Vale a mesma regra de cima:** nada daqui vai para uma página pública sem conferir no site oficial e anotar a data.

| Concorrente | Preço (não conferido) | O que tem de bom | Fraqueza que exploramos |
|---|---|---|---|
| MoeGo | US$49–159 por van; groomer sozinho com SMS gasta ~US$139–200/mês | Agenda pensada na rota, mensagens de mão dupla, pagamentos | Caro; cobra por SMS; app lento; **não funciona sem internet**; a "agenda inteligente" é difícil de usar e fica nos planos caros |
| Goldie | Grátis até 20 visitas/mês; Pro por US$19,99 | Plano grátis; lembretes saem do celular do groomer (custo zero para eles); sinal | Genérico, sem nada de rota |
| Groomsoft | US$39,90 o plano móvel | Rota otimizada, quilometragem automática, Street View, **"pets atrasados perto da sua rota"** | Interface antiga; poucas avaliações |
| DaySmart Pet | ~US$29 | Pagamentos, cartão salvo, mensagens de mão dupla | Feito para pet shop com creche e hotel |
| Vagaro | US$24–30 + extras | IA de marketing | Comissão de 20% no marketplace, que gera reclamações |

**Dores do groomer móvel:**
- **Faltas:** cada uma custa US$50–150, mais o combustível e o horário que poderia ter sido de outro cliente.
- **Combustível:** um groomer de Fresno gasta US$4.000/mês; outro no Arizona diminuiu a área atendida.
- **Rotas mal feitas:** somam 30–50 milhas por dia.
- **Cliente que não volta.**
- **Buracos na agenda.**

**O que a Onda 1 fez com isso:** boletim pós-banho (o cliente volta e o groomer parece profissional), "Preencher o buraco" (a ideia dos "pets atrasados perto da rota" do Groomsoft, mais a lista de espera), painel de indicadores, o rodapé "Agendado com Fino" e os botões que enviam pelo WhatsApp ou SMS do próprio celular (custo zero, como o Goldie).

**Fontes:**
- Sites oficiais citados (abertos só pelo endereço, sem data de conferência): [heygoldie.com](https://heygoldie.com), [groomsoft.com](https://groomsoft.com), [daysmart.com](https://daysmart.com).
- Fontes da segunda rodada (todas acessadas em 2026-11-07; **não verificadas no site oficial**, vale a regra de cima):
  - Capterra, preços do MoeGo: <https://www.capterra.com/p/165732/MoeGo/pricing/>
  - Toolradar, preços do MoeGo: <https://toolradar.com/tools/moego/pricing>
  - Toolradar, melhores softwares de banho e tosa: <https://toolradar.com/guides/best-pet-grooming-software>
  - GoMarketBox, preços e avaliações do MoeGo: <https://www.gomarketbox.com/blog/moego-pricing-reviews>
  - Goldie: <https://heygoldie.com/?p=639>
  - Tekpon, avaliações do Goldie: <https://tekpon.com/software/goldie/reviews>
  - Groomsoft, banho e tosa móvel: <https://www.groomsoft.com/features/mobile-grooming-software/>
  - GetApp, Groomsoft: <https://www.getapp.com/retail-consumer-services-software/a/groomsoft/>
  - DaySmart, banho e tosa móvel: <https://www.daysmart.com/pet/?p=2135>
  - Comparação de IA em softwares de banho e tosa: <https://sagnikbhattacharya.com/blog/pet-grooming-software-ai-compared>
  - Fox10 Phoenix, groomers móveis do Arizona diminuem a área por causa do combustível: <https://fox10phoenix.com/news/arizona-mobile-animal-grooming-businesses-decreases-travel-radius-to-avoid-price-hikes>
  - Blog do MoeGo, como reduzir faltas: <https://www.moego.pet/blog/reduce-no-shows-pet-grooming>
  - Groomer to Groomer, os 4 maiores desafios do banho e tosa móvel: <https://www.groomertogroomer.com/4-biggest-challenges-of-mobile-grooming/>
