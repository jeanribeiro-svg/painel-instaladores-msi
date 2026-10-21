# Catálogo de softwares — v51

Dashboard HTML estático para GitHub Pages, alimentado por uma publicação CSV do Google Sheets.

## Estrutura da planilha

A aba `Softwares` utiliza estas colunas:

1. `Software`
2. `Status`
3. `Link / rede`
4. `Exemplo de comando de instalação`
5. `Download oficial`
6. `Instruções oficiais`

O dashboard lê nome, status, links e comando diretamente do CSV publicado do Google Sheets. Os campos de download e de instruções são independentes e identificados pelo cabeçalho, não pela posição da coluna. Assim, mover `Download oficial` para a coluna C e excluir uma coluna intermediária não troca os dados, desde que os cabeçalhos `Download oficial` (ou `Link de download`) e `Instruções oficiais` continuem corretos. Uma URL de `Link / rede` não é promovida automaticamente a download; caminhos de rede permanecem distintos.

O navegador consulta somente a URL CSV publicada configurada em `script.js`. Não há consulta alternativa `gviz`, para evitar que respostas com versões ou formatos diferentes da publicação se alternem. Se o botão Atualizar e a atualização automática coincidirem, a página compartilha a mesma requisição em andamento.

## Comando de instalação

A coluna deve conter um exemplo de comando CMD ou PowerShell para instalação silenciosa, preferencialmente com instalação para todos os usuários (`ALLUSERS`) quando o instalador suportar esse parâmetro.

Os links para downloads e instruções oficiais permanecem clicáveis, e os caminhos de rede aparecem como texto. Uma mesma URL não é mostrada duas vezes como download e instrução. O botão de cópia fica disponível somente para exemplos de comandos de instalação.

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

Os comandos são modelos: substitua nomes de arquivo, versões, caminhos de rede e opções de licença/organização antes de publicar uma automação no Zoho Endpoint Manager. Valide cada pacote com um grupo piloto. Em especial, Office/Visio/Project exigem XML do Office Deployment Tool adequado à edição e licença; Docker Desktop possui requisitos e condições de licenciamento próprios; Visual Studio requer um layout de rede com os workloads aprovados. Produtos comerciais podem ficar sem referências públicas no catálogo, conforme a política deste levantamento. Quando o fornecedor não documenta implantação gerenciada, silenciosa ou por rede, o status deve ficar `Em consulta` para análise manual; não basta existir uma página de download ou um instalador comum para classificar como `Deploy via orientação do fabricante`.

Após importar a planilha revisada no Google Sheets, publique a aba `Softwares` como CSV e confirme que a publicação inclui as seis colunas. O site volta a acompanhar a planilha a cada 30 segundos. Publique também os arquivos atualizados no GitHub Pages para aplicar a mudança do leitor.
