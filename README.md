# Painel de Instaladores MSI — Google Sites + Google Sheets

Versão para hospedagem como **Web App do Google Apps Script** e incorporação em uma página do **Google Sites**.

## Estrutura

- `Code.gs` — acesso direto à planilha e serviço Web App.
- `Index.html` — dashboard completo, com HTML/CSS/JavaScript incorporados.
- `appsscript.json` — configuração do projeto Apps Script.
- `style.css` — cópia de referência do CSS da versão GitHub Pages.
- `script-original-v30.js` — cópia de referência da lógica anterior.

## Planilha utilizada

- ID: `1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg`
- Aba: `Softwares`
- GID: `474438347`

A primeira linha deve conter os cabeçalhos, incluindo:

`Software | Status | LINK`

O Apps Script localiza as colunas pelo nome, então a posição da coluna `LINK` pode mudar.

## Como publicar

1. Abra `https://script.google.com/` e crie um novo projeto.
2. Apague o código inicial e cole o conteúdo de `Code.gs`.
3. Crie um arquivo HTML chamado `Index` e cole o conteúdo de `Index.html`.
4. Em **Configurações do projeto**, confirme o fuso `America/Sao_Paulo`.
5. Salve o projeto.
6. Clique em **Implantar > Nova implantação**.
7. Selecione **Aplicativo da Web**.
8. Em **Executar como**, selecione **Eu**.
9. Em **Quem tem acesso**, selecione a opção compatível com o seu ambiente. Para um Google Sites interno da organização, normalmente é adequado permitir acesso aos usuários da organização.
10. Autorize o acesso à planilha quando solicitado.
11. Copie a URL que termina em `/exec`.

## Colocar no Google Sites

1. Abra o Google Sites.
2. Entre na página onde ficará o painel.
3. Selecione **Inserir > Incorporar**.
4. Informe a URL `/exec` do Web App.
5. Ajuste a largura/altura do bloco incorporado.
6. Publique o Google Sites.

## Funcionamento

O dashboard mantém a estrutura da versão v30:

- 5 contadores clicáveis funcionando como filtros;
- Total, Em Consulta, Sem pacote oficial, Disponível no Mídias e Disponível pelo Fabricante;
- gráfico de distribuição por status;
- percentual de disponibilidade no Mídias;
- pesquisa por software;
- tabela com Software, Status e LINK;
- cópia de caminhos UNC, mantendo as barras invertidas;
- atualização automática a cada 30 segundos;
- botão de atualização manual.

A diferença é que os dados agora são lidos diretamente pelo Apps Script usando `SpreadsheetApp`, em vez de depender do CSV publicado.

## Observação sobre permissões

O Web App precisa conseguir acessar a planilha. Como o código usa `SpreadsheetApp.openById()`, a implantação deve executar como a conta proprietária/autorizada do script. O nível de acesso do Web App deve ser compatível com o público do Google Sites.


### v33 — visualização consolidada
- Remove o gráfico de rosca redundante.
- Substitui os dois gráficos por uma única barra segmentada de distribuição do catálogo.
- Exibe Disponível como soma de Mídias + Fabricante.
- Exibe percentuais e quantidades de Disponível, Sem pacote oficial e Em Consulta.
- Mostra o detalhamento de Disponível: Mídias + Fabricante.
- O bloco de distribuição e os itens de status podem ser usados para filtrar a tabela.
- O card Disponível também filtra conjuntamente Mídias e Fabricante.
- O card Fabricante informa que sua quantidade já está incluída em Disponível, evitando interpretação de soma duplicada.
- Ajusta os cinco cards para caberem em uma única linha em telas amplas.

**Importante:** após substituir o código no Apps Script, faça uma nova implantação/atualização do Web App para que o Google Sites carregue a versão v33.
