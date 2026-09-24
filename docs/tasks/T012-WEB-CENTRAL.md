# T012 - Central JunqLife

## Objetivo
Transformar o GitHub Pages na central oficial de conta e distribuição do JunqLife.

## Fluxo
1. pessoa acessa a Central;
2. cria conta no web;
3. confirma o e-mail;
4. retorna autenticada à Central;
5. completa/edita o nome de perfil;
6. baixa o APK oficial;
7. instala e faz login novamente no app.

## Distribuição Android
- o workflow Android cria uma GitHub Release com a versão do app;
- o asset público se chama sempre `JunqLife.apk`;
- a Central consulta a release mais recente pela API pública do GitHub;
- fallback estável: `/releases/latest/download/JunqLife.apk`;
- o APK não fica versionado dentro do repositório.

## Separação de responsabilidades
### Web
- cadastro;
- confirmação/recuperação de conta;
- perfil básico;
- versão/download;
- changelog e instruções.

### App
- login;
- círculos;
- tracking;
- mapa;
- Places e demais recursos móveis.

## Segurança
- web usa somente a chave pública do Supabase;
- download só é liberado na UI depois de sessão confirmada;
- service role continua fora do cliente;
- releases são públicas porque o repositório é público e o APK já era distribuído como artefato de teste.
