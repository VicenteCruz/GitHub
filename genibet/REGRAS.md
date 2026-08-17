# Regras de Negócio e Arquitetura - TeamTracker Pro

Este documento serve como a "Fonte da Verdade" para as regras de alocação e funcionamento do sistema.

## 1. Estrutura da Equipa
*   **Total de Equipas:** 8 equipas.
*   **Composição:** 5 funcionários por equipa (Identificados de F1 a F5).
*   **Total de Colaboradores:** 40 pessoas.

## 2. Lógica de Alocação (Tab 1)
A aplicação distingue automaticamente entre um **Local de Trabalho** e uma **Tarefa/Estado** através de um prefixo:

*   **Local (@):** Deve começar obrigatoriamente com `@` (ex: `@Obra Alfa`, `@Edifício Beta`).
    *   *Comportamento:* Gera automaticamente uma coluna na **Tab 2 (Tracker Operacional)**.
*   **Tarefa/Estado:** Texto livre sem o prefixo `@` (ex: `Férias`, `Oficina`, `Formação`).
    *   *Comportamento:* Fica visível apenas na Tab 1; não gera coluna operacional.

## 3. Tracker Operacional (Tab 2)
*   **Colunas Dinâmicas:** A Tab 2 filtra a Tab 1 em tempo real. Apenas os locais com pelo menos um funcionário alocado aparecem como colunas.
*   **Detalhamento:** Cada local permite a inserção de texto livre (textarea) para descrever o trabalho específico do dia.
*   **Leitura de Equipa:** Debaixo da descrição, o sistema lista automaticamente os códigos dos funcionários (ex: `E1-F3`) alocados àquele local.

## 4. Sistema de Perfis (RBAC)
Acesso controlado via Firebase Auth e Firestore (coleção `users`):

| Perfil | Permissões | Cor (Badge) |
| :--- | :--- | :--- |
| **Admin** | Edição total, Gravação, Limpeza de semana | Roxo (`#8b5cf6`) |
| **Editor** | Edição total, Gravação | Verde (`#22c55e`) |
| **Viewer** | Apenas leitura em tempo real | Cinza (`#64748b`) |

## 5. Persistência de Dados
*   **ID da Semana:** Os dados são guardados com base no padrão ISO de semanas (ex: `2024-W18`).
*   **Firestore:**
    *   `allocations/{weekId}`: Mapa de alocações diárias.
    *   `operational_details/{weekId}`: Textos detalhados da Tab 2.
    *   `users/{uid}`: Definição de perfis.

## 6. Sincronização
*   **Real-time:** O sistema utiliza `onSnapshot`, garantindo que qualquer alteração feita por um Editor/Admin seja refletida instantaneamente em todos os ecrãs ligados.
