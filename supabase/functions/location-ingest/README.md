# location-ingest

Endpoint autenticado de ingestão de localização do JunqLife.

## Segurança
- `verify_jwt = true`.
- exige `Authorization: Bearer <user JWT>` e valida o usuário novamente no handler;
- ignora qualquer identidade enviada pelo payload: `user_id` sempre vem do token;
- exige `device_id` previamente cadastrado e pertencente ao usuário;
- não coleta posição se o usuário não tiver compartilhamento habilitado em ao menos um círculo;
- usa chave secreta somente no runtime da Edge Function para gravar em `current_locations` e `location_history`;
- o app não recebe chave secreta/service role;
- não registra coordenadas em logs ou respostas de erro.

## Comportamento
1. valida payload;
2. valida usuário e dispositivo;
3. valida consentimento de compartilhamento;
4. grava no histórico;
5. atualiza `current_locations` apenas se o ponto recebido não for mais antigo que a posição atual;
6. atualiza bateria/`last_seen_at` do dispositivo.

O buffer offline pode enviar pontos antigos: eles entram no histórico, mas não fazem a posição atual “voltar no tempo”.
