# Painel de Instaladores MSI — v38

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
