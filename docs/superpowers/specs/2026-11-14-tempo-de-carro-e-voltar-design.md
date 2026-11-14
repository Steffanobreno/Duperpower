# Fino: limite por tempo de carro (grátis) e botão de voltar

Data: 2026-11-14. Tamanho: mudança pequena. Branch: `claude/clever-clarke-3ukcxg`.

## Por que
- **Distância.** Um pedido de Piedmont entrou num dia que já tinha cliente em Redwood City. De carro são 40 milhas, cerca de 1 hora. Isso é inviável e não compensa financeiramente para o groomer.
  - **Causa:** `findSlots` (`src/lib/booking.ts`) mede a distância entre os centros dos CEPs em linha reta. A linha reta passa por cima da baía e dá 25,3 milhas, contra o limite padrão de 25.
  - **Outro furo:** quando um CEP não é encontrado, a conta dá `null` e o horário passa sem checagem.
- **Voltar.** A seta do topo leva a um endereço fixo. Exemplos: Pedidos → `/today` e Lista de espera → `/today`. Quem entra por outra tela "cai no mapa" em vez de voltar para onde estava.
- **Regra do dono:** dirigir no máximo 30 a 35 minutos entre um cliente e o próximo. A referência é a agenda inteligente do MoeGo.

## Objetivos
1. Nenhum horário oferecido (na página de agendamento ou no app do groomer) pode ficar a mais de N minutos de carro da parada anterior e da próxima. N vale 35 por padrão e é ajustável.
2. Custo zero: nenhuma API paga.
3. A seta de voltar volta para a tela anterior de verdade.

## Fora do escopo agora
- Áreas desenhadas no mapa e áreas por data, como no MoeGo.
- Visual novo.

Os dois ficam para o projeto do visual novo, logo depois.

## Anti-objetivos
- Bloquear dias normais. Um dia que vai de San Mateo a Redwood City, com paradas próximas entre si, continua aberto.
- Deixar passar quando não dá para calcular.

## Abordagens consideradas
- **A. Tempo de carro do Google, guardado por par de CEPs.** É preciso e cabe na cota grátis de 10.000 por mês. **Não escolhida:** o dono quer só a conta grátis, sem depender do Google.
- **B. Conta grátis (escolhida pelo dono).** Linha reta entre centros de CEP × fator de desvio ÷ velocidade média = minutos estimados. É conservadora de propósito.
- **C. Google em tempo real por endereço.** Mais cara e mais lenta. Não escolhida.

## Como funciona (B)
**Estimativa.** `driveMinutes(milhasEmLinhaReta) = milhas × 1,4 ÷ 35 mph × 60`, com mínimo de 5 minutos. Fica numa função única, `src/lib/geo/drive.ts`, para a calibragem ser trocada num lugar só. Exemplos com esses números:

| Trecho | Linha reta | Estimativa | Resultado com limite de 35 min |
|---|---|---|---|
| Redwood City → Piedmont | 25,3 mi | ~61 min | **bloqueado** |
| San Mateo → Oakland | 19,7 mi | ~47 min | bloqueado |
| Redwood City → San Mateo | 8,1 mi | ~19 min | ok |
| SF → Oakland (centro a centro) | ~9 mi | ~22 min | ok |

**Regra por horário.** Isto substitui a regra atual "todos os clientes do dia":
- Para cada horário candidato, achar a parada anterior e a próxima daquele dia e daquele groomer.
- Quando não há parada anterior, usar o CEP de partida da van (`businesses.start_zip`).
- Cada vizinho precisa estar a no máximo N minutos estimados.
- O horário só é oferecido se os dois vizinhos passarem.
- O destaque "perto" (⭐, hoje `NEAR_MILES = 5`) passa a ser "até 10 minutos estimados".

**Sem conseguir calcular:**
- O CEP do cliente não encontrado já é recusado por `zipProblem`.
- Se o CEP de um vizinho for desconhecido, aquele horário não é oferecido. Na dúvida, bloqueia.

**Configuração.**
- Em Ajustes → Agendamento online, "milhas máximas entre paradas" vira **"Minutos máximos de carro entre clientes"**: padrão 35, de 10 a 90.
- Nova coluna `businesses.max_drive_minutes int not null default 35`.
- A coluna antiga `max_cluster_miles` deixa de ser usada e não é apagada.
- O texto da tela explica que o tempo é uma estimativa sem trânsito.

**Mesma regra em todo o app.** Valem a mesma função e o mesmo limite em:
- `findSlots`, que alimenta a página de agendamento e a validação no envio;
- o aviso do app do groomer ao marcar à mão (`tooFarFromDay`);
- "dias com cliente perto" (`nearbyDays`);
- "Preencher o buraco", na ordem e na distância exibida.

**Pedidos que já estão pendentes.** O cartão em Pedidos mostra o aviso "~61 min de carro do cliente das 10h (Redwood City)" quando passa do limite. Assim o groomer vê antes de aceitar.

## Voltar
- `PageHeader` passa a voltar no histórico do navegador quando a tela anterior é do próprio app. Sem tela anterior (link aberto direto, app recém-aberto), usa o endereço de reserva que já existe hoje.
- O gesto de voltar do Android e do navegador já segue o histórico. Isso vale porque nenhuma tela substitui o histórico ao navegar, como o código atual confirma.

## Testes
- **Unitário:** `driveMinutes` com os números da tabela.
- **E2E da página de agendamento:**
  - dia com visita em Redwood City (94063) → cliente de Piedmont (94611) não vê esse dia;
  - cliente de San Mateo (94402) vê o dia;
  - um horário entre duas paradas longe uma da outra é recusado.
- **E2E do aviso em Pedidos:** um pedido fora do limite mostra o aviso.
- **E2E do voltar:** Menu → Pedidos → seta → volta ao menu de origem, e não ao mapa. Abrindo Pedidos direto, a seta vai para a reserva.
- Os testes `nearby`, `booking`, `fill-gap` e `today-map` continuam passando, ou têm a expectativa ajustada à regra nova, com o motivo explicado.

## Fica para o construtor
Os nomes internos e onde exatamente a regra por horário entra no laço de `findSlots`.
