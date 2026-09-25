# T018 - Avatar de perfil

## Objetivo
Fechar a pendência de foto de perfil da V0.1 sem adicionar permissões ou bibliotecas de galeria ao APK.

## Fluxo
- a foto é escolhida na Central web;
- formatos aceitos: JPG, PNG e WebP;
- limite de 5 MB;
- o arquivo é salvo em `avatars/<user_id>/<arquivo>`;
- somente o usuário autenticado pode gravar ou apagar dentro da própria pasta;
- o bucket é público apenas para leitura das fotos;
- `profiles.avatar_path` guarda somente o caminho do objeto;
- o app resolve a URL pública em tempo de execução.

## Interface
- Central: adicionar/trocar foto;
- gestão do círculo: exibir avatar;
- mapa: exibir avatar na ficha, lista de membros e marcador nativo;
- fallback continua sendo as iniciais quando não existe foto.

## Segurança
O cliente nunca recebe chave privilegiada. Upload e remoção usam a sessão autenticada e políticas RLS do Storage.
