# Painel de Instaladores MSI — v43

Dashboard HTML estático para GitHub Pages, alimentado por uma publicação CSV do Google Sheets.

## Estrutura da planilha

A aba `Softwares` utiliza estas colunas:

1. `Software`
2. `Status`
3. `Link / rede`
4. `Exemplo de comando de instalação`
5. `Download oficial`
6. `Instruções oficiais`

O dashboard lê nome, status, links e comando diretamente dessas colunas no CSV publicado do Google Sheets. A coluna `LINK` continua sendo usada para caminho de rede ou link legado; os dois novos campos oferecem separadamente a página oficial e as instruções.

## Comando de instalação

A coluna deve conter um exemplo de comando CMD ou PowerShell para instalação silenciosa, preferencialmente com instalação para todos os usuários (`ALLUSERS`) quando o instalador suportar esse parâmetro.

O dashboard disponibiliza o botão `Copiar comando` para copiar o comando integralmente.

Exemplos:

```cmd
msiexec /i "\\servidor\mídias\Software\software.msi" /qn ALLUSERS=1
```

```powershell
Start-Process ".\setup.exe" -ArgumentList "/S" -Wait
```

Os parâmetros devem ser definidos conforme a documentação do fabricante; não se deve assumir que todo instalador aceita `ALLUSERS=1`.

## Status aceitos

- `Em Consulta`
- `Disponível no Mídias`
- `Disponível pelo Fabricante`
- `Deploy via orientação do fabricante`
- `Sem solução oficial`

## Filtros

Os cards superiores funcionam como filtros rápidos. O card `Total` representa todos os registros e permanece destacado quando nenhum filtro de status está aplicado.

## Referências de implantação

O catálogo oferece links clicáveis que são lidos das colunas `Download oficial` e `Instruções oficiais` da planilha. O JavaScript não acrescenta mais produtos, status, links ou comandos que não estejam na fonte publicada.

Os comandos são modelos: substitua nomes de arquivo, versões, caminhos de rede e opções de licença/organização antes de publicar uma automação no Zoho Endpoint Manager. Valide cada pacote com um grupo piloto. Em especial, Office/Visio/Project exigem XML do Office Deployment Tool adequado à edição e licença; Docker Desktop possui requisitos e condições de licenciamento próprios; Visual Studio requer um layout de rede com os workloads aprovados. Produtos comerciais podem ficar sem referências públicas no catálogo, conforme a política deste levantamento. Quando o fornecedor não documenta instalação silenciosa, a coluna de comando informa essa limitação em vez de presumir parâmetros.

Após importar a planilha revisada no Google Sheets, publique a aba `Softwares` como CSV e confirme que a publicação inclui as seis colunas. O site volta a acompanhar a planilha a cada 30 segundos. Publique também os arquivos atualizados no GitHub Pages para aplicar a mudança do leitor.
