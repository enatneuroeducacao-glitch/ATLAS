# Base de Conhecimento — MB Óptica e MB Gestão Inteligente

**Projeto:** ATLAS Local  
**Idioma:** Português do Brasil  
**Objetivo:** fornecer contexto especializado para responder sobre a operação de uma óptica e sobre os fluxos do MB Gestão Inteligente.  
**Status:** documento-base para consulta/RAG local; não é uma conexão com o banco de dados nem prova do estado atual da aplicação.

## 1. Princípios de resposta do ATLAS

- Responder em português brasileiro, de forma objetiva e operacional.
- Separar conhecimento geral, procedimentos documentados, dados reais consultados e hipóteses.
- Nunca inventar valores de vendas, saldos, estoque, clientes, prazos, taxas, status de ordens ou resultados de auditoria.
- Quando uma resposta depender de dados atuais do MB Gestão Inteligente, informar que é necessário consultar a aplicação ou uma integração local autorizada.
- Não alterar registros, executar estornos, cancelar vendas, emitir documentos fiscais ou modificar configurações sem autorização explícita e confirmação da ação.
- Proteger dados pessoais e dados de saúde visual. Não expor receitas, documentos, telefones ou informações financeiras de clientes a usuários não autorizados.
- Não substituir a avaliação de oftalmologista/optometrista habilitado, nem recomendar alterações clínicas de prescrição.
- Ao diagnosticar problemas técnicos, começar por leitura e verificação; evitar mudanças destrutivas e preservar logs.

## 2. MB Óptica — contexto comercial

A MB Óptica é uma operação de varejo óptico. Seus processos podem envolver:
- Atendimento e cadastro do cliente.
- Recebimento e registro de receita visual.
- Seleção de armações e lentes.
- Orçamento e pedido de venda.
- Definição de medidas e especificações necessárias à fabricação/montagem.
- Encaminhamento ao laboratório, conferência, aviso de pronto e entrega.
- Pagamento, emissão de documentos aplicáveis, garantia e pós-venda.

O ATLAS deve orientar o usuário a confirmar as informações da receita e as medidas necessárias antes de encaminhar um pedido. Não deve inferir dados ausentes nem alterar valores prescritos.

### 2.1 Vocabulário óptico

- **OD:** olho direito.
- **OE:** olho esquerdo.
- **DNP/DP:** distância nasopupilar ou distância pupilar, conforme o instrumento e o procedimento utilizado. Confirmar se a medida solicitada é monocular ou binocular e qual referência o equipamento usa.
- **Esférico, cilíndrico e eixo:** componentes comuns de uma prescrição; copiar fielmente os valores registrados e confirmar dúvidas com o profissional responsável.
- **Adição (ADD):** valor adicional indicado quando aplicável.
- **Armação:** estrutura que sustenta as lentes; compatibilidade com lente, medidas e montagem precisa ser verificada.
- **Laboratório:** etapa de produção ou montagem das lentes e do pedido.
- **Conferência:** verificação do produto e das especificações antes da entrega.

### 2.2 Cuidados com medidas

- Não estimar DNP apenas por uma fotografia sem calibração e validação do método.
- Em aplicações que calculam milímetros a partir de pixels, a escala precisa ser calibrada para cada configuração de captura; não tratar uma conversão fixa de pixels/mm como universal.
- Se a medida estiver fora do intervalo esperado, houver baixa confiança, desalinhamento ou dificuldade com crianças, interromper a confirmação automática e solicitar medição adequada por pessoa capacitada.
- Manter separadas as medidas OD e OE quando o procedimento exigir DNP monocular.
- Registrar a origem da medida (manual, equipamento ou estimativa), quando o sistema oferecer esse campo.

## 3. MB Gestão Inteligente — módulos e fluxos conhecidos

O sistema MB Gestão Inteligente foi concebido para reunir rotinas operacionais de óptica. Os módulos e fluxos documentados neste arquivo são uma referência de domínio; a presença exata de cada recurso deve ser verificada na versão instalada.

### 3.1 Cadastros-base

- **Clientes:** identificação e contato, observando acesso mínimo necessário e privacidade.
- **Fornecedores:** dados comerciais e condições de fornecimento.
- **Produtos:** descrição, categoria, tipo, preço, custo e demais campos disponíveis.
- **Usuários e permissões:** perfis previstos incluem Administrador, Gerente, Vendedor, Financeiro, Laboratório e Auditoria. As permissões efetivas devem ser conferidas no sistema.

### 3.2 Atendimento e receita

Fluxo desejado: selecionar ou cadastrar cliente → registrar/selecionar receita → iniciar atendimento → reutilizar a receita já associada ao cliente quando aplicável.

Evitar pedir ao usuário que redigite dados existentes quando o sistema puder reutilizá-los com segurança. Antes de transmitir uma receita entre telas, confirmar que ela pertence ao cliente selecionado e que os dados estão completos.

### 3.3 Orçamento e ordem de serviço

Fluxo operacional conhecido:
1. Cliente.
2. Receita e medidas aplicáveis.
3. Orçamento.
4. Pedido/ordem de serviço (O.S.).
5. Encaminhamento ao laboratório.
6. Conferência.
7. Status pronto.
8. Entrega ao cliente.

Os nomes dos status podem variar conforme a versão. Antes de afirmar que uma O.S. avançou de etapa, consultar o registro real.

### 3.4 PDV, vendas e caixa

O PDV pode envolver:
- Itens e preços da venda.
- Descontos sujeitos a permissão.
- Pagamentos por Pix, cartão e dinheiro.
- Parcelamento, quando disponível.
- Cancelamento e devolução/estorno, conforme regras do sistema.
- Fechamento e conferência do caixa.

Regras de segurança:
- Não presumir que registrar um pagamento significa que o financeiro foi conciliado.
- Diferenciar venda, recebimento, taxa da operadora, liquidação e saldo de caixa.
- Taxas de cartão podem depender da adquirente, modalidade e condição contratada; usar o valor documentado ou confirmado pelo operador, sem inventar uma taxa padrão.
- Cancelamentos e estornos precisam de confirmação, permissão e trilha de auditoria.
- Não afirmar que o caixa tem dinheiro disponível apenas com base no faturamento registrado.

### 3.5 Estoque

Operações previstas:
- Entrada, saída, ajuste, devolução e inventário.
- Estoque mínimo e alertas, se habilitados.
- Rastreabilidade de movimentações.

Regra de negócio registrada no histórico do projeto: **armações devem movimentar/baixar estoque na venda; lentes não devem baixar estoque automaticamente nesse mesmo fluxo**, conforme a regra operacional definida para o sistema. Antes de alterar essa regra, verificar a implementação e obter autorização, pois o comportamento pode depender do tipo de produto e do processo de laboratório.

### 3.6 Financeiro e contabilidade

Áreas previstas:
- Contas a pagar e a receber.
- Recebimentos, liquidações e conciliação.
- Taxas de cartão.
- Fluxo de caixa, inadimplência e relatórios.
- Eventos contábeis e trilha de auditoria, quando habilitados.

O ATLAS deve reconciliar conceitos antes de concluir uma auditoria:
- Venda não é necessariamente recebimento liquidado.
- Recebimento bruto pode diferir do líquido por taxas.
- Saldo contábil não é necessariamente dinheiro disponível em caixa ou banco.
- Dívidas e compromissos fora do sistema não aparecem em relatórios sem registro ou fonte adicional.
- Divergências devem ser listadas com identificadores, valores, datas e evidências; não corrigir silenciosamente os registros.

### 3.7 Relatórios e indicadores

Relatórios previstos incluem:
- Faturamento e vendas.
- Margem e saúde econômica.
- Estoque.
- Contas a pagar/receber e inadimplência.
- Fornecedores.
- Desempenho de vendas e alertas.

Toda análise financeira deve indicar o período, a fonte dos dados, os filtros e as limitações. Não calcular margem sem distinguir custo, desconto, taxas, impostos e demais componentes disponíveis.

### 3.8 Fiscal e impressão

O projeto prevê configuração fiscal, certificado, ambiente de homologação, emissão, tratamento de rejeições e contingência, além de impressão de O.S., orçamento, receita, etiquetas e cupom de 58 mm.

O ATLAS não deve declarar que a emissão fiscal está ativa ou homologada sem verificar o ambiente e o estado reais. Testes devem ocorrer em homologação quando aplicável. Certificados, senhas e chaves nunca devem ser colocados nesta base de conhecimento ou em código versionado.

## 4. Diagnóstico técnico do MB Gestão Inteligente

Ao investigar um problema:
1. Registrar a tela, o horário, o usuário/perfil e o fluxo que falhou, evitando dados pessoais desnecessários.
2. Reproduzir com dados de teste sempre que possível.
3. Verificar logs, respostas da API, banco de dados e versão implantada, conforme acesso autorizado.
4. Identificar se o problema é visual, de validação, persistência, regra de negócio, integração ou relatório.
5. Propor a menor alteração possível.
6. Fazer backup quando pertinente, testar e validar antes/depois.
7. Confirmar CI, implantação e comportamento real antes de declarar resolvido.

Não confundir uma alteração no GitHub com implantação concluída, nem implantação concluída com homologação funcional.

## 5. Arquitetura de conhecimento local do ATLAS

Este documento pode ser indexado localmente para busca semântica/RAG. A arquitetura recomendada:
- Arquivos Markdown como fonte editável e auditável.
- Indexação local e embeddings executados localmente, sem API externa.
- Base vetorial local ou busca textual local.
- Respostas fundamentadas em trechos recuperados, com indicação do arquivo de origem.
- Separação entre documentação estática e dados operacionais vivos.
- Banco de dados do MB Gestão somente por integração local explicitamente autorizada, com usuário de leitura para análises sempre que possível.
- Segredos, dados de clientes e cópias integrais de banco não devem ser armazenados neste repositório.

## 6. Limites e atualização

Este documento é uma base inicial compilada a partir dos requisitos e fluxos conhecidos do projeto. Não é manual oficial, não garante que todos os módulos estejam presentes na versão de produção e não contém acesso ao banco de dados. Ao descobrir diferenças, o ATLAS deve apontá-las e pedir validação antes de atualizar a regra documentada.
