# Painel de Instaladores MSI — versão robusta

## Fonte CSV

https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv

## Comportamento em caso de falha

O painel foi preparado para **não ficar em branco**:

- Se a planilha estiver vazia, os indicadores aparecem como `0` e a tabela informa que não há softwares cadastrados.
- Se a planilha estiver temporariamente indisponível antes do primeiro carregamento, o painel mostra uma mensagem e continua tentando.
- Se uma atualização posterior falhar, os dados anteriormente carregados são mantidos na tela.
- Existe timeout de 10 segundos para evitar carregamento indefinido.
- Erros de HTTP, CSV vazio e cabeçalhos incorretos são apresentados na própria página.
- A atualização automática continua a cada 30 segundos.

## Estrutura da planilha

A aba publicada deve possuir os cabeçalhos:

`Software` | `Status`

Status esperados:

- `Em Consulta`
- `Sem pacote oficial`
- `Disponível no \\Mídias`
