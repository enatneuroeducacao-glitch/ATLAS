# ATLAS II — Instrutor Inteligente

Assistente especializado em trânsito, legislação, formação de condutores e instrutores, neuroeducação e segurança viária. O chat utiliza Google Gemini. A resposta falada prioriza Gemini 3.8 Flash-Lite TTS, com orientação de voz masculina adulta, grave, firme e natural em português brasileiro. O Piper auto-hospedado permanece como alternativa quando a voz neural estiver indisponível. A entrada por voz utiliza Web Speech API do navegador.

## Evolução ATLAS JARVIS

A arquitetura técnica híbrida, política de autonomia, segurança, persistência, ponte local Windows e roadmap estão documentados em [docs/ATLAS-JARVIS-ARQUITETURA.md](docs/ATLAS-JARVIS-ARQUITETURA.md). Este documento é o plano de referência; as fases serão implementadas em PRs pequenos e independentes, preservando as funcionalidades atuais.

## Requisitos
- Node.js 20.9 ou superior
- npm
- Chave Google Gemini API com acesso ao nível gratuito
- Serviço Piper opcional, para contingência local/auto-hospedada

## Variáveis de ambiente
Configure no Render (ou em `.env.local` no desenvolvimento):

- `GEMINI_API_KEY`: chave da Google Gemini API.
- `GEMINI_MODEL`: modelo usado para respostas do chat.
- `GEMINI_TTS_MODEL`: opcional; padrão `gemini-3.8-flash-lite-tts`.
- `GEMINI_TTS_VOICE`: opcional; padrão `Orus`.
- `PIPER_TTS_URL`: URL base do serviço Piper, sem barra final.
- `PIPER_API_TOKEN`: token compartilhado entre ATLAS e Piper. Nunca grave o segredo no GitHub.

## Política de custo
A integração de voz não chama provedores pagos alternativos. O Gemini TTS deve ser usado somente dentro do nível gratuito e das cotas disponíveis na chave. Ao atingir limites gratuitos, o ATLAS tenta o Piper auto-hospedado; se ele não estiver disponível, mantém a resposta escrita e informa que o áudio não pôde ser gerado. Não configure faturamento pago para esta homologação. A disponibilidade e os limites gratuitos podem mudar conforme o Google.

A camada gratuita do Gemini API pode usar o conteúdo enviado para melhorar os produtos do Google, conforme os termos do serviço. Não envie dados pessoais sensíveis ou informações confidenciais para síntese de voz.

## Render
No serviço principal, mantenha `GEMINI_API_KEY` e configure opcionalmente `GEMINI_TTS_MODEL` e `GEMINI_TTS_VOICE`. Para fallback Piper, mantenha `PIPER_TTS_URL` e `PIPER_API_TOKEN` configurados também no serviço Piper.

## Verificação
- `GET /api/health`: informa configuração do chat e do mecanismo de voz sem revelar segredos.
- `POST /api/chat`: gera respostas com Gemini.
- `POST /api/tts`: gera WAV com Gemini TTS; usa Piper somente como contingência.
