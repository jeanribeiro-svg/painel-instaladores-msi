# Painel de Instaladores MSI

Dashboard estático para GitHub Pages integrado à planilha Google Sheets.

## Planilha configurada

ID da planilha:

`1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg`

Aba `Softwares`:

- `Software`
- `Status`

GID configurado:

`474438347`

## Status padronizados

- Em Consulta
- Sem pacote oficial
- Disponível no \\Mídias

## Arquivos

- `index.html` — página do dashboard
- `style.css` — visual
- `script.js` — integração com Google Sheets e atualização automática
- `README.md` — instruções

## Publicação

1. Coloque os quatro arquivos na raiz do repositório GitHub.
2. Acesse `Settings > Pages`.
3. Em Source, escolha `Deploy from a branch`.
4. Selecione `main` e `/ (root)`.
5. Salve.
6. Garanta que a planilha esteja acessível/publicada para leitura pela página.

O dashboard consulta a planilha a cada 30 segundos.
