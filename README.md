# Catálogo de softwares — v53

Dashboard estático para GitHub Pages, com dados consultados da aba `Softwares` do Google Sheets por meio do CSV publicado.

## Estrutura obrigatória da planilha

A aba `Softwares` deve ter somente estes quatro campos, nesta ordem:

1. `Software`
2. `Status`
3. `Link Download / pasta da rede`
4. `Link de instruções para .msi, deploy em rede ou instalação silenciosa`

O JavaScript localiza as colunas pelo cabeçalho e lê os quatro campos da planilha. A coluna C aceita um link de download oficial ou um caminho UNC real, como `\\servidor\compartilhamento\software`. Não crie caminhos genéricos. A coluna D deve conter um link oficial que documente implantação, MSI, instalação em rede ou instalação silenciosa; texto explicativo sem referência oficial não é exibido como instrução.

Softwares comerciais ou que exigem plano/licença paga ficam sem link de download na coluna C. Um link de documentação de implantação pode permanecer na coluna D. Quando não há documentação oficial específica de implantação, o status fica `Em consulta`; não use `Deploy via orientação do fabricante` com base somente em página de produto ou download comum.

O catálogo consulta apenas a URL CSV publicada configurada em `script.js`. O botão Atualizar e o intervalo automático compartilham uma requisição quando coincidem, evitando respostas concorrentes. A atualização ocorre a cada 30 segundos.

## Status usados

- `Em consulta`
- `Disponível no Mídias`
- `Disponível pelo Fabricante`
- `Deploy via orientação do fabricante`
- `Sem solução oficial`

Na interface, os dois status de disponibilidade são exibidos como `Disponível` e reunidos no mesmo filtro.

## Publicação

1. Importe `Catalogo_softwares_4_colunas_revisado.xlsx` no documento atual do Google Sheets e substitua os dados da aba `Softwares` existente. Mantenha o mesmo documento e a mesma aba publicada; não exclua a aba para criar outra, pois a URL CSV usa o identificador dela.
2. Confirme a ordem dos quatro cabeçalhos e publique a aba como CSV.
3. Publique `index.html`, `script.js`, `style.css` e este README no GitHub Pages.
4. Verifique na página o indicador `Conectado` e a contagem de registros.

O projeto não tem uma sessão conectada ao Google Sheets e não pode gravar diretamente na planilha online. A cópia revisada deve ser importada e republicada manualmente. A URL CSV configurada no JavaScript foi mantida. As abas auxiliares `Listas` e `Midias` foram preservadas; a lista de mídias não inclui softwares pagos.
