// Mock DB and DOM
global.window = global;
global.document = { querySelector: () => ({ value: 100 }) };
global.DB = {
  config: { paymentMethods: ['Efectivo', 'Punto de Venta', 'Zelle', 'Binance', 'Crédito'] },
  cashClosings: [],
  receivablePayments: [],
};

// Mock dependencies
global.salesOnDate = (iso) => [];
global.expensesOnDate = (iso) => [];
global.todayISO = () => '2023-10-01';
global.money = (m, curr) => `${curr} ${m}`;
global.esc = (s) => s;

// Load script
const fs = require('fs');
const script = fs.readFileSync('c:/Users/angel/OneDrive/Documents/cuadre/cuadre/js/cierre.js', 'utf8');
eval(script);

console.log("cierre.js loaded.");

// Scenario 1: No previous closures
global.salesOnDate = (iso) => [{ totalUsd: 100, items: [], payments: [{ method: 'Efectivo', amountUsd: 100 }] }];
const res1 = calcularCierre('2023-10-01');
console.log("Res1:", res1.teorico.Efectivo === 100 ? "PASS" : "FAIL", "teorico", res1.teorico);

// Scenario 2: Previous closure exists
global.DB.cashClosings.push({ date: '2023-09-30', real: { Efectivo: 50 } });
const res2 = calcularCierre('2023-10-01');
console.log("Res2:", res2.teorico.Efectivo === 150 ? "PASS" : "FAIL", "teorico", res2.teorico);

// Scenario 3: Receivable payment
global.DB.receivablePayments.push({ date: '2023-10-01', method: 'Zelle', amount: 40 });
const res3 = calcularCierre('2023-10-01');
console.log("Res3:", res3.teorico.Zelle === 40 ? "PASS" : "FAIL", "teorico", res3.teorico);

console.log("All tests finished");
