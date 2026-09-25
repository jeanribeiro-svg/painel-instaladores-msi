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


### v4
Esta versão usa um nome de script novo (`script-v4.js`) e um parâmetro de versão no carregamento para evitar que o navegador/GitHub Pages mantenha o JavaScript antigo em cache. O CSV também aceita cabeçalhos genéricos A/B, tratando A como Software e B como Status.


### v5
- Remove automaticamente a linha de cabeçalho `Software | Status` caso ela seja retornada como dado.
- Normaliza os status para que variações de espaços, maiúsculas/minúsculas e barra invertida não quebrem a contagem.
- O dashboard conta os status canônicos e alimenta cards, progresso, gráfico e filtro.


## Página Mídias / Downloads

A versão 6 adiciona a página **Mídias / Downloads**, alimentada pela aba `Midias` do mesmo Google Sheets.

Crie a aba `Midias` com exatamente estas colunas:

`Software | Tipo | Link | Observação`

A página permite pesquisar por software, filtrar por tipo e abrir o endereço informado. URLs HTTP/HTTPS são abertas em nova aba. Caminhos de rede UNC (`\\servidor\pasta`) são convertidos para `file://` quando o navegador permitir.

Por padrão, o painel tenta localizar a aba pelo nome `Midias`. Se preferir usar o GID da aba, preencha `GOOGLE_SHEET_MIDIAS_GID` no `script-v6.js`.
