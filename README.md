# ATLAS — Assistente Pessoal Inteligente

Assistente pessoal com painel web, chat, entrada por voz no navegador, resposta falada e base para futuras integrações Windows. Esta versão inicial não executa comandos no computador nem altera sistemas externos.

## Requisitos
- Node.js 20.9 ou superior
- npm
- Opcional: chave da OpenAI para respostas de IA

## Executar no Windows
1. Instale o Node.js LTS: https://nodejs.org/
2. Clone o repositório e entre na pasta:
   ```powershell
   git clone https://github.com/enatneuroeducacao-glitch/ATLAS.git
   cd ATLAS
   npm install
   ```
3. Opcional: copie `.env.example` para `.env.local` e configure `OPENAI_API_KEY`. Nunca publique a chave.
4. Execute `npm run dev` e abra http://localhost:3000.

## Render
Crie um Web Service Node ligado ao repositório. Build: `npm install && npm run build`. Start: `npm start`. Configure `OPENAI_API_KEY` como variável secreta no Render, nunca no GitHub.

## Estado inicial
- Painel responsivo
- Chat no servidor
- Entrada de voz via Web Speech API quando suportada
- Resposta falada via Speech Synthesis
- Tarefas temporárias nesta sessão
- Endpoint `/api/health`
- Sem execução de comandos locais ou ações externas

## Próximas etapas
1. Validar build e implantação.
2. Adicionar autenticação antes de expor dados reais.
3. Persistir conversas e tarefas em PostgreSQL.
4. Adicionar auditoria persistente e permissões por ferramenta.
5. Criar agente Windows separado, com permissões mínimas e confirmação para ações críticas.

## Segurança
Não salve tokens, senhas, chaves API ou arquivos `.env` no repositório. Antes de expor a aplicação publicamente com dados reais, implemente autenticação e limites de uso.