# T016 - Filtros de workflows

## Problema
Qualquer push na main disparava build Android, deploy do Pages e testes locais do Supabase, inclusive mudanças que não afetavam essas superfícies.

## Ajuste
- Android roda apenas quando app/src/plugins/config/package/workflow Android mudarem;
- Pages roda apenas quando app/src/config/package/workflow Pages mudarem;
- testes de banco rodam apenas quando migrations/tests/config/workflow do banco mudarem;
- workflow_dispatch continua disponível para execução manual.

## Resultado esperado
- menos builds Android descartáveis;
- menos pulls de containers do Supabase;
- menos cancelamentos por concurrency;
- feedback de CI mais rápido e barato.
