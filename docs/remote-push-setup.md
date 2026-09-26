# Push remoto do JunqLife

O código do envio está em `supabase/functions/place-event-push/index.ts`.

## Configuração necessária

1. Criar ou vincular o projeto Expo/EAS e adicionar o `extra.eas.projectId` no `app.json`.
2. Criar um Expo Access Token com Enhanced Security for Push Notifications.
3. Salvar o token como secret `EXPO_ACCESS_TOKEN` na Edge Function.
4. Criar um Database Webhook no Supabase para `public.place_events`, evento `INSERT`, apontando para `place-event-push`.
5. O webhook usa o header privado `x-junqlife-webhook-secret`, armazenado na tabela protegida `push_webhook_secrets`.

A função usa a chave secreta apenas no servidor para consultar membros e tokens. Ela nunca é incluída no APK ou no Pages.
