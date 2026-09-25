# T015 - Aviso de atualização no APK

## Objetivo
Fazer o aplicativo informar quando existe uma Release Android mais nova sem obrigar o usuário a verificar a Central manualmente.

## Fluxo
- APK consulta a release pública mais recente do repositório;
- compara semanticamente a versão instalada com a tag publicada;
- se houver versão mais nova, exibe um card no início;
- botão abre a Central JunqLife;
- falha de rede/GitHub é silenciosa e nunca bloqueia o aplicativo.

## Segurança e privacidade
- nenhuma credencial é enviada ao GitHub;
- usa somente API pública de releases;
- não instala APK automaticamente;
- usuário continua controlando quando baixar/instalar a atualização.
