# Painel de Instaladores MSI — v10

## Configuração
- Google Sheet ID: 1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg
- Softwares GID: 474438347
- Midias GID: 728409259

## Estrutura da aba Midias
A primeira linha deve conter exatamente:
`Software | Tipo | Link | Observação`

## Publicação do Google Sheets
A aba `Midias` precisa estar publicada na Web. Se o documento já estava publicado antes de a aba `Midias` ser criada, abra **Arquivo > Compartilhar > Publicar na web**, selecione a publicação do documento/abas e publique novamente.

Se apenas a aba `Softwares` estiver publicada, o CSV da `Midias` não ficará disponível para o GitHub Pages.


A versão v12 corrige a conversão de caminhos UNC (\\servidor\pasta) para file://servidor/pasta e usa ação de abertura específica para caminhos de rede.
