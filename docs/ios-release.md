# Release iOS do JunqLife

O workflow `.github/workflows/ios-build.yml` dispara uma build iOS de produção no EAS sempre que uma alteração relevante chega à `main`.

## Pré-requisito do GitHub

O repositório precisa ter o secret de Actions `EXPO_TOKEN`, contendo um token pessoal do Expo com acesso ao projeto `JunqLife`. O valor nunca deve ser colocado no código ou no Supabase.

## TestFlight

A build gera o `.ipa` na infraestrutura do EAS. Para disponibilizá-la no iPhone, o projeto também precisa ter as credenciais Apple configuradas em `eas credentials --platform ios` e uma submissão para TestFlight via EAS Submit/App Store Connect. A build não publica automaticamente na App Store.
