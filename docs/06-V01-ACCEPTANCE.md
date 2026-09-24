# JunqLife V0.1 - Checklist de aceite

Legenda:
- ✅ validado
- 🧪 implementado e ainda precisa de teste físico/UX
- ⏳ pendente

## Conta e autenticação
- ✅ cadastro web via Central JunqLife
- ✅ confirmação de e-mail
- ✅ login Android
- ✅ recuperação de senha web
- ✅ sessão órfã de usuário apagado é descartada
- ✅ profile criado automaticamente no signup
- ✅ edição do nome pela Central
- ⏳ avatar de perfil

## Círculos
- ✅ criar círculo
- ✅ entrar por convite
- ✅ owner/member no banco
- ✅ admin implementado por Edge Function autenticada
- 🧪 promover/rebaixar admin pela UI
- ✅ listar membros
- 🧪 remover membro pela UI
- 🧪 membro sair do círculo pela UI
- ✅ transferência de owner testada atomicamente no banco
- 🧪 transferência de owner pela UI

## Consentimento e privacidade
- ✅ sharing inicia desligado
- ✅ sharing independente por círculo
- ✅ sharing OFF remove a posição do usuário da visão de outro membro no RLS
- ✅ outsider sem membership vê zero posições
- ✅ buffered point gravado enquanto sharing estava OFF é descartado
- ✅ service role permanece fora do cliente

## Localização Android
- ✅ Traccar SDK carregado no APK real
- ✅ device registration
- ✅ posição GPS real recebida
- ✅ current_locations
- ✅ location_history
- ✅ bateria
- ✅ precisão
- ✅ upload com retry
- ✅ tracking contínuo observado por ~4h no aparelho real
- 🧪 tela bloqueada por período prolongado
- 🧪 perda e retorno de internet
- 🧪 app encerrado pelo usuário/sistema

## Mapa
- ✅ MapLibre nativo
- ✅ posição real do usuário
- ✅ rota do dia
- ✅ distância e pontos
- ✅ dois usuários reais possuem current_location
- ✅ RLS permite os dois membros compartilhando se enxergarem
- ✅ RLS bloqueia outsider de current_locations
- ✅ sharing OFF remove a posição do segundo usuário da visão do owner
- ✅ histórico entre membros autorizado pelo círculo
- ✅ outsider recebe zero pontos do histórico
- 🧪 comprovar visualmente os dois marcadores em dois aparelhos simultaneamente
- ✅ pan/zoom/rotate/pitch e controles de mapa
- ✅ Places visuais com raio
- 🧪 UX de criação/exclusão de Place em uso real prolongado

## Distribuição
- ✅ GitHub Pages como Central JunqLife
- ✅ APK deixa cadastro/recuperação na Central
- 🧪 GitHub Release automática com JunqLife.apk
- 🧪 botão de download da Central apontando para a Release mais recente
- ⏳ aviso de atualização dentro do APK

## Fora da V0.1
- ⏳ eventos de entrada/saída em Places
- ⏳ notificações
- ⏳ timeline completa do histórico
- ⏳ retenção de histórico
- ⏳ iOS/TestFlight
- ⏳ suíte automatizada de regressão de RLS/Auth
