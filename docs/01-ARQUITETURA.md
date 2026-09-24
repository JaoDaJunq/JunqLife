# Arquitetura

```text
React Native / Expo Dev Build
        |
        | Traccar Client SDK
        v
Supabase Edge Function: location-ingest
        |
        +--> current_locations
        +--> location_history
        |
        v
Supabase Realtime
        |
        v
MapLibre no app dos membros autorizados
```

## Componentes

### Mobile
Responsável por permissões, consentimento, captura de GPS, buffer offline e envio.

### Tracking SDK
Traccar Client SDK. Não é fonte de autorização. Ele apenas coleta/envia dados de localização.

### Edge Function
Recebe posição de usuário autenticado. Nunca aceita `user_id` arbitrário como autoridade; identidade vem do JWT.

### Banco
Postgres + PostGIS. RLS é a barreira principal para impedir leitura cruzada entre círculos.

### Realtime
Usado para refletir alterações de `current_locations`. Histórico não precisa ser transmitido continuamente.

## Decisão para V0.1
Não instalar Traccar Server. O SDK envia para nosso endpoint. Traccar Server fica como opção futura se precisarmos de processamento avançado, protocolos adicionais, geofences server-side ou integração com trackers físicos.
