# ATLAS II — Instrutor Inteligente

Assistente especializado em trânsito, legislação, formação de condutores e instrutores, neuroeducação e segurança viária. O chat utiliza Google Gemini; a resposta falada usa Piper TTS em serviço separado no Render. A entrada por voz utiliza Web Speech API do navegador.

## Requisitos
- Node.js 20.9 ou superior
- npm
- Chave da Google Gemini API
- Serviço Piper TTS acessível por HTTPS

## Variáveis de ambiente
Configure no Render (ou em `.env.local` no desenvolvimento):

- `GEMINI_API_KEY`: chave da Google Gemini API.
- `GEMINI_MODEL`: modelo Gemini, padrão `gemini-3.8-flash`.
- `PIPER_TTS_URL`: URL base privada/pública do serviço Piper, sem barra final.
- `PIPER_API_TOKEN`: token compartilhado entre o serviço ATLAS e o serviço Piper. Use o mesmo segredo nos dois serviços; nunca o grave no GitHub.

## Executar localmente
1. Instale Node.js LTS.
2. Clone o repositório e execute `npm install`.
3. Copie `.env.example` para `.env.local` e preencha as variáveis.
4. Execute `npm run dev` e abra http://localhost:3000.

## Render
O Web Service principal usa `npm install && npm run build` e `npm start`. Configure `GEMINI_API_KEY`, `GEMINI_MODEL`, `PIPER_TTS_URL` e `PIPER_API_TOKEN` no serviço principal. Configure o mesmo `PIPER_API_TOKEN` no serviço Docker `atlas-piper-tts-test`. O serviço Piper utiliza o modelo português brasileiro `pt_BR-faber-medium` por padrão.

## Verificação
- `GET /api/health`: informa se a chave Gemini e a ligação Piper estão configuradas, sem revelar segredos.
- `POST /api/chat`: gera respostas com Gemini.
- `POST /api/tts`: gera WAV através do serviço Piper.
- O navegador oferece Speech Synthesis como alternativa se o Piper estiver indisponível.

## Segurança
Não salve tokens, senhas, chaves API ou arquivos `.env` no repositório. Use tokens longos e aleatórios e mantenha a autenticação entre os serviços.
