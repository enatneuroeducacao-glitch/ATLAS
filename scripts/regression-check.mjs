import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => {
  assert.ok(existsSync(path), `Arquivo essencial ausente: ${path}`);
  return readFileSync(path, "utf8");
};

const page = read("app/page.tsx");
const chat = read("app/api/chat/route.ts");
const tts = read("app/api/tts/route.ts");
const health = read("app/api/health/route.ts");
const speech = read("lib/speech-text.ts");
const audioStudio = read("components/AudioStudio.tsx");
const videoStudio = read("components/VideoStudio.tsx");
const knowledge = read("lib/enat-knowledge.ts");
const authServer = read("lib/auth/server.ts");
const authClient = read("lib/auth/client.ts");
const authRoute = read("app/api/auth/[...path]/route.ts");
const authProxy = read("proxy.ts");
const signIn = read("app/auth/sign-in/page.tsx");
const signUp = read("app/auth/sign-up/page.tsx");
const forgotPassword = read("app/auth/forgot-password/page.tsx");
const resetPassword = read("app/auth/reset-password/page.tsx");
const adminPage = read("app/admin/page.tsx");
const adminUsers = read("components/AdminUserManagement.tsx");
const authControls = read("components/AuthControls.tsx");
const documentStudio = read("components/DocumentStudio.tsx");

const checks = [
  ["interface principal continua usando o endpoint de chat", page.includes('fetch("/api/chat"')],
  ["Neon Auth está configurado no servidor", authServer.includes("createNeonAuth") && authServer.includes("NEON_AUTH_BASE_URL")],
  ["cliente usa o wrapper oficial Neon Auth", authClient.includes("createAuthClient") && authClient.includes("@neon/auth/next")],
  ["proxy de autenticação expõe os métodos HTTP necessários", authRoute.includes("auth.handler()") && ["GET","POST","PUT","PATCH","DELETE"].every(method => authRoute.includes(method))],
  ["rotas privadas exigem sessão", authProxy.includes("auth.middleware") && authProxy.includes('loginUrl: "/auth/sign-in"')],
  ["login por e-mail e senha está disponível sem login social", signIn.includes("signIn.email") && !signIn.includes("provider:")],
  ["cadastro exige confirmação OTP", signUp.includes("signUp.email") && signUp.includes("emailOtp.verifyEmail") && signUp.includes("sendVerificationOtp")],
  ["recuperação de senha solicita redefinição por e-mail", forgotPassword.includes("requestPasswordReset") && forgotPassword.includes("/auth/reset-password")],
  ["redefinição valida token e confirmação de senha", resetPassword.includes("resetPassword") && resetPassword.includes("params.get") && resetPassword.includes("password!==confirm")],
  ["APIs de chat e voz exigem sessão", chat.includes("auth.getSession()") && tts.includes("auth.getSession()")],
  ["interface principal continua usando o endpoint de voz", page.includes('fetch("/api/tts"')],
  ["reconhecimento de voz do navegador continua presente", page.includes("SpeechRecognition") && page.includes("webkitSpeechRecognition")],
  ["histórico atual e chave legada continuam preservados", page.includes("atlas-conversations-v2") && page.includes("atlas-conversation-v1")],
  ["Estúdio de áudio continua integrado", page.includes("<AudioStudio") && audioStudio.includes('fetch("/api/tts"')],
  ["Estúdio de vídeo continua integrado", page.includes("<VideoStudio")],
  ["Estúdio de vídeo mantém salvamento automático local", videoStudio.includes("atlas.video-studio.script.v1") && videoStudio.includes("localStorage.setItem")],
  ["Estúdio de vídeo mantém renderização Mediabunny", videoStudio.includes('import("mediabunny")') && videoStudio.includes("addVideoTrack")],
  ["Estúdio de vídeo incorpora faixa de áudio no arquivo final", videoStudio.includes("addAudioTrack") && videoStudio.includes("audioSource.add(audioBuffer)")],
  ["Estúdio de vídeo mantém modos de gerar/baixar e pré-visualizar", videoStudio.includes('"download"') && videoStudio.includes('"preview"') && videoStudio.includes("download=")],
  ["endpoint de chat mantém a base de conhecimento ENAT", chat.includes("ENAT_KNOWLEDGE") && knowledge.length > 1000],
  ["endpoint de chat mantém validação do histórico", chat.includes("MAX_HISTORY_MESSAGES") && chat.includes("MAX_MESSAGE_CHARS")],
  ["TTS mantém modelo e voz configuráveis", tts.includes("GEMINI_TTS_MODEL") && tts.includes("GEMINI_TTS_VOICE")],
  ["TTS mantém orientação vocal aprovada", tts.includes("voz grave, encorpada, firme e acolhedora") && tts.includes('|| "Orus"')],
  ["TTS mantém fallback Piper", tts.includes("piperFallback") && tts.includes("PIPER_TTS_URL") && tts.includes("PIPER_API_TOKEN")],
  ["limpeza do texto falado continua isolada", tts.includes("cleanTextForSpeech") && speech.includes("export function cleanTextForSpeech")],
  ["health check continua sem expor segredos", health.includes("aiConfigured") && health.includes("voiceConfigured") && !health.includes("GEMINI_API_KEY:")],
  ["área administrativa exige sessão e papel admin no servidor", adminPage.includes("auth.getSession()") && adminPage.includes('user.role !== "admin"') && adminPage.includes('redirect("/auth/sign-in")')],
  ["atalho administrativo só aparece para papel admin", authControls.includes('user.role === "admin"') && authControls.includes('href="/admin"')],
  ["gestão administrativa usa endpoints oficiais do Neon Auth", adminUsers.includes("list-users?") && adminUsers.includes('"set-role"') && adminUsers.includes('"ban-user"') && adminUsers.includes('"unban-user"')],
  ["gestão administrativa não permite bloquear ou alterar a própria conta", adminUsers.includes("user.id === currentUserId") && adminUsers.includes("disabled={isSelf || busy}")],
  ["gestão administrativa oferece pesquisa e paginação", adminUsers.includes("searchValue") && adminUsers.includes("PAGE_SIZE") && adminUsers.includes("Próxima")],
  ["Estúdio de documentos está integrado ao bate-papo", page.includes("<DocumentStudio") && page.includes("Criar documento")],
  ["Estúdio de documentos oferece modelos educacionais e institucionais", ["relatorio", "plano", "questionario", "tecnico"].every(kind => documentStudio.includes(`${kind}:`))],
  ["Estúdio de documentos permite prévia para impressão e PDF", documentStudio.includes("window.open") && documentStudio.includes("window.print") && documentStudio.includes("Salvar como PDF")],
  ["conteúdo do documento é escapado antes da prévia HTML", documentStudio.includes("escapeHtml") && documentStudio.includes("safeContent")],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) {
    process.stdout.write(`PASS ${label}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL ${label}\n`);
  }
}

process.stdout.write(`\nResultado: ${checks.length - failures}/${checks.length} verificações aprovadas.\n`);
if (failures) process.exitCode = 1;
