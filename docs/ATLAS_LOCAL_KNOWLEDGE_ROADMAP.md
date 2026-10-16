# ATLAS — Expansão da base local de conhecimento

## Escopo desta primeira mudança

- Pesquisa textual local em arquivos de documentação e código.
- Diretório configurável por `ATLAS_KNOWLEDGE_DIR`.
- Endpoint `POST /api/knowledge/search`, desativado por padrão.
- Endpoint exige `ATLAS_LOCAL_KNOWLEDGE_ENABLED=true` e requisição com host local.
- Arquivos ignorados: segredos, arquivos `.env`, dependências, builds e diretórios de controle de versão.
- Limites: 5.000 arquivos, 512 KiB por arquivo e 8 resultados.

## Configuração local no Windows

Adicionar somente ao arquivo local `.env.local` (não versionar):

```dotenv
ATLAS_LOCAL_KNOWLEDGE_ENABLED=true
ATLAS_KNOWLEDGE_DIR=C:\\Users\\SEU_USUARIO\\Documents\\ATLAS-Knowledge
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
```

Crie o diretório indicado e coloque nele cópias autorizadas dos documentos e repositórios a indexar. Não coloque arquivos `.env`, credenciais, dados pessoais de clientes nem dumps de produção na biblioteca.

## Formatos

Esta primeira versão pesquisa texto simples e código-fonte: Markdown, texto, JSON, TypeScript/JavaScript, Python, SQL, Prisma, HTML/CSS, YAML, TOML, XML e CSV. PDF, DOCX e XLSX exigem extratores dedicados e serão adicionados na próxima etapa, com limites de tamanho e testes específicos. Arquivos digitalizados exigirão OCR.

## Testes manuais da primeira versão

1. Com as variáveis ausentes, `POST /api/knowledge/search` deve retornar 403.
2. Com as variáveis locais habilitadas, chamada a partir de `http://localhost:3000` deve pesquisar.
3. A mesma chamada com host não local deve retornar 403.
4. Consulta com menos de 2 ou mais de 500 caracteres deve retornar 400.
5. Criar `teste.md` com uma frase conhecida e verificar que a busca a retorna.
6. Criar um arquivo `.env.local` de teste com a mesma frase e verificar que não é retornado.
7. Confirmar que `node_modules`, `.git`, `.next` e arquivos grandes são ignorados.
8. Executar `npm run build` e `npm run lint`; revisar erros antes de integrar.

## Próximas etapas

1. Adicionar extração de PDF, DOCX e XLSX com bibliotecas mantidas e testes.
2. Dividir documentos em trechos com metadados de origem, categoria e versão.
3. Integrar a recuperação ao endpoint de chat apenas quando o modo local estiver selecionado.
4. Adicionar embeddings locais do Ollama para busca semântica.
5. Criar importador local com relatório, deduplicação e atualização incremental.
6. Adicionar fontes oficiais atualizáveis, com URL e data de consulta, sem atualizar silenciosamente documentos privados.
7. Só depois da homologação avaliar qualquer publicação ou integração adicional.

## Segurança e produção

O endpoint não é conectado ao chat atual e não altera a rota de produção. A variável de habilitação fica desativada por padrão. A verificação de host é uma barreira adicional, não substitui autenticação se o endpoint for futuramente exposto por proxy ou túnel. Não publicar o diretório local nem a porta do Ollama na internet.
