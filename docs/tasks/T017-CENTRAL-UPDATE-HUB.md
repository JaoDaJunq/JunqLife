# T017 - Hub de atualizações da Central

## Objetivo
Transformar a Central JunqLife em um ponto permanente de distribuição e histórico de versões.

## Entregue
- consulta das 5 releases públicas mais recentes;
- versão, data e tamanho do APK atual;
- changelog exibido dentro da Central;
- link para a release completa no GitHub;
- instruções de instalação/atualização no Android;
- fallback de download continua funcionando se a API de releases falhar;
- novas releases Android passam a usar notas automáticas do GitHub.

## Regra de distribuição
- o asset oficial continua se chamando `JunqLife.apk`;
- a release correspondente usa a versão definida em `app.json`;
- uma rebuild da mesma versão substitui somente o APK e preserva as notas;
- uma versão inédita recebe notas automáticas baseadas nas mudanças desde a release anterior.
