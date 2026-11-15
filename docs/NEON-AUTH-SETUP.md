# Integração de autenticação do ATLAS

## Arquitetura

- Identidade e sessões: Neon Auth (Managed Better Auth), no projeto exclusivo `atlas-assistant-db`.
- Login social: Google, atualmente com credenciais compartilhadas do Neon (somente desenvolvimento/homologação).
- Aplicação: Next.js no Render.
- Acesso: páginas privadas redirecionam para `/auth/sign-in`; endpoints de chat e TTS validam a sessão no servidor.
- O proxy de autenticação fica em `/api/auth/*`.

## Variáveis de ambiente no Render

Configurar no serviço `atlas-assistant`:

- `NEON_AUTH_BASE_URL`: URL base de autenticação do branch Neon.
- `NEON_AUTH_COOKIE_SECRET`: segredo aleatório com pelo menos 32 caracteres.

Nunca inserir esses valores em arquivos versionados. O segredo deve ser gerado e armazenado diretamente no Render.

## Pendências antes da liberação pública

1. Configurar SMTP institucional próprio no Neon Auth. O SMTP compartilhado do Neon é destinado à inicialização; produção exige provedor SMTP próprio.
2. Ativar verificação obrigatória de e-mail (OTP) e implementar/validar a tela de confirmação do código antes de liberar cadastros públicos.
3. Criar credenciais próprias de OAuth no Google Cloud e cadastrar o callback indicado pelo Neon Auth. Credenciais compartilhadas do Neon não são adequadas à produção.
4. Adicionar os domínios de preview ao allowlist do Neon Auth se forem usados.
5. Executar a homologação: cadastro, confirmação de e-mail, login, Google, logout, restauração da sessão, acesso direto às APIs sem sessão e recuperação de senha.

## Proteções de regressão

A alteração é aditiva. Não modificar a configuração do TTS, voz Gemini (incluindo Orus), fallback Piper, reconhecimento de voz, histórico local, AudioStudio ou VideoStudio. O script `npm run test:regression` contém verificações específicas dessas funcionalidades e das rotas de autenticação.
