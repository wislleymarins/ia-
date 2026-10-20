# PulseTrade — Terminal de sinais simulado

Projeto React + TypeScript + Vite para estudo e teste de uma interface de trading. **Não usa cotações reais nem envia ordens.**

## Requisitos
- Node.js 20 ou superior (recomendado)
- npm

## Instalar e executar
No terminal, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite (normalmente `http://localhost:5173`).

## Gerar versão de produção
```bash
npm run build
npm run preview
```

## Funcionalidades
- Ativos simulados BTC/USD, ETH/USD, EUR/USD, GBP/USD e USD/JPY
- Gráfico de linha com atualização automática e controles de pausa
- Cálculos locais de EMA 20, RSI 14, ATR 14 e retrações de Fibonacci
- Motor experimental de sinais CALL/PUT
- Estados Pendente, WIN, LOSS e Expirado
- Criação manual de sinal fictício para testar o histórico

## Observações importantes
- Os preços são gerados com `Math.random()`; reiniciar ou recarregar altera os dados.
- O gráfico é uma série ilustrativa de preços, não um feed de mercado.
- O motor de sinais é demonstrativo. Não há backtest robusto, gestão de risco de carteira, integração com corretora nem garantia de resultado.
- O resultado de um sinal é avaliado usando ticks simulados. Operações reais exigiriam dados de mercado confiáveis, testes e revisão de risco.
