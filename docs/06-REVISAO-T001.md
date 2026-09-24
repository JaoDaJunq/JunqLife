# Revisão T001

## Estado
Fundação preparada para o repositório e projeto Supabase `JunqLife`.

## Decisões validadas
- React Native + Expo Development Build no mobile.
- Traccar Client SDK para captura/background GPS.
- Supabase Auth + PostgreSQL/PostGIS + Realtime.
- RLS habilitado em toda tabela pública da fundação.
- Funções privilegiadas de apoio ficam em `private`, fora do schema exposto.
- `service_role`/secret key nunca vai para o app.
- Escrita em `current_locations` e `location_history` é server-only via `location-ingest`.
- `circle_members.role` é separado de `circle_member_sharing`, evitando que o toggle de privacidade possa alterar autorização.
- Owner não pode remover a própria membership acidentalmente na V0.1.
- Dispositivo é vinculado ao usuário por integridade referencial e validado novamente na ingestão.

## Próximo marco
T002 + T003: autenticação/perfil e criação/entrada em círculos. Depois T004 conecta o Traccar SDK ao endpoint já preparado.

## Advisor Supabase
- Security advisor: sem lints após a fundação.
- Performance advisor: índices de FKs e initplan de `auth.uid()` corrigidos em `0002_performance_hardening.sql`.
