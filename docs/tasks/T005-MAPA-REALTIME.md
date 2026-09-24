# T005 - Mapa Realtime

## Objetivo
Exibir os membros de um círculo em um mapa nativo e atualizar posição/estado em tempo real sem quebrar o modelo de privacidade.

## Stack
- MapLibre React Native 11.4.0
- OpenFreeMap Liberty (MVP)
- Supabase Postgres Changes
- RLS existente em `current_locations` e `circle_member_sharing`

## Fluxo
1. Usuário abre um círculo.
2. App carrega membros, perfis, estado de compartilhamento e posição atual.
3. O mapa mostra somente:
   - a própria posição, quando existente;
   - posição de outro membro se `sharing_enabled = true` naquele círculo.
4. Realtime escuta:
   - `current_locations` para novos pontos;
   - `circle_member_sharing` para pausa/retomada.
5. Ao pausar compartilhamento, o marcador some imediatamente para os demais membros daquele círculo.

## UI
- tela própria `/map?circleId=...`;
- markers com iniciais;
- destaque do próprio usuário;
- botão Enquadrar;
- cartão do membro selecionado;
- bateria;
- precisão;
- velocidade/estado parado ou em movimento;
- última atualização;
- lista de membros e status.

## Critérios de aceite
- Membro fora do círculo não consegue abrir dados do círculo.
- Membro pausado não aparece no mapa dos demais.
- Usuário continua podendo enxergar a própria posição para diagnóstico.
- Primeiro ponto de um aparelho aparece sem recarregar a tela.
- Atualizações subsequentes movem o marker sem refresh manual.
- Mudança de sharing é refletida em realtime.
- RLS continua sendo a barreira de autorização.
- Nenhuma chave secret/service role entra no app.
- CI TypeScript passa.

## Teste real obrigatório
Com dois aparelhos/usuários:
1. A e B entram no mesmo círculo.
2. Ambos ligam compartilhamento.
3. Ambos iniciam tracking.
4. Abrir mapa em A e movimentar B.
5. Confirmar marker de B mudando sem refresh.
6. Confirmar bateria e timestamp atualizando.
7. B desliga compartilhamento.
8. Confirmar marker de B desaparecendo em A.
9. B religa e envia nova posição.
10. Confirmar retorno do marker.

## Escala futura
Postgres Changes é suficiente para V0.1. Antes de ampliar grupos/volume, migrar atualização de localização para Broadcast privado por círculo, mantendo RLS/Realtime Authorization.
