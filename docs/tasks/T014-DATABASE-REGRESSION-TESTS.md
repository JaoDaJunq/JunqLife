# T014 - Database regression suite

## Objetivo
Transformar as falhas que já apareceram em produção de teste em checks automáticos de PR.

## Stack
- Supabase CLI oficial;
- pgTAP;
- GitHub Actions;
- banco local isolado criado pelas migrations do repositório.

## Cenários cobertos
- owner cria círculo com INSERT ... RETURNING;
- trigger cria membership owner;
- sharing começa desligado;
- membro não vê current_location com sharing OFF;
- membro vê current_location com sharing ON;
- outsider não vê círculo nem current_location;
- service role consegue ingerir ponto aceito;
- membro autorizado lê histórico do círculo;
- outsider recebe zero histórico;
- ponto buffered de período sem consentimento é recusado;
- função privada de histórico não é executável por authenticated;
- RPC de transferência não é executável por authenticated;
- service role pode transferir owner;
- owner_id e papel owner permanecem consistentes após transferência.

## Regra de CI
Toda PR e todo push na main executam `supabase test db`. Uma regressão de RLS ou migration bloqueia a etapa.
