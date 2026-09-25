# Painel de Instaladores MSI — SESI / SENAI SC

Dashboard HTML estático para acompanhar, em tempo quase real, a disponibilidade de instaladores MSI a partir de uma Google Planilha.

## Estrutura

```text
instaladores-msi/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 1. Prepare a Google Planilha

Crie uma planilha com uma aba contendo **exatamente estas colunas na primeira linha**:

| Software | Regional | Status |
|---|---|---|
| Android Studio | Vale do Itajaí | Em Consulta |
| AutoCAD | Norte | Disponível no \Mídias |
| Software Exemplo | Oeste | Sem pacote oficial |

### Status padronizados

Use preferencialmente exatamente:

- `Em Consulta`
- `Sem pacote oficial`
- `Disponível no \Mídias`

O painel também tenta normalizar variações simples de acentuação e capitalização.

> Recomenda-se manter uma linha por software/regional. Se o mesmo software tiver utilização em várias regionais, pode haver uma linha para cada regional.

## 2. Publique a planilha como CSV

Na Google Planilha:

**Arquivo → Compartilhar → Publicar na web**

Depois:

1. Selecione a aba que será usada pelo painel.
2. Escolha o formato **Valores separados por vírgula (.csv)**.
3. Clique em **Publicar**.
4. Copie a URL gerada.

A URL normalmente terá um formato semelhante a:

```text
https://docs.google.com/spreadsheets/d/e/SEU_ID/pub?output=csv
```

## 3. Configure o JavaScript

Abra `script.js` e localize:

```javascript
const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "COLE_AQUI_A_URL_CSV_DA_GOOGLE_PLANILHA",
  REFRESH_INTERVAL_MS: 30000
};
```

Substitua o valor pela URL copiada:

```javascript
const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/SEU_ID/pub?output=csv",
  REFRESH_INTERVAL_MS: 30000
};
```

`30000` significa **30 segundos**.

Exemplos:

```javascript
REFRESH_INTERVAL_MS: 15000 // 15 segundos
REFRESH_INTERVAL_MS: 30000 // 30 segundos
REFRESH_INTERVAL_MS: 60000 // 1 minuto
```

## 4. Teste localmente

Não é obrigatório usar servidor local, mas é recomendado.

No Windows, se tiver Python instalado:

```powershell
py -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

Se o navegador bloquear a leitura da planilha quando aberto diretamente como `file://`, use o servidor local.

## 5. Publicar no GitHub Pages

Crie um repositório, por exemplo:

```text
instaladores-msi
```

Envie os quatro arquivos para a raiz do repositório.

No GitHub:

**Settings → Pages**

Em **Build and deployment**:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

Salve.

O GitHub fornecerá uma URL semelhante a:

```text
https://SEU-USUARIO.github.io/instaladores-msi/
```

## 6. Como funciona a atualização

O navegador consulta a URL CSV da Google Planilha automaticamente.

Fluxo:

```text
Líderes de TI
     ↓
Google Planilha
     ↓
Publicação CSV
     ↓
Dashboard HTML
     ↓
GitHub Pages
```

O dashboard faz uma nova consulta a cada 30 segundos e recalcula:

- total de softwares;
- quantidade em consulta;
- quantidade sem pacote oficial;
- quantidade disponível em `\Mídias`;
- percentuais;
- progresso da ação;
- distribuição por status;
- quantidade por regional;
- tabela;
- filtros e pesquisa.

## 7. Importante sobre "tempo real"

Este projeto não usa WebSocket. Ele utiliza **polling**, ou seja, consulta a planilha periodicamente.

Com:

```javascript
REFRESH_INTERVAL_MS: 30000
```

a atualização ocorre a cada 30 segundos.

Isso é suficiente para acompanhamento operacional sem exigir servidor ou banco de dados.

## 8. Privacidade e acesso

Ao usar **Publicar na web**, os dados daquela aba ficam acessíveis pela publicação do Google.

Portanto, não coloque na planilha:

- informações pessoais desnecessárias;
- senhas;
- chaves;
- dados confidenciais;
- caminhos de rede que não devam ser divulgados;
- informações protegidas.

Para um painel institucional público, considere publicar apenas os dados necessários:

```text
Software | Regional | Status
```

## 9. Personalização

As principais alterações visuais ficam em:

```text
style.css
```

A lógica do painel fica em:

```text
script.js
```

A estrutura da página fica em:

```text
index.html
```

## 10. Futuras extensões

O projeto pode ser evoluído para incluir:

- filtro SESI / SENAI;
- regional e unidade;
- responsável pela consulta;
- data da solicitação;
- fabricante;
- versão do software;
- arquitetura x64/x86;
- link para o instalador;
- localização na `\Mídias`;
- indicador de softwares prioritários;
- histórico de evolução;
- gráfico por regional;
- exportação CSV;
- autenticação;
- banco de dados;
- atualização via API;
- integração com Power BI.

---

## Licença

Uso interno/institucional. Ajuste conforme as políticas da organização antes de disponibilizar externamente.
