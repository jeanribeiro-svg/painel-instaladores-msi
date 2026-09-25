# Painel de Instaladores MSI

Painel web para acompanhamento dos softwares e da disponibilidade de instaladores MSI.

## Fonte de dados

A fonte principal é a publicação CSV da aba `Softwares` do Google Sheets.

O painel possui um segundo caminho de consulta usando o Google Visualization (JSONP). Esse fallback foi reforçado para aceitar corretamente respostas em que o Google retorna os identificadores das colunas (`A`, `B`) em vez dos nomes `Software` e `Status`.

Estrutura esperada:

- Coluna A: `Software`
- Coluna B: `Status`

Status esperados:

- `Em Consulta`
- `Sem pacote oficial`
- `Disponível no \\Mídias`

## Atualização

- Atualização automática a cada 30 segundos.
- Botão **Atualizar agora** para consulta manual.
- A tela informa se a conexão ocorreu pelo CSV ou pelo Google Sheets.
- Se uma atualização posterior falhar, os últimos dados carregados permanecem no painel.

## Publicação no GitHub Pages

Extraia os arquivos e publique a pasta no GitHub Pages. Não é necessário servidor próprio.
