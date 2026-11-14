import { Builder } from './builder.js';

// Mundo 1-1: Pradera Dorada
function level1() {
  const b = new Builder(212, 15);
  b.ground(0, 68).ground(71, 86).ground(90, 152).ground(155, 211);
  b.put(4, 2, '@');
  b.text(16, 5, '?').text(20, 5, 'BMB?B').text(22, 9, '?');
  b.put(23, 2, 'e');
  b.pillar(28, 2, 2).pillar(38, 2, 3).pillar(46, 2, 4).pillar(57, 2, 4);
  b.put(41, 2, 'e').put(51, 2, 'e').put(53, 2, 'e');
  b.coins(31, 6, 4);
  b.text(64, 6, '1');
  b.text(77, 5, 'BMB').text(80, 9, 'BBBBBBBB').text(91, 9, 'BBB?').text(94, 5, '$');
  b.put(82, 10, 'e').put(84, 10, 'e');
  b.text(100, 5, 'BS').text(106, 5, '?').text(109, 5, '?').text(109, 9, 'M').text(112, 5, '?');
  b.put(98, 2, 'k').put(108, 2, 'e').put(110, 2, 'e');
  b.text(118, 5, 'B').text(121, 9, 'BBB').text(128, 9, 'B??B').text(129, 5, 'BB');
  b.put(124, 2, 'e').put(126, 2, 'e').put(130, 2, 'e').put(132, 2, 'e');
  b.put(100, 2, 'c');
  b.stairs(134, 2, 4, 1).stairs(140, 2, 4, -1).stairs(148, 2, 5, 1).rect(153, 2, 1, 5, 'X').stairs(155, 2, 4, -1);
  b.pillar(163, 2, 2).text(168, 5, 'BB?B').put(172, 2, 'e').put(174, 2, 'e').pillar(179, 2, 2);
  b.coins(166, 8, 3);
  b.stairs(181, 2, 9, 1).rect(190, 2, 1, 9, 'X');
  b.put(198, 2, 'G');
  return { id: '1-1', name: 'Pradera Dorada', theme: 'pradera', time: 400, rows: b.rows() };
}

export const LEVELS = [level1()];
