# Painel de Instaladores MSI — v42

Dashboard HTML estático para GitHub Pages, alimentado por uma publicação CSV do Google Sheets.

## Estrutura da planilha

A aba `Softwares` utiliza estas colunas:

1. `Software`
2. `Status`
3. `LINK`
4. `Exemplo de comando de instalação`

O dashboard exibe a quarta coluna com o nome `Comando de instalação`.

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

O catálogo oferece links clicáveis de download/origem e de instruções oficiais. A página adiciona referências verificadas para alguns softwares comuns quando a planilha não tem endereço ou comando. Para esses produtos, o status `Deploy via orientação do fabricante` passa a ser calculado no navegador, pois a instalação depende de parâmetros ou layout próprio do fornecedor.

Os comandos são modelos: substitua nomes de arquivo, versões, caminhos de rede e opções de licença/organização antes de publicar uma automação no Zoho Endpoint Manager. Valide cada pacote com um grupo piloto. Em especial, Office/Visio/Project exigem XML do Office Deployment Tool adequado à edição e licença; Docker Desktop possui requisitos e condições de licenciamento próprios; Visual Studio requer um layout de rede com os workloads aprovados.

A lista `DEPLOY_GUIDES` fica no início da função de renderização em `script.js`. As entradas locais são complementos ao conteúdo publicado no Google Sheets; para que a equipe veja as alterações do site, publique os arquivos atualizados no GitHub Pages. Se preferir manter toda a curadoria na planilha online, copie para lá os endereços e comandos correspondentes.
