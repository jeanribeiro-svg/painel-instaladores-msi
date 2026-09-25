# Painel de Instaladores MSI

Dashboard estático para GitHub Pages, alimentado pela planilha Google Sheets.

## Fonte de dados
- Aba: `Softwares`
- Colunas: `Software` e `Status`
- Status esperados: `Em Consulta`, `Sem pacote oficial`, `Disponível no \\Mídias`

## Carregamento dos dados
O painel tenta primeiro o CSV publicado no Google Sheets. Se o navegador bloquear a requisição por CORS ou houver falha no CSV, ele tenta uma segunda forma de leitura usando a API pública de visualização do Google Sheets (JSONP). Isso evita que o painel fique indefinidamente em “Carregando...”.

Se a planilha estiver vazia, o painel continua funcionando e informa a situação. Se uma atualização falhar depois de dados já terem sido carregados, os dados anteriores permanecem na tela.

## Publicação
Envie os quatro arquivos para o repositório do GitHub Pages e mantenha `index.html` na raiz.
