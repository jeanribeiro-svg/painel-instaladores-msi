# Painel de Instaladores MSI

Dashboard estático para GitHub Pages, alimentado pela aba `Softwares` do Google Sheets.

## Fonte de dados configurada

https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv

## Estrutura esperada

A primeira linha da aba publicada deve conter exatamente:

- `Software`
- `Status`

Os status esperados são:

- `Em Consulta`
- `Sem pacote oficial`
- `Disponível no \\Mídias`

## Atualização

O painel consulta a planilha automaticamente a cada 30 segundos e usa um parâmetro de timestamp para evitar cache do navegador.

## Publicação no GitHub Pages

1. Extraia os arquivos.
2. Coloque `index.html`, `style.css`, `script.js` e `README.md` no repositório.
3. Em **Settings → Pages**, selecione a branch/pasta usada pelo projeto.
4. Acesse a URL fornecida pelo GitHub Pages.

## Se a página ficar sem dados

Abra o console do navegador (F12 → Console). O painel também apresenta uma mensagem de erro na própria página.

A URL configurada é uma publicação CSV do Google Sheets, portanto a planilha precisa continuar publicada na web e a aba `Softwares` precisa manter os cabeçalhos `Software` e `Status`.
